/**
 * useAppRouterCallbacks - 收拢 AppRouter 中所有 callback handler
 *
 * 从 AppRouter.tsx 中提取的 ~40 个 useCallback handler，
 * 统一管理导航、保存、分享等操作，减少 prop drilling。
 */
import { useCallback, useRef } from 'react';
import type { CopilotMessage, Plan } from '../services/ai';
import type { Post } from '../types';
import type { AppState } from '../contexts/AppStateContext';
import type { DeliveryCardData, TicketCardData } from '../components/cards/ServiceCards';
import { cancelOrder, requestRefund } from '../services/orderApi';

export function useAppRouterCallbacks(state: AppState) {
  const pendingVariantRef = useRef<{ timeSlot: string; ticketName: string } | undefined>(undefined);

  const resetSelectionForPlan = useCallback(
    (planId: string) => {
      state.upsertTaskState(planId, (prev) => {
        const hasCompleted = !!prev?.completedActivityIds?.length;
        const hasBooked = !!prev?.bookedActivityIds?.length;
        return {
          planId,
          status: hasCompleted ? 'completed' : hasBooked ? 'booked' : 'planned',
          selectedActivityIds: [],
          bookedActivityIds: prev?.bookedActivityIds ?? [],
          bookedVariants: prev?.bookedVariants ?? [],
          completedActivityIds: prev?.completedActivityIds ?? [],
          lastUpdatedAt: Date.now(),
        };
      });
    },
    [state]
  );

  // ── Navigation ──
  const handleOpenExplore = useCallback(
    () => state.navigateToScreen('explore'),
    [state.navigateToScreen]
  );
  const handleOpenProfile = useCallback(
    () => state.navigateToScreen('profile'),
    [state.navigateToScreen]
  );
  const handleConsumeStartNewTaskSignal = useCallback(
    () => state.setHomeStartNewTaskSignal(0),
    [state.setHomeStartNewTaskSignal]
  );
  const handleExploreBack = useCallback(
    () => state.navigateToScreen('home'),
    [state.navigateToScreen]
  );
  const handleProfileBack = useCallback(
    () => state.navigateToScreen('home'),
    [state.navigateToScreen]
  );
  const handleOrdersBack = useCallback(
    () => state.navigateToScreen('home'),
    [state.navigateToScreen]
  );
  const handlePaymentBack = useCallback(
    () => state.navigateToScreen('home'),
    [state.navigateToScreen]
  );

  // ── Activity / Plan ──
  const handleViewActivity = useCallback(
    (act: import('../services/ai').Activity | null) => {
      if (act) {
        state.setSelectedActivity(act);
        state.navigateTo('detail');
      }
    },
    [state]
  );

  const handleViewItinerary = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        if (p.id) resetSelectionForPlan(p.id);
        state.navigateTo('itinerary');
      }
    },
    [resetSelectionForPlan, state]
  );

  const handleChecklist = handleViewItinerary;

  const handleSavePlan = useCallback(
    (p: Plan | null) => {
      if (p) state.upsertPlanEverywhere(p);
    },
    [state.upsertPlanEverywhere]
  );

  const handleViewDetails = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        if (p.id) resetSelectionForPlan(p.id);
        state.navigateTo('itinerary');
      }
    },
    [resetSelectionForPlan, state]
  );

  const handlePlanAgain = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        if (p.id) resetSelectionForPlan(p.id);
        state.navigateTo('overview');
      }
    },
    [resetSelectionForPlan, state]
  );

  const handleAdjustPlan = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        state.navigateTo('adjust');
      }
    },
    [state]
  );

  const handleRecord = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        state.navigateTo('record');
      }
    },
    [state]
  );

  const handleViewStory = useCallback(
    (p: Plan | null) => {
      if (p) {
        state.setPlan(p);
        state.navigateTo('story');
      }
    },
    [state]
  );

  const handleOverviewConfirm = useCallback(() => {
    if (state.plan) {
      state.upsertPlanEverywhere(state.plan);
      if (state.plan.id) resetSelectionForPlan(state.plan.id);
      state.navigateTo('itinerary');
    }
  }, [resetSelectionForPlan, state.plan, state.upsertPlanEverywhere, state.navigateTo]);

  const handleOverviewShare = useCallback(() => state.navigateTo('share'), [state.navigateTo]);

  const handleOverviewDetails = useCallback(
    (act: import('../services/ai').Activity | null) => {
      if (act) {
        state.setSelectedActivity(act);
        state.navigateTo('detail');
      }
    },
    [state]
  );

  // ── Finder ──
  const handleOpenRestaurantFinder = useCallback(
    (items: import('../components/cards/ServiceCards').RestaurantCardData[], keyword: string) => {
      state.setRestaurantFinderItems(items);
      state.setRestaurantFinderKeyword(keyword);
      state.navigateTo('restaurant_finder');
    },
    [state]
  );

  const handleOpenServiceFinder = useCallback(
    (
      mode: 'delivery' | 'ticket' | 'coupon',
      items:
        | DeliveryCardData[]
        | TicketCardData[]
        | import('../components/cards/ServiceCards').CouponCardData[],
      keyword: string
    ) => {
      state.setServiceFinderMode(mode);
      state.setServiceFinderItems(items);
      state.setServiceFinderKeyword(keyword);
      state.navigateTo('service_finder');
    },
    [state]
  );

  const handleOpenTaxiFinder = useCallback(
    (data: import('../components/cards/TaxiCard').TaxiCardData) => {
      state.setTaxiFinderData(data);
      state.navigateTo('taxi_finder');
    },
    [state]
  );

  const handleServiceFinderSelect = useCallback(
    (item: DeliveryCardData | TicketCardData) => {
      if (!item) return;
      if ('deliveryTime' in item) state.openServiceDeliveryDetail(item as DeliveryCardData);
      else if ('venue' in item) state.openServiceActivityDetail(item as TicketCardData);
    },
    [state]
  );

  // ── Community ──
  const handleCreatePost = useCallback(
    (post: Omit<Post, 'id'>) => {
      state.setCommunityPosts((prev) => [
        { ...post, id: Date.now() * 1000 + Math.floor(Math.random() * 1000) },
        ...prev,
      ]);
    },
    [state.setCommunityPosts]
  );

  const handleInspire = useCallback(
    (query: string) => void state.onGeneratePlan(query),
    [state.onGeneratePlan]
  );

  const handlePostSelect = useCallback(
    (post: Post | null) => {
      if (post) {
        state.setSelectedPost(post);
        state.navigateTo('explore_detail');
      }
    },
    [state]
  );

  // ── Session ──
  const handleContinueTask = useCallback(
    (sessionId: string) => {
      state.setActiveTaskSessionId(sessionId);
      state.navigateToScreen('home');
    },
    [state]
  );

  const handleStartNewTask = useCallback(() => {
    state.navigateToScreen('home');
    state.setHomeStartNewTaskSignal((prev) => prev + 1);
  }, [state]);

  // ── Itinerary ──
  const handleItineraryProceedPayment = useCallback(() => {
    state.setSelectedActivity(null);
    if (state.plan) {
      const existingIntent =
        state.pendingPaymentIntent?.planId === state.plan.id ? state.pendingPaymentIntent : null;
      const fallbackIds = existingIntent?.activityIds.length
        ? existingIntent.activityIds
        : state.taskStateForPlan?.bookedActivityIds?.length
          ? state.taskStateForPlan.bookedActivityIds
          : state.taskStateForPlan?.selectedActivityIds || [];
      const activities = state.plan.activities.filter((activity) =>
        fallbackIds.includes(activity.id)
      );
      const totalAmount =
        existingIntent?.amount ||
        activities.reduce((sum, activity) => sum + (activity.price || 0), 0);
      if (totalAmount > 0) {
        state.setPaymentAmount?.(totalAmount);
      }
      if (!existingIntent && activities.length > 0) {
        const activityIds = activities.map((activity) => activity.id);
        state.setPendingPaymentIntent({
          id: `pay_${state.plan.id}_${activityIds.slice().sort().join('_')}`,
          planId: state.plan.id,
          activityIds,
          title: state.plan.title,
          merchantName:
            activities.find((activity) => activity.type === 'food')?.title || state.plan.title,
          amount: totalAmount,
          serviceCount: activities.length,
          peopleCount: state.plan.memberCount || state.profiles.length || 1,
          status: 'pending',
          createdAt: Date.now(),
        });
      }
    }
    state.navigateTo('payment');
  }, [state]);

  const handleItineraryActivityClick = useCallback(
    (act: import('../services/ai').Activity | null) => {
      if (act) {
        state.setSelectedActivity(act);
        state.navigateTo('detail');
      }
    },
    [state]
  );

  const handleItineraryShare = useCallback(() => state.navigateTo('share'), [state.navigateTo]);

  const handleUpdateCopilotMessages = useCallback(
    (msgs: CopilotMessage[]) => {
      if (state.plan) {
        state.setCopilotMessagesByPlan((prev) => ({ ...prev, [state.plan!.id]: msgs }));
      }
    },
    [state.plan, state.setCopilotMessagesByPlan]
  );

  // ── Payment / Success ──
  const handlePaymentSuccess = useCallback(
    (payment?: { paymentId?: string; orderId?: string }) => {
      if (!state.plan) {
        console.warn('[handlePaymentSuccess] No plan available');
        state.navigateTo('success');
        return;
      }

      const variant = state.pendingBookingVariant;
      if (state.selectedActivity) {
        state.markActivitiesAsBooked(state.plan.id, [state.selectedActivity.id], variant);
      } else {
        const activityIds =
          state.pendingPaymentIntent?.planId === state.plan.id
            ? state.pendingPaymentIntent.activityIds
            : Array.from(state.selectedIds);
        state.markActivitiesAsBooked(state.plan.id, activityIds, variant);
        state.deselectIds(state.plan.id, activityIds);
        state.setPendingPaymentIntent((prev) =>
          prev?.planId === state.plan!.id
            ? { ...prev, status: 'paid', paymentId: payment?.paymentId, orderId: payment?.orderId }
            : prev
        );
      }
      state.setPendingBookingVariant?.(undefined);
      state.navigateTo('success');
    },
    [state]
  );

  const handleSuccessBackToItinerary = useCallback(() => {
    if (state.plan?.id) {
      state.setPlannerTaskStates((prev) => {
        const existing = prev.find((t) => t.planId === state.plan!.id);
        if (existing) {
          if (existing.status === 'completed' || existing.status === 'archived') return prev;
          return prev.map((t) =>
            t.planId === state.plan!.id
              ? { ...t, status: 'completed' as const, lastUpdatedAt: Date.now() }
              : t
          );
        }
        return [
          ...prev,
          {
            planId: state.plan!.id,
            status: 'completed' as const,
            selectedActivityIds: [],
            bookedActivityIds: [],
            bookedVariants: [],
            completedActivityIds: [],
            lastUpdatedAt: Date.now(),
          },
        ];
      });
    }
    state.setScreen('itinerary');
    state.setScreenStack(['home', 'itinerary']);
  }, [state]);

  const handleSuccessViewOrders = useCallback(
    () => state.navigateToScreen('orders'),
    [state.navigateToScreen]
  );
  const handleSuccessShare = useCallback(() => state.navigateTo('share'), [state.navigateTo]);

  // ── Orders ──
  const handleCancelOrder = useCallback(async (orderId: string) => {
    try {
      await cancelOrder(orderId);
    } catch (err) {
      console.error('[handleCancelOrder] Failed:', err);
      throw err;
    }
  }, []);

  const handleRequestRefund = useCallback(async (orderId: string) => {
    try {
      await requestRefund(orderId, '用户申请退款');
    } catch (err) {
      console.error('[handleRequestRefund] Failed:', err);
      throw err;
    }
  }, []);

  // ── Adjust / Backup ──
  const handleSelectOption = useCallback(
    (option: string) => {
      if (option.startsWith('ai_prompt:')) {
        const prompt = option.replace('ai_prompt:', '');
        const newQuery = state.currentQuery ? `${state.currentQuery}，要求：${prompt}` : prompt;
        void state.onGeneratePlan(newQuery);
      } else {
        state.navigateTo('backups');
      }
    },
    [state]
  );

  const handleSelectBackup = useCallback(
    (newPlan: Plan | null) => {
      if (newPlan) {
        state.updatePlan(newPlan);
        state.setScreen('itinerary');
        state.setScreenStack(['home', 'itinerary']);
      }
    },
    [state]
  );

  const handleStartCollaboration = useCallback(async () => {
    if (!state.plan) return;
    // 尝试创建 share，失败也不阻塞
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: state.plan,
          profiles: state.profiles || [],
          taskState: state.currentTaskState,
        }),
      });
      if (res.ok) {
        const { shareSlug } = await res.json();
        if (shareSlug) state.setShareSlug(shareSlug);
      }
    } catch (err) {
      console.warn('[handleStartCollaboration] Share API failed, continuing without slug:', err);
    }
    state.navigateToScreen('collaborate');
  }, [state]);

  // ── Story / Record ──
  const handleGenerateStory = useCallback(
    (template: string) => {
      if (state.plan?.id) {
        state.upsertTaskState(state.plan.id, (prev) => ({
          planId: state.plan!.id,
          status: 'completed',
          selectedActivityIds: prev?.selectedActivityIds ?? [],
          bookedActivityIds: prev?.bookedActivityIds ?? [],
          bookedVariants: prev?.bookedVariants ?? [],
          completedActivityIds: state.plan!.activities?.map((a) => a.id) ?? [],
          lastUpdatedAt: Date.now(),
        }));
        state.setStoryTemplate(template);
        state.navigateTo('story');
      }
    },
    [state]
  );

  const handleRecordChange = useCallback(
    (ids: Set<string>) => {
      if (!state.plan) {
        console.warn('[handleRecordChange] No plan available');
        return;
      }
      state.markActivitiesAsCompleted(state.plan.id, Array.from(ids));
    },
    [state.plan, state.markActivitiesAsCompleted]
  );

  const handleShareComplete = useCallback(() => {
    if (state.plan?.id) {
      state.upsertTaskState(state.plan.id, (prev) => ({
        planId: state.plan!.id,
        status: prev?.completedActivityIds?.length
          ? 'completed'
          : prev?.bookedActivityIds?.length
            ? 'booked'
            : prev?.selectedActivityIds?.length
              ? 'selected'
              : 'planned',
        selectedActivityIds: prev?.selectedActivityIds ?? [],
        bookedActivityIds: prev?.bookedActivityIds ?? [],
        bookedVariants: prev?.bookedVariants ?? [],
        completedActivityIds: prev?.completedActivityIds ?? [],
        lastUpdatedAt: Date.now(),
      }));
      state.navigateToScreen('home');
    }
  }, [state]);

  const handleMemoriesStory = handleViewStory;

  return {
    handleOpenExplore,
    handleOpenProfile,
    handleConsumeStartNewTaskSignal,
    handleExploreBack,
    handleProfileBack,
    handleOrdersBack,
    handleViewActivity,
    handleViewItinerary,
    handleChecklist,
    handleSavePlan,
    handleViewDetails,
    handlePlanAgain,
    handleAdjustPlan,
    handleRecord,
    handleViewStory,
    handleOverviewConfirm,
    handleOverviewShare,
    handleOverviewDetails,
    handleOpenRestaurantFinder,
    handleOpenServiceFinder,
    handleOpenTaxiFinder,
    handleServiceFinderSelect,
    handleCreatePost,
    handleInspire,
    handlePostSelect,
    handleContinueTask,
    handleStartNewTask,
    handleItineraryProceedPayment,
    handleItineraryActivityClick,
    handleItineraryShare,
    handleUpdateCopilotMessages,
    handlePaymentBack,
    handlePaymentSuccess,
    handleSuccessBackToItinerary,
    handleSuccessViewOrders,
    handleSuccessShare,
    handleCancelOrder,
    handleRequestRefund,
    handleSelectOption,
    handleSelectBackup,
    handleStartCollaboration,
    handleGenerateStory,
    handleRecordChange,
    handleShareComplete,
    handleMemoriesStory,
  };
}
