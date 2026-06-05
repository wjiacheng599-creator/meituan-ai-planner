import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Activity } from '../services/ai/types';
import type {
  PersonProfile as Profile,
  TravelMode,
  PlannerTaskState as PlannerTaskStateType,
  TaskSession as TaskSessionType,
  Order,
  OrderStatus,
  ExecutionRunRecord,
  PaymentIntent,
} from '../types';
import type { CopilotMessage } from '../services/ai';

export type PlannerTaskState = PlannerTaskStateType;
export type TaskSession = TaskSessionType;
export type { Order, OrderStatus };

interface ItineraryState {
  streamingActivities: Activity[];
  isStreaming: boolean;
  copilotMessages: CopilotMessage[];
  changeHistory: string[];
}

interface Preferences {
  theme: 'light' | 'dark';
  language: string;
  metric: 'km' | 'mi';
}

interface AppState {
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;

  profiles: Profile[];
  setProfiles: (profiles: Profile[] | ((prev: Profile[]) => Profile[])) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  removeProfile: (id: string) => void;

  savedPlans: Plan[];
  setSavedPlans: (plans: Plan[] | ((prev: Plan[]) => Plan[])) => void;

  activeTaskSessionId: string | null;
  setActiveTaskSessionId: (id: string | null) => void;

  taskSessions: TaskSession[];
  setTaskSessions: (sessions: TaskSession[] | ((prev: TaskSession[]) => TaskSession[])) => void;

  plannerTaskStates: PlannerTaskState[];
  setPlannerTaskStates: (
    states: PlannerTaskState[] | ((prev: PlannerTaskState[]) => PlannerTaskState[])
  ) => void;

  orders: Order[];
  setOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  executionRuns: ExecutionRunRecord[];
  setExecutionRuns: (
    runs: ExecutionRunRecord[] | ((prev: ExecutionRunRecord[]) => ExecutionRunRecord[])
  ) => void;
  upsertExecutionRun: (run: ExecutionRunRecord) => void;
  getLatestExecutionRunForPlan: (planId?: string | null) => ExecutionRunRecord | null;

  travelMode: TravelMode;
  setTravelMode: (mode: TravelMode) => void;

  recentCardKeys: string[];
  addRecentCardKeys: (keys: string[]) => void;

  currentSession: TaskSession | null;
  setCurrentSession: (session: TaskSession | null) => void;

  itinerary: ItineraryState;
  addStreamingActivity: (activity: Activity) => void;
  addCopilotMessage: (message: CopilotMessage) => void;
  clearCopilotMessages: () => void;
  setIsStreaming: (isStreaming: boolean) => void;
  resetItinerary: () => void;
  addChangeHistory: (type: string, description: string) => void;

  preferences: Preferences;
  setPreferences: (preferences: Partial<Preferences>) => void;

  getTaskStateForPlan: (planId?: string | null) => PlannerTaskState | null;
  upsertTaskState: (
    planId: string,
    updater: (prev: PlannerTaskState | null) => PlannerTaskState
  ) => void;

  savePlanLocally: (nextPlan: Plan) => void;
  upsertPlanEverywhere: (plan: Plan, options?: { sourceQuery?: string }) => void;
  replaceActivityInPlan: (planId: string, activityId: string, newActivity: Activity) => void;
  markActivitiesAsBooked: (
    planId: string,
    activityIds: string[],
    variant?: { timeSlot: string; ticketName: string }
  ) => void;
  markActivitiesAsCompleted: (planId: string, activityIds: string[]) => void;
  toggleSelectedId: (id: string) => void;
  deselectIds: (planId: string, ids: string[]) => void;
  updatePlan: (plan: Plan) => void;

  plan: Plan | null;
  setPlan: (plan: Plan | null) => void;

  paymentAmount: number;
  setPaymentAmount: (amount: number) => void;
  pendingPaymentIntent: PaymentIntent | null;
  setPendingPaymentIntent: (
    intent: PaymentIntent | null | ((prev: PaymentIntent | null) => PaymentIntent | null)
  ) => void;

  shareSlug: string;
  setShareSlug: (slug: string) => void;

  clearAll: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingCompleted: false,
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),

      profiles: [],
      setProfiles: (profiles) =>
        set((state) => ({
          profiles: typeof profiles === 'function' ? profiles(state.profiles) : profiles,
        })),
      addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
      updateProfile: (id, updates) =>
        set((state) => ({
          profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removeProfile: (id) =>
        set((state) => ({ profiles: state.profiles.filter((p) => p.id !== id) })),

      savedPlans: [],
      setSavedPlans: (savedPlans) =>
        set((state) => ({
          savedPlans: typeof savedPlans === 'function' ? savedPlans(state.savedPlans) : savedPlans,
        })),

      plannerTaskStates: [],
      setPlannerTaskStates: (plannerTaskStates) =>
        set((state) => ({
          plannerTaskStates:
            typeof plannerTaskStates === 'function'
              ? plannerTaskStates(state.plannerTaskStates)
              : plannerTaskStates,
        })),

      taskSessions: [],
      setTaskSessions: (taskSessions) =>
        set((state) => ({
          taskSessions:
            typeof taskSessions === 'function' ? taskSessions(state.taskSessions) : taskSessions,
        })),

      orders: [],
      setOrders: (orders) =>
        set((state) => ({
          orders: typeof orders === 'function' ? orders(state.orders) : orders,
        })),
      addOrder: (order) =>
        set((state) => ({
          orders: [...state.orders, order],
        })),
      updateOrderStatus: (orderId, status) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId ? { ...o, status, updatedAt: Date.now() } : o
          ),
        })),

      executionRuns: [],
      setExecutionRuns: (executionRuns) =>
        set((state) => ({
          executionRuns:
            typeof executionRuns === 'function'
              ? executionRuns(state.executionRuns)
              : executionRuns,
        })),
      upsertExecutionRun: (run) =>
        set((state) => {
          const withoutCurrent = state.executionRuns.filter((item) => item.id !== run.id);
          return { executionRuns: [run, ...withoutCurrent].slice(0, 20) };
        }),
      getLatestExecutionRunForPlan: (planId) => {
        if (!planId) return null;
        return get().executionRuns.find((item) => item.planId === planId) || null;
      },

      activeTaskSessionId: null,
      setActiveTaskSessionId: (activeTaskSessionId) => set({ activeTaskSessionId }),

      travelMode: 'walking',
      setTravelMode: (travelMode) => set({ travelMode }),

      recentCardKeys: [],
      addRecentCardKeys: (keys) =>
        set((state) => {
          const combined = [...keys, ...state.recentCardKeys];
          const unique = [...new Set(combined)].slice(0, 20);
          return { recentCardKeys: unique };
        }),

      currentSession: null,
      setCurrentSession: (currentSession) => set({ currentSession }),

      itinerary: {
        streamingActivities: [],
        isStreaming: false,
        copilotMessages: [],
        changeHistory: [],
      },
      addStreamingActivity: (activity) =>
        set((state) => ({
          itinerary: {
            ...state.itinerary,
            streamingActivities: [...state.itinerary.streamingActivities, activity],
          },
        })),
      addCopilotMessage: (message) =>
        set((state) => ({
          itinerary: {
            ...state.itinerary,
            copilotMessages: [...state.itinerary.copilotMessages, message],
          },
        })),
      clearCopilotMessages: () =>
        set((state) => ({
          itinerary: {
            ...state.itinerary,
            copilotMessages: [],
          },
        })),
      setIsStreaming: (isStreaming) =>
        set((state) => ({
          itinerary: {
            ...state.itinerary,
            isStreaming,
          },
        })),
      resetItinerary: () =>
        set({
          itinerary: {
            streamingActivities: [],
            isStreaming: false,
            copilotMessages: [],
            changeHistory: [],
          },
        }),
      addChangeHistory: (type, description) =>
        set((state) => ({
          itinerary: {
            ...state.itinerary,
            changeHistory: [...state.itinerary.changeHistory, `${type}: ${description}`],
          },
        })),

      preferences: {
        theme: 'light',
        language: 'zh-CN',
        metric: 'km',
      },
      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      plan: null,
      setPlan: (plan) => set({ plan }),
      paymentAmount: 0,
      setPaymentAmount: (amount) => set({ paymentAmount: amount }),
      pendingPaymentIntent: null,
      setPendingPaymentIntent: (intent) =>
        set((state) => ({
          pendingPaymentIntent:
            typeof intent === 'function' ? intent(state.pendingPaymentIntent) : intent,
        })),

      shareSlug: '',
      setShareSlug: (shareSlug) => set({ shareSlug }),

      getTaskStateForPlan: (planId) => {
        if (!planId) return null;
        return get().plannerTaskStates.find((item) => item.planId === planId) || null;
      },

      upsertTaskState: (planId, updater) => {
        set((state) => {
          const current = state.plannerTaskStates.find((item) => item.planId === planId) || null;
          const next = updater(current);
          const others = state.plannerTaskStates.filter((item) => item.planId !== planId);
          return { plannerTaskStates: [next, ...others] };
        });
      },

      savePlanLocally: (nextPlan) => {
        set((state) => {
          const safePlans = Array.isArray(state.savedPlans) ? state.savedPlans : [];
          const idx = safePlans.findIndex((p) => p.id === nextPlan.id);
          let newSavedPlans: Plan[];
          if (idx >= 0) {
            newSavedPlans = [...safePlans];
            newSavedPlans[idx] = nextPlan;
          } else {
            newSavedPlans = [nextPlan, ...safePlans];
          }
          return { savedPlans: newSavedPlans };
        });
      },

      upsertPlanEverywhere: (plan: Plan, options?: { sourceQuery?: string }) => {
        const planId = plan.id;
        let updatedPlan = plan;

        if (options?.sourceQuery) {
          updatedPlan = { ...plan, sourceQuery: options.sourceQuery };
        }

        set((state) => {
          let nextPlan = state.plan;
          let nextSavedPlans = Array.isArray(state.savedPlans) ? state.savedPlans : [];

          if (state.plan?.id === planId) {
            nextPlan = updatedPlan;
          }

          const idx = nextSavedPlans.findIndex((p) => p.id === planId);
          if (idx >= 0) {
            nextSavedPlans = [...nextSavedPlans];
            nextSavedPlans[idx] = updatedPlan;
          } else {
            nextSavedPlans = [updatedPlan, ...nextSavedPlans];
          }

          return { plan: nextPlan, savedPlans: nextSavedPlans };
        });
      },

      replaceActivityInPlan: (planId, activityId, newActivity) => {
        set((state) => {
          const safePlans = Array.isArray(state.savedPlans) ? state.savedPlans : [];
          const target =
            state.plan?.id === planId ? state.plan : safePlans.find((p) => p.id === planId);
          if (!target) return {};
          const replaceInList = (list: typeof target.activities) =>
            list.map((a) => (a.id === activityId ? newActivity : a));
          const updated = {
            ...target,
            activities: replaceInList(target.activities),
            budgetOptions: target.budgetOptions?.map((opt) => ({
              ...opt,
              activities: opt.activities ? replaceInList(opt.activities) : opt.activities,
            })),
          };
          let nextPlan = state.plan;
          let nextSavedPlans = safePlans;
          if (state.plan?.id === planId) {
            nextPlan = updated;
          }
          const idx = nextSavedPlans.findIndex((p) => p.id === planId);
          if (idx >= 0) {
            nextSavedPlans = [...nextSavedPlans];
            nextSavedPlans[idx] = updated;
          }
          return { plan: nextPlan, savedPlans: nextSavedPlans };
        });
      },

      markActivitiesAsBooked: (planId, activityIds, variant) => {
        if (!activityIds || !Array.isArray(activityIds)) {
          console.warn('[markActivitiesAsBooked] Invalid activityIds:', activityIds);
          return;
        }
        get().upsertTaskState(planId, (prev) => {
          const booked = new Set(prev?.bookedActivityIds || []);
          activityIds.forEach((id) => booked.add(id));
          const bookedVariants = [...(prev?.bookedVariants || [])];
          if (variant && activityIds.length === 1) {
            const exists = bookedVariants.some(
              (v) =>
                v.activityId === activityIds[0] &&
                v.timeSlot === variant.timeSlot &&
                v.ticketName === variant.ticketName
            );
            if (!exists) {
              bookedVariants.push({
                activityId: activityIds[0],
                timeSlot: variant.timeSlot,
                ticketName: variant.ticketName,
                bookedAt: Date.now(),
              });
            }
          }
          const prevStatus = prev?.status;
          const newStatus: 'planned' | 'selected' | 'booked' | 'completed' | 'archived' =
            prevStatus === 'completed' || prevStatus === 'archived'
              ? prevStatus
              : booked.size > 0
                ? 'booked'
                : 'planned';
          return {
            planId,
            status: newStatus,
            selectedActivityIds: prev?.selectedActivityIds || [],
            bookedActivityIds: Array.from(booked),
            bookedVariants,
            completedActivityIds: prev?.completedActivityIds || [],
            lastUpdatedAt: Date.now(),
          };
        });
      },

      markActivitiesAsCompleted: (planId, activityIds) => {
        if (!activityIds || !Array.isArray(activityIds)) {
          console.warn('[markActivitiesAsCompleted] Invalid activityIds:', activityIds);
          return;
        }
        get().upsertTaskState(planId, (prev) => {
          const completed = new Set(prev?.completedActivityIds || []);
          activityIds.forEach((id) => completed.add(id));
          const booked = prev?.bookedActivityIds || [];
          const newStatus: 'planned' | 'selected' | 'booked' | 'completed' | 'archived' =
            completed.size > 0 ? 'completed' : booked.length > 0 ? 'booked' : 'planned';
          return {
            planId,
            status: newStatus,
            selectedActivityIds: prev?.selectedActivityIds || [],
            bookedActivityIds: booked,
            bookedVariants: prev?.bookedVariants || [],
            completedActivityIds: Array.from(completed),
            lastUpdatedAt: Date.now(),
          };
        });
      },

      toggleSelectedId: (id) => {
        if (!id) return;
        const currentPlan = get().plan;
        const planId = currentPlan?.id;
        if (!currentPlan || !planId) return;

        get().upsertTaskState(planId, (prev) => {
          const selected = new Set(prev?.selectedActivityIds || []);
          if (selected.has(id)) selected.delete(id);
          else selected.add(id);
          const booked = prev?.bookedActivityIds || [];
          const newStatus: 'planned' | 'selected' | 'booked' =
            selected.size > 0 ? 'selected' : booked.length > 0 ? 'booked' : 'planned';
          return {
            planId,
            status: newStatus,
            selectedActivityIds: Array.from(selected),
            bookedActivityIds: booked,
            bookedVariants: prev?.bookedVariants || [],
            completedActivityIds: prev?.completedActivityIds || [],
            lastUpdatedAt: Date.now(),
          };
        });
      },

      deselectIds: (planId, ids) => {
        if (!ids || !Array.isArray(ids)) return;
        get().upsertTaskState(planId, (prev) => {
          const selected = new Set(prev?.selectedActivityIds || []);
          ids.forEach((id) => selected.delete(id));
          const booked = prev?.bookedActivityIds || [];
          const newStatus: 'planned' | 'selected' | 'booked' =
            selected.size > 0 ? 'selected' : booked.length > 0 ? 'booked' : 'planned';
          return {
            planId,
            status: newStatus,
            selectedActivityIds: Array.from(selected),
            bookedActivityIds: booked,
            bookedVariants: prev?.bookedVariants || [],
            completedActivityIds: prev?.completedActivityIds || [],
            lastUpdatedAt: Date.now(),
          };
        });
      },

      updatePlan: (plan) => {
        set((state) => {
          const safePlans = Array.isArray(state.savedPlans) ? state.savedPlans : [];
          const idx = safePlans.findIndex((p) => p.id === plan.id);
          let newSavedPlans: Plan[];
          if (idx >= 0) {
            newSavedPlans = [...safePlans];
            newSavedPlans[idx] = plan;
          } else {
            newSavedPlans = [plan, ...safePlans];
          }
          return { plan, savedPlans: newSavedPlans };
        });
      },

      clearAll: () => {
        set({
          onboardingCompleted: false,
          profiles: [],
          savedPlans: [],
          activeTaskSessionId: null,
          taskSessions: [],
          plannerTaskStates: [],
          executionRuns: [],
          plan: null,
          paymentAmount: 0,
          pendingPaymentIntent: null,
          shareSlug: '',
          travelMode: 'walking',
          currentSession: null,
          itinerary: {
            streamingActivities: [],
            isStreaming: false,
            copilotMessages: [],
            changeHistory: [],
          },
          preferences: {
            theme: 'light',
            language: 'zh-CN',
            metric: 'km',
          },
        });
        Object.keys(localStorage)
          .filter((k) => k.startsWith('meituan_planner_reset_v2_'))
          .forEach((k) => localStorage.removeItem(k));
      },
    }),
    {
      name: 'meituan-planner-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          // 旧版本数据可能损坏，重置为初始值
          return {
            ...(persistedState as Record<string, unknown>),
            savedPlans: [],
            profiles: [],
            plannerTaskStates: [],
            taskSessions: [],
            orders: [],
          };
        }
        return persistedState;
      },
      // Only persist selected parts of the state
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        profiles: state.profiles,
        savedPlans: state.savedPlans,
        plannerTaskStates: state.plannerTaskStates,
        executionRuns: state.executionRuns,
        taskSessions: state.taskSessions,
        activeTaskSessionId: state.activeTaskSessionId,
        orders: state.orders,
        recentCardKeys: state.recentCardKeys,
        pendingPaymentIntent: state.pendingPaymentIntent,
      }),
      // Custom serialization to handle Map and Set
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.plannerTaskStates)) {
          state.plannerTaskStates = state.plannerTaskStates.map((s) => ({ ...s }));
        } else {
          state.plannerTaskStates = [];
        }
        if (Array.isArray(state.taskSessions)) {
          state.taskSessions = state.taskSessions.map((s) => ({ ...s }));
        } else {
          state.taskSessions = [];
        }
        if (Array.isArray(state.savedPlans)) {
          state.savedPlans = state.savedPlans.map((p) => ({ ...p }));
        } else {
          state.savedPlans = [];
        }
        if (Array.isArray(state.profiles)) {
          state.profiles = state.profiles.map((p) => ({ ...p }));
        } else {
          state.profiles = [];
        }
        if (Array.isArray(state.orders)) {
          state.orders = state.orders.map((o) => ({ ...o }));
        } else {
          state.orders = [];
        }
        if (Array.isArray(state.executionRuns)) {
          state.executionRuns = state.executionRuns.map((run) => ({
            ...run,
            calls: Array.isArray(run.calls) ? run.calls.map((call) => ({ ...call })) : [],
          }));
        } else {
          state.executionRuns = [];
        }
      },
    }
  )
);
