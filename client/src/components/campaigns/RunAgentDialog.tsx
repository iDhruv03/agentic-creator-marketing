import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Bot, Plus } from 'lucide-react';
import type { Campaign, AgentSession } from '@/types';
import { useSessions, useScopes, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { money, cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/overlay';
import { SCOPE_META } from '@/components/agents/shared';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea, FieldError, Hint } from '@/components/ui/field';
import { Callout, EmptyState } from '@/components/ui/feedback';
import { SessionStatusBadge } from '@/components/ui/status';

type Mode = 'AUTO' | 'SIMULATED' | 'LLM';

function suggestedGoals(c: Campaign): string[] {
  const niche = c.target_niches[0] ?? 'the target niche';
  const band = c.rate_band_max != null ? ` under ${money(c.rate_band_max)} per collaboration` : '';
  return [
    `Find the 5 best-fit ${niche} creators for "${c.title}", shortlist them with rationale, and send offers to the top 2${band}.`,
    `Review the current shortlist for "${c.title}", approve creators that match the brief, and negotiate rates inside the band.`,
    `Audit "${c.title}": summarise budget utilisation, open offers and overdue deliverables, then recommend next actions without spending.`,
  ];
}

export function RunAgentDialog({ campaign, open, onOpenChange }: { campaign: Campaign; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const forCampaign = useSessions({ campaign_id: campaign.id });
  const forBrand = useSessions({ brand_id: campaign.brand_id });
  const scopes = useScopes();
  const llmAvailable = scopes.data?.runtime.llm_available ?? false;
  const defaultMode = scopes.data?.runtime.default_mode;

  const sessions = React.useMemo(() => {
    const seen = new Set<string>();
    const out: (AgentSession & { bound: boolean })[] = [];
    for (const s of forCampaign.data ?? []) { if (!seen.has(s.id)) { seen.add(s.id); out.push({ ...s, bound: true }); } }
    for (const s of forBrand.data ?? []) { if (!seen.has(s.id) && (s.campaign_id == null || s.campaign_id === campaign.id)) { seen.add(s.id); out.push({ ...s, bound: s.campaign_id === campaign.id }); } }
    return out;
  }, [forCampaign.data, forBrand.data, campaign.id]);
  const usable = React.useMemo(() => sessions.filter((s) => s.status === 'ACTIVE'), [sessions]);

  const [sessionId, setSessionId] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [mode, setMode] = React.useState<Mode>('AUTO');
  const [errors, setErrors] = React.useState<{ session?: string; goal?: string }>({});
  const goals = React.useMemo(() => suggestedGoals(campaign), [campaign]);

  React.useEffect(() => {
    if (!open) return;
    setSessionId((cur) => cur || usable.find((s) => s.bound)?.id || usable[0]?.id || '');
    setGoal((g) => g || goals[0]!);
    setMode('AUTO');
    setErrors((e) => (Object.keys(e).length ? {} : e));
  }, [open, usable, goals]);

  const session = sessions.find((s) => s.id === sessionId);
  const loading = forCampaign.isLoading || forBrand.isLoading;

  const start = useAction(api.agents.startRun, {
    invalidate: ['runs', 'sessions', 'campaign', 'overview', 'audit'],
    success: 'Agent run started',
    onSuccess: (run) => { onOpenChange(false); navigate(`/agents/runs/${run.id}`); },
  });

  const submit = () => {
    const e: typeof errors = {};
    if (!sessionId) e.session = 'Choose an active session to run under.';
    if (goal.trim().length < 10) e.goal = 'Describe the goal in at least 10 characters.';
    setErrors(e);
    if (Object.keys(e).length) return;
    start.mutate([{ session_id: sessionId, campaign_id: campaign.id, goal: goal.trim(), mode }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="lg" title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-agent" />Run an agent on {campaign.title}</span>} description="The agent works inside the session's scope, budget ceiling and rate ceiling. Anything beyond them becomes a checkpoint for you."
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="agent" leftIcon={<Bot className="h-4 w-4" />} loading={start.isPending} disabled={!loading && usable.length === 0} onClick={submit}>Start run</Button>
      </>}
    >
      <div className="space-y-5">
        {!loading && usable.length === 0 ? (
          <EmptyState compact icon={Bot} title="No active agent session for this brand" description="Authorise an agent with a scope, a budget ceiling and a rate ceiling first — then you can run it on this campaign." action={<Button variant="agent" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { onOpenChange(false); navigate(`/agents?new=1&campaign_id=${campaign.id}`); }}>Authorise an agent</Button>} />
        ) : (
          <div>
            <Label required hint={<Link to="/agents?new=1" className="text-primary hover:underline">New session</Link>}>Agent session</Label>
            <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setErrors((e) => ({ ...e, session: undefined })); }} placeholder={loading ? 'Loading sessions…' : 'Choose a session'} options={sessions.map((s) => ({ value: s.id, disabled: s.status !== 'ACTIVE', label: <span className="flex items-center gap-2">{s.name}<SessionStatusBadge status={s.status} size="sm" />{s.bound && <span className="text-[11px] text-muted-foreground">bound to this campaign</span>}</span>, description: `${SCOPE_META[s.role_scope].label} · ${money(s.spent_amount)} / ${money(s.budget_ceiling)} ceiling · rate cap ${money(s.rate_ceiling)}` }))} />
            <FieldError>{errors.session}</FieldError>
            {session && (
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-agent/25 bg-agent-soft/40 p-3 text-xs">
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Scope</div><div className="font-medium">{SCOPE_META[session.role_scope].label}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Budget left</div><div className="font-medium tabular-nums">{money(Math.max(0, session.budget_ceiling - session.spent_amount))}</div></div>
                <div><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Rate ceiling</div><div className="font-medium tabular-nums">{money(session.rate_ceiling)}</div></div>
              </div>
            )}
          </div>
        )}

        <div>
          <Label required>Goal</Label>
          <Textarea value={goal} onChange={(e) => { setGoal(e.target.value); setErrors((er) => ({ ...er, goal: undefined })); }} rows={3} error={Boolean(errors.goal)} placeholder="What should the agent achieve on this campaign?" />
          <FieldError>{errors.goal}</FieldError>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {goals.map((g, i) => (
              <button key={i} type="button" onClick={() => setGoal(g)} className={cn('max-w-full truncate rounded-full border px-2.5 py-1 text-left text-xs transition', goal === g ? 'border-agent bg-agent-soft text-agent' : 'border-border text-muted-foreground hover:border-agent/50 hover:text-foreground')} title={g}>{g}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)} options={[
            { value: 'AUTO', label: 'Auto', description: `Use the runtime default${defaultMode ? ` (${defaultMode === 'LLM' ? 'LLM' : 'simulated'})` : ''}` },
            { value: 'SIMULATED', label: 'Simulated', description: 'Deterministic planner — exercises the same tools and guardrails without a model' },
            { value: 'LLM', label: 'LLM', disabled: !llmAvailable, description: llmAvailable ? `Live model (${scopes.data?.runtime.default_model})` : 'Unavailable — no model API key configured on the server' },
          ]} />
          {!llmAvailable && <Hint>LLM mode is disabled because the server has no model API key. Simulated runs still go through the real MCP tools, guardrails and audit trail.</Hint>}
        </div>

        <Callout tone="agent" title="Nothing moves money without policy">
          Offers above the rate ceiling or payments above the threshold are held as checkpoints; spend beyond the session's budget ceiling is blocked by guardrail. Every tool call is written to the hash-chained audit trail.
        </Callout>
      </div>
    </Dialog>
  );
}
