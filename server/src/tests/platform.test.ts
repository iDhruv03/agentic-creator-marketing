import './setup';
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { runSeed } from '../db/seed';
import { queryOne, queryAll } from '../db/database';
import { mcpServer } from '../mcp/server';
import { toolDefinitions, TOOLS } from '../mcp/tools';
import { campaignFinancials, trialBalance, collaborationEscrow } from '../core/ledger';
import { verifyAuditChain, listAudit } from '../core/audit';
import { createSession, listCheckpoints, SCOPE_TOOLS, getCheckpoint } from '../core/governance';
import { createCampaign, getCampaign, transitionCampaign, updateCampaign } from '../core/campaigns';
import { sendOffer, acceptOffer, counterOffer, declineOffer, submitDeliverable, reviewDeliverable, runComplianceCheck, getCollaboration } from '../core/collaborations';
import { releasePayment, creatorWallet } from '../core/payments';
import { searchCreators, rateBenchmark } from '../core/marketplace';
import { startRun, waitForRun } from '../agent/service';
import { login, verifyToken } from '../auth/auth';
import { modelManualWorkflow, runScenario } from '../core/evaluation';

const human = { type: 'HUMAN' as const, id: 'usr_test', name: 'Test Reviewer' };

before(() => {
  runSeed({ quiet: true });
});

describe('Shared data layer & seed', () => {
  test('seeds brands, creators, campaigns and users', () => {
    assert.ok((queryOne<any>(`SELECT COUNT(*) n FROM creators`)?.n ?? 0) >= 12);
    assert.ok((queryOne<any>(`SELECT COUNT(*) n FROM campaigns`)?.n ?? 0) >= 4);
    assert.ok((queryOne<any>(`SELECT COUNT(*) n FROM users`)?.n ?? 0) >= 6);
  });

  test('double-entry ledger balances to zero across all accounts', () => {
    const tb = trialBalance();
    assert.equal(tb.balanced, true);
  });

  test('campaign financials are derived from the ledger', () => {
    const fin = campaignFinancials('camp_techpulse_earbuds');
    assert.equal(fin.budget, 25000);
    assert.equal(Math.round((fin.available + fin.escrow_locked + fin.spent) * 100) / 100, 25000);
    assert.ok(fin.escrow_locked > 0, 'open offers hold escrow');
  });
});

describe('Authentication', () => {
  test('demo login issues a verifiable token', () => {
    const { token, user } = login('maya@techpulse.audio', 'demo1234');
    assert.equal(user.role, 'BRAND');
    assert.equal(verifyToken(token), user.id);
  });
  test('rejects a bad password', () => {
    assert.throws(() => login('maya@techpulse.audio', 'nope'), /Invalid email or password/);
  });
});

describe('MCP tool registry', () => {
  test('exposes the paper\'s core tools with JSON schemas', () => {
    const names = toolDefinitions().map((t) => t.name);
    for (const required of ['search_creators', 'draft_campaign_brief', 'send_collaboration_offer', 'track_deliverable', 'release_payment', 'get_campaign_status', 'list_audit_logs', 'request_human_approval']) {
      assert.ok(names.includes(required), `missing ${required}`);
    }
    const offer = toolDefinitions().find((t) => t.name === 'send_collaboration_offer')!;
    assert.equal(offer.inputSchema.type, 'object');
    assert.ok(offer.inputSchema.required.includes('proposed_rate'));
  });

  test('every scope only lists registered tools', () => {
    const all = new Set(TOOLS.map((t) => t.name));
    for (const tools of Object.values(SCOPE_TOOLS)) for (const t of tools) assert.ok(all.has(t), t);
  });

  test('search_creators returns scored creators', async () => {
    const res = await mcpServer.callTool('sess_techpulse_operator', 'search_creators', { campaign_id: 'camp_techpulse_earbuds', niche: 'Tech & Gadgets', min_engagement: 3.5 });
    assert.equal(res.status, 'SUCCESS');
    const r = res.result as any;
    assert.ok(r.count > 0);
    assert.ok(r.creators[0].match_score >= r.creators[r.creators.length - 1].match_score, 'sorted by relevance');
  });

  test('invalid input is rejected with a FAILED audit entry', async () => {
    const res = await mcpServer.callTool('sess_techpulse_operator', 'send_collaboration_offer', { campaign_id: 'camp_techpulse_earbuds' });
    assert.equal(res.status, 'FAILED');
    assert.match(res.error ?? '', /Invalid input/);
  });

  test('unknown session is rejected', async () => {
    const res = await mcpServer.callTool('sess_nope', 'search_creators', {});
    assert.equal(res.status, 'REJECTED_BY_GUARDRAIL');
  });
});

describe('Governance & guardrails (paper §9)', () => {
  test('permission scoping blocks tools outside the role scope', async () => {
    const res = await mcpServer.callTool('sess_glow_scout', 'release_payment', { collaboration_id: 'collab_elena_glow', amount: 100 });
    assert.equal(res.status, 'REJECTED_BY_GUARDRAIL');
    assert.match(res.error ?? '', /Permission denied/);
  });

  test('hard budget ceiling blocks oversized offers', async () => {
    const session = createSession({ name: 'tiny', brand_id: 'brand_techpulse', campaign_id: 'camp_techpulse_earbuds', role_scope: 'FULL_OPERATOR', budget_ceiling: 500, rate_ceiling: 5000 }, 'test');
    const res = await mcpServer.callTool(session.id, 'send_collaboration_offer', { campaign_id: 'camp_techpulse_earbuds', creator_id: 'cr_oliver', proposed_rate: 900, deliverables: ['YOUTUBE_VIDEO'] });
    assert.equal(res.status, 'REJECTED_BY_GUARDRAIL');
    assert.match(res.error ?? '', /Budget ceiling exceeded/);
    assert.equal(queryOne<any>(`SELECT COUNT(*) n FROM collaborations WHERE creator_id = 'cr_oliver'`)?.n, 0, 'nothing written');
  });

  test('rate ceiling parks the offer at a human checkpoint and approval executes it', async () => {
    const session = createSession({ name: 'capped', brand_id: 'brand_techpulse', campaign_id: 'camp_techpulse_earbuds', role_scope: 'FULL_OPERATOR', budget_ceiling: 10000, rate_ceiling: 800 }, 'test');
    const before = campaignFinancials('camp_techpulse_earbuds').escrow_locked;
    const res = await mcpServer.callTool(session.id, 'send_collaboration_offer', { campaign_id: 'camp_techpulse_earbuds', creator_id: 'cr_oliver', proposed_rate: 1200, deliverables: ['YOUTUBE_VIDEO'] });
    assert.equal(res.status, 'HELD_FOR_APPROVAL');
    assert.ok(res.checkpoint_id);
    assert.equal(campaignFinancials('camp_techpulse_earbuds').escrow_locked, before, 'no escrow moved while pending');

    const chk = mcpServer.resolveCheckpoint(res.checkpoint_id!, 'APPROVED', { id: 'usr_reviewer', name: 'Reviewer', notes: 'ok' });
    assert.equal(chk.status, 'APPROVED');
    assert.ok(chk.executed_result?.collaboration_id);
    assert.equal(campaignFinancials('camp_techpulse_earbuds').escrow_locked, before + 1200, 'escrow held after approval');
    assert.throws(() => mcpServer.resolveCheckpoint(res.checkpoint_id!, 'APPROVED', { id: 'x' }), /already APPROVED/);
    declineOffer(chk.executed_result.collaboration_id, { type: 'BRAND', id: 'usr_reviewer' }, 'cleanup');
  });

  test('payments above the threshold require human approval; rejection leaves money in escrow', async () => {
    const col = getCollaboration('collab_marcus_techpulse');
    const approved = col.deliverables.find((d) => d.status === 'APPROVED')!;
    const res = await mcpServer.callTool('sess_techpulse_operator', 'release_payment', { collaboration_id: col.id, deliverable_id: approved.id, amount: 1950 });
    assert.equal(res.status, 'HELD_FOR_APPROVAL');
    const chk = mcpServer.resolveCheckpoint(res.checkpoint_id!, 'REJECTED', { id: 'usr_reviewer', notes: 'Wait for the reel.' });
    assert.equal(chk.status, 'REJECTED');
    assert.equal(collaborationEscrow(col.id), 1950);
  });

  test('brief changes after acceptance are held for approval', async () => {
    const res = await mcpServer.callTool('sess_techpulse_operator', 'draft_campaign_brief', { campaign_id: 'camp_techpulse_earbuds', objectives: 'Changed' });
    assert.equal(res.status, 'HELD_FOR_APPROVAL');
    assert.equal(getCheckpoint(res.checkpoint_id!).action_type, 'BRIEF_MODIFICATION');
  });

  test('paused sessions cannot act', async () => {
    const s = createSession({ name: 'paused', brand_id: 'brand_techpulse', role_scope: 'DISCOVERY_ONLY', budget_ceiling: 0, rate_ceiling: 0 }, 'test');
    const { updateSessionStatus } = await import('../core/governance');
    updateSessionStatus(s.id, 'PAUSED');
    const res = await mcpServer.callTool(s.id, 'search_creators', {});
    assert.equal(res.status, 'REJECTED_BY_GUARDRAIL');
  });
});

describe('Immutable audit trail', () => {
  test('hash chain verifies end to end', () => {
    const v = verifyAuditChain();
    assert.equal(v.valid, true);
    assert.ok(v.checked > 20);
  });
  test('rows cannot be updated or deleted', () => {
    const { db } = require('../db/database');
    assert.throws(() => db.exec(`UPDATE audit_logs SET result_summary = 'x' WHERE seq = 1`), /append-only/);
    assert.throws(() => db.exec(`DELETE FROM audit_logs WHERE seq = 1`), /append-only/);
  });
  test('held and rejected calls are logged with guardrail notes', () => {
    const held = listAudit({ status: 'HELD_FOR_APPROVAL', limit: 5 }).items;
    assert.ok(held.length > 0);
    assert.ok(held[0].guardrail_notes.length > 0);
  });
});

describe('Contracts, escrow & payments', () => {
  test('offer → counter → accept → submit → approve → pay keeps the ledger consistent', () => {
    const campaign = createCampaign({ brand_id: 'brand_nomad', title: 'Ledger test', budget: 5000, status: 'ACTIVE', content_guidelines: 'Use #ad and tag @nomadkitchen with code NOMAD40.' }, human);
    const col = sendOffer({ campaign_id: campaign.id, creator_id: 'cr_nia', proposed_rate: 800, deliverables: ['REEL'] }, human);
    assert.equal(campaignFinancials(campaign.id).escrow_locked, 800);
    counterOffer(col.id, 900, 'A bit more please', { type: 'CREATOR', id: 'cr_nia' });
    assert.equal(campaignFinancials(campaign.id).escrow_locked, 900, 'escrow follows the counter');
    acceptOffer(col.id, { type: 'BRAND', id: human.id });
    const d = getCollaboration(col.id).deliverables[0];
    const sub = submitDeliverable(d.id, { content_url: 'https://www.instagram.com/reel/abc/', caption: '#ad Weeknight tacos with @nomadkitchen — code NOMAD40 for 40% off your first box.' }, { type: 'HUMAN', id: 'cr_nia' });
    assert.equal(sub.deliverable.compliance?.passed, true);
    assert.ok(sub.deliverable.metrics!.views > 0);
    assert.throws(() => releasePayment({ collaboration_id: col.id, deliverable_id: d.id }, human), /must be APPROVED/);
    reviewDeliverable(d.id, 'APPROVED', undefined, human);
    const walletBefore = creatorWallet('cr_nia').balance;
    const pay = releasePayment({ collaboration_id: col.id, deliverable_id: d.id }, human);
    assert.equal(pay.amount, 900);
    assert.equal(creatorWallet('cr_nia').balance, walletBefore + 900);
    assert.equal(getCollaboration(col.id).status, 'COMPLETED');
    const fin = campaignFinancials(campaign.id);
    assert.equal(fin.spent, 900);
    assert.equal(fin.escrow_locked, 0);
    assert.equal(fin.available, 4100);
    assert.equal(trialBalance().balanced, true);
  });

  test('declining returns escrow to the campaign', () => {
    const campaign = createCampaign({ brand_id: 'brand_nomad', title: 'Decline test', budget: 2000, status: 'ACTIVE' }, human);
    const col = sendOffer({ campaign_id: campaign.id, creator_id: 'cr_grace', proposed_rate: 700, deliverables: ['POST'] }, human);
    declineOffer(col.id, { type: 'CREATOR', id: 'cr_grace' }, 'No thanks');
    assert.equal(campaignFinancials(campaign.id).available, 2000);
  });

  test('offers cannot exceed available campaign budget', () => {
    const campaign = createCampaign({ brand_id: 'brand_nomad', title: 'Small budget', budget: 500, status: 'ACTIVE' }, human);
    assert.throws(() => sendOffer({ campaign_id: campaign.id, creator_id: 'cr_grace', proposed_rate: 900, deliverables: ['POST'] }, human), /Insufficient available campaign budget/);
  });

  test('campaign status transitions are enforced', () => {
    const campaign = createCampaign({ brand_id: 'brand_nomad', title: 'Transitions', budget: 100 }, human);
    assert.equal(campaign.status, 'DRAFT');
    assert.throws(() => transitionCampaign(campaign.id, 'COMPLETED', human), /Cannot move/);
    transitionCampaign(campaign.id, 'ACTIVE', human);
    assert.throws(() => updateCampaign(campaign.id, { budget: -1 }, human));
    assert.equal(getCampaign(campaign.id).status, 'ACTIVE');
  });

  test('compliance checker catches missing disclosure and wrong platform', () => {
    const c = getCampaign('camp_techpulse_earbuds');
    const report = runComplianceCheck({ caption: 'Loving these earbuds, code PULSE20', content_url: 'https://www.tiktok.com/@x/video/1', campaign: { content_guidelines: c.content_guidelines, title: c.title }, deliverable_type: 'YOUTUBE_VIDEO' });
    assert.equal(report.passed, false);
    assert.equal(report.checks.find((x) => x.id === 'disclosure')?.passed, false);
    assert.equal(report.checks.find((x) => x.id === 'platform')?.passed, false);
  });
});

describe('Marketplace intelligence', () => {
  test('match score rewards niche + rate band fit', () => {
    const rows = searchCreators({ campaign_id: 'camp_glow_radiance', limit: 50 });
    const elena = rows.find((r) => r.id === 'cr_elena')!;
    const jax = rows.find((r) => r.id === 'cr_jaxson')!;
    assert.ok(elena.match_score > jax.match_score);
    assert.ok(elena.match_reasons.length > 0);
  });
  test('rate benchmark returns percentiles for a tier', () => {
    const b = rateBenchmark({ follower_count: 200000, deliverable: 'video', niche: 'Tech' });
    assert.ok(b.median > 0 && b.p75 >= b.median && b.median >= b.p25);
    assert.equal(b.tier, 'Mid-tier');
  });
});

describe('Agent runtime', () => {
  test('simulated run executes governed tool calls and records events', async () => {
    const session = createSession({ name: 'sim', brand_id: 'brand_apex', campaign_id: 'camp_apex_training', role_scope: 'FULL_OPERATOR', budget_ceiling: 6000, rate_ceiling: 1200 }, 'test');
    const run = startRun({ session_id: session.id, campaign_id: 'camp_apex_training', goal: 'Shortlist and send two offers, then track and pay deliverables.', mode: 'SIMULATED' });
    const done = await waitForRun(run.id);
    assert.equal(done.status, 'COMPLETED');
    assert.ok(done.steps_count >= 5);
    const types = new Set(done.events!.map((e) => e.type));
    for (const t of ['thinking', 'tool_call', 'tool_result', 'done']) assert.ok(types.has(t as any), t);
    assert.ok(listAudit({ run_id: run.id }).total >= done.steps_count);
    assert.equal(trialBalance().balanced, true);
  });
});

describe('Evaluation lab', () => {
  test('manual model scales with creators evaluated', () => {
    assert.ok(modelManualWorkflow(30, 3).human_minutes > modelManualWorkflow(10, 2).human_minutes);
  });
  test('scenario run records a matched pair', async () => {
    const out = await runScenario('beauty_ugc', { mode: 'SIMULATED' });
    assert.equal(out.manual.workflow_type, 'MANUAL');
    assert.equal(out.agentic.workflow_type, 'AGENTIC');
    assert.ok(out.agentic.time_to_launch_sec < out.manual.time_to_launch_sec);
    assert.ok(queryAll(`SELECT id FROM campaign_shortlist WHERE campaign_id = ?`, [out.campaign_id]).length >= 1);
  });
});
