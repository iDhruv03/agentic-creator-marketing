import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X, Trash2, Send, Search, Bookmark, MapPin, Star } from 'lucide-react';
import type { Campaign, ShortlistEntry, Creator } from '@/types';
import { useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money, num, pct, timeAgo, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Score, EmptyState, Progress } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/overlay';
import { SegmentedControl } from '@/components/ui/field';
import { ActorBadge, PlatformIcons } from '@/components/ui/status';
import { OfferDialog } from '@/components/creators/OfferDialog';

const BREAKDOWN: { key: keyof NonNullable<Creator['match_breakdown']>; label: string; weight: number }[] = [
  { key: 'niche', label: 'Niche', weight: 32 }, { key: 'audience', label: 'Audience', weight: 18 }, { key: 'performance', label: 'Performance', weight: 20 }, { key: 'budget_fit', label: 'Budget fit', weight: 18 }, { key: 'reliability', label: 'Reliability', weight: 12 },
];

export function MatchBreakdownBars({ breakdown, compact }: { breakdown: NonNullable<Creator['match_breakdown']>; compact?: boolean }) {
  return (
    <div className={cn('grid gap-x-4 gap-y-1.5', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
      {BREAKDOWN.map((b) => {
        const v = breakdown[b.key];
        return (
          <div key={b.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-[76px] shrink-0 text-muted-foreground">{b.label}</span>
            <Progress value={v} size="xs" tone={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'danger'} className="flex-1" />
            <span className="w-7 shrink-0 text-right font-medium tabular-nums">{Math.round(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_TONE: Record<ShortlistEntry['status'], 'warning' | 'success' | 'danger'> = { SUGGESTED: 'warning', APPROVED: 'success', REJECTED: 'danger' };
const STATUS_LABEL: Record<ShortlistEntry['status'], string> = { SUGGESTED: 'Suggested', APPROVED: 'Approved', REJECTED: 'Rejected' };

function ShortlistCard({ entry, campaign, onOffer }: { entry: ShortlistEntry; campaign: Campaign; onOffer: (c: Creator) => void }) {
  const c = entry.creator;
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const review = useAction(api.campaigns.reviewShortlist, { invalidate: ['campaign', 'campaigns', 'shortlist', 'audit', 'campaign-analytics'], success: (e) => `@${e.creator.handle} ${e.status === 'APPROVED' ? 'approved' : 'rejected'}` });
  const remove = useAction(api.campaigns.removeFromShortlist, { invalidate: ['campaign', 'campaigns', 'shortlist', 'campaign-analytics'], success: 'Removed from shortlist', onSuccess: () => setConfirmRemove(false) });
  const existing = (campaign.collaborations ?? []).find((col) => col.creator_id === c.id && !['DECLINED', 'CANCELLED'].includes(col.status));
  const breakdown = c.match_breakdown;
  const closed = ['COMPLETED', 'ARCHIVED'].includes(campaign.status);

  return (
    <div className={cn('card flex flex-col p-5', entry.status === 'REJECTED' && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <Link to={`/creators/${c.id}`}><Avatar name={c.name} src={c.avatar_url} size="lg" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/creators/${c.id}`} className="truncate text-[15px] font-semibold hover:underline">{c.name}</Link>
            <Badge tone={STATUS_TONE[entry.status]} size="sm" dot>{STATUS_LABEL[entry.status]}</Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">@{c.handle} · {c.primary_niche}{c.location ? <span className="inline-flex items-center gap-0.5"> · <MapPin className="h-3 w-3" />{c.location}</span> : null}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <PlatformIcons platforms={c.platforms} />
            <span className="tabular-nums">{num(c.follower_count, { compact: true })} followers</span>
            <span className="tabular-nums">{pct(c.engagement_rate)} eng.</span>
            <span className="inline-flex items-center gap-0.5 tabular-nums"><Star className="h-3 w-3 fill-current text-warning" />{c.rating}</span>
          </div>
        </div>
        <div className="flex flex-col items-center"><Score value={entry.match_score} size="md" label="Match score" /><span className="mt-0.5 text-[10px] text-muted-foreground">match</span></div>
      </div>

      {breakdown && <div className="mt-4"><MatchBreakdownBars breakdown={breakdown} /></div>}

      {entry.rationale && <p className="mt-3 rounded-lg bg-surface-muted/70 px-3 py-2 text-[13px] leading-relaxed text-foreground/85">{entry.rationale}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">Added by <ActorBadge type={entry.added_by} name={entry.added_by === 'AGENT' ? 'Agent' : entry.added_by === 'HUMAN' ? 'Human' : undefined} size="sm" /></span>
        <span>{timeAgo(entry.created_at)}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {entry.status === 'SUGGESTED' && (
          <>
            <Button size="sm" variant="success" leftIcon={<Check className="h-3.5 w-3.5" />} loading={review.isPending && review.variables?.[2] === 'APPROVED'} onClick={() => review.mutate([campaign.id, entry.id, 'APPROVED'])}>Approve</Button>
            <Button size="sm" variant="secondary" leftIcon={<X className="h-3.5 w-3.5" />} loading={review.isPending && review.variables?.[2] === 'REJECTED'} onClick={() => review.mutate([campaign.id, entry.id, 'REJECTED'])}>Reject</Button>
          </>
        )}
        {entry.status === 'REJECTED' && <Button size="sm" variant="secondary" leftIcon={<Check className="h-3.5 w-3.5" />} loading={review.isPending} onClick={() => review.mutate([campaign.id, entry.id, 'APPROVED'])}>Approve instead</Button>}
        {existing ? (
          <Badge tone="primary">Offer {existing.status.toLowerCase().replace('_', ' ')}</Badge>
        ) : (
          <Button size="sm" variant={entry.status === 'APPROVED' ? 'primary' : 'secondary'} leftIcon={<Send className="h-3.5 w-3.5" />} disabled={closed} onClick={() => onOffer(c)}>Send offer</Button>
        )}
        {existing && <Link to={`/collaborations/${existing.id}`} className="text-xs font-medium text-primary hover:underline">View collaboration</Link>}
        <Button size="icon-sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-danger" onClick={() => setConfirmRemove(true)} title="Remove from shortlist"><Trash2 className="h-4 w-4" /></Button>
      </div>

      <ConfirmDialog open={confirmRemove} onOpenChange={setConfirmRemove} tone="danger" confirmLabel="Remove" loading={remove.isPending} title={`Remove @${c.handle} from the shortlist?`} description="This only removes the shortlist entry. Existing offers and collaborations are untouched." onConfirm={() => remove.mutate([campaign.id, entry.id])} />
    </div>
  );
}

export function CampaignShortlistTab({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState<'ALL' | ShortlistEntry['status']>('ALL');
  const [offerFor, setOfferFor] = React.useState<Creator | null>(null);
  const entries = campaign.shortlist ?? [];
  const rows = entries.filter((e) => filter === 'ALL' || e.status === filter).sort((a, b) => b.match_score - a.match_score);
  const counts = { SUGGESTED: entries.filter((e) => e.status === 'SUGGESTED').length, APPROVED: entries.filter((e) => e.status === 'APPROVED').length, REJECTED: entries.filter((e) => e.status === 'REJECTED').length };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto"><SegmentedControl size="sm" value={filter} onChange={setFilter} options={[{ value: 'ALL', label: `All (${entries.length})` }, { value: 'SUGGESTED', label: `Suggested (${counts.SUGGESTED})` }, { value: 'APPROVED', label: `Approved (${counts.APPROVED})` }, { value: 'REJECTED', label: `Rejected (${counts.REJECTED})` }]} /></div>
        <Button size="sm" leftIcon={<Search className="h-3.5 w-3.5" />} onClick={() => navigate(`/creators?campaign_id=${campaign.id}`)}>Find creators</Button>
      </div>
      {counts.SUGGESTED > 0 && filter === 'ALL' && <p className="text-[13px] text-muted-foreground">{counts.SUGGESTED} suggestion{counts.SUGGESTED === 1 ? '' : 's'} waiting for review. Approving a creator doesn't spend anything — it marks them ready for an offer.</p>}
      {rows.length === 0 ? (
        <EmptyState icon={Bookmark} title={entries.length ? 'Nothing in this view' : 'Shortlist is empty'} description={entries.length ? 'Switch the filter to see other entries.' : 'Score creators against this brief and shortlist the best fits — or run an agent to do it for you.'} action={<Button size="sm" leftIcon={<Search className="h-3.5 w-3.5" />} onClick={() => navigate(`/creators?campaign_id=${campaign.id}`)}>Find creators</Button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{rows.map((e) => <ShortlistCard key={e.id} entry={e} campaign={campaign} onOffer={setOfferFor} />)}</div>
      )}
      {offerFor && <OfferDialog creator={offerFor} defaultCampaignId={campaign.id} open={Boolean(offerFor)} onOpenChange={(o) => { if (!o) setOfferFor(null); }} />}
    </div>
  );
}
