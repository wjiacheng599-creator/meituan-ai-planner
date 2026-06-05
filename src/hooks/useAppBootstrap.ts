/**
 * useAppBootstrap - 应用启动初始化 hook
 *
 * 职责：
 * 1. 从 localStorage 加载持久化数据（profiles / savedPlans / plannerTaskStates / taskSessions）
 * 2. 向服务端同步 bootstrap 数据
 * 3. 处理分享链接（?share=xxx）
 * 4. 管理各类数据的防抖持久化写入
 * 5. 定时向服务端同步状态
 *
 * 从 App.tsx 提取，使 App 保持简洁。
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Post } from '../types';
import type { TaskSession } from '../types';
import { isTieBreakerId, narrowMemberVotes, narrowMemberAvoids } from '../types';
import { defaultExplorePosts } from '../services/community';
import { useAppStore } from '../store/appStore';
import {
  loadProfiles,
  saveProfiles,
  loadSavedPlans,
  saveSavedPlans,
  loadPlannerTaskStates,
  savePlannerTaskStates,
  loadTaskSessions,
  loadActiveTaskSessionId,
  saveTaskSessions,
  saveActiveTaskSessionId,
  loadCommunityPosts,
  saveCommunityPosts,
} from '../services/storage';
import {
  bootstrapServerSession,
  getShareArtifactViaServer,
  syncProfilesViaServer,
  syncSessionsViaServer,
  syncTaskStatesViaServer,
} from '../services/serverApi';
import { useDebouncedEffect } from '../utils/useDebouncedEffect';
import { resolveUserCity } from '../services/apiAdapter';
import type { Plan } from '../services/ai';
import type { PersonProfile, PlannerTaskState } from '../types';
import { mergeTaskSessions } from '../utils/taskSessions';

// [PERF-OPT] Simple debounce utility
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

const DEFAULT_PROFILES: PersonProfile[] = [
  {
    id: 'p1',
    name: '小明',
    relation: '我',
    ageGroup: '成年人',
    dietaryPreferences: ['微辣', '喜欢咖啡'],
    travelPreferences: ['摄影', '小众秘境', '不爱起早'],
    budget: '中等',
    mobility: '正常',
    specialNeeds: [],
    favoriteActivities: ['咖啡馆', '公园'],
  },
];

// Default pagination limit
const DEFAULT_PAGE_SIZE = 20;

export interface AppBootstrapResult {
  isBootstrapping: boolean;
  profiles: PersonProfile[];
  setProfiles: React.Dispatch<React.SetStateAction<PersonProfile[]>>;
  savedPlans: Plan[];
  setSavedPlans: React.Dispatch<React.SetStateAction<Plan[]>>;
  plannerTaskStates: PlannerTaskState[];
  setPlannerTaskStates: React.Dispatch<React.SetStateAction<PlannerTaskState[]>>;
  taskSessions: TaskSession[];
  setTaskSessions: React.Dispatch<React.SetStateAction<TaskSession[]>>;
  activeTaskSessionId: string | null;
  setActiveTaskSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  communityPosts: Post[];
  setCommunityPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  finderCity: string;
  setFinderCity: React.Dispatch<React.SetStateAction<string>>;
  /** 当分享链接加载时设置，供 App 用于跳转 share 屏幕 */
  shareBootstrapPlan: Plan | null;
  shareBootstrapProfiles: PersonProfile[];
  shareBootstrapTaskState: PlannerTaskState | null;
  /** 分页状态 */
  hasMoreSessions: boolean;
  hasMorePlans: boolean;
  hasMoreProfiles: boolean;
  isLoadingMore: boolean;
  /** 加载更多数据 */
  loadMoreSessions: () => Promise<void>;
  loadMorePlans: () => Promise<void>;
  loadMoreProfiles: () => Promise<void>;
}

export function useAppBootstrap(): AppBootstrapResult {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [profiles, setProfiles] = useState<PersonProfile[]>(DEFAULT_PROFILES);
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [plannerTaskStates, setPlannerTaskStates] = useState<PlannerTaskState[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Post[]>(defaultExplorePosts);
  const [finderCity, setFinderCity] = useState('');
  const [serverHydrated, setServerHydrated] = useState(false);
  const taskSessions = useAppStore((s) => s.taskSessions);
  const setTaskSessions = useAppStore((s) => s.setTaskSessions);
  const activeTaskSessionId = useAppStore((s) => s.activeTaskSessionId);
  const setActiveTaskSessionId = useAppStore((s) => s.setActiveTaskSessionId);

  // Pagination state
  const [sessionsPage, setSessionsPage] = useState(1);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [plansPage, setPlansPage] = useState(1);
  const [hasMorePlans, setHasMorePlans] = useState(true);
  const [profilesPage, setProfilesPage] = useState(1);
  const [hasMoreProfiles, setHasMoreProfiles] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 分享链接引导数据（加载完成后供调用方处理）
  const [shareBootstrapPlan, setShareBootstrapPlan] = useState<Plan | null>(null);
  const [shareBootstrapProfiles, setShareBootstrapProfiles] = useState<PersonProfile[]>([]);
  const [shareBootstrapTaskState, setShareBootstrapTaskState] = useState<PlannerTaskState | null>(
    null
  );

  // ── 初始化 ──────────────────────────────────────────────────────
  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      // 1. 读取本地持久化数据
      const loadedProfiles = loadProfiles();
      const loadedSavedPlans = loadSavedPlans();
      const loadedPlannerTaskStates = loadPlannerTaskStates();
      const loadedTaskSessions = loadTaskSessions<TaskSession>();

      if (!isActive) return;

      setProfiles(loadedProfiles.length > 0 ? loadedProfiles : DEFAULT_PROFILES);
      setSavedPlans(loadedSavedPlans);
      setPlannerTaskStates(loadedPlannerTaskStates);
      if (loadedTaskSessions.length > 0) {
        setTaskSessions(loadedTaskSessions);
      }
      const loadedActiveTaskSessionId = loadActiveTaskSessionId();
      if (loadedActiveTaskSessionId) {
        setActiveTaskSessionId(loadedActiveTaskSessionId);
      }
      setCommunityPosts(
        [...loadCommunityPosts(), ...defaultExplorePosts].filter(
          (post, index, arr) => arr.findIndex((item) => item.id === post.id) === index
        )
      );

      // 2. 异步获取用户城市
      resolveUserCity().then((city) => {
        if (isActive) setFinderCity(city);
      });

      // 3. Server bootstrap with pagination
      try {
        const serverState = await bootstrapServerSession({ page: 1, limit: DEFAULT_PAGE_SIZE });
        if (!isActive) return;

        // Update pagination state
        setHasMoreProfiles(serverState.pagination?.hasMore ?? false);
        setHasMoreSessions(serverState.pagination?.hasMore ?? false);
        setHasMorePlans(serverState.pagination?.hasMore ?? false);

        if (serverState.profiles.length > 0) {
          setProfiles((prev) => {
            const merged = [...serverState.profiles, ...prev];
            return merged.filter(
              (item, index, arr) => arr.findIndex((p) => p.id === item.id) === index
            );
          });
        }

        if (serverState.savedPlans.length > 0) {
          setSavedPlans((prev) => {
            const merged = [...serverState.savedPlans, ...prev];
            return merged.filter(
              (item, index, arr) => arr.findIndex((p) => p.id === item.id) === index
            );
          });
        }

        if (serverState.plannerTaskStates.length > 0) {
          setPlannerTaskStates((prev) => {
            const merged = [...serverState.plannerTaskStates, ...prev];
            return merged.filter(
              (item, index, arr) => arr.findIndex((t) => t.planId === item.planId) === index
            );
          });
        }

        if (serverState.sessions.length > 0) {
          setTaskSessions((prev) => {
            const serverSessions: TaskSession[] = serverState.sessions.map((session) => ({
              id: session.id,
              title: session.title,
              summary: session.summary,
              queryDraft: session.queryDraft,
              updatedAt: session.updatedAt,
              status: session.status,
              planId: session.planId,
              planTitle: session.planTitle,
              durationTags: session.durationTags,
              totalPrice: session.totalPrice,
              memberCount: session.memberCount,
              selectedProfileIds: session.selectedProfileIds || [],
              messages: session.messages || [],
              timePref: session.timePref,
              targetType: session.targetType,
              collabStrategy: session.collabStrategy,
              tieBreaker:
                session.tieBreaker && isTieBreakerId(session.tieBreaker)
                  ? session.tieBreaker
                  : undefined,
              memberVotes: narrowMemberVotes(session.memberVotes),
              memberAvoids: narrowMemberAvoids(session.memberAvoids),
              tempProfiles: session.tempProfiles,
              planSummary: session.planSummary,
            }));
            return mergeTaskSessions(serverSessions, prev);
          });
        }

        setServerHydrated(true);

        // 4. 处理分享链接
        if (typeof window !== 'undefined') {
          const shareSlug = new URLSearchParams(window.location.search).get('share');
          if (shareSlug) {
            try {
              const shared = await getShareArtifactViaServer(shareSlug);
              if (!isActive) return;
              setShareBootstrapPlan(shared.plan);
              if (shared.profiles.length > 0) {
                setShareBootstrapProfiles(
                  shared.profiles.map((profile, index) => ({
                    id: profile.id ?? `share_${index}`,
                    name: profile.name,
                    relation: '同行人',
                    ageGroup: '成年人',
                    dietaryPreferences: [],
                    travelPreferences: [],
                    budget: '中等',
                    mobility: '正常',
                    specialNeeds: [],
                    favoriteActivities: [],
                  }))
                );
              }
              if (shared.taskState) {
                setShareBootstrapTaskState(shared.taskState);
              }
            } catch (error) {
              console.warn('[bootstrap] failed to load shared artifact', error);
            }
          }
        }
      } catch (error) {
        console.warn('[bootstrap] server bootstrap failed, using local state only', error);
        setServerHydrated(true);
      } finally {
        if (isActive) setIsBootstrapping(false);
      }
    };

    void initialize();
    return () => {
      isActive = false;
    };
  }, []);

  // ── 加载更多数据 ─────────────────────────────────────────────────
  const loadMoreProfiles = useCallback(async () => {
    if (!hasMoreProfiles || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = profilesPage + 1;
      const result = await bootstrapServerSession({ page: nextPage, limit: DEFAULT_PAGE_SIZE });
      if (result.profiles.length > 0) {
        setProfiles((prev) => {
          const merged = [...prev, ...result.profiles];
          return merged.filter(
            (item, index, arr) => arr.findIndex((p) => p.id === item.id) === index
          );
        });
      }
      setProfilesPage(nextPage);
      setHasMoreProfiles(result.pagination?.hasMore ?? false);
    } catch (error) {
      console.warn('[bootstrap] failed to load more profiles', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreProfiles, isLoadingMore, profilesPage]);

  const loadMorePlans = useCallback(async () => {
    if (!hasMorePlans || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = plansPage + 1;
      const result = await bootstrapServerSession({ page: nextPage, limit: DEFAULT_PAGE_SIZE });
      if (result.savedPlans.length > 0) {
        setSavedPlans((prev) => {
          const merged = [...prev, ...result.savedPlans];
          return merged.filter(
            (item, index, arr) => arr.findIndex((p) => p.id === item.id) === index
          );
        });
      }
      setPlansPage(nextPage);
      setHasMorePlans(result.pagination?.hasMore ?? false);
    } catch (error) {
      console.warn('[bootstrap] failed to load more plans', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMorePlans, isLoadingMore, plansPage]);

  const loadMoreSessions = useCallback(async () => {
    if (!hasMoreSessions || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = sessionsPage + 1;
      const result = await bootstrapServerSession({ page: nextPage, limit: DEFAULT_PAGE_SIZE });
      if (result.sessions.length > 0) {
        setTaskSessions((prev) => {
          const serverSessions: TaskSession[] = result.sessions.map((session) => ({
            id: session.id,
            title: session.title,
            summary: session.summary,
            queryDraft: session.queryDraft,
            updatedAt: session.updatedAt,
            status: session.status,
            planId: session.planId,
            planTitle: session.planTitle,
            durationTags: session.durationTags,
            totalPrice: session.totalPrice,
            memberCount: session.memberCount,
            selectedProfileIds: session.selectedProfileIds || [],
            messages: session.messages || [],
            timePref: session.timePref,
            targetType: session.targetType,
            collabStrategy: session.collabStrategy,
            tieBreaker:
              session.tieBreaker && isTieBreakerId(session.tieBreaker)
                ? session.tieBreaker
                : undefined,
            memberVotes: narrowMemberVotes(session.memberVotes),
            memberAvoids: narrowMemberAvoids(session.memberAvoids),
            tempProfiles: session.tempProfiles,
            planSummary: session.planSummary,
          }));
          return mergeTaskSessions(prev, serverSessions);
        });
      }
      setSessionsPage(nextPage);
      setHasMoreSessions(result.pagination?.hasMore ?? false);
    } catch (error) {
      console.warn('[bootstrap] failed to load more sessions', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreSessions, isLoadingMore, sessionsPage]);

  // ── 持久化副作用 ─────────────────────────────────────────────────
  // [PERF-OPT] Debounced save functions to avoid excessive localStorage writes
  const debouncedSaveProfiles = useMemo(() => debounce(saveProfiles, 300), []);
  const debouncedSaveActiveTaskSessionId = useMemo(
    () => debounce(saveActiveTaskSessionId, 200),
    []
  );

  useEffect(() => {
    debouncedSaveProfiles(profiles);
  }, [profiles, debouncedSaveProfiles]);

  useDebouncedEffect(
    () => {
      saveSavedPlans(savedPlans);
    },
    [savedPlans],
    500
  );

  useDebouncedEffect(
    () => {
      savePlannerTaskStates(plannerTaskStates);
    },
    [plannerTaskStates],
    500
  );

  // ── taskSessions ref：始终持有最新值，供 debounced save 和 unmount 使用 ──
  const taskSessionsRef = useRef(taskSessions);
  taskSessionsRef.current = taskSessions;

  useDebouncedEffect(
    () => {
      saveTaskSessions(taskSessionsRef.current);
    },
    [taskSessions],
    500
  );

  useEffect(() => {
    debouncedSaveActiveTaskSessionId(activeTaskSessionId);
  }, [activeTaskSessionId, debouncedSaveActiveTaskSessionId]);

  useDebouncedEffect(
    () => {
      saveCommunityPosts(communityPosts.filter((post) => post.id > 1000));
    },
    [communityPosts],
    500
  );

  // ── 服务端同步 ───────────────────────────────────────────────────
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const taskStatesRef = useRef(plannerTaskStates);
  taskStatesRef.current = plannerTaskStates;
  const sessionsRef = useRef(taskSessions);
  sessionsRef.current = taskSessions;
  const serverHydratedRef = useRef(serverHydrated);
  serverHydratedRef.current = serverHydrated;

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!serverHydratedRef.current) return;
      const sendBeaconJSON = (url: string, data: unknown) => {
        try {
          const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } catch {
          // sendBeacon may fail silently in some browsers
        }
      };
      sendBeaconJSON('/api/profiles/sync', { profiles: profilesRef.current });
      sendBeaconJSON('/api/task-states/sync', { taskStates: taskStatesRef.current });
      sendBeaconJSON('/api/sessions/sync', { sessions: sessionsRef.current });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!serverHydrated) return;
    const timer = window.setTimeout(() => {
      void syncProfilesViaServer(profiles).catch((err) => {
        if (import.meta.env.DEV) console.warn('[bootstrap] failed to sync profiles', err);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [profiles, serverHydrated]);

  useEffect(() => {
    if (!serverHydrated) return;
    const timer = window.setTimeout(() => {
      void syncTaskStatesViaServer(plannerTaskStates).catch((err) => {
        if (import.meta.env.DEV) console.warn('[bootstrap] failed to sync task states', err);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [plannerTaskStates, serverHydrated]);

  useEffect(() => {
    if (!serverHydrated) return;
    const timer = window.setTimeout(() => {
      void syncSessionsViaServer(taskSessions).catch((err) => {
        console.warn('[bootstrap] failed to sync sessions', err);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [taskSessions, serverHydrated]);

  return {
    isBootstrapping,
    profiles,
    setProfiles,
    savedPlans,
    setSavedPlans,
    plannerTaskStates,
    setPlannerTaskStates,
    taskSessions,
    setTaskSessions,
    activeTaskSessionId,
    setActiveTaskSessionId,
    communityPosts,
    setCommunityPosts,
    finderCity,
    setFinderCity,
    shareBootstrapPlan,
    shareBootstrapProfiles,
    shareBootstrapTaskState,
    hasMoreSessions,
    hasMorePlans,
    hasMoreProfiles,
    isLoadingMore,
    loadMoreSessions,
    loadMorePlans,
    loadMoreProfiles,
  };
}
