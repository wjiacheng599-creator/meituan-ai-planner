import type { Plan } from './ai';
import type { PersonProfile, PlannerTaskState } from '../types';
import type { Post } from '../types';
import type { CopilotMessage } from './ai/types';

const STORAGE_PREFIX = 'meituan_planner_reset_v2';
const RESET_VERSION = '2026-05-19-xiaomei-update';
const RESET_MARKER_KEY = `${STORAGE_PREFIX}_reset_version`;
const MAX_STORIES = 50;
const MAX_CHAT_HISTORY = 50;

const KEYS = {
  PROFILES: `${STORAGE_PREFIX}_profiles`,
  SAVED_PLANS: `${STORAGE_PREFIX}_saved_plans`,
  TASK_STATE: `${STORAGE_PREFIX}_task_state`,
  COLLAB_STATE: `${STORAGE_PREFIX}_collab_state`,
  TASK_SESSIONS: `${STORAGE_PREFIX}_task_sessions`,
  ACTIVE_TASK_SESSION_ID: `${STORAGE_PREFIX}_active_task_session_id`,
  LIKED_POSTS: `${STORAGE_PREFIX}_liked_posts`,
  CHECKIN_RECORDS: `${STORAGE_PREFIX}_checkin_records`,
  STORIES: `${STORAGE_PREFIX}_stories`,
  COMMUNITY_POSTS: `${STORAGE_PREFIX}_community_posts`,
  COPILOT_CHATS: `${STORAGE_PREFIX}_copilot_chats`,
  HOME_CHATS: `${STORAGE_PREFIX}_home_chats`,
} as const;

export function resetAppStorage(): void {
  try {
    const keysToRemove = new Set<string>([RESET_MARKER_KEY, ...Object.values(KEYS)]);

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('meituan_planner')) {
        keysToRemove.add(key);
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch {
    // ignore storage errors
  }
}

function ensureFreshStorage(): void {
  try {
    if (localStorage.getItem(RESET_MARKER_KEY) === RESET_VERSION) return;

    resetAppStorage();

    localStorage.setItem(RESET_MARKER_KEY, RESET_VERSION);
  } catch {
    // ignore storage errors
  }
}

export interface CheckinRecord {
  planId: string;
  activityId: string;
  timestamp: number;
  mood: string;
  moodText: string;
  photoDataUrl?: string;
}

export interface SavedStoryPayload {
  title?: string;
  paragraphs?: string[];
  highlights?: Array<{ icon: string; label: string; value: string }>;
  template?: string;
  generatedAt?: number;
  updatedAt?: number;
}

function load<T>(key: string, fallback: T): T {
  ensureFreshStorage();
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  ensureFreshStorage();
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    syncToZustandPersist(key, value);
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

const ZUSTAND_PERSIST_KEY = 'meituan-planner-storage';

function syncToZustandPersist(key: string, value: unknown): void {
  try {
    const raw = localStorage.getItem(ZUSTAND_PERSIST_KEY);
    const zustandState = raw ? JSON.parse(raw) : {};
    const state = zustandState.state || zustandState;

    if (key === KEYS.PROFILES) state.profiles = value;
    else if (key === KEYS.SAVED_PLANS) state.savedPlans = value;
    else if (key === KEYS.TASK_STATE) state.plannerTaskStates = value;
    else if (key === KEYS.TASK_SESSIONS) state.taskSessions = value;
    else if (key === KEYS.ACTIVE_TASK_SESSION_ID) state.activeTaskSessionId = value;
    else return;

    localStorage.setItem(
      ZUSTAND_PERSIST_KEY,
      JSON.stringify({ state, version: zustandState.version || 0 })
    );
  } catch {
    // ignore sync errors
  }
}

export function loadProfiles(): PersonProfile[] {
  const raw = load<unknown[]>(KEYS.PROFILES, []);
  if (!raw.length) return [];
  return (raw as unknown[]).map((item) => {
    const p = item as Record<string, unknown>;
    let name: string = (p.name as string) || '小明';
    if (name === '小美') {
      name = '小明';
    }
    if ('ageGroup' in p && 'travelPreferences' in p) {
      return { ...(p as unknown as PersonProfile), name };
    }
    return {
      id: (p.id as string) || `p_${Math.random().toString(36).substring(7)}`,
      name,
      relation: (p.relation as string) || '朋友',
      ageGroup: (p.age as string) || '成年人',
      dietaryPreferences: [],
      travelPreferences: typeof p.preference === 'string' ? [p.preference as string] : [],
      budget: '中等',
      mobility: '正常',
      specialNeeds: [],
      favoriteActivities: [],
    } as PersonProfile;
  });
}

export function saveProfiles(profiles: PersonProfile[]): void {
  save(KEYS.PROFILES, profiles);
}

export function loadSavedPlans(): Plan[] {
  return load(KEYS.SAVED_PLANS, []);
}

export function saveSavedPlans(plans: Plan[]): void {
  const serialized = JSON.stringify(plans);
  if (serialized.length > 2_000_000) {
    console.warn('[storage] savedPlans data too large, truncating to latest 20');
    save(KEYS.SAVED_PLANS, plans.slice(-20));
    return;
  }
  save(KEYS.SAVED_PLANS, plans);
}

export function loadPlannerTaskStates(): PlannerTaskState[] {
  return load<PlannerTaskState[]>(KEYS.TASK_STATE, []);
}

export function savePlannerTaskStates(states: PlannerTaskState[]): void {
  const serialized = JSON.stringify(states);
  if (serialized.length > 1_000_000) {
    console.warn('[storage] plannerTaskStates data too large, truncating to latest 50');
    save(KEYS.TASK_STATE, states.slice(-50));
    return;
  }
  save(KEYS.TASK_STATE, states);
}

export interface SavedCollabState {
  selectedProfileIds: string[];
  activeVoterId?: string;
  targetType: string;
  timePref: string;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  tieBreaker: string;
  memberVotes: Record<string, string[]>;
  memberAvoids: Record<string, string[]>;
}

export function loadCollabState(): SavedCollabState | null {
  return load<SavedCollabState | null>(KEYS.COLLAB_STATE, null);
}

export function saveCollabState(state: SavedCollabState): void {
  save(KEYS.COLLAB_STATE, state);
}

export function loadTaskSessions<T>(): T[] {
  return load<T[]>(KEYS.TASK_SESSIONS, []);
}

export function saveTaskSessions<T>(sessions: T[]): void {
  const serialized = JSON.stringify(sessions);
  if (serialized.length > 1_000_000) {
    console.warn('[storage] taskSessions data too large, skipping save');
    return;
  }
  save(KEYS.TASK_SESSIONS, sessions);
}

export function loadActiveTaskSessionId(): string | null {
  return load<string | null>(KEYS.ACTIVE_TASK_SESSION_ID, null);
}

export function saveActiveTaskSessionId(id: string | null): void {
  save(KEYS.ACTIVE_TASK_SESSION_ID, id);
}

export function loadLikedPosts(): number[] {
  return load(KEYS.LIKED_POSTS, []);
}

export function saveLikedPosts(ids: number[]): void {
  save(KEYS.LIKED_POSTS, ids);
}

export function loadCheckinRecords(): CheckinRecord[] {
  return load(KEYS.CHECKIN_RECORDS, []);
}

export function saveCheckinRecords(records: CheckinRecord[]): void {
  save(KEYS.CHECKIN_RECORDS, records);
}

export function loadStory(planId: string): SavedStoryPayload | null {
  const stories = load<Record<string, SavedStoryPayload>>(KEYS.STORIES, {});
  return stories[planId] || null;
}

export function saveStory(planId: string, story: SavedStoryPayload): void {
  const stories = load<Record<string, SavedStoryPayload>>(KEYS.STORIES, {});
  const previous = stories[planId];
  stories[planId] = {
    ...previous,
    ...story,
    generatedAt: previous?.generatedAt || story.generatedAt || Date.now(),
    updatedAt: Date.now(),
  };

  const keys = Object.keys(stories);
  if (keys.length > MAX_STORIES) {
    const sorted = keys
      .map((key) => ({ key, updatedAt: stories[key].updatedAt || 0 }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const evict = sorted.slice(MAX_STORIES);
    evict.forEach((entry) => {
      delete stories[entry.key];
    });
  }

  save(KEYS.STORIES, stories);
}

export function loadAllStories(): Record<string, SavedStoryPayload> {
  return load<Record<string, SavedStoryPayload>>(KEYS.STORIES, {});
}

export function loadCommunityPosts(): Post[] {
  return load<Post[]>(KEYS.COMMUNITY_POSTS, []);
}

export function saveCommunityPosts(posts: Post[]): void {
  save(KEYS.COMMUNITY_POSTS, posts);
}

export interface SavedCopilotChat {
  planId: string;
  messages: CopilotMessage[];
  updatedAt: number;
}

/**
 * 安全地清理消息内容，确保 content 始终是字符串
 */
function sanitizeMessageContent(messages: CopilotMessage[]): CopilotMessage[] {
  return messages.map((msg) => {
    let safeContent: string;

    try {
      if (typeof msg.content === 'string') {
        safeContent = msg.content;
      } else if (typeof msg.content === 'object' && msg.content !== null) {
        const contentObj = msg.content as Record<string, unknown>;
        if (contentObj.title && typeof contentObj.title === 'string') {
          safeContent = contentObj.title;
        } else if (contentObj.message && typeof contentObj.message === 'string') {
          safeContent = contentObj.message;
        } else {
          // 回退到 JSON 字符串，截取前 100 字符
          safeContent = JSON.stringify(contentObj).slice(0, 100);
        }
      } else {
        safeContent = String(msg.content || '收到新消息');
      }
    } catch {
      safeContent = '收到新消息';
    }

    return {
      ...msg,
      content: safeContent,
    };
  });
}

export function loadCopilotChat(planId: string): CopilotMessage[] {
  const chats = load<Record<string, SavedCopilotChat>>(KEYS.COPILOT_CHATS, {});
  const messages = chats[planId]?.messages || [];
  // 清理加载的消息，确保内容安全
  return sanitizeMessageContent(messages);
}

export function saveCopilotChat(planId: string, messages: CopilotMessage[]): void {
  const chats = load<Record<string, SavedCopilotChat>>(KEYS.COPILOT_CHATS, {});

  // 限制历史记录长度
  const trimmedMessages =
    messages.length > MAX_CHAT_HISTORY ? messages.slice(-MAX_CHAT_HISTORY) : messages;

  // 清理要保存的消息，确保内容安全
  const safeMessages = sanitizeMessageContent(trimmedMessages);

  chats[planId] = {
    planId,
    messages: safeMessages,
    updatedAt: Date.now(),
  };

  // 清理旧的聊天记录
  const keys = Object.keys(chats);
  if (keys.length > MAX_STORIES) {
    const sorted = keys
      .map((key) => ({ key, updatedAt: chats[key].updatedAt || 0 }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const evict = sorted.slice(MAX_STORIES);
    evict.forEach((entry) => {
      delete chats[entry.key];
    });
  }

  save(KEYS.COPILOT_CHATS, chats);
}

export interface SavedHomeChat {
  messages: unknown[];
  updatedAt: number;
}

export function loadHomeChats(): unknown[] {
  const homeChats = load<SavedHomeChat>(KEYS.HOME_CHATS, { messages: [], updatedAt: 0 });
  return homeChats.messages || [];
}

export function saveHomeChats(messages: unknown[]): void {
  const trimmedMessages =
    messages.length > MAX_CHAT_HISTORY ? messages.slice(-MAX_CHAT_HISTORY) : messages;

  save(KEYS.HOME_CHATS, {
    messages: trimmedMessages,
    updatedAt: Date.now(),
  });
}
