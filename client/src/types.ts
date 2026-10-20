export interface Brand {
  id: string;
  name: string;
  industry: string;
  logo_url: string;
  total_budget: number;
  allocated_budget: number;
  spent_budget: number;
  created_at: string;
}

export interface Agency {
  id: string;
  name: string;
  contact_email: string;
  logo_url: string;
  brands?: {
    agency_id: string;
    brand_id: string;
    brand_name: string;
    total_budget: number;
    spent_budget: number;
  }[];
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar_url: string;
  bio: string;
  primary_niche: string;
  secondary_niches: string[];
  platforms: string[];
  follower_count: number;
  engagement_rate: number;
  rate_post: number;
  rate_reel: number;
  rate_video: number;
  rate_story: number;
  audience_top_country: string;
  audience_top_age: string;
  audience_gender_ratio: string;
  wallet_balance: number;
  escrow_pending: number;
  completed_campaigns: number;
  verified: number;
  rating: number;
}

export interface Campaign {
  id: string;
  brand_id: string;
  brand_name?: string;
  agency_id?: string;
  title: string;
  brief: string;
  objectives: string;
  target_niches: string[];
  target_audience: string;
  content_guidelines: string;
  required_deliverables: string[];
  budget: number;
  spent: number;
  escrow_locked: number;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'COMPLETED';
  start_date: string;
  end_date: string;
  collaborations?: Collaboration[];
}

export interface Collaboration {
  id: string;
  campaign_id: string;
  campaign_title?: string;
  brand_name?: string;
  creator_id: string;
  creator_name?: string;
  creator_handle?: string;
  avatar_url?: string;
  primary_niche?: string;
  proposed_rate: number;
  agreed_rate?: number;
  status: 'OFFERED' | 'NEGOTIATING' | 'ACCEPTED' | 'IN_PROGRESS' | 'DELIVERABLE_SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  initiated_by: 'HUMAN' | 'AGENT';
  agent_session_id?: string;
  terms: string;
  deadline: string;
  created_at: string;
  deliverables?: Deliverable[];
}

export interface Deliverable {
  id: string;
  collaboration_id: string;
  deliverable_type: string;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  content_url?: string;
  caption?: string;
  verification_notes?: string;
  metrics_json?: string;
  submitted_at?: string;
  approved_at?: string;
}

export interface ApprovalCheckpoint {
  id: string;
  agent_session_id: string;
  agent_name?: string;
  campaign_id: string;
  campaign_title?: string;
  action_type: 'PAYMENT_ABOVE_THRESHOLD' | 'OUT_OF_BAND_RATE' | 'BRIEF_MODIFICATION' | 'BUDGET_OVERRUN';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  amount?: number;
  tool_name: string;
  payload: any;
  justification: string;
  reviewer_notes?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export interface LedgerEntry {
  id: string;
  campaign_id: string;
  campaign_title?: string;
  collaboration_id?: string;
  actor_type: 'HUMAN' | 'AGENT';
  actor_id: string;
  entry_type: 'BUDGET_ALLOCATION' | 'ESCROW_HOLD' | 'PAYOUT_RELEASE' | 'REFUND';
  amount: number;
  currency: string;
  balance_after: number;
  note: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_type: 'HUMAN' | 'AGENT';
  actor_id: string;
  session_id?: string;
  campaign_id?: string;
  tool_name: string;
  parameters: any;
  execution_status: 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';
  result_summary: string;
  guardrail_notes: string;
  duration_ms: number;
}

export interface EvaluationBenchmark {
  id: string;
  scenario_name: string;
  workflow_type: 'MANUAL' | 'AGENTIC';
  time_to_launch_sec: number;
  operational_cost_minutes: number;
  creator_matching_accuracy_pct: number;
  creators_evaluated: number;
  offers_sent: number;
  approvals_required: number;
  run_timestamp: string;
  notes: string;
}

export interface AgentSession {
  id: string;
  name: string;
  campaign_id?: string;
  role_scope: string;
  allowed_tools: string[];
  budget_ceiling: number;
  rate_ceiling: number;
  spent_amount: number;
  status: string;
}
