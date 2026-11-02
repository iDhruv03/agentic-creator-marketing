import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Cpu, Sparkles, Wand2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useCampaigns, useScopes, useSessions } from '@/hooks/queries';
import { money } from '@/lib/utils';
import { Dialog, Tooltip } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Label, Select, Textarea, SegmentedControl, Hint } from '@/components/ui/field';
import { Callout } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { SCOPE_META, SUGGESTED_GOALS } from './shared';

type Mode = 'AUTO' | 'SIMULATED' | 'LLM';

export function LaunchRunDialog({ open, onOpenChange, defaultSessionId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultSessionId?: string }) {
  const navigate = useNavigate();
  const sessions = useSessions({});
  const campaigns = useCampaigns({});
  const scopes = useScopes();
  const [sessionId, setSessionId] = React.useState(defaultSessionId ?? '');
  const [campaignId, setCampaignId] = React.useState('');
  const [goal, setGoal] = React.useState('');
  const [mode, setMode] = React.useState<Mode>('AUTO');
  const [touchedCampaign, setTouchedCampaign] = React.useState(false);

  const llmAvailable = scopes.data?.runtime.llm_available ?? false;
  const activeSessions = (sessions.data ?? []).filter((s) => s.status === 'ACTIVE');
  const session = (sessions.data ?? []).find((s) => s.id === sessionId);

  React.useEffect(() => {
    if (!open) return;
    setSessionId(defaultSessionId ?? '');
    setGoal('');
    setMode('AUTO');
    setTouchedCampaign(false);
  }, [open, defaultSessionId]);

  // Default the campaign to the session's binding whenever the dialog opens or the session changes.
  // (Re-seeding on `open` matters when the session was already selected before: the deps below would not change.)
  React.useEffect(() => {
    if (!open) return;
    if (!touchedCampaign) setCampaignId(session?.campaign_id ?? '');
  }, [open, session?.id, session?.campaign_id, touchedCampaign]);

  // If no session was given, pick the first active one.
  React.useEffect(() => {
    if (open && !sessionId && activeSessions.length) setSessionId(activeSessions[0]!.id);
  }, [open, sessionId, activeSessions]);

  const brandCampaigns = (campaigns.data ?? []).filter((c) => !session?.brand_id || c.brand_id === session.brand_id);

  const start = useAction(api.agents.startRun, {
    invalidate: ['runs', 'sessions', 'session'],
    success: 'Run started',
    onSuccess: (run) => { onOpenChange(false); navigate(`/agents/runs/${run.id}`); },
  });

  const submit = () => {
    if (!sessionId) return;
    start.mutate([{ session_id: sessionId, campaign_id: campaignId || null, goal: goal.trim() || undefined, mode }]);
  };

  const offBinding = Boolean(session?.campaign_id && campaignId && campaignId !== session.campaign_id);
  // The deterministic planner always works a campaign; only a Claude-driven run can start without one.
  const simulated = mode === 'SIMULATED' || (mode === 'AUTO' && !llmAvailable);
  const missingCampaign = simulated && !campaignId;
  const modeOptions: { value: Mode; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }[] = [
    { value: 'AUTO', label: 'Auto', icon: <Wand2 className="h-3.5 w-3.5" /> },
    { value: 'SIMULATED', label: 'Simulated', icon: <Cpu className="h-3.5 w-3.5" /> },
    { value: 'LLM', label: llmAvailable ? 'Claude' : <Tooltip content="Set ANTHROPIC_API_KEY on the server to run with Claude. Governance is identical in simulated mode."><span>Claude</span></Tooltip>, icon: <Sparkles className="h-3.5 w-3.5" />, disabled: !llmAvailable },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Launch run"
      description="Give the agent a goal. It plans and calls governed MCP tools; anything outside policy is held or blocked."
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="agent" leftIcon={<Play className="h-4 w-4" />} loading={start.isPending} disabled={!sessionId || (session && session.status !== 'ACTIVE') || missingCampaign} onClick={submit}>Launch run</Button>
      </>}
    >
      <div className="space-y-5">
        <div>
          <Label required>Agent session</Label>
          <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setTouchedCampaign(false); }} options={(sessions.data ?? []).map((s) => ({ value: s.id, label: s.name, description: `${SCOPE_META[s.role_scope].label} · ${money(s.spent_amount)} / ${money(s.budget_ceiling)}${s.status !== 'ACTIVE' ? ` · ${s.status.toLowerCase()}` : ''}`, disabled: s.status !== 'ACTIVE' }))} placeholder={sessions.isLoading ? 'Loading sessions…' : 'Choose a session'} />
          {session && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge tone={SCOPE_META[session.role_scope].tone} size="sm">{SCOPE_META[session.role_scope].label}</Badge>
              <span>ceiling {money(session.budget_ceiling)} · rate {money(session.rate_ceiling)} · committed {money(session.spent_amount)}</span>
            </div>
          )}
          {sessions.data && activeSessions.length === 0 && <p className="mt-1.5 text-xs text-warning">No active sessions. Authorise or resume one first.</p>}
        </div>

        <div>
          <Label>Campaign</Label>
          <Select value={campaignId} onValueChange={(v) => { setTouchedCampaign(true); setCampaignId(v); }} options={brandCampaigns.map((c) => ({ value: c.id, label: c.title, description: `${c.status.toLowerCase()} · ${money(c.financials.available)} available` }))} allowEmpty="No specific campaign" placeholder="No specific campaign" />
          {offBinding ? <p className="mt-1.5 text-xs text-danger">This session is bound to another campaign; the campaign-binding guardrail will block every campaign call.</p>
            : missingCampaign ? <p className="mt-1.5 text-xs text-danger">The simulated planner needs a campaign to work on — choose one.</p>
            : <Hint>{session?.campaign_id ? 'Defaults to the campaign this session is bound to.' : simulated ? 'The planner inspects this campaign first and works inside its brief and budget.' : 'Optional — without a campaign the agent can only discover and shortlist.'}</Hint>}
        </div>

        <div>
          <Label>Goal</Label>
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What should the agent accomplish in this run?" maxLength={2000} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_GOALS.map((g) => (
              <button key={g} type="button" onClick={() => setGoal(g)} className="rounded-full border border-border bg-surface px-2.5 py-1 text-left text-xs text-muted-foreground transition hover:border-agent/50 hover:bg-agent-soft/40 hover:text-foreground">{g}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Execution mode</Label>
          <SegmentedControl options={modeOptions} value={mode} onChange={(m) => { if (m === 'LLM' && !llmAvailable) return; setMode(m); }} />
          <Hint>
            {mode === 'AUTO' && (llmAvailable ? 'Uses Claude when a key is configured — it is.' : 'Uses Claude when a key is configured; falls back to the deterministic planner.')}
            {mode === 'SIMULATED' && 'Deterministic planner that exercises the same governed tools — no model calls.'}
            {mode === 'LLM' && `Claude (${session?.model ?? scopes.data?.runtime.default_model ?? 'default model'}) plans and calls tools live.`}
          </Hint>
        </div>

        <Callout tone="neutral">
          Offers above {session ? money(session.rate_ceiling) : 'the rate ceiling'} and payouts above {scopes.data ? money(scopes.data.payment_threshold) : 'the threshold'} are held for your approval. Nothing executes until you decide.
        </Callout>
      </div>
    </Dialog>
  );
}
