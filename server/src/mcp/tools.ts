import { z } from 'zod';
import { queryOne } from '../db/database';
import { CoreError, notFound } from '../core/ids';
import { searchCreators, getCreator, rateBenchmark, NICHES } from '../core/marketplace';
import { getCampaign, updateCampaign, addToShortlist, listShortlist } from '../core/campaigns';
import { sendOffer, counterOffer, acceptOffer, declineOffer, listCollaborations, submitDeliverable, reviewDeliverable, runComplianceCheck, getDeliverable, DELIVERABLE_TYPES } from '../core/collaborations';
import { releasePayment } from '../core/payments';
import { campaignAnalytics } from '../core/analytics';
import { listAudit } from '../core/audit';
import { createCheckpoint, listCheckpoints, type AgentSession } from '../core/governance';

/**
 * Governed MCP tool registry (paper §5.3 / §7.3).
 *
 * Each tool has a zod input schema (converted to JSON Schema for MCP
 * discovery and for the Claude tool definitions) and a handler that calls
 * the Infrastructure Core. Handlers never touch the database directly for
 * writes — the core owns every state transition.
 */

export interface ToolContext {
  session: AgentSession;
  run_id?: string | null;
}

export interface ToolSpec<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  title: string;
  description: string;
  category: 'discovery' | 'campaign' | 'contracts' | 'delivery' | 'payments' | 'governance' | 'insight';
  risk: 'read' | 'write' | 'financial' | 'high_impact';
  schema: S;
  handler: (input: z.infer<S>, ctx: ToolContext) => unknown | Promise<unknown>;
}

function tool<S extends z.ZodTypeAny>(spec: ToolSpec<S>): ToolSpec<any> {
  return spec as ToolSpec<any>;
}

const campaignIdField = z.string().describe('Campaign identifier, e.g. "camp_techpulse_earbuds".');

export const TOOLS: ToolSpec[] = [
  tool({
    name: 'search_creators',
    title: 'Search creators',
    description: `Search the verified creator marketplace. Filters: niche, platform, follower bounds, engagement, max rate. Pass campaign_id to get a predictive match score (0-100) against that campaign's brief. Available niches: ${NICHES.join(', ')}. Returns up to \`limit\` creators ranked by match score.`,
    category: 'discovery',
    risk: 'read',
    schema: z.object({
      campaign_id: campaignIdField.optional().describe('Score results against this campaign brief (recommended).'),
      query: z.string().optional().describe('Free-text search across name, handle, bio and content tags.'),
      niche: z.string().optional().describe('Content niche, e.g. "Tech & Gadgets".'),
      platform: z.enum(['instagram', 'youtube', 'tiktok']).optional(),
      min_followers: z.number().int().nonnegative().optional(),
      max_followers: z.number().int().positive().optional(),
      min_engagement: z.number().nonnegative().optional().describe('Minimum engagement rate in percent, e.g. 3.5.'),
      max_rate: z.number().positive().optional().describe('Maximum acceptable rate in USD for rate_type.'),
      rate_type: z.enum(['post', 'reel', 'video', 'story']).optional().describe('Which rate max_rate applies to (default video).'),
      country: z.string().optional().describe('Audience top country filter, e.g. "United States".'),
      verified_only: z.boolean().optional(),
      sort: z.enum(['relevance', 'followers', 'engagement', 'rate_asc', 'rate_desc', 'rating']).optional(),
      limit: z.number().int().min(1).max(50).optional().describe('Default 10.'),
    }),
    handler: (input) => {
      const rows = searchCreators({ ...input, limit: input.limit ?? 10 });
      return {
        count: rows.length,
        creators: rows.map((c) => ({
          id: c.id, name: c.name, handle: `@${c.handle}`, primary_niche: c.primary_niche, secondary_niches: c.secondary_niches, platforms: c.platforms,
          follower_count: c.follower_count, engagement_rate_pct: c.engagement_rate, avg_views: c.avg_views,
          rates_usd: { post: c.rate_post, reel: c.rate_reel, video: c.rate_video, story: c.rate_story },
          audience_top_country: c.audience.countries[0] ?? null, audience_top_age: c.audience.ages[0] ?? null,
          rating: c.rating, completed_campaigns: c.completed_campaigns, verified: Boolean(c.verified), available: Boolean(c.available),
          match_score: c.match_score, match_breakdown: c.match_breakdown, match_reasons: c.match_reasons,
        })),
      };
    },
  }),

  tool({
    name: 'get_creator_profile',
    title: 'Get creator profile',
    description: 'Full media kit for one creator: bio, per-platform stats, audience demographics, rate card, portfolio and collaboration history.',
    category: 'discovery',
    risk: 'read',
    schema: z.object({ creator_id: z.string().describe('Creator id (e.g. "cr_marcus") or @handle.') }),
    handler: (input) => {
      const c = getCreator(input.creator_id);
      const history = queryOne<{ n: number; completed: number }>(`SELECT COUNT(*) n, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) completed FROM collaborations WHERE creator_id = ?`, [c.id]);
      return { ...c, wallet_balance: undefined, platform_history: { collaborations_on_platform: history?.n ?? 0, completed_on_platform: history?.completed ?? 0 } };
    },
  }),

  tool({
    name: 'get_rate_benchmark',
    title: 'Rate benchmark',
    description: 'Market rate percentiles (p25 / median / p75) for a deliverable type among creators of a similar size and niche. Use it to sanity-check a proposed rate before sending an offer.',
    category: 'insight',
    risk: 'read',
    schema: z.object({
      follower_count: z.number().int().positive(),
      deliverable: z.enum(['post', 'reel', 'video', 'story']),
      niche: z.string().optional(),
    }),
    handler: (input) => rateBenchmark(input),
  }),

  tool({
    name: 'get_campaign_status',
    title: 'Campaign status',
    description: 'Real-time snapshot of a campaign: brief, targeting, budget (allocated / escrow / spent / available), shortlist, collaborations with deliverable states, and pending human checkpoints. Call this first before acting on a campaign.',
    category: 'campaign',
    risk: 'read',
    schema: z.object({ campaign_id: campaignIdField }),
    handler: (input) => {
      const c = getCampaign(input.campaign_id);
      const shortlist = listShortlist(c.id).map((s) => ({ creator_id: s.creator_id, handle: `@${s.creator.handle}`, match_score: s.match_score, status: s.status }));
      const collaborations = listCollaborations({ campaign_id: c.id });
      const checkpoints = listCheckpoints({ campaign_id: c.id, status: 'PENDING' });
      return {
        campaign: {
          id: c.id, title: c.title, brand: c.brand_name, status: c.status, brief: c.brief, objectives: c.objectives,
          target_niches: c.target_niches, target_platforms: c.target_platforms, target_audience: c.target_audience,
          content_guidelines: c.content_guidelines, required_deliverables: c.required_deliverables,
          rate_band: { min: c.rate_band_min, max: c.rate_band_max }, start_date: c.start_date, end_date: c.end_date,
        },
        budget: c.financials,
        shortlist,
        collaborations: collaborations.map((col: any) => ({
          id: col.id, creator_id: col.creator_id, creator: `@${col.creator_handle}`, status: col.status, proposed_rate: col.proposed_rate, agreed_rate: col.agreed_rate,
          initiated_by: col.initiated_by, deadline: col.deadline, escrow_held: col.escrow_held,
          deliverables: col.deliverables.map((d: any) => ({ id: d.id, type: d.deliverable_type, status: d.status, content_url: d.content_url, compliance_passed: d.compliance?.passed ?? null })),
        })),
        pending_checkpoints: checkpoints.map((k) => ({ id: k.id, action_type: k.action_type, amount: k.amount, tool_name: k.tool_name, justification: k.justification })),
      };
    },
  }),

  tool({
    name: 'get_campaign_analytics',
    title: 'Campaign analytics',
    description: 'Reach, engagement and cost-efficiency metrics for a campaign, broken down by creator and platform.',
    category: 'insight',
    risk: 'read',
    schema: z.object({ campaign_id: campaignIdField }),
    handler: (input) => campaignAnalytics(input.campaign_id),
  }),

  tool({
    name: 'add_to_shortlist',
    title: 'Add to shortlist',
    description: 'Add a creator to the campaign shortlist for brand review, with your rationale. Shortlist approval by a human is the paper\'s matching-accuracy signal, so include a concrete reason.',
    category: 'campaign',
    risk: 'write',
    schema: z.object({ campaign_id: campaignIdField, creator_id: z.string(), rationale: z.string().min(10).describe('Why this creator fits the brief.') }),
    handler: (input, ctx) => {
      const entry = addToShortlist(input.campaign_id, input.creator_id, { type: 'AGENT', id: ctx.session.id }, input.rationale);
      return { shortlist_entry_id: entry.id, creator: `@${entry.creator.handle}`, match_score: entry.match_score, status: entry.status, message: `@${entry.creator.handle} added to the shortlist (match ${entry.match_score}/100).` };
    },
  }),

  tool({
    name: 'draft_campaign_brief',
    title: 'Draft campaign brief',
    description: 'Write or refine the structured campaign brief stored in the shared data layer: creative brief, objectives, target audience, content guidelines (mandatory tags/handles/codes), deliverables and rate band. Changes after a creator has accepted an offer are routed to a human checkpoint.',
    category: 'campaign',
    risk: 'write',
    schema: z.object({
      campaign_id: campaignIdField,
      title: z.string().optional(),
      brief: z.string().optional().describe('Creative brief: the story, product truths, tone.'),
      objectives: z.string().optional().describe('Objectives and KPIs.'),
      target_audience: z.string().optional(),
      content_guidelines: z.string().optional().describe('Mandatory talking points, hashtags, @handles, discount codes and disclosures.'),
      required_deliverables: z.array(z.string()).optional().describe('e.g. ["1x YouTube Video", "1x Instagram Reel"]'),
      target_niches: z.array(z.string()).optional(),
      target_platforms: z.array(z.enum(['instagram', 'youtube', 'tiktok'])).optional(),
      rate_band_min: z.number().nonnegative().optional(),
      rate_band_max: z.number().positive().optional(),
    }),
    handler: (input, ctx) => {
      const { campaign_id, ...patch } = input;
      const c = updateCampaign(campaign_id, patch, { type: 'AGENT', id: ctx.session.id });
      return { message: 'Campaign brief updated in the shared data layer.', campaign: { id: c.id, title: c.title, brief: c.brief, objectives: c.objectives, target_audience: c.target_audience, content_guidelines: c.content_guidelines, required_deliverables: c.required_deliverables, rate_band: { min: c.rate_band_min, max: c.rate_band_max } } };
    },
  }),

  tool({
    name: 'send_collaboration_offer',
    title: 'Send collaboration offer',
    description: `Send a paid collaboration offer to a creator and lock the proposed rate in campaign escrow. Subject to the session's budget ceiling (hard block) and per-collaboration rate ceiling (human checkpoint). Deliverable types: ${Object.keys(DELIVERABLE_TYPES).join(', ')}.`,
    category: 'contracts',
    risk: 'financial',
    schema: z.object({
      campaign_id: campaignIdField,
      creator_id: z.string(),
      proposed_rate: z.number().positive().describe('Total USD for all deliverables.'),
      deliverables: z.array(z.string()).min(1).describe('e.g. ["YOUTUBE_VIDEO", "REEL"]'),
      deadline: z.string().optional().describe('YYYY-MM-DD'),
      terms: z.string().optional().describe('Scope, usage rights, exclusivity, tracking links.'),
      usage_rights: z.string().optional(),
      exclusivity_days: z.number().int().nonnegative().optional(),
      message: z.string().optional().describe('Personal note to the creator.'),
    }),
    handler: (input, ctx) => {
      const col = sendOffer(input, { type: 'AGENT', id: ctx.session.id, name: ctx.session.name, session_id: ctx.session.id });
      return { collaboration_id: col.id, status: col.status, creator: `@${col.creator_handle}`, proposed_rate: col.proposed_rate, escrow_locked: col.escrow_held, deadline: col.deadline, deliverables: col.deliverables.map((d) => ({ id: d.id, type: d.deliverable_type, status: d.status })), message: `Offer of $${col.proposed_rate.toLocaleString()} sent to @${col.creator_handle}; escrow hold recorded in the ledger.` };
    },
  }),

  tool({
    name: 'respond_to_counter_offer',
    title: 'Respond to counter-offer',
    description: 'Accept, counter or decline a creator\'s counter-offer on an existing collaboration. Accepting or countering commits spend and is subject to the same budget and rate ceilings as a new offer.',
    category: 'contracts',
    risk: 'financial',
    schema: z.object({
      collaboration_id: z.string(),
      decision: z.enum(['ACCEPT', 'COUNTER', 'DECLINE']),
      counter_amount: z.number().positive().optional().describe('Required when decision is COUNTER.'),
      message: z.string().optional(),
    }),
    handler: (input, ctx) => {
      const actor = { type: 'AGENT' as const, id: ctx.session.id, name: ctx.session.name };
      if (input.decision === 'ACCEPT') { const c = acceptOffer(input.collaboration_id, actor, input.message); return { collaboration_id: c.id, status: c.status, agreed_rate: c.agreed_rate, message: `Accepted at $${c.agreed_rate?.toLocaleString()}.` }; }
      if (input.decision === 'COUNTER') {
        if (!input.counter_amount) throw new CoreError('counter_amount is required for COUNTER.');
        const c = counterOffer(input.collaboration_id, input.counter_amount, input.message, actor);
        return { collaboration_id: c.id, status: c.status, proposed_rate: c.proposed_rate, message: `Countered at $${c.proposed_rate.toLocaleString()}.` };
      }
      const c = declineOffer(input.collaboration_id, actor, input.message);
      return { collaboration_id: c.id, status: c.status, message: 'Offer withdrawn; escrow returned to the campaign.' };
    },
  }),

  tool({
    name: 'track_deliverable',
    title: 'Track deliverable',
    description: 'Record that agreed content has been published: stores the live URL and caption, fetches performance metrics, and runs the compliance check (disclosure, platform, required tags) against the brief. Moves the deliverable to SUBMITTED for review.',
    category: 'delivery',
    risk: 'write',
    schema: z.object({
      collaboration_id: z.string(),
      deliverable_id: z.string(),
      content_url: z.string().url().describe('Public Instagram / YouTube / TikTok URL.'),
      caption: z.string().optional().describe('Post caption / description, used for disclosure checks.'),
      verification_metrics: z.object({ views: z.number().optional(), likes: z.number().optional(), comments: z.number().optional(), shares: z.number().optional(), saves: z.number().optional(), clicks: z.number().optional(), engagement_rate: z.number().optional() }).optional(),
    }),
    handler: (input, ctx) => {
      const d = getDeliverable(input.deliverable_id);
      if (d.collaboration_id !== input.collaboration_id) throw new CoreError('Deliverable does not belong to that collaboration.');
      const out = submitDeliverable(input.deliverable_id, { content_url: input.content_url, caption: input.caption, metrics: input.verification_metrics as any }, { type: 'AGENT', id: ctx.session.id, name: ctx.session.name });
      return { deliverable_id: out.deliverable.id, status: out.deliverable.status, collaboration_status: out.collaboration.status, compliance: out.deliverable.compliance, metrics: out.deliverable.metrics, message: `Deliverable tracked. Compliance ${out.deliverable.compliance?.passed ? 'passed' : 'FAILED'} (${out.deliverable.compliance?.score}%).` };
    },
  }),

  tool({
    name: 'check_compliance',
    title: 'Check compliance',
    description: 'Dry-run the sponsored-content compliance checker on a caption + URL without changing any state. Use before approving content.',
    category: 'delivery',
    risk: 'read',
    schema: z.object({ campaign_id: campaignIdField, deliverable_type: z.string().optional(), caption: z.string(), content_url: z.string() }),
    handler: (input) => {
      const c = getCampaign(input.campaign_id);
      return runComplianceCheck({ caption: input.caption, content_url: input.content_url, campaign: { content_guidelines: c.content_guidelines, title: c.title, brand_name: c.brand_name }, deliverable_type: input.deliverable_type ?? 'POST' });
    },
  }),

  tool({
    name: 'review_deliverable',
    title: 'Review deliverable',
    description: 'Approve a submitted deliverable or request changes. Approval is the precondition for release_payment.',
    category: 'delivery',
    risk: 'write',
    schema: z.object({ deliverable_id: z.string(), decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']), notes: z.string().optional() }),
    handler: (input, ctx) => {
      const out = reviewDeliverable(input.deliverable_id, input.decision, input.notes, { type: 'AGENT', id: ctx.session.id, name: ctx.session.name });
      return { deliverable_id: out.deliverable.id, status: out.deliverable.status, collaboration_status: out.collaboration.status, message: `Deliverable ${input.decision.toLowerCase().replace('_', ' ')}.` };
    },
  }),

  tool({
    name: 'release_payment',
    title: 'Release payment',
    description: 'Release escrowed funds to the creator for an approved deliverable. Amounts above the autonomous threshold are held at a human checkpoint. Omit amount to release the full remaining escrow (always held for approval).',
    category: 'payments',
    risk: 'high_impact',
    schema: z.object({
      collaboration_id: z.string(),
      deliverable_id: z.string().optional().describe('Approved deliverable this payout covers.'),
      amount: z.number().positive().optional().describe('USD. Defaults to remaining escrow.'),
      note: z.string().optional(),
    }),
    handler: (input, ctx) => {
      const out = releasePayment(input, { type: 'AGENT', id: ctx.session.id, name: ctx.session.name });
      return { payment_status: 'RELEASED', amount: out.amount, ledger_entry_id: out.ledger_entry_id, collaboration_status: out.collaboration.status, creator: `@${out.collaboration.creator_handle}`, message: `Released $${out.amount.toLocaleString()} to @${out.collaboration.creator_handle}.` };
    },
  }),

  tool({
    name: 'list_audit_logs',
    title: 'List audit logs',
    description: 'Read the immutable audit trail for this session or a campaign to confirm what has already been done.',
    category: 'governance',
    risk: 'read',
    schema: z.object({ campaign_id: campaignIdField.optional(), limit: z.number().int().min(1).max(100).optional(), this_session_only: z.boolean().optional() }),
    handler: (input, ctx) => {
      const { items } = listAudit({ campaign_id: input.campaign_id, session_id: input.this_session_only ? ctx.session.id : undefined, limit: input.limit ?? 20 });
      return { count: items.length, logs: items.map((l) => ({ id: l.id, timestamp: l.timestamp, actor: `${l.actor_type}:${l.actor_id}`, tool: l.tool_name, status: l.execution_status, summary: l.result_summary, guardrail_notes: l.guardrail_notes, duration_ms: l.duration_ms })) };
    },
  }),

  tool({
    name: 'request_human_approval',
    title: 'Request human approval',
    description: 'Escalate an ambiguous or high-risk decision to the brand/agency reviewer with context and options. Use when the brief is unclear, when a creator is borderline, or before any action you are not confident about.',
    category: 'governance',
    risk: 'write',
    schema: z.object({
      action_type: z.string().describe('Short label, e.g. "STRATEGIC_DIRECTION", "RATE_EXCEPTION", "CREATOR_FIT".'),
      details: z.string().describe('Context and the options you are weighing.'),
      reason: z.string().describe('Why a human should decide.'),
      campaign_id: campaignIdField.optional(),
    }),
    handler: (input, ctx) => {
      const chk = createCheckpoint({ session: ctx.session, run_id: ctx.run_id, campaign_id: input.campaign_id ?? ctx.session.campaign_id, action_type: 'AGENT_ESCALATION', risk_level: 'LOW', tool_name: 'request_human_approval', payload: { ...input }, justification: `${input.action_type}: ${input.reason}` });
      return { checkpoint_id: chk.id, status: 'PENDING_HUMAN_APPROVAL', message: `Escalated to the reviewer queue as checkpoint ${chk.id}. Continue with other work; do not assume approval.` };
    },
  }),
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string): ToolSpec {
  const t = TOOL_MAP.get(name);
  if (!t) throw notFound('MCP tool', name);
  return t;
}

/** Minimal zod → JSON Schema conversion for the tool surface used here. */
export function zodToJsonSchema(schema: z.ZodTypeAny): any {
  const def: any = (schema as any)._def;
  const typeName = def?.typeName;
  const withDesc = (o: any) => (schema.description ? { ...o, description: schema.description } : o);
  switch (typeName) {
    case 'ZodObject': {
      const shape = def.shape();
      const properties: Record<string, any> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        const inner = v as z.ZodTypeAny;
        properties[k] = zodToJsonSchema(inner);
        if (!inner.isOptional()) required.push(k);
      }
      return withDesc({ type: 'object', properties, ...(required.length ? { required } : {}), additionalProperties: false });
    }
    case 'ZodString': return withDesc({ type: 'string' });
    case 'ZodNumber': {
      const isInt = def.checks?.some((c: any) => c.kind === 'int');
      const min = def.checks?.find((c: any) => c.kind === 'min');
      const max = def.checks?.find((c: any) => c.kind === 'max');
      return withDesc({ type: isInt ? 'integer' : 'number', ...(min ? { minimum: min.value } : {}), ...(max ? { maximum: max.value } : {}) });
    }
    case 'ZodBoolean': return withDesc({ type: 'boolean' });
    case 'ZodEnum': return withDesc({ type: 'string', enum: def.values });
    case 'ZodArray': return withDesc({ type: 'array', items: zodToJsonSchema(def.type) });
    case 'ZodOptional': return { ...zodToJsonSchema(def.innerType), ...(schema.description ? { description: schema.description } : {}) };
    case 'ZodNullable': return { ...zodToJsonSchema(def.innerType), nullable: true };
    case 'ZodDefault': return zodToJsonSchema(def.innerType);
    case 'ZodEffects': return zodToJsonSchema(def.schema);
    default: return withDesc({});
  }
}

export interface McpToolDefinition { name: string; title: string; description: string; inputSchema: any; category: string; risk: string }

export function toolDefinitions(filter?: string[]): McpToolDefinition[] {
  return TOOLS.filter((t) => !filter || filter.includes(t.name)).map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: zodToJsonSchema(t.schema), category: t.category, risk: t.risk }));
}
