import type { LedgerEntry } from '@/types';
import { titleCase, cn } from '@/lib/utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/overlay';

type Tone = NonNullable<BadgeProps['tone']>;

export const ENTRY_TYPE: Record<LedgerEntry['entry_type'], { label: string; tone: Tone }> = {
  BUDGET_ALLOCATION: { label: 'Budget allocation', tone: 'primary' },
  BUDGET_ADJUSTMENT: { label: 'Budget adjustment', tone: 'neutral' },
  ESCROW_HOLD: { label: 'Escrow hold', tone: 'warning' },
  ESCROW_RELEASE: { label: 'Escrow release', tone: 'info' },
  ESCROW_REFUND: { label: 'Escrow refund', tone: 'info' },
  PAYOUT_RELEASE: { label: 'Payout', tone: 'success' },
};

export const ENTRY_TYPE_OPTIONS = (Object.keys(ENTRY_TYPE) as LedgerEntry['entry_type'][]).map((k) => ({ value: k, label: ENTRY_TYPE[k].label }));

export function EntryTypeBadge({ type, size = 'sm' }: { type: LedgerEntry['entry_type'] | string; size?: BadgeProps['size'] }) {
  const s = ENTRY_TYPE[type as LedgerEntry['entry_type']] ?? { label: titleCase(type), tone: 'neutral' as Tone };
  return <Badge tone={s.tone} size={size}>{s.label}</Badge>;
}

export interface AccountNames { campaigns?: Record<string, string>; creators?: Record<string, string>; brands?: Record<string, string> }

/** Parse "campaign:<id>:escrow" style account names into a readable label. */
export function parseAccount(account: string): { kind: string; id: string; sub: string } {
  const [kind = '', id = '', sub = ''] = account.split(':');
  return { kind, id, sub };
}

export function prettyAccount(account: string, names: AccountNames = {}): { label: string; owner: string | null } {
  const { kind, id, sub } = parseAccount(account);
  if (kind === 'campaign') return { label: sub === 'escrow' ? 'Campaign escrow' : sub === 'available' ? 'Campaign available' : `Campaign ${titleCase(sub)}`, owner: names.campaigns?.[id] ?? id };
  if (kind === 'brand') return { label: 'Brand budget', owner: names.brands?.[id] ?? id };
  if (kind === 'creator') return { label: 'Creator wallet', owner: names.creators?.[id] ? `@${names.creators[id]}` : id };
  return { label: account, owner: null };
}

export function AccountLabel({ account, names, className }: { account: string; names?: AccountNames; className?: string }) {
  const p = prettyAccount(account, names);
  return (
    <Tooltip content={<span className="font-mono">{account}</span>}>
      <span className={cn('inline-flex max-w-full cursor-default items-baseline gap-1 whitespace-nowrap font-mono text-[12px]', className)}>
        <span className="text-foreground/85">{p.label}</span>
        {p.owner && <span className="max-w-[150px] truncate text-muted-foreground">· {p.owner}</span>}
      </span>
    </Tooltip>
  );
}

export const ACCOUNT_TONE = (account: string): string => {
  const { kind, sub } = parseAccount(account);
  if (kind === 'creator') return 'text-success';
  if (kind === 'campaign' && sub === 'escrow') return 'text-warning';
  if (kind === 'brand') return 'text-primary';
  return 'text-foreground/80';
};
