import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Bot,
  DollarSign,
  FileText,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { ApprovalCheckpoint } from '../types';

interface CheckpointsQueueTabProps {
  checkpoints: ApprovalCheckpoint[];
  onResolveCheckpoint: (id: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => Promise<void>;
}

export const CheckpointsQueueTab: React.FC<CheckpointsQueueTabProps> = ({
  checkpoints,
  onResolveCheckpoint,
}) => {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<ApprovalCheckpoint | null>(
    checkpoints.find((c) => c.status === 'PENDING') || checkpoints[0] || null
  );
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pendingCheckpoints = checkpoints.filter((c) => c.status === 'PENDING');
  const resolvedCheckpoints = checkpoints.filter((c) => c.status !== 'PENDING');

  const handleResolve = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedCheckpoint) return;
    setIsSubmitting(true);
    try {
      await onResolveCheckpoint(selectedCheckpoint.id, decision, reviewerNotes);
      setReviewerNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'PAYMENT_ABOVE_THRESHOLD':
        return { label: 'High-Value Payment', color: 'bg-red-500/10 text-red-400 border-red-500/30' };
      case 'OUT_OF_BAND_RATE':
        return { label: 'Out-Of-Band Rate', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'BRIEF_MODIFICATION':
        return { label: 'Brief Change', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      default:
        return { label: type, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Human-in-the-Loop Checkpoints Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Section 9 Governance: High-impact agent actions held in suspension until explicit human approval.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
            {pendingCheckpoints.length} Action(s) Pending Review
          </span>
        </div>
      </div>

      {/* Main Grid: Queue on Left, Decision Review Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checkpoint Queue */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Pending Human Decisions ({pendingCheckpoints.length})
          </div>

          {pendingCheckpoints.length === 0 ? (
            <div className="p-8 text-center rounded-2xl glass-panel border border-slate-800 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <span>All checkpoints cleared! No pending high-risk actions.</span>
            </div>
          ) : (
            pendingCheckpoints.map((chk) => {
              const isSelected = selectedCheckpoint?.id === chk.id;
              const badge = getActionBadge(chk.action_type);

              return (
                <div
                  key={chk.id}
                  onClick={() => setSelectedCheckpoint(chk)}
                  className={`p-4 rounded-2xl glass-panel cursor-pointer transition-all border ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{chk.created_at?.split(' ')[1] || 'Just now'}</span>
                  </div>

                  <h4 className="text-xs font-bold text-white mt-2 leading-snug">
                    Tool: <code className="text-emerald-400 font-mono">{chk.tool_name}()</code>
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{chk.justification}</p>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 truncate max-w-[150px]">{chk.agent_name || chk.agent_session_id}</span>
                    {chk.amount && (
                      <span className="font-mono font-bold text-white">${chk.amount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Resolved Checkpoints Section */}
          {resolvedCheckpoints.length > 0 && (
            <div className="pt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                Resolved Decisions ({resolvedCheckpoints.length})
              </div>
              {resolvedCheckpoints.slice(0, 3).map((chk) => (
                <div
                  key={chk.id}
                  onClick={() => setSelectedCheckpoint(chk)}
                  className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-xs flex items-center justify-between cursor-pointer hover:border-slate-700"
                >
                  <div className="truncate pr-2">
                    <span className="text-slate-300 font-medium truncate block">{chk.tool_name}()</span>
                    <span className="text-[10px] text-slate-500 font-mono">{chk.id}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      chk.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {chk.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Checkpoint Detailed Reviewer Inspector */}
        <div className="lg:col-span-2">
          {selectedCheckpoint ? (
            <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-mono text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>CHECKPOINT #{selectedCheckpoint.id}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-white mt-1">
                    Intercepted Action: <code className="text-emerald-400 font-mono">{selectedCheckpoint.tool_name}()</code>
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Trigger Value</span>
                  <div className="text-xl font-extrabold text-white font-mono">
                    ${selectedCheckpoint.amount?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Agent Information */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500">Initiating AI Agent</span>
                  <p className="font-semibold text-slate-200 mt-0.5 flex items-center space-x-1.5">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{selectedCheckpoint.agent_name || selectedCheckpoint.agent_session_id}</span>
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Associated Campaign</span>
                  <p className="font-semibold text-slate-200 mt-0.5">
                    {selectedCheckpoint.campaign_title || selectedCheckpoint.campaign_id}
                  </p>
                </div>
              </div>

              {/* Justification Box */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Agent Reason & Guardrail Violation Trigger</span>
                </span>
                <p className="p-4 rounded-xl bg-slate-950 border border-amber-500/20 text-slate-300 text-xs leading-relaxed">
                  {selectedCheckpoint.justification}
                </p>
              </div>

              {/* Payload Parameters JSON */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-400">Intercepted Tool Parameters</span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedCheckpoint.payload, null, 2)}
                </pre>
              </div>

              {/* Decision Section (if PENDING) */}
              {selectedCheckpoint.status === 'PENDING' ? (
                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reviewer Sign-off Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Verified YouTube video metrics and sponsor code; release approved."
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleResolve('REJECTED')}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 flex items-center space-x-1.5 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Agent Action</span>
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleResolve('APPROVED')}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Release Funds</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Decision resolved by: <strong className="text-slate-200">{selectedCheckpoint.resolved_by || 'Human Brand Manager'}</strong>
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold ${
                      selectedCheckpoint.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    Resolved: {selectedCheckpoint.status}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 glass-panel rounded-2xl border border-slate-800">
              Select a checkpoint to inspect and take action
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
