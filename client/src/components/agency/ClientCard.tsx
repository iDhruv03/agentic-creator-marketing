import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { money, num } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrgMark } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/feedback';
import type { AgencyClient } from '@/types';

export function ClientCard({ client: c }: { client: AgencyClient }) {
  const navigate = useNavigate();
  const available = Math.max(0, c.budget - c.spent - c.escrow);
  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <OrgMark name={c.name} src={c.logo_url} size="md" />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight">{c.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{c.industry}</div>
          </div>
        </div>
        {c.pending_checkpoints > 0 ? (
          <Link to={`/approvals?brand_id=${c.id}`}><Badge tone="warning"><ShieldAlert className="h-3 w-3" />{c.pending_checkpoints} pending</Badge></Link>
        ) : <Badge tone="neutral" size="sm">{num(c.active_campaigns ?? 0)} active</Badge>}
      </div>

      <div className="mt-4 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{num(c.active_campaigns ?? 0)} active of {num(c.campaigns_count ?? 0)} campaign{(c.campaigns_count ?? 0) === 1 ? '' : 's'}</span>
        <span className="font-medium tabular-nums">{money(c.budget)} <span className="text-muted-foreground">budget</span></span>
      </div>
      <Progress className="mt-2" max={Math.max(1, c.budget)} value={0} segments={[{ value: c.spent, tone: 'success' }, { value: c.escrow, tone: 'warning' }]} />
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success" />Paid {money(c.spent)}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-warning" />Escrow {money(c.escrow)}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted-foreground/40" />Available {money(available)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="truncate text-[11px] text-muted-foreground">{c.website ?? ''}</span>
        <Button size="xs" variant="secondary" rightIcon={<ArrowRight className="h-3 w-3" />} onClick={() => navigate(`/campaigns?brand_id=${c.id}`)}>View campaigns</Button>
      </div>
    </Card>
  );
}
