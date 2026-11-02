import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TOOLS } from './tools';
import { mcpServer } from './server';
import { getSession } from '../core/governance';
import { getCampaign, listCampaigns } from '../core/campaigns';
import { listAudit } from '../core/audit';

export const PROTOCOL_VERSION = '2025-06-18';
export const SERVER_INFO = { name: 'cmi-governed-mcp-server', version: '2.0.0' };

/**
 * Build a standards-compliant MCP server bound to one agent session.
 * The tool list is filtered to the session's permission scope, and every
 * call is routed through the governed executor.
 */
export function buildProtocolServer(sessionId: string): McpServer {
  const session = getSession(sessionId);
  const server = new McpServer(SERVER_INFO, {
    instructions: [
      'You are operating the Creator Marketing Infrastructure (CMI) on behalf of a brand or agency.',
      session ? `Agent session: ${session.name} (${session.id}) · scope ${session.role_scope} · budget ceiling $${session.budget_ceiling.toLocaleString()} · per-collaboration ceiling $${session.rate_ceiling.toLocaleString()} · committed so far $${session.spent_amount.toLocaleString()}.` : `WARNING: session '${sessionId}' does not exist; every call will be rejected until a valid CMI_SESSION_ID is configured.`,
      session?.campaign_id ? `This session is bound to campaign ${session.campaign_id}.` : '',
      'Call get_campaign_status before taking action. Calls that exceed your ceilings are blocked or held for human approval; a HELD_FOR_APPROVAL result means the action has NOT happened.',
    ].filter(Boolean).join('\n'),
  });

  const allowed = session ? new Set(session.allowed_tools) : null;
  for (const t of TOOLS) {
    if (allowed && !allowed.has(t.name)) continue;
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: (t.schema as z.ZodObject<any>).shape,
        annotations: { readOnlyHint: t.risk === 'read', destructiveHint: t.risk === 'high_impact', idempotentHint: t.risk === 'read', openWorldHint: false },
      },
      async (args: any) => {
        const res = await mcpServer.callTool(sessionId, t.name, args);
        const body = res.status === 'SUCCESS' ? res.result : { status: res.status, error: res.error, ...(res.result as any ?? {}), guardrail_notes: res.guardrail_notes, audit_id: res.audit_id };
        return { content: [{ type: 'text' as const, text: JSON.stringify(body, null, 2) }], isError: res.status === 'REJECTED_BY_GUARDRAIL' || res.status === 'FAILED' };
      },
    );
  }

  server.registerResource('campaigns', 'cmi://campaigns', { title: 'Campaign index', description: 'All campaigns visible to this session', mimeType: 'application/json' }, async (uri) => {
    const rows = listCampaigns(session?.brand_id ? { brand_id: session.brand_id } : {}).map((c) => ({ id: c.id, title: c.title, brand: c.brand_name, status: c.status, budget: c.financials }));
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(rows, null, 2) }] };
  });

  server.registerResource('campaign-brief', new ResourceTemplate('cmi://campaigns/{campaignId}/brief', { list: undefined }), { title: 'Campaign brief', mimeType: 'text/markdown' }, async (uri, vars) => {
    const c = getCampaign(String(vars.campaignId));
    const md = [`# ${c.title}`, `Brand: ${c.brand_name} · Status: ${c.status} · Budget: $${c.budget.toLocaleString()}`, '', '## Brief', c.brief, '', '## Objectives', c.objectives, '', '## Target audience', c.target_audience, '', '## Content guidelines', c.content_guidelines, '', '## Required deliverables', ...c.required_deliverables.map((d) => `- ${d}`)].join('\n');
    return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: md }] };
  });

  server.registerResource('session-audit', 'cmi://audit/session', { title: 'Session audit trail', mimeType: 'application/json' }, async (uri) => {
    const { items } = listAudit({ session_id: sessionId, limit: 50 });
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(items, null, 2) }] };
  });

  server.registerPrompt('launch-campaign', { title: 'Launch a campaign end to end', description: 'Discovery → shortlist → brief → offers, with checkpoints respected.', argsSchema: { campaign_id: z.string().describe('Campaign to run') } as any }, (args: any) => ({
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Run campaign ${args.campaign_id} end to end: inspect status, search creators that fit the brief, shortlist the best 3 with rationale, refine the brief if needed, then send offers within the rate band. Escalate anything ambiguous with request_human_approval.` } }],
  }));

  return server;
}
