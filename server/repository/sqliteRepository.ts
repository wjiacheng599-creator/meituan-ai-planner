/**
 * SQLite Repository implementation using better-sqlite3 (native, synchronous)
 * Replaces sql.js WASM approach with proper normalized schema and parameterized queries
 */
import Database from 'better-sqlite3';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, renameSync, mkdirSync as nodeMkdirSync } from 'node:fs';
import path from 'node:path';
import type { AgentResult } from '../../src/services/agent';
import type { AIStoryContent, Activity, Plan } from '../../src/services/ai';
import type { PersonProfile, PlannerTaskState } from '../../src/types';
import type {
  DatabaseShape,
  ExecutionRunRow,
  PaymentRow,
  PersistedExecutionRun,
  PersistedPaymentRecord,
  PersistedPlanRecord,
  PersistedShareRecord,
  PersistedStoryRecord,
  PlanRow,
  ProfileRow,
  ServerRepository,
  ServerSessionRecord,
  ServerUser,
  SessionRow,
  ShareRow,
  StoryRow,
  TaskStateRow,
  UserRow,
  OrderRow,
  OrderStatus,
  RefundStatus,
} from './types';
import { OrderRepository } from './orderRepository';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const SQLITE_FILE = path.join(DATA_DIR, 'app-db.sqlite');
const JSON_FILE = path.join(DATA_DIR, 'app-db.json');

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class SqliteRepository implements ServerRepository {
  private db: Database.Database;
  private orderRepo: OrderRepository;

  constructor() {
    mkdirSync(DATA_DIR);
    this.db = new Database(SQLITE_FILE);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.createTables();
    this.addColumnMigrations();
    this.migrateFromJsonSync();
    this.orderRepo = new OrderRepository(this);
  }

  runInTransaction(fn: () => void): void {
    this.db.transaction(fn)();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        isAnonymous INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        relation TEXT NOT NULL,
        ageGroup TEXT NOT NULL,
        dietaryPreferences TEXT NOT NULL DEFAULT '[]',
        travelPreferences TEXT NOT NULL DEFAULT '[]',
        avoidPreferences TEXT,
        budget TEXT,
        mobility TEXT,
        specialNeeds TEXT,
        favoriteActivities TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_profiles_userId ON profiles(userId);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        queryDraft TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        updatedAt INTEGER NOT NULL,
        planId TEXT,
        planTitle TEXT,
        planSummary TEXT,
        durationTags TEXT,
        totalPrice REAL,
        memberCount INTEGER,
        selectedProfileIds TEXT,
        timePref TEXT,
        targetType TEXT,
        collabStrategy TEXT,
        tieBreaker TEXT,
        memberVotes TEXT,
        memberAvoids TEXT,
        tempProfiles TEXT,
        messages TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
      CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON sessions(updatedAt DESC);

      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        sourceQuery TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_plans_userId ON plans(userId);
      CREATE INDEX IF NOT EXISTS idx_plans_updatedAt ON plans(updatedAt DESC);

      CREATE TABLE IF NOT EXISTS plannerTaskStates (
        planId TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'planned',
        selectedActivityIds TEXT NOT NULL DEFAULT '[]',
        bookedActivityIds TEXT NOT NULL DEFAULT '[]',
        bookedVariants TEXT NOT NULL DEFAULT '[]',
        completedActivityIds TEXT NOT NULL DEFAULT '[]',
        lastUpdatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS executionRuns (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        userId TEXT NOT NULL,
        activityIds TEXT NOT NULL DEFAULT '[]',
        result TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_executionRuns_planId ON executionRuns(planId);
      CREATE INDEX IF NOT EXISTS idx_executionRuns_userId ON executionRuns(userId);

      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        userId TEXT NOT NULL,
        story TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stories_userId_planId ON stories(userId, planId);

      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        shareSlug TEXT NOT NULL UNIQUE,
        planId TEXT NOT NULL,
        userId TEXT NOT NULL,
        shareTitle TEXT NOT NULL,
        shareSummary TEXT,
        snapshot TEXT NOT NULL,
        votes TEXT NOT NULL DEFAULT '[]',
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_shares_shareSlug ON shares(shareSlug);
      CREATE INDEX IF NOT EXISTS idx_shares_userId_planId ON shares(userId, planId);

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        transactionId TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        method TEXT NOT NULL,
        orderTitle TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payments_userId ON payments(userId);
      CREATE INDEX IF NOT EXISTS idx_payments_transactionId ON payments(transactionId);

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        planId TEXT NOT NULL,
        activityIds TEXT NOT NULL,
        title TEXT NOT NULL,
        merchantName TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        paymentId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        canceledAt INTEGER,
        refundReason TEXT,
        refundStatus TEXT DEFAULT 'none'
      );
      CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

      CREATE TABLE IF NOT EXISTS user_preferences (
        userId TEXT PRIMARY KEY,
        favoriteCategories TEXT NOT NULL DEFAULT '[]',
        avoidCategories TEXT NOT NULL DEFAULT '[]',
        priceRangeMin REAL NOT NULL DEFAULT 0,
        priceRangeMax REAL NOT NULL DEFAULT 1000,
        preferredTime TEXT NOT NULL DEFAULT 'any',
        dietaryRestrictions TEXT NOT NULL DEFAULT '[]',
        recentSearches TEXT NOT NULL DEFAULT '[]',
        lastUpdated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_behavior_events (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        planId TEXT,
        activityId TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_user_type ON user_behavior_events(userId, type);
      CREATE INDEX IF NOT EXISTS idx_behavior_timestamp ON user_behavior_events(timestamp);
    `);
  }

  /** 为已有表添加新列（安全幂等） */
  private addColumnMigrations(): void {
    const migrations = [
      "ALTER TABLE shares ADD COLUMN votes TEXT NOT NULL DEFAULT '[]'",
      "ALTER TABLE plannerTaskStates ADD COLUMN bookedVariants TEXT NOT NULL DEFAULT '[]'",
    ];
    for (const sql of migrations) {
      try {
        this.db.exec(sql);
      } catch {
        // 列已存在，忽略
      }
    }
  }

  private migrateFromJsonSync(): void {
    const count = this.db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    if (count.cnt > 0) return; // Already has data

    if (!existsSync(JSON_FILE)) return;

    try {
      const raw = readFileSync(JSON_FILE, 'utf8');
      const dbShape: DatabaseShape = JSON.parse(raw);
      console.log('[SqliteRepository] Migrating from JSON...');

      const migrate = this.db.transaction(() => {
        // Users
        const insertUser = this.db.prepare(
          'INSERT OR IGNORE INTO users (id, isAnonymous, createdAt) VALUES (?, ?, ?)'
        );
        for (const u of dbShape.users || []) {
          insertUser.run(u.id, u.isAnonymous ? 1 : 0, u.createdAt);
        }

        // Profiles
        const insertProfile = this.db.prepare(
          `INSERT OR IGNORE INTO profiles (id, userId, name, relation, ageGroup, dietaryPreferences, travelPreferences, avoidPreferences, budget, mobility, specialNeeds, favoriteActivities, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const p of dbShape.profiles || []) {
          insertProfile.run(
            p.id, p.userId, p.name, p.relation, p.ageGroup,
            JSON.stringify(p.dietaryPreferences ?? []),
            JSON.stringify(p.travelPreferences ?? []),
            p.avoidPreferences ? JSON.stringify(p.avoidPreferences) : null,
            p.budget ?? null, p.mobility ?? null,
            p.specialNeeds ? JSON.stringify(p.specialNeeds) : null,
            p.favoriteActivities ? JSON.stringify(p.favoriteActivities) : null,
            p.createdAt, p.updatedAt
          );
        }

        // Sessions
        const insertSession = this.db.prepare(
          `INSERT OR IGNORE INTO sessions (id, userId, title, summary, queryDraft, status, updatedAt, planId, planTitle, planSummary, durationTags, totalPrice, memberCount, selectedProfileIds, timePref, targetType, collabStrategy, tieBreaker, memberVotes, memberAvoids, tempProfiles, messages)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const s of dbShape.sessions || []) {
          insertSession.run(
            s.id, s.userId, s.title, s.summary,
            s.queryDraft ?? '', s.status ?? 'draft', s.updatedAt,
            s.planId ?? null, s.planTitle ?? null, s.planSummary ?? null,
            s.durationTags ?? null, s.totalPrice ?? null, s.memberCount ?? null,
            s.selectedProfileIds ? JSON.stringify(s.selectedProfileIds) : null,
            s.timePref ?? null, s.targetType ?? null, s.collabStrategy ?? null,
            s.tieBreaker ?? null,
            s.memberVotes ? JSON.stringify(s.memberVotes) : null,
            s.memberAvoids ? JSON.stringify(s.memberAvoids) : null,
            s.tempProfiles ? JSON.stringify(s.tempProfiles) : null,
            s.messages ? JSON.stringify(s.messages) : null
          );
        }

        // Plans
        const insertPlan = this.db.prepare(
          'INSERT OR IGNORE INTO plans (id, userId, sessionId, sourceQuery, plan, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const p of dbShape.plans || []) {
          insertPlan.run(p.id, p.userId, p.sessionId, p.sourceQuery ?? '', JSON.stringify(p.plan), p.createdAt, p.updatedAt);
        }

        // PlannerTaskStates
        const insertTaskState = this.db.prepare(
          'INSERT OR IGNORE INTO plannerTaskStates (planId, status, selectedActivityIds, bookedActivityIds, bookedVariants, completedActivityIds, lastUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const t of dbShape.plannerTaskStates || []) {
          insertTaskState.run(
            t.planId, t.status ?? 'planned',
            JSON.stringify(t.selectedActivityIds ?? []),
            JSON.stringify(t.bookedActivityIds ?? []),
            JSON.stringify(t.bookedVariants ?? []),
            JSON.stringify(t.completedActivityIds ?? []),
            t.lastUpdatedAt
          );
        }

        // ExecutionRuns
        const insertExec = this.db.prepare(
          'INSERT OR IGNORE INTO executionRuns (id, planId, userId, activityIds, result, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const e of dbShape.executionRuns || []) {
          insertExec.run(e.id, e.planId, e.userId, JSON.stringify(e.activityIds), JSON.stringify(e.result), e.createdAt);
        }

        // Stories
        const insertStory = this.db.prepare(
          'INSERT OR IGNORE INTO stories (id, planId, userId, story, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const s of dbShape.stories || []) {
          insertStory.run(s.id, s.planId, s.userId, JSON.stringify(s.story), s.createdAt, s.updatedAt);
        }

        // Shares
        const insertShare = this.db.prepare(
          'INSERT OR IGNORE INTO shares (id, shareSlug, planId, userId, shareTitle, shareSummary, snapshot, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const s of dbShape.shares || []) {
          insertShare.run(s.id, s.shareSlug, s.planId, s.userId, s.shareTitle, s.shareSummary ?? null, JSON.stringify(s.snapshot), s.createdAt);
        }

        // Payments
        const insertPayment = this.db.prepare(
          'INSERT OR IGNORE INTO payments (id, userId, transactionId, amount, method, orderTitle, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        for (const p of dbShape.payments || []) {
          insertPayment.run(p.id, p.userId, p.transactionId, p.amount, p.method, p.orderTitle, p.status, p.createdAt, p.updatedAt);
        }
      });

      migrate();

      // Backup JSON file
      renameSync(JSON_FILE, `${JSON_FILE}.bak`);
      console.log('[SqliteRepository] Migration complete, JSON backed up');
    } catch (e) {
      console.log('[SqliteRepository] No JSON file to migrate or migration skipped:', (e as Error).message);
    }
  }

  // ---- Helper: map DB row to PlannerTaskState ----
  private rowToTaskState(row: TaskStateRow): PlannerTaskState {
    return {
      planId: row.planId,
      status: row.status as PlannerTaskState['status'],
      selectedActivityIds: parseJson<string[]>(row.selectedActivityIds, []),
      bookedActivityIds: parseJson<string[]>(row.bookedActivityIds, []),
      bookedVariants: parseJson<PlannerTaskState['bookedVariants']>(row.bookedVariants, []),
      completedActivityIds: parseJson<string[]>(row.completedActivityIds, []),
      lastUpdatedAt: row.lastUpdatedAt,
    };
  }

  // ---- Helper: map DB row to PersistedPlanRecord ----
  private rowToPlanRecord(row: PlanRow): PersistedPlanRecord {
    return {
      id: row.id,
      userId: row.userId,
      sessionId: row.sessionId,
      sourceQuery: row.sourceQuery,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      plan: parseJson<Plan>(row.plan, {} as Plan),
    };
  }

  // ---- Helper: map DB row to ServerSessionRecord ----
  private rowToSession(row: SessionRow): ServerSessionRecord {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      summary: row.summary,
      queryDraft: row.queryDraft,
      status: row.status as ServerSessionRecord['status'],
      updatedAt: row.updatedAt,
      planId: row.planId ?? undefined,
      planTitle: row.planTitle ?? undefined,
      planSummary: row.planSummary ?? undefined,
      durationTags: row.durationTags ?? undefined,
      totalPrice: row.totalPrice ?? undefined,
      memberCount: row.memberCount ?? undefined,
      selectedProfileIds: parseJson<string[] | undefined>(row.selectedProfileIds, undefined),
      timePref: row.timePref ?? undefined,
      targetType: row.targetType ?? undefined,
      collabStrategy: (row.collabStrategy ?? undefined) as ServerSessionRecord['collabStrategy'],
      tieBreaker: row.tieBreaker ?? undefined,
      memberVotes: parseJson<Record<string, string[]> | undefined>(row.memberVotes, undefined),
      memberAvoids: parseJson<Record<string, string[]> | undefined>(row.memberAvoids, undefined),
      tempProfiles: parseJson<PersonProfile[] | undefined>(row.tempProfiles, undefined),
      messages: parseJson<unknown[] | undefined>(row.messages, undefined),
    };
  }

  // ============================================================
  // ServerRepository implementation
  // ============================================================

  async ensureUser(userId?: string): Promise<ServerUser> {
    if (userId) {
      const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
      if (row) {
        return { id: row.id, isAnonymous: !!row.isAnonymous, createdAt: row.createdAt };
      }
    }

    const id = userId || makeId('user');
    const now = Date.now();
    this.db.prepare('INSERT OR IGNORE INTO users (id, isAnonymous, createdAt) VALUES (?, 1, ?)').run(id, now);
    return { id, isAnonymous: true, createdAt: now };
  }

  async getBootstrapPayload(userId: string, pagination?: { page: number; limit: number }) {
    // Profiles
    const profileRows = this.db.prepare('SELECT * FROM profiles WHERE userId = ?').all(userId) as ProfileRow[];
    const profiles: PersonProfile[] = profileRows.map(r => ({
      id: r.id,
      name: r.name,
      relation: r.relation,
      ageGroup: r.ageGroup,
      dietaryPreferences: parseJson<string[]>(r.dietaryPreferences, []),
      travelPreferences: parseJson<string[]>(r.travelPreferences, []),
      avoidPreferences: parseJson<string[] | undefined>(r.avoidPreferences, undefined),
      budget: r.budget ?? undefined,
      mobility: r.mobility ?? undefined,
      specialNeeds: parseJson<string[] | undefined>(r.specialNeeds, undefined),
      favoriteActivities: parseJson<string[] | undefined>(r.favoriteActivities, undefined),
    }));

    // Sessions
    const sessionRows = this.db.prepare(
      'SELECT * FROM sessions WHERE userId = ? ORDER BY updatedAt DESC LIMIT 20'
    ).all(userId) as SessionRow[];
    const sessions = sessionRows.map(r => this.rowToSession(r));

    // Plans with pagination
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10000;
    const totalRow = this.db.prepare('SELECT COUNT(*) as cnt FROM plans WHERE userId = ?').get(userId) as { cnt: number };
    const total = totalRow.cnt;

    const planRows = this.db.prepare(
      'SELECT * FROM plans WHERE userId = ? ORDER BY updatedAt DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, (page - 1) * limit) as PlanRow[];
    const allPlanRecords = planRows.map(r => this.rowToPlanRecord(r));
    const savedPlans = allPlanRecords.map(r => r.plan);

    // PlannerTaskStates for the returned plans
    const taskPlanIds = savedPlans.map(p => p.id).filter(Boolean);
    let plannerTaskStates: PlannerTaskState[] = [];
    if (taskPlanIds.length > 0) {
      const placeholders = taskPlanIds.map(() => '?').join(',');
      const taskRows = this.db.prepare(
        `SELECT * FROM plannerTaskStates WHERE planId IN (${placeholders})`
      ).all(...taskPlanIds) as TaskStateRow[];
      plannerTaskStates = taskRows.map(r => this.rowToTaskState(r));
    }

    return { profiles, sessions, savedPlans, plannerTaskStates, total };
  }

  async saveGeneratedPlan(params: {
    userId: string;
    query: string;
    plan: Plan;
    sessionId?: string;
  }): Promise<{ session: ServerSessionRecord; taskState: PlannerTaskState }> {
    const { userId, query, plan } = params;
    const now = Date.now();
    const planId = plan.id || makeId('plan');
    const existingSessionRow = params.sessionId
      ? this.db.prepare('SELECT * FROM sessions WHERE id = ? AND userId = ?').get(
          params.sessionId,
          userId
        ) as SessionRow | undefined
      : undefined;
    const existingSession = existingSessionRow ? this.rowToSession(existingSessionRow) : undefined;
    const requestedSessionBelongsToAnotherUser = params.sessionId
      ? !!this.db.prepare('SELECT 1 FROM sessions WHERE id = ? AND userId != ?').get(
          params.sessionId,
          userId
        )
      : false;
    const sessionId =
      existingSession?.id ||
      (!requestedSessionBelongsToAnotherUser ? params.sessionId : undefined) ||
      makeId('session');
    const normalizedPlan: Plan = { ...plan, id: planId };

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

    const insertAll = this.db.transaction(() => {
      this.db.prepare(
        `INSERT OR REPLACE INTO sessions (id, userId, title, summary, queryDraft, status, updatedAt, planId, planTitle, planSummary, durationTags, totalPrice, memberCount, selectedProfileIds, timePref, targetType, collabStrategy, tieBreaker, memberVotes, memberAvoids, tempProfiles, messages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        session.id,
        session.userId,
        session.title,
        session.summary,
        session.queryDraft,
        session.status,
        session.updatedAt,
        session.planId ?? null,
        session.planTitle ?? null,
        session.planSummary ?? null,
        session.durationTags ?? null,
        session.totalPrice ?? null,
        session.memberCount ?? null,
        session.selectedProfileIds ? JSON.stringify(session.selectedProfileIds) : null,
        session.timePref ?? null,
        session.targetType ?? null,
        session.collabStrategy ?? null,
        session.tieBreaker ?? null,
        session.memberVotes ? JSON.stringify(session.memberVotes) : null,
        session.memberAvoids ? JSON.stringify(session.memberAvoids) : null,
        session.tempProfiles ? JSON.stringify(session.tempProfiles) : null,
        session.messages ? JSON.stringify(session.messages) : null
      );

      const existingPlan = this.db.prepare('SELECT createdAt FROM plans WHERE id = ?').get(planId) as
        | { createdAt: number }
        | undefined;
      this.db.prepare(
        'INSERT OR REPLACE INTO plans (id, userId, sessionId, sourceQuery, plan, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        planId,
        userId,
        sessionId,
        query,
        JSON.stringify(normalizedPlan),
        existingPlan?.createdAt || now,
        now
      );

      this.db.prepare(
        'INSERT OR REPLACE INTO plannerTaskStates (planId, status, selectedActivityIds, bookedActivityIds, bookedVariants, completedActivityIds, lastUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(planId, taskState.status, '[]', '[]', '[]', '[]', now);
    });

    insertAll();
    return { session, taskState };
  }

  async upsertPlanRecord(params: {
    userId: string;
    plan: Plan;
    sourceQuery?: string;
    sessionId?: string;
  }): Promise<PersistedPlanRecord> {
    const now = Date.now();
    const planId = params.plan.id || makeId('plan');

    const existing = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as PlanRow | undefined;

    const record: PersistedPlanRecord = existing
      ? {
          id: planId,
          userId: existing.userId,
          sessionId: params.sessionId ?? existing.sessionId,
          sourceQuery: params.sourceQuery ?? existing.sourceQuery,
          createdAt: existing.createdAt,
          updatedAt: now,
          plan: { ...params.plan, id: planId },
        }
      : {
          id: planId,
          userId: params.userId,
          sessionId: params.sessionId || makeId('session'),
          sourceQuery: params.sourceQuery || '',
          createdAt: now,
          updatedAt: now,
          plan: { ...params.plan, id: planId },
        };

    this.db.prepare(
      'INSERT OR REPLACE INTO plans (id, userId, sessionId, sourceQuery, plan, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(record.id, record.userId, record.sessionId, record.sourceQuery, JSON.stringify(record.plan), record.createdAt, record.updatedAt);

    return record;
  }

  async replaceProfiles(params: {
    userId: string;
    profiles: PersonProfile[];
  }): Promise<PersonProfile[]> {
    const now = Date.now();

    const upsertAll = this.db.transaction(() => {
      const insert = this.db.prepare(
        `INSERT OR REPLACE INTO profiles (id, userId, name, relation, ageGroup, dietaryPreferences, travelPreferences, avoidPreferences, budget, mobility, specialNeeds, favoriteActivities, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const p of params.profiles) {
        insert.run(
          p.id || makeId('profile'),
          params.userId,
          p.name,
          p.relation,
          p.ageGroup,
          JSON.stringify(p.dietaryPreferences ?? []),
          JSON.stringify(p.travelPreferences ?? []),
          p.avoidPreferences ? JSON.stringify(p.avoidPreferences) : null,
          p.budget ?? null,
          p.mobility ?? null,
          p.specialNeeds ? JSON.stringify(p.specialNeeds) : null,
          p.favoriteActivities ? JSON.stringify(p.favoriteActivities) : null,
          now,
          now
        );
      }
    });

    upsertAll();
    return params.profiles;
  }

  async replaceSessions(params: {
    userId: string;
    sessions: ServerSessionRecord[];
  }): Promise<ServerSessionRecord[]> {
    const upsertAll = this.db.transaction(() => {
      const insert = this.db.prepare(
        `INSERT OR REPLACE INTO sessions (id, userId, title, summary, queryDraft, status, updatedAt, planId, planTitle, planSummary, durationTags, totalPrice, memberCount, selectedProfileIds, timePref, targetType, collabStrategy, tieBreaker, memberVotes, memberAvoids, tempProfiles, messages)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const s of params.sessions) {
        insert.run(
          s.id, params.userId, s.title, s.summary,
          s.queryDraft ?? '', s.status ?? 'draft', s.updatedAt || Date.now(),
          s.planId ?? null, s.planTitle ?? null, s.planSummary ?? null,
          s.durationTags ?? null, s.totalPrice ?? null, s.memberCount ?? null,
          s.selectedProfileIds ? JSON.stringify(s.selectedProfileIds) : null,
          s.timePref ?? null, s.targetType ?? null, s.collabStrategy ?? null,
          s.tieBreaker ?? null,
          s.memberVotes ? JSON.stringify(s.memberVotes) : null,
          s.memberAvoids ? JSON.stringify(s.memberAvoids) : null,
          s.tempProfiles ? JSON.stringify(s.tempProfiles) : null,
          s.messages ? JSON.stringify(s.messages) : null
        );
      }
    });

    upsertAll();
    return params.sessions;
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ? AND userId = ?').run(
      sessionId,
      userId
    );
    return result.changes > 0;
  }

  async replacePlannerTaskStates(params: {
    taskStates: PlannerTaskState[];
  }): Promise<PlannerTaskState[]> {
    const upsertAll = this.db.transaction(() => {
      const insert = this.db.prepare(
        'INSERT OR REPLACE INTO plannerTaskStates (planId, status, selectedActivityIds, bookedActivityIds, bookedVariants, completedActivityIds, lastUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );

      for (const t of params.taskStates) {
        insert.run(
          t.planId, t.status,
          JSON.stringify(t.selectedActivityIds),
          JSON.stringify(t.bookedActivityIds),
          JSON.stringify(t.bookedVariants ?? []),
          JSON.stringify(t.completedActivityIds),
          t.lastUpdatedAt
        );
      }
    });

    upsertAll();
    return params.taskStates;
  }

  async getPlanById(planId: string): Promise<PersistedPlanRecord | null> {
    const row = this.db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as PlanRow | undefined;
    return row ? this.rowToPlanRecord(row) : null;
  }

  async deletePlan(planId: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM plans WHERE id = ?').run(planId);
    return result.changes > 0;
  }

  async saveExecutionRun(params: {
    userId: string;
    planId: string;
    activityIds: string[];
    result: AgentResult;
  }): Promise<PersistedExecutionRun> {
    const run: PersistedExecutionRun = {
      id: makeId('exec'),
      userId: params.userId,
      planId: params.planId,
      activityIds: params.activityIds,
      createdAt: Date.now(),
      result: params.result,
    };

    const saveAndMaybeUpdate = this.db.transaction(() => {
      this.db.prepare(
        'INSERT INTO executionRuns (id, planId, userId, activityIds, result, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(run.id, run.planId, run.userId, JSON.stringify(run.activityIds), JSON.stringify(run.result), run.createdAt);

      // Update task state if there were successful bookings
      if (params.result.successCount > 0) {
        const taskRow = this.db.prepare('SELECT * FROM plannerTaskStates WHERE planId = ?').get(params.planId) as TaskStateRow | undefined;
        if (taskRow) {
          const taskState = this.rowToTaskState(taskRow);
          const bookedIds = new Set(taskState.bookedActivityIds);

          // Get plan activities for matching
          const planRow = this.db.prepare('SELECT plan FROM plans WHERE id = ?').get(params.planId) as { plan: string } | undefined;
          if (planRow) {
            const persistedPlan = parseJson<Plan>(planRow.plan, {} as Plan);
            const activityLookup = new Map<string, Activity>(
              (persistedPlan.activities || []).map((a: Activity) => [a.id, a])
            );

            for (const step of params.result.steps) {
              if (
                step.type === 'tool_result' &&
                step.status === 'success' &&
                (step.toolName === 'make_reservation' || step.toolName === 'book_activity')
              ) {
                const matchedActivity = [...activityLookup.values()].find(
                  (a: Activity) => a.title === step.toolArgs?.name
                );
                if (matchedActivity) {
                  bookedIds.add(matchedActivity.id);
                }
              }
            }
          }

          taskState.bookedActivityIds = [...bookedIds];
          taskState.status = taskState.bookedActivityIds.length > 0 ? 'booked' : taskState.status;
          taskState.lastUpdatedAt = Date.now();

          this.db.prepare(
            'INSERT OR REPLACE INTO plannerTaskStates (planId, status, selectedActivityIds, bookedActivityIds, bookedVariants, completedActivityIds, lastUpdatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(taskState.planId, taskState.status, JSON.stringify(taskState.selectedActivityIds), JSON.stringify(taskState.bookedActivityIds), JSON.stringify(taskState.bookedVariants ?? []), JSON.stringify(taskState.completedActivityIds), taskState.lastUpdatedAt);
        }
      }
    });

    saveAndMaybeUpdate();
    return run;
  }

  async getExecutionRunById(executionRunId: string): Promise<PersistedExecutionRun | null> {
    const row = this.db.prepare('SELECT * FROM executionRuns WHERE id = ?').get(executionRunId) as ExecutionRunRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      planId: row.planId,
      userId: row.userId,
      activityIds: parseJson<string[]>(row.activityIds, []),
      createdAt: row.createdAt,
      result: parseJson<AgentResult>(row.result, {} as AgentResult),
    };
  }

  async getTaskStateByPlanId(planId: string): Promise<PlannerTaskState | null> {
    const row = this.db.prepare('SELECT * FROM plannerTaskStates WHERE planId = ?').get(planId) as TaskStateRow | undefined;
    return row ? this.rowToTaskState(row) : null;
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
    const now = Date.now();

    // Check for existing story
    const existing = this.db.prepare(
      'SELECT * FROM stories WHERE userId = ? AND planId = ?'
    ).get(params.userId, params.planId) as StoryRow | undefined;

    const existingStory = parseJson<Record<string, unknown>>(existing?.story, {});

    const record: PersistedStoryRecord = existing
      ? {
          id: existing.id,
          planId: params.planId,
          userId: params.userId,
          story: {
            ...existingStory,
            ...params.story,
            generatedAt: (existingStory.generatedAt as number) || params.story.generatedAt || now,
            updatedAt: now,
          },
          createdAt: existing.createdAt,
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

    this.db.prepare(
      'INSERT OR REPLACE INTO stories (id, planId, userId, story, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(record.id, record.planId, record.userId, JSON.stringify(record.story), record.createdAt, record.updatedAt);

    return record;
  }

  async getStoryRecord(userId: string, planId: string): Promise<PersistedStoryRecord | null> {
    const row = this.db.prepare(
      'SELECT * FROM stories WHERE userId = ? AND planId = ?'
    ).get(userId, planId) as StoryRow | undefined;

    if (!row) return null;
    return {
      id: row.id,
      planId: row.planId,
      userId: row.userId,
      story: parseJson<PersistedStoryRecord['story']>(row.story, {} as PersistedStoryRecord['story']),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createShareRecord(params: {
    userId: string;
    plan: Plan;
    profiles: Array<{ id?: string; name: string }>;
    taskState?: PlannerTaskState | null;
  }): Promise<PersistedShareRecord> {
    const planId = params.plan.id;
    const now = Date.now();

    // Check for existing share
    let existing: ShareRow | null = null;
    if (planId) {
      const found = this.db.prepare(
        'SELECT * FROM shares WHERE userId = ? AND planId = ?'
      ).get(params.userId, planId) as ShareRow | undefined;
      existing = found ?? null;
    }

    const record: PersistedShareRecord = existing
      ? {
          id: existing.id,
          shareSlug: existing.shareSlug,
          planId: existing.planId,
          userId: params.userId,
          shareTitle: params.plan.title,
          shareSummary: params.plan.summary,
          snapshot: {
            plan: params.plan,
            profiles: params.profiles,
            taskState: params.taskState || null,
          },
          createdAt: existing.createdAt,
        }
      : {
          id: makeId('share'),
          shareSlug: Math.random().toString(36).slice(2, 10),
          planId: planId || makeId('plan_share'),
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

    this.db.prepare(
      'INSERT OR REPLACE INTO shares (id, shareSlug, planId, userId, shareTitle, shareSummary, snapshot, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(record.id, record.shareSlug, record.planId, record.userId, record.shareTitle, record.shareSummary ?? null, JSON.stringify(record.snapshot), record.createdAt);

    return record;
  }

  async getShareRecord(shareSlug: string): Promise<PersistedShareRecord | null> {
    const row = this.db.prepare('SELECT * FROM shares WHERE shareSlug = ?').get(shareSlug) as ShareRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      shareSlug: row.shareSlug,
      planId: row.planId,
      userId: row.userId,
      shareTitle: row.shareTitle,
      shareSummary: row.shareSummary ?? undefined,
      snapshot: parseJson<PersistedShareRecord['snapshot']>(row.snapshot, {} as PersistedShareRecord['snapshot']),
      createdAt: row.createdAt,
    };
  }

  async getShareVotes(shareSlug: string): Promise<Array<{
    id: string; voterName: string; vote: string; suggestion?: string; createdAt: number;
  }>> {
    const row = this.db.prepare('SELECT votes FROM shares WHERE shareSlug = ?').get(shareSlug) as { votes?: string } | undefined;
    if (!row?.votes) return [];
    return parseJson(row.votes, []);
  }

  async upsertShareVote(shareSlug: string, voteEntry: {
    id: string; voterName: string; vote: string; suggestion?: string; createdAt: number;
  }): Promise<void> {
    const existing = await this.getShareVotes(shareSlug);
    const idx = existing.findIndex(v => v.voterName === voteEntry.voterName);
    if (idx >= 0) {
      existing[idx] = voteEntry;
    } else {
      existing.push(voteEntry);
    }
    this.db.prepare('UPDATE shares SET votes = ? WHERE shareSlug = ?').run(JSON.stringify(existing), shareSlug);
  }

  async savePaymentRecord(params: {
    userId: string;
    transactionId: string;
    amount: number;
    method: 'meituan' | 'wechat' | 'alipay';
    orderTitle: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
  }): Promise<PersistedPaymentRecord> {
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

    this.db.prepare(
      'INSERT OR REPLACE INTO payments (id, userId, transactionId, amount, method, orderTitle, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(record.id, record.userId, record.transactionId, record.amount, record.method, record.orderTitle, record.status, record.createdAt, record.updatedAt);

    return record;
  }

  async getPaymentByTransactionId(transactionId: string): Promise<PersistedPaymentRecord | null> {
    const row = this.db.prepare('SELECT * FROM payments WHERE transactionId = ?').get(transactionId) as PaymentRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      transactionId: row.transactionId,
      amount: row.amount,
      method: row.method as PersistedPaymentRecord['method'],
      orderTitle: row.orderTitle,
      status: row.status as PersistedPaymentRecord['status'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ========== 订单相关方法 ==========

  async createOrder(order: Omit<OrderRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderRow> {
    return this.orderRepo.createOrder(order);
  }

  async getOrderById(id: string): Promise<OrderRow | null> {
    return this.orderRepo.getOrderById(id);
  }

  async getOrdersByUserId(userId: string, status?: OrderStatus): Promise<OrderRow[]> {
    return this.orderRepo.getOrdersByUserId(userId, status);
  }

  async getOrdersByPlanId(planId: string): Promise<OrderRow[]> {
    return this.orderRepo.getOrdersByPlanId(planId);
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    return this.orderRepo.updateOrderStatus(id, status);
  }

  async updateOrderRefund(id: string, refundStatus: RefundStatus, reason?: string): Promise<void> {
    return this.orderRepo.updateOrderRefund(id, refundStatus, reason);
  }

  async cancelOrder(id: string): Promise<void> {
    return this.orderRepo.cancelOrder(id);
  }

  async deleteOrder(id: string): Promise<void> {
    return this.orderRepo.deleteOrder(id);
  }

  // ========== 用户偏好方法 ==========

  async getUserPreferences(userId: string): Promise<{
    favoriteCategories: string[];
    avoidCategories: string[];
    priceRange: { min: number; max: number };
    preferredTime: string;
    dietaryRestrictions: string[];
    recentSearches: string[];
  } | null> {
    const row = this.db.prepare(
      'SELECT * FROM user_preferences WHERE userId = ?'
    ).get(userId) as {
      userId: string;
      favoriteCategories: string;
      avoidCategories: string;
      priceRangeMin: number;
      priceRangeMax: number;
      preferredTime: string;
      dietaryRestrictions: string;
      recentSearches: string;
    } | undefined;
    if (!row) return null;
    return {
      favoriteCategories: parseJson<string[]>(row.favoriteCategories, []),
      avoidCategories: parseJson<string[]>(row.avoidCategories, []),
      priceRange: { min: row.priceRangeMin, max: row.priceRangeMax },
      preferredTime: row.preferredTime,
      dietaryRestrictions: parseJson<string[]>(row.dietaryRestrictions, []),
      recentSearches: parseJson<string[]>(row.recentSearches, []),
    };
  }

  async upsertUserPreferences(userId: string, prefs: {
    favoriteCategories?: string[];
    avoidCategories?: string[];
    priceRange?: { min: number; max: number };
    preferredTime?: string;
    dietaryRestrictions?: string[];
    recentSearches?: string[];
  }): Promise<void> {
    const existing = await this.getUserPreferences(userId);
    const merged = {
      favoriteCategories: prefs.favoriteCategories ?? existing?.favoriteCategories ?? [],
      avoidCategories: prefs.avoidCategories ?? existing?.avoidCategories ?? [],
      priceRangeMin: prefs.priceRange?.min ?? existing?.priceRange.min ?? 0,
      priceRangeMax: prefs.priceRange?.max ?? existing?.priceRange.max ?? 1000,
      preferredTime: prefs.preferredTime ?? existing?.preferredTime ?? 'any',
      dietaryRestrictions: prefs.dietaryRestrictions ?? existing?.dietaryRestrictions ?? [],
      recentSearches: prefs.recentSearches ?? existing?.recentSearches ?? [],
    };
    this.db.prepare(`
      INSERT INTO user_preferences (userId, favoriteCategories, avoidCategories, priceRangeMin, priceRangeMax, preferredTime, dietaryRestrictions, recentSearches, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId) DO UPDATE SET
        favoriteCategories = excluded.favoriteCategories,
        avoidCategories = excluded.avoidCategories,
        priceRangeMin = excluded.priceRangeMin,
        priceRangeMax = excluded.priceRangeMax,
        preferredTime = excluded.preferredTime,
        dietaryRestrictions = excluded.dietaryRestrictions,
        recentSearches = excluded.recentSearches,
        lastUpdated = excluded.lastUpdated
    `).run(
      userId,
      JSON.stringify(merged.favoriteCategories),
      JSON.stringify(merged.avoidCategories),
      merged.priceRangeMin,
      merged.priceRangeMax,
      merged.preferredTime,
      JSON.stringify(merged.dietaryRestrictions),
      JSON.stringify(merged.recentSearches),
      Date.now()
    );
  }

  // ========== 行为事件方法 ==========

  async trackBehaviorEvent(event: {
    id: string;
    userId: string;
    type: string;
    planId?: string;
    activityId?: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
  }): Promise<void> {
    this.db.prepare(`
      INSERT INTO user_behavior_events (id, userId, type, planId, activityId, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.userId,
      event.type,
      event.planId || null,
      event.activityId || null,
      JSON.stringify(event.metadata || {}),
      event.timestamp
    );
  }

  async getBehaviorEvents(userId: string, options?: {
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
  }>> {
    let sql = 'SELECT * FROM user_behavior_events WHERE userId = ?';
    const params: unknown[] = [userId];

    if (options?.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options?.since) {
      sql += ' AND timestamp >= ?';
      params.push(options.since);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      type: string;
      planId: string | null;
      activityId: string | null;
      metadata: string;
      timestamp: number;
    }>;

    return rows.map(row => ({
      ...row,
      metadata: parseJson<Record<string, unknown>>(row.metadata, {}),
    }));
  }

  async getBehaviorStats(userId: string): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    topActivities: Array<{ activityId: string; count: number }>;
  }> {
    const totalRow = this.db.prepare(
      'SELECT COUNT(*) as count FROM user_behavior_events WHERE userId = ?'
    ).get(userId) as { count: number };

    const byTypeRows = this.db.prepare(
      'SELECT type, COUNT(*) as count FROM user_behavior_events WHERE userId = ? GROUP BY type'
    ).all(userId) as Array<{ type: string; count: number }>;

    const topRows = this.db.prepare(
      'SELECT activityId, COUNT(*) as count FROM user_behavior_events WHERE userId = ? AND activityId IS NOT NULL GROUP BY activityId ORDER BY count DESC LIMIT 10'
    ).all(userId) as Array<{ activityId: string; count: number }>;

    const byType: Record<string, number> = {};
    for (const row of byTypeRows) {
      byType[row.type] = row.count;
    }

    return {
      totalEvents: totalRow.count,
      byType,
      topActivities: topRows,
    };
  }

}

// Small helper for mkdir
function mkdirSync(dir: string): void {
  nodeMkdirSync(dir, { recursive: true });
}
