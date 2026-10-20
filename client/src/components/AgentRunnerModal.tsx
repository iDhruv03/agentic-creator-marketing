import React, { useState } from 'react';
import {
  Bot,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Campaign, AgentSession } from '../types';

interface AgentRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  agentSessions: AgentSession[];
  onRunAgent: (sessionId: string, campaignId: string, goalPrompt: string) => Promise<any>;
  onSelectTab: (tab: string) => void;
}

export const AgentRunnerModal: React.FC<AgentRunnerModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  agentSessions,
  onRunAgent,
  onSelectTab,
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaigns[0]?.id || 'camp_techpulse_earbuds');
  const [selectedSessionId, setSelectedSessionId] = useState(agentSessions[0]?.id || 'sess_agent_cmi_alpha');
  const [goalPrompt, setGoalPrompt] = useState(
    'Identify top tech creators with >3.5% engagement, refine campaign deliverables, lock escrow for collaboration offer, and verify deliverable metrics.'
  );

  const [isRunning, setIsRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<any>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  if (!isOpen) return null;

  const handleLaunch = async () => {
    setIsRunning(true);
    setRunSummary(null);
    setActiveStepIndex(0);

    try {
      const summary = await onRunAgent(selectedSessionId, selectedCampaignId, goalPrompt);
      setRunSummary(summary);
    } catch (err: any) {
      alert(`Agent execution failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-3xl glass-panel border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">Autonomous AI Marketing Agent</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  MCP Protocol
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-step autonomous orchestration constrained by session budget caps and human-in-the-loop checkpoints.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold p-1 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Configuration Form */}
          {!runSummary && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Target Campaign</label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (${c.budget.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Authorized Agent Session</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  >
                    {agentSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Ceiling: ${s.budget_ceiling.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Orchestration Goal / Prompt</label>
                <textarea
                  rows={2}
                  value={goalPrompt}
                  onChange={(e) => setGoalPrompt(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              {/* Guardrails summary notice */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 space-y-1">
                <div className="flex items-center space-x-1.5 font-bold">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Governance Guardrails Enforced:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-indigo-200/80">
                  <li>Budget ceiling strictly enforced by MCP server.</li>
                  <li>Per-collaboration rate limit of $2,000 applies.</li>
                  <li>Payments &gt; $1,000 automatically routed to human approval checkpoint.</li>
                  <li>Every step recorded in immutable append-only audit log.</li>
                </ul>
              </div>

              <button
                disabled={isRunning}
                onClick={handleLaunch}
                className="w-full py-3 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 hover:opacity-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>{isRunning ? 'Agent Executing Autonomous MCP Tool Sequence...' : 'Launch Autonomous Campaign Execution'}</span>
              </button>
            </div>
          )}

          {/* Execution Progress & Steps Stream */}
          {runSummary && (
            <div className="space-y-4">
              {/* Execution Summary Header */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-emerald-400 font-bold text-xs flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Autonomous Campaign Run Completed</span>
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5">{runSummary.message}</p>
                </div>
                {runSummary.checkpoints_triggered > 0 && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{runSummary.checkpoints_triggered} Checkpoint Created</span>
                  </span>
                )}
              </div>

              {/* Chain of Thought & Tool Steps */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Agent Chain-of-Thought & MCP Invocations ({runSummary.steps.length} Steps)</span>
                </h4>

                <div className="space-y-3">
                  {runSummary.steps.map((st: any) => {
                    const isHeld = st.status === 'HELD_FOR_APPROVAL';
                    return (
                      <div
                        key={st.step}
                        className={`p-4 rounded-2xl border text-xs space-y-2.5 transition-all ${
                          isHeld
                            ? 'bg-amber-500/5 border-amber-500/30'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center">
                              {st.step}
                            </span>
                            <span className="font-mono font-bold text-emerald-400">{st.tool_name}()</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isHeld
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}
                          >
                            {st.status}
                          </span>
                        </div>

                        {/* Thought */}
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-300 leading-relaxed text-[11px] italic">
                          💭 <strong>Agent Thought:</strong> {st.thought}
                        </div>

                        {/* Guardrail Note */}
                        {st.guardrail_notes && (
                          <div className="text-[10px] text-amber-400/90 font-mono">
                            🛡️ Guardrail Check: {st.guardrail_notes}
                          </div>
                        )}

                        {/* Tool arguments & result snippet */}
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          Args: {JSON.stringify(st.tool_arguments)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {runSummary && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <button
              onClick={() => {
                setRunSummary(null);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onSelectTab('checkpoints');
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md flex items-center space-x-1.5 transition-all"
            >
              <span>Inspect Checkpoint Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
