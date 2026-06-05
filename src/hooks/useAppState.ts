/**
 * useAppState - Zustand 兼容层
 *
 * 内部调用 Zustand store，对外保持原有返回接口不变。
 * 派生值（selectedIds / bookedIds / completedPlanIds 等）在此计算。
 */
import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';

export function useAppState() {
  const [pendingBookingVariant, setPendingBookingVariant] = useState<
    { timeSlot: string; ticketName: string } | undefined
  >(undefined);

  // ── 读取 store state ──
  const profiles = useAppStore((s) => s.profiles);
  const setProfiles = useAppStore((s) => s.setProfiles);
  const savedPlans = useAppStore((s) => s.savedPlans);
  const setSavedPlans = useAppStore((s) => s.setSavedPlans);
  const plannerTaskStates = useAppStore((s) => s.plannerTaskStates);
  const setPlannerTaskStates = useAppStore((s) => s.setPlannerTaskStates);
  const taskSessions = useAppStore((s) => s.taskSessions);
  const setTaskSessions = useAppStore((s) => s.setTaskSessions);
  const activeTaskSessionId = useAppStore((s) => s.activeTaskSessionId);
  const setActiveTaskSessionId = useAppStore((s) => s.setActiveTaskSessionId);

  // ── 读取 plan ──
  const plan = useAppStore((s) => s.plan);
  const setPlan = useAppStore((s) => s.setPlan);
  const paymentAmount = useAppStore((s) => s.paymentAmount);
  const setPaymentAmount = useAppStore((s) => s.setPaymentAmount);
  const pendingPaymentIntent = useAppStore((s) => s.pendingPaymentIntent);
  const setPendingPaymentIntent = useAppStore((s) => s.setPendingPaymentIntent);
  const shareSlug = useAppStore((s) => s.shareSlug);
  const setShareSlug = useAppStore((s) => s.setShareSlug);

  // ── 读取 actions ──
  const getTaskStateForPlan = useAppStore((s) => s.getTaskStateForPlan);
  const upsertTaskState = useAppStore((s) => s.upsertTaskState);
  const savePlanLocally = useAppStore((s) => s.savePlanLocally);
  const upsertPlanEverywhere = useAppStore((s) => s.upsertPlanEverywhere);
  const markActivitiesAsBooked = useAppStore((s) => s.markActivitiesAsBooked);
  const markActivitiesAsCompleted = useAppStore((s) => s.markActivitiesAsCompleted);
  const deselectIds = useAppStore((s) => s.deselectIds);
  const toggleSelectedId = useAppStore((s) => s.toggleSelectedId);
  const replaceActivityInPlan = useAppStore((s) => s.replaceActivityInPlan);
  const updatePlan = useAppStore((s) => s.updatePlan);

  // ── 派生值 ──
  const taskStateForPlan = useMemo(
    () => getTaskStateForPlan(plan?.id),
    [getTaskStateForPlan, plan?.id, plannerTaskStates]
  );

  const selectedIds = useMemo(
    () => new Set<string>(taskStateForPlan?.selectedActivityIds || []),
    [taskStateForPlan, plannerTaskStates]
  );

  const bookedIds = useMemo(
    () => new Set<string>(taskStateForPlan?.bookedActivityIds || []),
    [taskStateForPlan, plannerTaskStates]
  );

  const completedPlanIds = useMemo(
    () =>
      new Set<string>(
        plannerTaskStates
          .filter((item) => item.status === 'completed' || item.status === 'archived')
          .map((item) => item.planId)
      ),
    [plannerTaskStates]
  );

  const currentTaskState = taskStateForPlan;

  const currentCompletedIds = useMemo(
    () => new Set(currentTaskState?.completedActivityIds || []),
    [currentTaskState, plannerTaskStates]
  );

  const currentBookedIds = useMemo(
    () => new Set(currentTaskState?.bookedActivityIds || []),
    [currentTaskState, plannerTaskStates]
  );

  return useMemo(
    () => ({
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
      shareSlug,
      setShareSlug,
      plan,
      setPlan,
      paymentAmount,
      setPaymentAmount,
      pendingPaymentIntent,
      setPendingPaymentIntent,
      getTaskStateForPlan,
      upsertTaskState,
      taskStateForPlan,
      selectedIds,
      bookedIds,
      completedPlanIds,
      currentTaskState,
      currentCompletedIds,
      currentBookedIds,
      savePlanLocally,
      upsertPlanEverywhere,
      markActivitiesAsBooked,
      markActivitiesAsCompleted,
      deselectIds,
      toggleSelectedId,
      replaceActivityInPlan,
      updatePlan,
      pendingBookingVariant,
      setPendingBookingVariant,
    }),
    [
      profiles,
      savedPlans,
      plannerTaskStates,
      taskSessions,
      activeTaskSessionId,
      shareSlug,
      plan,
      paymentAmount,
      pendingPaymentIntent,
      taskStateForPlan,
      selectedIds,
      bookedIds,
      completedPlanIds,
      currentTaskState,
      currentCompletedIds,
      currentBookedIds,
      pendingBookingVariant,
    ]
  );
}
