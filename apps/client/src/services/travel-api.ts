import { Platform } from 'react-native';

import { getAuthToken } from '@/lib/auth-storage';
import type {
  AiRecommendParams,
  Destination,
  RecommendResponse,
  SemanticSearchHit,
  TravelTag,
  TripGenerateParams,
} from '@/types/travel';

const platformDefault = Platform.select({
  android: 'http://10.0.2.2:3001/api/v1',
  default: 'http://localhost:3001/api/v1',
});

const API_URL = process.env.EXPO_PUBLIC_API_URL || platformDefault;

class TravelConnectionError extends Error {
  constructor() {
    super('无法连接服务器，请稍后重试');
  }
}

async function travelRequest<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new TravelConnectionError();
  }

  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(body.error?.message ?? '请求失败');
  }

  return body.data as T;
}

export async function getTravelTags() {
  return await travelRequest<TravelTag[]>('/travel/tags', undefined, false);
}

export async function getDestinations(hot?: boolean) {
  const q = hot ? '?hot=true' : '';
  return await travelRequest<Destination[]>(`/destinations${q}`, undefined, false);
}

export async function getAiRecommendations(params: AiRecommendParams) {
  return await travelRequest<RecommendResponse>('/recommendations/ai', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function semanticSearch(query: string, target: 'all' | 'attraction' | 'destination' = 'all') {
  return await travelRequest<{ results: SemanticSearchHit[]; total: number; mode: string }>(
    '/search/semantic',
    { method: 'POST', body: JSON.stringify({ query, target }) },
    false,
  );
}

export async function saveTravelPreferences(input: {
  preferenceTags: string[];
  tripTypes?: string[];
  budgetMin?: number | null;
  budgetMax?: number | null;
}) {
  return await travelRequest<{ ok: boolean }>('/users/me/travel-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function generateTripStream(
  params: TripGenerateParams,
  onDelta: (text: string) => void,
  onDone: (full: string) => void,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/trips/ai-generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...params, stream: true }),
    });
  } catch {
    throw new TravelConnectionError();
  }

  if (!response.ok || !response.body) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? '行程生成失败');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as { delta?: string; done?: boolean; full?: string };
        if (payload.delta) {
          full += payload.delta;
          onDelta(payload.delta);
        }
        if (payload.done && payload.full) full = payload.full;
      } catch {
        // 忽略不完整 chunk
      }
    }
  }

  onDone(full);
}

export async function generateTripAsync(params: TripGenerateParams) {
  return await travelRequest<{ taskId: string; status: string }>('/trips/ai-generate', {
    method: 'POST',
    body: JSON.stringify({ ...params, stream: false }),
  });
}

export async function getTripGenerateTask(taskId: string) {
  return await travelRequest<{ status: string; result?: unknown; error?: string }>(
    `/trips/ai-generate/${taskId}`,
    undefined,
    false,
  );
}
