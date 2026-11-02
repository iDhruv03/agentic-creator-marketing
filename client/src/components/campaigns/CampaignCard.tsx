import { Link } from 'react-router-dom';
import { Users, Bookmark, ShieldAlert, CalendarDays } from 'lucide-react';
import type { Campaign } from '@/types';
import { money, pct, fmtDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/feedback';
import { Avatar } from '@/components/ui/avatar';
import { CampaignStatusBadge, PlatformIcons } from '@/components/ui/status';

export function BudgetBar({ c, size = 'sm', showLegend }: { c: Campaign; size?: 'xs' | 'sm' | 'md'; showLegend?: boolean }) {
  const b = c.budget || 1;
  return (
    <div>
      {showLegend && (
        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span><span className="font-medium text-success">{money(c.financials.spent)}</span> paid · <span className="font-medium text-warning">{money(c.financials.escrow_locked)}</span> escrow</span>
          <span>{pct(c.financials.utilisation_pct, 0)} of {money(c.budget, { compact: true })}</span>
        </div>
      )}
      <Progress value={0} size={size} segments={[{ value: (c.financials.spent / b) * 100, tone: 'success' }, { value: (c.financials.escrow_locked / b) * 100, tone: 'warning' }]} />
    </div>
  );
}

export function CampaignCard({ c, className }: { c: Campaign; className?: string }) {
  return (
    <Link to={`/campaigns/${c.id}`} className={cn('card card-hover flex flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.brand_name ?? 'Brand'} src={c.brand_logo} size="md" square />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold leading-tight">{c.title}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.brand_name}{c.agency_name ? ` · via ${c.agency_name}` : ''}</div>
          </div>
        </div>
        <CampaignStatusBadge status={c.status} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PlatformIcons platforms={c.target_platforms} />
        {c.target_niches.slice(0, 3).map((n) => <Badge key={n} tone="outline" size="sm">{n}</Badge>)}
        {c.target_niches.length > 3 && <span className="text-[11px] text-muted-foreground">+{c.target_niches.length - 3}</span>}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold tabular-nums">{money(c.budget)}</span>
          <span className="text-[11px] text-muted-foreground">{money(c.financials.available)} available</span>
        </div>
        <BudgetBar c={c} showLegend />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.stats.collaborations} collab{c.stats.collaborations === 1 ? '' : 's'}</span>
        <span className="inline-flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{c.stats.shortlist} shortlisted</span>
        {c.stats.pending_checkpoints > 0 && <Badge tone="warning" size="sm"><ShieldAlert className="h-3 w-3" />{c.stats.pending_checkpoints} pending approval{c.stats.pending_checkpoints === 1 ? '' : 's'}</Badge>}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {c.start_date || c.end_date ? <span>{fmtDate(c.start_date)} → {fmtDate(c.end_date)}</span> : <span>No dates set · created {fmtDate(c.created_at)}</span>}
      </div>
    </Link>
  );
}
