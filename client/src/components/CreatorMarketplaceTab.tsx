import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  Star,
  DollarSign,
  Send,
  Eye,
  Globe,
  Share2,
  Sparkles,
} from 'lucide-react';
import { Creator, Campaign } from '../types';

interface CreatorMarketplaceTabProps {
  creators: Creator[];
  campaigns: Campaign[];
  onSendOffer: (offerData: any) => Promise<void>;
  onSelectTab: (tab: string) => void;
}

export const CreatorMarketplaceTab: React.FC<CreatorMarketplaceTabProps> = ({
  creators,
  campaigns,
  onSendOffer,
}) => {
  const [selectedNiche, setSelectedNiche] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState<boolean>(false);

  // Offer form state
  const [offerCampaignId, setOfferCampaignId] = useState<string>(campaigns[0]?.id || '');
  const [offerRate, setOfferRate] = useState<number>(1000);
  const [offerDeliverables, setOfferDeliverables] = useState<string[]>(['YOUTUBE_VIDEO']);
  const [offerDeadline, setOfferDeadline] = useState<string>('2026-11-15');
  const [offerTerms, setOfferTerms] = useState<string>('Standard 30-day usage rights with exclusive affiliate tracking code.');

  // Niches list
  const niches = ['ALL', 'Tech & Gadgets', 'Beauty & Skincare', 'Fitness & Apparel', 'Lifestyle & Travel'];

  // Filtered creators
  const filteredCreators = creators.filter((c) => {
    if (selectedNiche !== 'ALL' && c.primary_niche !== selectedNiche) return false;
    if (selectedPlatform !== 'ALL' && !c.platforms.includes(selectedPlatform.toLowerCase())) return false;
    if (
      searchQuery &&
      !c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !c.handle.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleOpenOfferModal = (creator: Creator) => {
    setActiveCreator(creator);
    setOfferRate(creator.rate_video || 1000);
    setIsOfferModalOpen(true);
  };

  const handleOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCreator) return;

    await onSendOffer({
      campaign_id: offerCampaignId,
      creator_id: activeCreator.id,
      proposed_rate: offerRate,
      deliverables: offerDeliverables,
      deadline: offerDeadline,
      terms: offerTerms,
    });

    setIsOfferModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <span>Creator Discovery Marketplace</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified profiles, media kits, and rates accessible to both human marketers and AI agents via <code className="text-emerald-400 font-mono">search_creators()</code>.
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search handle or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-1 mr-2 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Niche:</span>
        </div>
        {niches.map((niche) => (
          <button
            key={niche}
            onClick={() => setSelectedNiche(niche)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedNiche === niche
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white bg-slate-900/40 border border-slate-800'
            }`}
          >
            {niche}
          </button>
        ))}

        <div className="h-4 w-px bg-slate-800 mx-2 hidden sm:block"></div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Platform:</span>
          {['ALL', 'YouTube', 'Instagram', 'TikTok'].map((plat) => (
            <button
              key={plat}
              onClick={() => setSelectedPlatform(plat)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                selectedPlatform === plat
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {plat}
            </button>
          ))}
        </div>
      </div>

      {/* Creator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCreators.map((creator) => (
          <div
            key={creator.id}
            className="rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 overflow-hidden flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-emerald-950/20"
          >
            <div className="p-4 space-y-3">
              {/* Creator Card Header */}
              <div className="flex items-start space-x-3">
                <img
                  src={creator.avatar_url}
                  alt={creator.name}
                  className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="font-bold text-sm text-white truncate">{creator.name}</h3>
                    {creator.verified ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">@{creator.handle}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-900 border border-slate-800 text-slate-300">
                    {creator.primary_niche}
                  </span>
                </div>
              </div>

              {/* Bio snippet */}
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {creator.bio}
              </p>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Followers</div>
                  <div className="text-xs font-bold text-white mt-0.5 font-mono">
                    {(creator.follower_count / 1000).toFixed(0)}k
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Engage</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                    {creator.engagement_rate}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Rating</div>
                  <div className="text-xs font-bold text-amber-400 mt-0.5 font-mono flex items-center justify-center space-x-0.5">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{creator.rating}</span>
                  </div>
                </div>
              </div>

              {/* Rate Card & Platforms */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="text-slate-400 text-[11px]">
                  Video Rate: <span className="font-bold text-white font-mono">${creator.rate_video}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {creator.platforms.map((p) => (
                    <span
                      key={p}
                      className="px-1.5 py-0.5 rounded bg-slate-900 text-[9px] uppercase font-mono text-slate-400 border border-slate-800"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Card Action Buttons */}
            <div className="p-3 bg-slate-900/40 border-t border-slate-800 flex items-center space-x-2">
              <button
                onClick={() => setActiveCreator(creator)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all flex items-center justify-center space-x-1"
              >
                <Eye className="w-3 h-3" />
                <span>Media Kit</span>
              </button>
              <button
                onClick={() => handleOpenOfferModal(creator)}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all flex items-center justify-center space-x-1 shadow-sm"
              >
                <Send className="w-3 h-3" />
                <span>Send Offer</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Media Kit Modal */}
      {activeCreator && !isOfferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 shadow-2xl space-y-5">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <img
                  src={activeCreator.avatar_url}
                  alt={activeCreator.name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-600 shadow-lg"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-extrabold text-white">{activeCreator.name}</h3>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono">@{activeCreator.handle}</p>
                  <p className="text-xs text-emerald-400 font-medium">{activeCreator.primary_niche}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveCreator(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Audience Demographics */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Audience Demographics</span>
              </h4>
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Top Country</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{activeCreator.audience_top_country}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Primary Age</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{activeCreator.audience_top_age}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Gender Split</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{activeCreator.audience_gender_ratio}</p>
                </div>
              </div>
            </div>

            {/* Rate Card */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rate Card (Standard Deliverables)</span>
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">YouTube Video</span>
                  <p className="font-bold text-white font-mono mt-0.5">${activeCreator.rate_video}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Instagram Reel</span>
                  <p className="font-bold text-white font-mono mt-0.5">${activeCreator.rate_reel}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Feed Post</span>
                  <p className="font-bold text-white font-mono mt-0.5">${activeCreator.rate_post}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 text-[10px]">Story Sequence</span>
                  <p className="font-bold text-white font-mono mt-0.5">${activeCreator.rate_story}</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setActiveCreator(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setOfferRate(activeCreator.rate_video);
                  setIsOfferModalOpen(true);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Offer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Offer Modal */}
      {isOfferModalOpen && activeCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Dispatch Collaboration Offer to @{activeCreator.handle}</span>
              </h3>
              <button
                onClick={() => setIsOfferModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOfferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Campaign</label>
                <select
                  value={offerCampaignId}
                  onChange={(e) => setOfferCampaignId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (Available: ${(c.budget - c.spent - c.escrow_locked).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Offered Rate ($ USD)</label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={offerRate}
                    onChange={(e) => setOfferRate(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Deliverable Deadline</label>
                  <input
                    type="date"
                    value={offerDeadline}
                    onChange={(e) => setOfferDeadline(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Agreement Terms & Deliverables</label>
                <textarea
                  rows={2}
                  value={offerTerms}
                  onChange={(e) => setOfferTerms(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
                ℹ️ <strong>Escrow Notice:</strong> Sending this offer will instantly place a hold of ${offerRate} in the Financial Ledger.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md"
                >
                  Confirm & Lock Escrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
