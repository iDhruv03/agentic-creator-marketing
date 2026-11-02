-- ============================================================================
-- Creator Marketing Infrastructure (CMI) — Shared Data Layer
-- Single source of truth consumed identically by the human dashboard (REST)
-- and the governed MCP server. Only the Infrastructure Core writes here.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Identity & actors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('BRAND','AGENCY','CREATOR','ADMIN')),
  brand_id      TEXT,
  agency_id     TEXT,
  creator_id    TEXT,
  avatar_url    TEXT,
  title         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS brands (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  industry      TEXT NOT NULL,
  logo_url      TEXT,
  website       TEXT,
  description   TEXT,
  total_budget  REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agencies (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  logo_url      TEXT,
  description   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS agency_brands (
  agency_id   TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  brand_id    TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (agency_id, brand_id)
);

-- ---------------------------------------------------------------------------
-- Creator marketplace
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creators (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  handle              TEXT NOT NULL UNIQUE,
  avatar_url          TEXT,
  cover_url           TEXT,
  bio                 TEXT,
  location            TEXT,
  primary_niche       TEXT NOT NULL,
  secondary_niches    TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  platforms           TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  platform_stats      TEXT NOT NULL DEFAULT '[]',   -- JSON [{platform, handle, followers, engagement_rate, avg_views}]
  audience            TEXT NOT NULL DEFAULT '{}',   -- JSON {countries:[{name,pct}], ages:[{range,pct}], gender:{female,male,other}}
  portfolio           TEXT NOT NULL DEFAULT '[]',   -- JSON [{title, platform, url, views, brand}]
  content_tags        TEXT NOT NULL DEFAULT '[]',   -- JSON string[] (tone / format tags)
  follower_count      INTEGER NOT NULL,
  engagement_rate     REAL NOT NULL,
  avg_views           INTEGER NOT NULL DEFAULT 0,
  rate_post           REAL NOT NULL,
  rate_reel           REAL NOT NULL,
  rate_video          REAL NOT NULL,
  rate_story          REAL NOT NULL,
  verified            INTEGER NOT NULL DEFAULT 1,
  rating              REAL NOT NULL DEFAULT 4.8,
  completed_campaigns INTEGER NOT NULL DEFAULT 0,
  response_time_hours REAL NOT NULL DEFAULT 24,
  wallet_balance      REAL NOT NULL DEFAULT 0,
  available           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- Campaign engine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id                    TEXT PRIMARY KEY,
  brand_id              TEXT NOT NULL REFERENCES brands(id),
  agency_id             TEXT REFERENCES agencies(id),
  title                 TEXT NOT NULL,
  brief                 TEXT NOT NULL DEFAULT '',
  objectives            TEXT NOT NULL DEFAULT '',
  target_niches         TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  target_platforms      TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  target_audience       TEXT NOT NULL DEFAULT '',
  content_guidelines    TEXT NOT NULL DEFAULT '',
  required_deliverables TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  budget                REAL NOT NULL DEFAULT 0,
  rate_band_min         REAL,
  rate_band_max         REAL,
  status                TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  start_date            TEXT,
  end_date              TEXT,
  created_by            TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS campaign_shortlist (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id  TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  match_score REAL NOT NULL DEFAULT 0,
  rationale   TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN ('SUGGESTED','APPROVED','REJECTED')),
  added_by    TEXT NOT NULL DEFAULT 'HUMAN',    -- HUMAN | AGENT
  actor_id    TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (campaign_id, creator_id)
);

-- ---------------------------------------------------------------------------
-- Contracts & deliverables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collaborations (
  id               TEXT PRIMARY KEY,
  campaign_id      TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id       TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  proposed_rate    REAL NOT NULL,
  agreed_rate      REAL,
  status           TEXT NOT NULL DEFAULT 'OFFERED' CHECK (status IN (
                     'OFFERED','COUNTERED','ACCEPTED','IN_PROGRESS','SUBMITTED','APPROVED','COMPLETED','DECLINED','CANCELLED')),
  initiated_by     TEXT NOT NULL DEFAULT 'HUMAN',   -- HUMAN | AGENT
  agent_session_id TEXT,
  terms            TEXT NOT NULL DEFAULT '',
  usage_rights     TEXT NOT NULL DEFAULT 'Organic social usage, 90 days',
  exclusivity_days INTEGER NOT NULL DEFAULT 0,
  deadline         TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS negotiation_messages (
  id               TEXT PRIMARY KEY,
  collaboration_id TEXT NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  sender_type      TEXT NOT NULL,   -- BRAND | AGENCY | CREATOR | AGENT | SYSTEM
  sender_id        TEXT NOT NULL,
  sender_name      TEXT NOT NULL DEFAULT '',
  kind             TEXT NOT NULL DEFAULT 'MESSAGE',   -- MESSAGE | OFFER | COUNTER | ACCEPT | DECLINE | SYSTEM
  amount           REAL,
  body             TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS deliverables (
  id               TEXT PRIMARY KEY,
  collaboration_id TEXT NOT NULL REFERENCES collaborations(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,   -- POST | REEL | STORY | YOUTUBE_VIDEO | YOUTUBE_SHORT | TIKTOK_VIDEO
  platform         TEXT NOT NULL DEFAULT 'instagram',
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUBMITTED','CHANGES_REQUESTED','APPROVED','PAID')),
  content_url      TEXT,
  caption          TEXT,
  compliance       TEXT,            -- JSON {passed, checks:[{id,label,passed,detail}]}
  metrics          TEXT,            -- JSON {views, likes, comments, shares, saves, engagement_rate, clicks}
  review_notes     TEXT,
  submitted_at     TEXT,
  approved_at      TEXT,
  paid_at          TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- Double-entry financial ledger
-- Every movement of money names the account debited and credited.
-- Account naming: brand:<id>:budget, campaign:<id>:available,
--                 campaign:<id>:escrow, creator:<id>:wallet
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
  id               TEXT PRIMARY KEY,
  seq              INTEGER NOT NULL,
  campaign_id      TEXT NOT NULL REFERENCES campaigns(id),
  collaboration_id TEXT REFERENCES collaborations(id),
  deliverable_id   TEXT,
  actor_type       TEXT NOT NULL,   -- HUMAN | AGENT | SYSTEM
  actor_id         TEXT NOT NULL,
  entry_type       TEXT NOT NULL CHECK (entry_type IN (
                     'BUDGET_ALLOCATION','BUDGET_ADJUSTMENT','ESCROW_HOLD','ESCROW_RELEASE','ESCROW_REFUND','PAYOUT_RELEASE')),
  debit_account    TEXT NOT NULL,
  credit_account   TEXT NOT NULL,
  amount           REAL NOT NULL CHECK (amount >= 0),
  currency         TEXT NOT NULL DEFAULT 'USD',
  note             TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- Agent sessions, runs & governance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_sessions (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  brand_id       TEXT REFERENCES brands(id),
  agency_id      TEXT REFERENCES agencies(id),
  campaign_id    TEXT REFERENCES campaigns(id),
  role_scope     TEXT NOT NULL CHECK (role_scope IN ('DISCOVERY_ONLY','CAMPAIGN_MANAGER','FULL_OPERATOR')),
  allowed_tools  TEXT NOT NULL DEFAULT '[]',   -- JSON string[]
  budget_ceiling REAL NOT NULL DEFAULT 0,
  rate_ceiling   REAL NOT NULL DEFAULT 0,
  spent_amount   REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','REVOKED','COMPLETED')),
  model          TEXT NOT NULL DEFAULT 'claude-opus-5-5',
  instructions   TEXT NOT NULL DEFAULT '',
  created_by     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id                 TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL REFERENCES agent_sessions(id),
  campaign_id        TEXT REFERENCES campaigns(id),
  goal               TEXT NOT NULL,
  mode               TEXT NOT NULL DEFAULT 'SIMULATED',   -- LLM | SIMULATED
  model              TEXT,
  status             TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING','COMPLETED','FAILED','CANCELLED')),
  summary            TEXT,
  steps_count        INTEGER NOT NULL DEFAULT 0,
  checkpoints_count  INTEGER NOT NULL DEFAULT 0,
  blocked_count      INTEGER NOT NULL DEFAULT 0,
  spend_committed    REAL NOT NULL DEFAULT 0,
  input_tokens       INTEGER NOT NULL DEFAULT 0,
  output_tokens      INTEGER NOT NULL DEFAULT 0,
  started_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at        TEXT
);

CREATE TABLE IF NOT EXISTS agent_run_events (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  seq        INTEGER NOT NULL,
  type       TEXT NOT NULL,   -- status | thinking | text | tool_call | tool_result | checkpoint | guardrail | done | error
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS approval_checkpoints (
  id               TEXT PRIMARY KEY,
  agent_session_id TEXT NOT NULL REFERENCES agent_sessions(id),
  run_id           TEXT,
  campaign_id      TEXT REFERENCES campaigns(id),
  action_type      TEXT NOT NULL,   -- PAYMENT_ABOVE_THRESHOLD | OUT_OF_BAND_RATE | BRIEF_MODIFICATION | AGENT_ESCALATION | BUDGET_EXCEEDED
  risk_level       TEXT NOT NULL DEFAULT 'MEDIUM',   -- LOW | MEDIUM | HIGH
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  amount           REAL,
  tool_name        TEXT NOT NULL,
  payload_json     TEXT NOT NULL DEFAULT '{}',
  justification    TEXT NOT NULL DEFAULT '',
  reviewer_notes   TEXT,
  resolved_by      TEXT,
  executed_result  TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at      TEXT
);

-- Append-only, hash-chained audit log. Triggers make UPDATE/DELETE impossible.
CREATE TABLE IF NOT EXISTS audit_logs (
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  id               TEXT NOT NULL UNIQUE,
  timestamp        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor_type       TEXT NOT NULL,   -- HUMAN | AGENT | SYSTEM
  actor_id         TEXT NOT NULL,
  actor_name       TEXT,
  session_id       TEXT,
  run_id           TEXT,
  campaign_id      TEXT,
  tool_name        TEXT NOT NULL,
  parameters_json  TEXT NOT NULL DEFAULT '{}',
  execution_status TEXT NOT NULL,   -- SUCCESS | REJECTED_BY_GUARDRAIL | HELD_FOR_APPROVAL | FAILED
  result_summary   TEXT NOT NULL DEFAULT '',
  guardrail_notes  TEXT NOT NULL DEFAULT '',
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  prev_hash        TEXT NOT NULL,
  hash             TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

-- ---------------------------------------------------------------------------
-- Notifications & evaluation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  audience    TEXT NOT NULL,   -- BRAND | AGENCY | CREATOR
  audience_id TEXT NOT NULL,   -- brand_id | agency_id | creator_id
  kind        TEXT NOT NULL DEFAULT 'INFO',   -- INFO | CHECKPOINT | OFFER | DELIVERABLE | PAYMENT | AGENT
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  link        TEXT,
  read        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id                     TEXT PRIMARY KEY,
  scenario_name          TEXT NOT NULL,
  scenario_key           TEXT NOT NULL DEFAULT 'custom',
  workflow_type          TEXT NOT NULL CHECK (workflow_type IN ('MANUAL','AGENTIC')),
  time_to_launch_sec     REAL NOT NULL,
  human_minutes          REAL NOT NULL,
  matching_accuracy_pct  REAL NOT NULL,
  creators_evaluated     INTEGER NOT NULL DEFAULT 0,
  offers_sent            INTEGER NOT NULL DEFAULT 0,
  approvals_required     INTEGER NOT NULL DEFAULT 0,
  agent_run_id           TEXT,
  notes                  TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_creators_niche       ON creators(primary_niche);
CREATE INDEX IF NOT EXISTS idx_creators_followers   ON creators(follower_count);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand      ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status     ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_shortlist_campaign   ON campaign_shortlist(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collab_campaign      ON collaborations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collab_creator       ON collaborations(creator_id);
CREATE INDEX IF NOT EXISTS idx_collab_status        ON collaborations(status);
CREATE INDEX IF NOT EXISTS idx_negotiation_collab   ON negotiation_messages(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_collab  ON deliverables(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_ledger_campaign      ON ledger_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ledger_collab        ON ledger_entries(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_ledger_seq           ON ledger_entries(seq);
CREATE INDEX IF NOT EXISTS idx_sessions_campaign    ON agent_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_runs_session         ON agent_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_run_events_run       ON agent_run_events(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status   ON approval_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_checkpoints_campaign ON approval_checkpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp      ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_campaign       ON audit_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_session        ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(audience, audience_id, read);
