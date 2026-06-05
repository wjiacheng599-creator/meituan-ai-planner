/**
 * [PERF-OPT] Resilient Repository with Circuit Breaker fallback
 * Uses SQLite as primary, JSON as fallback when circuit is tripped
 */
import { JsonServerRepository } from './jsonRepository';
import { SqliteRepository } from './sqliteRepository';
import { CircuitBreaker } from './circuitBreaker';
import type { AgentResult } from '../../src/services/agent';
import type { AIStoryContent, Plan } from '../../src/services/ai';
import type { PersonProfile, PlannerTaskState } from '../../src/types';
import type {
  PersistedExecutionRun,
  PersistedPaymentRecord,
  PersistedPlanRecord,
  PersistedShareRecord,
  PersistedStoryRecord,
  ServerRepository,
  ServerSessionRecord,
  ServerUser,
  OrderRow,
  OrderStatus,
  RefundStatus,
} from './types';

export class ResilientRepository implements ServerRepository {
  private primary: SqliteRepository;
  private fallback: JsonServerRepository;
  private breaker: CircuitBreaker;

  constructor() {
    this.primary = new SqliteRepository();
    this.fallback = new JsonServerRepository();
    this.breaker = new CircuitBreaker(3, 30000); // Trip after 3 failures, 30s cooldown
  }

  private async withFallback<T>(
    operation: 'read' | 'write',
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>
  ): Promise<T> {
    // [PERF-OPT] If circuit is tripped, use fallback directly
    if (this.breaker.isTripped) {
      console.warn('[ResilientRepo] Circuit tripped, using fallback');
      return fallbackFn();
    }

    try {
      const result = await primaryFn();
      this.breaker.recordSuccess();
      return result;
    } catch (e) {
      this.breaker.recordFailure();
      console.warn(`[ResilientRepo] Primary failed, using fallback: ${e}`);
      return fallbackFn();
    }
  }

  async ensureUser(userId?: string): Promise<ServerUser> {
    return this.withFallback(
      'read',
      () => this.primary.ensureUser(userId),
      () => this.fallback.ensureUser(userId)
    );
  }

  async getBootstrapPayload(userId: string, pagination?: { page: number; limit: number }) {
    return this.withFallback(
      'read',
      () => this.primary.getBootstrapPayload(userId, pagination),
      () => this.fallback.getBootstrapPayload(userId, pagination)
    );
  }

  async saveGeneratedPlan(params: {
    userId: string;
    query: string;
    plan: Plan;
    sessionId?: string;
  }): Promise<{ session: ServerSessionRecord; taskState: PlannerTaskState }> {
    return this.withFallback(
      'write',
      () => this.primary.saveGeneratedPlan(params),
      () => this.fallback.saveGeneratedPlan(params)
    );
  }

  async upsertPlanRecord(params: {
    userId: string;
    plan: Plan;
    sourceQuery?: string;
    sessionId?: string;
  }): Promise<PersistedPlanRecord> {
    return this.withFallback(
      'write',
      () => this.primary.upsertPlanRecord(params),
      () => this.fallback.upsertPlanRecord(params)
    );
  }

  async replaceProfiles(params: {
    userId: string;
    profiles: PersonProfile[];
  }): Promise<PersonProfile[]> {
    return this.withFallback(
      'write',
      () => this.primary.replaceProfiles(params),
      () => this.fallback.replaceProfiles(params)
    );
  }

  async replaceSessions(params: {
    userId: string;
    sessions: ServerSessionRecord[];
  }): Promise<ServerSessionRecord[]> {
    return this.withFallback(
      'write',
      () => this.primary.replaceSessions(params),
      () => this.fallback.replaceSessions(params)
    );
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    return this.withFallback(
      'write',
      () => this.primary.deleteSession(sessionId, userId),
      () => this.fallback.deleteSession(sessionId, userId)
    );
  }

  async replacePlannerTaskStates(params: {
    taskStates: PlannerTaskState[];
  }): Promise<PlannerTaskState[]> {
    return this.withFallback(
      'write',
      () => this.primary.replacePlannerTaskStates(params),
      () => this.fallback.replacePlannerTaskStates(params)
    );
  }

  async getPlanById(planId: string): Promise<PersistedPlanRecord | null> {
    return this.withFallback(
      'read',
      () => this.primary.getPlanById(planId),
      () => this.fallback.getPlanById(planId)
    );
  }

  async saveExecutionRun(params: {
    userId: string;
    planId: string;
    activityIds: string[];
    result: AgentResult;
  }): Promise<PersistedExecutionRun> {
    return this.withFallback(
      'write',
      () => this.primary.saveExecutionRun(params),
      () => this.fallback.saveExecutionRun(params)
    );
  }

  async getExecutionRunById(executionRunId: string): Promise<PersistedExecutionRun | null> {
    return this.withFallback(
      'read',
      () => this.primary.getExecutionRunById(executionRunId),
      () => this.fallback.getExecutionRunById(executionRunId)
    );
  }

  async getTaskStateByPlanId(planId: string): Promise<PlannerTaskState | null> {
    return this.withFallback(
      'read',
      () => this.primary.getTaskStateByPlanId(planId),
      () => this.fallback.getTaskStateByPlanId(planId)
    );
  }

  async saveStoryRecord(params: {
    userId: string;
    planId: string;
    story: AIStoryContent & {
      template?: string;
      generatedAt?: number;
      updatedAt?: number;
    };
  }): Promise<PersistedStoryRecord> {
    return this.withFallback(
      'write',
      () => this.primary.saveStoryRecord(params),
      () => this.fallback.saveStoryRecord(params)
    );
  }

  async getStoryRecord(userId: string, planId: string): Promise<PersistedStoryRecord | null> {
    return this.withFallback(
      'read',
      () => this.primary.getStoryRecord(userId, planId),
      () => this.fallback.getStoryRecord(userId, planId)
    );
  }

  async createShareRecord(params: {
    userId: string;
    plan: Plan;
    profiles: Array<{ id?: string; name: string }>;
    taskState?: PlannerTaskState | null;
  }): Promise<PersistedShareRecord> {
    return this.withFallback(
      'write',
      () => this.primary.createShareRecord(params),
      () => this.fallback.createShareRecord(params)
    );
  }

  async getShareRecord(shareSlug: string): Promise<PersistedShareRecord | null> {
    return this.withFallback(
      'read',
      () => this.primary.getShareRecord(shareSlug),
      () => this.fallback.getShareRecord(shareSlug)
    );
  }

  async savePaymentRecord(params: {
    userId: string;
    transactionId: string;
    amount: number;
    method: 'meituan' | 'wechat' | 'alipay';
    orderTitle: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
  }): Promise<PersistedPaymentRecord> {
    return this.withFallback(
      'write',
      () => this.primary.savePaymentRecord(params),
      () => this.fallback.savePaymentRecord(params)
    );
  }

  async getPaymentByTransactionId(transactionId: string): Promise<PersistedPaymentRecord | null> {
    return this.withFallback(
      'read',
      () => this.primary.getPaymentByTransactionId(transactionId),
      () => this.fallback.getPaymentByTransactionId(transactionId)
    );
  }

  // ========= 订单相关方法 =========

  async createOrder(order: Omit<OrderRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderRow> {
    return this.withFallback(
      'write',
      () => this.primary.createOrder(order),
      () => this.fallback.createOrder(order)
    );
  }

  async getOrderById(id: string): Promise<OrderRow | null> {
    return this.withFallback(
      'read',
      () => this.primary.getOrderById(id),
      () => this.fallback.getOrderById(id)
    );
  }

  async getOrdersByUserId(userId: string, status?: OrderStatus): Promise<OrderRow[]> {
    return this.withFallback(
      'read',
      () => this.primary.getOrdersByUserId(userId, status),
      () => this.fallback.getOrdersByUserId(userId, status)
    );
  }

  async getOrdersByPlanId(planId: string): Promise<OrderRow[]> {
    return this.withFallback(
      'read',
      () => this.primary.getOrdersByPlanId(planId),
      () => this.fallback.getOrdersByPlanId(planId)
    );
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    return this.withFallback(
      'write',
      () => this.primary.updateOrderStatus(id, status),
      () => this.fallback.updateOrderStatus(id, status)
    );
  }

  async updateOrderRefund(id: string, refundStatus: RefundStatus, reason?: string): Promise<void> {
    return this.withFallback(
      'write',
      () => this.primary.updateOrderRefund(id, refundStatus, reason),
      () => this.fallback.updateOrderRefund(id, refundStatus, reason)
    );
  }

  async cancelOrder(id: string): Promise<void> {
    return this.withFallback(
      'write',
      () => this.primary.cancelOrder(id),
      () => this.fallback.cancelOrder(id)
    );
  }

  async deleteOrder(id: string): Promise<void> {
    return this.withFallback(
      'write',
      () => this.primary.deleteOrder(id),
      () => this.fallback.deleteOrder(id)
    );
  }

  async deletePlan(planId: string): Promise<boolean> {
    return this.withFallback(
      'write',
      () => this.primary.deletePlan(planId),
      () => this.fallback.deletePlan(planId)
    );
  }

  async getShareVotes(shareSlug: string) {
    return this.withFallback('read', () => this.primary.getShareVotes(shareSlug), () => this.fallback.getShareVotes(shareSlug));
  }

  async upsertShareVote(shareSlug: string, voteEntry: Parameters<import('./types').ServerRepository['upsertShareVote']>[1]) {
    return this.withFallback('write', () => this.primary.upsertShareVote(shareSlug, voteEntry), () => this.fallback.upsertShareVote(shareSlug, voteEntry));
  }

  async getUserPreferences(userId: string) {
    return this.withFallback(
      'read',
      () => this.primary.getUserPreferences(userId),
      () => this.fallback.getUserPreferences(userId)
    );
  }

  async upsertUserPreferences(userId: string, prefs: Parameters<import('./types').ServerRepository['upsertUserPreferences']>[1]) {
    return this.withFallback(
      'write',
      () => this.primary.upsertUserPreferences(userId, prefs),
      () => this.fallback.upsertUserPreferences(userId, prefs)
    );
  }

  async trackBehaviorEvent(event: Parameters<import('./types').ServerRepository['trackBehaviorEvent']>[0]) {
    return this.withFallback('write', () => this.primary.trackBehaviorEvent(event), () => this.fallback.trackBehaviorEvent(event));
  }

  async getBehaviorEvents(userId: string, options?: Parameters<import('./types').ServerRepository['getBehaviorEvents']>[1]) {
    return this.withFallback('read', () => this.primary.getBehaviorEvents(userId, options), () => this.fallback.getBehaviorEvents(userId, options));
  }

  async getBehaviorStats(userId: string) {
    return this.withFallback('read', () => this.primary.getBehaviorStats(userId), () => this.fallback.getBehaviorStats(userId));
  }
}
