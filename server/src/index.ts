import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { apiRouter } from './routes/api';
import './db/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Creator Marketing Infrastructure (CMI)',
    version: '1.0.0',
    mcp_protocol: '2024-11-05',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`
====================================================================
🚀 Creator Marketing Infrastructure (CMI) Core & Governed MCP Server
====================================================================
📍 Server running on: http://localhost:${PORT}
🔌 REST API:         http://localhost:${PORT}/api
🛠️  MCP Tool Spec:   http://localhost:${PORT}/api/mcp/tools
🤖 MCP Tool Call:   http://localhost:${PORT}/api/mcp/call
====================================================================
`);
});
