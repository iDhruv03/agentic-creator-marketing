import * as React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { ComplianceReport } from '@/types';
import { cn, fmtDateTime } from '@/lib/utils';
import { Score } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';

export function ComplianceChecks({ report, compact, className }: { report: ComplianceReport; compact?: boolean; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface-muted/50 p-3', className)}>
      <div className="flex items-center gap-3">
        <Score value={report.score} size={compact ? 'sm' : 'md'} label="Compliance score" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">Compliance {report.passed ? <Badge tone="success" size="sm">Passed</Badge> : <Badge tone="danger" size="sm">Issues flagged</Badge>}</div>
          <div className="text-[11px] text-muted-foreground">{report.checks.filter((c) => c.passed).length}/{report.checks.length} checks · {fmtDateTime(report.checked_at)}</div>
        </div>
      </div>
      <ul className={cn('mt-3 space-y-1.5', compact && 'mt-2 space-y-1')}>
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-[12.5px]">
            {c.passed ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />}
            <span className="min-w-0"><span className={cn('font-medium', !c.passed && 'text-danger')}>{c.label}</span>{!compact && <span className="block text-muted-foreground">{c.detail}</span>}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
