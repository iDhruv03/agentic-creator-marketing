import { mcpServerInstance } from '../mcp/server';
import { queryAll, queryOne } from '../db/database';
import { runSeed } from '../db/seed';

async function runTestSuite() {
  console.log('🧪 Starting CMI Verification Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Seed database
    console.log('Test 1: Database Initialization & Seeding');
    runSeed();
    const creatorsCount = queryAll('SELECT count(*) as cnt FROM creators')[0].cnt;
    assert(creatorsCount >= 8, `Creators table seeded with ${creatorsCount} profiles`);

    // 2. MCP Tools List
    console.log('\nTest 2: MCP Tool Registry & Discovery (Section 5.3)');
    const tools = mcpServerInstance.listTools();
    assert(tools.length >= 5, `MCP server exposes ${tools.length} callable tools`);
    const toolNames = tools.map(t => t.name);
    assert(toolNames.includes('search_creators'), 'Contains search_creators tool');
    assert(toolNames.includes('draft_campaign_brief'), 'Contains draft_campaign_brief tool');
    assert(toolNames.includes('send_collaboration_offer'), 'Contains send_collaboration_offer tool');
    assert(toolNames.includes('track_deliverable'), 'Contains track_deliverable tool');
    assert(toolNames.includes('release_payment'), 'Contains release_payment tool');

    // 3. Search Creators via MCP
    console.log('\nTest 3: MCP search_creators() Invocation');
    const searchRes = await mcpServerInstance.callTool('sess_agent_cmi_alpha', 'search_creators', {
      niche: 'Tech & Gadgets',
      min_engagement: 3.5,
    });
    assert(searchRes.status === 'SUCCESS', 'search_creators executed with status SUCCESS');
    assert(searchRes.result.creators.length > 0, `Discovered ${searchRes.result.creators.length} matching creators`);

    // 4. Send Collaboration Offer via MCP & Escrow Locking
    console.log('\nTest 4: MCP send_collaboration_offer() & Escrow Ledger Hold');
    const offerRes = await mcpServerInstance.callTool('sess_agent_cmi_alpha', 'send_collaboration_offer', {
      campaign_id: 'camp_techpulse_earbuds',
      creator_id: 'cr_liam',
      proposed_rate: 950,
      deliverables: ['YOUTUBE_VIDEO'],
      deadline: '2026-11-10',
    });
    assert(offerRes.status === 'SUCCESS', 'send_collaboration_offer approved by guardrails');
    assert(Boolean(offerRes.result.collaboration_id), 'Collaboration record generated');

    const escrowLedger = queryOne<any>(
      `SELECT * FROM ledger_entries WHERE collaboration_id = ? AND entry_type = 'ESCROW_HOLD'`,
      [offerRes.result.collaboration_id]
    );
    assert(Boolean(escrowLedger), 'Escrow hold entry placed in Financial Ledger');

    // 5. Guardrail Test: Hard Budget Ceiling Violation
    console.log('\nTest 5: Guardrail Hard Budget Ceiling Protection (Section 9)');
    const overBudgetRes = await mcpServerInstance.callTool('sess_agent_cmi_alpha', 'send_collaboration_offer', {
      campaign_id: 'camp_techpulse_earbuds',
      creator_id: 'cr_maya',
      proposed_rate: 99999, // Exceeds $15,000 session budget
      deliverables: ['YOUTUBE_VIDEO'],
      deadline: '2026-11-10',
    });
    assert(overBudgetRes.status === 'REJECTED_BY_GUARDRAIL', 'Tool call blocked by budget guardrail');
    assert(overBudgetRes.error?.includes('Budget ceiling exceeded') ?? false, 'Descriptive budget breach error returned');

    // 6. Guardrail Test: High-Value Payment Human Checkpoint Interception (Section 9)
    console.log('\nTest 6: Human-in-the-Loop Checkpoint Interception (Section 9)');
    const highPaymentRes = await mcpServerInstance.callTool('sess_agent_cmi_alpha', 'release_payment', {
      collaboration_id: 'collab_marcus_techpulse',
      deliverable_id: 'deliv_marcus_yt',
      amount: 1800, // Exceeds $1,000 autonomous threshold
    });
    assert(highPaymentRes.status === 'HELD_FOR_APPROVAL', 'Payment > $1,000 held for human approval');
    assert(Boolean(highPaymentRes.result?.checkpoint_id), 'Registered checkpoint on dashboard queue');

    // 7. Immutable Audit Trail Verification
    console.log('\nTest 7: Immutable Audit Logging (Section 9)');
    const auditCount = queryOne<any>('SELECT count(*) as cnt FROM audit_logs').cnt;
    assert(auditCount >= 5, `Audit log contains ${auditCount} verifiable append-only records`);

    console.log(`\n========================================`);
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTestSuite();
