const API_BASE = '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Brands & Agencies
  getBrands: () => fetchJson<any[]>('/brands'),
  getAgencies: () => fetchJson<any[]>('/agencies'),

  // Creators
  getCreators: (filters: { niche?: string; platform?: string; minFollowers?: number; maxRate?: number } = {}) => {
    const params = new URLSearchParams();
    if (filters.niche) params.append('niche', filters.niche);
    if (filters.platform) params.append('platform', filters.platform);
    if (filters.minFollowers) params.append('minFollowers', String(filters.minFollowers));
    if (filters.maxRate) params.append('maxRate', String(filters.maxRate));
    return fetchJson<any[]>(`/creators?${params.toString()}`);
  },
  getCreator: (id: string) => fetchJson<any>(`/creators/${id}`),

  // Campaigns
  getCampaigns: (brandId?: string) => {
    const query = brandId ? `?brandId=${brandId}` : '';
    return fetchJson<any[]>(`/campaigns${query}`);
  },
  getCampaign: (id: string) => fetchJson<any>(`/campaigns/${id}`),
  createCampaign: (data: any) =>
    fetchJson<any>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Collaborations & Deliverables
  getCollaborations: () => fetchJson<any[]>('/collaborations'),
  respondCollaboration: (id: string, status: 'ACCEPTED' | 'REJECTED') =>
    fetchJson<any>(`/collaborations/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  submitDeliverable: (id: string, data: { content_url: string; caption?: string }) =>
    fetchJson<any>(`/deliverables/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Human Checkpoints
  getCheckpoints: () => fetchJson<any[]>('/checkpoints'),
  resolveCheckpoint: (id: string, decision: 'APPROVED' | 'REJECTED', reviewer_notes?: string) =>
    fetchJson<any>(`/checkpoints/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewer_notes }),
    }),

  // Financial Ledger
  getLedger: (campaignId?: string) => {
    const query = campaignId ? `?campaignId=${campaignId}` : '';
    return fetchJson<any[]>(`/ledger${query}`);
  },

  // Audit Logs
  getAuditLogs: () => fetchJson<any[]>('/audit-logs'),

  // Agent Sessions & Execution
  getAgentSessions: () => fetchJson<any[]>('/agent-sessions'),
  runAgent: (session_id?: string, campaign_id?: string, goal_prompt?: string) =>
    fetchJson<any>('/agent/run', {
      method: 'POST',
      body: JSON.stringify({ session_id, campaign_id, goal_prompt }),
    }),

  // MCP Protocol
  getMcpTools: () => fetchJson<any>('/mcp/tools'),
  callMcpTool: (session_id: string, tool_name: string, params: any) =>
    fetchJson<any>('/mcp/call', {
      method: 'POST',
      body: JSON.stringify({ session_id, tool_name, params }),
    }),

  // Evaluation & Benchmark Lab
  getBenchmarks: () => fetchJson<any[]>('/evaluation/benchmarks'),
  runSimulation: (scenario_name?: string, creator_count?: number) =>
    fetchJson<any>('/evaluation/run-simulation', {
      method: 'POST',
      body: JSON.stringify({ scenario_name, creator_count }),
    }),
};
