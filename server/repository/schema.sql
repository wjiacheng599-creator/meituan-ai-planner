-- SQLite schema for meituan-ai-planner
-- Migrated from JSON file storage to normalized tables

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  isAnonymous INTEGER NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL
);

-- Person profiles linked to users
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  ageGroup TEXT NOT NULL,
  dietaryPreferences TEXT NOT NULL DEFAULT '[]',    -- JSON string array
  travelPreferences TEXT NOT NULL DEFAULT '[]',     -- JSON string array
  avoidPreferences TEXT,                            -- JSON string array
  budget TEXT,
  mobility TEXT,
  specialNeeds TEXT,                                -- JSON string array
  favoriteActivities TEXT,                          -- JSON string array
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_userId ON profiles(userId);

-- Sessions (conversation sessions)
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
  selectedProfileIds TEXT,                          -- JSON string array
  timePref TEXT,
  targetType TEXT,
  collabStrategy TEXT,
  tieBreaker TEXT,
  memberVotes TEXT,                                 -- JSON Record<string, string[]>
  memberAvoids TEXT,                                -- JSON Record<string, string[]>
  tempProfiles TEXT,                                -- JSON PersonProfile[]
  messages TEXT,                                    -- JSON unknown[]
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_updatedAt ON sessions(updatedAt DESC);

-- Saved plans
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  sourceQuery TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL,                               -- JSON Plan object
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_plans_userId ON plans(userId);
CREATE INDEX IF NOT EXISTS idx_plans_updatedAt ON plans(updatedAt DESC);

-- Planner task states (1:1 with plans, keyed by planId)
CREATE TABLE IF NOT EXISTS plannerTaskStates (
  planId TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'planned',
  selectedActivityIds TEXT NOT NULL DEFAULT '[]',   -- JSON string array
  bookedActivityIds TEXT NOT NULL DEFAULT '[]',     -- JSON string array
  completedActivityIds TEXT NOT NULL DEFAULT '[]',  -- JSON string array
  lastUpdatedAt INTEGER NOT NULL
);

-- Execution runs
CREATE TABLE IF NOT EXISTS executionRuns (
  id TEXT PRIMARY KEY,
  planId TEXT NOT NULL,
  userId TEXT NOT NULL,
  activityIds TEXT NOT NULL DEFAULT '[]',           -- JSON string array
  result TEXT NOT NULL,                             -- JSON AgentResult
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_executionRuns_planId ON executionRuns(planId);
CREATE INDEX IF NOT EXISTS idx_executionRuns_userId ON executionRuns(userId);

-- Stories (1 per user+plan)
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  planId TEXT NOT NULL,
  userId TEXT NOT NULL,
  story TEXT NOT NULL,                              -- JSON AIStoryContent
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_userId_planId ON stories(userId, planId);

-- Share records
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  shareSlug TEXT NOT NULL UNIQUE,
  planId TEXT NOT NULL,
  userId TEXT NOT NULL,
  shareTitle TEXT NOT NULL,
  shareSummary TEXT,
  snapshot TEXT NOT NULL,                           -- JSON {plan, profiles, taskState}
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shares_shareSlug ON shares(shareSlug);
CREATE INDEX IF NOT EXISTS idx_shares_userId_planId ON shares(userId, planId);

-- Payment records
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
