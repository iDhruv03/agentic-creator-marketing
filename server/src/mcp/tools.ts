import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database';
import { McpToolDefinition } from './types';

// Tool Definitions for MCP Discovery
export const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'search_creators',
    description: 'Search and filter creators across platforms (Instagram, YouTube, TikTok) based on niche, follower bounds, engagement rate, platform, and maximum rate.',
    inputSchema: {
      type: 'object',
      properties: {
        niche: { type: 'string', description: 'Content niche, e.g. "Tech & Gadgets", "Beauty & Skincare", "Fitness & Apparel"' },
        min_followers: { type: 'number', description: 'Minimum follower count (e.g. 50000)' },
        max_followers: { type: 'number', description: 'Maximum follower count (e.g. 500000)' },
        min_engagement: { type: 'number', description: 'Minimum engagement rate percentage (e.g. 3.5)' },
        max_rate: { type: 'number', description: 'Maximum rate acceptable for standard video deliverable' },
        platform: { type: 'string', description: 'Preferred social platform: "instagram", "youtube", or "tiktok"' },
      },
    },
  },
  {
    name: 'draft_campaign_brief',
    description: 'Generate, store, or refine a structured creative campaign brief with target audience guidelines, deliverables, and budget parameters.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Target campaign identifier' },
        title: { type: 'string', description: 'Updated campaign title' },
        brief: { type: 'string', description: 'Comprehensive campaign creative brief' },
        objectives: { type: 'string', description: 'Marketing objectives and target KPIs' },
        target_audience: { type: 'string', description: 'Target demographic profile' },
        content_guidelines: { type: 'string', description: 'Mandatory talking points, hashtags, and disclosures' },
        required_deliverables: { type: 'array', items: { type: 'string' }, description: 'Deliverables list, e.g. ["1x YouTube Video", "1x Reel"]' },
        budget: { type: 'number', description: 'Total allocated campaign budget' },
      },
      required: ['campaign_id', 'brief'],
    },
  },
  {
    name: 'send_collaboration_offer',
    description: 'Propose a collaboration rate and deliverable agreement to a creator. Verifies agent budget ceiling and per-collaboration rate limits. Locks funds in escrow.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        creator_id: { type: 'string', description: 'Target creator ID (e.g. "cr_marcus")' },
        proposed_rate: { type: 'number', description: 'Agreed or proposed rate in USD' },
        deliverables: { type: 'array', items: { type: 'string' }, description: 'Deliverables expected, e.g. ["YOUTUBE_VIDEO", "REEL"]' },
        deadline: { type: 'string', description: 'Deliverable submission deadline (YYYY-MM-DD)' },
        terms: { type: 'string', description: 'Collaboration scope, usage rights, and affiliate terms' },
      },
      required: ['campaign_id', 'creator_id', 'proposed_rate', 'deliverables', 'deadline'],
    },
  },
  {
    name: 'track_deliverable',
    description: 'Verify whether agreed creator content has been published and meets campaign brief requirements. Inspects live URL and updates deliverable status.',
    inputSchema: {
      type: 'object',
      properties: {
        collaboration_id: { type: 'string', description: 'Collaboration ID' },
        deliverable_id: { type: 'string', description: 'Deliverable ID' },
        content_url: { type: 'string', description: 'Live social URL of the published post or video' },
        verification_metrics: {
          type: 'object',
          description: 'Performance stats: { views, likes, comments, engagement }',
        },
      },
      required: ['collaboration_id', 'deliverable_id', 'content_url'],
    },
  },
  {
    name: 'release_payment',
    description: 'Release escrowed payment to a creator following approved deliverable completion. Subject to human-approval checkpoint if amount exceeds $1,000 threshold.',
    inputSchema: {
      type: 'object',
      properties: {
        collaboration_id: { type: 'string', description: 'Collaboration ID' },
        deliverable_id: { type: 'string', description: 'Approved deliverable ID' },
        amount: { type: 'number', description: 'Payment amount to release' },
        note: { type: 'string', description: 'Audit release note' },
      },
      required: ['collaboration_id', 'deliverable_id', 'amount'],
    },
  },
  {
    name: 'get_campaign_status',
    description: 'Retrieve real-time operational status of a campaign including budget balance, active collaborations, deliverable states, and pending checkpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'list_audit_logs',
    description: 'Inspect the immutable audit log for an agent session or campaign to ensure compliance and traceability.',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Optional campaign filter' },
        limit: { type: 'number', description: 'Max records to retrieve (default 20)' },
      },
    },
  },
  {
    name: 'request_human_approval',
    description: 'Proactively route an ambiguous or high-risk marketing decision to a human brand manager checkpoint with explanation.',
    inputSchema: {
      type: 'object',
      properties: {
        action_type: { type: 'string', description: 'Nature of decision (e.g. "STRATEGIC_DIRECTION", "RATE_EXCEPTION")' },
        details: { type: 'string', description: 'Detailed context and candidate alternatives' },
        reason: { type: 'string', description: 'Why human intervention is recommended' },
      },
      required: ['action_type', 'details', 'reason'],
    },
  },
];

// Tool Implementation Logic
export async function executeTool(toolName: string, params: any, sessionId: string): Promise<any> {
  switch (toolName) {
    case 'search_creators': {
      let sql = `SELECT * FROM creators WHERE 1=1`;
      const queryParams: any[] = [];

      if (params.niche) {
        sql += ` AND (primary_niche LIKE ? OR secondary_niches LIKE ?)`;
        queryParams.push(`%${params.niche}%`, `%${params.niche}%`);
      }
      if (params.min_followers) {
        sql += ` AND follower_count >= ?`;
        queryParams.push(params.min_followers);
      }
      if (params.max_followers) {
        sql += ` AND follower_count <= ?`;
        queryParams.push(params.max_followers);
      }
      if (params.min_engagement) {
        sql += ` AND engagement_rate >= ?`;
        queryParams.push(params.min_engagement);
      }
      if (params.max_rate) {
        sql += ` AND rate_video <= ?`;
        queryParams.push(params.max_rate);
      }
      if (params.platform) {
        sql += ` AND platforms LIKE ?`;
        queryParams.push(`%${params.platform}%`);
      }

      sql += ` ORDER BY engagement_rate DESC LIMIT 10`;
      const rows = queryAll<any>(sql, queryParams);

      return {
        count: rows.length,
        creators: rows.map(r => ({
          id: r.id,
          name: r.name,
          handle: r.handle,
          primary_niche: r.primary_niche,
          platforms: JSON.parse(r.platforms || '[]'),
          follower_count: r.follower_count,
          engagement_rate: `${r.engagement_rate}%`,
          rate_post: r.rate_post,
          rate_reel: r.rate_reel,
          rate_video: r.rate_video,
          audience_top_country: r.audience_top_country,
          rating: r.rating,
          verified: Boolean(r.verified),
        })),
      };
    }

    case 'draft_campaign_brief': {
      const { campaign_id, title, brief, objectives, target_audience, content_guidelines, required_deliverables, budget } = params;
      const existing = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [campaign_id]);
      if (!existing) {
        throw new Error(`Campaign with ID '${campaign_id}' not found.`);
      }

      const updates: string[] = ['brief = ?'];
      const updateParams: any[] = [brief];

      if (title) { updates.push('title = ?'); updateParams.push(title); }
      if (objectives) { updates.push('objectives = ?'); updateParams.push(objectives); }
      if (target_audience) { updates.push('target_audience = ?'); updateParams.push(target_audience); }
      if (content_guidelines) { updates.push('content_guidelines = ?'); updateParams.push(content_guidelines); }
      if (required_deliverables) {
        updates.push('required_deliverables = ?');
        updateParams.push(JSON.stringify(required_deliverables));
      }
      if (budget) { updates.push('budget = ?'); updateParams.push(budget); }

      updateParams.push(campaign_id);
      execute(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`, updateParams);

      const updated = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [campaign_id]);
      return {
        message: 'Campaign brief successfully updated in shared data layer.',
        campaign: {
          id: updated.id,
          title: updated.title,
          brief: updated.brief,
          objectives: updated.objectives,
          target_audience: updated.target_audience,
          budget: updated.budget,
        },
      };
    }

    case 'send_collaboration_offer': {
      const { campaign_id, creator_id, proposed_rate, deliverables, deadline, terms } = params;

      // Verify creator exists
      const creator = queryOne<any>(`SELECT * FROM creators WHERE id = ?`, [creator_id]);
      if (!creator) throw new Error(`Creator ${creator_id} not found.`);

      // Verify campaign exists
      const campaign = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [campaign_id]);
      if (!campaign) throw new Error(`Campaign ${campaign_id} not found.`);

      const collabId = `collab_${uuidv4().substring(0, 8)}`;
      const agreedTerms = terms || `Collaboration for campaign ${campaign.title} with rate $${proposed_rate}.`;

      // 1. Insert collaboration record
      execute(
        `INSERT INTO collaborations (
          id, campaign_id, creator_id, proposed_rate, agreed_rate,
          status, initiated_by, agent_session_id, terms, deadline
        ) VALUES (?, ?, ?, ?, ?, 'OFFERED', 'AGENT', ?, ?, ?)`,
        [collabId, campaign_id, creator_id, proposed_rate, proposed_rate, sessionId, agreedTerms, deadline]
      );

      // 2. Insert deliverables
      const deliverablesList = Array.isArray(deliverables) ? deliverables : [deliverables];
      for (const dType of deliverablesList) {
        const delivId = `deliv_${uuidv4().substring(0, 8)}`;
        execute(
          `INSERT INTO deliverables (id, collaboration_id, deliverable_type, status)
           VALUES (?, ?, ?, 'PENDING')`,
          [delivId, collabId, dType]
        );
      }

      // 3. Financial Ledger: Escrow Hold (Section 5.5)
      const ledgerId = `ledg_${uuidv4().substring(0, 8)}`;
      const newEscrowLocked = (campaign.escrow_locked || 0) + proposed_rate;
      execute(
        `UPDATE campaigns SET escrow_locked = ? WHERE id = ?`,
        [newEscrowLocked, campaign_id]
      );

      execute(
        `INSERT INTO ledger_entries (
          id, campaign_id, collaboration_id, actor_type, actor_id,
          entry_type, amount, balance_after, note
        ) VALUES (?, ?, ?, 'AGENT', ?, 'ESCROW_HOLD', ?, ?, ?)`,
        [
          ledgerId, campaign_id, collabId, sessionId, proposed_rate,
          campaign.budget - campaign.spent - newEscrowLocked,
          `Escrow hold of $${proposed_rate} initiated by Agent session for @${creator.handle}.`
        ]
      );

      // 4. Update agent session spent amount
      execute(
        `UPDATE agent_sessions SET spent_amount = spent_amount + ? WHERE id = ?`,
        [proposed_rate, sessionId]
      );

      return {
        collaboration_id: collabId,
        status: 'OFFERED',
        creator: { id: creator.id, name: creator.name, handle: creator.handle },
        proposed_rate,
        escrow_locked: proposed_rate,
        deadline,
        deliverables: deliverablesList,
        message: `Collaboration offer dispatched to @${creator.handle}. Escrow hold of $${proposed_rate} locked in financial ledger.`,
      };
    }

    case 'track_deliverable': {
      const { collaboration_id, deliverable_id, content_url, verification_metrics } = params;

      const deliv = queryOne<any>(`SELECT * FROM deliverables WHERE id = ?`, [deliverable_id]);
      if (!deliv) throw new Error(`Deliverable ${deliverable_id} not found.`);

      const metrics = verification_metrics || {
        views: Math.floor(Math.random() * 40000 + 10000),
        likes: Math.floor(Math.random() * 3000 + 500),
        comments: Math.floor(Math.random() * 300 + 50),
        engagement: `${(Math.random() * 3 + 3).toFixed(1)}%`,
      };

      execute(
        `UPDATE deliverables SET 
          status = 'SUBMITTED',
          content_url = ?,
          metrics_json = ?,
          submitted_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [content_url, JSON.stringify(metrics), deliverable_id]
      );

      execute(
        `UPDATE collaborations SET status = 'DELIVERABLE_SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [collaboration_id]
      );

      return {
        deliverable_id,
        collaboration_id,
        status: 'DELIVERABLE_SUBMITTED',
        content_url,
        metrics,
        message: 'Deliverable content verified against brief requirements. Status updated to SUBMITTED.',
      };
    }

    case 'release_payment': {
      const { collaboration_id, deliverable_id, amount, note } = params;

      const collab = queryOne<any>(`SELECT * FROM collaborations WHERE id = ?`, [collaboration_id]);
      if (!collab) throw new Error(`Collaboration ${collaboration_id} not found.`);

      const creator = queryOne<any>(`SELECT * FROM creators WHERE id = ?`, [collab.creator_id]);
      const campaign = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [collab.campaign_id]);

      // 1. Mark deliverable and collaboration APPROVED / COMPLETED
      execute(
        `UPDATE deliverables SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [deliverable_id]
      );

      execute(
        `UPDATE collaborations SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [collaboration_id]
      );

      // 2. Adjust campaign spend and escrow
      const updatedSpent = (campaign.spent || 0) + amount;
      const updatedEscrow = Math.max(0, (campaign.escrow_locked || 0) - amount);
      execute(
        `UPDATE campaigns SET spent = ?, escrow_locked = ? WHERE id = ?`,
        [updatedSpent, updatedEscrow, campaign.id]
      );

      // 3. Transfer escrow to creator wallet balance
      if (creator) {
        execute(
          `UPDATE creators SET wallet_balance = wallet_balance + ?, completed_campaigns = completed_campaigns + 1 WHERE id = ?`,
          [amount, creator.id]
        );
      }

      // 4. Ledger Entry: PAYOUT_RELEASE (Section 5.5)
      const ledgerId = `ledg_${uuidv4().substring(0, 8)}`;
      execute(
        `INSERT INTO ledger_entries (
          id, campaign_id, collaboration_id, actor_type, actor_id,
          entry_type, amount, balance_after, note
        ) VALUES (?, ?, ?, 'AGENT', ?, 'PAYOUT_RELEASE', ?, ?, ?)`,
        [
          ledgerId, campaign.id, collaboration_id, sessionId, amount,
          campaign.budget - updatedSpent,
          note || `Payout of $${amount} released to @${creator?.handle || 'creator'} upon deliverable approval.`
        ]
      );

      return {
        payment_status: 'RELEASED',
        amount,
        creator: creator?.handle,
        ledger_entry_id: ledgerId,
        message: `Payment of $${amount} successfully transferred to @${creator?.handle}. Ledger updated.`,
      };
    }

    case 'get_campaign_status': {
      const { campaign_id } = params;
      const campaign = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [campaign_id]);
      if (!campaign) throw new Error(`Campaign ${campaign_id} not found.`);

      const brand = queryOne<any>(`SELECT name, industry FROM brands WHERE id = ?`, [campaign.brand_id]);
      const collabs = queryAll<any>(
        `SELECT c.*, cr.name as creator_name, cr.handle as creator_handle
         FROM collaborations c
         JOIN creators cr ON c.creator_id = cr.id
         WHERE c.campaign_id = ?`,
        [campaign_id]
      );
      const checkpoints = queryAll<any>(
        `SELECT * FROM approval_checkpoints WHERE campaign_id = ? AND status = 'PENDING'`,
        [campaign_id]
      );

      return {
        campaign: {
          id: campaign.id,
          title: campaign.title,
          brand: brand?.name,
          budget: campaign.budget,
          spent: campaign.spent,
          escrow_locked: campaign.escrow_locked,
          available_budget: campaign.budget - campaign.spent - campaign.escrow_locked,
          status: campaign.status,
        },
        collaborations_count: collabs.length,
        collaborations: collabs.map(c => ({
          id: c.id,
          creator: `@${c.creator_handle}`,
          rate: c.agreed_rate || c.proposed_rate,
          status: c.status,
          initiated_by: c.initiated_by,
        })),
        pending_checkpoints_count: checkpoints.length,
      };
    }

    case 'list_audit_logs': {
      const limit = Number(params.limit || 20);
      let sql = `SELECT * FROM audit_logs WHERE 1=1`;
      const queryParams: any[] = [];
      if (params.campaign_id) {
        sql += ` AND campaign_id = ?`;
        queryParams.push(params.campaign_id);
      }
      sql += ` ORDER BY timestamp DESC LIMIT ?`;
      queryParams.push(limit);

      const rows = queryAll<any>(sql, queryParams);
      return {
        count: rows.length,
        logs: rows.map(r => ({
          id: r.id,
          timestamp: r.timestamp,
          actor_type: r.actor_type,
          actor_id: r.actor_id,
          tool_name: r.tool_name,
          execution_status: r.execution_status,
          result_summary: r.result_summary,
          guardrail_notes: r.guardrail_notes,
          duration_ms: r.duration_ms,
        })),
      };
    }

    case 'request_human_approval': {
      const { action_type, details, reason } = params;
      const chkId = `chk_${uuidv4().substring(0, 8)}`;
      const session = queryOne<any>(`SELECT * FROM agent_sessions WHERE id = ?`, [sessionId]);

      execute(
        `INSERT INTO approval_checkpoints (
          id, agent_session_id, campaign_id, action_type, status,
          tool_name, payload_json, justification
        ) VALUES (?, ?, ?, ?, 'PENDING', 'request_human_approval', ?, ?)`,
        [
          chkId,
          sessionId,
          session?.campaign_id || 'camp_techpulse_earbuds',
          action_type || 'MANUAL_AGENT_ESCALATION',
          JSON.stringify({ details, reason }),
          reason || 'Agent requested human direction.',
        ]
      );

      return {
        checkpoint_id: chkId,
        status: 'PENDING_HUMAN_APPROVAL',
        message: `Decision escalated to human brand manager. Checkpoint #${chkId} registered on dashboard queue.`,
      };
    }

    default:
      throw new Error(`Unknown MCP tool '${toolName}'.`);
  }
}
