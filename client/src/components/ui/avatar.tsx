import * as React from 'react';
import { cn, initials, hashHue } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  square?: boolean;
  ring?: boolean;
}

const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg', '2xl': 'h-24 w-24 text-2xl' };

export function Avatar({ src, name, size = 'md', square, ring, className, ...props }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const hue = hashHue(name || 'x');
  const showImg = src && !failed;
  return (
    <div
      className={cn('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold text-white', sizes[size], square ? 'rounded-xl' : 'rounded-full', ring && 'ring-2 ring-surface', className)}
      style={showImg ? undefined : { background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))` }}
      {...props}
    >
      {showImg ? <img src={src!} alt={name} className="h-full w-full object-cover" onError={() => setFailed(true)} loading="lazy" /> : initials(name)}
    </div>
  );
}

export function AvatarStack({ items, max = 4, size = 'sm' }: { items: { name: string; src?: string | null }[]; max?: number; size?: AvatarProps['size'] }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((it, i) => <Avatar key={i} name={it.name} src={it.src} size={size} ring />)}
      {rest > 0 && <div className={cn('inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-surface', sizes[size])}>+{rest}</div>}
    </div>
  );
}

export function OrgMark({ name, src, size = 'md', className }: { name: string; src?: string | null; size?: AvatarProps['size']; className?: string }) {
  return <Avatar name={name} src={src} size={size} square className={className} />;
}
