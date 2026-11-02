import { cn } from '@/lib/utils';

export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="cmi-lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#14b8a6" /></linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cmi-lg)" />
      <path d="M9 20.5c0-4.1 3.1-7.5 7-7.5s7 3.4 7 7.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="10" r="2.5" fill="#fff" />
    </svg>
  );
}

export function Logo({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={30} />
      {!collapsed && (
        <div className="leading-none">
          <div className="font-display text-[15px] font-semibold tracking-tight">CMI</div>
          <div className="mt-0.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Creator infra</div>
        </div>
      )}
    </div>
  );
}
