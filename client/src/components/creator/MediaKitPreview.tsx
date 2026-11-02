import * as React from 'react';
import { BadgeCheck, MapPin, Clock, Star } from 'lucide-react';
import type { Creator } from '@/types';
import { money, num, pct, platformLabel, cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BarList, CHART } from '@/components/ui/charts';
import { PlatformIcon } from '@/components/ui/status';
import { RATE_FIELDS } from './utils';

/** The public media-kit card, exactly as brands see it on /creators/:id. */
export function MediaKitPreview({ creator, className }: { creator: Creator; className?: string }) {
  const c = creator;
  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="h-20 bg-gradient-to-r from-primary/80 via-agent/60 to-info/60" />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <Avatar name={c.name || '?'} src={c.avatar_url} size="xl" ring />
          <div className="mb-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5"><span className="truncate text-[16px] font-semibold">{c.name || 'Your name'}</span>{Boolean(c.verified) && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}</div>
            <div className="truncate text-[13px] text-muted-foreground">@{c.handle}</div>
          </div>
          <Badge tone={c.available ? 'success' : 'neutral'} size="sm" dot>{c.available ? 'Accepting offers' : 'Not available'}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {c.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span>}
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Replies in ~{c.response_time_hours}h</span>
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{c.rating.toFixed(1)} · {c.completed_campaigns} campaigns</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">{c.bio || <span className="italic text-muted-foreground">Add a bio so brands know what you make.</span>}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.primary_niche && <Badge tone="primary">{c.primary_niche}</Badge>}
          {c.secondary_niches.map((n) => <Badge key={n} tone="neutral">{n}</Badge>)}
          {c.content_tags.map((t) => <Badge key={t} tone="outline">#{t}</Badge>)}
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Platforms</div>
          {c.platform_stats.map((p) => (
            <div key={p.platform} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
              <PlatformIcon platform={p.platform} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium">{platformLabel(p.platform)}</div><div className="truncate text-[11px] text-muted-foreground">@{p.handle}</div></div>
              <div className="text-right text-[12px]"><div className="font-semibold tabular-nums">{num(p.followers, { compact: true })}</div><div className="text-[11px] text-muted-foreground">{pct(p.engagement_rate)} ER</div></div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Top countries</div>
            <BarList items={c.audience.countries.slice(0, 4).map((x) => ({ label: x.name, value: x.pct }))} format={(v) => pct(v, 0)} color={CHART.teal} max={100} />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Age</div>
            <BarList items={c.audience.ages.map((x) => ({ label: x.range, value: x.pct }))} format={(v) => pct(v, 0)} color={CHART.primary} max={100} />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rate card</div>
          <div className="grid grid-cols-2 gap-2">
            {RATE_FIELDS.map((r) => (
              <div key={r.key} className="rounded-xl bg-surface-muted/70 px-3 py-2"><div className="text-[11px] text-muted-foreground">{r.label}</div><div className="font-semibold tabular-nums">{money(c[r.field])}</div></div>
            ))}
          </div>
        </div>

        {c.portfolio.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Portfolio</div>
            <div className="space-y-1.5">
              {c.portfolio.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-[13px]"><PlatformIcon platform={p.platform} className="h-4 w-4 text-[9px]" /><span className="min-w-0 flex-1 truncate">{p.title || 'Untitled'}{p.brand && <span className="text-muted-foreground"> · {p.brand}</span>}</span>{p.views != null && p.views > 0 && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{num(p.views, { compact: true })} views</span>}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
