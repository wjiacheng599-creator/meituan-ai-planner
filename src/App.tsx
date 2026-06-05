/**
 * App.tsx - 应用根组件（纯组合层）
 *
 * 职责：
 * 1. 组合所有 hook（useAppBootstrap / useAppState / useScreenNavigation / useServiceItemFlow）
 * 2. 处理分享链接引导后的一次性导航
 * 3. 将收集到的状态和回调透传给 AppRouter
 *
 * 不包含任何业务逻辑，保持简洁。
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import MobileFrame from './components/layout/MobileFrame';
import AppRouter from './components/AppRouter';
import { ToastProvider } from './components/ui/ToastProvider';
import { AppStateProvider, AppState } from './contexts/AppStateContext';
import Onboarding from './components/screens/Onboarding';

import { generatePlan } from './services/ai';
import { useScreenNavigation } from './hooks/useScreenNavigation';
import { useServiceItemFlow } from './hooks/useServiceItemFlow';
import { useAppState } from './hooks/useAppState';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppStore } from './store/appStore';
import { mergeTaskSessions } from './utils/taskSessions';

export default function App() {
  const bootstrap = useAppBootstrap();
  const onboardingCompleted = useAppStore((s) => s.onboardingCompleted);
  const setOnboardingCompleted = useAppStore((s) => s.setOnboardingCompleted);

  const { screen, setScreen, screenStack, setScreenStack, navigateTo, goBack, navigateToScreen } =
    useScreenNavigation();

  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // ── 导航方向检测 ──
  const prevScreenRef = useRef<string>('home');
  const [navDirection, setNavDirection] = useState<'forward' | 'back' | 'none'>('none');

  // 模态页面：从底部滑入
  const MODAL_SCREENS = new Set([
    'booking',
    'payment',
    'success',
    'share',
    'detail',
    'explore_detail',
  ]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev === screen) return;

    if (MODAL_SCREENS.has(screen)) {
      setNavDirection('forward');
    } else if (
      screenStack.indexOf(screen) < screenStack.indexOf(prev) &&
      screenStack.indexOf(screen) >= 0
    ) {
      setNavDirection('back');
    } else {
      setNavDirection('forward');
    }

    prevScreenRef.current = screen;
  }, [screen, screenStack]);

  const serviceFlow = useServiceItemFlow(navigateTo);
  const serviceFlowRef = useRef(serviceFlow);
  serviceFlowRef.current = serviceFlow;
  const appState = useAppState();
  const plan = appState.plan;
  const abortRef = useRef<AbortController | null>(null);

  // Define callbacks BEFORE appStateContext
  const handleGeneratePlan = useCallback(
    async (query: string) => {
      // Create new AbortController for this generation
      const controller = new AbortController();
      abortRef.current = controller;

      // Reset streaming state
      setStreamingText('');
      setIsStreaming(true);
      serviceFlowRef.current.setCurrentQuery(query);
      navigateTo('planning');

      try {
        const generatedPlan = await generatePlan(query, undefined, controller.signal);
        setIsStreaming(false);
        appState.upsertPlanEverywhere(generatedPlan, { sourceQuery: query });
        if (generatedPlan.id) {
          appState.upsertTaskState(generatedPlan.id, (prev) => ({
            planId: generatedPlan.id,
            status: 'planned',
            selectedActivityIds: prev?.selectedActivityIds ?? [],
            bookedActivityIds: prev?.bookedActivityIds ?? [],
            bookedVariants: prev?.bookedVariants ?? [],
            completedActivityIds: prev?.completedActivityIds ?? [],
            lastUpdatedAt: Date.now(),
          }));
        }
        setScreen('overview');
        setScreenStack((prev) => [...prev.slice(0, -1), 'overview']);
      } catch (error) {
        // Don't show error if it was aborted (DOMException from fetch or our custom Error)
        const isAborted =
          error instanceof DOMException
            ? error.name === 'AbortError'
            : error instanceof Error &&
              (error.message === 'AbortError' || error.name === 'AbortError');
        if (isAborted) {
          console.log('[App] Plan generation cancelled');
          return;
        }
        if (import.meta.env.DEV) console.error('Plan generation failed:', error);
        console.error('行程生成失败，请稍后重试');
        setScreen('home');
        setScreenStack(['home']);
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStreamingText('');
      }
    },
    [navigateTo, appState, setScreen, setScreenStack]
  );

  const handleCancelPlan = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setStreamingText('');
    setScreen('home');
    setScreenStack(['home']);
  }, [setScreen, setScreenStack]);

  // ── 稳定的 Context 值：用 ref 持有可变部分，只在必要时更新 ──
  // 函数引用（稳定，不需要在 deps 中）
  const appStateContextRef = useRef<Record<string, unknown>>({});

  // 每次渲染更新 ref 中的数据（不触发 Context 更新）
  appStateContextRef.current = {
    screen,
    screenStack,
    setScreen,
    setScreenStack,
    navigateTo,
    goBack,
    navigateToScreen,
    plan,
    setPlan: appState.setPlan,
    currentQuery: serviceFlow.currentQuery,
    selectedActivity: serviceFlow.selectedActivity,
    setSelectedActivity: serviceFlow.setSelectedActivity,
    selectedPost: serviceFlow.selectedPost,
    setSelectedPost: serviceFlow.setSelectedPost,
    profiles: appState.profiles,
    setProfiles: appState.setProfiles,
    savedPlans: appState.savedPlans,
    plannerTaskStates: appState.plannerTaskStates,
    setPlannerTaskStates: appState.setPlannerTaskStates,
    taskSessions: appState.taskSessions,
    activeTaskSessionId: appState.activeTaskSessionId,
    setTaskSessions: appState.setTaskSessions,
    setActiveTaskSessionId: appState.setActiveTaskSessionId,
    shareSlug: appState.shareSlug,
    setShareSlug: appState.setShareSlug,
    taskStateForPlan: appState.taskStateForPlan,
    paymentAmount: appState.paymentAmount,
    setPaymentAmount: appState.setPaymentAmount,
    pendingPaymentIntent: appState.pendingPaymentIntent,
    setPendingPaymentIntent: appState.setPendingPaymentIntent,
    communityPosts: bootstrap.communityPosts,
    setCommunityPosts: bootstrap.setCommunityPosts,
    restaurantFinderItems: serviceFlow.restaurantFinderItems,
    setRestaurantFinderItems: serviceFlow.setRestaurantFinderItems,
    restaurantFinderKeyword: serviceFlow.restaurantFinderKeyword,
    setRestaurantFinderKeyword: serviceFlow.setRestaurantFinderKeyword,
    serviceFinderMode: serviceFlow.serviceFinderMode,
    setServiceFinderMode: serviceFlow.setServiceFinderMode,
    serviceFinderKeyword: serviceFlow.serviceFinderKeyword,
    setServiceFinderKeyword: serviceFlow.setServiceFinderKeyword,
    serviceFinderItems: serviceFlow.serviceFinderItems,
    setServiceFinderItems: serviceFlow.setServiceFinderItems,
    finderCity: bootstrap.finderCity,
    taxiFinderData: serviceFlow.taxiFinderData,
    setTaxiFinderData: serviceFlow.setTaxiFinderData,
    notifyTaxiBookingComplete: serviceFlow.notifyTaxiBookingComplete,
    consumeTaxiBookingResult: serviceFlow.consumeTaxiBookingResult,
    homeStartNewTaskSignal: serviceFlow.homeStartNewTaskSignal,
    setHomeStartNewTaskSignal: serviceFlow.setHomeStartNewTaskSignal,
    storyTemplate: serviceFlow.storyTemplate,
    setStoryTemplate: serviceFlow.setStoryTemplate,
    copilotMessagesByPlan: serviceFlow.copilotMessagesByPlan,
    setCopilotMessagesByPlan: serviceFlow.setCopilotMessagesByPlan,
    selectedIds: appState.selectedIds,
    bookedIds: appState.bookedIds,
    completedPlanIds: appState.completedPlanIds,
    currentTaskState: appState.currentTaskState,
    currentCompletedIds: appState.currentCompletedIds,
    currentBookedIds: appState.currentBookedIds,
    upsertTaskState: appState.upsertTaskState,
    upsertPlanEverywhere: appState.upsertPlanEverywhere,
    markActivitiesAsBooked: appState.markActivitiesAsBooked,
    markActivitiesAsCompleted: appState.markActivitiesAsCompleted,
    deselectIds: appState.deselectIds,
    toggleSelectedId: appState.toggleSelectedId,
    replaceActivityInPlan: appState.replaceActivityInPlan,
    updatePlan: appState.updatePlan,
    openRestaurantDetail: serviceFlow.openRestaurantDetail,
    openServiceActivityDetail: serviceFlow.openServiceActivityDetail,
    openServiceDeliveryDetail: serviceFlow.openServiceDeliveryDetail,
    onGeneratePlan: handleGeneratePlan,
    onCancelPlan: handleCancelPlan,
  };

  const _ctxSelectedIds = appStateContextRef.current.selectedIds;
  const _ctxBookedIds = appStateContextRef.current.bookedIds;
  const _ctxTaskSessions = appState.taskSessions;
  const _ctxActiveTaskSessionId = appState.activeTaskSessionId;
  const _ctxHomeStartNewTaskSignal = serviceFlow.homeStartNewTaskSignal;
  const _ctxSavedPlans = appState.savedPlans;
  const _ctxPlan = appState.plan;

  const appStateContext = useMemo(
    () =>
      ({
        ...appStateContextRef.current,
        get screen() {
          return appStateContextRef.current.screen;
        },
        get plan() {
          return appStateContextRef.current.plan;
        },
        get profiles() {
          return appStateContextRef.current.profiles;
        },
        get savedPlans() {
          return appStateContextRef.current.savedPlans;
        },
        get plannerTaskStates() {
          return appStateContextRef.current.plannerTaskStates;
        },
        get taskSessions() {
          return appStateContextRef.current.taskSessions;
        },
        get activeTaskSessionId() {
          return appStateContextRef.current.activeTaskSessionId;
        },
        get currentTaskState() {
          return appStateContextRef.current.currentTaskState;
        },
        get selectedIds() {
          return appStateContextRef.current.selectedIds;
        },
        get bookedIds() {
          return appStateContextRef.current.bookedIds;
        },
        get completedPlanIds() {
          return appStateContextRef.current.completedPlanIds;
        },
        get pendingPaymentIntent() {
          return appStateContextRef.current.pendingPaymentIntent;
        },
      }) as typeof appStateContextRef.current,
    [
      screen,
      _ctxSelectedIds,
      _ctxBookedIds,
      _ctxTaskSessions,
      _ctxActiveTaskSessionId,
      _ctxHomeStartNewTaskSignal,
      _ctxSavedPlans,
      _ctxPlan,
    ]
  );

  // 初始化完成后同步 bootstrap 数据到 appState（合并策略：保留本地更新的数据）
  useEffect(() => {
    if (!bootstrap.isBootstrapping) {
      // profiles: 合并，本地有数据时保留本地
      appState.setProfiles((prev) => {
        if (prev.length > 0) return prev; // 本地已有 profiles，不覆盖
        return bootstrap.profiles;
      });
      // savedPlans: 合并去重
      appState.setSavedPlans((prev) => {
        if (prev.length > 0) {
          const serverIds = new Set(bootstrap.savedPlans.map((p) => p.id));
          const localOnly = prev.filter((p) => !serverIds.has(p.id));
          return [...bootstrap.savedPlans, ...localOnly];
        }
        return bootstrap.savedPlans;
      });
      // taskStates: 合并去重
      appState.setPlannerTaskStates((prev) => {
        if (prev.length > 0) {
          const merged = [...bootstrap.plannerTaskStates, ...prev];
          return merged.filter(
            (item, index, arr) => arr.findIndex((t) => t.planId === item.planId) === index
          );
        }
        return bootstrap.plannerTaskStates;
      });
      appState.setTaskSessions((prev) => {
        if (prev.length > 0) {
          return mergeTaskSessions(bootstrap.taskSessions, prev);
        }
        return bootstrap.taskSessions;
      });
      appState.setActiveTaskSessionId(bootstrap.activeTaskSessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap.isBootstrapping]);

  // 处理分享链接引导
  useEffect(() => {
    if (!bootstrap.isBootstrapping && bootstrap.shareBootstrapPlan) {
      appState.setPlan(bootstrap.shareBootstrapPlan);
      if (bootstrap.shareBootstrapProfiles.length > 0) {
        appState.setProfiles((prev) => (prev.length > 0 ? prev : bootstrap.shareBootstrapProfiles));
      }
      if (bootstrap.shareBootstrapTaskState) {
        const taskState = bootstrap.shareBootstrapTaskState;
        appState.setPlannerTaskStates((prev) => {
          const merged = [taskState, ...prev];
          return merged.filter(
            (item, index, arr) => arr.findIndex((t) => t.planId === item.planId) === index
          );
        });
      }
      setScreen('share');
      setScreenStack(['share']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap.isBootstrapping, bootstrap.shareBootstrapPlan]);

  return (
    <ToastProvider>
      <MobileFrame>
        <div className="flex-1 relative h-full flex flex-col">
          {bootstrap.isBootstrapping ? (
            <div className="h-full w-full bg-[linear-gradient(180deg,#fbfcff_0%,#f6f7fb_100%)]" />
          ) : !onboardingCompleted ? (
            <Onboarding onComplete={() => setOnboardingCompleted(true)} />
          ) : (
            <motion.div
              key={screen}
              initial={
                MODAL_SCREENS.has(screen)
                  ? { opacity: 0, y: '100%' } // 模态：从底部滑入
                  : navDirection === 'back'
                    ? { opacity: 0, x: -60 } // 后退：从左滑入
                    : { opacity: 0, x: 60 } // 前进：从右滑入
              }
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full h-full flex flex-col flex-1 relative bg-[linear-gradient(180deg,#fbfcff_0%,#f6f7fb_100%)]"
            >
              <AppStateProvider state={appStateContext as unknown as AppState}>
                <AppRouter streamingText={streamingText} isStreaming={isStreaming} />
              </AppStateProvider>
            </motion.div>
          )}
        </div>
      </MobileFrame>
    </ToastProvider>
  );
}
