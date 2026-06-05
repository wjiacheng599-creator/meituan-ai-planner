CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  age_group TEXT NOT NULL,
  dietary_preferences_json TEXT NOT NULL,
  travel_preferences_json TEXT NOT NULL,
  avoid_preferences_json TEXT,
  budget TEXT,
  mobility TEXT,
  special_needs_json TEXT,
  favorite_activities_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

CREATE TABLE IF NOT EXISTS planner_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  query_draft TEXT,
  status TEXT NOT NULL,
  selected_profile_ids_json TEXT NOT NULL,
  time_pref TEXT,
  target_type TEXT,
  collab_strategy TEXT,
  tie_breaker TEXT,
  active_plan_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON planner_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON planner_sessions(updated_at);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  city TEXT NOT NULL,
  date TEXT,
  duration_tags TEXT,
  tags_json TEXT NOT NULL,
  strategy TEXT NOT NULL,
  conflict_resolution TEXT NOT NULL,
  total_price REAL NOT NULL,
  status TEXT NOT NULL,
  source_query TEXT,
  weather_json TEXT,
  collaboration_json TEXT,
  execution_readiness_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);
CREATE INDEX IF NOT EXISTS idx_plans_updated_at ON plans(updated_at);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  time_line TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  price REAL NOT NULL,
  distance_info TEXT,
  tags_json TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  team_fit TEXT NOT NULL,
  image_url TEXT,
  provider_payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_plan_id ON activities(plan_id);
CREATE INDEX IF NOT EXISTS idx_activities_plan_sequence ON activities(plan_id, sequence_no);

CREATE TABLE IF NOT EXISTS plan_task_states (
  plan_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  selected_activity_ids_json TEXT NOT NULL,
  booked_activity_ids_json TEXT NOT NULL,
  completed_activity_ids_json TEXT NOT NULL,
  last_updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_runs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  answer TEXT,
  total_tool_calls INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_execution_runs_plan_id ON execution_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_execution_runs_started_at ON execution_runs(started_at);

CREATE TABLE IF NOT EXISTS tool_call_logs (
  id TEXT PRIMARY KEY,
  execution_run_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  tool_label TEXT,
  input_json TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  result_json TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_logs_execution_run_id ON tool_call_logs(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_name ON tool_call_logs(tool_name);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  title TEXT NOT NULL,
  paragraphs_json TEXT NOT NULL,
  highlights_json TEXT NOT NULL,
  template TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stories_plan_id ON stories(plan_id);

CREATE TABLE IF NOT EXISTS share_artifacts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  share_slug TEXT NOT NULL UNIQUE,
  share_title TEXT NOT NULL,
  share_summary TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_share_artifacts_plan_id ON share_artifacts(plan_id);
CREATE INDEX IF NOT EXISTS idx_share_artifacts_slug ON share_artifacts(share_slug);
