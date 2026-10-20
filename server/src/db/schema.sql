-- Creator Marketing Infrastructure (CMI) Database Schema
-- Shared Data Layer for Brands, Agencies, Creators, and Autonomous AI Marketing Agents

-- 1. Brands Table
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  logo_url TEXT,
  total_budget REAL DEFAULT 0,
  allocated_budget REAL DEFAULT 0,
  spent_budget REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agencies Table (Section 5.2: Multi-client workspace for agencies managing several brands)
CREATE TABLE IF NOT EXISTS agencies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  logo_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Agency-Brand Relationship Table (Client-level separation of budgets & reporting)
CREATE TABLE IF NOT EXISTS agency_brands (
  agency_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agency_id, brand_id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- 4. Creators Table (Section 5.2, 5.5: Profiles, media kit, rates, metrics, niches)
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  primary_niche TEXT NOT NULL,
  secondary_niches TEXT, -- JSON array of strings
  platforms TEXT, -- JSON array of strings: e.g. ["instagram", "youtube", "tiktok"]
  follower_count INTEGER NOT NULL,
  engagement_rate REAL NOT NULL, -- e.g. 4.2 (%)
  rate_post REAL NOT NULL,
  rate_reel REAL NOT NULL,
  rate_video REAL NOT NULL,
  rate_story REAL NOT NULL,
  audience_top_country TEXT DEFAULT 'United States',
  audience_top_age TEXT DEFAULT '18-34',
  audience_gender_ratio TEXT DEFAULT '54% Female / 46% Male',
  verified INTEGER DEFAULT 1,
  rating REAL DEFAULT 4.9,
  completed_campaigns INTEGER DEFAULT 0,
  wallet_balance REAL DEFAULT 0,
  escrow_pending REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Campaigns Table (Section 5.5: Campaigns records)
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  agency_id TEXT,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  objectives TEXT,
  target_niches TEXT, -- JSON array
  target_audience TEXT,
  content_guidelines TEXT,
  required_deliverables TEXT, -- JSON array of strings: ["1x YouTube Video", "1x Instagram Reel"]
  budget REAL NOT NULL,
  spent REAL DEFAULT 0,
  escrow_locked REAL DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE', -- DRAFT, ACTIVE, PAUSED, COMPLETED
  start_date TEXT,
  end_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (brand_id) REFERENCES brands(id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- 6. Collaborations Table (Section 5.5: Specific offer between a campaign and creator)
CREATE TABLE IF NOT EXISTS collaborations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  proposed_rate REAL NOT NULL,
  agreed_rate REAL,
  status TEXT DEFAULT 'OFFERED', 
  -- OFFERED, NEGOTIATING, ACCEPTED, IN_PROGRESS, DELIVERABLE_SUBMITTED, APPROVED, COMPLETED, REJECTED
  initiated_by TEXT NOT NULL, -- 'HUMAN' or 'AGENT'
  agent_session_id TEXT,
  terms TEXT,
  deadline TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

-- 7. Deliverables Table (Agreed content submissions and tracking)
CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  collaboration_id TEXT NOT NULL,
  deliverable_type TEXT NOT NULL, -- 'POST', 'REEL', 'YOUTUBE_VIDEO', 'TIKTOK_VIDEO', 'STORY'
  status TEXT DEFAULT 'PENDING', -- PENDING, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
  content_url TEXT,
  caption TEXT,
  verification_notes TEXT,
  metrics_json TEXT, -- JSON: views, likes, comments, engagement
  submitted_at DATETIME,
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collaboration_id) REFERENCES collaborations(id) ON DELETE CASCADE
);

-- 8. Ledger Entries Table (Section 5.5: Traceable budget allocations, escrow holds, payout releases)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  collaboration_id TEXT,
  actor_type TEXT NOT NULL, -- 'HUMAN' or 'AGENT'
  actor_id TEXT NOT NULL,
  entry_type TEXT NOT NULL, -- 'BUDGET_ALLOCATION', 'ESCROW_HOLD', 'PAYOUT_RELEASE', 'REFUND'
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  balance_after REAL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (collaboration_id) REFERENCES collaborations(id)
);

-- 9. Agent Sessions Table (Section 5.2, 9: AI Marketing Agent permissions & budget constraints)
CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_id TEXT,
  role_scope TEXT NOT NULL, -- 'DISCOVERY_ONLY', 'CAMPAIGN_MANAGER', 'FULL_OPERATOR'
  allowed_tools TEXT NOT NULL, -- JSON array of tool names
  budget_ceiling REAL NOT NULL,
  rate_ceiling REAL NOT NULL,
  spent_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAUSED', 'COMPLETED'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- 10. Human-Approval Checkpoints Table (Section 9: High-impact actions held for approval)
CREATE TABLE IF NOT EXISTS approval_checkpoints (
  id TEXT PRIMARY KEY,
  agent_session_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  action_type TEXT NOT NULL, 
  -- 'PAYMENT_ABOVE_THRESHOLD', 'OUT_OF_BAND_RATE', 'BRIEF_MODIFICATION', 'BUDGET_EXCEEDED'
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
  amount REAL,
  tool_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  justification TEXT,
  reviewer_notes TEXT,
  resolved_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (agent_session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- 11. Immutable Audit Logs Table (Section 9: Append-only log of every agent and human action)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actor_type TEXT NOT NULL, -- 'HUMAN' or 'AGENT'
  actor_id TEXT NOT NULL,
  session_id TEXT,
  campaign_id TEXT,
  tool_name TEXT NOT NULL,
  parameters_json TEXT,
  execution_status TEXT NOT NULL, 
  -- 'SUCCESS', 'REJECTED_BY_GUARDRAIL', 'HELD_FOR_APPROVAL', 'FAILED'
  result_summary TEXT,
  guardrail_notes TEXT,
  duration_ms INTEGER DEFAULT 0
);

-- 12. Evaluation Benchmarks Table (Section 10: Matched experiment results)
CREATE TABLE IF NOT EXISTS evaluation_benchmarks (
  id TEXT PRIMARY KEY,
  scenario_name TEXT NOT NULL,
  workflow_type TEXT NOT NULL, -- 'MANUAL' or 'AGENTIC'
  time_to_launch_sec REAL NOT NULL, -- Time from brief creation to 1st offer sent
  operational_cost_minutes REAL NOT NULL, -- Human labor minutes spent
  creator_matching_accuracy_pct REAL NOT NULL, -- % of shortlisted creators approved
  creators_evaluated INTEGER NOT NULL,
  offers_sent INTEGER NOT NULL,
  approvals_required INTEGER NOT NULL,
  run_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Indexes for fast query performance across both REST API and MCP tool executions
CREATE INDEX IF NOT EXISTS idx_creators_niche ON creators(primary_niche);
CREATE INDEX IF NOT EXISTS idx_creators_followers ON creators(follower_count);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_campaign ON collaborations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_creator ON collaborations(creator_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_collab ON deliverables(collaboration_id);
CREATE INDEX IF NOT EXISTS idx_ledger_campaign ON ledger_entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON approval_checkpoints(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
