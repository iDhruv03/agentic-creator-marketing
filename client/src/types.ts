/* API types mirrored from server/src/core. Keep in sync when the core changes. */

export type Role = 'BRAND' | 'AGENCY' | 'CREATOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  brand_id: string | null;
  agency_id: string | null;
  creator_id: string | null;
  avatar_url: string | null;
  title: string | null;
  created_at: string;
}

export interface Persona {
  id: string; email: string; name: string; role: Role; title: string | null; avatar_url: string | null; org: string | null;
}

export interface Me {
  user: User;
  org: { id: string; name: string; industry?: string; logo_url?: string | null; handle?: string; avatar_url?: string | null } | null;
  unread_notifications: number;
}

export interface Brand {
  id: string; name: string; industry: string; logo_url: string | null; website: string | null; description: string | null; total_budget: number; created_at: string;
  campaigns_count?: number; active_campaigns?: number; allocated_budget?: number; spent_budget?: number; escrow_budget?: number;
}

export interface AgencyClient extends Brand { budget: number; spent: number; escrow: number; pending_checkpoints: number }
export interface Agency { id: string; name: string; contact_email: string; logo_url: string | null; description: string | null; clients: AgencyClient[] }

export interface PlatformStat { platform: string; handle: string; followers: number; engagement_rate: number; avg_views: number }
export interface Audience { countries: { name: string; pct: number }[]; ages: { range: string; pct: number }[]; gender: { female: number; male: number; other: number } }
export interface PortfolioItem { title: string; platform: string; url: string; views?: number; brand?: string }

export interface Creator {
  id: string; name: string; handle: string; avatar_url: string | null; cover_url: string | null; bio: string | null; location: string | null;
  primary_niche: string; secondary_niches: string[]; platforms: string[]; platform_stats: PlatformStat[]; audience: Audience; portfolio: PortfolioItem[]; content_tags: string[];
  follower_count: number; engagement_rate: number; avg_views: number; rate_post: number; rate_reel: number; rate_video: number; rate_story: number;
  verified: number; rating: number; completed_campaigns: number; response_time_hours: number; available: number; wallet_balance?: number; created_at: string;
  match_score?: number; match_breakdown?: MatchBreakdown; match_reasons?: string[];
  collaborations?: Collaboration[]; analytics?: CreatorAnalytics;
}

export interface CreatorProfilePatch {
  name?: string; bio?: string; location?: string; primary_niche?: string; secondary_niches?: string[]; content_tags?: string[];
  rate_post?: number; rate_reel?: number; rate_video?: number; rate_story?: number; available?: boolean; response_time_hours?: number; portfolio?: PortfolioItem[];
}

export interface MatchBreakdown { niche: number; audience: number; performance: number; budget_fit: number; reliability: number }

export interface RateBenchmark { sample_size: number; p25: number; median: number; p75: number; suggested: number; tier: string }

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface CampaignFinancials { budget: number; escrow_locked: number; spent: number; available: number; committed: number; utilisation_pct: number }

export interface Campaign {
  id: string; brand_id: string; brand_name?: string; brand_logo?: string | null; agency_id: string | null; agency_name?: string | null;
  title: string; brief: string; objectives: string; target_niches: string[]; target_platforms: string[]; target_audience: string; content_guidelines: string; required_deliverables: string[];
  budget: number; rate_band_min: number | null; rate_band_max: number | null; status: CampaignStatus; start_date: string | null; end_date: string | null; created_by: string | null; created_at: string; updated_at: string;
  financials: CampaignFinancials;
  stats: { collaborations: number; active_collaborations: number; deliverables: number; approved_deliverables: number; pending_checkpoints: number; shortlist: number };
  shortlist?: ShortlistEntry[]; collaborations?: Collaboration[]; checkpoints?: Checkpoint[]; sessions?: AgentSession[]; runs?: AgentRun[];
}

export interface CampaignInput {
  brand_id: string; agency_id?: string | null; title: string; brief?: string; objectives?: string; target_niches?: string[]; target_platforms?: string[]; target_audience?: string;
  content_guidelines?: string; required_deliverables?: string[]; budget: number; rate_band_min?: number | null; rate_band_max?: number | null; status?: 'DRAFT' | 'ACTIVE'; start_date?: string | null; end_date?: string | null;
}

export interface ShortlistEntry { id: string; campaign_id: string; creator_id: string; match_score: number; rationale: string; status: 'SUGGESTED' | 'APPROVED' | 'REJECTED'; added_by: string; actor_id: string | null; created_at: string; creator: Creator }

export type CollaborationStatus = 'OFFERED' | 'COUNTERED' | 'ACCEPTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
export type DeliverableStatus = 'PENDING' | 'SUBMITTED' | 'CHANGES_REQUESTED' | 'APPROVED' | 'PAID';

export interface DeliverableMetrics { views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagement_rate: number }
export interface ComplianceCheck { id: string; label: string; passed: boolean; detail: string }
export interface ComplianceReport { passed: boolean; score: number; checks: ComplianceCheck[]; checked_at: string }

export interface Deliverable {
  id: string; collaboration_id: string; deliverable_type: string; platform: string; status: DeliverableStatus; content_url: string | null; caption: string | null;
  compliance: ComplianceReport | null; metrics: DeliverableMetrics | null; review_notes: string | null; submitted_at: string | null; approved_at: string | null; paid_at: string | null; created_at: string;
}

export interface NegotiationMessage { id: string; collaboration_id: string; sender_type: 'BRAND' | 'AGENCY' | 'CREATOR' | 'AGENT' | 'SYSTEM'; sender_id: string; sender_name: string; kind: 'MESSAGE' | 'OFFER' | 'COUNTER' | 'ACCEPT' | 'DECLINE' | 'SYSTEM'; amount: number | null; body: string; created_at: string }

export interface Collaboration {
  id: string; campaign_id: string; campaign_title?: string; brand_id?: string; brand_name?: string; brand_logo?: string | null;
  creator_id: string; creator_name?: string; creator_handle?: string; creator_avatar?: string | null; creator_niche?: string;
  proposed_rate: number; agreed_rate: number | null; status: CollaborationStatus; initiated_by: 'HUMAN' | 'AGENT'; agent_session_id: string | null;
  terms: string; usage_rights: string; exclusivity_days: number; deadline: string | null; created_at: string; updated_at: string; escrow_held: number;
  deliverables: Deliverable[]; messages?: NegotiationMessage[];
}

export interface OfferInput { campaign_id: string; creator_id: string; proposed_rate: number; deliverables: string[]; deadline?: string | null; terms?: string; usage_rights?: string; exclusivity_days?: number; message?: string }

export interface LedgerEntry {
  id: string; seq: number; campaign_id: string; campaign_title?: string; brand_id?: string; brand_name?: string; collaboration_id: string | null; deliverable_id: string | null; creator_handle?: string | null; creator_name?: string | null;
  actor_type: 'HUMAN' | 'AGENT' | 'SYSTEM'; actor_id: string; actor_name?: string | null; entry_type: 'BUDGET_ALLOCATION' | 'BUDGET_ADJUSTMENT' | 'ESCROW_HOLD' | 'ESCROW_RELEASE' | 'ESCROW_REFUND' | 'PAYOUT_RELEASE';
  debit_account: string; credit_account: string; amount: number; currency: string; note: string; created_at: string;
}

export interface TrialBalance { debits: number; credits: number; balanced: boolean; accounts: { account: string; balance: number }[] }

export type RoleScope = 'DISCOVERY_ONLY' | 'CAMPAIGN_MANAGER' | 'FULL_OPERATOR';
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'COMPLETED';

export interface AgentSession {
  id: string; name: string; brand_id: string | null; brand_name?: string | null; agency_id: string | null; campaign_id: string | null; campaign_title?: string | null;
  role_scope: RoleScope; allowed_tools: string[]; budget_ceiling: number; rate_ceiling: number; spent_amount: number; status: SessionStatus; model: string; instructions: string;
  created_by: string | null; created_at: string; last_active_at: string | null;
  stats?: { runs: number; tool_calls: number; checkpoints_pending: number; blocked: number }; runs?: AgentRun[];
}

export interface SessionInput { name: string; brand_id?: string; campaign_id?: string | null; role_scope: RoleScope; allowed_tools?: string[]; budget_ceiling: number; rate_ceiling: number; model?: string; instructions?: string }

export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type RunEventType = 'status' | 'thinking' | 'text' | 'tool_call' | 'tool_result' | 'checkpoint' | 'guardrail' | 'done' | 'error';

export interface RunEvent { id: string; run_id: string; seq: number; type: RunEventType; payload: any; created_at: string }

export interface AgentRun {
  id: string; session_id: string; session_name?: string; campaign_id: string | null; campaign_title?: string | null; goal: string; mode: 'LLM' | 'SIMULATED'; model: string | null; status: RunStatus;
  summary: string | null; steps_count: number; checkpoints_count: number; blocked_count: number; spend_committed: number; input_tokens: number; output_tokens: number; started_at: string; finished_at: string | null; events?: RunEvent[];
}

export type CheckpointAction = 'PAYMENT_ABOVE_THRESHOLD' | 'OUT_OF_BAND_RATE' | 'BRIEF_MODIFICATION' | 'AGENT_ESCALATION' | 'BUDGET_EXCEEDED';

export interface Checkpoint {
  id: string; agent_session_id: string; agent_name?: string; role_scope?: RoleScope; run_id: string | null; campaign_id: string | null; campaign_title?: string | null; brand_id?: string | null;
  action_type: CheckpointAction; risk_level: 'LOW' | 'MEDIUM' | 'HIGH'; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'; amount: number | null; tool_name: string; payload: any; justification: string;
  reviewer_notes: string | null; resolved_by: string | null; executed_result: any; created_at: string; resolved_at: string | null; context?: any;
}

export type ExecutionStatus = 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';

export interface AuditRecord {
  seq: number; id: string; timestamp: string; actor_type: 'HUMAN' | 'AGENT' | 'SYSTEM'; actor_id: string; actor_name: string | null; session_id: string | null; run_id: string | null; campaign_id: string | null;
  tool_name: string; parameters: any; execution_status: ExecutionStatus; result_summary: string; guardrail_notes: string; duration_ms: number; prev_hash: string; hash: string;
}

export interface AuditVerification { valid: boolean; checked: number; broken_at?: string; stats: { total: number; by_status: Record<string, number>; by_actor: Record<string, number>; by_tool: Record<string, number> } }

export interface Notification { id: string; audience: string; audience_id: string; kind: 'INFO' | 'CHECKPOINT' | 'OFFER' | 'DELIVERABLE' | 'PAYMENT' | 'AGENT'; title: string; body: string; link: string | null; read: number; created_at: string }

export interface McpToolDefinition { name: string; title: string; description: string; inputSchema: any; category: string; risk: string }
export interface McpToolsResponse { protocol: string; server: { name: string; version: string }; transports: { stdio: string; streamable_http: string }; tools: McpToolDefinition[]; all_tools: McpToolDefinition[] }

export interface ToolExecutionResult { status: ExecutionStatus; result?: any; error?: string; checkpoint_id?: string; audit_id: string; duration_ms: number; guardrail_notes?: string; rules_evaluated?: string[] }

export interface ScopesResponse { scopes: Record<RoleScope, string[]>; payment_threshold: number; runtime: { llm_available: boolean; default_model: string; default_mode: 'LLM' | 'SIMULATED'; active_runs: number } }

export interface OverviewAnalytics {
  totals: { budget: number; escrow: number; spent: number; available: number; campaigns: number; active_campaigns: number; creators_engaged: number; pending_checkpoints: number; agent_actions: number; guardrail_blocks: number; held_for_approval: number; views: number; engagement_rate: number };
  campaigns: { id: string; title: string; brand_name: string; status: string; budget: number; spent: number; escrow: number; views: number; collaborations: number }[];
  spend_by_niche: { niche: string; amount: number }[];
  activity: { date: string; agent: number; human: number }[];
  checkpoint_mix: { type: string; count: number }[];
  pipeline: { status: string; count: number }[];
}

export interface CampaignAnalytics {
  campaign_id: string; title: string; financials: CampaignFinancials;
  reach: { views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagement_rate: number; impressions_est: number };
  cost: { cost_per_view: number; cost_per_engagement: number; cost_per_click: number; avg_rate: number };
  funnel: { shortlisted: number; offered: number; accepted: number; delivered: number; approved: number; paid: number };
  by_creator: { creator_id: string; name: string; handle: string; avatar_url: string | null; rate: number; status: string; views: number; engagement_rate: number; cpe: number; deliverables: number }[];
  by_platform: { platform: string; views: number; engagements: number; deliverables: number }[];
  timeline: { date: string; spend: number; committed: number; views: number }[];
}

export interface CreatorAnalytics {
  reach: { views: number; likes: number; comments: number; shares: number; saves: number; clicks: number; engagement_rate: number; impressions_est: number };
  offers: { total: number; accepted: number; declined: number; open: number };
  earnings_by_month: { month: string; amount: number }[];
  recent: (Collaboration & { campaign_title: string; brand_name: string })[];
}

export interface Wallet { balance: number; pending_escrow: number; lifetime_earnings: number; ledger: LedgerEntry[]; analytics: CreatorAnalytics }

export interface EvaluationRun { id: string; scenario_name: string; scenario_key: string; workflow_type: 'MANUAL' | 'AGENTIC'; time_to_launch_sec: number; human_minutes: number; matching_accuracy_pct: number; creators_evaluated: number; offers_sent: number; approvals_required: number; agent_run_id: string | null; notes: string; created_at: string }
export interface Scenario { key: string; name: string; description: string; brand_id: string; brand_name: string; niche: string; platforms: string[]; budget: number; rate_band: [number, number]; deliverables: string[]; creators_to_evaluate: number }
export interface EvaluationSummary {
  manual: { runs: number; time_to_launch_sec: number; human_minutes: number; matching_accuracy_pct: number; approvals_required: number };
  agentic: { runs: number; time_to_launch_sec: number; human_minutes: number; matching_accuracy_pct: number; approvals_required: number };
  delta: { time_to_launch_pct: number; human_minutes_pct: number; matching_accuracy_pts: number };
  scenarios: Scenario[]; runs: EvaluationRun[];
}

export interface PlatformEvent { type: string; payload: Record<string, any>; at: string }
