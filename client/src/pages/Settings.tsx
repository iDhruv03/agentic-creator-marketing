import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sun, Moon, Monitor, ShieldCheck, Server, KeyRound, Bot, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { useScopes } from '@/hooks/queries';
import { cn, money, fmtDate, titleCase } from '@/lib/utils';
import { SCOPE_META } from '@/components/agents/shared';
import { QueryError } from '@/components/collaborations/QueryError';
import type { RoleScope } from '@/types';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { KeyValue, CodeBlock } from '@/components/ui/data';
import { Callout } from '@/components/ui/feedback';

export default function Settings() {
  const me = useAuth((s) => s.me);
  const { theme, setTheme } = useUi();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 30_000 });
  const scopes = useScopes();
  if (!me) return null;
  const u = me.user;

  return (
    <div className="page max-w-5xl">
      <PageHeader title="Settings" description="Your profile, appearance and the platform runtime." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profile" />
            <div className="flex items-center gap-4">
              <Avatar name={u.name} src={u.avatar_url} size="xl" />
              <div>
                <div className="text-base font-semibold">{u.name}</div>
                <div className="text-sm text-muted-foreground">{u.email}</div>
                <div className="mt-1.5 flex items-center gap-2"><Badge tone="primary">{titleCase(u.role)}</Badge>{u.title && <span className="text-xs text-muted-foreground">{u.title}</span>}</div>
              </div>
            </div>
            <KeyValue className="mt-5" columns={2} items={[{ label: 'Organisation', value: me.org?.name ?? '—' }, { label: 'Member since', value: fmtDate(u.created_at) }, { label: 'User id', value: u.id, mono: true }, { label: 'Scope id', value: u.brand_id ?? u.agency_id ?? u.creator_id ?? '—', mono: true }]} />
          </Card>

          <Card>
            <CardHeader title="Appearance" description="Theme preference is stored on this device." />
            <div className="grid grid-cols-3 gap-2">
              {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([v, Icon, label]) => (
                <button key={v} onClick={() => setTheme(v)} className={cn('flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition', theme === v ? 'border-primary bg-primary-soft text-primary' : 'border-border hover:border-foreground/25')}>
                  <Icon className="h-5 w-5" />{label}{theme === v && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Platform runtime" icon={<Server className="h-4 w-4" />} description="Live status of the Infrastructure Core and MCP server." />
            <KeyValue columns={2} items={[
              { label: 'API status', value: <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', health.data?.status === 'ok' ? 'bg-success' : 'bg-danger')} />{health.data?.status === 'ok' ? 'Healthy' : 'Unreachable'}</span> },
              { label: 'Version', value: health.data?.version ?? '—', mono: true },
              { label: 'MCP protocol', value: health.data?.mcp_protocol ?? '—', mono: true },
              { label: 'Agent runtime', value: health.data?.runtime.llm_available ? `Claude · ${health.data.runtime.default_model}` : 'Simulated planner' },
              { label: 'Payment checkpoint threshold', value: scopes.data ? money(scopes.data.payment_threshold) : '—' },
              { label: 'Active runs', value: health.data?.runtime.active_runs ?? 0 },
            ]} />
            {!health.data?.runtime.llm_available && (
              <Callout tone="agent" icon={Bot} title="Agents run in simulated mode" className="mt-4">
                Set <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> in <code className="font-mono text-xs">server/.env</code> to have Claude plan and execute runs through the same governed tools. Everything else — guardrails, checkpoints, ledger, audit — behaves identically.
              </Callout>
            )}
          </Card>

          {u.role !== 'CREATOR' && (
            <Card>
              <CardHeader title="Permission scopes" icon={<ShieldCheck className="h-4 w-4" />} description="Which MCP tools each agent scope can call." />
              <div className="space-y-3">
                {scopes.isError && <QueryError compact what="permission scopes" error={scopes.error} refetch={scopes.refetch} />}
                {scopes.data && Object.entries(scopes.data.scopes).map(([scope, tools]) => (
                  <div key={scope} className="rounded-xl border border-border p-3">
                    <div className="mb-2 text-[13px] font-semibold">{SCOPE_META[scope as RoleScope]?.label ?? titleCase(scope)}</div>
                    <div className="flex flex-wrap gap-1">{tools.map((t) => <code key={t} className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{t}</code>)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Environment" icon={<KeyRound className="h-4 w-4" />} description="Server configuration keys (set in server/.env)." />
            <CodeBlock title=".env" code={`PORT=3001\nANTHROPIC_API_KEY=sk-ant-...          # enables Claude-driven agent runs\nCMI_PAYMENT_THRESHOLD=1000            # payouts above this need human approval\nCMI_AUTH_SECRET=change-me             # signs dashboard sessions\nCMI_SESSION_ID=sess_techpulse_operator # default MCP session for stdio/HTTP clients`} />
          </Card>
        </div>
      </div>
    </div>
  );
}
