import Anthropic from '@anthropic-ai/sdk';
import { AgentToolkit } from './toolkit';
import { TOOLS, zodToJsonSchema } from '../mcp/tools';
import { getCampaign } from '../core/campaigns';
import { updateRun } from './runs';

/**
 * Claude-driven agent loop (paper §5.3 / §7.3).
 *
 * The model sees only the tools its session is scoped to; every call is
 * executed through the governed MCP executor, and HELD / REJECTED outcomes
 * are returned to the model as tool errors so it can plan around them
 * instead of assuming success.
 */
export const DEFAULT_MODEL = 'claude-opus-5-5';

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function buildSystemPrompt(kit: AgentToolkit, campaignId: string | null): string {
  const s = kit.session;
  const campaign = campaignId ? getCampaign(campaignId) : null;
  return [
    'You are an autonomous AI marketing agent operating the Creator Marketing Infrastructure (CMI) on behalf of a brand. You run creator campaigns end to end: discovery, shortlisting, brief refinement, offers and negotiation, deliverable tracking, compliance review and payment release.',
    '',
    `## Your session`,
    `- Name: ${s.name} (${s.id})`,
    `- Scope: ${s.role_scope}. Tools available: ${s.allowed_tools.join(', ')}`,
    `- Hard budget ceiling for this session: $${s.budget_ceiling.toLocaleString()} (already committed: $${s.spent_amount.toLocaleString()})`,
    `- Per-collaboration rate ceiling: $${s.rate_ceiling.toLocaleString()} — offers above this are held for human approval, not executed.`,
    `- Payouts above $${Number(process.env.CMI_PAYMENT_THRESHOLD ?? 1000).toLocaleString()} are held for human approval.`,
    s.instructions ? `- Operator instructions: ${s.instructions}` : '',
    '',
    campaign ? `## Campaign\n- ${campaign.title} (${campaign.id}) for ${campaign.brand_name}, status ${campaign.status}\n- Budget $${campaign.budget.toLocaleString()} · available $${campaign.financials.available.toLocaleString()} · escrow $${campaign.financials.escrow_locked.toLocaleString()}\n- Target niches: ${campaign.target_niches.join(', ') || 'unspecified'} · platforms: ${campaign.target_platforms.join(', ') || 'any'}\n- Rate band: ${campaign.rate_band_min != null ? '$' + campaign.rate_band_min : '—'} to ${campaign.rate_band_max != null ? '$' + campaign.rate_band_max : '—'}` : '',
    '',
    '## How to work',
    '- Start with get_campaign_status. Never send an offer to a creator who already has an open collaboration on the campaign.',
    '- Shortlist with concrete rationale before offering. Use get_rate_benchmark to justify rates.',
    '- Stay inside the rate band and your ceilings. If the best creator is above the ceiling, you may still send the offer: governance will park it for a human, which is the correct outcome — say so and move on.',
    '- A tool result with status HELD_FOR_APPROVAL means the action did NOT happen yet. REJECTED_BY_GUARDRAIL means it will not happen; do not retry the same call with cosmetic changes.',
    '- Use request_human_approval for genuinely ambiguous decisions instead of guessing.',
    '- Before releasing payment, the deliverable must be tracked and approved and compliance must pass.',
    '- Be concise in prose. Finish with a short summary: what you did, what is pending human approval, and what you recommend next.',
  ].filter((l) => l !== undefined).join('\n');
}

export async function runClaudeAgent(kit: AgentToolkit, campaignId: string | null, goal: string, model = DEFAULT_MODEL): Promise<string> {
  const client = new Anthropic();
  const allowed = new Set(kit.session.allowed_tools);
  const tools: Anthropic.Tool[] = TOOLS.filter((t) => allowed.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: zodToJsonSchema(t.schema) as Anthropic.Tool.InputSchema,
  }));

  const system = buildSystemPrompt(kit, campaignId);
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `${goal}${campaignId ? `\n\nCampaign id: ${campaignId}` : ''}` },
  ];

  let inputTokens = 0;
  let outputTokens = 0;
  let finalText = '';
  const maxTurns = Number(process.env.CMI_AGENT_MAX_TURNS ?? 24);

  for (let turn = 0; turn < maxTurns; turn++) {
    if (kit.cancelled) return 'Run cancelled by operator.';
    kit.status(turn === 0 ? 'Model is planning…' : `Model turn ${turn + 1}`);

    const stream = client.messages.stream({
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'medium' },
      tools,
      messages,
    });

    let textBuffer = '';
    stream.on('text', (delta) => { textBuffer += delta; });

    let message: Anthropic.Message;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIError) throw new Error(`Claude API error ${err.status}: ${err.message}`);
      throw err;
    }
    inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    outputTokens += message.usage.output_tokens;
    updateRun(kit.runId, { input_tokens: inputTokens, output_tokens: outputTokens });

    for (const block of message.content) {
      if (block.type === 'thinking' && block.thinking?.trim()) kit.think(block.thinking.trim());
      else if (block.type === 'text' && block.text.trim()) { kit.say(block.text.trim()); finalText = block.text.trim(); }
    }

    if (message.stop_reason === 'refusal') {
      kit.say('The model declined to continue this task.');
      break;
    }
    if (message.stop_reason === 'max_tokens') {
      kit.say('Output limit reached; stopping this run before any truncated tool call executes.');
      break;
    }

    const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (message.stop_reason !== 'tool_use' || toolUses.length === 0) break;

    messages.push({ role: 'assistant', content: message.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (kit.cancelled) return 'Run cancelled by operator.';
      const res = await kit.call(tu.name, (tu.input ?? {}) as Record<string, unknown>, tu.id);
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: AgentToolkit.resultText(res), is_error: res.status === 'REJECTED_BY_GUARDRAIL' || res.status === 'FAILED' });
    }
    messages.push({ role: 'user', content: results });
  }

  return finalText || `Completed ${kit.steps} governed tool calls (${kit.checkpoints} held for approval, ${kit.blocked} blocked).`;
}
