import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import type * as T from '@/types';

/* ------------------------------------------------------------------ queries */
export const useBrands = () => useQuery({ queryKey: ['brands'], queryFn: api.orgs.brands });
export const useAgencies = () => useQuery({ queryKey: ['agencies'], queryFn: api.orgs.agencies });

export const useCreators = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['creators', params], queryFn: () => api.creators.list(params), placeholderData: (prev) => prev });
export const useCreator = (id: string | undefined) => useQuery({ queryKey: ['creator', id], queryFn: () => api.creators.get(id!), enabled: Boolean(id) });
export const useNiches = () => useQuery({ queryKey: ['niches'], queryFn: api.creators.niches, staleTime: Infinity });
export const useBenchmark = (params: { follower_count: number; deliverable: 'post' | 'reel' | 'video' | 'story'; niche?: string } | null) => useQuery({ queryKey: ['benchmark', params], queryFn: () => api.creators.benchmark(params!), enabled: Boolean(params && params.follower_count > 0) });
export const useWallet = () => useQuery({ queryKey: ['wallet'], queryFn: api.creators.wallet });

export const useCampaigns = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['campaigns', params], queryFn: () => api.campaigns.list(params) });
export const useCampaign = (id: string | undefined) => useQuery({ queryKey: ['campaign', id], queryFn: () => api.campaigns.get(id!), enabled: Boolean(id) });
export const useCampaignAnalytics = (id: string | undefined) => useQuery({ queryKey: ['campaign-analytics', id], queryFn: () => api.campaigns.analytics(id!), enabled: Boolean(id) });
export const useCampaignLedger = (id: string | undefined) => useQuery({ queryKey: ['ledger', 'campaign', id], queryFn: () => api.campaigns.ledger(id!), enabled: Boolean(id) });
export const useCampaignAudit = (id: string | undefined) => useQuery({ queryKey: ['audit', 'campaign', id], queryFn: () => api.campaigns.audit(id!), enabled: Boolean(id) });

export const useCollaborations = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['collaborations', params], queryFn: () => api.collaborations.list(params) });
export const useCollaboration = (id: string | undefined) => useQuery({ queryKey: ['collaboration', id], queryFn: () => api.collaborations.get(id!), enabled: Boolean(id) });

export const useCheckpoints = (params: Record<string, unknown> = {}, enabled = true) => useQuery({ queryKey: ['checkpoints', params], queryFn: () => api.checkpoints.list(params), enabled });
export const useCheckpoint = (id: string | undefined) => useQuery({ queryKey: ['checkpoint', id], queryFn: () => api.checkpoints.get(id!), enabled: Boolean(id) });

export const useLedger = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['ledger', params], queryFn: () => api.ledger.list(params) });
export const useTrialBalance = () => useQuery({ queryKey: ['trial-balance'], queryFn: api.ledger.trialBalance });
export const useAudit = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['audit', params], queryFn: () => api.audit.list(params), placeholderData: (prev) => prev });
export const useAuditVerify = () => useQuery({ queryKey: ['audit-verify'], queryFn: api.audit.verify });
export const useNotifications = (enabled = true) => useQuery({ queryKey: ['notifications'], queryFn: api.notifications.list, enabled, refetchInterval: 60_000 });

export const useScopes = () => useQuery({ queryKey: ['scopes'], queryFn: api.agents.scopes, staleTime: 60_000 });
export const useSessions = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['sessions', params], queryFn: () => api.agents.sessions(params) });
export const useSession = (id: string | undefined) => useQuery({ queryKey: ['session', id], queryFn: () => api.agents.session(id!), enabled: Boolean(id) });
export const useRuns = (params: Record<string, unknown> = {}) => useQuery({ queryKey: ['runs', params], queryFn: () => api.agents.runs(params) });
export const useRun = (id: string | undefined, opts: Partial<UseQueryOptions<T.AgentRun>> = {}) => useQuery({ queryKey: ['run', id], queryFn: () => api.agents.run(id!), enabled: Boolean(id), ...opts });
export const useMcpTools = (sessionId?: string) => useQuery({ queryKey: ['mcp-tools', sessionId], queryFn: () => api.agents.mcpTools(sessionId) });

export const useOverview = () => useQuery({ queryKey: ['overview'], queryFn: api.insights.overview });
export const useEvaluation = () => useQuery({ queryKey: ['evaluation'], queryFn: api.insights.evaluation });

/* ---------------------------------------------------------------- mutations */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/** Generic mutation helper: toasts errors, invalidates keys on success. */
export function useAction<TArgs extends any[], TResult>(fn: (...args: TArgs) => Promise<TResult>, opts: { invalidate?: string[]; success?: string | ((r: TResult) => string); onSuccess?: (r: TResult) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (r) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: [k] });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}

export const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries();
