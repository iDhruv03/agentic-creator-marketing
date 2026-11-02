import { useNavigate } from 'react-router-dom';
import { BadgeCheck, MapPin, Star, Clock, Eye, Send, ArrowUpRight } from 'lucide-react';
import type { Creator } from '@/types';
import { money, num, pct, cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Score } from '@/components/ui/feedback';
import { PlatformIcons } from '@/components/ui/status';
import { ShortlistButton } from '@/components/creators/ShortlistButton';

export function VerifiedMark({ className }: { className?: string }) {
  return <BadgeCheck className={cn('h-4 w-4 shrink-0 text-info', className)} aria-label="Verified" />;
}

export function CreatorCard({ c, campaignId, layout = 'grid', onQuickView, onOffer }: { c: Creator; campaignId?: string; layout?: 'grid' | 'list'; onQuickView: (c: Creator) => void; onOffer: (c: Creator) => void }) {
  const navigate = useNavigate();
  const scored = Boolean(campaignId) && c.match_score != null;

  const stats = (
    <div className={cn('grid gap-x-3 gap-y-2 text-xs', layout === 'grid' ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6')}>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Followers</div><div className="font-semibold tabular-nums">{num(c.follower_count, { compact: true })}</div></div>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Engagement</div><div className="font-semibold tabular-nums">{pct(c.engagement_rate)}</div></div>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Avg views</div><div className="font-semibold tabular-nums">{num(c.avg_views, { compact: true })}</div></div>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Video rate</div><div className="font-semibold tabular-nums">{money(c.rate_video)}</div></div>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Rating</div><div className="inline-flex items-center gap-1 font-semibold tabular-nums"><Star className="h-3 w-3 fill-current text-warning" />{c.rating}</div></div>
      <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Responds</div><div className="inline-flex items-center gap-1 font-semibold tabular-nums"><Clock className="h-3 w-3 text-muted-foreground" />{c.response_time_hours}h</div></div>
    </div>
  );

  // Action buttons sit above the stretched quick-view overlay (relative + z-10) so they are siblings of, not nested in, the interactive name.
  const actions = (
    <div className="relative z-10 flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" leftIcon={<ArrowUpRight className="h-3.5 w-3.5" />} onClick={() => navigate(`/creators/${c.id}`)}>View</Button>
      <ShortlistButton creator={c} defaultCampaignId={campaignId} />
      <Button size="sm" variant={scored ? 'primary' : 'secondary'} leftIcon={<Send className="h-3.5 w-3.5" />} onClick={() => onOffer(c)}>Send offer</Button>
    </div>
  );

  // Stretched-link pattern: the name is the only interactive element for quick view; its ::after covers the whole card.
  const header = (
    <div className="flex items-start gap-3">
      <Avatar name={c.name} src={c.avatar_url} size={layout === 'grid' ? 'lg' : 'md'} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onQuickView(c)} className="min-w-0 cursor-pointer truncate rounded text-left text-[15px] font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2">
            {c.name}<span className="sr-only">, open quick view</span>
          </button>
          {c.verified ? <VerifiedMark /> : null}{!c.available && <Badge tone="neutral" size="sm">Unavailable</Badge>}
        </div>
        <div className="truncate text-xs text-muted-foreground">@{c.handle}{c.location ? <span className="inline-flex items-center gap-0.5"> · <MapPin className="h-3 w-3" />{c.location}</span> : null}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PlatformIcons platforms={c.platforms} />
          <Badge tone="primary" size="sm">{c.primary_niche}</Badge>
          {c.secondary_niches.slice(0, layout === 'grid' ? 2 : 3).map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}
        </div>
      </div>
      {scored && <Score value={c.match_score!} size="md" label="Match score for the selected campaign" />}
    </div>
  );

  const reasons = scored && c.match_reasons && c.match_reasons.length > 0 && (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {c.match_reasons.slice(0, 2).map((r, i) => <li key={i} className="flex items-start gap-1.5"><span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-success" /><span className="line-clamp-1">{r}</span></li>)}
    </ul>
  );

  if (layout === 'list') {
    return (
      <div className="card card-hover relative grid gap-4 p-4 lg:grid-cols-[minmax(260px,1.2fr)_1.6fr_auto] lg:items-center">
        <div>{header}{reasons && <div className="mt-2">{reasons}</div>}</div>
        {stats}
        {actions}
      </div>
    );
  }

  return (
    <div className="card card-hover relative flex flex-col p-5">
      {header}
      {c.bio && !scored && <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{c.bio}</p>}
      {reasons && <div className="mt-3">{reasons}</div>}
      <div className="mt-4">{stats}</div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-4">
        {actions}
        <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground sm:inline-flex"><Eye className="h-3 w-3" />{c.completed_campaigns} campaigns</span>
      </div>
    </div>
  );
}

export function CreatorCardSkeleton() {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start gap-3"><div className="skeleton h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-1/2" /><div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-2/3" /></div></div>
      <div className="skeleton h-3 w-full" />
      <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-7" />)}</div>
      <div className="skeleton h-8 w-2/3" />
    </div>
  );
}
