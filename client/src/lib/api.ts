import type * as T from '@/types';

const API = '/api';
const TOKEN_KEY = 'cmi.token';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: (): string | null => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string | null) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

async function request<R>(method: string, path: string, body?: unknown): Promise<R> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return undefined as R;
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new CustomEvent('cmi:unauthenticated'));
    throw new ApiError(data?.error ?? res.statusText, res.status, data?.code, data?.details);
  }
  return data as R;
}

const qs = (params: Record<string, unknown>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    login: (email: string, password: string) => request<{ token: string; user: T.User }>('POST', '/auth/login', { email, password }),
    personas: () => request<T.Persona[]>('GET', '/auth/personas'),
    me: () => request<T.Me>('GET', '/auth/me'),
  },
  orgs: {
    brands: () => request<T.Brand[]>('GET', '/brands'),
    brand: (id: string) => request<T.Brand & { campaigns: T.Campaign[] }>('GET', `/brands/${id}`),
    agencies: () => request<T.Agency[]>('GET', '/agencies'),
  },
  creators: {
    list: (params: Record<string, unknown> = {}) => request<T.Creator[]>('GET', `/creators${qs(params)}`),
    get: (id: string) => request<T.Creator>('GET', `/creators/${id}`),
    niches: () => request<string[]>('GET', '/creators/niches'),
    benchmark: (params: { follower_count: number; deliverable: 'post' | 'reel' | 'video' | 'story'; niche?: string }) => request<T.RateBenchmark>('GET', `/creators/benchmark${qs(params)}`),
    wallet: () => request<T.Wallet>('GET', '/creators/me/wallet'),
    updateProfile: (patch: T.CreatorProfilePatch) => request<T.Creator>('PATCH', '/creators/me/profile', patch),
  },
  campaigns: {
    list: (params: Record<string, unknown> = {}) => request<T.Campaign[]>('GET', `/campaigns${qs(params)}`),
    get: (id: string) => request<T.Campaign>('GET', `/campaigns/${id}`),
    create: (input: T.CampaignInput) => request<T.Campaign>('POST', '/campaigns', input),
    update: (id: string, patch: Partial<T.CampaignInput>) => request<T.Campaign>('PATCH', `/campaigns/${id}`, patch),
    setStatus: (id: string, status: T.CampaignStatus) => request<T.Campaign>('POST', `/campaigns/${id}/status`, { status }),
    analytics: (id: string) => request<T.CampaignAnalytics>('GET', `/campaigns/${id}/analytics`),
    ledger: (id: string) => request<T.LedgerEntry[]>('GET', `/campaigns/${id}/ledger`),
    audit: (id: string) => request<{ items: T.AuditRecord[]; total: number }>('GET', `/campaigns/${id}/audit`),
    shortlist: (id: string) => request<T.ShortlistEntry[]>('GET', `/campaigns/${id}/shortlist`),
    addToShortlist: (id: string, creator_id: string, rationale?: string) => request<T.ShortlistEntry>('POST', `/campaigns/${id}/shortlist`, { creator_id, rationale }),
    reviewShortlist: (id: string, entryId: string, status: 'APPROVED' | 'REJECTED') => request<T.ShortlistEntry>('POST', `/campaigns/${id}/shortlist/${entryId}/review`, { status }),
    removeFromShortlist: (id: string, entryId: string) => request<void>('DELETE', `/campaigns/${id}/shortlist/${entryId}`),
  },
  collaborations: {
    list: (params: Record<string, unknown> = {}) => request<T.Collaboration[]>('GET', `/collaborations${qs(params)}`),
    get: (id: string) => request<T.Collaboration>('GET', `/collaborations/${id}`),
    offer: (input: T.OfferInput) => request<T.Collaboration>('POST', '/collaborations', input),
    counter: (id: string, amount: number, message?: string) => request<T.Collaboration>('POST', `/collaborations/${id}/counter`, { amount, message }),
    accept: (id: string, message?: string) => request<T.Collaboration>('POST', `/collaborations/${id}/accept`, { message }),
    decline: (id: string, reason?: string) => request<T.Collaboration>('POST', `/collaborations/${id}/decline`, { reason }),
    start: (id: string) => request<T.Collaboration>('POST', `/collaborations/${id}/start`, {}),
    message: (id: string, body: string) => request<T.NegotiationMessage>('POST', `/collaborations/${id}/messages`, { body }),
    compliancePreview: (id: string, input: { caption: string; content_url: string; deliverable_type?: string }) => request<T.ComplianceReport>('POST', `/collaborations/${id}/compliance-preview`, input),
    submitDeliverable: (id: string, deliverableId: string, input: { content_url: string; caption?: string }) => request<{ deliverable: T.Deliverable; collaboration: T.Collaboration }>('POST', `/collaborations/${id}/deliverables/${deliverableId}/submit`, input),
    reviewDeliverable: (id: string, deliverableId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', notes?: string) => request<{ deliverable: T.Deliverable; collaboration: T.Collaboration }>('POST', `/collaborations/${id}/deliverables/${deliverableId}/review`, { decision, notes }),
    releasePayment: (id: string, input: { deliverable_id?: string | null; amount?: number; note?: string } = {}) => request<{ collaboration: T.Collaboration; amount: number; ledger_entry_id: string }>('POST', `/collaborations/${id}/release-payment`, input),
  },
  checkpoints: {
    list: (params: Record<string, unknown> = {}) => request<T.Checkpoint[]>('GET', `/checkpoints${qs(params)}`),
    get: (id: string) => request<T.Checkpoint>('GET', `/checkpoints/${id}`),
    resolve: (id: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => request<T.Checkpoint>('POST', `/checkpoints/${id}/resolve`, { decision, notes }),
  },
  ledger: {
    list: (params: Record<string, unknown> = {}) => request<T.LedgerEntry[]>('GET', `/ledger${qs(params)}`),
    trialBalance: () => request<T.TrialBalance>('GET', '/ledger/trial-balance'),
  },
  audit: {
    list: (params: Record<string, unknown> = {}) => request<{ items: T.AuditRecord[]; total: number }>('GET', `/audit${qs(params)}`),
    verify: () => request<T.AuditVerification>('GET', '/audit/verify'),
  },
  notifications: {
    list: () => request<{ items: T.Notification[]; unread: number }>('GET', '/notifications'),
    markRead: (ids?: string[]) => request<{ changed: number }>('POST', '/notifications/read', { ids }),
  },
  agents: {
    scopes: () => request<T.ScopesResponse>('GET', '/agents/scopes'),
    sessions: (params: Record<string, unknown> = {}) => request<T.AgentSession[]>('GET', `/agents/sessions${qs(params)}`),
    session: (id: string) => request<T.AgentSession>('GET', `/agents/sessions/${id}`),
    createSession: (input: T.SessionInput) => request<T.AgentSession>('POST', '/agents/sessions', input),
    updateSession: (id: string, patch: Partial<T.SessionInput>) => request<T.AgentSession>('PATCH', `/agents/sessions/${id}`, patch),
    setSessionStatus: (id: string, status: T.SessionStatus) => request<T.AgentSession>('POST', `/agents/sessions/${id}/status`, { status }),
    runs: (params: Record<string, unknown> = {}) => request<T.AgentRun[]>('GET', `/agents/runs${qs(params)}`),
    run: (id: string) => request<T.AgentRun>('GET', `/agents/runs/${id}`),
    startRun: (input: { session_id: string; campaign_id?: string | null; goal?: string; mode?: 'LLM' | 'SIMULATED' | 'AUTO'; model?: string }) => request<T.AgentRun>('POST', '/agents/runs', input),
    cancelRun: (id: string) => request<T.AgentRun>('POST', `/agents/runs/${id}/cancel`, {}),
    runStreamUrl: (id: string) => `${API}/agents/runs/${id}/stream?token=${encodeURIComponent(tokenStore.get() ?? '')}`,
    mcpTools: (sessionId?: string) => request<T.McpToolsResponse>('GET', `/agents/mcp/tools${qs({ session_id: sessionId })}`),
    mcpCall: (session_id: string, tool_name: string, params: Record<string, unknown>) => request<T.ToolExecutionResult>('POST', '/agents/mcp/call', { session_id, tool_name, params }),
  },
  insights: {
    overview: () => request<T.OverviewAnalytics>('GET', '/insights/overview'),
    evaluation: () => request<T.EvaluationSummary>('GET', '/insights/evaluation'),
    runScenario: (scenario: string, mode?: 'LLM' | 'SIMULATED' | 'AUTO') => request<{ manual: T.EvaluationRun; agentic: T.EvaluationRun; agent_run_id: string; campaign_id: string }>('POST', '/insights/evaluation/run', { scenario, mode }),
  },
  eventsUrl: () => `${API}/events?token=${encodeURIComponent(tokenStore.get() ?? '')}`,
  health: () => fetch('/health').then((r) => r.json()) as Promise<{ status: string; version: string; mcp_protocol: string; runtime: T.ScopesResponse['runtime'] }>,
};
