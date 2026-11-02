import * as React from 'react';
import { api } from '@/lib/api';
import { useAction, useScopes } from '@/hooks/queries';
import { Sheet } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import type { AgentSession } from '@/types';
import { SessionForm, toSessionInput, validateSessionForm, type SessionFormValue } from './SessionForm';

export function EditSessionSheet({ session, open, onOpenChange }: { session: AgentSession; open: boolean; onOpenChange: (o: boolean) => void }) {
  const scopes = useScopes();
  const fromSession = React.useCallback((): SessionFormValue => ({
    name: session.name,
    brand_id: session.brand_id ?? '',
    campaign_id: session.campaign_id ?? '',
    role_scope: session.role_scope,
    allowed_tools: session.allowed_tools,
    budget_ceiling: String(session.budget_ceiling),
    rate_ceiling: String(session.rate_ceiling),
    model: session.model,
    instructions: session.instructions ?? '',
  }), [session]);
  const [value, setValue] = React.useState<SessionFormValue>(fromSession);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  React.useEffect(() => { if (open) { setValue(fromSession()); setErrors({}); } }, [open, fromSession]);

  const update = useAction(api.agents.updateSession, { invalidate: ['sessions', 'session', 'mcp-tools', 'audit'], success: 'Session policy updated', onSuccess: () => onOpenChange(false) });

  const submit = () => {
    const e = validateSessionForm(value);
    setErrors(e);
    if (Object.keys(e).length) return;
    const input = toSessionInput(value, scopes.data?.scopes);
    const { brand_id: _brand, ...patch } = input;
    update.mutate([session.id, patch]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} width="lg" title={`Edit policy · ${session.name}`} description="Changes apply to the next tool call. Narrowing the scope immediately removes tools from the MCP server for this session."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={update.isPending} onClick={submit}>Save policy</Button></>}>
      <div className="px-6 py-5">
        <SessionForm value={value} onChange={setValue} errors={errors} lockBrand brandLabel={session.brand_name} />
      </div>
    </Sheet>
  );
}
