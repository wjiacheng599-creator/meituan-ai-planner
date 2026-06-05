import {
  ArrowRight,
  Mic,
  SlidersHorizontal,
  MapPin,
  Clock,
  Users,
  ArrowUp,
  Sparkles,
  User,
  X,
  Heart,
  Coffee,
  Baby,
  Footprints,
  Star as StarIcon,
  ClipboardPaste,
  Compass,
  FileText,
  Camera,
  ImagePlus,
  Loader2,
  Plus,
} from 'lucide-react';
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PersonProfile,
  PlannerTaskState,
  type TaskSession,
  type VoteOptionId,
  type AvoidOptionId,
  type TieBreakerId,
  isTieBreakerId,
} from '../../types';
import type { Plan, Activity } from '../../services/ai';
import type {
  WeatherCardData,
  RestaurantCardData,
  DeliveryCardData,
  TicketCardData,
  CouponCardData,
} from '../cards/ServiceCards';
import InviteErrorBanner from './home/InviteErrorBanner';
import HeroSection from './home/HeroSection';
import QuickActions from './home/QuickActions';
import SessionList from './home/SessionList';
import { useHomeChat, type CollabSummary } from '../../hooks/useHomeChat';
import { useHomeCollab, voteOptions, avoidOptions } from '../../hooks/useHomeCollab';
import { useHomeSession } from '../../hooks/useHomeSession';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { useImageRecognition } from '../../hooks/useImageRecognition';
import { useBehaviorTracking } from '../../hooks/useBehaviorTracking';
import { getAvatarPath } from '../../utils/avatarUtils';
import type { ChatMessage } from './home/SessionList';

import { useAppStateContext } from '../../contexts/AppStateContext';
import { useAppStore } from '../../store/appStore';

// ── HomeProps ──

interface HomeProps {
  profiles: PersonProfile[];
  onUpdateProfiles: (profiles: PersonProfile[]) => void;
  onOpenExplore: () => void;
  onOpenProfile: () => void;
  startNewTaskSignal?: number;
  onConsumeStartNewTaskSignal?: () => void;
  taskSessions: TaskSession[];
  activeSessionId: string | null;
  onTaskSessionsChange: React.Dispatch<React.SetStateAction<TaskSession[]>>;
  onActiveSessionChange: React.Dispatch<React.SetStateAction<string | null>>;
  onViewActivity: (act: Activity) => void;
  onViewRestaurant?: (item: RestaurantCardData) => void;
  onOpenRestaurantFinder?: (items: RestaurantCardData[], keyword: string) => void;
  onViewDeliveryItem?: (item: DeliveryCardData) => void;
  onViewTicketItem?: (item: TicketCardData) => void;
  onOpenServiceFinder?: (
    mode: 'delivery' | 'ticket' | 'coupon',
    items: DeliveryCardData[] | TicketCardData[] | CouponCardData[],
    keyword: string
  ) => void;
  onOpenTaxiFinder?: (data: import('../cards/TaxiCard').TaxiCardData) => void;
  onViewItinerary: (plan: Plan) => void;
  onChecklist: (plan: Plan) => void;
  onSavePlan: (plan: Plan) => void;
  onUpdatePlan: (plan: Plan | null) => void;
  savedPlans?: Plan[];
  plannerTaskStates?: PlannerTaskState[];
}

// ── Invite decoding (stays here for invite import) ──

interface InviteProfileSnapshot {
  inviteId: string;
  name: string;
  relation: string;
  ageGroup: string;
  dietaryPreferences: string[];
  travelPreferences: string[];
  avoidPreferences?: string[];
  budget?: string;
  mobility?: string;
  specialNeeds?: string[];
  favoriteActivities?: string[];
}

interface CollabInvitePayload {
  version: 'v1';
  inviter: string;
  createdAt: number;
  sessionTitle: string;
  query: string;
  timePref: string;
  targetType: string;
  collabStrategy: 'balanced' | 'care' | 'efficient';
  tieBreaker: TieBreakerId;
  profiles: InviteProfileSnapshot[];
  selectedProfileInviteIds: string[];
  memberVotes: Record<string, VoteOptionId[]>;
  memberAvoids: Record<string, AvoidOptionId[]>;
}

function decodeInvitePayload(raw: string): CollabInvitePayload | null {
  try {
    const normalized = raw
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(raw.length / 4) * 4, '=');
    const json = decodeURIComponent(atob(normalized));
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') return null;
    if ((parsed as Record<string, unknown>).version !== 'v1') return null;
    if (!validateCollabInvitePayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const VALID_COLLAB_STRATEGIES = new Set<string>(['balanced', 'care', 'efficient']);
const ALLOWED_TOP_KEYS = new Set<string>([
  'version',
  'inviter',
  'createdAt',
  'sessionTitle',
  'query',
  'timePref',
  'targetType',
  'collabStrategy',
  'tieBreaker',
  'profiles',
  'selectedProfileInviteIds',
  'memberVotes',
  'memberAvoids',
]);
const PROFILE_REQUIRED_STRINGS = ['inviteId', 'name', 'relation', 'ageGroup'];
const PROFILE_REQUIRED_ARRAYS = ['dietaryPreferences', 'travelPreferences'];
const PROFILE_OPTIONAL_STRINGS = ['budget', 'mobility'];
const PROFILE_OPTIONAL_ARRAYS = ['avoidPreferences', 'specialNeeds', 'favoriteActivities'];

function validateCollabInvitePayload(data: unknown): data is CollabInvitePayload {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (Object.keys(obj).find((k) => !ALLOWED_TOP_KEYS.has(k))) return false;
  if (typeof obj.inviter !== 'string' || !obj.inviter.trim()) return false;
  if (typeof obj.sessionTitle !== 'string') return false;
  if (typeof obj.createdAt !== 'number' || obj.createdAt <= 0) return false;
  if (typeof obj.query !== 'string') return false;
  if (typeof obj.timePref !== 'string') return false;
  if (typeof obj.targetType !== 'string') return false;
  if (typeof obj.collabStrategy !== 'string' || !VALID_COLLAB_STRATEGIES.has(obj.collabStrategy))
    return false;
  if (typeof obj.tieBreaker !== 'string' || !isTieBreakerId(obj.tieBreaker)) return false;
  if (!Array.isArray(obj.profiles)) return false;
  for (let i = 0; i < obj.profiles.length; i++) {
    const p = obj.profiles[i] as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') return false;
    for (const key of PROFILE_REQUIRED_STRINGS) {
      if (typeof p[key] !== 'string' || !(p[key] as string).trim()) return false;
    }
    for (const key of PROFILE_REQUIRED_ARRAYS) {
      if (!Array.isArray(p[key])) return false;
    }
    for (const key of PROFILE_OPTIONAL_STRINGS) {
      if (p[key] !== undefined && typeof p[key] !== 'string') return false;
    }
    for (const key of PROFILE_OPTIONAL_ARRAYS) {
      if (p[key] !== undefined && !Array.isArray(p[key])) return false;
    }
  }
  if (!Array.isArray(obj.selectedProfileInviteIds)) return false;
  return true;
}

function getProfileSignature(profile: Pick<PersonProfile, 'name' | 'relation' | 'ageGroup'>) {
  return `${profile.name.trim().toLowerCase()}__${profile.relation}__${profile.ageGroup}`;
}

function getDisplaySessionMessages(session: TaskSession, savedPlans: Plan[]): ChatMessage[] {
  const persistedMessages = (session.messages || []) as ChatMessage[];
  if (persistedMessages.length > 0) return persistedMessages;

  const messages: ChatMessage[] = [];
  if (session.queryDraft?.trim()) {
    messages.push({
      id: `${session.id}_restored_user`,
      type: 'user',
      content: session.queryDraft,
    });
  }

  const plan = session.planId ? savedPlans.find((item) => item.id === session.planId) : null;
  if (plan) {
    messages.push({
      id: `${session.id}_restored_plan`,
      type: 'plan',
      plan,
      content: plan.summary,
    });
  }

  return messages;
}

// ── Component ──

export default memo(function Home({
  profiles,
  onUpdateProfiles,
  onOpenExplore,
  onOpenProfile,
  startNewTaskSignal = 0,
  onConsumeStartNewTaskSignal,
  taskSessions,
  activeSessionId,
  onTaskSessionsChange,
  onActiveSessionChange,
  onViewActivity,
  onViewRestaurant,
  onOpenRestaurantFinder,
  onViewDeliveryItem,
  onViewTicketItem,
  onOpenServiceFinder,
  onOpenTaxiFinder,
  onViewItinerary,
  onChecklist,
  onSavePlan,
  onUpdatePlan,
  savedPlans = [],
  plannerTaskStates = [],
}: HomeProps) {
  const mainUser = profiles[0];
  const defaultBaseProfileId = useMemo(
    () => mainUser?.id || profiles[0]?.id || 'p1',
    [mainUser, profiles]
  );

  // ── Greeting (UI-only, stays here) ──
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return '凌晨好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }, []);

  // ── Local UI state ──
  const [isPlanMode, setIsPlanMode] = useState(false);
  const importedInviteRef = useRef<string | null>(null);

  // ── Waveform randoms (UI-only) ──
  const waveformRandomsRef = useRef<{ heights: number[]; durations: number[] } | null>(null);
  if (!waveformRandomsRef.current) {
    waveformRandomsRef.current = {
      heights: Array.from({ length: 6 }, () => 12 + Math.random() * 20),
      durations: Array.from({ length: 6 }, () => 0.5 + Math.random() * 0.5),
    };
  }

  // ── Collab data ref（解决 hook 顺序问题）──
  const collabDataRef = useRef<{
    selectedProfiles: PersonProfile[];
    combinedProfiles: PersonProfile[];
    collabSummary: CollabSummary;
    collabStrategy: 'balanced' | 'care' | 'efficient';
    timePref: string;
    targetType: string;
    selectedProfileIds: Set<string>;
  }>({
    selectedProfiles: [],
    combinedProfiles: [],
    collabSummary: {
      consensus: [],
      conflicts: [],
      memberSummaries: [],
      strategyLabel: '民主共识',
      analysisText: '',
      topAvoids: [],
      tieBreakerLabel: '轻松优先',
    },
    collabStrategy: 'balanced',
    timePref: '上午出发',
    targetType: '附近 (3km)',
    selectedProfileIds: new Set<string>(),
  });

  // ── Hook 1: Session management ──
  const session = useHomeSession({
    taskSessions,
    activeSessionId,
    onTaskSessionsChange,
    onActiveSessionChange,
    startNewTaskSignal,
    onConsumeStartNewTaskSignal,
    defaultBaseProfileId,
  });
  const {
    hydratedSessionId,
    activeSession,
    activeSessionPlan,
    createEmptySession,
    startNewTaskSession,
    persistActiveSession,
    resetComposerState,
    setEditorStateRef,
  } = session;

  // ── Voice Recognition (Web Speech API)
  const voice = useVoiceRecognition();
  const vision = useImageRecognition();
  const behavior = useBehaviorTracking();

  const recentCardKeys = useAppStore((s) => s.recentCardKeys);
  const addRecentCardKeys = useAppStore((s) => s.addRecentCardKeys);

  // ── Hook 2: Chat (needs session outputs, provides query for collab) ──
  const chat = useHomeChat({
    profiles,
    savedPlans,
    plannerTaskStates,
    taskSessions,
    activeSessionId,
    combinedProfiles: [],
    selectedProfiles: [],
    selectedProfileIds: new Set([defaultBaseProfileId]),
    collabSummary: {
      consensus: [],
      conflicts: [],
      memberSummaries: [],
      strategyLabel: '民主共识',
      analysisText: '',
      topAvoids: [],
      tieBreakerLabel: '轻松优先',
    },
    isPlanMode,
    setIsPlanMode,
    collabStrategy: 'balanced',
    timePref: '上午出发',
    targetType: '附近 (3km)',
    onSavePlan,
    persistActiveSession,
    activeSessionPlan,
    collabDataRef,
    initialMessages: activeSession ? getDisplaySessionMessages(activeSession, savedPlans) : [],
    initialQuery: activeSession?.queryDraft || '',
    recentCardKeys,
    addRecentCardKeys,
  });
  const {
    messages,
    setMessages,
    query,
    setQuery,
    isRecording,
    setIsRecording,
    planningInProgressRef,
    appendMessages,
    handleUpdateWeatherMessage,
    handleStartPlan: chatHandleStartPlan,
    handleGuideImport,
    showImportGuide,
    setShowImportGuide,
    showAttachMenu,
    setShowAttachMenu,
    guideText,
    setGuideText,
    suggestionCards,
    scrollRef,
  } = chat;

  // ── Hook 3: Collaboration (needs query from chat) ──
  const collab = useHomeCollab({
    profiles,
    defaultBaseProfileId,
    activeSession,
    mainUser,
    query,
  });
  const {
    isCollabOpen,
    setIsCollabOpen,
    selectedProfileIds,
    setSelectedProfileIds,
    activeVoterId,
    setActiveVoterId,
    targetType,
    setTargetType,
    timePref,
    setTimePref,
    collabStrategy,
    setCollabStrategy,
    memberVotes,
    setMemberVotes,
    memberAvoids,
    setMemberAvoids,
    tieBreaker,
    setTieBreaker,
    sessionTempProfiles,
    setSessionTempProfiles,
    showAddMember,
    setShowAddMember,
    inviteError,
    setInviteError,
    inviteFeedback,
    newMemberName,
    setNewMemberName,
    newMemberRelation,
    setNewMemberRelation,
    newMemberAge,
    setNewMemberAge,
    combinedProfiles,
    selectedProfiles,
    collabSummary,
    toggleProfileSelect,
    toggleMemberVote,
    toggleMemberAvoid,
    handleInviteMoreFriends,
    handleAddTempMember,
    conflictChoiceCard,
  } = collab;

  // Voice: cleanup on unmount / session switch
  useEffect(() => {
    return () => {
      voice.cancelListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步 collab 数据到 ref（让 chat hook 能获取最新数据）
  useLayoutEffect(() => {
    collabDataRef.current = {
      selectedProfiles,
      combinedProfiles,
      collabSummary,
      collabStrategy,
      timePref,
      targetType,
      selectedProfileIds,
    };
  }, [
    selectedProfiles,
    combinedProfiles,
    collabSummary,
    collabStrategy,
    timePref,
    targetType,
    selectedProfileIds,
  ]);

  // 当临时成员添加时，同时保存到出行档案
  useEffect(() => {
    if (sessionTempProfiles.length > 0) {
      const newProfiles = sessionTempProfiles.filter(
        (temp) => !profiles.some((p) => p.id === temp.id)
      );
      if (newProfiles.length > 0) {
        onUpdateProfiles([...profiles, ...newProfiles]);
      }
    }
  }, [sessionTempProfiles, profiles, onUpdateProfiles]);

  // ── Wrapper: conflict card check ──
  const handleStartPlan = useCallback(
    async (text?: string, forcePlan?: boolean) => {
      if (conflictChoiceCard) return;

      // Track search behavior
      const searchText = text || query;
      if (searchText?.trim()) {
        behavior.trackSearch(searchText.trim());
      }

      // 如果有图片，先识别再发送
      if (vision.imagePreview && !text) {
        const result = await vision.recognizeImage();
        if (result) {
          const enrichedText = vision.buildMessageWithVision(query || '帮我规划行程');
          vision.removeImage();
          chatHandleStartPlan(enrichedText, forcePlan);
          return;
        }
      }

      chatHandleStartPlan(text, forcePlan);
    },
    [conflictChoiceCard, chatHandleStartPlan, vision, query, behavior]
  );

  // ── setEditorStateRef sync: let session hook reset editor state ──
  useEffect(() => {
    setEditorStateRef.current = (state) => {
      if (state.messages !== undefined) setMessages(state.messages as ChatMessage[]);
      if (state.query !== undefined) setQuery(state.query);
      if (state.selectedProfileIds !== undefined)
        setSelectedProfileIds(
          state.selectedProfileIds instanceof Set
            ? state.selectedProfileIds
            : new Set(Array.isArray(state.selectedProfileIds) ? state.selectedProfileIds : [])
        );
      if (state.tempProfiles !== undefined) setSessionTempProfiles(state.tempProfiles);
      if (state.timePref !== undefined) setTimePref(state.timePref);
      if (state.targetType !== undefined) setTargetType(state.targetType);
      if (state.collabStrategy !== undefined) setCollabStrategy(state.collabStrategy);
      if (state.tieBreaker !== undefined) setTieBreaker(state.tieBreaker);
      if (state.memberVotes !== undefined) setMemberVotes(state.memberVotes);
      if (state.memberAvoids !== undefined) setMemberAvoids(state.memberAvoids);
      setIsPlanMode(false);
      setIsCollabOpen(false);
      setShowImportGuide(false);
      setShowAddMember(false);
      setIsRecording(false);
      voice.cancelListening();
    };
    return () => {
      setEditorStateRef.current = null;
    };
  }, [
    setEditorStateRef,
    setMessages,
    setQuery,
    setSelectedProfileIds,
    setSessionTempProfiles,
    setTimePref,
    setTargetType,
    setCollabStrategy,
    setTieBreaker,
    setMemberVotes,
    setMemberAvoids,
    setIsCollabOpen,
    setShowImportGuide,
    setShowAddMember,
    setIsRecording,
  ]);

  const handleUpdateTaxiMessage = useCallback(
    (msgId: string, data: import('../cards/TaxiCard').TaxiCardData, status?: 'idle' | 'booked') => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          return { ...m, taxiData: data, ...(status ? { taxiBookingStatus: status } : {}) };
        })
      );
    },
    [setMessages]
  );

  const appCtx = useAppStateContext();

  // ── Sync session messages when active session changes ──
  const prevSessionIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const sessionId = activeSession?.id;
    const prevId = prevSessionIdRef.current;
    prevSessionIdRef.current = sessionId;

    if (!activeSession) return;
    // 首次挂载（prevId === undefined）或 session 切换时都同步消息
    if (prevId === undefined || prevId === sessionId) {
      // 首次挂载：始终加载 session 消息
      if (prevId === undefined) {
        const sessionMessages = getDisplaySessionMessages(activeSession, savedPlans);
        setMessages(sessionMessages as ChatMessage[]);
        setQuery(activeSession.queryDraft || '');
      }
      // 同一个 session：不重复设置（避免覆盖运行中的消息）
      return;
    }

    // session 切换：加载新 session 的消息
    const sessionMessages = getDisplaySessionMessages(activeSession, savedPlans);
    if (sessionMessages.length > 0) {
      const pending = appCtx.consumeTaxiBookingResult();
      if (pending) {
        setMessages(
          sessionMessages.map((m: ChatMessage) => {
            if (m.type === 'taxi') {
              return { ...m, taxiData: pending.data, taxiBookingStatus: 'booked' } as ChatMessage;
            }
            return m;
          }) as ChatMessage[]
        );
      } else {
        setMessages(sessionMessages as ChatMessage[]);
      }
    } else {
      setMessages([]);
    }

    setQuery(activeSession.queryDraft || '');

    // Sync collab state from session
    if (activeSession.selectedProfileIds?.length) {
      setSelectedProfileIds(new Set(activeSession.selectedProfileIds));
    }
    if (activeSession.timePref) setTimePref(activeSession.timePref);
    if (activeSession.targetType) setTargetType(activeSession.targetType);
    if (activeSession.collabStrategy) setCollabStrategy(activeSession.collabStrategy);
    if (activeSession.tieBreaker) setTieBreaker(activeSession.tieBreaker);
    if (activeSession.memberVotes) setMemberVotes(activeSession.memberVotes);
    if (activeSession.memberAvoids) setMemberAvoids(activeSession.memberAvoids);

    // Sync plan state with session
    const planId = activeSession.planId;
    if (planId) {
      const safePlans = Array.isArray(savedPlans) ? savedPlans : [];
      const foundPlan = safePlans.find((p) => p.id === planId);
      onUpdatePlan(foundPlan || null);
    } else {
      onUpdatePlan(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id]);

  // ── Auto-scroll on new messages ──
  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, scrollRef]);

  // ── Session 自动激活 & 消息恢复 ──
  useEffect(() => {
    const activeSessionExists = taskSessions.some((session) => session.id === activeSessionId);

    // 如果没有活跃 session 或持久化 ID 已失效，自动激活最近的 session
    if ((!activeSessionId || !activeSessionExists) && taskSessions.length > 0) {
      const sortedSessions = [...taskSessions].sort((a, b) => b.updatedAt - a.updatedAt);
      onActiveSessionChange(sortedSessions[0].id);
    }

    // 如果没有 sessions，创建一个新的
    if (!activeSessionId && taskSessions.length === 0) {
      const newSession = createEmptySession();
      onTaskSessionsChange([newSession]);
      onActiveSessionChange(newSession.id);
    }
  }, [
    activeSessionId,
    taskSessions,
    createEmptySession,
    onTaskSessionsChange,
    onActiveSessionChange,
  ]);

  // ── Invite import ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const inviteToken = url.searchParams.get('invite');
    if (!inviteToken || importedInviteRef.current === inviteToken) return;

    const payload = decodeInvitePayload(inviteToken);
    if (!payload) {
      setInviteError('邀请链接无效或已损坏，无法加入共创任务');
      return;
    }
    setInviteError(null);
    importedInviteRef.current = inviteToken;

    const profileIdMap = new Map<string, string>();
    const importedTempProfiles: PersonProfile[] = [];

    payload.profiles.forEach((profile, index) => {
      const signature = getProfileSignature(profile);
      const existing = profiles.find((item) => getProfileSignature(item) === signature);
      if (existing) {
        profileIdMap.set(profile.inviteId, existing.id);
        return;
      }
      const importedProfile: PersonProfile = {
        id: `p_invite_${Date.now()}_${index}`,
        name: profile.name,
        relation: profile.relation,
        ageGroup: profile.ageGroup,
        dietaryPreferences: profile.dietaryPreferences || [],
        travelPreferences: profile.travelPreferences || [],
        avoidPreferences: profile.avoidPreferences || [],
        budget: profile.budget || '中等',
        mobility: profile.mobility || '正常',
        specialNeeds: profile.specialNeeds || [],
        favoriteActivities: profile.favoriteActivities || [],
      };
      importedTempProfiles.push(importedProfile);
      profileIdMap.set(profile.inviteId, importedProfile.id);
    });

    const mappedSelectedIds = payload.selectedProfileInviteIds
      .map((id) => profileIdMap.get(id))
      .filter((id): id is string => Boolean(id));

    const nextVotes: Record<string, VoteOptionId[]> = {};
    Object.entries(payload.memberVotes || {}).forEach(([inviteId, v]) => {
      const mapped = profileIdMap.get(inviteId);
      if (mapped) nextVotes[mapped] = v;
    });
    const nextAvoids: Record<string, AvoidOptionId[]> = {};
    Object.entries(payload.memberAvoids || {}).forEach(([inviteId, a]) => {
      const mapped = profileIdMap.get(inviteId);
      if (mapped) nextAvoids[mapped] = a;
    });

    const nextSession = createEmptySession();
    nextSession.title = payload.sessionTitle || `${payload.inviter}的共创邀请`;
    nextSession.summary = `${payload.inviter}邀请你一起完善这次行程`;
    nextSession.queryDraft = payload.query || '';
    nextSession.selectedProfileIds =
      mappedSelectedIds.length > 0 ? mappedSelectedIds : [defaultBaseProfileId];
    nextSession.timePref = payload.timePref || '上午出发';
    nextSession.targetType = payload.targetType || '附近 (3km)';
    nextSession.collabStrategy = payload.collabStrategy || 'balanced';
    nextSession.tieBreaker = payload.tieBreaker || 'easy_over_dense';
    nextSession.memberVotes = nextVotes;
    nextSession.memberAvoids = nextAvoids;
    nextSession.tempProfiles = importedTempProfiles;
    nextSession.messages = [
      {
        id: `invite_${Date.now()}`,
        type: 'assistant',
        content: `已加入 ${payload.inviter} 发起的共创任务，成员和偏好已同步。`,
      },
    ];

    onTaskSessionsChange((prev) => [nextSession, ...prev]);
    onActiveSessionChange(nextSession.id);
    setMessages(nextSession.messages as ChatMessage[]);
    setQuery(nextSession.queryDraft);
    setSelectedProfileIds(new Set(nextSession.selectedProfileIds));
    setActiveVoterId(nextSession.selectedProfileIds[0] || 'p1');
    setTimePref(payload.timePref || '上午出发');
    setTargetType(payload.targetType || '附近 (3km)');
    setCollabStrategy(payload.collabStrategy || 'balanced');
    setTieBreaker(payload.tieBreaker || 'easy_over_dense');
    setMemberVotes((prev) => ({ ...prev, ...nextVotes }));
    setMemberAvoids((prev) => ({ ...prev, ...nextAvoids }));
    setSessionTempProfiles(importedTempProfiles);
    setIsPlanMode(true);
    setIsCollabOpen(true);

    url.searchParams.delete('invite');
    const nextSearch = url.searchParams.toString();
    window.history.replaceState({}, '', `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, defaultBaseProfileId]);

  // ── Suggestion card icon map (UI-only) ──
  const suggestionIconMap: Record<string, React.ReactNode> = {
    family: <Baby className="w-6 h-6" />,
    elder: <MapPin className="w-6 h-6" />,
    couple: <Heart className="w-6 h-6" />,
    group: <Users className="w-6 h-6" />,
    photo: <Sparkles className="w-6 h-6" />,
    walk: <Footprints className="w-6 h-6" />,
    coffee: <Coffee className="w-6 h-6" />,
    evening: <Clock className="w-6 h-6" />,
    afternoon: <Clock className="w-6 h-6" />,
    morning: <Clock className="w-6 h-6" />,
    night: <Clock className="w-6 h-6" />,
    weekend: <Sparkles className="w-6 h-6" />,
    indoor: <MapPin className="w-6 h-6" />,
    warm: <Heart className="w-6 h-6" />,
    cool: <Sparkles className="w-6 h-6" />,
    foodie: <Coffee className="w-6 h-6" />,
    explore: <MapPin className="w-6 h-6" />,
    budget: <StarIcon className="w-6 h-6" />,
    premium: <Sparkles className="w-6 h-6" />,
    artsy: <Sparkles className="w-6 h-6" />,
    'fresh-restart': <FileText className="w-6 h-6" />,
    remix: <ArrowRight className="w-6 h-6" />,
    'repeat-style': <StarIcon className="w-6 h-6" />,
    eat: <Coffee className="w-6 h-6" />,
    nearby: <MapPin className="w-6 h-6" />,
    fresh: <Sparkles className="w-6 h-6" />,
  };

  const cardsWithIcons = useMemo(
    () =>
      suggestionCards.map((card, i) => ({
        ...card,
        icon: suggestionIconMap[card.topicKey] || <Sparkles className="w-6 h-6" />,
      })),
    [suggestionCards]
  );

  return (
    <div className="flex w-full h-full flex-col bg-transparent relative overflow-hidden">
      <InviteErrorBanner error={inviteError} onDismiss={() => setInviteError(null)} />

      {/* Atmospheric Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[60%] rounded-full bg-[rgba(255,207,226,0.34)] blur-3xl pointer-events-none mix-blend-multiply"></div>
      <div className="absolute top-[30%] right-[-20%] h-[60%] w-[70%] rounded-full bg-[rgba(231,237,247,0.64)] blur-3xl pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-10%] left-[10%] h-[50%] w-[60%] rounded-full bg-[rgba(255,241,225,0.34)] blur-3xl pointer-events-none mix-blend-multiply"></div>

      <div className="flex-1 overflow-hidden w-full flex flex-col z-10 relative">
        {/* Header */}
        <div className="relative z-30 shrink-0 pt-12 pb-5 px-5 bg-gradient-to-b from-[#fbfcff] from-70% via-[#fbfcff]/96 to-transparent backdrop-blur-[10px]">
          <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center">
            <div className="flex justify-start">
              <button
                onClick={onOpenProfile}
                className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all"
                aria-label="个人中心"
              >
                <User className="w-5 h-5 text-gray-800" strokeWidth={2.5} />
              </button>
            </div>

            {/* Multiplayer Collaboration */}
            <div className="flex justify-center px-3">
              <div className="relative flex justify-center">
                <div
                  onClick={() => setIsCollabOpen(!isCollabOpen)}
                  className="w-[164px] max-w-full rounded-full border border-[var(--app-border)] bg-[rgba(255,255,255,0.985)] px-3 py-1.5 flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_24px_rgba(20,24,33,0.06)] backdrop-blur-xl active:scale-95 transition-transform"
                >
                  <div className="flex -space-x-2 shrink-0">
                    {combinedProfiles.slice(0, 3).map((p, idx) => (
                      <div
                        key={p.id}
                        className="w-6 h-6 rounded-full bg-white border-2 border-white overflow-hidden"
                      >
                        <img
                          src={getAvatarPath(p)}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="min-w-0 truncate pr-1 text-[13px] font-semibold tracking-tight text-[var(--app-ink)]">
                    {selectedProfiles.length}人共创
                  </span>
                  <div className="mr-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--mint-ink)] animate-pulse shadow-[0_0_8px_rgba(42,162,122,0.35)]"></div>
                </div>
                <AnimatePresence>
                  {isCollabOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="absolute top-12 left-1/2 z-50 w-[260px] max-w-[calc(100vw-40px)] -translate-x-1/2 overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.76)] bg-[rgba(255,255,255,0.985)] shadow-[0_18px_48px_rgba(20,24,33,0.12)] backdrop-blur-2xl"
                    >
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-bold text-[var(--app-ink)]">
                            协作成员
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCollabOpen(false);
                            }}
                            className="app-chip-soft flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                            aria-label="关闭协作面板"
                          >
                            <X className="w-3.5 h-3.5 text-[var(--app-text)]" />
                          </button>
                        </div>
                        <div className="space-y-2.5">
                          {combinedProfiles.map((p, i) => (
                            <div
                              key={p.id}
                              className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/70"
                            >
                              <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-[linear-gradient(135deg,var(--sky-soft)_0%,var(--rose-soft)_100%)] overflow-hidden border-2 border-white shadow-sm">
                                  <img
                                    src={getAvatarPath(p)}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div
                                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${i === 0 ? 'bg-[var(--mint-ink)]' : 'bg-gray-300'}`}
                                ></div>
                              </div>
                              <div className="flex-1">
                                <div className="text-[13px] font-bold text-[var(--app-ink)]">
                                  {p.name}
                                </div>
                                <div className="text-[11px] font-medium text-[var(--app-text-soft)]">
                                  {p.relation} · {p.ageGroup}
                                </div>
                                {(memberVotes[p.id] || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {(memberVotes[p.id] || []).map((voteId) => {
                                      const vote = voteOptions.find(
                                        (option) => option.id === voteId
                                      );
                                      return (
                                        <span
                                          key={voteId}
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${vote?.color || 'bg-[var(--app-card-soft)] text-[var(--app-text)]'}`}
                                        >
                                          {vote?.label || voteId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {(memberAvoids[p.id] || []).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(memberAvoids[p.id] || []).map((avoidId) => {
                                      const avoid = avoidOptions.find(
                                        (option) => option.id === avoidId
                                      );
                                      return (
                                        <span
                                          key={avoidId}
                                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--app-card-soft)] text-[var(--app-text)]"
                                        >
                                          不要 {avoid?.label || avoidId}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleProfileSelect(p.id)}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold active:scale-95 ${
                                  selectedProfileIds.has(p.id)
                                    ? 'bg-[var(--mint-soft)] text-[var(--mint-ink)]'
                                    : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)]'
                                }`}
                              >
                                {selectedProfileIds.has(p.id) ? '已参与' : '邀请加入'}
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
                          <p className="text-[11px] font-medium leading-relaxed text-[var(--app-text)]">
                            {collabSummary.analysisText}
                          </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-[var(--app-border)]">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setShowAddMember(true)}
                              className="app-btn-ghost flex items-center justify-center gap-1.5 rounded-[12px] py-2 text-[13px] font-semibold transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" /> 添加成员
                            </button>
                            <button
                              onClick={() => void handleInviteMoreFriends()}
                              className="app-btn-dark flex items-center justify-center gap-1.5 rounded-[12px] py-2 text-[13px] font-semibold transition-colors active:scale-95"
                            >
                              <Users className="w-3.5 h-3.5" />{' '}
                              {inviteFeedback === 'done' ? '已发送' : '发邀请'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onOpenExplore}
                className="app-pill w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all"
                aria-label="探索"
              >
                <Compass className="w-5 h-5 text-gray-800" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto w-full flex flex-col scrollbar-none pt-2 pb-6 px-5 min-h-0"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {messages.length === 0 ? (
            <HeroSection
              greeting={greeting}
              mainUserName={mainUser?.name || '小明'}
              suggestionCards={cardsWithIcons}
              onStartPlan={(prompt) => {
                const card = cardsWithIcons.find((c) => c.prompt === prompt);
                if (card) addRecentCardKeys([card.topicKey]);
                handleStartPlan(prompt, true);
              }}
            />
          ) : (
            <SessionList
              messages={messages}
              onViewActivity={onViewActivity}
              onViewRestaurant={onViewRestaurant}
              onOpenRestaurantFinder={onOpenRestaurantFinder}
              onViewDeliveryItem={onViewDeliveryItem}
              onViewTicketItem={onViewTicketItem}
              onOpenServiceFinder={onOpenServiceFinder}
              onViewItinerary={onViewItinerary}
              onSavePlan={onSavePlan}
              onUpdateWeatherMessage={handleUpdateWeatherMessage}
              onSuggestedPrompt={(prompt) => handleStartPlan(prompt)}
              onRequirementConfirm={(data, originalQuery) => {
                const enrichedQuery = [
                  originalQuery,
                  data.date ? `日期：${data.date}` : '',
                  data.days ? `天数：${data.days}天` : '',
                  data.people ? `人数：${data.people}人` : '',
                  data.preferences.length > 0 ? `偏好：${data.preferences.join('、')}` : '',
                  data.specialNeeds.length > 0 ? `需求：${data.specialNeeds.join('、')}` : '',
                  data.budget ? `预算：${data.budget[0]}-${data.budget[1]}` : '',
                ]
                  .filter(Boolean)
                  .join('，');
                setMessages((prev) => prev.filter((m) => !m.requirementQuery));
                handleStartPlan(enrichedQuery, true);
              }}
              onRequirementSkip={(originalQuery) => {
                setMessages((prev) => prev.filter((m) => !m.requirementQuery));
                handleStartPlan(originalQuery, true);
              }}
              onOpenTaxiFinder={onOpenTaxiFinder}
              onUpdateTaxiMessage={handleUpdateTaxiMessage}
            />
          )}
        </div>

        {/* Bottom Input Section */}
        <div
          className="px-5 pt-3 w-full mt-auto z-20 bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA]/95 to-transparent"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
          {!isPlanMode && <QuickActions onSelect={(prompt) => handleStartPlan(prompt)} />}

          {/* Advanced Planning Tool Panel */}
          {isPlanMode && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="app-panel relative z-20 mb-4 rounded-[24px] px-5 pt-5 pb-4"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--app-ink)]">
                  <Sparkles className="w-4 h-4 text-orange-500" /> 极速规划设定
                </span>
                <button
                  onClick={() => {
                    setIsPlanMode(false);
                    setQuery('');
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-card-soft)] text-[var(--app-text)] active:scale-95 transition-all"
                  aria-label="收起极速规划设定"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                {/* 同行人员 */}
                <div className="pb-4 border-b border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
                    <span className="text-[13px] font-bold text-[var(--app-text)]">同行人员</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {combinedProfiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleProfileSelect(p.id)}
                        className={`flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 text-[13px] font-semibold transition-all duration-150 active:scale-95 ${
                          selectedProfileIds.has(p.id)
                            ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)] border-transparent'
                            : 'bg-[var(--app-card-soft)] border-[var(--app-border)] text-[var(--app-text)] hover:bg-gray-100'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={getAvatarPath(p)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 出发时间 & 目标范围 */}
                <div className="pb-4 border-b border-[var(--app-border)]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
                        <span className="text-[13px] font-bold text-[var(--app-text)]">
                          出发时间
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {['上午', '下午', '晚上'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setTimePref(t + '出发')}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150 active:scale-95 ${
                              timePref === t + '出发'
                                ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)] border-transparent'
                                : 'bg-[var(--app-card-soft)] border-[var(--app-border)] text-[var(--app-text)] hover:bg-gray-100'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
                        <span className="text-[13px] font-bold text-[var(--app-text)]">
                          目标范围
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '附近', value: '附近 (3km)' },
                          { label: '同城', value: '同城探索' },
                          { label: '跨城', value: '跨城周边' },
                        ].map((item) => (
                          <button
                            key={item.label}
                            onClick={() => setTargetType(item.value)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-150 active:scale-95 ${
                              targetType === item.value
                                ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)] border-transparent'
                                : 'bg-[var(--app-card-soft)] border-[var(--app-border)] text-[var(--app-text)] hover:bg-gray-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 规划策略 */}
                <div className="pb-4 border-b border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--app-text-soft)]" />
                    <span className="text-[13px] font-bold text-[var(--app-text)]">规划策略</span>
                  </div>
                  <div className="flex gap-2">
                    {[
                      {
                        key: 'balanced' as const,
                        icon: <Users className="w-3.5 h-3.5" />,
                        label: '平衡',
                      },
                      {
                        key: 'care' as const,
                        icon: <Baby className="w-3.5 h-3.5" />,
                        label: '照顾',
                      },
                      {
                        key: 'efficient' as const,
                        icon: <Sparkles className="w-3.5 h-3.5" />,
                        label: '效率',
                      },
                    ].map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setCollabStrategy(s.key)}
                        className={`flex-1 flex items-center justify-center gap-1 rounded-[14px] border py-2 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                          collabStrategy === s.key
                            ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-[0_4px_12px_rgba(255,200,58,0.25)] border-transparent'
                            : 'bg-[var(--app-card-soft)] border-[var(--app-border)] text-[var(--app-text)] hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center">{s.icon}</span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 当前共识 */}
                <div className="flex items-center justify-between rounded-2xl bg-[rgba(255,244,191,0.34)] border border-[var(--brand-soft)] px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-[var(--brand-ink)]">当前共识</div>
                    <div className="mt-0.5 truncate text-[10px] font-medium text-[var(--warning-ink)]">
                      {collabSummary.consensus.length > 0
                        ? collabSummary.consensus.join('、')
                        : '还没选偏好'}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="shrink-0 rounded-full border border-[var(--brand-soft)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--brand-ink)] active:scale-95 transition-all hover:bg-[var(--brand-soft)]"
                  >
                    加成员
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 图片预览 */}
          <AnimatePresence>
            {vision.imagePreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative z-20 mb-2"
              >
                <div className="flex items-center gap-2 p-2 bg-[var(--app-card-soft)] rounded-2xl border border-[var(--app-border)]">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={vision.imagePreview.dataUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {vision.isRecognizing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--app-ink)] truncate">
                      {vision.imagePreview.file.name}
                    </p>
                    <p className="text-[11px] text-[var(--app-text-soft)]">
                      {vision.isRecognizing
                        ? '正在识别...'
                        : vision.visionResult
                          ? `识别到 ${vision.visionResult.entities.length} 个元素`
                          : '拍照/截图，AI 会识别内容'}
                    </p>
                  </div>
                  <button
                    onClick={vision.removeImage}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--app-text-soft)] hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Input Bar */}
          <div className="flex items-end gap-2.5 relative z-20 mt-1">
            <button
              onClick={() => {
                const next = !isPlanMode;
                setIsPlanMode(next);
                if (!next) {
                  setQuery('');
                } else {
                  if (selectedProfiles.length > 0) {
                    const names = selectedProfiles
                      .map((p) => `${p.name}(${p.ageGroup})`)
                      .join('、');
                    setQuery(
                      `请为${names}规划${timePref}、${targetType}的出行，优先考虑${collabSummary.consensus.join('、') || '大家的共同偏好'}`
                    );
                  }
                }
              }}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[24px] border border-[var(--app-border)] transition-all shadow-sm active:scale-95 cursor-pointer ${isPlanMode ? 'app-btn-dark text-white' : 'bg-white text-[var(--app-text)] hover:text-gray-900'}`}
              aria-label={isPlanMode ? '关闭规划模式' : '打开规划模式'}
            >
              <SlidersHorizontal className="w-[20px] h-[20px]" strokeWidth={2.5} />
            </button>

            <div className="app-card relative flex h-12 flex-1 items-center rounded-[24px] px-1.5 transition-all focus-within:ring-2 focus-within:ring-[rgba(255,216,77,0.28)]">
              {/* 隐藏的文件输入：拍照 */}
              <input
                ref={vision.inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={vision.handleFileChange}
                className="hidden"
              />
              {/* 隐藏的文件输入：相册 */}
              <input
                type="file"
                accept="image/*"
                onChange={vision.handleFileChange}
                className="hidden"
                id="gallery-input"
              />
              {/* "+" 附件按钮 */}
              <div className="relative">
                <button
                  onClick={() => setShowAttachMenu((v) => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 ${showAttachMenu ? 'bg-[var(--app-ink)] text-white rotate-45' : 'text-[var(--app-text-soft)] hover:text-gray-700'}`}
                  aria-label="添加内容"
                >
                  <Plus className="w-[22px] h-[22px]" strokeWidth={2.5} />
                </button>
                {/* 弹出菜单 */}
                <AnimatePresence>
                  {showAttachMenu && (
                    <>
                      {/* 点击外部关闭 */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowAttachMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[var(--app-border)] overflow-hidden z-50 w-40"
                      >
                        <button
                          onClick={() => {
                            setShowAttachMenu(false);
                            vision.selectImage();
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] font-bold text-[var(--app-ink)] hover:bg-[var(--app-card-soft)] active:bg-gray-100 transition-colors"
                        >
                          <Camera className="w-4 h-4 text-[var(--app-text)]" />
                          拍照识别
                        </button>
                        <div className="h-px bg-[var(--app-border)]" />
                        <button
                          onClick={() => {
                            setShowAttachMenu(false);
                            document.getElementById('gallery-input')?.click();
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] font-bold text-[var(--app-ink)] hover:bg-[var(--app-card-soft)] active:bg-gray-100 transition-colors"
                        >
                          <ImagePlus className="w-4 h-4 text-[var(--app-text)]" />
                          从相册选择
                        </button>
                        <div className="h-px bg-[var(--app-border)]" />
                        <button
                          onClick={() => {
                            setShowAttachMenu(false);
                            setShowImportGuide(true);
                          }}
                          className="flex items-center gap-2.5 w-full px-4 py-3 text-[13px] font-bold text-[var(--app-ink)] hover:bg-[var(--app-card-soft)] active:bg-gray-100 transition-colors"
                        >
                          <ClipboardPaste className="w-4 h-4 text-[var(--app-text)]" />
                          粘贴攻略
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartPlan();
                }}
                placeholder="想去哪？也可以粘贴攻略"
                className="h-full flex-1 bg-transparent border-none px-1 text-[13px] font-bold tracking-wide text-[var(--app-ink)] placeholder-[var(--app-text-soft)] outline-none focus:ring-0"
              />

              <button
                onMouseDown={() => {
                  voice.startListening({
                    onStop: (text) => {
                      const recognized = text.trim();
                      if (recognized) {
                        setQuery(recognized);
                      }
                      // 不自动发送，让用户确认后手动发送
                    },
                  });
                  setIsRecording(true);
                }}
                onMouseUp={() => {
                  voice.stopListening();
                  setIsRecording(false);
                }}
                onMouseLeave={() => {
                  if (voice.isListening) {
                    voice.cancelListening();
                    setIsRecording(false);
                  }
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  voice.startListening({
                    onStop: (text) => {
                      const recognized = text.trim();
                      if (recognized) {
                        setQuery(recognized);
                      }
                    },
                  });
                  setIsRecording(true);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  voice.stopListening();
                  setIsRecording(false);
                }}
                onTouchCancel={() => {
                  voice.cancelListening();
                  setIsRecording(false);
                }}
                className={`w-9 h-9 flex items-center justify-center shrink-0 transition-all text-[var(--app-text-soft)] hover:text-gray-900 ${voice.isListening ? 'text-red-500 animate-pulse' : query ? 'hidden' : 'block'}`}
                aria-label="语音输入"
              >
                <Mic className="w-[20px] h-[20px]" strokeWidth={2.5} />
              </button>

              {query && (
                <button
                  onClick={() => handleStartPlan()}
                  className="app-btn-primary animate-in fade-in zoom-in flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all duration-200 active:scale-90 disabled:opacity-40"
                >
                  <ArrowUp className="w-[18px] h-[18px]" strokeWidth={3.5} />
                </button>
              )}
            </div>

            <AnimatePresence>
              {voice.isListening && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute bottom-16 left-1/2 z-50 flex min-h-[140px] w-[260px] -translate-x-1/2 flex-col items-center justify-center rounded-[24px] bg-[rgba(20,24,33,0.92)] text-white shadow-2xl backdrop-blur-md px-5 py-5"
                >
                  <div className="flex gap-1.5 mb-3">
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ height: [12, waveformRandomsRef.current!.heights[i], 12] }}
                        transition={{
                          repeat: Infinity,
                          duration: waveformRandomsRef.current!.durations[i],
                        }}
                        className="w-1.5 rounded-full bg-[var(--brand)]"
                      />
                    ))}
                  </div>
                  {voice.interimText || voice.finalText ? (
                    <p className="text-[13px] font-semibold text-center leading-relaxed max-h-[60px] overflow-y-auto w-full">
                      {voice.finalText}
                      <span className="text-[var(--app-text-soft)]">{voice.interimText}</span>
                    </p>
                  ) : (
                    <span className="text-[13px] font-bold text-[var(--app-text-soft)]">
                      正在聆听，请说话...
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-[var(--app-text)] mt-2">
                    松开发送，滑出取消
                  </span>
                </motion.div>
              )}

              {voice.error && !voice.isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-red-500/90 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg backdrop-blur-sm"
                >
                  {voice.error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Import Guide Modal */}
        <AnimatePresence>
          {showImportGuide && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowImportGuide(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-white rounded-t-[32px] shadow-2xl overflow-hidden"
                style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
              >
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <div>
                    <h3 className="text-[18px] font-bold text-[var(--app-ink)]">粘贴攻略</h3>
                    <p className="mt-1 text-[13px] font-bold text-[var(--app-text-soft)]">
                      把收藏、聊天记录或笔记贴进来，我来整理路线。
                    </p>
                  </div>
                  <button
                    onClick={() => setShowImportGuide(false)}
                    className="app-chip-soft flex h-8 w-8 items-center justify-center rounded-full cursor-pointer active:scale-95"
                    aria-label="关闭导入攻略"
                  >
                    <X className="w-4 h-4 text-[var(--app-text)]" />
                  </button>
                </div>
                <div className="px-6 pb-6">
                  <textarea
                    value={guideText}
                    onChange={(e) => setGuideText(e.target.value)}
                    placeholder="例如：今天刷到一个北京周末路线，先去五道营胡同喝咖啡，再去国子监拍照，晚上吃铜锅涮肉..."
                    className="app-card-soft h-36 w-full resize-none rounded-[24px] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[var(--app-ink)] outline-none placeholder:text-[var(--app-text-soft)] focus:border-[var(--brand)]"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() =>
                        setGuideText(
                          '下午先去五道营胡同喝咖啡和逛小店，再去国子监街拍照，傍晚到什刹海散步，晚上吃铜锅涮肉。希望路线别太赶，适合两个人聊天拍照。'
                        )
                      }
                      className="app-btn-ghost flex-1 rounded-2xl py-3 text-[13px] font-semibold text-[var(--app-ink)] active:scale-[0.98]"
                    >
                      填入示例
                    </button>
                    <button
                      onClick={handleGuideImport}
                      disabled={!guideText.trim()}
                      className={`flex-[1.4] rounded-2xl py-3 text-[13px] font-semibold active:scale-[0.98] ${guideText.trim() ? 'app-btn-primary' : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)]'}`}
                    >
                      生成行程
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Member Modal */}
        <AnimatePresence>
          {showAddMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowAddMember(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-white rounded-t-[32px] shadow-2xl overflow-hidden"
                style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
              >
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                  <h3 className="text-[18px] font-bold text-[var(--app-ink)]">添加同行人</h3>
                  <button
                    onClick={() => setShowAddMember(false)}
                    className="app-chip-soft flex h-8 w-8 items-center justify-center rounded-full cursor-pointer active:scale-95"
                    aria-label="关闭添加成员"
                  >
                    <X className="w-4 h-4 text-[var(--app-text)]" />
                  </button>
                </div>
                <div className="px-6 pb-6 space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--app-text-soft)] mb-1.5 block">
                      姓名
                    </label>
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="输入成员名称"
                      className="app-card-soft w-full rounded-2xl px-4 py-3 text-[13px] font-semibold text-[var(--app-ink)] outline-none transition-colors placeholder-[var(--app-text-soft)] focus:border-[var(--brand)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--app-text-soft)] mb-1.5 block">
                      关系
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['家人', '伴侣', '朋友', '同事', '孩子', '长辈'].map((rel) => (
                        <button
                          key={rel}
                          onClick={() => setNewMemberRelation(rel)}
                          className={`rounded-full px-4 py-2 text-[13px] font-semibold border transition-all active:scale-95 ${newMemberRelation === rel ? 'app-btn-dark border-transparent text-white' : 'app-btn-ghost text-[var(--app-text)]'}`}
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--app-text-soft)] mb-1.5 block">
                      年龄段
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['儿童', '青少年', '青年', '中年', '老年'].map((age) => (
                        <button
                          key={age}
                          onClick={() => setNewMemberAge(age)}
                          className={`rounded-full px-4 py-2 text-[13px] font-semibold border transition-all active:scale-95 ${newMemberAge === age ? 'app-btn-dark border-transparent text-white' : 'app-btn-ghost text-[var(--app-text)]'}`}
                        >
                          {age}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddTempMember}
                    disabled={!newMemberName.trim()}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${newMemberName.trim() ? 'app-btn-primary' : 'bg-[var(--app-card-soft)] text-[var(--app-text-soft)] cursor-not-allowed'}`}
                  >
                    确认添加
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
