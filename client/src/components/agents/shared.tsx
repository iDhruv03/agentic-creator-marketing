import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { RoleScope } from '@/types';

type Tone = NonNullable<BadgeProps['tone']>;

export const SCOPE_META: Record<RoleScope, { label: string; short: string; tone: Tone; description: string }> = {
  DISCOVERY_ONLY: { label: 'Discovery only', short: 'Discovery', tone: 'neutral', description: 'Search & shortlist creators. Cannot spend.' },
  CAMPAIGN_MANAGER: { label: 'Campaign manager', short: 'Manager', tone: 'info', description: 'Draft briefs, send offers within ceilings, track & review content.' },
  FULL_OPERATOR: { label: 'Full operator', short: 'Operator', tone: 'agent', description: 'Everything, including payment release up to the autonomous threshold.' },
};

export const SCOPE_ORDER: RoleScope[] = ['DISCOVERY_ONLY', 'CAMPAIGN_MANAGER', 'FULL_OPERATOR'];

export function ScopeBadge({ scope, size }: { scope: RoleScope; size?: BadgeProps['size'] }) {
  const m = SCOPE_META[scope];
  return <Badge tone={m.tone} size={size}>{m.label}</Badge>;
}

export const RISK_META: Record<string, { label: string; tone: Tone }> = {
  read: { label: 'Read', tone: 'neutral' },
  write: { label: 'Write', tone: 'info' },
  financial: { label: 'Financial', tone: 'warning' },
  high_impact: { label: 'High impact', tone: 'danger' },
};

export function RiskToneBadge({ risk, size }: { risk: string; size?: BadgeProps['size'] }) {
  const m = RISK_META[risk] ?? { label: risk, tone: 'neutral' as Tone };
  return <Badge tone={m.tone} size={size}>{m.label}</Badge>;
}

export const TOOL_CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: 'discovery', label: 'Discovery', description: 'Find and inspect creators' },
  { key: 'campaign', label: 'Campaign', description: 'Briefs, status and shortlists' },
  { key: 'contracts', label: 'Contracts', description: 'Offers and negotiation — commits spend' },
  { key: 'delivery', label: 'Delivery', description: 'Content tracking, compliance and review' },
  { key: 'payments', label: 'Payments', description: 'Escrow release to creators' },
  { key: 'governance', label: 'Governance', description: 'Audit trail and human escalation' },
  { key: 'insight', label: 'Insight', description: 'Benchmarks and analytics' },
];

export const SUGGESTED_GOALS = [
  'Run this campaign end to end: discover, shortlist, brief, offers',
  'Shortlist the 5 best-fit creators with rationale, no offers',
  'Send offers to approved shortlist within the rate band',
  'Track submitted deliverables, review compliance and release payments',
];

/** Human explanations for the governance rules the executor evaluates. */
export const RULE_META: Record<string, { label: string; description: string }> = {
  session_status: { label: 'Session status', description: 'Only ACTIVE sessions may call tools; paused or revoked sessions are suspended.' },
  permission_scope: { label: 'Permission scope', description: 'The tool must be in the allowed list granted by the session scope.' },
  campaign_binding: { label: 'Campaign binding', description: 'A session bound to a campaign cannot act on a different campaign.' },
  budget_ceiling: { label: 'Budget ceiling', description: 'Committed spend plus this offer must stay under the hard session ceiling — otherwise blocked.' },
  rate_ceiling: { label: 'Rate ceiling', description: 'Per-collaboration cap; offers above it are held for human approval.' },
  payment_threshold: { label: 'Payment threshold', description: 'Payouts above the autonomous threshold are held for human approval.' },
  post_acceptance_brief_lock: { label: 'Brief lock', description: 'Brief changes after a creator accepted are held for human approval.' },
};

export const modeLabel = (mode: string | null | undefined) => (mode === 'LLM' ? 'Claude' : mode === 'SIMULATED' ? 'Simulated' : mode ?? '—');
