import * as React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb { label: React.ReactNode; to?: string }

export function PageHeader({ title, description, actions, crumbs, meta, className, compact }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; crumbs?: Crumb[]; meta?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between', compact && 'mb-4', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1 text-[12.5px] text-muted-foreground">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                {c.to ? <Link to={c.to} className="transition hover:text-foreground">{c.label}</Link> : <span className="text-foreground/80">{c.label}</span>}
              </React.Fragment>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={cn('font-display font-semibold tracking-tight text-foreground', compact ? 'text-xl' : 'text-2xl sm:text-[28px]')}>{title}</h1>
          {meta}
        </div>
        {description && <div className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
