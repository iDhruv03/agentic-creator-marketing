import { createRun, updateRun, appendRunEvent, getRun, clearCancel, cancelRun as markCancelled, type AgentRun, type RunMode } from './runs';
import { AgentToolkit } from './toolkit';
import { runSimulatedAgent } from './simulator';
import { runClaudeAgent, llmAvailable, DEFAULT_MODEL } from './runner';
import { requireSession } from '../core/governance';
import { CoreError } from '../core/ids';
import { appendAudit } from '../core/audit';
import { notifyCampaignOwners } from '../core/notifications';

const active = new Map<string, Promise<void>>();

export interface StartRunInput {
  session_id: string;
  campaign_id?: string | null;
  goal?: string;
  mode?: RunMode | 'AUTO';
  model?: string;
  started_by?: string;
}

export function resolveMode(requested: StartRunInput['mode']): RunMode {
  if (requested === 'SIMULATED') return 'SIMULATED';
  if (requested === 'LLM') {
    if (!llmAvailable()) throw new CoreError('No Anthropic credentials configured (set ANTHROPIC_API_KEY). Use SIMULATED mode or configure a key.', 400, 'NO_LLM');
    return 'LLM';
  }
  return llmAvailable() ? 'LLM' : 'SIMULATED';
}

export function startRun(input: StartRunInput): AgentRun {
  const session = requireSession(input.session_id);
  if (session.status !== 'ACTIVE') throw new CoreError(`Session is ${session.status}; resume it before starting a run.`, 409, 'SESSION_INACTIVE');
  const campaignId = input.campaign_id ?? session.campaign_id ?? null;
  const goal = input.goal?.trim() || (campaignId ? 'Run this campaign end to end: discover and shortlist creators, refine the brief, and send offers within policy.' : 'Discover and shortlist the best creators for the brand.');
  const mode = resolveMode(input.mode);
  if (mode === 'SIMULATED' && !campaignId) throw new CoreError('The simulated planner needs a campaign to work on. Pick a campaign or bind the session to one.', 400, 'CAMPAIGN_REQUIRED');
  const model = mode === 'LLM' ? (input.model || session.model || DEFAULT_MODEL) : null;

  const run = createRun({ session_id: session.id, campaign_id: campaignId, goal, mode, model });
  appendRunEvent(run.id, 'status', { text: `Run started in ${mode === 'LLM' ? `LLM mode (${model})` : 'simulated planner mode'} · session ${session.name}` });
  appendAudit({ actor_type: 'HUMAN', actor_id: input.started_by ?? 'operator', session_id: session.id, run_id: run.id, campaign_id: campaignId, tool_name: 'start_agent_run', parameters: { goal, mode, model }, execution_status: 'SUCCESS', result_summary: `Agent run ${run.id} started (${mode}).` });

  const task = (async () => {
    const kit = new AgentToolkit(run.id, session);
    try {
      const summary = mode === 'LLM'
        ? await runClaudeAgent(kit, campaignId, goal, model!)
        : await runSimulatedAgent(kit, campaignId ?? '', goal);
      const status = kit.cancelled ? 'CANCELLED' : 'COMPLETED';
      updateRun(run.id, { status, summary, steps_count: kit.steps, checkpoints_count: kit.checkpoints, blocked_count: kit.blocked, spend_committed: kit.spend });
      appendRunEvent(run.id, 'done', { status, summary, steps: kit.steps, checkpoints: kit.checkpoints, blocked: kit.blocked, spend: kit.spend });
      if (campaignId) notifyCampaignOwners(campaignId, { kind: 'AGENT', title: `Agent run ${status.toLowerCase()}`, body: summary.slice(0, 160), link: `/agents/runs/${run.id}` });
    } catch (err: any) {
      const message = err?.message ?? 'Agent run failed';
      updateRun(run.id, { status: 'FAILED', summary: message, steps_count: kit.steps, checkpoints_count: kit.checkpoints, blocked_count: kit.blocked, spend_committed: kit.spend });
      appendRunEvent(run.id, 'error', { message });
      appendRunEvent(run.id, 'done', { status: 'FAILED', summary: message, steps: kit.steps });
    } finally {
      clearCancel(run.id);
      active.delete(run.id);
    }
  })();
  active.set(run.id, task);
  return run;
}

export async function waitForRun(runId: string): Promise<AgentRun> {
  const p = active.get(runId);
  if (p) await p;
  return getRun(runId, true);
}

export function cancelRun(runId: string): AgentRun {
  const run = getRun(runId);
  if (run.status !== 'RUNNING') throw new CoreError(`Run is ${run.status}.`, 409, 'NOT_RUNNING');
  markCancelled(runId);
  appendRunEvent(runId, 'status', { text: 'Cancellation requested; stopping after the current step.' });
  return run;
}

export function runtimeInfo() {
  return { llm_available: llmAvailable(), default_model: DEFAULT_MODEL, default_mode: llmAvailable() ? 'LLM' : 'SIMULATED', active_runs: active.size };
}
