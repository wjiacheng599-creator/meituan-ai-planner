import type { AgentResult } from '../../src/services/agent';
import type { Activity, AIStoryContent, Plan } from '../../src/services/ai';
import type { PersonProfile, PlannerTaskState } from '../../src/types';

export interface ServerUser {
  id: string;
  isAnonymous: boolean;
  createdAt: number;
}

export interface ServerSessionRecord {
  id: string;
  userId: string;
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

export interface PersistedPlanRecord {
  id: string;
  userId: string;
  sessionId: string;
  sourceQuery: string;
  createdAt: number;
  updatedAt: number;
  plan: Plan;
}

export interface PersistedExecutionRun {
  id: string;
  planId: string;
  userId: string;
  activityIds: string[];
  createdAt: number;
  result: AgentResult;
}

export interface PersistedStoryRecord {
  id: string;
  planId: string;
  userId: string;
  story: AIStoryContent & {
    template?: string;
    generatedAt?: number;
    updatedAt?: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface PersistedShareRecord {
  id: string;
  shareSlug: string;
  planId: string;
  userId: string;
  shareTitle: string;
  shareSummary?: string;
  createdAt: number;
  snapshot: {
    plan: Plan;
    profiles: Array<{ id?: string; name: string }>;
    taskState?: PlannerTaskState | null;
  };
}

export interface PersistedPaymentRecord {
  id: string;
  userId: string;
  transactionId: string;
  amount: number;
  method: 'meituan' | 'wechat' | 'alipay';
  orderTitle: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: number;
  updatedAt: number;
}

// ============================================================
// Raw SQLite row interfaces (no optional fields — rows from DB)
// ============================================================

/** Raw row from the `users` table */
export interface UserRow {
  id: string;
  isAnonymous: number; // SQLite INTEGER → 0/1
  createdAt: number;
}

/** Raw row from the `profiles` table */
export interface ProfileRow {
  id: string;
  userId: string;
  name: string;
  relation: string;
  ageGroup: string;
  dietaryPreferences: string; // JSON string
  travelPreferences: string; // JSON string
  avoidPreferences: string | null;
  budget: string | null;
  mobility: string | null;
  specialNeeds: string | null;
  favoriteActivities: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Raw row from the `sessions` table */
export interface SessionRow {
  id: string;
  userId: string;
  title: string;
  summary: string;
  queryDraft: string;
  status: string;
  updatedAt: number;
  planId: string | null;
  planTitle: string | null;
  planSummary: string | null;
  durationTags: string | null;
  totalPrice: number | null;
  memberCount: number | null;
  selectedProfileIds: string | null;
  timePref: string | null;
  targetType: string | null;
  collabStrategy: string | null;
  tieBreaker: string | null;
  memberVotes: string | null;
  memberAvoids: string | null;
  tempProfiles: string | null;
  messages: string | null;
}

/** Raw row from the `plans` table */
export interface PlanRow {
  id: string;
  userId: string;
  sessionId: string;
  sourceQuery: string;
  plan: string; // JSON string
  createdAt: number;
  updatedAt: number;
}

/** Raw row from the `plannerTaskStates` table */
export interface TaskStateRow {
  planId: string;
  status: string;
  selectedActivityIds: string; // JSON string array
  bookedActivityIds: string; // JSON string array
  bookedVariants?: string; // JSON array of BookedVariant
  completedActivityIds: string; // JSON string array
  lastUpdatedAt: number;
}

/** Raw row from the `executionRuns` table */
export interface ExecutionRunRow {
  id: string;
  planId: string;
  userId: string;
  activityIds: string; // JSON string array
  result: string; // JSON string
  createdAt: number;
}

/** Raw row from the `stories` table */
export interface StoryRow {
  id: string;
  planId: string;
  userId: string;
  story: string; // JSON string
  createdAt: number;
  updatedAt: number;
}

/** Raw row from the `shares` table */
export interface ShareRow {
  id: string;
  shareSlug: string;
  planId: string;
  userId: string;
  shareTitle: string;
  shareSummary: string | null;
  snapshot: string; // JSON string
  createdAt: number;
}

/** Raw row from the `payments` table */
export interface PaymentRow {
  id: string;
  userId: string;
  transactionId: string;
  amount: number;
  method: string;
  orderTitle: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

/** Raw row from the `orders` table */
export interface OrderRow {
  id: string;
  userId: string;
  planId: string;
  activityIds: string;           // JSON array string
  title: string;
  merchantName: string;
  amount: number;
  status: OrderStatus;
  paymentId: string;
  createdAt: number;
  updatedAt: number;
  canceledAt?: number;
  refundReason?: string;
  refundStatus?: RefundStatus;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'refunding'
  | 'refunded';

export type RefundStatus =
  | 'none'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'completed';

export interface DatabaseShape {
  users: ServerUser[];
  profiles: Array<PersonProfile & { userId: string; createdAt: number; updatedAt: number }>;
  sessions: ServerSessionRecord[];
  plans: PersistedPlanRecord[];
  plannerTaskStates: PlannerTaskState[];
  executionRuns: PersistedExecutionRun[];
  stories: PersistedStoryRecord[];
  shares: PersistedShareRecord[];
  payments: PersistedPaymentRecord[];
  orders: OrderRow[];
}

export interface ServerRepository {
  ensureUser(userId?: string): Promise<ServerUser>;
  getBootstrapPayload(userId: string, pagination?: { page: number; limit: number }): Promise<{
    profiles: PersonProfile[];
    sessions: ServerSessionRecord[];
    savedPlans: Plan[];
    plannerTaskStates: PlannerTaskState[];
    total: number;
  }>;
  saveGeneratedPlan(params: {
    userId: string;
    query: string;
    plan: Plan;
    sessionId?: string;
  }): Promise<{
    session: ServerSessionRecord;
    taskState: PlannerTaskState;
  }>;
  upsertPlanRecord(params: {
    userId: string;
    plan: Plan;
    sourceQuery?: string;
    sessionId?: string;
  }): Promise<PersistedPlanRecord>;
  replaceProfiles(params: {
    userId: string;
    profiles: PersonProfile[];
  }): Promise<PersonProfile[]>;
  replaceSessions(params: {
    userId: string;
    sessions: ServerSessionRecord[];
  }): Promise<ServerSessionRecord[]>;
  deleteSession(sessionId: string, userId: string): Promise<boolean>;
  replacePlannerTaskStates(params: {
    taskStates: PlannerTaskState[];
  }): Promise<PlannerTaskState[]>;
  getPlanById(planId: string): Promise<PersistedPlanRecord | null>;
  deletePlan(planId: string): Promise<boolean>;
  saveExecutionRun(params: {
    userId: string;
    planId: string;
    activityIds: string[];
    result: AgentResult;
  }): Promise<PersistedExecutionRun>;
  getExecutionRunById(executionRunId: string): Promise<PersistedExecutionRun | null>;
  getTaskStateByPlanId(planId: string): Promise<PlannerTaskState | null>;
  saveStoryRecord(params: {
    userId: string;
    planId: string;
    story: AIStoryContent & {
      template?: string;
      generatedAt?: number;
      updatedAt?: number;
    };
  }): Promise<PersistedStoryRecord>;
  getStoryRecord(userId: string, planId: string): Promise<PersistedStoryRecord | null>;
  createShareRecord(params: {
    userId: string;
    plan: Plan;
    profiles: Array<{ id?: string; name: string }>;
    taskState?: PlannerTaskState | null;
  }): Promise<PersistedShareRecord>;
  getShareRecord(shareSlug: string): Promise<PersistedShareRecord | null>;
  getShareVotes(shareSlug: string): Promise<Array<{
    id: string; voterName: string; vote: string; suggestion?: string; createdAt: number;
  }>>;
  upsertShareVote(shareSlug: string, voteEntry: {
    id: string; voterName: string; vote: string; suggestion?: string; createdAt: number;
  }): Promise<void>;
  savePaymentRecord(params: {
    userId: string;
    transactionId: string;
    amount: number;
    method: 'meituan' | 'wechat' | 'alipay';
    orderTitle: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
  }): Promise<PersistedPaymentRecord>;
  getPaymentByTransactionId(transactionId: string): Promise<PersistedPaymentRecord | null>;

  // 订单相关方法
  createOrder(order: Omit<OrderRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderRow>;
  getOrderById(id: string): Promise<OrderRow | null>;
  getOrdersByUserId(userId: string, status?: OrderStatus): Promise<OrderRow[]>;
  getOrdersByPlanId(planId: string): Promise<OrderRow[]>;
  updateOrderStatus(id: string, status: OrderStatus): Promise<void>;
  updateOrderRefund(id: string, refundStatus: RefundStatus, reason?: string): Promise<void>;
  cancelOrder(id: string): Promise<void>;
  deleteOrder(id: string): Promise<void>;

  // 用户偏好
  getUserPreferences(userId: string): Promise<{
    favoriteCategories: string[];
    avoidCategories: string[];
    priceRange: { min: number; max: number };
    preferredTime: string;
    dietaryRestrictions: string[];
    recentSearches: string[];
  } | null>;
  upsertUserPreferences(userId: string, prefs: {
    favoriteCategories?: string[];
    avoidCategories?: string[];
    priceRange?: { min: number; max: number };
    preferredTime?: string;
    dietaryRestrictions?: string[];
    recentSearches?: string[];
  }): Promise<void>;

  // 行为事件
  trackBehaviorEvent(event: {
    id: string;
    userId: string;
    type: string;
    planId?: string;
    activityId?: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
  }): Promise<void>;
  getBehaviorEvents(userId: string, options?: {
    type?: string;
    limit?: number;
    since?: number;
  }): Promise<Array<{
    id: string;
    type: string;
    planId: string | null;
    activityId: string | null;
    metadata: Record<string, unknown>;
    timestamp: number;
  }>>;
  getBehaviorStats(userId: string): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    topActivities: Array<{ activityId: string; count: number }>;
  }>;
}

export type ActivityLookup = Map<string, Activity>;
