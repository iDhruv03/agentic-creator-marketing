import React, { useState } from 'react';
import {
  Bot,
  Cpu,
  Terminal,
  Play,
  Copy,
  Check,
  Shield,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { AgentSession } from '../types';

interface AgentHubTabProps {
  agentSessions: AgentSession[];
  onOpenAgentRunner: () => void;
  onCallTool: (sessionId: string, toolName: string, params: any) => Promise<any>;
}

export const AgentHubTab: React.FC<AgentHubTabProps> = ({
  agentSessions,
  onOpenAgentRunner,
  onCallTool,
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    agentSessions[0]?.id || 'sess_agent_cmi_alpha'
  );
  const [selectedTool, setSelectedTool] = useState<string>('search_creators');
  const [toolParamsJson, setToolParamsJson] = useState<string>(
    JSON.stringify({ niche: 'Tech & Gadgets', min_engagement: 3.5, max_rate: 2000 }, null, 2)
  );
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const toolsList = [
    {
      name: 'search_creators',
      description: 'Search creators across niches and platforms with follower and rate filters.',
      defaultParams: { niche: 'Tech & Gadgets', min_engagement: 3.5, max_rate: 2000 },
    },
    {
      name: 'draft_campaign_brief',
      description: 'Refine campaign brief with audience targets and required deliverables.',
      defaultParams: {
        campaign_id: 'camp_techpulse_earbuds',
        brief: 'High-impact autumn wireless audio campaign highlighting ANC and battery life.',
        required_deliverables: ['1x YouTube Video', '1x Instagram Reel'],
      },
    },
    {
      name: 'send_collaboration_offer',
      description: 'Dispatch offer to creator with automated escrow hold and rate ceiling check.',
      defaultParams: {
        campaign_id: 'camp_techpulse_earbuds',
        creator_id: 'cr_marcus',
        proposed_rate: 1800,
        deliverables: ['YOUTUBE_VIDEO'],
        deadline: '2026-11-15',
      },
    },
    {
      name: 'track_deliverable',
      description: 'Verify live creator link against brief requirements and log metrics.',
      defaultParams: {
        collaboration_id: 'collab_marcus_techpulse',
        deliverable_id: 'deliv_marcus_yt',
        content_url: 'https://youtube.com/watch?v=sample_review_99',
      },
    },
    {
      name: 'release_payment',
      description: 'Disburse escrowed funds to creator; triggers checkpoint if > $1,000.',
      defaultParams: {
        collaboration_id: 'collab_marcus_techpulse',
        deliverable_id: 'deliv_marcus_yt',
        amount: 1800,
      },
    },
    {
      name: 'get_campaign_status',
      description: 'Get real-time operational status and budget balance of a campaign.',
      defaultParams: { campaign_id: 'camp_techpulse_earbuds' },
    },
  ];

  const handleToolSelect = (toolName: string) => {
    setSelectedTool(toolName);
    const toolDef = toolsList.find((t) => t.name === toolName);
    if (toolDef) {
      setToolParamsJson(JSON.stringify(toolDef.defaultParams, null, 2));
    }
  };

  const handleExecuteTool = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const parsedParams = JSON.parse(toolParamsJson);
      const res = await onCallTool(selectedSessionId, selectedTool, parsedParams);
      setExecutionResult(res);
    } catch (err: any) {
      setExecutionResult({ error: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const mcpClaudeConfig = JSON.stringify(
    {
      mcpServers: {
        'cmi-creator-marketing': {
          command: 'npx',
          args: ['ts-node', `${window.location.origin.replace('http://localhost:5173', '')}/server/src/mcp/stdio.ts`],
          env: {
            CMI_SESSION_ID: selectedSessionId,
          },
        },
      },
    },
    null,
    2
  );

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(mcpClaudeConfig);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            <span>Agent Governance Hub & MCP Interface</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Model Context Protocol registry, agent session budget scoping, and live execution harness.
          </p>
        </div>

        <button
          onClick={onOpenAgentRunner}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all w-fit"
        >
          <Zap className="w-4 h-4" />
          <span>Launch Autonomous Campaign</span>
        </button>
      </div>

      {/* Active Agent Sessions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Authorized AI Agent Sessions ({agentSessions.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentSessions.map((session) => {
            const isSelected = selectedSessionId === session.id;
            const spendPct = Math.round((session.spent_amount / session.budget_ceiling) * 100);

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className={`p-5 rounded-2xl glass-panel cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-sm text-white">{session.name}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">{session.id}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {session.role_scope}
                  </span>
                </div>

                {/* Constraints */}
                <div className="grid grid-cols-2 gap-3 mt-4 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase">Session Budget Ceiling</span>
                    <p className="font-mono font-bold text-white mt-0.5">${session.budget_ceiling.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase">Per-Offer Rate Cap</span>
                    <p className="font-mono font-bold text-white mt-0.5">${session.rate_ceiling.toLocaleString()}</p>
                  </div>
                </div>

                {/* Spend Gauge */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Budget Utilized: {spendPct}%</span>
                    <span>${session.spent_amount.toLocaleString()} / ${session.budget_ceiling.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                      style={{ width: `${spendPct}%` }}
                    ></div>
                  </div>
                </div>

                {/* Allowed Tools */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {session.allowed_tools.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-slate-900 text-[10px] font-mono text-slate-300 border border-slate-800"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive MCP Tool Execution Harness */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-white">Live MCP Tool Execution Harness</h3>
          </div>
          <span className="text-xs text-slate-400">
            Active Session: <strong className="text-emerald-400 font-mono">{selectedSessionId}</strong>
          </span>
        </div>

        {/* Tool selector buttons */}
        <div className="flex flex-wrap gap-2">
          {toolsList.map((tool) => (
            <button
              key={tool.name}
              onClick={() => handleToolSelect(tool.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all ${
                selectedTool === tool.name
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {tool.name}()
            </button>
          ))}
        </div>

        {/* JSON Editor and Run Button */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Input Parameters (JSON):
            </label>
            <textarea
              rows={8}
              value={toolParamsJson}
              onChange={(e) => setToolParamsJson(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              disabled={isExecuting}
              onClick={handleExecuteTool}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md flex items-center justify-center space-x-2 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isExecuting ? 'Invoking MCP Tool...' : 'Execute Tool via Governed Server'}</span>
            </button>
          </div>

          {/* Execution Result */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Governed MCP Response:
            </label>
            <div className="h-[215px] p-3 rounded-xl bg-slate-950 border border-slate-800 overflow-y-auto text-xs font-mono text-slate-300">
              {executionResult ? (
                <pre>{JSON.stringify(executionResult, null, 2)}</pre>
              ) : (
                <span className="text-slate-600 italic">Click Execute to inspect governed response...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Claude Desktop / Cursor MCP Config Box */}
      <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h4 className="font-bold text-xs text-white">External LLM Agent Connection (Claude Desktop / Cursor)</h4>
          </div>
          <button
            onClick={handleCopyConfig}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center space-x-1.5 transition-all"
          >
            {copiedConfig ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedConfig ? 'Copied' : 'Copy Stdio Config'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Add this to your Claude Desktop configuration (<code className="text-slate-300 font-mono">claude_desktop_config.json</code>) to grant Claude access to this governed creator marketing platform.
        </p>
        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
          {mcpClaudeConfig}
        </pre>
      </div>
    </div>
  );
};
