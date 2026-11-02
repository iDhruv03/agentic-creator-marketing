import * as React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bot, ShieldCheck, ScrollText, Building2, Palette, Briefcase, Lock, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth, homeFor } from '@/store/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { LogoMark } from '@/components/ui/logo';
import { errorMessage } from '@/hooks/queries';
import type { Persona, Role } from '@/types';

const ROLE_META: Record<Role, { label: string; icon: React.ElementType; blurb: string; tone: string }> = {
  BRAND: { label: 'Brand', icon: Building2, blurb: 'Run campaigns, approve agents, control spend.', tone: 'text-primary bg-primary-soft' },
  AGENCY: { label: 'Agency', icon: Briefcase, blurb: 'One workspace across every client.', tone: 'text-info bg-info-soft' },
  CREATOR: { label: 'Creator', icon: Palette, blurb: 'Offers, content, payouts and your media kit.', tone: 'text-agent bg-agent-soft' },
  ADMIN: { label: 'Admin', icon: ShieldCheck, blurb: 'Platform-wide access.', tone: 'text-muted-foreground bg-surface-muted' },
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { status, me, login } = useAuth();
  const personas = useQuery({ queryKey: ['personas'], queryFn: api.auth.personas, staleTime: Infinity });
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('demo1234');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (status === 'ready' && me) return <Navigate to={location.state?.from ?? homeFor(me.user.role)} replace />;

  const signIn = async (e: string, p: string, key: string) => {
    setBusy(key); setError(null);
    try {
      const user = await login(e, p);
      navigate(location.state?.from && location.state.from !== '/login' ? location.state.from : homeFor(user.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const grouped = (personas.data ?? []).filter((p) => p.role !== 'ADMIN').reduce<Record<string, Persona[]>>((acc, p) => { (acc[p.role] ??= []).push(p); return acc; }, {});

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-16">
        {/* Left: story */}
        <div className="animate-slide-up">
          <div className="flex items-center gap-3"><LogoMark size={40} /><div><div className="font-display text-lg font-semibold">CMI</div><div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Creator Marketing Infrastructure</div></div></div>
          <h1 className="mt-8 max-w-xl font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[44px]">Creator marketing that <span className="text-gradient">humans and AI agents</span> run together.</h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">One shared core: a dashboard for brands, agencies and creators, and a governed MCP server for autonomous marketing agents. Budget ceilings, human checkpoints and an immutable audit trail keep every dollar accountable.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[{ icon: Bot, title: 'Agent-operable', body: '15 governed MCP tools over stdio and HTTP.' }, { icon: ShieldCheck, title: 'Governed by design', body: 'Budget scoping, rate ceilings, approval checkpoints.' }, { icon: ScrollText, title: 'Fully auditable', body: 'Hash-chained, append-only audit log.' }].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur">
                <f.icon className="h-5 w-5 text-primary" />
                <div className="mt-2.5 text-[13.5px] font-semibold">{f.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: personas + form */}
        <div className="card p-6 shadow-raised animate-slide-up sm:p-8" style={{ animationDelay: '60ms' }}>
          <h2 className="text-lg font-semibold">Choose a demo persona</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Every persona uses the password <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">demo1234</code>. Switch any time from the user menu.</p>
          <div className="mt-5 space-y-4">
            {(['BRAND', 'AGENCY', 'CREATOR'] as Role[]).map((role) => {
              const meta = ROLE_META[role];
              const list = grouped[role] ?? [];
              return (
                <div key={role}>
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground"><span className={cn('flex h-5 w-5 items-center justify-center rounded-md', meta.tone)}><meta.icon className="h-3 w-3" /></span>{meta.label}<span className="font-normal normal-case tracking-normal text-muted-foreground/80">· {meta.blurb}</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {personas.isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-[62px]" />)}
                    {list.map((p) => (
                      <button key={p.id} onClick={() => signIn(p.email, 'demo1234', p.id)} disabled={busy !== null} className={cn('group flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 text-left transition hover:-translate-y-px hover:border-primary/50 hover:shadow-raised disabled:opacity-60', busy === p.id && 'border-primary ring-4 ring-primary/15')}>
                        <Avatar name={p.name} src={p.avatar_url} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-tight">{p.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{p.org ?? p.title}</span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="divider" /><span className="whitespace-nowrap">or sign in with email</span><span className="divider" /></div>

          <form onSubmit={(e) => { e.preventDefault(); signIn(email, password, 'form'); }} className="space-y-3">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@brand.com" leftIcon={<Mail className="h-4 w-4" />} autoComplete="username" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock className="h-4 w-4" />} autoComplete="current-password" /></div>
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</p>}
            <Button type="submit" className="w-full" loading={busy === 'form'} disabled={!email}>Sign in</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
