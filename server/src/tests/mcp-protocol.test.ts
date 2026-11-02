import './setup';
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { runSeed } from '../db/seed';
import { buildProtocolServer } from '../mcp/protocol';
import { createSession } from '../core/governance';

async function connect(sessionId: string) {
  const server = buildProtocolServer(sessionId);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

before(() => runSeed({ quiet: true }));

describe('MCP protocol surface (official SDK)', () => {
  test('tools/list is filtered to the session scope', async () => {
    const scout = await connect('sess_glow_scout');
    const tools = (await scout.client.listTools()).tools.map((t) => t.name);
    assert.ok(tools.includes('search_creators'));
    assert.ok(!tools.includes('release_payment'), 'discovery scope must not expose payments');
    await scout.close();

    const operator = await connect('sess_techpulse_operator');
    const all = (await operator.client.listTools()).tools.map((t) => t.name);
    assert.ok(all.includes('release_payment'));
    assert.ok(all.length >= 14);
    await operator.close();
  });

  test('tools/call returns the governed envelope and flags blocked calls as errors', async () => {
    const s = createSession({ name: 'proto', brand_id: 'brand_techpulse', campaign_id: 'camp_techpulse_earbuds', role_scope: 'FULL_OPERATOR', budget_ceiling: 100, rate_ceiling: 100 }, 'test');
    const { client, close } = await connect(s.id);
    const ok = await client.callTool({ name: 'get_campaign_status', arguments: { campaign_id: 'camp_techpulse_earbuds' } });
    assert.equal(ok.isError, false);
    const body = JSON.parse((ok.content as any)[0].text);
    assert.equal(body.campaign.id, 'camp_techpulse_earbuds');

    const blocked = await client.callTool({ name: 'send_collaboration_offer', arguments: { campaign_id: 'camp_techpulse_earbuds', creator_id: 'cr_oliver', proposed_rate: 5000, deliverables: ['POST'] } });
    assert.equal(blocked.isError, true);
    const err = JSON.parse((blocked.content as any)[0].text);
    assert.equal(err.status, 'REJECTED_BY_GUARDRAIL');
    await close();
  });

  test('resources and prompts are discoverable', async () => {
    const { client, close } = await connect('sess_techpulse_operator');
    const res = await client.listResources();
    assert.ok(res.resources.some((r) => r.uri === 'cmi://campaigns'));
    const brief = await client.readResource({ uri: 'cmi://campaigns/camp_techpulse_earbuds/brief' });
    assert.match(String((brief.contents[0] as any).text), /PulseBuds Pro Launch/);
    const prompts = await client.listPrompts();
    assert.ok(prompts.prompts.some((p) => p.name === 'launch-campaign'));
    await close();
  });

  test('unknown session yields rejected calls, not a crash', async () => {
    const { client, close } = await connect('sess_does_not_exist');
    const tools = await client.listTools();
    assert.ok(tools.tools.length > 0, 'all tools are listed so the client can see what it would need');
    const r = await client.callTool({ name: 'search_creators', arguments: {} });
    assert.equal(r.isError, true);
    await close();
  });
});
