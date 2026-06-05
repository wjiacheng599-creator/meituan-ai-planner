export interface PersonProfile {
  id: string;
  name: string;
  avatar?: string;
  relation: string;
  ageGroup: string;
  gender?: 'male' | 'female';
  styleTag?: string;
  dietaryPreferences: string[];
  travelPreferences: string[];
  avoidPreferences?: string[];
  budget?: string;
  mobility?: string;
  specialNeeds?: string[];
  favoriteActivities?: string[];
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'refunding'
  | 'refunded';

export interface Order {
  id: string;
  planId: string;
  activityIds: string | string[]; // 兼容 JSON 字符串和数组
  title: string;
  merchantName?: string;
  amount: number;
  status: OrderStatus;
  paymentId?: string;
  createdAt: number;
  updatedAt?: number;
  canceledAt?: number;
  refundReason?: string;
  refundStatus?: string;
}

export interface PaymentIntent {
  id: string;
  planId: string;
  activityIds: string[];
  title: string;
  merchantName: string;
  amount: number;
  serviceCount: number;
  peopleCount: number;
  status: 'pending' | 'paid';
  createdAt: number;
  paymentId?: string;
  orderId?: string;
}

export type VoteOptionId =
  | 'food'
  | 'photo'
  | 'easy'
  | 'dense'
  | 'budget'
  | 'queue'
  | 'child'
  | 'elder';
export type AvoidOptionId = 'spicy' | 'queue' | 'walk' | 'expensive' | 'crowd' | 'late';
export type TieBreakerId =
  | 'easy_over_dense'
  | 'dense_over_easy'
  | 'budget_over_food'
  | 'food_over_budget';

const VALID_TIE_BREAKERS: ReadonlySet<string> = new Set([
  'easy_over_dense',
  'dense_over_easy',
  'budget_over_food',
  'food_over_budget',
]);
const VALID_VOTE_OPTIONS: ReadonlySet<string> = new Set([
  'food',
  'photo',
  'easy',
  'dense',
  'budget',
  'queue',
  'child',
  'elder',
]);
const VALID_AVOID_OPTIONS: ReadonlySet<string> = new Set([
  'spicy',
  'queue',
  'walk',
  'expensive',
  'crowd',
  'late',
]);

export function isTieBreakerId(value: string): value is TieBreakerId {
  return VALID_TIE_BREAKERS.has(value);
}

export function isVoteOptionId(value: string): value is VoteOptionId {
  return VALID_VOTE_OPTIONS.has(value);
}

export function isAvoidOptionId(value: string): value is AvoidOptionId {
  return VALID_AVOID_OPTIONS.has(value);
}

export function narrowMemberVotes(
  raw: Record<string, string[]> | undefined
): Record<string, VoteOptionId[]> | undefined {
  if (!raw) return undefined;
  const result: Record<string, VoteOptionId[]> = {};
  for (const [key, arr] of Object.entries(raw)) {
    const filtered = arr.filter((v): v is VoteOptionId => VALID_VOTE_OPTIONS.has(v));
    if (filtered.length > 0) {
      result[key] = filtered;
    }
  }
  return result;
}

export function narrowMemberAvoids(
  raw: Record<string, string[]> | undefined
): Record<string, AvoidOptionId[]> | undefined {
  if (!raw) return undefined;
  const result: Record<string, AvoidOptionId[]> = {};
  for (const [key, arr] of Object.entries(raw)) {
    const filtered = arr.filter((v): v is AvoidOptionId => VALID_AVOID_OPTIONS.has(v));
    if (filtered.length > 0) {
      result[key] = filtered;
    }
  }
  return result;
}

export interface TaskSession {
  id: string;
  title: string;
  summary: string;
  queryDraft: string;
  updatedAt: number;
  status: 'draft' | 'planning' | 'ready';
  planId?: string;
  planTitle?: string;
  planSummary?: string;
  durationTags?: string;
  totalPrice?: number;
  memberCount?: number;
  selectedProfileIds: string[];
  messages: unknown[];
  timePref?: string;
  targetType?: string;
  collabStrategy?: 'balanced' | 'care' | 'efficient';
  tieBreaker?: TieBreakerId;
  memberVotes?: Record<string, VoteOptionId[]>;
  memberAvoids?: Record<string, AvoidOptionId[]>;
  tempProfiles?: PersonProfile[];
}

export type PlannerTaskStatus =
  | 'draft'
  | 'planned'
  | 'selected'
  | 'executing'
  | 'booked'
  | 'executed'
  | 'completed'
  | 'archived';

export interface BookedVariant {
  activityId: string;
  timeSlot: string;
  ticketName: string;
  bookedAt: number;
}

export interface PlannerTaskState {
  planId: string;
  status: PlannerTaskStatus;
  selectedActivityIds: string[];
  bookedActivityIds: string[];
  bookedVariants: BookedVariant[];
  completedActivityIds: string[];
  lastUpdatedAt: number;
}

export type ExecutionRunStatus = 'idle' | 'running' | 'completed' | 'partial_failed' | 'cancelled';

export interface ExecutionRunCallRecord {
  id: string;
  tool: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  message?: string;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface ExecutionRunRecord {
  id: string;
  planId?: string;
  planTitle: string;
  status: ExecutionRunStatus;
  startedAt: number;
  completedAt?: number;
  total: number;
  successCount: number;
  failCount: number;
  pendingCount: number;
  answer?: string;
  calls: ExecutionRunCallRecord[];
}

export interface PostComment {
  user: string;
  text: string;
  createdAt?: string;
}

export interface Post {
  id: number;
  title: string;
  userName: string;
  avatar?: string;
  image: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaPoster?: string;
  mediaDuration?: string;
  hotCount: number;
  content: string;
  location: string;
  tags: string[];
  comments: PostComment[];
}

export type TravelMode = 'driving' | 'taxi' | 'transit' | 'walking' | 'cycling';

export interface TaxiDispatchRecommendation {
  tier: 'economy' | 'comfort' | 'business' | 'six_seat';
  tierLabel: string;
  reason: string;
  estimatedFare: number;
  estimatedWaitMinutes: number;
  carCount: number;
  passengerSummary: string;
  comfortTags: string[];
}

export interface TransitDetail {
  lineName: string;
  lineType: string;
  stationCount: number;
  startStation: string;
  endStation: string;
  viaStations?: string[];
}

export interface RouteSegment {
  id?: string;
  startActivityId?: string;
  endActivityId?: string;
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  mode: TravelMode;
  distance: number;
  duration: number;
  polyline?: string;
  steps?: string[];
  cost?: number;
  transfers?: number;
  walkingDistance?: number;
  taxi?: TaxiDispatchRecommendation;
  instruction?: string;
  transitDetails?: TransitDetail[];
  isLoopSegment?: boolean;
}

export interface RoutePlanResult {
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  totalCost?: number;
}
