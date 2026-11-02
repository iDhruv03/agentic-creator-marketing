#!/usr/bin/env node
/**
 * CMI Governed MCP server over stdio.
 *
 * Add to Claude Desktop / Cursor / any MCP client:
 *   { "command": "npx", "args": ["tsx", "/path/to/server/src/mcp/stdio.ts"],
 *     "env": { "CMI_SESSION_ID": "sess_techpulse_operator" } }
 *
 * Every tool call is governed by the session's budget, rate and permission
 * scope and appended to the immutable audit log.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import '../db/database';
import { buildProtocolServer } from './protocol';

const sessionId = process.env.CMI_SESSION_ID || 'sess_techpulse_operator';

async function main() {
  const server = buildProtocolServer(sessionId);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`CMI governed MCP server ready on stdio (session ${sessionId}).\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err?.message ?? err}\n`);
  process.exit(1);
});
