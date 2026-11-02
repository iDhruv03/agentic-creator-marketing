import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110 hover:shadow-glow',
        secondary: 'border border-border bg-surface text-foreground shadow-sm hover:bg-accent hover:border-foreground/20',
        ghost: 'text-foreground/80 hover:bg-accent hover:text-foreground',
        subtle: 'bg-muted text-foreground hover:bg-accent',
        danger: 'bg-danger text-danger-foreground shadow-sm hover:brightness-110',
        success: 'bg-success text-success-foreground shadow-sm hover:brightness-110',
        outline: 'border border-primary/40 text-primary hover:bg-primary-soft',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
        agent: 'bg-gradient-to-r from-agent to-primary text-agent-foreground shadow-sm hover:brightness-110 hover:shadow-glow',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs rounded-lg',
        sm: 'h-8 px-3 text-[13px] rounded-lg',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
    {children}
    {!loading && rightIcon}
  </button>
));
Button.displayName = 'Button';

export { buttonVariants };
