#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.expo',
  '.tools',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);
const ignoredExtensions = new Set([
  '.docx',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.lock',
  '.mp3',
  '.mp4',
  '.pdf',
  '.png',
  '.svg',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);
const forbiddenFilePatterns = [
  /^\.env$/,
  /^\.env\..+$/,
  /\.(?:key|p12|pem|pfx)$/i,
];
const allowedEnvironmentFile = '.env.example';
const contentRules = [
  {
    name: '私钥正文',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  },
  {
    name: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    name: '常见云服务令牌',
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{12,}|sk-ant-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|AKID[0-9A-Za-z]{12,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,})\b/g,
  },
  {
    name: '平台部署应用 ID',
    pattern: /\bapp_[a-z0-9]{8,}\b/g,
  },
  {
    name: '内部部署域名',
    pattern: /\b(?:[a-z0-9-]+\.)?(?:feishuapp\.com|chatgpt\.site|aiforce\.cloud)\b/gi,
  },
  {
    name: '本机用户绝对路径',
    pattern: /\/Users\/(?!user\/|example\/)[A-Za-z0-9._-]+\//g,
  },
  {
    name: '带凭据的数据库 URL',
    pattern: /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:[^@\s/]+@/gi,
  },
  {
    name: '中国大陆手机号',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  },
];
const emailPattern = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const allowedEmailDomains = new Set(['example.com', 'example.org', 'example.net', 'invalid.test']);

const findings = [];

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

for (const absolutePath of await collectFiles(repositoryRoot)) {
  const relativePath = path.relative(repositoryRoot, absolutePath);
  const baseName = path.basename(absolutePath);
  const extension = path.extname(baseName).toLowerCase();

  if (
    relativePath === 'scripts/check-sensitive-info.mjs' ||
    baseName === 'package-lock.json'
  ) {
    continue;
  }

  if (
    baseName !== allowedEnvironmentFile &&
    forbiddenFilePatterns.some((pattern) => pattern.test(baseName))
  ) {
    findings.push({ file: relativePath, line: 1, rule: '不应提交的配置或密钥文件' });
    continue;
  }

  if (ignoredExtensions.has(extension)) {
    continue;
  }

  const fileStats = await stat(absolutePath);
  if (fileStats.size > 5 * 1024 * 1024) {
    continue;
  }

  const content = await readFile(absolutePath, 'utf8').catch(() => null);
  if (content === null || content.includes('\0')) {
    continue;
  }

  for (const rule of contentRules) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      findings.push({
        file: relativePath,
        line: lineNumberAt(content, match.index ?? 0),
        rule: rule.name,
      });
    }
  }

  emailPattern.lastIndex = 0;
  for (const match of content.matchAll(emailPattern)) {
    const domain = match[1]?.toLowerCase();
    if (domain && !allowedEmailDomains.has(domain)) {
      findings.push({
        file: relativePath,
        line: lineNumberAt(content, match.index ?? 0),
        rule: '非示例邮箱地址',
      });
    }
  }
}

if (findings.length > 0) {
  console.error(`发现 ${findings.length} 个需要复核的敏感信息位置：`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}]`);
  }
  process.exit(1);
}

console.log('敏感信息扫描通过：未发现常见密钥、个人联系方式或本机路径。');
