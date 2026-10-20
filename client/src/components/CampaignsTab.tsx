import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  DollarSign,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  Sparkles,
} from 'lucide-react';
import { Campaign, Brand } from '../types';

interface CampaignsTabProps {
  campaigns: Campaign[];
  brands: Brand[];
  onCreateCampaign: (campaignData: any) => Promise<void>;
  onSelectTab: (tab: string) => void;
}

export const CampaignsTab: React.FC<CampaignsTabProps> = ({
  campaigns,
  brands,
  onCreateCampaign,
  onSelectTab,
}) => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(campaigns[0] || null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    brand_id: brands[0]?.id || 'brand_techpulse',
    title: '',
    brief: '',
    objectives: '',
    target_niches: ['Tech & Gadgets'],
    target_audience: '',
    content_guidelines: '',
    required_deliverables: ['1x YouTube Video', '1x Instagram Reel'],
    budget: 15000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.brief) return;
    await onCreateCampaign(form);
    setIsCreateOpen(false);
    setForm({
      brand_id: brands[0]?.id || 'brand_techpulse',
      title: '',
      brief: '',
      objectives: '',
      target_niches: ['Tech & Gadgets'],
      target_audience: '',
      content_guidelines: '',
      required_deliverables: ['1x YouTube Video', '1x Instagram Reel'],
      budget: 15000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Megaphone className="w-5 h-5 text-emerald-400" />
            <span>Campaigns Architecture & Briefs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Single source of truth shared between human operators and AI marketing agents (Section 5.5).
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md flex items-center space-x-1.5 transition-all w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Main layout: Campaigns List on Left, Selected Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns List */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Active Campaigns ({campaigns.length})
          </div>
          {campaigns.map((c) => {
            const isSelected = selectedCampaign?.id === c.id;
            const committed = c.spent + c.escrow_locked;
            const progress = Math.min(100, Math.round((committed / c.budget) * 100));

            return (
              <div
                key={c.id}
                onClick={() => setSelectedCampaign(c)}
                className={`p-4 rounded-2xl glass-panel cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-medium text-emerald-400 uppercase tracking-wider">
                      {c.brand_name || 'Brand'}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5 leading-snug">{c.title}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {c.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center space-x-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <span>Budget: ${c.budget.toLocaleString()}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{progress}% committed</span>
                </div>

                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Campaign Detailed Inspector */}
        <div className="lg:col-span-2">
          {selectedCampaign ? (
            <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-mono text-emerald-400">
                    <span>{selectedCampaign.id}</span>
                    <span>•</span>
                    <span>{selectedCampaign.brand_name}</span>
                  </div>
                  <h2 className="text-lg font-extrabold text-white mt-1">{selectedCampaign.title}</h2>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Allocated Budget</div>
                    <div className="text-lg font-extrabold text-white">
                      ${selectedCampaign.budget.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Spent Payouts</span>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    ${selectedCampaign.spent.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Escrow Locked</span>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    ${selectedCampaign.escrow_locked.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Available Balance</span>
                  <div className="text-base font-bold text-indigo-400 mt-0.5">
                    ${(selectedCampaign.budget - selectedCampaign.spent - selectedCampaign.escrow_locked).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Brief Content */}
              <div className="space-y-4 text-xs">
                <div>
                  <h3 className="font-semibold text-slate-300 flex items-center space-x-1.5 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Creative Brief</span>
                  </h3>
                  <p className="text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
                    {selectedCampaign.brief}
                  </p>
                </div>

                {selectedCampaign.objectives && (
                  <div>
                    <h3 className="font-semibold text-slate-300 flex items-center space-x-1.5 mb-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Campaign Objectives</span>
                    </h3>
                    <p className="text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
                      {selectedCampaign.objectives}
                    </p>
                  </div>
                )}

                {selectedCampaign.target_audience && (
                  <div>
                    <h3 className="font-semibold text-slate-300 flex items-center space-x-1.5 mb-1.5">
                      <Target className="w-3.5 h-3.5 text-teal-400" />
                      <span>Target Demographics</span>
                    </h3>
                    <p className="text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
                      {selectedCampaign.target_audience}
                    </p>
                  </div>
                )}

                {/* Required Deliverables */}
                <div>
                  <h3 className="font-semibold text-slate-300 flex items-center space-x-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Required Deliverables</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCampaign.required_deliverables?.map((d, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-medium"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action CTA */}
                <div className="pt-4 flex items-center justify-between border-t border-slate-800">
                  <span className="text-[11px] text-slate-500">
                    Operable via MCP tool: <code className="text-emerald-400">draft_campaign_brief()</code>
                  </span>
                  <button
                    onClick={() => onSelectTab('creators')}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-1.5 transition-all"
                  >
                    <span>Match Creators</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 glass-panel rounded-2xl border border-slate-800">
              Select a campaign to inspect details
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Create New Marketing Campaign</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Brand Client</label>
                <select
                  value={form.brand_id}
                  onChange={(e) => setForm({ ...form, brand_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.industry})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Campaign Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Wireless Noise-Cancelling Earbuds Seeding"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Creative Brief & Guidelines</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Summarize product messaging, key value propositions, and mandatory disclosures..."
                  value={form.brief}
                  onChange={(e) => setForm({ ...form, brief: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Allocated Budget ($ USD)</label>
                  <input
                    type="number"
                    min={1000}
                    step={500}
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target Niche</label>
                  <input
                    type="text"
                    value={form.target_niches[0]}
                    onChange={(e) => setForm({ ...form, target_niches: [e.target.value] })}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md"
                >
                  Create & Fund Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
