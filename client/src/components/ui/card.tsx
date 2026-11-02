import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; padded?: boolean }>(({ className, hover, padded = true, ...props }, ref) => (
  <div ref={ref} className={cn('card', hover && 'card-hover', padded && 'p-5', className)} {...props} />
));
Card.displayName = 'Card';

export function CardHeader({ className, title, description, action, icon, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">{icon}</div>}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Section({ title, description, action, children, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
