import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Film, CheckCircle2, XCircle } from 'lucide-react';
import type { Campaign, Deliverable, Collaboration } from '@/types';
import { num, pct, fmtDate, deliverableLabel } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Score, EmptyState } from '@/components/ui/feedback';
import { DataTable, type Column } from '@/components/ui/data';
import { DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';

type Row = Deliverable & { collab: Collaboration };

function LinkCell({ row }: { row: Row }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {row.content_url && (
        <a href={row.content_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" title="Open content">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <Link to={`/collaborations/${row.collaboration_id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-xs font-medium text-primary hover:underline">Collaboration</Link>
    </div>
  );
}

export function CampaignContentTab({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const rows: Row[] = (campaign.collaborations ?? []).flatMap((col) => (col.deliverables ?? []).map((d) => ({ ...d, collab: col })));
  const summary = { total: rows.length, submitted: rows.filter((r) => r.status === 'SUBMITTED').length, approved: rows.filter((r) => r.status === 'APPROVED' || r.status === 'PAID').length, flagged: rows.filter((r) => r.compliance && !r.compliance.passed).length };

  const columns: Column<Row>[] = [
    { key: 'type', header: 'Deliverable', render: (r) => <div className="flex items-center gap-2.5"><PlatformIcon platform={r.platform} /><div><div className="font-medium">{deliverableLabel(r.deliverable_type)}</div><div className="text-xs text-muted-foreground">{r.submitted_at ? `Submitted ${fmtDate(r.submitted_at)}` : 'Not submitted'}</div></div></div>, sortValue: (r) => r.deliverable_type },
    { key: 'creator', header: 'Creator', render: (r) => <Link to={`/creators/${r.collab.creator_id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 hover:underline"><Avatar name={r.collab.creator_name ?? 'Creator'} src={r.collab.creator_avatar} size="xs" /><span className="truncate">@{r.collab.creator_handle}</span></Link>, sortValue: (r) => r.collab.creator_handle ?? '' },
    { key: 'status', header: 'Status', render: (r) => <DeliverableStatusBadge status={r.status} size="sm" />, sortValue: (r) => r.status },
    { key: 'compliance', header: 'Compliance', render: (r) => r.compliance ? <div className="flex items-center gap-2"><Score value={r.compliance.score} size="sm" label={`${r.compliance.checks.filter((c) => c.passed).length}/${r.compliance.checks.length} checks passed`} />{r.compliance.passed ? <Badge tone="success" size="sm"><CheckCircle2 className="h-3 w-3" />Pass</Badge> : <Badge tone="danger" size="sm"><XCircle className="h-3 w-3" />Fail</Badge>}</div> : <span className="text-xs text-muted-foreground">—</span>, sortValue: (r) => r.compliance?.score ?? -1 },
    { key: 'views', header: 'Views', align: 'right', render: (r) => <span className="tabular-nums">{r.metrics ? num(r.metrics.views, { compact: true }) : '—'}</span>, sortValue: (r) => r.metrics?.views ?? -1 },
    { key: 'er', header: 'Eng.', align: 'right', render: (r) => <span className="tabular-nums">{r.metrics ? pct(r.metrics.engagement_rate) : '—'}</span>, sortValue: (r) => r.metrics?.engagement_rate ?? -1 },
    { key: 'link', header: '', align: 'right', render: (r) => <LinkCell row={r} /> },
  ];

  if (!rows.length) return <EmptyState icon={Film} title="No deliverables yet" description="Deliverables are created when an offer is accepted. Creators submit content here for compliance checks and your review." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
        <span><span className="font-semibold text-foreground">{summary.total}</span> deliverables</span>
        <span><span className="font-semibold text-warning">{summary.submitted}</span> awaiting review</span>
        <span><span className="font-semibold text-success">{summary.approved}</span> approved</span>
        {summary.flagged > 0 && <span><span className="font-semibold text-danger">{summary.flagged}</span> failed compliance</span>}
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} onRowClick={(r) => navigate(`/collaborations/${r.collaboration_id}`)} />
    </div>
  );
}
