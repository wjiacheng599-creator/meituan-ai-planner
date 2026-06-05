import type { AgentResult } from './agent';
import type { Activity, AIStoryContent, CopilotMessage, Plan, WeatherInfo } from './ai';
import type { PersonProfile } from '../types';
import type { PlannerTaskState } from '../types';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';

export interface ServerTaskSessionSummary {
  id: string;
  title: string;
  summary: string;
  queryDraft: string;
  status: 'draft' | 'planning' | 'ready';
  updatedAt: number;
  planId?: string;
  planTitle?: string;
  planSummary?: string;
  durationTags?: string;
  totalPrice?: number;
  memberCount?: number;
  selectedProfileIds?: string[];
  timePref?: string;
  targetType?: string;
  collabStrategy?: 'balanced' | 'care' | 'efficient';
  tieBreaker?: string;
  memberVotes?: Record<string, string[]>;
  memberAvoids?: Record<string, string[]>;
  tempProfiles?: PersonProfile[];
  messages?: unknown[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ServerBootstrapPayload {
  user: {
    id: string;
    isAnonymous: boolean;
    createdAt: number;
  };
  profiles: PersonProfile[];
  sessions: ServerTaskSessionSummary[];
  savedPlans: Plan[];
  plannerTaskStates: PlannerTaskState[];
  pagination?: PaginationInfo;
}

interface GeneratePlanPayload {
  plan: Plan;
  taskState: PlannerTaskState;
  session: {
    id: string;
    title: string;
    summary: string;
    status: string;
    updatedAt: number;
  };
}

interface ExecutePlanPayload {
  executionRunId: string;
  result: AgentResult;
}

interface ShareArtifactPayload {
  shareSlug: string;
  shareUrl: string;
}

// [PERF-OPT] Request deduplication for GET requests
const pendingRequests = new Map<string, Promise<unknown>>();

// ── Auth: 确保用户已注册（获取 cookie） ──
let authEnsured = false;
let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  if (authEnsured) return;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
      const data = await res.json();
      if (data.authenticated) {
        authEnsured = true;
        return;
      }
      // 未认证，尝试注册
      const regRes = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (regRes.ok) {
        authEnsured = true;
        console.log('[serverApi] Auto-registered new user');
      } else {
        console.warn('[serverApi] Registration failed:', regRes.status);
        authEnsured = false;
      }
    } catch (e) {
      console.warn('[serverApi] Auth check/register failed:', e);
      authEnsured = false;
      throw new Error('认证失败，请检查网络后重试');
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

async function requestJson<T>(
  input: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const url = `${API_BASE}${input}`;
  const options = init || {};

  // [PERF-OPT] Deduplicate GET requests
  const method = options.method || 'GET';
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') {
    const dedupKey = `${method}:${url}:${JSON.stringify(options.body || '')}`;
    if (pendingRequests.has(dedupKey)) {
      return pendingRequests.get(dedupKey)! as Promise<T>;
    }
    const promise = (async () => {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
        ...options,
        signal: options.signal,
      });

      if (!response.ok) {
        throw new Error(`SERVER_API_${response.status}`);
      }

      return response.json();
    })().finally(() => pendingRequests.delete(dedupKey));
    pendingRequests.set(dedupKey, promise);
    return promise as Promise<T>;
  }

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`SERVER_API_${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function bootstrapServerSession(options?: {
  page?: number;
  limit?: number;
}): Promise<ServerBootstrapPayload> {
  // 确保已注册获取 cookie
  await ensureAuth();
  const params = new URLSearchParams();
  if (options?.page) params.append('page', String(options.page));
  if (options?.limit) params.append('limit', String(options.limit));
  const query = params.toString();
  return requestJson<ServerBootstrapPayload>(`/api/session/bootstrap${query ? '?' + query : ''}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// [PERF-OPT] SSE streaming for plan generation - reduces perceived latency
export async function generatePlanStream(
  query: string,
  city?: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  sessionId?: string | null
): Promise<GeneratePlanPayload> {
  await ensureAuth();
  const url = `${API_BASE}/api/plans/generate?stream=true`;
  const body = JSON.stringify({ query, city, sessionId: sessionId || undefined });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body,
    signal: signal || AbortSignal.timeout(60000),
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(`SERVER_API_${res.status}`);
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: GeneratePlanPayload | null = null;

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.chunk && onChunk) {
            onChunk(data.chunk);
          }
          if (data.done && data.plan) {
            finalResult = {
              plan: data.plan,
              taskState: data.taskState,
              session: data.session,
            } as GeneratePlanPayload;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }

  if (!finalResult) {
    throw new Error('行程生成中断：数据流未完成，请重试');
  }
  return finalResult;
}

export async function generatePlanViaServer(payload: {
  query: string;
  city?: string;
  signal?: AbortSignal;
  travelDNA?: Record<string, unknown>;
  context?: Record<string, unknown>;
  sessionId?: string;
}): Promise<GeneratePlanPayload> {
  await ensureAuth();
  try {
    return await requestJson<GeneratePlanPayload>('/api/plans/generate', {
      method: 'POST',
      body: JSON.stringify({
        query: payload.query,
        city: payload.city,
        travelDNA: payload.travelDNA,
        context: payload.context,
        sessionId: payload.sessionId,
      }),
      signal: payload.signal || AbortSignal.timeout(30000),
    });
  } catch (error) {
    console.error('[serverApi] generatePlanViaServer failed:', error);
    throw error;
  }
}

export async function executePlanViaServer(payload: {
  planId?: string;
  plan: Plan;
  activityIds?: string[];
  peopleCount: number;
}): Promise<ExecutePlanPayload> {
  await ensureAuth();
  return requestJson<ExecutePlanPayload>('/api/executions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function chatWithCopilotViaServer(payload: {
  planId?: string;
  message: string;
  context: {
    planTitle: string;
    activities: string[];
    teamProfiles?: string;
    strategy?: string;
    weather?: WeatherInfo;
    currentActivities?: Activity[];
  };
  history: CopilotMessage[];
}): Promise<CopilotMessage> {
  const result = await requestJson<CopilotMessage>('/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result;
}

export async function chatInHomeViaServer(payload: {
  message: string;
  city?: string;
  profiles?: any[];
  recentPlans?: any[];
  currentHour?: number;
}): Promise<any> {
  return requestJson<any>('/api/home/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateAlternativesViaServer(payload: {
  currentActivity: Activity;
  reason: string;
}): Promise<Activity[]> {
  const response = await requestJson<{ alternatives: Activity[] }>('/api/alternatives', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.alternatives;
}

export async function getStoryViaServer(planId: string): Promise<
  | (AIStoryContent & {
      template?: string;
      generatedAt?: number;
      updatedAt?: number;
    })
  | null
> {
  try {
    return await requestJson<
      AIStoryContent & {
        template?: string;
        generatedAt?: number;
        updatedAt?: number;
      }
    >(`/api/stories/${encodeURIComponent(planId)}`);
  } catch {
    return null;
  }
}

export async function generateStoryViaServer(payload: {
  planId?: string;
  planTitle: string;
  activities: string[];
  moodText?: string;
  checkInCount: number;
  template?: string;
}): Promise<AIStoryContent> {
  return requestJson<AIStoryContent>('/api/story/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function saveStoryViaServer(
  planId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await requestJson(`/api/stories/${encodeURIComponent(planId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createShareArtifactViaServer(payload: {
  planId?: string;
  plan: Plan;
  profiles?: Array<{ id?: string; name: string }>;
  taskState?: PlannerTaskState | null;
}): Promise<ShareArtifactPayload> {
  return requestJson<ShareArtifactPayload>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getShareArtifactViaServer(shareSlug: string): Promise<{
  plan: Plan;
  profiles: Array<{ id?: string; name: string }>;
  taskState?: PlannerTaskState | null;
}> {
  return requestJson(`/api/shares/${encodeURIComponent(shareSlug)}`);
}

export async function syncProfilesViaServer(profiles: PersonProfile[]): Promise<void> {
  await requestJson('/api/profiles/sync', {
    method: 'POST',
    body: JSON.stringify({ profiles }),
  });
}

export async function syncSessionsViaServer(sessions: ServerTaskSessionSummary[]): Promise<void> {
  await requestJson('/api/sessions/sync', {
    method: 'POST',
    body: JSON.stringify({ sessions }),
  });
}

export async function syncTaskStatesViaServer(taskStates: PlannerTaskState[]): Promise<void> {
  const serialized = JSON.stringify({ taskStates });
  if (serialized.length > 1_000_000) {
    console.warn('[serverApi] taskStates payload too large, skipping sync');
    return;
  }
  await requestJson('/api/task-states/sync', {
    method: 'POST',
    body: serialized,
  });
}

export async function upsertPlanViaServer(payload: {
  plan: Plan;
  sourceQuery?: string;
  sessionId?: string;
}): Promise<Plan> {
  const response = await requestJson<{ plan: Plan }>('/api/plans/upsert', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.plan;
}

export async function processPayment(params: {
  amount: number;
  method: 'meituan' | 'wechat' | 'alipay';
  orderTitle: string;
  planId?: string;
  activityIds?: string[];
  merchantName?: string;
}): Promise<{
  success: boolean;
  transactionId?: string;
  paymentId?: string;
  orderId?: string;
  message: string;
  code?: string;
}> {
  return requestJson('/api/payment/process', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
