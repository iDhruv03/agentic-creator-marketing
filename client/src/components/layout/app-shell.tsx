import * as React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Megaphone, Users, Handshake, ShieldCheck, Wallet, ScrollText, Bot, Plug, FlaskConical, Building2, Settings, Bell, Search, Sun, Moon, Monitor,
  PanelLeftClose, PanelLeftOpen, LogOut, ChevronDown, Inbox, Sparkles, UserCircle, Menu, X, Check, Wifi, WifiOff,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useAuth, useUser } from '@/store/auth';
import { useUi } from '@/store/ui';
import { usePlatformEvents } from '@/lib/realtime';
import { useNotifications, useCheckpoints, useAction } from '@/hooks/queries';
import { api } from '@/lib/api';
import { Logo, LogoMark } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { Tooltip, Dropdown, DropdownTrigger, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, Popover, PopoverTrigger, PopoverContent } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/feedback';
import { CommandPalette } from './command-palette';
import { toast } from 'sonner';

interface NavItem { to: string; label: string; icon: React.ElementType; badge?: number; end?: boolean }
interface NavGroup { label?: string; items: NavItem[] }

function useNavGroups(): NavGroup[] {
  const user = useUser();
  const isOps = Boolean(user && user.role !== 'CREATOR');
  const pending = useCheckpoints({ status: 'PENDING' }, isOps);
  const pendingCount = isOps ? pending.data?.length ?? 0 : 0;
  if (!user) return [];
  if (user.role === 'CREATOR') {
    return [
      { items: [{ to: '/creator', label: 'Home', icon: LayoutDashboard, end: true }, { to: '/creator/offers', label: 'Offers & work', icon: Inbox }, { to: '/creator/wallet', label: 'Wallet', icon: Wallet }, { to: '/creator/profile', label: 'Media kit', icon: UserCircle }] },
      { label: 'Account', items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
    ];
  }
  const ops: NavItem[] = [
    { to: user.role === 'AGENCY' ? '/agency' : '/', label: user.role === 'AGENCY' ? 'Workspace' : 'Overview', icon: user.role === 'AGENCY' ? Building2 : LayoutDashboard, end: true },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
    { to: '/creators', label: 'Discover creators', icon: Users },
    { to: '/collaborations', label: 'Collaborations', icon: Handshake },
    { to: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: pendingCount },
    { to: '/finance', label: 'Finance', icon: Wallet },
  ];
  if (user.role === 'AGENCY') ops.splice(1, 0, { to: '/', label: 'Overview', icon: LayoutDashboard, end: true });
  return [
    { items: ops },
    { label: 'Agents & MCP', items: [{ to: '/agents', label: 'Agent sessions', icon: Bot }, { to: '/mcp', label: 'MCP server', icon: Plug }, { to: '/evaluation', label: 'Evaluation lab', icon: FlaskConical }] },
    { label: 'Governance', items: [{ to: '/audit', label: 'Audit trail', icon: ScrollText }, { to: '/settings', label: 'Settings', icon: Settings }] },
  ];
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const groups = useNavGroups();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && !collapsed && <div className="mb-1.5 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{g.label}</div>}
          {g.label && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = it.icon;
              const link = (
                <NavLink key={it.to} to={it.to} end={it.end} onClick={onNavigate} className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] font-medium transition', collapsed && 'justify-center px-0', isActive ? 'bg-primary-soft text-primary' : 'text-foreground/70 hover:bg-accent hover:text-foreground')}>
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                      {!collapsed && <span className="truncate">{it.label}</span>}
                      {!!it.badge && (collapsed ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" /> : <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-white">{it.badge}</span>)}
                    </>
                  )}
                </NavLink>
              );
              return collapsed ? <Tooltip key={it.to} content={it.label} side="right">{link}</Tooltip> : link;
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useUi();
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  return (
    <Dropdown>
      <DropdownTrigger asChild><Button variant="ghost" size="icon" aria-label="Theme"><Icon className="h-4 w-4" /></Button></DropdownTrigger>
      <DropdownContent className="min-w-[160px]">
        <DropdownLabel>Appearance</DropdownLabel>
        {([['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']] as const).map(([v, I, label]) => (
          <DropdownItem key={v} icon={<I />} onSelect={() => setTheme(v)}>{label}{theme === v && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownItem>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useAction((ids?: string[]) => api.notifications.markRead(ids), { invalidate: ['notifications', 'me'] });
  const unread = data?.unread ?? 0;
  const kindTone: Record<string, string> = { CHECKPOINT: 'bg-warning', OFFER: 'bg-info', DELIVERABLE: 'bg-primary', PAYMENT: 'bg-success', AGENT: 'bg-agent', INFO: 'bg-muted-foreground' };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          {unread > 0 && <button className="text-xs font-medium text-primary hover:underline" onClick={() => markRead.mutate([undefined])}>Mark all read</button>}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {(data?.items ?? []).length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</div>}
          {(data?.items ?? []).map((n) => (
            <button key={n.id} onClick={() => { if (!n.read) markRead.mutate([[n.id]]); if (n.link) navigate(n.link); }} className={cn('flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-accent/50', !n.read && 'bg-primary-soft/30')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', kindTone[n.kind] ?? 'bg-muted-foreground', n.read && 'opacity-30')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{n.title}</span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-[11px] text-muted-foreground/80">{timeAgo(n.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu() {
  const me = useAuth((s) => s.me);
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  if (!me) return null;
  const u = me.user;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition hover:bg-accent">
          <Avatar name={u.name} src={u.avatar_url} size="sm" />
          <span className="hidden text-left leading-tight md:block">
            <span className="block max-w-[140px] truncate text-[13px] font-medium">{u.name}</span>
            <span className="block max-w-[140px] truncate text-[11px] text-muted-foreground">{me.org?.name ?? u.role}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
        </button>
      </DropdownTrigger>
      <DropdownContent className="min-w-[220px]">
        <div className="px-2.5 py-2">
          <div className="text-[13px] font-semibold">{u.name}</div>
          <div className="text-xs text-muted-foreground">{u.email}</div>
          <div className="mt-1.5 inline-flex rounded-md bg-primary-soft px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">{u.role}{u.title ? ` · ${u.title}` : ''}</div>
        </div>
        <DropdownSeparator />
        <DropdownItem icon={<Settings />} onSelect={() => navigate('/settings')}>Settings</DropdownItem>
        <DropdownItem icon={<Sparkles />} onSelect={() => { logout(); navigate('/login'); }}>Switch persona</DropdownItem>
        <DropdownSeparator />
        <DropdownItem icon={<LogOut />} onSelect={() => { logout(); navigate('/login'); }}>Sign out</DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

export function AppShell() {
  const { sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNav, setPalette } = useUi();
  const location = useLocation();
  const navigate = useNavigate();
  const connected = usePlatformEvents((evt) => {
    if (evt.type === 'checkpoint.created') toast.warning('Approval needed', { description: `An agent action is waiting for review.`, action: { label: 'Review', onClick: () => navigate('/approvals') } });
  });

  React.useEffect(() => { setMobileNav(false); }, [location.pathname, setMobileNav]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette]);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur transition-[width] duration-200 lg:flex', sidebarCollapsed ? 'w-[68px]' : 'w-[248px]')}>
        <div className={cn('flex h-16 items-center border-b border-border', sidebarCollapsed ? 'justify-center' : 'justify-between px-4')}>
          <Logo collapsed={sidebarCollapsed} />
          {!sidebarCollapsed && <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></Button>}
        </div>
        <SidebarNav collapsed={sidebarCollapsed} />
        <div className={cn('border-t border-border p-3', sidebarCollapsed && 'flex justify-center')}>
          {sidebarCollapsed ? (
            <Button variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label="Expand sidebar"><PanelLeftOpen className="h-4 w-4" /></Button>
          ) : (
            <div className="rounded-xl border border-border bg-surface-muted/60 p-3">
              <div className="flex items-center gap-2 text-[12px] font-medium">{connected ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}{connected ? 'Live updates on' : 'Reconnecting…'}</div>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">Dashboard and MCP server share one data core.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-surface shadow-overlay animate-slide-up">
            <div className="flex h-16 items-center justify-between border-b border-border px-4"><Logo /><Button variant="ghost" size="icon-sm" onClick={() => setMobileNav(false)}><X className="h-4 w-4" /></Button></div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Menu"><Menu className="h-5 w-5" /></Button>
          <div className="lg:hidden"><LogoMark size={26} /></div>
          <button onClick={() => setPalette(true)} className="hidden h-9 w-full max-w-md items-center gap-2 rounded-xl border border-border bg-surface px-3 text-[13px] text-muted-foreground shadow-sm transition hover:border-foreground/25 sm:flex">
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate text-left">Search campaigns, creators, tools…</span>
            <span className="hidden items-center gap-1 md:flex"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPalette(true)} aria-label="Search"><Search className="h-4 w-4" /></Button>
            <ThemeMenu />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 animate-fade-in">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
