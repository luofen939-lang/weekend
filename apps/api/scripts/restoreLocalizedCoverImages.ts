import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

import mysql from "mysql2/promise";

import { config } from "../src/config.js";

type CoverSource = {
  activityId: number;
  localPath: string;
  sourceUrl: string;
};

const migrationPath = resolve(
  process.cwd(),
  "..",
  "..",
  "database",
  "migrations",
  "022_localize_blind_box_cover_images.sql",
);
const maxConcurrency = 1;
const maxImageBytes = 12 * 1024 * 1024;
const requestTimeoutMs = 30_000;

const allowedSourceHosts = new Set([
  "cn.storage.shmedia.tech",
  "commons.wikimedia.org",
  "huacheng.gz-cmc.com",
  "images.adsttc.com",
  "images.trvl-media.com",
  "img.qianggen.net",
  "imgbdb4.bendibao.com",
  "obj.shine.cn",
  "oss.gooood.cn",
  "p1-mp.oeeee.com",
  "r1.visitbeijing.com.cn",
  "resource02.ulifestyle.com.hk",
  "upload.wikimedia.org",
  "www.meet-in-shanghai.net",
  "www.news.cn",
  "www.ourchinastory.com",
]);

const unsafeMetadataPattern =
  /(?:porn|porno|nude|naked|sex|erotic|gore|corpse|weapon|shooting|gambling|casino|黄赌毒|色情|裸照|血腥|尸体|枪击|赌博)/i;

function parseCoverSources(sql: string) {
  const entries: CoverSource[] = [];
  const updatePattern =
    /UPDATE activities\s+SET cover_image = '([^']+)'\s+WHERE id = (\d+)[\s\S]*?AND cover_image = '(https?:\/\/[^']+)';/g;

  for (const match of sql.matchAll(updatePattern)) {
    const [, localPath, activityId, sourceUrl] = match;
    if (!localPath || !activityId || !sourceUrl) continue;
    entries.push({
      activityId: Number(activityId),
      localPath,
      sourceUrl,
    });
  }

  return entries;
}

function resolveLocalFile(localPath: string) {
  if (!localPath.startsWith("/uploads/activity-covers/blind-box/")) {
    throw new Error(`不允许写入封面目录之外的路径：${localPath}`);
  }
  return resolve(process.cwd(), localPath.slice(1));
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function wikimediaThumbnailUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.hostname === "commons.wikimedia.org" && url.pathname.includes("/wiki/Special:FilePath/")) {
    url.searchParams.set("width", "1600");
    return url.toString();
  }

  if (url.hostname === "upload.wikimedia.org") {
    const filename = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (filename) {
      const thumbnail = new URL(
        `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`,
      );
      thumbnail.searchParams.set("width", "1600");
      return thumbnail.toString();
    }
  }

  return sourceUrl;
}

function validateSourceUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || !allowedSourceHosts.has(url.hostname)) {
    throw new Error(`图片来源不在安全白名单：${url.hostname}`);
  }

  const metadata = decodeURIComponent(`${url.pathname} ${url.search}`);
  if (unsafeMetadataPattern.test(metadata)) {
    throw new Error("图片来源元数据命中不良内容关键词");
  }
}

function validateImageBytes(bytes: Buffer, filePath: string) {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const extension = extname(filePath).toLowerCase();

  if (
    (extension === ".jpg" || extension === ".jpeg") && !isJpeg ||
    extension === ".png" && !isPng ||
    extension === ".webp" && !isWebp
  ) {
    throw new Error(`图片内容与扩展名不一致：${extension}`);
  }
}

async function downloadCover(entry: CoverSource) {
  validateSourceUrl(entry.sourceUrl);
  const filePath = resolveLocalFile(entry.localPath);
  if (await fileExists(filePath)) {
    return "skipped" as const;
  }

  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(attempt === 1 ? 650 : 2_500 * attempt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const nextResponse = await fetch(wikimediaThumbnailUrl(entry.sourceUrl), {
        signal: controller.signal,
        headers: {
          Accept: "image/jpeg,image/png;q=0.9,image/webp;q=0.8",
          "User-Agent": "lazy2move-safe-cover-fetcher/1.0",
        },
        redirect: "follow",
      });
      if (nextResponse.ok) {
        response = nextResponse;
        break;
      }

      lastError = new Error(`HTTP ${nextResponse.status}`);
      if (nextResponse.status !== 429 && nextResponse.status < 500) {
        break;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    throw lastError instanceof Error ? lastError : new Error("图片下载失败");
  }

  try {
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (!contentType || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      throw new Error(`不支持的图片类型：${contentType ?? "unknown"}`);
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxImageBytes) {
      throw new Error("图片文件过大");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxImageBytes) {
      throw new Error("图片文件为空或超过大小限制");
    }
    validateImageBytes(bytes, filePath);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    return "downloaded" as const;
  } finally {
    await response.body?.cancel().catch(() => undefined);
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

const migrationSql = await readFile(migrationPath, "utf8");
const parsedCovers = parseCoverSources(migrationSql);
if (parsedCovers.length === 0) {
  throw new Error("没有从本地化迁移中找到可信图片来源");
}

const connection = await mysql.createConnection(config.database);
const [activeCoverRows] = await connection.execute(
  `SELECT DISTINCT cover_image AS coverImage
   FROM activities
   WHERE cover_image LIKE '/uploads/activity-covers/blind-box/%'`,
);
await connection.end();
const activeCoverPaths = new Set(
  (activeCoverRows as Array<{ coverImage: string }>).map((row) => row.coverImage),
);
const covers = parsedCovers.filter((entry) => activeCoverPaths.has(entry.localPath));
if (covers.length === 0) {
  throw new Error("数据库没有引用需要恢复的本地目的地封面");
}

let downloaded = 0;
let skipped = 0;
const failures: Array<{ activityId: number; reason: string }> = [];

await mapWithConcurrency(covers, maxConcurrency, async (entry, index) => {
  try {
    const status = await downloadCover(entry);
    if (status === "downloaded") downloaded += 1;
    else skipped += 1;
    console.log(`[${index + 1}/${covers.length}] ${entry.activityId} ${status}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    failures.push({ activityId: entry.activityId, reason });
    console.warn(`[${index + 1}/${covers.length}] ${entry.activityId} failed: ${reason}`);
  }
});

console.log(
  `目的地封面恢复完成：下载 ${downloaded}，已存在 ${skipped}，失败 ${failures.length}`,
);
if (failures.length > 0) {
  process.exitCode = 1;
}
