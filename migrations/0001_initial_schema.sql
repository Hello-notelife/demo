PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  pet_tone TEXT NOT NULL DEFAULT 'direct'
    CHECK (pet_tone IN ('gentle', 'direct', 'cold')),
  last_completed_day TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'deep', 'offline')),
  provider TEXT NOT NULL,
  model TEXT,
  answers_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  future_json TEXT,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (session_id) REFERENCES anonymous_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS api_usage (
  session_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, window_start),
  FOREIGN KEY (session_id) REFERENCES anonymous_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_simulations_session_created
  ON simulations(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulations_session_completed
  ON simulations(session_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_usage_window
  ON api_usage(window_start);
