import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import './db/database';
import { authenticate } from './auth/auth';
import { errorHandler } from './routes/helpers';
import { authRouter } from './routes/auth.routes';
import { orgsRouter } from './routes/orgs.routes';
import { creatorsRouter } from './routes/creators.routes';
import { campaignsRouter } from './routes/campaigns.routes';
import { collaborationsRouter } from './routes/collaborations.routes';
import { governanceRouter } from './routes/governance.routes';
import { agentsRouter } from './routes/agents.routes';
import { insightsRouter } from './routes/insights.routes';
import { mcpHttpRouter } from './mcp/http';
import { platformEventStream } from './realtime/sse';
import { requireAuth } from './auth/auth';
import { runtimeInfo } from './agent/service';
import { PROTOCOL_VERSION } from './mcp/protocol';
import { ensureSeeded } from './db/seed';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(authenticate);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', system: 'Creator Marketing Infrastructure (CMI)', version: '2.0.0', mcp_protocol: PROTOCOL_VERSION, runtime: runtimeInfo(), timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api', orgsRouter);
app.use('/api/creators', creatorsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/collaborations', collaborationsRouter);
app.use('/api', governanceRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/insights', insightsRouter);
app.get('/api/events', requireAuth, platformEventStream);
// Browser navigations to /mcp (the dashboard's MCP page) get the SPA; JSON-RPC clients get the transport.
app.get('/mcp', (req, res, next) => {
  const html = (req.headers.accept ?? '').includes('text/html');
  const index = path.resolve(__dirname, '../../client/dist/index.html');
  if (html && fs.existsSync(index)) res.sendFile(index); else next();
});
app.use('/mcp', mcpHttpRouter);

// Serve the built dashboard in production.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/mcp|\/health).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(errorHandler);

if (process.env.CMI_AUTO_SEED !== 'false') ensureSeeded();

app.listen(PORT, () => {
  const rt = runtimeInfo();
  const line = (label: string, value: string) => `│  ${label.padEnd(16)}${value.padEnd(46)}│`;
  console.log([
    '┌' + '─'.repeat(64) + '┐',
    line('CMI', 'Creator Marketing Infrastructure v2.0.0'),
    '├' + '─'.repeat(64) + '┤',
    line('REST API', `http://localhost:${PORT}/api`),
    line('MCP (HTTP)', `http://localhost:${PORT}/mcp`),
    line('MCP (stdio)', 'npm run mcp:stdio'),
    line('Events (SSE)', `http://localhost:${PORT}/api/events`),
    line('Agent runtime', rt.llm_available ? `Claude · ${rt.default_model}` : 'Simulated planner (set ANTHROPIC_API_KEY)'),
    '└' + '─'.repeat(64) + '┘',
  ].join('\n'));
});
