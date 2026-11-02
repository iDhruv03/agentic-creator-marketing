import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildProtocolServer } from './protocol';

/**
 * MCP Streamable HTTP transport mounted at /mcp.
 *
 * Stateless mode: every request builds a fresh protocol server bound to the
 * agent session named by the `X-CMI-Session` header (or `?session=`). Remote
 * MCP clients (Claude, Cursor, custom agents) connect to http://host/mcp.
 */
export const mcpHttpRouter = Router();

function resolveSession(req: Request): string {
  return String(req.header('x-cmi-session') || req.query.session || process.env.CMI_SESSION_ID || 'sess_techpulse_operator');
}

async function handle(req: Request, res: Response) {
  const sessionId = resolveSession(req);
  const server = buildProtocolServer(sessionId);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close().catch(() => undefined);
    server.close().catch(() => undefined);
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err?.message ?? 'Internal error' }, id: null });
  }
}

mcpHttpRouter.post('/', handle);
mcpHttpRouter.get('/', (_req, res) => {
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Stateless transport: open a POST request with a JSON-RPC body. Set the X-CMI-Session header to choose the agent session.' }, id: null });
});
mcpHttpRouter.delete('/', (_req, res) => res.status(204).end());
