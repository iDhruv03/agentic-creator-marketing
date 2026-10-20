import React from 'react';
import {
  DollarSign,
  Lock,
  CheckCircle,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Bot,
  AlertTriangle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { Campaign, ApprovalCheckpoint, AuditLog } from '../types';

interface OverviewTabProps {
  campaigns: Campaign[];
  checkpoints: ApprovalCheckpoint[];
  auditLogs: AuditLog[];
  onOpenAgentRunner: () => void;
  onSelectTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  campaigns,
  checkpoints,
  auditLogs,
  onOpenAgentRunner,
  onSelectTab,
}) => {
  const totalBudget = campaigns.reduce((acc, c) => acc + (c.budget || 0), 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + (c.spent || 0), 0);
  const totalEscrow = campaigns.reduce((acc, c) => acc + (c.escrow_locked || 0), 0);
  const pendingCheckpoints = checkpoints.filter((c) => c.status === 'PENDING').length;
  const autonomousToolCalls = auditLogs.filter((a) => a.actor_type === 'AGENT').length;

  const chartData = campaigns.map((c) => ({
    name: c.title.split(' ')[0] + ' ' + (c.title.split(' ')[1] || ''),
    budget: c.budget,
    spent: c.spent,
    escrow: c.escrow_locked,
  }));

  const pieData = [
    { name: 'Released Payouts', value: totalSpent, color: '#10b981' },
    { name: 'Escrow Locked', value: totalEscrow, color: '#f59e0b' },
    { name: 'Available Budget', value: Math.max(0, totalBudget - totalSpent - totalEscrow), color: '#6366f1' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autonomous Campaign Orchestration Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Creator Marketing Infrastructure
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl mt-1">
              Unified operating system bridging human brand managers and autonomous LLM agents over a governed Model Context Protocol (MCP) server.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectTab('evaluation')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
            >
              Evaluation Lab
            </button>
            <button
              onClick={onOpenAgentRunner}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition-all"
            >
              <Bot className="w-4 h-4" />
              <span>Launch Autonomous Agent</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Managed Budget</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            ${totalBudget.toLocaleString()}
          </div>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-indigo-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Across {campaigns.length} active campaigns</span>
          </div>
        </div>

        {/* Escrow Locked */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Escrow Locked</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            ${totalEscrow.toLocaleString()}
          </div>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-amber-400 font-medium">
            <span>Guaranteed creator commitments</span>
          </div>
        </div>

        {/* Released Payouts */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Released Payouts</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            ${totalSpent.toLocaleString()}
          </div>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-emerald-400 font-medium">
            <span>Completed milestone disbursements</span>
          </div>
        </div>

        {/* Pending Checkpoints & Agent Calls */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Autonomous Actions</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white flex items-center justify-between">
            <span>{autonomousToolCalls}</span>
            {pendingCheckpoints > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center space-x-1 font-semibold">
                <AlertTriangle className="w-3 h-3" />
                <span>{pendingCheckpoints} Review</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 mt-2 text-xs text-slate-400">
            <span>Governed via MCP server & guardrails</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Budget Allocation Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Campaign Capital Allocation</h2>
              <p className="text-xs text-slate-400">Budget vs Spent vs Escrow breakdown per campaign</p>
            </div>
            <button
              onClick={() => onSelectTab('campaigns')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="budget" fill="#6366f1" radius={[4, 4, 0, 0]} name="Allocated Budget" />
                <Bar dataKey="spent" fill="#10b981" radius={[4, 4, 0, 0]} name="Released" />
                <Bar dataKey="escrow" fill="#f59e0b" radius={[4, 4, 0, 0]} name="In Escrow" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ledger Capital Distribution */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Financial Ledger Position</h2>
            <p className="text-xs text-slate-400">Current aggregate capital allocation</p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <span className="text-slate-400">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-200">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Snapshot & Recent Real-Time Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Campaigns */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Active Campaigns</h3>
            <button
              onClick={() => onSelectTab('campaigns')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Manage &rarr;
            </button>
          </div>

          <div className="space-y-2.5">
            {campaigns.slice(0, 3).map((cmp) => {
              const spentPct = Math.min(100, Math.round(((cmp.spent + cmp.escrow_locked) / cmp.budget) * 100));
              return (
                <div
                  key={cmp.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer"
                  onClick={() => onSelectTab('campaigns')}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">{cmp.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{cmp.brief}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      {cmp.status}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span>Capital Committed: {spentPct}%</span>
                      <span>${(cmp.spent + cmp.escrow_locked).toLocaleString()} / ${cmp.budget.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                        style={{ width: `${spentPct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Immutable Audit Stream */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-sm font-bold text-white">Live Governance Stream</h3>
            </div>
            <button
              onClick={() => onSelectTab('audit')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Full Log &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {auditLogs.slice(0, 4).map((log) => {
              const isAgent = log.actor_type === 'AGENT';
              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs"
                >
                  <div
                    className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      isAgent
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {isAgent ? 'AGENT' : 'HUMAN'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-emerald-400 font-semibold">{log.tool_name}()</span>
                      <span className="text-[10px] text-slate-500">{log.duration_ms}ms</span>
                    </div>
                    <p className="text-slate-300 text-[11px] truncate mt-0.5">{log.result_summary}</p>
                    {log.guardrail_notes && (
                      <p className="text-slate-500 text-[10px] truncate">{log.guardrail_notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
