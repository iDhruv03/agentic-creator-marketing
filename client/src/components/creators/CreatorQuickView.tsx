import { useNavigate } from 'react-router-dom';
import { MapPin, Star, Clock, Send, ArrowUpRight, ExternalLink } from 'lucide-react';
import type { Creator } from '@/types';
import { money, num, pct, platformLabel, deliverableLabel } from '@/lib/utils';
import { Sheet } from '@/components/ui/overlay';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Score } from '@/components/ui/feedback';
import { KeyValue } from '@/components/ui/data';
import { BarList, CHART } from '@/components/ui/charts';
import { PlatformIcon } from '@/components/ui/status';
import { ShortlistButton } from '@/components/creators/ShortlistButton';
import { VerifiedMark } from '@/components/creators/CreatorCard';
import { MatchBreakdownBars } from '@/components/campaigns/CampaignShortlistTab';

export function CreatorQuickView({ creator, campaignId, open, onOpenChange, onOffer }: { creator: Creator | null; campaignId?: string; open: boolean; onOpenChange: (o: boolean) => void; onOffer: (c: Creator) => void }) {
  const navigate = useNavigate();
  const c = creator;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} width="md" title={c ? c.name : 'Creator'} description={c ? `@${c.handle} · ${c.primary_niche}` : undefined}
      footer={c ? <><ShortlistButton creator={c} defaultCampaignId={campaignId} size="md" /><Button variant="secondary" leftIcon={<ArrowUpRight className="h-4 w-4" />} onClick={() => { onOpenChange(false); navigate(`/creators/${c.id}`); }}>Full profile</Button><Button leftIcon={<Send className="h-4 w-4" />} onClick={() => { onOpenChange(false); onOffer(c); }}>Send offer</Button></> : undefined}
    >
      {c && (
        <div className="space-y-6 px-6 py-5">
          <div className="flex items-start gap-4">
            <Avatar name={c.name} src={c.avatar_url} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-base font-semibold">{c.name}{c.verified ? <VerifiedMark /> : null}</div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-current text-warning" />{c.rating} · {c.completed_campaigns} campaigns</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />responds in ~{c.response_time_hours}h</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone="primary" size="sm">{c.primary_niche}</Badge>{c.secondary_niches.map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}<Badge tone={c.available ? 'success' : 'neutral'} size="sm" dot>{c.available ? 'Available' : 'Unavailable'}</Badge></div>
            </div>
            {campaignId && c.match_score != null && <Score value={c.match_score} size="lg" label="Match score" />}
          </div>

          {c.bio && <p className="text-[13.5px] leading-relaxed text-foreground/85">{c.bio}</p>}

          {campaignId && c.match_breakdown && (
            <div className="rounded-xl border border-border p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fit for the selected campaign</div>
              <MatchBreakdownBars breakdown={c.match_breakdown} compact />
              {c.match_reasons && c.match_reasons.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{c.match_reasons.map((r, i) => <li key={i} className="flex items-start gap-1.5"><span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{r}</li>)}</ul>}
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platforms</div>
            <div className="space-y-2">
              {c.platform_stats.map((p) => (
                <div key={p.platform} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <PlatformIcon platform={p.platform} className="h-7 w-7 text-sm" />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{platformLabel(p.platform)}</div><div className="truncate text-xs text-muted-foreground">@{p.handle}</div></div>
                  <div className="grid grid-cols-3 gap-3 text-right text-xs tabular-nums">
                    <div><div className="text-[10px] uppercase text-muted-foreground">Followers</div><div className="font-semibold">{num(p.followers, { compact: true })}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Eng.</div><div className="font-semibold">{pct(p.engagement_rate)}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Views</div><div className="font-semibold">{num(p.avg_views, { compact: true })}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rate card</div>
            <KeyValue columns={2} items={[{ label: deliverableLabel('POST'), value: money(c.rate_post) }, { label: deliverableLabel('REEL'), value: money(c.rate_reel) }, { label: deliverableLabel('YOUTUBE_VIDEO'), value: money(c.rate_video) }, { label: deliverableLabel('STORY'), value: money(c.rate_story) }]} />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top audience markets</div>
            <BarList items={c.audience.countries.slice(0, 4).map((x) => ({ label: x.name, value: x.pct }))} format={(v) => `${v}%`} color={CHART.blue} max={100} />
          </div>

          {c.portfolio.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent work</div>
              <div className="space-y-1.5">
                {c.portfolio.slice(0, 3).map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-accent/50">
                    <PlatformIcon platform={p.platform} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.title}{p.brand && <span className="text-muted-foreground"> · {p.brand}</span>}</span>
                    {p.views != null && <span className="text-xs tabular-nums text-muted-foreground">{num(p.views, { compact: true })} views</span>}
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
