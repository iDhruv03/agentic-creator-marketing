import * as React from 'react';
import { Link } from 'react-router-dom';
import { Server, Terminal, Globe, Sparkles, ShieldCheck, ScrollText, ShieldAlert, Wrench, Play, RotateCcw, ArrowRight, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useMcpTools, useSessions, useAction } from '@/hooks/queries';
import { cn, num, fmtDateTime } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Section } from '@/components/ui/card';
import { Callout, EmptyState, Skeleton, SkeletonRows, Spinner } from '@/components/ui/feedback';
import { Label, Select } from '@/components/ui/field';
import { CodeBlock, Mono, CopyButton } from '@/components/ui/data';
import { JsonBlock } from '@/components/agents/JsonBlock';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExecStatusBadge, ToolChip } from '@/components/ui/status';
import { Tooltip } from '@/components/ui/overlay';
import type { McpToolDefinition, ToolExecutionResult } from '@/types';
import { ToolSchemaForm, buildParams, schemaProps, type JsonSchemaObject } from '@/components/agents/ToolSchemaForm';
import { RiskToneBadge, TOOL_CATEGORIES, SCOPE_META, RULE_META } from '@/components/agents/shared';

const REPO = '/Users/dhruv/agentic-creator-marketing';
const HTTP_ENDPOINT = 'http://localhost:3001/mcp';

interface CallRecord { id: string; at: string; session_id: string; tool: string; params: Record<string, unknown>; result: ToolExecutionResult }

function ToolRow({ tool, allowed, onTry }: { tool: McpToolDefinition; allowed: boolean | null; onTry: () => void }) {
  const [open, setOpen] = React.useState(false);
  const schema = tool.inputSchema as JsonSchemaObject;
  const props = schemaProps(schema);
  return (
    <div className={cn('rounded-xl border border-border transition', allowed === false && 'opacity-45')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-2 px-3.5 py-2.5 text-left hover:bg-accent/40 sm:flex-nowrap">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition', open && 'rotate-90')} />
        <ToolChip name={tool.name} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/90">{tool.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {allowed === false && <Badge tone="outline" size="sm">not in scope</Badge>}
          <RiskToneBadge risk={tool.risk} size="sm" />
          <span className="hidden text-[11px] text-muted-foreground sm:inline">{props.length} param{props.length === 1 ? '' : 's'}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{tool.description}</p>
          {props.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="table-base text-[12.5px]">
                <thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
                <tbody>
                  {props.map(([k, p]) => (
                    <tr key={k}>
                      <td className="font-mono text-[12px]">{k}</td>
                      <td className="font-mono text-[12px] text-muted-foreground">{p.enum ? `enum(${p.enum.join(' | ')})` : p.type === 'array' ? `array<${p.items?.type ?? 'any'}>` : p.type ?? 'any'}</td>
                      <td>{schema.required?.includes(k) ? <Badge tone="primary" size="sm">required</Badge> : <span className="text-muted-foreground">optional</span>}</td>
                      <td className="text-muted-foreground">{p.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-xs text-muted-foreground">No parameters.</p>}
          <div className="mt-3 flex justify-end"><Button size="xs" variant="secondary" leftIcon={<Play className="h-3 w-3" />} onClick={onTry} disabled={allowed === false}>Try in playground</Button></div>
        </div>
      )}
    </div>
  );
}

export default function McpServer() {
  const registry = useMcpTools();
  const sessions = useSessions({});
  const [connectSession, setConnectSession] = React.useState('');
  const [scopeSession, setScopeSession] = React.useState('');
  const [pgSession, setPgSession] = React.useState('');
  const [pgTool, setPgTool] = React.useState('');
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [history, setHistory] = React.useState<CallRecord[]>([]);
  const [last, setLast] = React.useState<CallRecord | null>(null);
  const playgroundRef = React.useRef<HTMLDivElement>(null);

  const scoped = useMcpTools(scopeSession || undefined);
  const pgScoped = useMcpTools(pgSession || undefined);

  React.useEffect(() => {
    if (!sessions.data?.length) return;
    const active = sessions.data.filter((s) => s.status === 'ACTIVE');
    const first = active.find((s) => !s.name.startsWith('Eval agent')) ?? active[0] ?? sessions.data[0]!;
    setConnectSession((v) => v || first.id);
    setPgSession((v) => v || first.id);
  }, [sessions.data]);

  const sessionOptions = (sessions.data ?? []).map((s) => ({ value: s.id, label: s.name, description: `${SCOPE_META[s.role_scope].label} · ${s.status.toLowerCase()} · ${s.allowed_tools.length} tools` }));
  const allTools = registry.data?.all_tools ?? [];
  const scopedNames = scopeSession && scoped.data ? new Set(scoped.data.tools.map((t) => t.name)) : null;
  const pgTools = pgSession ? (pgScoped.data?.tools ?? []) : allTools;
  const tool = pgTools.find((t) => t.name === pgTool) ?? allTools.find((t) => t.name === pgTool);
  const schema = tool?.inputSchema as JsonSchemaObject | undefined;

  React.useEffect(() => { if (pgTools.length && !pgTools.some((t) => t.name === pgTool)) { setPgTool(pgTools[0]!.name); setValues({}); setErrors({}); } }, [pgTools, pgTool]);

  const call = useAction((session_id: string, tool_name: string, params: Record<string, unknown>) => api.agents.mcpCall(session_id, tool_name, params), {
    invalidate: ['audit', 'checkpoints', 'sessions', 'campaign', 'campaigns', 'collaborations', 'overview'],
    onSuccess: () => undefined,
  });

  const runCall = (session_id: string, tool_name: string, params: Record<string, unknown>) => {
    call.mutate([session_id, tool_name, params], {
      onSuccess: (result) => {
        const rec: CallRecord = { id: `${Date.now()}`, at: new Date().toISOString(), session_id, tool: tool_name, params, result };
        setLast(rec);
        setHistory((h) => [rec, ...h].slice(0, 10));
      },
    });
  };
  const submit = () => {
    if (!pgSession || !tool) return;
    const { params, errors: e } = buildParams(schema, values);
    setErrors(e);
    if (Object.keys(e).length) return;
    runCall(pgSession, tool.name, params);
  };
  const tryTool = (name: string) => {
    setPgTool(name); setValues({}); setErrors({});
    playgroundRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const rerun = (rec: CallRecord) => { setPgSession(rec.session_id); setPgTool(rec.tool); setValues(rec.params); runCall(rec.session_id, rec.tool, rec.params); };

  const stdioConfig = JSON.stringify({ mcpServers: { 'cmi-creator-marketing': { command: 'npx', args: ['tsx', `${REPO}/server/src/mcp/stdio.ts`], env: { CMI_SESSION_ID: connectSession || '<session id>' } } } }, null, 2);
  const curlInit = `curl -s ${HTTP_ENDPOINT} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'X-CMI-Session: ${connectSession || '<session id>'}' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"${registry.data?.protocol ?? '2025-06-18'}","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'`;
  const curlCall = `curl -s ${HTTP_ENDPOINT} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'X-CMI-Session: ${connectSession || '<session id>'}' \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_campaign_status","arguments":{"campaign_id":"camp_techpulse_earbuds"}}}'`;
  const apiConnector = `{
  "model": "claude-opus-5-5",
  "max_tokens": 2048,
  "messages": [{ "role": "user", "content": "Shortlist the 3 best creators for camp_techpulse_earbuds." }],
  "mcp_servers": [{
    "type": "url",
    "url": "https://<public-host>/mcp?session=${connectSession || '<session id>'}",
    "name": "cmi-creator-marketing"
  }]
}`;

  const grouped = TOOL_CATEGORIES.map((c) => ({ ...c, tools: allTools.filter((t) => t.category === c.key) })).filter((c) => c.tools.length);
  const lastResult = last?.result;

  return (
    <div className="page">
      <PageHeader title="MCP server" description="The governed Model Context Protocol server any agent connects to. Tools are scoped per session, every call is audited, and high-impact actions stop at a human checkpoint." actions={<Button variant="secondary" onClick={() => playgroundRef.current?.scrollIntoView({ behavior: 'smooth' })} leftIcon={<Play className="h-4 w-4" />}>Open playground</Button>} />

      <div className="space-y-6">
        {/* Hero */}
        <Card className="bg-gradient-to-br from-agent-soft/60 via-surface to-surface">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-agent text-white"><Server className="h-5 w-5" /></span>
                <div>
                  <h2 className="font-display text-xl font-semibold">Governed MCP server</h2>
                  {registry.isLoading ? <Skeleton className="mt-1 h-3.5 w-64" /> : registry.data && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"><Mono>{registry.data.server.name}</Mono><span>v{registry.data.server.version}</span><span>·</span><span>protocol <Mono>{registry.data.protocol}</Mono></span></div>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="agent"><Terminal className="h-3 w-3" />stdio · {registry.data?.transports.stdio ?? 'server/src/mcp/stdio.ts'}</Badge>
                <Badge tone="info"><Globe className="h-3 w-3" />Streamable HTTP · {registry.data?.transports.streamable_http ?? '/mcp'}</Badge>
                <Badge tone="neutral"><Wrench className="h-3 w-3" />{allTools.length} tools</Badge>
              </div>
            </div>
            <ul className="grid shrink-0 gap-2.5 text-[13px] sm:grid-cols-3 lg:w-[560px]">
              {[
                { icon: ShieldCheck, title: 'Scoped tools per session', body: 'tools/list only returns what the session scope grants; anything else is a permission-scope block.' },
                { icon: ScrollText, title: 'Every call audited', body: 'Each tools/call appends a hash-chained audit record with parameters, outcome and rules evaluated.' },
                { icon: ShieldAlert, title: 'Human checkpoints', body: 'Out-of-band rates, large payouts and post-acceptance brief edits are held — HELD_FOR_APPROVAL means not executed.' },
              ].map((b) => (
                <li key={b.title} className="rounded-xl border border-border bg-surface/80 p-3"><div className="flex items-center gap-2 font-semibold"><b.icon className="h-4 w-4 text-agent" />{b.title}</div><p className="mt-1 text-xs leading-snug text-muted-foreground">{b.body}</p></li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Connect */}
        <Card>
          <CardHeader title="Connect" description="Point any MCP client at this server. The session id decides what the client may do." icon={<Terminal className="h-4 w-4" />} action={<div className="w-56 max-w-full"><Select size="sm" value={connectSession} onValueChange={setConnectSession} options={sessionOptions} placeholder={sessions.isLoading ? 'Loading…' : 'Session'} /></div>} />
          <Tabs defaultValue="stdio">
            <TabsList>
              <TabsTrigger value="stdio" icon={<Terminal />}>Claude Desktop / Cursor</TabsTrigger>
              <TabsTrigger value="http" icon={<Globe />}>Streamable HTTP</TabsTrigger>
              <TabsTrigger value="api" icon={<Sparkles />}>Claude API connector</TabsTrigger>
            </TabsList>
            <TabsContent value="stdio" className="pt-4">
              <p className="mb-3 text-[13px] text-muted-foreground">Add this to <Mono>claude_desktop_config.json</Mono> or Cursor's <Mono>mcp.json</Mono>. The server starts over stdio bound to the chosen session.</p>
              <CodeBlock title="mcpServers config" code={stdioConfig} />
              <p className="mb-2 mt-4 text-[13px] text-muted-foreground">Or run it manually from the repo (defaults to <Mono>sess_techpulse_operator</Mono>):</p>
              <CodeBlock title="shell" code={`cd ${REPO}/server\nCMI_SESSION_ID=${connectSession || '<session id>'} npm run mcp:stdio`} />
            </TabsContent>
            <TabsContent value="http" className="pt-4">
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endpoint</div><div className="mt-1 flex items-center gap-1"><Mono>{HTTP_ENDPOINT}</Mono><CopyButton value={HTTP_ENDPOINT} /></div></div>
                <div className="rounded-xl border border-border p-3"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session header</div><div className="mt-1 flex items-center gap-1"><Mono>{`X-CMI-Session: ${connectSession || '<session id>'}`}</Mono><CopyButton value={`X-CMI-Session: ${connectSession}`} /></div></div>
              </div>
              <p className="mb-3 text-[13px] text-muted-foreground">Stateless JSON-RPC over POST. <Mono>?session=</Mono> works as an alternative to the header.</p>
              <div className="space-y-3">
                <CodeBlock title="initialize" code={curlInit} />
                <CodeBlock title="tools/call" code={curlCall} />
              </div>
            </TabsContent>
            <TabsContent value="api" className="pt-4">
              <Callout tone="agent" icon={Sparkles} className="mb-3">The Messages API MCP connector needs a publicly reachable URL. Expose <Mono>{HTTP_ENDPOINT}</Mono> through a tunnel, then reference it with <Mono>mcp_servers</Mono> and the <Mono>anthropic-beta: mcp-client-2025-04-04</Mono> header.</Callout>
              <CodeBlock title="POST /v1/messages" code={apiConnector} />
            </TabsContent>
          </Tabs>
        </Card>

        {/* Registry */}
        <Section title="Tool registry" description="Expand a tool for its description and input schema. Choose a session to see what it can call." action={<div className="w-60 max-w-full"><Select size="sm" value={scopeSession} onValueChange={setScopeSession} options={sessionOptions} allowEmpty="All tools (no session)" placeholder="Scope to session" /></div>}>
          {registry.isLoading ? <div className="card p-5"><SkeletonRows rows={6} /></div> : allTools.length === 0 ? <EmptyState icon={Wrench} title="No tools registered" /> : (
            <div className="space-y-5">
              {scopedNames && <Callout tone="info">{scopedNames.size} of {allTools.length} tools are callable by <strong>{sessions.data?.find((s) => s.id === scopeSession)?.name}</strong>. Greyed tools are outside its scope — calling them is a permission-scope guardrail block.</Callout>}
              {grouped.map((g) => (
                <Card key={g.key} padded={false} className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-[14px] font-semibold">{g.label}</h3><p className="text-xs text-muted-foreground">{g.description}</p></div><Badge tone="neutral" size="sm">{scopedNames ? `${g.tools.filter((t) => scopedNames.has(t.name)).length}/` : ''}{g.tools.length}</Badge></div>
                  <div className="space-y-2">{g.tools.map((t) => <ToolRow key={t.name} tool={t} allowed={scopedNames ? scopedNames.has(t.name) : null} onTry={() => tryTool(t.name)} />)}</div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* Playground */}
        <div ref={playgroundRef} className="scroll-mt-20">
          <Section title="Playground" description="Call a tool through the governed executor as a session would. Writes are real — guardrails and checkpoints apply exactly as for an agent.">
            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Session</Label><Select value={pgSession} onValueChange={(v) => { setPgSession(v); setErrors({}); }} options={sessionOptions} placeholder="Session" /></div>
                  <div><Label>Tool</Label><Select value={pgTool} onValueChange={(v) => { setPgTool(v); setValues({}); setErrors({}); }} options={pgTools.map((t) => ({ value: t.name, label: <span className="font-mono text-[12.5px]">{t.name}</span>, description: t.title }))} placeholder={pgScoped.isLoading ? 'Loading…' : 'Tool'} /></div>
                </div>
                {tool && (
                  <div className="mt-4 rounded-xl border border-border bg-surface-muted/40 p-3 text-[12.5px] text-muted-foreground">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5"><ToolChip name={tool.name} /><RiskToneBadge risk={tool.risk} size="sm" /><Badge tone="outline" size="sm">{tool.category}</Badge></div>
                    {tool.description}
                  </div>
                )}
                <div className="mt-4"><ToolSchemaForm schema={schema} values={values} onChange={setValues} errors={errors} /></div>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{pgSession ? `Calls are audited under ${sessions.data?.find((s) => s.id === pgSession)?.name ?? pgSession}.` : 'Choose a session.'}</span>
                  <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => { setValues({}); setErrors({}); }}>Reset</Button><Button variant="agent" leftIcon={<Play className="h-4 w-4" />} loading={call.isPending} disabled={!pgSession || !tool} onClick={submit}>Call tool</Button></div>
                </div>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader title="Result" description={last ? <span><ToolChip name={last.tool} /> · {fmtDateTime(last.at)}</span> : 'Nothing called yet'} />
                  {call.isPending ? <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground"><Spinner className="h-4 w-4 text-agent" />Evaluating guardrails and executing…</div> : !lastResult ? <EmptyState compact icon={Play} title="Call a tool to see the governed result" /> : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2"><ExecStatusBadge status={lastResult.status} /><span className="text-xs tabular-nums text-muted-foreground">{num(lastResult.duration_ms)} ms</span></div>
                      {lastResult.rules_evaluated?.length ? (
                        <div className="flex flex-wrap items-center gap-1"><span className="mr-1 text-[11px] text-muted-foreground">Rules</span>{lastResult.rules_evaluated.map((r) => <Tooltip key={r} content={RULE_META[r]?.description ?? r}><span className="rounded-md border border-border bg-surface-muted/70 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{r}</span></Tooltip>)}</div>
                      ) : null}
                      {lastResult.guardrail_notes && <p className="text-[12.5px] text-muted-foreground">{lastResult.guardrail_notes}</p>}
                      {lastResult.status === 'HELD_FOR_APPROVAL' && lastResult.checkpoint_id && (
                        <Callout tone="warning" icon={ShieldAlert} title="Held for human approval">The action has not executed. <Link to={`/approvals?checkpoint=${lastResult.checkpoint_id}`} className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">Review checkpoint <ArrowRight className="h-3 w-3" /></Link></Callout>
                      )}
                      {lastResult.error && lastResult.status !== 'HELD_FOR_APPROVAL' && <Callout tone={lastResult.status === 'REJECTED_BY_GUARDRAIL' ? 'danger' : 'neutral'}>{lastResult.error}</Callout>}
                      <JsonBlock value={lastResult.result ?? { error: lastResult.error }} maxHeight={360} />
                      <div className="text-[11px] text-muted-foreground">audit <Mono copy>{lastResult.audit_id}</Mono></div>
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader title="Recent calls" description="Last 10 from this page" />
                  {history.length === 0 ? <p className="text-[13px] text-muted-foreground">Your calls will appear here.</p> : (
                    <ul className="divide-y divide-border/70">
                      {history.map((h) => (
                        <li key={h.id} className="flex items-center gap-2 py-2">
                          <ExecStatusBadge status={h.result.status} size="sm" />
                          <button type="button" onClick={() => setLast(h)} className="min-w-0 flex-1 truncate text-left font-mono text-[12px] hover:text-primary">{h.tool}</button>
                          <span className="text-[11px] text-muted-foreground">{h.result.duration_ms}ms</span>
                          <Tooltip content="Re-run with the same parameters"><Button variant="ghost" size="icon-sm" aria-label="Re-run" onClick={() => rerun(h)} disabled={call.isPending}><RotateCcw className="h-3.5 w-3.5" /></Button></Tooltip>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

