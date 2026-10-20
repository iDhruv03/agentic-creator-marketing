import React, { useState } from 'react';
import {
  Palette,
  Wallet,
  CheckCircle,
  Clock,
  Send,
  UploadCloud,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Star,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Creator, Collaboration } from '../types';

interface CreatorPortalViewProps {
  creators: Creator[];
  collaborations: Collaboration[];
  onRespondCollab: (id: string, status: 'ACCEPTED' | 'REJECTED') => Promise<void>;
  onSubmitDeliverable: (deliverableId: string, data: { content_url: string; caption?: string }) => Promise<void>;
}

export const CreatorPortalView: React.FC<CreatorPortalViewProps> = ({
  creators,
  collaborations,
  onRespondCollab,
  onSubmitDeliverable,
}) => {
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(
    creators[0]?.id || 'cr_marcus'
  );

  const currentCreator =
    creators.find((c) => c.id === selectedCreatorId) || creators[0];

  const creatorCollabs = collaborations.filter(
    (c) => c.creator_id === currentCreator.id
  );

  const incomingOffers = creatorCollabs.filter((c) => c.status === 'OFFERED');
  const activeCollabs = creatorCollabs.filter(
    (c) => c.status !== 'OFFERED' && c.status !== 'REJECTED'
  );

  return (
    <div className="space-y-6">
      {/* Creator Switcher Header */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <img
              src={currentCreator.avatar_url}
              alt={currentCreator.name}
              className="w-14 h-14 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-lg"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-white">{currentCreator.name}</h2>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  {currentCreator.primary_niche}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">@{currentCreator.handle}</p>
            </div>
          </div>

          {/* Switch Creator Profile Dropdown */}
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-400">Switch Creator:</span>
            <select
              value={selectedCreatorId}
              onChange={(e) => setSelectedCreatorId(e.target.value)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            >
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (@{c.handle})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Financial Wallet Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Available Wallet Balance</span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">
              ${currentCreator.wallet_balance.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Ready for instant bank transfer</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Locked in Escrow</span>
            <div className="text-xl font-extrabold text-amber-400 font-mono mt-0.5">
              ${currentCreator.escrow_pending.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400">Releases upon deliverable approval</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-500 text-[10px] uppercase">Completed Campaigns</span>
            <div className="text-xl font-extrabold text-white font-mono mt-0.5">
              {currentCreator.completed_campaigns}
            </div>
            <span className="text-[10px] text-emerald-400">100% On-time deliverable record</span>
          </div>
        </div>
      </div>

      {/* Collaboration Inbox (Section 7.2) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>Incoming Collaboration Offers ({incomingOffers.length})</span>
        </h3>

        {incomingOffers.length === 0 ? (
          <div className="p-6 text-center rounded-2xl glass-panel border border-slate-800 text-xs text-slate-500">
            No pending offers in inbox.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingOffers.map((offer) => (
              <div
                key={offer.id}
                className="p-5 rounded-2xl glass-panel border border-amber-500/30 bg-amber-500/5 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-semibold">
                      New Paid Proposal
                    </span>
                    <h4 className="text-sm font-bold text-white mt-0.5">{offer.campaign_title}</h4>
                  </div>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    ${offer.proposed_rate}
                  </span>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed p-3 rounded-xl bg-slate-950 border border-slate-800">
                  {offer.terms}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Due Date: {offer.deadline}</span>
                  <span className="font-mono text-[10px]">Initiated by: {offer.initiated_by}</span>
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={() => onRespondCollab(offer.id, 'REJECTED')}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center justify-center space-x-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => onRespondCollab(offer.id, 'ACCEPTED')}
                    className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md transition-all flex items-center justify-center space-x-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept & Lock Escrow</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate Card & Benchmark Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rate Card */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3 text-xs">
          <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Rate Card Management</span>
          </h3>
          <p className="text-slate-400 text-[11px]">
            Published rates consumed by autonomous agents during automated offer pricing.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px]">YouTube Long-form Video</span>
              <p className="font-mono font-bold text-white text-base mt-0.5">${currentCreator.rate_video}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px]">Instagram Reel / TikTok</span>
              <p className="font-mono font-bold text-white text-base mt-0.5">${currentCreator.rate_reel}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px]">Static Feed Post</span>
              <p className="font-mono font-bold text-white text-base mt-0.5">${currentCreator.rate_post}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[10px]">Story Frame Sequence</span>
              <p className="font-mono font-bold text-white text-base mt-0.5">${currentCreator.rate_story}</p>
            </div>
          </div>
        </div>

        {/* Niche Rate Benchmarking (Section 7.2) */}
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3 text-xs">
          <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>Niche Rate Benchmarking ({currentCreator.primary_niche})</span>
          </h3>
          <p className="text-slate-400 text-[11px]">
            Platform intelligence comparing your pricing against market peers in your follower tier.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-300">Your Video Rate (${currentCreator.rate_video})</span>
                <span className="text-emerald-400 font-bold">+12% Premium vs Median</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: '68%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-300">Engagement Benchmark ({currentCreator.engagement_rate}%)</span>
                <span className="text-indigo-400 font-bold">Top 8% in Tier</span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '84%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
