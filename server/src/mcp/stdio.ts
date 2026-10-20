#!/usr/bin/env node
/**
 * CMI Governed Model Context Protocol (MCP) stdio Transport Server
 * Standard MCP JSON-RPC 2.0 communication over standard input / output
 * Connect with Claude Desktop, Cursor, or any MCP client!
 */

import { mcpServerInstance } from './server';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const DEFAULT_SESSION_ID = process.env.CMI_SESSION_ID || 'sess_agent_cmi_alpha';

rl.on('line', async (line) => {
  if (!line.trim()) return;

  try {
    const request = JSON.parse(line);
    const { id, method, params } = request;

    if (method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'cmi-governed-mcp-server',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/list') {
      const tools = mcpServerInstance.listTools();
      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          tools,
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs } = params || {};
      const sessionId = toolArgs?.session_id || DEFAULT_SESSION_ID;
      const res = await mcpServerInstance.callTool(sessionId, name, toolArgs || {});

      const response = {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2),
            },
          ],
          isError: res.status !== 'SUCCESS',
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
      return;
    }

    // Default unknown method
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method '${method}' not found` },
      }) + '\n'
    );
  } catch (err: any) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` },
      }) + '\n'
    );
  }
});

process.stderr.write('🚀 CMI MCP stdio server started. Listening on stdin...\n');
