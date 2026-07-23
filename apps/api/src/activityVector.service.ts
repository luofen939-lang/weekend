import { createHash } from "node:crypto";

import { ChromaClient, type Collection, type Metadata, type Where } from "chromadb";

import { config, getEmbeddingModelName } from "./config.js";
import { parseJsonArray, type ActivityRow } from "./types.js";
import { embeddingService } from "./travel/ai/embedding.service.js";

export type ActivityVectorPreferences = {
  partySize: number;
  durationMinutes: number | null;
  budgetMax: number | null;
  mood: string;
  randomLevel: number;
  category: string;
  environment: "indoor" | "outdoor" | "either";
  radiusKm: number | null;
  originName?: string | null;
};

export type ActivityVectorSearchInput = {
  cityId: number;
  preferences: ActivityVectorPreferences;
};

export type ActivityVectorMetadata = Metadata & {
  entity_type: "activity";
  activity_id: number;
  city_id: number;
  category: string;
  mood: string;
  environment: "indoor" | "outdoor" | "either";
  budget_yuan: number;
  duration_minutes: number;
  min_party_size: number;
  max_party_size: number;
  district: string;
  source: string;
  is_active: true;
  embedding_model: string;
  source_hash: string;
};

type ChromaConnectionOptions = {
  host: string;
  port: number;
  ssl: boolean;
};

const DEFAULT_SEARCH_LIMIT = 80;
const CHROMA_TIMEOUT_MS = 2_500;
const ACTIVITY_BATCH_SIZE = 64;

function parseChromaUrl(rawUrl: string): ChromaConnectionOptions {
  const parsed = new URL(rawUrl);
  return {
    host: parsed.hostname || "127.0.0.1",
    port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
    ssl: parsed.protocol === "https:",
  };
}

function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function stringifyParts(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean)
    .join("；");
}

export function getActivityVectorId(activityId: number) {
  return `activity:${activityId}`;
}

export function getActivityVectorSource(row: ActivityRow) {
  return row.description.startsWith("来自《出行盲盒地点库") ? "blind_box_import" : "activity";
}

export function buildActivityVectorText(row: ActivityRow) {
  return stringifyParts([
    `城市：${row.city_name}`,
    `标题：${row.title}`,
    `摘要：${row.summary}`,
    `描述：${row.description}`,
    `分类：${row.category}`,
    `心情：${row.mood}`,
    parseJsonArray(row.mood_tags).length > 0 ? `心情标签：${parseJsonArray(row.mood_tags).join("、")}` : "",
    `环境：${row.environment}`,
    `区域：${row.district}`,
    `地址：${row.address}`,
    parseJsonArray(row.steps).length > 0 ? `步骤：${parseJsonArray(row.steps).join("、")}` : "",
    parseJsonArray(row.tips).length > 0 ? `提示：${parseJsonArray(row.tips).join("、")}` : "",
  ]);
}

export function buildActivityVectorMetadata(row: ActivityRow, document = buildActivityVectorText(row)): ActivityVectorMetadata {
  return {
    entity_type: "activity",
    activity_id: Number(row.id),
    city_id: Number(row.city_id),
    category: row.category,
    mood: row.mood,
    environment: row.environment,
    budget_yuan: Number(row.budget_yuan),
    duration_minutes: Number(row.duration_minutes),
    min_party_size: Number(row.min_party_size),
    max_party_size: Number(row.max_party_size),
    district: row.district,
    source: getActivityVectorSource(row),
    is_active: true,
    embedding_model: getEmbeddingModelName(),
    source_hash: hashText(document),
  };
}

export function buildDrawPreferenceVectorText(input: ActivityVectorSearchInput) {
  const preferences = input.preferences;
  return stringifyParts([
    `城市ID：${input.cityId}`,
    `人数：${preferences.partySize}`,
    preferences.durationMinutes === null ? "" : `最长时长：${preferences.durationMinutes}分钟`,
    preferences.budgetMax === null ? "" : `预算上限：${preferences.budgetMax}元`,
    preferences.mood === "随便" ? "" : `想要的心情：${preferences.mood}`,
    preferences.category === "不限" ? "" : `活动分类：${preferences.category}`,
    preferences.environment === "either" ? "" : `环境偏好：${preferences.environment}`,
    preferences.radiusKm === null ? "" : `半径：${preferences.radiusKm}公里`,
    preferences.originName ? `出发地：${preferences.originName}` : "",
    `随机程度：${preferences.randomLevel}`,
  ]);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export class ActivityVectorService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;

  isConfigured() {
    return embeddingService.isAvailable();
  }

  get collectionName() {
    return config.ai.chroma.collections.activities;
  }

  private getClient() {
    if (!this.client) {
      this.client = new ChromaClient(parseChromaUrl(config.ai.chroma.url));
    }
    return this.client;
  }

  async heartbeat() {
    if (!this.isConfigured()) return false;
    try {
      await withTimeout(this.getClient().heartbeat(), CHROMA_TIMEOUT_MS, "Chroma heartbeat");
      return true;
    } catch {
      return false;
    }
  }

  private async getCollection() {
    if (!this.collection) {
      this.collection = await withTimeout(
        this.getClient().getOrCreateCollection({
          name: this.collectionName,
          embeddingFunction: null,
          metadata: {
            entity_type: "activity",
            embedding_model: getEmbeddingModelName(),
          },
        }),
        CHROMA_TIMEOUT_MS,
        "Chroma getOrCreateCollection",
      );
    }
    return this.collection;
  }

  async upsertActivities(rows: ActivityRow[]) {
    if (rows.length === 0) return { count: 0 };
    if (!this.isConfigured()) {
      throw new Error("Embedding provider is not configured");
    }

    let count = 0;
    for (let i = 0; i < rows.length; i += ACTIVITY_BATCH_SIZE) {
      const batch = rows.slice(i, i + ACTIVITY_BATCH_SIZE);
      const documents = batch.map(buildActivityVectorText);
      const embeddings = await embeddingService.embedBatch(documents);
      const metadatas = batch.map((row, index) => buildActivityVectorMetadata(row, documents[index] ?? ""));
      const collection = await this.getCollection();
      await withTimeout(
        collection.upsert({
          ids: batch.map((row) => getActivityVectorId(Number(row.id))),
          documents,
          embeddings,
          metadatas,
        }),
        CHROMA_TIMEOUT_MS * 3,
        "Chroma activity upsert",
      );
      count += batch.length;
    }

    return { count };
  }

  async searchActivityIds(input: ActivityVectorSearchInput, limit = DEFAULT_SEARCH_LIMIT) {
    if (!this.isConfigured()) return [];
    const queryText = buildDrawPreferenceVectorText(input);
    const queryEmbedding = await embeddingService.embedOne(queryText);
    const collection = await this.getCollection();
    const where: Where = {
      $and: [
        { entity_type: "activity" },
        { city_id: input.cityId },
        { is_active: true },
      ],
    };
    const result = await withTimeout(
      collection.query<ActivityVectorMetadata>({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where,
        include: ["metadatas", "distances"],
      }),
      CHROMA_TIMEOUT_MS,
      "Chroma activity query",
    );

    const metadatas = result.metadatas[0] ?? [];
    return metadatas
      .map((metadata) => Number(metadata?.activity_id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }
}

export const activityVectorService = new ActivityVectorService();
