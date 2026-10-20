import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database';
import { mcpServerInstance } from '../mcp/server';
import { AgentOrchestrator } from '../agent/orchestrator';

export const apiRouter = Router();

// ==================== BRANDS & AGENCIES ====================
apiRouter.get('/brands', (req: Request, res: Response) => {
  const brands = queryAll(`SELECT * FROM brands ORDER BY name ASC`);
  res.json(brands);
});

apiRouter.get('/agencies', (req: Request, res: Response) => {
  const agencies = queryAll(`SELECT * FROM agencies ORDER BY name ASC`);
  const agencyBrands = queryAll(
    `SELECT ab.*, b.name as brand_name, b.total_budget, b.spent_budget 
     FROM agency_brands ab 
     JOIN brands b ON ab.brand_id = b.id`
  );
  
  const mapped = agencies.map(a => ({
    ...a,
    brands: agencyBrands.filter(ab => ab.agency_id === a.id),
  }));
  res.json(mapped);
});

// ==================== CREATORS ====================
apiRouter.get('/creators', (req: Request, res: Response) => {
  const { niche, platform, minFollowers, maxRate } = req.query;
  let sql = `SELECT * FROM creators WHERE 1=1`;
  const params: any[] = [];

  if (niche) {
    sql += ` AND (primary_niche = ? OR secondary_niches LIKE ?)`;
    params.push(niche, `%${niche}%`);
  }
  if (minFollowers) {
    sql += ` AND follower_count >= ?`;
    params.push(Number(minFollowers));
  }
  if (maxRate) {
    sql += ` AND rate_video <= ?`;
    params.push(Number(maxRate));
  }
  if (platform) {
    sql += ` AND platforms LIKE ?`;
    params.push(`%${platform}%`);
  }

  sql += ` ORDER BY engagement_rate DESC`;
  const rows = queryAll(sql, params).map(r => ({
    ...r,
    secondary_niches: JSON.parse(r.secondary_niches || '[]'),
    platforms: JSON.parse(r.platforms || '[]'),
  }));
  res.json(rows);
});

apiRouter.get('/creators/:id', (req: Request, res: Response) => {
  const creator = queryOne(`SELECT * FROM creators WHERE id = ?`, [req.params.id]);
  if (!creator) return res.status(404).json({ error: 'Creator not found' });

  const collabs = queryAll(
    `SELECT c.*, cmp.title as campaign_title, b.name as brand_name
     FROM collaborations c
     JOIN campaigns cmp ON c.campaign_id = cmp.id
     JOIN brands b ON cmp.brand_id = b.id
     WHERE c.creator_id = ?
     ORDER BY c.created_at DESC`,
    [req.params.id]
  );

  res.json({
    ...creator,
    secondary_niches: JSON.parse(creator.secondary_niches || '[]'),
    platforms: JSON.parse(creator.platforms || '[]'),
    collaborations: collabs,
  });
});

// ==================== CAMPAIGNS ====================
apiRouter.get('/campaigns', (req: Request, res: Response) => {
  const { brandId } = req.query;
  let sql = `SELECT c.*, b.name as brand_name, b.logo_url as brand_logo
             FROM campaigns c
             JOIN brands b ON c.brand_id = b.id`;
  const params: any[] = [];
  if (brandId) {
    sql += ` WHERE c.brand_id = ?`;
    params.push(brandId);
  }
  sql += ` ORDER BY c.created_at DESC`;

  const rows = queryAll(sql, params).map(r => ({
    ...r,
    target_niches: JSON.parse(r.target_niches || '[]'),
    required_deliverables: JSON.parse(r.required_deliverables || '[]'),
  }));
  res.json(rows);
});

apiRouter.get('/campaigns/:id', (req: Request, res: Response) => {
  const campaign = queryOne(
    `SELECT c.*, b.name as brand_name, b.logo_url as brand_logo
     FROM campaigns c
     JOIN brands b ON c.brand_id = b.id
     WHERE c.id = ?`,
    [req.params.id]
  );
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const collabs = queryAll(
    `SELECT c.*, cr.name as creator_name, cr.handle as creator_handle, cr.avatar_url, cr.follower_count
     FROM collaborations c
     JOIN creators cr ON c.creator_id = cr.id
     WHERE c.campaign_id = ?
     ORDER BY c.created_at DESC`,
    [req.params.id]
  );

  res.json({
    ...campaign,
    target_niches: JSON.parse(campaign.target_niches || '[]'),
    required_deliverables: JSON.parse(campaign.required_deliverables || '[]'),
    collaborations: collabs,
  });
});

apiRouter.post('/campaigns', (req: Request, res: Response) => {
  const { brand_id, agency_id, title, brief, objectives, target_niches, target_audience, content_guidelines, required_deliverables, budget } = req.body;
  const id = `camp_${uuidv4().substring(0, 8)}`;

  execute(
    `INSERT INTO campaigns (
      id, brand_id, agency_id, title, brief, objectives, target_niches,
      target_audience, content_guidelines, required_deliverables, budget, spent, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ACTIVE')`,
    [
      id, brand_id, agency_id || null, title, brief, objectives,
      JSON.stringify(target_niches || []), target_audience, content_guidelines,
      JSON.stringify(required_deliverables || []), budget
    ]
  );

  // Allocate in ledger
  execute(
    `INSERT INTO ledger_entries (
      id, campaign_id, actor_type, actor_id, entry_type, amount, balance_after, note
    ) VALUES (?, ?, 'HUMAN', 'user_dashboard', 'BUDGET_ALLOCATION', ?, ?, 'Campaign creation budget funding.')`,
    [`ledg_${uuidv4().substring(0, 8)}`, id, budget, budget]
  );

  res.status(201).json({ id, title, budget, status: 'ACTIVE' });
});

// ==================== COLLABORATIONS & DELIVERABLES ====================
apiRouter.get('/collaborations', (req: Request, res: Response) => {
  const collabs = queryAll(
    `SELECT c.*, cmp.title as campaign_title, b.name as brand_name,
            cr.name as creator_name, cr.handle as creator_handle, cr.avatar_url, cr.primary_niche
     FROM collaborations c
     JOIN campaigns cmp ON c.campaign_id = cmp.id
     JOIN brands b ON cmp.brand_id = b.id
     JOIN creators cr ON c.creator_id = cr.id
     ORDER BY c.created_at DESC`
  );

  const deliverables = queryAll(`SELECT * FROM deliverables`);
  const mapped = collabs.map(c => ({
    ...c,
    deliverables: deliverables.filter(d => d.collaboration_id === c.id),
  }));

  res.json(mapped);
});

apiRouter.post('/collaborations/:id/respond', (req: Request, res: Response) => {
  const { status } = req.body; // 'ACCEPTED', 'REJECTED'
  execute(
    `UPDATE collaborations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, req.params.id]
  );
  res.json({ success: true, id: req.params.id, status });
});

apiRouter.post('/deliverables/:id/submit', (req: Request, res: Response) => {
  const { content_url, caption } = req.body;
  const deliv = queryOne(`SELECT * FROM deliverables WHERE id = ?`, [req.params.id]);
  if (!deliv) return res.status(404).json({ error: 'Deliverable not found' });

  const metrics = {
    views: Math.floor(Math.random() * 50000 + 12000),
    likes: Math.floor(Math.random() * 4000 + 600),
    comments: Math.floor(Math.random() * 400 + 40),
    engagement: `${(Math.random() * 4 + 3).toFixed(1)}%`,
  };

  execute(
    `UPDATE deliverables SET status = 'SUBMITTED', content_url = ?, caption = ?, metrics_json = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [content_url, caption, JSON.stringify(metrics), req.params.id]
  );

  execute(
    `UPDATE collaborations SET status = 'DELIVERABLE_SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [deliv.collaboration_id]
  );

  res.json({ success: true, id: req.params.id, status: 'SUBMITTED', metrics });
});

// ==================== HUMAN-IN-THE-LOOP CHECKPOINTS ====================
apiRouter.get('/checkpoints', (req: Request, res: Response) => {
  const checkpoints = queryAll(
    `SELECT chk.*, s.name as agent_name, s.role_scope, cmp.title as campaign_title
     FROM approval_checkpoints chk
     JOIN agent_sessions s ON chk.agent_session_id = s.id
     JOIN campaigns cmp ON chk.campaign_id = cmp.id
     ORDER BY chk.created_at DESC`
  ).map(c => ({
    ...c,
    payload: JSON.parse(c.payload_json || '{}'),
  }));
  res.json(checkpoints);
});

apiRouter.post('/checkpoints/:id/resolve', async (req: Request, res: Response) => {
  const { decision, reviewer_notes, reviewer_id } = req.body; // 'APPROVED' or 'REJECTED'
  const chk = queryOne<any>(`SELECT * FROM approval_checkpoints WHERE id = ?`, [req.params.id]);
  if (!chk) return res.status(404).json({ error: 'Checkpoint not found' });
  if (chk.status !== 'PENDING') {
    return res.status(400).json({ error: 'Checkpoint already resolved' });
  }

  execute(
    `UPDATE approval_checkpoints 
     SET status = ?, reviewer_notes = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [decision, reviewer_notes || '', reviewer_id || 'human_brand_manager', req.params.id]
  );

  // If approved and was a payment release, execute the payment!
  if (decision === 'APPROVED' && chk.tool_name === 'release_payment') {
    const payload = JSON.parse(chk.payload_json || '{}');
    const { collaboration_id, deliverable_id, amount } = payload;

    // Direct execute payment bypass since human approved
    const collab = queryOne<any>(`SELECT * FROM collaborations WHERE id = ?`, [collaboration_id]);
    const campaign = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [collab.campaign_id]);
    const creator = queryOne<any>(`SELECT * FROM creators WHERE id = ?`, [collab.creator_id]);

    execute(`UPDATE deliverables SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP WHERE id = ?`, [deliverable_id]);
    execute(`UPDATE collaborations SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [collaboration_id]);

    const updatedSpent = (campaign.spent || 0) + amount;
    const updatedEscrow = Math.max(0, (campaign.escrow_locked || 0) - amount);
    execute(`UPDATE campaigns SET spent = ?, escrow_locked = ? WHERE id = ?`, [updatedSpent, updatedEscrow, campaign.id]);

    if (creator) {
      execute(`UPDATE creators SET wallet_balance = wallet_balance + ?, completed_campaigns = completed_campaigns + 1 WHERE id = ?`, [amount, creator.id]);
    }

    const ledgerId = `ledg_${uuidv4().substring(0, 8)}`;
    execute(
      `INSERT INTO ledger_entries (
        id, campaign_id, collaboration_id, actor_type, actor_id,
        entry_type, amount, balance_after, note
      ) VALUES (?, ?, ?, 'HUMAN', ?, 'PAYOUT_RELEASE', ?, ?, ?)`,
      [
        ledgerId, campaign.id, collaboration_id, reviewer_id || 'human_brand_manager', amount,
        campaign.budget - updatedSpent,
        `Payment of $${amount} approved via Checkpoint #${chk.id} and released to @${creator?.handle}.`
      ]
    );

    // Audit log
    execute(
      `INSERT INTO audit_logs (
        id, actor_type, actor_id, session_id, campaign_id,
        tool_name, parameters_json, execution_status, result_summary,
        guardrail_notes, duration_ms
      ) VALUES (?, 'HUMAN', ?, ?, ?, 'resolve_checkpoint', ?, 'SUCCESS', ?, 'Human checkpoint resolved with APPROVED.', 85)`,
      [
        `aud_${uuidv4().substring(0, 8)}`,
        reviewer_id || 'human_brand_manager',
        chk.agent_session_id,
        chk.campaign_id,
        JSON.stringify({ checkpoint_id: chk.id, decision, amount }),
        `Checkpoint #${chk.id} approved. Escrow of $${amount} released.`
      ]
    );
  }

  res.json({ success: true, checkpoint_id: req.params.id, decision });
});

// ==================== FINANCIAL LEDGER ====================
apiRouter.get('/ledger', (req: Request, res: Response) => {
  const { campaignId } = req.query;
  let sql = `SELECT l.*, cmp.title as campaign_title
             FROM ledger_entries l
             JOIN campaigns cmp ON l.campaign_id = cmp.id`;
  const params: any[] = [];
  if (campaignId) {
    sql += ` WHERE l.campaign_id = ?`;
    params.push(campaignId);
  }
  sql += ` ORDER BY l.created_at DESC`;
  res.json(queryAll(sql, params));
});

// ==================== AUDIT LOGS ====================
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  const logs = queryAll(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`).map(l => ({
    ...l,
    parameters: JSON.parse(l.parameters_json || '{}'),
  }));
  res.json(logs);
});

// ==================== AGENT SESSIONS & RUNNER ====================
apiRouter.get('/agent-sessions', (req: Request, res: Response) => {
  const sessions = queryAll(`SELECT * FROM agent_sessions ORDER BY created_at DESC`).map(s => ({
    ...s,
    allowed_tools: JSON.parse(s.allowed_tools || '[]'),
  }));
  res.json(sessions);
});

apiRouter.post('/agent/run', async (req: Request, res: Response) => {
  const { session_id, campaign_id, goal_prompt } = req.body;
  const targetSessionId = session_id || 'sess_agent_cmi_alpha';
  const targetCampaignId = campaign_id || 'camp_techpulse_earbuds';

  try {
    const summary = await AgentOrchestrator.runAutonomousCampaign(
      targetSessionId,
      targetCampaignId,
      goal_prompt || 'Execute full end-to-end campaign workflow'
    );
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== MCP PROTOCOL ENDPOINTS ====================
apiRouter.get('/mcp/tools', (req: Request, res: Response) => {
  res.json({
    protocol: 'MCP-2024-11-05',
    server: 'cmi-governed-mcp-server',
    tools: mcpServerInstance.listTools(),
  });
});

apiRouter.post('/mcp/call', async (req: Request, res: Response) => {
  const { session_id, tool_name, params } = req.body;
  if (!tool_name) return res.status(400).json({ error: 'tool_name is required' });

  const sessionId = session_id || 'sess_agent_cmi_alpha';
  const result = await mcpServerInstance.callTool(sessionId, tool_name, params || {});
  res.json(result);
});

// ==================== EVALUATION & BENCHMARK LAB (Section 10) ====================
apiRouter.get('/evaluation/benchmarks', (req: Request, res: Response) => {
  const benchmarks = queryAll(`SELECT * FROM evaluation_benchmarks ORDER BY run_timestamp DESC`);
  res.json(benchmarks);
});

apiRouter.post('/evaluation/run-simulation', (req: Request, res: Response) => {
  const { scenario_name, creator_count } = req.body;
  const scenario = scenario_name || 'Autonomous Q4 Creator Campaign Sourcing';
  const count = Number(creator_count || 20);

  // Generate matched comparison based on experimental distributions from research paper
  const manualTimeHours = (count * 1.8 + Math.random() * 5).toFixed(1);
  const manualLaborMins = Math.round(Number(manualTimeHours) * 60 * 0.12);
  const manualAccuracy = (82 + Math.random() * 6).toFixed(1);

  const agentTimeMins = (1.2 + Math.random() * 1.5).toFixed(1);
  const agentLaborMins = Math.round(10 + Math.random() * 10);
  const agentAccuracy = (91 + Math.random() * 5).toFixed(1);

  const runId = uuidv4().substring(0, 8);

  // Manual record
  execute(
    `INSERT INTO evaluation_benchmarks (
      id, scenario_name, workflow_type, time_to_launch_sec,
      operational_cost_minutes, creator_matching_accuracy_pct,
      creators_evaluated, offers_sent, approvals_required, notes
    ) VALUES (?, ?, 'MANUAL', ?, ?, ?, ?, 4, 4, 'Manual sequence: spreadsheet evaluation, individual DM negotiations.')`,
    [
      `bench_${runId}_manual`,
      scenario,
      Math.round(Number(manualTimeHours) * 3600),
      manualLaborMins,
      Number(manualAccuracy),
      count,
    ]
  );

  // Agentic record
  execute(
    `INSERT INTO evaluation_benchmarks (
      id, scenario_name, workflow_type, time_to_launch_sec,
      operational_cost_minutes, creator_matching_accuracy_pct,
      creators_evaluated, offers_sent, approvals_required, notes
    ) VALUES (?, ?, 'AGENTIC', ?, ?, ?, ?, 4, 1, 'Agentic parallel search_creators, brief drafting, escrow locking, human checkpoint on high payouts.')`,
    [
      `bench_${runId}_agentic`,
      scenario,
      Math.round(Number(agentTimeMins) * 60),
      agentLaborMins,
      Number(agentAccuracy),
      count,
    ]
  );

  const updated = queryAll(`SELECT * FROM evaluation_benchmarks ORDER BY run_timestamp DESC LIMIT 10`);
  res.json({
    message: 'Matched evaluation simulation successfully executed and recorded.',
    benchmarks: updated,
  });
});
