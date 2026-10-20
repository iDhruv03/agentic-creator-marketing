import React, { useState } from 'react';
import {
  Building2,
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  ExternalLink,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Agency, Brand, Campaign } from '../types';

interface AgencyWorkspaceViewProps {
  agencies: Agency[];
  brands: Brand[];
  campaigns: Campaign[];
  onSelectTab: (tab: string) => void;
}

export const AgencyWorkspaceView: React.FC<AgencyWorkspaceViewProps> = ({
  agencies,
  brands,
  campaigns,
  onSelectTab,
}) => {
  const currentAgency = agencies[0] || {
    id: 'agency_omni',
    name: 'OmniMedia Creator Agency',
    contact_email: 'partnerships@omnimediacreators.com',
  };

  const [selectedBrandId, setSelectedBrandId] = useState<string>('ALL');

  const agencyBrands = brands; // All brands under agency portfolio
  const filteredCampaigns = campaigns.filter((c) =>
    selectedBrandId === 'ALL' ? true : c.brand_id === selectedBrandId
  );

  const totalPortfolioBudget = agencyBrands.reduce((acc, b) => acc + b.total_budget, 0);
  const totalPortfolioSpent = agencyBrands.reduce((acc, b) => acc + b.spent_budget, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-semibold">
                Multi-Client Agency Workspace (Section 5.2)
              </span>
              <h2 className="text-xl font-extrabold text-white">{currentAgency.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{currentAgency.contact_email}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Total Portfolio Capital</span>
            <div className="text-xl font-extrabold text-white font-mono">
              ${totalPortfolioBudget.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Brand Client Separation (Section 5.2: Client-level separation of budgets & reporting) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Brand Client Workspaces ({agencyBrands.length})
          </h3>
          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={() => setSelectedBrandId('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                selectedBrandId === 'ALL'
                  ? 'bg-indigo-500 text-white font-bold'
                  : 'text-slate-400 bg-slate-900 hover:text-white'
              }`}
            >
              All Clients
            </button>
            {agencyBrands.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBrandId(b.id)}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  selectedBrandId === b.id
                    ? 'bg-indigo-500 text-white font-bold'
                    : 'text-slate-400 bg-slate-900 hover:text-white'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Client Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agencyBrands.map((b) => {
            const isSelected = selectedBrandId === b.id;
            const clientCampaigns = campaigns.filter((c) => c.brand_id === b.id);
            const utilPct = Math.round((b.spent_budget / b.total_budget) * 100);

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBrandId(isSelected ? 'ALL' : b.id)}
                className={`p-5 rounded-2xl glass-panel border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{b.name}</h4>
                    <span className="text-xs text-slate-400">{b.industry}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                    {clientCampaigns.length} Campaigns
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500">Total Budget</span>
                    <p className="font-mono font-bold text-white">${b.total_budget.toLocaleString()}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500">Disbursed</span>
                    <p className="font-mono font-bold text-emerald-400">${b.spent_budget.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>Disbursement Ratio</span>
                    <span>{utilPct}%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${utilPct}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaigns Managed for Selected Scope */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Active Client Campaigns ({filteredCampaigns.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCampaigns.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3 text-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase">{c.brand_name}</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{c.title}</h4>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {c.status}
                </span>
              </div>

              <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">{c.brief}</p>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="font-mono font-bold text-white text-xs">
                  Budget: ${c.budget.toLocaleString()}
                </span>
                <button
                  onClick={() => onSelectTab('campaigns')}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
                >
                  <span>Open Brief</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
