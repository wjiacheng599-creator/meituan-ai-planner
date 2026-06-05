/**
 * useHomeSession - Home 页会话管理 hook
 *
 * 从 Home.tsx 中提取的会话相关逻辑：
 * - 会话 CRUD（创建/切换/持久化）
 * - 会话水合（从存储恢复）
 * - 重置编辑器状态
 */
import { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type {
  PersonProfile,
  TaskSession,
  VoteOptionId,
  AvoidOptionId,
  TieBreakerId,
} from '../types';
import type { ChatMessage } from '../components/screens/home/SessionList';
import type { Plan } from '../services/ai';

// ── 工具函数 ──

function getLatestPlanFromMessages(messages: ChatMessage[]): Plan | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'plan' && messages[i].plan) return messages[i].plan || null;
  }
  return null;
}

function buildSessionSnapshot(params: {
  session: TaskSession | null;
  messages: ChatMessage[];
  query: string;
  selectedProfileIds: Set<string>;
  timePref: string;
  targetType: string;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  tieBreaker: TieBreakerId;
  memberVotes: Record<string, VoteOptionId[]>;
  memberAvoids: Record<string, AvoidOptionId[]>;
  tempProfiles: PersonProfile[];
}): Partial<TaskSession> | null {
  const {
    session,
    messages,
    query,
    selectedProfileIds,
    timePref,
    targetType,
    collabStrategy,
    tieBreaker,
    memberVotes,
    memberAvoids,
    tempProfiles,
  } = params;
  if (!session) return null;
  const latestPlan = getLatestPlanFromMessages(messages);
  const persistableMessages = messages.filter((m) => m.type !== 'pipeline');
  return {
    messages: persistableMessages,
    queryDraft: query,
    selectedProfileIds: Array.from(selectedProfileIds),
    timePref,
    targetType,
    collabStrategy,
    tieBreaker,
    memberVotes,
    memberAvoids,
    tempProfiles,
    summary:
      messages.length === 0 ? '还没有开始规划' : latestPlan ? latestPlan.summary : '继续当前任务',
    status: latestPlan
      ? 'ready'
      : messages.some((m) => m.type === 'pipeline')
        ? 'planning'
        : 'draft',
    planId: latestPlan?.id,
    planTitle: latestPlan?.title,
    planSummary: latestPlan?.summary,
    durationTags: latestPlan?.durationTags,
    totalPrice: latestPlan?.totalPrice,
    memberCount: selectedProfileIds.size,
    updatedAt: Date.now(),
  };
}

function isSessionPristine(params: {
  session: TaskSession | null;
  messages: ChatMessage[];
  query: string;
  selectedProfileIds: Set<string>;
  tempProfiles: PersonProfile[];
  timePref: string;
  targetType: string;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  tieBreaker: TieBreakerId;
  defaultBaseProfileId: string;
}) {
  const {
    session,
    messages,
    query,
    selectedProfileIds,
    tempProfiles,
    timePref,
    targetType,
    collabStrategy,
    tieBreaker,
    defaultBaseProfileId,
  } = params;
  if (!session) return false;
  const persistableMessages = messages.filter((m) => m.type !== 'pipeline');
  const onlyDefaultProfile =
    selectedProfileIds.size === 1 && selectedProfileIds.has(defaultBaseProfileId);
  return (
    persistableMessages.length === 0 &&
    query.trim().length === 0 &&
    tempProfiles.length === 0 &&
    onlyDefaultProfile &&
    timePref === '上午出发' &&
    targetType === '附近 (3km)' &&
    collabStrategy === 'balanced' &&
    tieBreaker === 'easy_over_dense' &&
    session.status === 'draft' &&
    !session.planId &&
    !session.planTitle &&
    !session.queryDraft
  );
}

// ── Hook ──

interface UseHomeSessionParams {
  taskSessions: TaskSession[];
  activeSessionId: string | null;
  onTaskSessionsChange: React.Dispatch<React.SetStateAction<TaskSession[]>>;
  onActiveSessionChange: React.Dispatch<React.SetStateAction<string | null>>;
  startNewTaskSignal?: number;
  onConsumeStartNewTaskSignal?: () => void;
  defaultBaseProfileId: string;
}

interface UseHomeSessionReturn {
  hydratedSessionId: string | null;
  activeSession: TaskSession | null;
  activeSessionPlan: Plan | null;
  createEmptySession: () => TaskSession;
  startNewTaskSession: () => void;
  persistActiveSession: (patch: Partial<TaskSession>, sessionId?: string | null) => void;
  resetComposerState: (nextSessionId: string | null) => void;
  // 当前会话的编辑器状态（供 reset 和 snapshot 使用）
  getEditorState: () => {
    messages: ChatMessage[];
    query: string;
    selectedProfileIds: Set<string>;
    tempProfiles: PersonProfile[];
    timePref: string;
    targetType: string;
    collabStrategy: 'balanced' | 'care' | 'efficient';
    tieBreaker: TieBreakerId;
    memberVotes: Record<string, VoteOptionId[]>;
    memberAvoids: Record<string, AvoidOptionId[]>;
  };
  setEditorStateRef: React.MutableRefObject<
    | ((
        state: Partial<{
          messages: ChatMessage[];
          query: string;
          selectedProfileIds: Set<string>;
          tempProfiles: PersonProfile[];
          timePref: string;
          targetType: string;
          collabStrategy: 'balanced' | 'care' | 'efficient';
          tieBreaker: TieBreakerId;
          memberVotes: Record<string, VoteOptionId[]>;
          memberAvoids: Record<string, AvoidOptionId[]>;
        }>
      ) => void)
    | null
  >;
}

export function useHomeSession(params: UseHomeSessionParams): UseHomeSessionReturn {
  const {
    taskSessions,
    activeSessionId,
    onTaskSessionsChange,
    onActiveSessionChange,
    startNewTaskSignal,
    onConsumeStartNewTaskSignal,
    defaultBaseProfileId,
  } = params;

  const [hydratedSessionId, setHydratedSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const safeTaskSessions = useMemo(
    () => (Array.isArray(taskSessions) ? taskSessions : []),
    [taskSessions]
  );
  const activeSession = useMemo(
    () => safeTaskSessions.find((s) => s.id === activeSessionId) || null,
    [safeTaskSessions, activeSessionId]
  );
  const activeSessionPlan = useMemo(
    () =>
      activeSession
        ? getLatestPlanFromMessages((activeSession.messages || []) as ChatMessage[])
        : null,
    [activeSession]
  );

  // 编辑器状态引用（由外部组件设置）
  const editorStateRef = useRef<{
    messages: ChatMessage[];
    query: string;
    selectedProfileIds: Set<string>;
    tempProfiles: PersonProfile[];
    timePref: string;
    targetType: string;
    collabStrategy: 'balanced' | 'care' | 'efficient';
    tieBreaker: TieBreakerId;
    memberVotes: Record<string, VoteOptionId[]>;
    memberAvoids: Record<string, AvoidOptionId[]>;
  } | null>(null);

  const setEditorStateRef = useRef<
    ((state: Partial<typeof editorStateRef.current>) => void) | null
  >(null);

  const getEditorState = useCallback(() => {
    return (
      editorStateRef.current || {
        messages: [],
        query: '',
        selectedProfileIds: new Set([defaultBaseProfileId]),
        tempProfiles: [],
        timePref: '上午出发',
        targetType: '附近 (3km)',
        collabStrategy: 'balanced' as const,
        tieBreaker: 'easy_over_dense' as const,
        memberVotes: {},
        memberAvoids: {},
      }
    );
  }, [defaultBaseProfileId]);

  const createEmptySession = useCallback(
    (): TaskSession => ({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '新任务',
      summary: '还没有开始规划',
      queryDraft: '',
      updatedAt: Date.now(),
      status: 'draft',
      selectedProfileIds: [defaultBaseProfileId],
      timePref: '上午出发',
      targetType: '附近 (3km)',
      collabStrategy: 'balanced',
      tieBreaker: 'easy_over_dense',
      memberVotes: {},
      memberAvoids: {},
      tempProfiles: [],
      messages: [],
    }),
    [defaultBaseProfileId]
  );

  const resetComposerState = useCallback(
    (nextSessionId: string | null) => {
      setHydratedSessionId(nextSessionId);
      // 通知外部重置编辑器状态
      if (setEditorStateRef.current) {
        setEditorStateRef.current({
          messages: [],
          query: '',
          selectedProfileIds: new Set([defaultBaseProfileId]),
          tempProfiles: [],
          timePref: '上午出发',
          targetType: '附近 (3km)',
          collabStrategy: 'balanced',
          tieBreaker: 'easy_over_dense',
          memberVotes: {},
          memberAvoids: {},
        });
      }
    },
    [defaultBaseProfileId]
  );

  const persistActiveSession = useCallback(
    (patch: Partial<TaskSession>, sessionId?: string | null) => {
      const currentSessionId = sessionId || activeSessionIdRef.current;
      if (!currentSessionId) return;
      onTaskSessionsChange((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.map((s) =>
          s.id === currentSessionId ? { ...s, ...patch, updatedAt: Date.now() } : s
        );
      });
    },
    [onTaskSessionsChange]
  );

  const startNewTaskSession = useCallback(() => {
    const currentSession =
      safeTaskSessions.find((s) => s.id === activeSessionIdRef.current) || null;
    const editorState = editorStateRef.current;

    const snapshot = editorState
      ? buildSessionSnapshot({
          session: currentSession,
          messages: editorState.messages,
          query: editorState.query,
          selectedProfileIds: editorState.selectedProfileIds,
          timePref: editorState.timePref,
          targetType: editorState.targetType,
          collabStrategy: editorState.collabStrategy,
          tieBreaker: editorState.tieBreaker,
          memberVotes: editorState.memberVotes,
          memberAvoids: editorState.memberAvoids,
          tempProfiles: editorState.tempProfiles,
        })
      : null;
    const next = createEmptySession();
    onTaskSessionsChange((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const base =
        snapshot && currentSession
          ? safePrev.map((s) => (s.id === currentSession.id ? { ...s, ...snapshot } : s))
          : safePrev;
      return [next, ...base];
    });
    activeSessionIdRef.current = next.id;
    onActiveSessionChange(next.id);
    resetComposerState(next.id);
  }, [
    taskSessions,
    getEditorState,
    defaultBaseProfileId,
    createEmptySession,
    onTaskSessionsChange,
    onActiveSessionChange,
    resetComposerState,
  ]);

  const startNewTaskSessionRef = useRef(startNewTaskSession);
  startNewTaskSessionRef.current = startNewTaskSession;

  useLayoutEffect(() => {
    if (!startNewTaskSignal) return;
    startNewTaskSessionRef.current();
    onConsumeStartNewTaskSignal?.();
  }, [startNewTaskSignal, onConsumeStartNewTaskSignal]);

  return {
    hydratedSessionId,
    activeSession,
    activeSessionPlan,
    createEmptySession,
    startNewTaskSession,
    persistActiveSession,
    resetComposerState,
    getEditorState,
    setEditorStateRef,
  };
}
