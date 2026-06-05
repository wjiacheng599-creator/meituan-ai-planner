import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentResult } from '../../src/services/agent';
import type { Activity, AIStoryContent, Plan } from '../../src/services/ai';
import type { PersonProfile, PlannerTaskState } from '../../src/types';
import type {
  DatabaseShape,
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

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'app-db.json');

const EMPTY_DB: DatabaseShape = {
  users: [],
  profiles: [],
  sessions: [],
  plans: [],
  plannerTaskStates: [],
  executionRuns: [],
  stories: [],
  shares: [],
  payments: [],
  orders: [],
};

let writeQueue: Promise<void> = Promise.resolve();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureDbFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DB_FILE, 'utf8');
  } catch {
    await writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
  }
}

async function readDb(): Promise<DatabaseShape> {
  await ensureDbFile();
  try {
    const raw = await readFile(DB_FILE, 'utf8');
    return {
      ...EMPTY_DB,
      ...JSON.parse(raw),
    } as DatabaseShape;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

async function writeDb(db: DatabaseShape): Promise<void> {
  await ensureDbFile();
  writeQueue = writeQueue.then(async () => {
    await writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  });
  await writeQueue;
}

export class JsonServerRepository implements ServerRepository {
  async ensureUser(userId?: string): Promise<ServerUser> {
    const db = await readDb();

    if (userId) {
      const existing = db.users.find(item => item.id === userId);
      if (existing) return existing;
    }

    const created: ServerUser = {
      id: userId || makeId('user'),
      isAnonymous: true,
      createdAt: Date.now(),
    };

    db.users.unshift(created);
    await writeDb(db);
    return created;
  }

  async getBootstrapPayload(userId: string, pagination?: { page: number; limit: number }) {
    const db = await readDb();
    const profiles = db.profiles
      .filter(item => item.userId === userId)
      .map(({ userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...profile }) => profile);
    const sessions = db.sessions
      .filter(item => item.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);

    const allPlans = db.plans
      .filter(item => item.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // [PERF-OPT] Apply pagination to plans
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? allPlans.length;
    const total = allPlans.length;
    const paginatedPlans = allPlans.slice((page - 1) * limit, page * limit);
    const savedPlans = paginatedPlans.map(item => item.plan);

    const taskPlanIds = new Set(savedPlans.map(item => item.id).filter(Boolean));
    const plannerTaskStates = db.plannerTaskStates.filter(item => taskPlanIds.has(item.planId));

    return {
      profiles,
      sessions,
      savedPlans,
      plannerTaskStates,
      total, // [PERF-OPT] total count for pagination
    };
  }

  async saveGeneratedPlan(params: {
    userId: string;
    query: string;
    plan: Plan;
    sessionId?: string;
  }): Promise<{
    session: ServerSessionRecord;
    taskState: PlannerTaskState;
  }> {
    const { userId, query, plan } = params;
    const db = await readDb();
    const now = Date.now();
    const planId = plan.id || makeId('plan');
    const existingSession = params.sessionId
      ? db.sessions.find(item => item.id === params.sessionId && item.userId === userId)
      : undefined;
    const requestedSessionBelongsToAnotherUser = params.sessionId
      ? db.sessions.some(item => item.id === params.sessionId && item.userId !== userId)
      : false;
    const sessionId =
      existingSession?.id ||
      (!requestedSessionBelongsToAnotherUser ? params.sessionId : undefined) ||
      makeId('session');

    const normalizedPlan: Plan = {
      ...plan,
      id: planId,
    };

    const session: ServerSessionRecord = {
      ...existingSession,
      id: sessionId,
      userId,
      title: normalizedPlan.title,
      summary: normalizedPlan.summary,
      queryDraft: query,
      status: 'ready',
      updatedAt: now,
      planId,
      planTitle: normalizedPlan.title,
      planSummary: normalizedPlan.summary,
      durationTags: normalizedPlan.durationTags,
      totalPrice: normalizedPlan.totalPrice,
      memberCount: normalizedPlan.memberCount,
    };

    const taskState: PlannerTaskState = {
      planId,
      status: 'planned',
      selectedActivityIds: [],
      bookedActivityIds: [],
      bookedVariants: [],
      completedActivityIds: [],
      lastUpdatedAt: now,
    };

    db.sessions = [session, ...db.sessions.filter(item => item.id !== sessionId)];
    const existingPlan = db.plans.find(item => item.id === planId);
    db.plans = [
      {
        id: planId,
        userId,
        sessionId,
        sourceQuery: query,
        createdAt: existingPlan?.createdAt || now,
        updatedAt: now,
        plan: normalizedPlan,
      },
      ...db.plans.filter(item => item.id !== planId),
    ];
    db.plannerTaskStates = [
      taskState,
      ...db.plannerTaskStates.filter(item => item.planId !== planId),
    ];

    await writeDb(db);
    return { session, taskState };
  }

  async upsertPlanRecord(params: {
    userId: string;
    plan: Plan;
    sourceQuery?: string;
    sessionId?: string;
  }): Promise<PersistedPlanRecord> {
    const db = await readDb();
    const now = Date.now();
    const planId = params.plan.id || makeId('plan');
    const existing = db.plans.find(item => item.id === planId);

    const record: PersistedPlanRecord = existing
      ? {
          ...existing,
          updatedAt: now,
          sourceQuery: params.sourceQuery ?? existing.sourceQuery,
          sessionId: params.sessionId ?? existing.sessionId,
          plan: {
            ...params.plan,
            id: planId,
          },
        }
      : {
          id: planId,
          userId: params.userId,
          sessionId: params.sessionId || makeId('session'),
          sourceQuery: params.sourceQuery || '',
          createdAt: now,
          updatedAt: now,
          plan: {
            ...params.plan,
            id: planId,
          },
        };

    db.plans = [record, ...db.plans.filter(item => item.id !== record.id)];
    await writeDb(db);
    return record;
  }

  async replaceProfiles(params: {
    userId: string;
    profiles: PersonProfile[];
  }): Promise<PersonProfile[]> {
    const db = await readDb();
    const now = Date.now();

    db.profiles = [
      ...db.profiles.filter(item => item.userId !== params.userId),
      ...params.profiles.map(profile => ({
        ...profile,
        userId: params.userId,
        createdAt: now,
        updatedAt: now,
      })),
    ];

    await writeDb(db);
    return params.profiles;
  }

  async replaceSessions(params: {
    userId: string;
    sessions: ServerSessionRecord[];
  }): Promise<ServerSessionRecord[]> {
    const db = await readDb();
    db.sessions = [
      ...params.sessions.map(session => ({
        ...session,
        userId: params.userId,
        updatedAt: session.updatedAt || Date.now(),
      })),
      ...db.sessions.filter(item => item.userId !== params.userId),
    ];
    await writeDb(db);
    return params.sessions;
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const db = await readDb();
    const nextSessions = db.sessions.filter(
      item => !(item.id === sessionId && item.userId === userId)
    );
    if (nextSessions.length === db.sessions.length) return false;
    db.sessions = nextSessions;
    await writeDb(db);
    return true;
  }

  async replacePlannerTaskStates(params: {
    taskStates: PlannerTaskState[];
  }): Promise<PlannerTaskState[]> {
    const db = await readDb();
    const touchedPlanIds = new Set(params.taskStates.map(item => item.planId));
    db.plannerTaskStates = [
      ...params.taskStates,
      ...db.plannerTaskStates.filter(item => !touchedPlanIds.has(item.planId)),
    ];
    await writeDb(db);
    return params.taskStates;
  }

  async getPlanById(planId: string): Promise<PersistedPlanRecord | null> {
    const db = await readDb();
    return db.plans.find(item => item.id === planId) || null;
  }

  async saveExecutionRun(params: {
    userId: string;
    planId: string;
    activityIds: string[];
    result: AgentResult;
  }): Promise<PersistedExecutionRun> {
    const db = await readDb();
    const run: PersistedExecutionRun = {
      id: makeId('exec'),
      userId: params.userId,
      planId: params.planId,
      activityIds: params.activityIds,
      createdAt: Date.now(),
      result: params.result,
    };

    db.executionRuns = [run, ...db.executionRuns.filter(item => item.id !== run.id)];

    if (params.result.successCount > 0) {
      const taskState = db.plannerTaskStates.find(item => item.planId === params.planId);
      if (taskState) {
        const bookedIds = new Set(taskState.bookedActivityIds);
        const persistedPlan = db.plans.find(item => item.id === params.planId)?.plan;
        const activityLookup = new Map<string, Activity>((persistedPlan?.activities || []).map(item => [item.id, item]));

        for (const step of params.result.steps) {
          if (
            step.type === 'tool_result' &&
            step.status === 'success' &&
            (step.toolName === 'make_reservation' || step.toolName === 'book_activity')
          ) {
            const matchedActivity = [...activityLookup.values()].find(activity => activity.title === step.toolArgs?.name);
            if (matchedActivity) {
              bookedIds.add(matchedActivity.id);
            }
          }
        }

        taskState.bookedActivityIds = [...bookedIds];
        taskState.status = taskState.bookedActivityIds.length > 0 ? 'booked' : taskState.status;
        taskState.lastUpdatedAt = Date.now();
      }
    }

    await writeDb(db);
    return run;
  }

  async getExecutionRunById(executionRunId: string): Promise<PersistedExecutionRun | null> {
    const db = await readDb();
    return db.executionRuns.find(item => item.id === executionRunId) || null;
  }

  async getTaskStateByPlanId(planId: string): Promise<PlannerTaskState | null> {
    const db = await readDb();
    return db.plannerTaskStates.find(item => item.planId === planId) || null;
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
    const db = await readDb();
    const now = Date.now();
    const existing = db.stories.find(item => item.planId === params.planId && item.userId === params.userId);

    const record: PersistedStoryRecord = existing
      ? {
          ...existing,
          story: {
            ...existing.story,
            ...params.story,
            generatedAt: existing.story.generatedAt || params.story.generatedAt || now,
            updatedAt: now,
          },
          updatedAt: now,
        }
      : {
          id: makeId('story'),
          planId: params.planId,
          userId: params.userId,
          story: {
            ...params.story,
            generatedAt: params.story.generatedAt || now,
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        };

    db.stories = [record, ...db.stories.filter(item => item.id !== record.id)];
    await writeDb(db);
    return record;
  }

  async getStoryRecord(userId: string, planId: string): Promise<PersistedStoryRecord | null> {
    const db = await readDb();
    return db.stories.find(item => item.userId === userId && item.planId === planId) || null;
  }

  async createShareRecord(params: {
    userId: string;
    plan: Plan;
    profiles: Array<{ id?: string; name: string }>;
    taskState?: PlannerTaskState | null;
  }): Promise<PersistedShareRecord> {
    const db = await readDb();
    const existing = params.plan.id
      ? db.shares.find(item => item.userId === params.userId && item.planId === params.plan.id)
      : null;
    const now = Date.now();

    const record: PersistedShareRecord = existing
      ? {
          ...existing,
          shareTitle: params.plan.title,
          shareSummary: params.plan.summary,
          snapshot: {
            plan: params.plan,
            profiles: params.profiles,
            taskState: params.taskState || null,
          },
          createdAt: existing.createdAt || now,
        }
      : {
          id: makeId('share'),
          shareSlug: Math.random().toString(36).slice(2, 10),
          planId: params.plan.id || makeId('plan_share'),
          userId: params.userId,
          shareTitle: params.plan.title,
          shareSummary: params.plan.summary,
          createdAt: now,
          snapshot: {
            plan: params.plan,
            profiles: params.profiles,
            taskState: params.taskState || null,
          },
        };

    db.shares = [record, ...db.shares.filter(item => item.id !== record.id)];
    await writeDb(db);
    return record;
  }

  async getShareRecord(shareSlug: string): Promise<PersistedShareRecord | null> {
    const db = await readDb();
    return db.shares.find(item => item.shareSlug === shareSlug) || null;
  }

  async savePaymentRecord(params: {
    userId: string;
    transactionId: string;
    amount: number;
    method: 'meituan' | 'wechat' | 'alipay';
    orderTitle: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
  }): Promise<PersistedPaymentRecord> {
    const db = await readDb();
    const now = Date.now();

    const record: PersistedPaymentRecord = {
      id: makeId('payment'),
      userId: params.userId,
      transactionId: params.transactionId,
      amount: params.amount,
      method: params.method,
      orderTitle: params.orderTitle,
      status: params.status,
      createdAt: now,
      updatedAt: now,
    };

    db.payments = [record, ...db.payments.filter(item => item.id !== record.id)];
    await writeDb(db);
    return record;
  }

  async getPaymentByTransactionId(transactionId: string): Promise<PersistedPaymentRecord | null> {
    const db = await readDb();
    return db.payments.find(item => item.transactionId === transactionId) || null;
  }

  // ========= 订单相关方法 =========

  async createOrder(order: Omit<OrderRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderRow> {
    const db = await readDb();
    const now = Date.now();
    const newOrder: OrderRow = {
      ...order,
      id: `order_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      refundStatus: 'none',
    };
    db.orders.unshift(newOrder);
    await writeDb(db);
    return newOrder;
  }

  async getOrderById(id: string): Promise<OrderRow | null> {
    const db = await readDb();
    return db.orders.find((item: any) => item.id === id) || null;
  }

  async getOrdersByUserId(userId: string, status?: OrderStatus): Promise<OrderRow[]> {
    const db = await readDb();
    let orders = db.orders.filter((item: any) => item.userId === userId);
    if (status) {
      orders = orders.filter((item: any) => item.status === status);
    }
    return orders.sort((a: any, b: any) => b.createdAt - a.createdAt);
  }

  async getOrdersByPlanId(planId: string): Promise<OrderRow[]> {
    const db = await readDb();
    return db.orders.filter((item: any) => item.planId === planId);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const db = await readDb();
    const order = db.orders.find((item: any) => item.id === id);
    if (order) {
      order.status = status;
      order.updatedAt = Date.now();
      await writeDb(db);
    }
  }

  async updateOrderRefund(id: string, refundStatus: RefundStatus, reason?: string): Promise<void> {
    const db = await readDb();
    const order = db.orders.find((item: any) => item.id === id);
    if (order) {
      order.refundStatus = refundStatus;
      order.refundReason = reason || undefined;
      order.updatedAt = Date.now();
      await writeDb(db);
    }
  }

  async cancelOrder(id: string): Promise<void> {
    const db = await readDb();
    const order = db.orders.find((item: any) => item.id === id);
    if (order) {
      order.status = 'canceled';
      order.canceledAt = Date.now();
      order.updatedAt = Date.now();
      await writeDb(db);
    }
  }

  async deleteOrder(id: string): Promise<void> {
    const db = await readDb();
    db.orders = db.orders.filter((item: any) => item.id !== id);
    await writeDb(db);
  }

  async deletePlan(planId: string): Promise<boolean> {
    const db = await readDb();
    const idx = db.plans.findIndex((p: any) => p.id === planId);
    if (idx === -1) return false;
    db.plans.splice(idx, 1);
    await writeDb(db);
    return true;
  }

  async getShareVotes(_shareSlug: string) { return []; }
  async upsertShareVote(_shareSlug: string, _voteEntry: Record<string, unknown>) {}

  async getUserPreferences(_userId: string) {
    return null;
  }

  async upsertUserPreferences(_userId: string, _prefs: Record<string, unknown>) {
    // JSON fallback does not persist preferences — SQLite is primary
  }

  async trackBehaviorEvent(_event: Record<string, unknown>) {
    // JSON fallback does not persist behavior events — SQLite is primary
  }

  async getBehaviorEvents(_userId: string, _options?: Record<string, unknown>) {
    return [];
  }

  async getBehaviorStats(_userId: string) {
    return { totalEvents: 0, byType: {}, topActivities: [] };
  }
}
