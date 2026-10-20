import React, { useState } from 'react';
import {
  Handshake,
  CheckCircle2,
  Clock,
  ExternalLink,
  DollarSign,
  UploadCloud,
  FileCheck,
  Send,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Collaboration, Deliverable } from '../types';

interface CollaborationsTabProps {
  collaborations: Collaboration[];
  onSubmitDeliverable: (deliverableId: string, data: { content_url: string; caption?: string }) => Promise<void>;
  onReleasePayment: (collaborationId: string, deliverableId: string, amount: number) => Promise<void>;
  onSelectTab: (tab: string) => void;
}

export const CollaborationsTab: React.FC<CollaborationsTabProps> = ({
  collaborations,
  onSubmitDeliverable,
  onReleasePayment,
  onSelectTab,
}) => {
  const [selectedCollab, setSelectedCollab] = useState<Collaboration | null>(collaborations[0] || null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string>('');
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitCaption, setSubmitCaption] = useState('');

  const handleOpenSubmit = (delivId: string) => {
    setSelectedDeliverableId(delivId);
    setSubmitUrl('https://youtube.com/watch?v=sample_review_' + Math.floor(Math.random() * 1000));
    setSubmitCaption('Check out our sponsored deep-dive! Promo code included. #ad');
    setIsSubmitModalOpen(true);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliverableId || !submitUrl) return;
    await onSubmitDeliverable(selectedDeliverableId, {
      content_url: submitUrl,
      caption: submitCaption,
    });
    setIsSubmitModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'DELIVERABLE_SUBMITTED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'IN_PROGRESS':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'OFFERED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Handshake className="w-5 h-5 text-emerald-400" />
            <span>Collaborations & Deliverable Tracking</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational pipeline tracking deliverables against brief specifications with automated escrow reconciliation.
          </p>
        </div>
      </div>

      {/* Main Grid: List on Left, Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collaborations List */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            Active Collaborations ({collaborations.length})
          </div>

          {collaborations.map((collab) => {
            const isSelected = selectedCollab?.id === collab.id;
            return (
              <div
                key={collab.id}
                onClick={() => setSelectedCollab(collab)}
                className={`p-4 rounded-2xl glass-panel cursor-pointer transition-all border ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={collab.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={collab.creator_name}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{collab.creator_name}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">@{collab.creator_handle}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(collab.status)}`}>
                    {collab.status}
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-300 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                    {collab.campaign_title}
                  </span>
                  <span className="font-mono font-bold text-white">${collab.agreed_rate || collab.proposed_rate}</span>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Initiated by: {collab.initiated_by}</span>
                  <span>Due: {collab.deadline}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Collab Detail Inspector */}
        <div className="lg:col-span-2">
          {selectedCollab ? (
            <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={selectedCollab.avatar_url}
                    alt={selectedCollab.creator_name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-white">{selectedCollab.creator_name}</h3>
                    <p className="text-xs text-slate-400 font-mono">
                      @{selectedCollab.creator_handle} • Campaign: {selectedCollab.campaign_title}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Escrow Value</span>
                  <div className="text-lg font-extrabold text-emerald-400 font-mono">
                    ${selectedCollab.agreed_rate || selectedCollab.proposed_rate}
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-slate-400">Collaboration Agreement Terms</span>
                <p className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                  {selectedCollab.terms}
                </p>
              </div>

              {/* Deliverables List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>Required Deliverables & Submission Status</span>
                </h4>

                <div className="space-y-2.5">
                  {selectedCollab.deliverables?.map((deliv) => {
                    const metrics = deliv.metrics_json ? JSON.parse(deliv.metrics_json) : null;
                    return (
                      <div
                        key={deliv.id}
                        className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white uppercase tracking-wider">
                              {deliv.deliverable_type}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="font-mono text-slate-400">{deliv.id}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(deliv.status)}`}>
                            {deliv.status}
                          </span>
                        </div>

                        {/* Content URL & Caption if submitted */}
                        {deliv.content_url ? (
                          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <a
                                href={deliv.content_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:underline flex items-center space-x-1 font-mono text-[11px]"
                              >
                                <span>{deliv.content_url}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <span className="text-[10px] text-slate-500">Live URL Verified</span>
                            </div>
                            {deliv.caption && <p className="text-slate-300 text-[11px] italic">"{deliv.caption}"</p>}

                            {/* Performance metrics */}
                            {metrics && (
                              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-center">
                                <div>
                                  <span className="text-[10px] text-slate-500">Views</span>
                                  <p className="font-mono font-bold text-white">{metrics.views?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500">Likes</span>
                                  <p className="font-mono font-bold text-emerald-400">{metrics.likes?.toLocaleString()}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500">Comments</span>
                                  <p className="font-mono font-bold text-indigo-400">{metrics.comments}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-500">Engagement</span>
                                  <p className="font-mono font-bold text-amber-400">{metrics.engagement}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 text-[11px] flex items-center justify-between">
                            <span>Pending content submission by creator.</span>
                            <button
                              onClick={() => handleOpenSubmit(deliv.id)}
                              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1"
                            >
                              <UploadCloud className="w-3 h-3" />
                              <span>Submit Proof</span>
                            </button>
                          </div>
                        )}

                        {/* Deliverable Action Buttons */}
                        {deliv.status === 'SUBMITTED' && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-500">
                              Verify metrics and approve deliverable
                            </span>
                            <button
                              onClick={() =>
                                onReleasePayment(
                                  selectedCollab.id,
                                  deliv.id,
                                  selectedCollab.agreed_rate || selectedCollab.proposed_rate
                                )
                              }
                              className="px-4 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Release Payment (${selectedCollab.agreed_rate || selectedCollab.proposed_rate})</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 glass-panel rounded-2xl border border-slate-800">
              Select a collaboration to inspect deliverables
            </div>
          )}
        </div>
      </div>

      {/* Submit Deliverable Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-slate-700 bg-slate-900 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                <span>Submit Deliverable Proof</span>
              </h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-white font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Live Social Content URL</label>
                <input
                  type="url"
                  required
                  value={submitUrl}
                  onChange={(e) => setSubmitUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Published Caption & Hashtags</label>
                <textarea
                  rows={2}
                  value={submitCaption}
                  onChange={(e) => setSubmitCaption(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                ⚡ The CMI verification engine will scrape live metrics and verify disclosures.
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
