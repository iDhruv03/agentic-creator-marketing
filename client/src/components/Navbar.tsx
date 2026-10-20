import React from 'react';
import { Bot, Shield, CheckCircle2, AlertTriangle, Cpu, Layers } from 'lucide-react';

interface NavbarProps {
  currentRole: 'brand' | 'agency' | 'creator' | 'agent';
  setCurrentRole: (role: 'brand' | 'agency' | 'creator' | 'agent') => void;
  pendingCheckpointsCount: number;
  onOpenAgentRunner: () => void;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  setCurrentRole,
  pendingCheckpointsCount,
  onOpenAgentRunner,
  onSelectTab,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & System Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                CMI Platform
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                MCP Core
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Agentic Creator Marketing Infrastructure</p>
          </div>
        </div>

        {/* Actor Role Switcher (Section 5.2) */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setCurrentRole('brand')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              currentRole === 'brand'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🏢</span>
            <span>Brand</span>
          </button>

          <button
            onClick={() => setCurrentRole('agency')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              currentRole === 'agency'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🏛️</span>
            <span>Agency</span>
          </button>

          <button
            onClick={() => setCurrentRole('creator')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              currentRole === 'creator'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🎨</span>
            <span>Creator</span>
          </button>

          <button
            onClick={() => setCurrentRole('agent')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
              currentRole === 'agent'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🤖</span>
            <span>Agent/MCP</span>
          </button>
        </div>

        {/* Right Action Center */}
        <div className="flex items-center space-x-3">
          {/* Checkpoint Alert Badge */}
          <button
            onClick={() => onSelectTab('checkpoints')}
            className="relative px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium flex items-center space-x-2 hover:bg-amber-500/20 transition-all"
            title="Human-in-the-Loop Checkpoints"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Checkpoints</span>
            {pendingCheckpointsCount > 0 ? (
              <span className="flex h-5 w-5 relative items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-slate-950 font-bold text-[10px] items-center justify-center">
                  {pendingCheckpointsCount}
                </span>
              </span>
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>

          {/* Autonomous Agent Trigger CTA */}
          <button
            onClick={onOpenAgentRunner}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold flex items-center space-x-2 shadow-md hover:from-emerald-400 hover:to-teal-400 transition-all"
          >
            <Bot className="w-4 h-4 text-slate-950" />
            <span>Run AI Agent</span>
          </button>
        </div>
      </div>
    </header>
  );
};
