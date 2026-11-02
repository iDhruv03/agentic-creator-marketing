import * as React from 'react';
import { Upload, ExternalLink, AlertTriangle, Eye, Heart, MousePointerClick, ShieldCheck, Link2 } from 'lucide-react';
import type { Collaboration, ComplianceReport, Deliverable } from '@/types';
import { api } from '@/lib/api';
import { useAction } from '@/hooks/queries';
import { money, deliverableLabel, fmtDate, num, pct, cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/overlay';
import { Label, Input, Textarea, Hint } from '@/components/ui/field';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { DeliverableStatusBadge, PlatformIcon } from '@/components/ui/status';
import { ComplianceChecks } from './ComplianceChecks';

const SUBMITTABLE: Collaboration['status'][] = ['ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function SubmitContentDialog({ collab, deliverable, open, onOpenChange, mustInclude }: { collab: Collaboration; deliverable: Deliverable; open: boolean; onOpenChange: (o: boolean) => void; mustInclude: string[] }) {
  const [url, setUrl] = React.useState(deliverable.content_url ?? '');
  const [caption, setCaption] = React.useState(deliverable.caption ?? '');
  const [preview, setPreview] = React.useState<ComplianceReport | null>(null);
  const [checking, setChecking] = React.useState(false);
  const dUrl = useDebounced(url, 400);
  const dCaption = useDebounced(caption, 400);

  React.useEffect(() => { if (open) { setUrl(deliverable.content_url ?? ''); setCaption(deliverable.caption ?? ''); setPreview(null); } }, [open, deliverable.id, deliverable.content_url, deliverable.caption]);

  React.useEffect(() => {
    if (!open || (!dUrl.trim() && !dCaption.trim())) { setPreview(null); return; }
    let cancelled = false;
    setChecking(true);
    api.collaborations.compliancePreview(collab.id, { caption: dCaption, content_url: dUrl, deliverable_type: deliverable.deliverable_type })
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [open, dUrl, dCaption, collab.id, deliverable.deliverable_type]);

  const submit = useAction(() => api.collaborations.submitDeliverable(collab.id, deliverable.id, { content_url: url.trim(), caption }), {
    invalidate: ['collaboration', 'collaborations', 'wallet', 'creator', 'notifications'], success: 'Content submitted for review', onSuccess: () => onOpenChange(false),
  });
  const validUrl = /^https?:\/\/\S+$/i.test(url.trim());
  const resubmit = deliverable.status === 'CHANGES_REQUESTED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={`${resubmit ? 'Resubmit' : 'Submit'} ${deliverableLabel(deliverable.deliverable_type)}`} description={`For "${collab.campaign_title}". The brand reviews it after an automated compliance check.`}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={submit.isPending} disabled={!validUrl} leftIcon={<Upload className="h-4 w-4" />} onClick={() => submit.mutate([])}>{resubmit ? 'Resubmit for review' : 'Submit for review'}</Button></>}>
      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {resubmit && deliverable.review_notes && <Callout tone="danger" icon={AlertTriangle} title="Changes requested">{deliverable.review_notes}</Callout>}
          <div>
            <Label htmlFor="content-url" required>Live content URL</Label>
            <Input id="content-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://${deliverable.platform === 'youtube' ? 'youtube.com/watch?v=…' : deliverable.platform === 'tiktok' ? 'tiktok.com/@you/video/…' : 'instagram.com/reel/…'}`} leftIcon={<Link2 className="h-4 w-4" />} error={url.length > 0 && !validUrl} inputMode="url" />
            <Hint>Must be a public {deliverable.platform} link. The brand verifies it is live before approving.</Hint>
          </div>
          <div>
            <Label htmlFor="content-caption" hint={`${caption.length} chars`}>Caption</Label>
            <Textarea id="content-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} placeholder="Paste the caption exactly as published, including disclosure and tags." />
            {mustInclude.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Must include:</span>
                {mustInclude.map((t) => { const ok = caption.toLowerCase().includes(t.toLowerCase()); return <span key={t} className={cn('rounded-md border px-1.5 py-0.5 font-mono text-[11px]', ok ? 'border-success/30 bg-success-soft text-success' : 'border-border bg-surface-muted text-foreground/80')}>{t}</span>; })}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Live compliance preview</div>
          {preview ? (
            <>
              <ComplianceChecks report={preview} compact />
              {!preview.passed && <Callout tone="warning" icon={AlertTriangle} className="mt-2">You can still submit, but the brand will see these flags and is likely to request changes.</Callout>}
            </>
          ) : checking ? (
            <div className="space-y-2 rounded-xl border border-border p-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Start typing a URL or caption — checks run as you go.</div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="font-semibold tabular-nums text-foreground">{value}</span>{label}</div>;
}

function DeliverableRow({ collab, d, mustInclude }: { collab: Collaboration; d: Deliverable; mustInclude: string[] }) {
  const [open, setOpen] = React.useState(false);
  const canSubmit = SUBMITTABLE.includes(collab.status) && (d.status === 'PENDING' || d.status === 'CHANGES_REQUESTED');
  const needsStart = collab.status === 'ACCEPTED' && d.status === 'PENDING';
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformIcon platform={d.platform} />
        <span className="text-[14px] font-medium">{deliverableLabel(d.deliverable_type)}</span>
        <DeliverableStatusBadge status={d.status} size="sm" />
        <div className="ml-auto flex items-center gap-2">
          {d.content_url && <a href={d.content_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" />Open</a>}
          {canSubmit && <Button size="sm" variant={d.status === 'CHANGES_REQUESTED' ? 'primary' : 'secondary'} leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => setOpen(true)} disabled={needsStart} title={needsStart ? 'Start production first' : undefined}>{d.status === 'CHANGES_REQUESTED' ? 'Resubmit' : 'Submit content'}</Button>}
        </div>
      </div>

      {d.status === 'PENDING' && <p className="mt-1.5 text-xs text-muted-foreground">{needsStart ? 'Start production to unlock submission.' : 'Publish it, then paste the live link and caption here.'}</p>}

      {d.status === 'CHANGES_REQUESTED' && d.review_notes && <Callout tone="danger" icon={AlertTriangle} title="Changes requested" className="mt-3">{d.review_notes}</Callout>}

      {d.status === 'SUBMITTED' && <p className="mt-1.5 text-xs text-muted-foreground">In review since {fmtDate(d.submitted_at)} · the brand verifies the live post and compliance report.</p>}
      {d.status === 'APPROVED' && <p className="mt-1.5 text-xs text-success">Approved {fmtDate(d.approved_at)} · payment pending release from escrow.</p>}
      {d.status === 'PAID' && <p className="mt-1.5 text-xs text-primary">Paid {fmtDate(d.paid_at)}{collab.agreed_rate ? ` · ${money(Math.round(collab.agreed_rate / Math.max(1, collab.deliverables.length)))} share of the agreed rate` : ''}</p>}

      {(d.status === 'SUBMITTED' || d.status === 'CHANGES_REQUESTED' || d.status === 'APPROVED' || d.status === 'PAID') && (d.compliance || d.metrics) && (
        <div className="mt-3 space-y-2">
          {d.compliance && <ComplianceChecks report={d.compliance} compact />}
          {d.metrics && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border px-3 py-2.5">
              <Metric icon={Eye} label="views" value={num(d.metrics.views, { compact: true })} />
              <Metric icon={Heart} label={`ER ${pct(d.metrics.engagement_rate)}`} value={num(d.metrics.likes, { compact: true })} />
              <Metric icon={MousePointerClick} label="clicks" value={num(d.metrics.clicks, { compact: true })} />
            </div>
          )}
        </div>
      )}

      {canSubmit && <SubmitContentDialog collab={collab} deliverable={d} open={open} onOpenChange={setOpen} mustInclude={mustInclude} />}
    </div>
  );
}

export function DeliverablesCard({ collab, mustInclude }: { collab: Collaboration; mustInclude: string[] }) {
  const done = collab.deliverables.filter((d) => d.status === 'APPROVED' || d.status === 'PAID').length;
  return (
    <Card>
      <CardHeader title="Deliverables" description={`${done} of ${collab.deliverables.length} approved`} />
      <div className="divide-y divide-border/70">
        {collab.deliverables.map((d) => <DeliverableRow key={d.id} collab={collab} d={d} mustInclude={mustInclude} />)}
      </div>
    </Card>
  );
}
