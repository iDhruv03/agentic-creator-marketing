import React, { useState } from 'react';
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  Filter,
  Bot,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogTabProps {
  auditLogs: AuditLog[];
}

export const AuditLogTab: React.FC<AuditLogTabProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = auditLogs.filter((log) => {
    if (statusFilter !== 'ALL' && log.execution_status !== statusFilter) return false;
    if (
      searchQuery &&
      !log.tool_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !log.result_summary.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !log.actor_id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { label: 'SUCCESS', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'HELD_FOR_APPROVAL':
        return { label: 'HELD FOR APPROVAL', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'REJECTED_BY_GUARDRAIL':
        return { label: 'BLOCKED BY GUARDRAIL', color: 'bg-red-500/10 text-red-400 border-red-500/20' };
      case 'FAILED':
        return { label: 'FAILED', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      default:
        return { label: status, color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileCode2 className="w-5 h-5 text-emerald-400" />
            <span>Immutable Governance Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Append-only chronological record of every MCP tool invocation, parameter payload, guardrail evaluation, and checkpoint outcome.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center space-x-2">
          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tool or actor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="HELD_FOR_APPROVAL">Held For Approval</option>
            <option value="REJECTED_BY_GUARDRAIL">Blocked by Guardrail</option>
          </select>
        </div>
      </div>

      {/* Audit Log Entries List */}
      <div className="space-y-2.5">
        {filteredLogs.map((log) => {
          const isExpanded = expandedId === log.id;
          const badge = getStatusBadge(log.execution_status);
          const isAgent = log.actor_type === 'AGENT';

          return (
            <div
              key={log.id}
              className="rounded-2xl glass-panel border border-slate-800 overflow-hidden text-xs transition-all"
            >
              <div
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/40"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <button className="text-slate-500">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isAgent
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isAgent ? 'AGENT' : 'HUMAN'}
                  </span>

                  <span className="font-mono font-bold text-white text-xs">
                    {log.tool_name}()
                  </span>

                  <span className="text-slate-400 truncate hidden md:inline max-w-md">
                    {log.result_summary}
                  </span>
                </div>

                <div className="flex items-center space-x-3 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
                    {log.duration_ms}ms
                  </span>
                  <span className="text-slate-500 text-[11px] whitespace-nowrap">
                    {log.timestamp}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-4 pt-1 bg-slate-950/80 border-t border-slate-800/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <span className="text-slate-500">Event Audit ID:</span>
                      <p className="font-mono text-emerald-400 mt-0.5">{log.id}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Actor Identity:</span>
                      <p className="font-mono text-slate-300 mt-0.5">{log.actor_id}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Guardrail Verdict Notes:</span>
                      <p className="text-amber-400/90 mt-0.5">{log.guardrail_notes || 'All safety checks passed.'}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px]">Invocation Parameters (JSON):</span>
                    <pre className="mt-1 p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(log.parameters, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
