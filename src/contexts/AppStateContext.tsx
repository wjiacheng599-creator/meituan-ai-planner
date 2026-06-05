/**
 * AppStateContext - React Context for shared application state
 *
 * This eliminates the need to pass 40+ individual props through AppRouter.
 * Components can now consume this context directly.
 */
import { createContext, useContext, useMemo } from 'react';
import type { Activity, CopilotMessage, Plan } from '../services/ai';
import type { PersonProfile, PlannerTaskState, TaskSession, Post, PaymentIntent } from '../types';
import type { ScreenId } from '../config/screens';
import type {
  RestaurantCardData,
  DeliveryCardData,
  TicketCardData,
  CouponCardData,
} from '../components/cards/ServiceCards';
import type { TaxiCardData } from '../components/cards/TaxiCard';

type ServiceFinderMode = 'delivery' | 'ticket' | 'coupon';

// Navigation state (from useScreenNavigation)
export interface NavigationState {
  screen: ScreenId;
  screenStack: ScreenId[];
  setScreen: (screen: ScreenId) => void;
  setScreenStack: (stack: ScreenId[] | ((prev: ScreenId[]) => ScreenId[])) => void;
  navigateTo: (screen: ScreenId) => void;
  goBack: () => void;
  navigateToScreen: (screen: ScreenId) => void;
}

// Plan & Activity state
export interface PlanActivityState {
  plan: Plan | null;
  setPlan: (plan: Plan | null | ((prev: Plan | null) => Plan | null)) => void;
  currentQuery: string;
  selectedActivity: Activity | null;
  setSelectedActivity: (a: Activity | null) => void;
  selectedPost: Post | null;
  setSelectedPost: (p: Post | null) => void;
  pendingBookingVariant?: { timeSlot: string; ticketName: string };
}

// User & App State (from useAppState)
export interface UserAppState {
  profiles: PersonProfile[];
  setProfiles: (profiles: PersonProfile[] | ((prev: PersonProfile[]) => PersonProfile[])) => void;
  savedPlans: Plan[];
  plannerTaskStates: PlannerTaskState[];
  setPlannerTaskStates: (
    states: PlannerTaskState[] | ((prev: PlannerTaskState[]) => PlannerTaskState[])
  ) => void;
  taskSessions: TaskSession[];
  activeTaskSessionId: string | null;
  setTaskSessions: (s: TaskSession[] | ((prev: TaskSession[]) => TaskSession[])) => void;
  setActiveTaskSessionId: (id: string | null) => void;
  shareSlug: string;
  setShareSlug: (slug: string) => void;
  taskStateForPlan: PlannerTaskState | null;
  paymentAmount: number;
  setPaymentAmount: (amount: number) => void;
  pendingPaymentIntent: PaymentIntent | null;
  setPendingPaymentIntent: (
    intent: PaymentIntent | null | ((prev: PaymentIntent | null) => PaymentIntent | null)
  ) => void;
}

// Community state
export interface CommunityState {
  communityPosts: Post[];
  setCommunityPosts: (p: Post[] | ((prev: Post[]) => Post[])) => void;
}

// Finder state
export interface FinderState {
  restaurantFinderItems: RestaurantCardData[];
  setRestaurantFinderItems: (
    items: RestaurantCardData[] | ((prev: RestaurantCardData[]) => RestaurantCardData[])
  ) => void;
  restaurantFinderKeyword: string;
  setRestaurantFinderKeyword: (kw: string) => void;
  serviceFinderMode: ServiceFinderMode;
  setServiceFinderMode: (mode: ServiceFinderMode) => void;
  serviceFinderKeyword: string;
  setServiceFinderKeyword: (kw: string) => void;
  serviceFinderItems: DeliveryCardData[] | TicketCardData[] | CouponCardData[];
  setServiceFinderItems: (
    items:
      | DeliveryCardData[]
      | TicketCardData[]
      | CouponCardData[]
      | ((
          prev: DeliveryCardData[] | TicketCardData[] | CouponCardData[]
        ) => DeliveryCardData[] | TicketCardData[] | CouponCardData[])
  ) => void;
  finderCity: string;
  taxiFinderData: TaxiCardData | null;
  setTaxiFinderData: (
    data: TaxiCardData | null | ((prev: TaxiCardData | null) => TaxiCardData | null)
  ) => void;
  notifyTaxiBookingComplete: (data: TaxiCardData) => void;
  consumeTaxiBookingResult: () => { data: TaxiCardData } | null;
}

// UI signals
export interface UISignals {
  homeStartNewTaskSignal: number;
  setHomeStartNewTaskSignal: (n: number | ((prev: number) => number)) => void;
  storyTemplate: string;
  setStoryTemplate: (t: string) => void;
}

// Copilot
export interface CopilotState {
  copilotMessagesByPlan: Record<string, CopilotMessage[]>;
  setCopilotMessagesByPlan: (
    v:
      | Record<string, CopilotMessage[]>
      | ((prev: Record<string, CopilotMessage[]>) => Record<string, CopilotMessage[]>)
  ) => void;
}

// Task State derived values
export interface TaskStateDerived {
  selectedIds: Set<string>;
  bookedIds: Set<string>;
  completedPlanIds: Set<string>;
  currentTaskState: PlannerTaskState | null;
  currentCompletedIds: Set<string>;
  currentBookedIds: Set<string>;
}

// Actions
export interface AppActions {
  upsertTaskState: (
    planId: string,
    updater: (prev: PlannerTaskState | null) => PlannerTaskState
  ) => void;
  upsertPlanEverywhere: (plan: Plan, options?: { sourceQuery?: string }) => void;
  markActivitiesAsBooked: (
    planId: string,
    ids: string[],
    variant?: { timeSlot: string; ticketName: string }
  ) => void;
  setPendingBookingVariant: (variant: { timeSlot: string; ticketName: string } | undefined) => void;
  markActivitiesAsCompleted: (planId: string, ids: string[]) => void;
  deselectIds: (planId: string, ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  replaceActivityInPlan: (planId: string, activityId: string, newActivity: Activity) => void;
  updatePlan: (plan: Plan) => void;
  openRestaurantDetail: (item: RestaurantCardData) => void;
  openServiceActivityDetail: (item: TicketCardData) => void;
  openServiceDeliveryDetail: (item: DeliveryCardData) => void;
}

// Combined AppState type - matches what useAppState and useServiceItemFlow return
export interface AppState
  extends
    NavigationState,
    PlanActivityState,
    UserAppState,
    CommunityState,
    FinderState,
    UISignals,
    CopilotState,
    TaskStateDerived,
    AppActions {
  onGeneratePlan: (query: string) => Promise<void>;
  onCancelPlan?: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

interface AppStateProviderProps {
  children: React.ReactNode;
  state: AppState;
}

export function AppStateProvider({ children, state }: AppStateProviderProps) {
  // Memoize the value to prevent unnecessary re-renders
  const value = useMemo(() => state, [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppStateContext(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppStateContext must be used within AppStateProvider');
  }
  return ctx;
}
