import React from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Handshake,
  ShieldAlert,
  WalletCards,
  FileCode2,
  Bot,
  FlaskConical,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCheckpointsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  pendingCheckpointsCount,
}) => {
  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'creators', label: 'Creator Marketplace', icon: Users },
    { id: 'collaborations', label: 'Collaborations & Proof', icon: Handshake },
    {
      id: 'checkpoints',
      label: 'Checkpoints Queue',
      icon: ShieldAlert,
      badge: pendingCheckpointsCount,
    },
    { id: 'ledger', label: 'Financial Ledger', icon: WalletCards },
    { id: 'audit', label: 'Immutable Audit Trail', icon: FileCode2 },
    { id: 'agent_hub', label: 'Agent & MCP Hub', icon: Bot },
    { id: 'evaluation', label: 'Evaluation Lab', icon: FlaskConical },
  ];

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-950/50 p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Infrastructure Core
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px]">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Protocol Banner & Architecture spec */}
      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-[11px] font-semibold text-slate-300">MCP Protocol 2024-11-05</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Dual-interface architecture: Web & Governed MCP Server running on shared core.
        </p>
      </div>
    </aside>
  );
};
