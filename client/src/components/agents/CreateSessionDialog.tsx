import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { useAction, useScopes } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { money } from '@/lib/utils';
import { Dialog } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { SessionForm, emptySessionForm, toSessionInput, validateSessionForm, type SessionFormValue } from './SessionForm';
import { SCOPE_META } from './shared';

export function CreateSessionDialog({ open, onOpenChange, defaultBrandId, defaultCampaignId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultBrandId?: string; defaultCampaignId?: string }) {
  const me = useAuth((s) => s.me);
  const navigate = useNavigate();
  const scopes = useScopes();
  const initialBrand = me?.user.role === 'BRAND' ? (me.user.brand_id ?? '') : (defaultBrandId ?? '');
  const [value, setValue] = React.useState<SessionFormValue>(() => ({ ...emptySessionForm(initialBrand), campaign_id: defaultCampaignId ?? '' }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) { setValue({ ...emptySessionForm(initialBrand), campaign_id: defaultCampaignId ?? '' }); setErrors({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const create = useAction(api.agents.createSession, {
    invalidate: ['sessions', 'audit', 'overview'],
    success: (s) => `Agent session "${s.name}" authorised`,
    onSuccess: (s) => { onOpenChange(false); navigate(`/agents/sessions/${s.id}`); },
  });

  const submit = () => {
    const e = validateSessionForm(value);
    if (me?.user.role !== 'BRAND' && !value.brand_id) e.brand = 'Choose the brand this agent acts for.';
    setErrors(e);
    if (Object.keys(e).length) return;
    create.mutate([toSessionInput(value, scopes.data?.scopes)]);
  };

  const budget = Number(value.budget_ceiling) || 0;
  const rate = Number(value.rate_ceiling) || 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Authorise agent session"
      description="An agent session is a scoped identity: what it may call, how much it may commit, and where humans step in."
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="agent" leftIcon={<Sparkles className="h-4 w-4" />} loading={create.isPending} onClick={submit}>Authorise session</Button>
      </>}
    >
      <div className="space-y-5">
        <SessionForm value={value} onChange={setValue} errors={errors} />
        {errors.brand && <p className="text-xs text-danger">{errors.brand}</p>}
        <Callout tone="agent" title="What this authorises">
          A <strong>{SCOPE_META[value.role_scope].label.toLowerCase()}</strong> agent that may commit up to <strong>{money(budget)}</strong> in total and <strong>{money(rate)}</strong> per collaboration. Anything above the rate ceiling{scopes.data ? ` or a payout over ${money(scopes.data.payment_threshold)}` : ''} is held for your approval; anything above the budget ceiling is blocked. Every call is appended to the audit trail.
        </Callout>
      </div>
    </Dialog>
  );
}
