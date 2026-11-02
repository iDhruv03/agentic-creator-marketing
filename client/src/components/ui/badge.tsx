import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 tracking-wide whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border-border bg-surface-muted text-muted-foreground',
      primary: 'border-primary/20 bg-primary-soft text-primary',
      success: 'border-success/20 bg-success-soft text-success',
      warning: 'border-warning/25 bg-warning-soft text-warning',
      danger: 'border-danger/20 bg-danger-soft text-danger',
      info: 'border-info/20 bg-info-soft text-info',
      agent: 'border-agent/20 bg-agent-soft text-agent',
      outline: 'border-border bg-transparent text-foreground/80',
    },
    size: { sm: 'px-1.5 py-0 text-[10px]', md: '', lg: 'px-2.5 py-1 text-xs' },
  },
  defaultVariants: { tone: 'neutral', size: 'md' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> { dot?: boolean }

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export { badgeVariants };
