import { mcpServerInstance } from '../mcp/server';
import { queryOne } from '../db/database';

export interface AgentStepEvent {
  step: number;
  thought: string;
  tool_name: string;
  tool_arguments: any;
  result: any;
  status: 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';
  guardrail_notes?: string;
  duration_ms: number;
}

export interface AgentRunSummary {
  session_id: string;
  campaign_id: string;
  steps: AgentStepEvent[];
  completed: boolean;
  message: string;
  checkpoints_triggered: number;
  total_spend_allocated: number;
}

export class AgentOrchestrator {
  /**
   * Executes a full autonomous creator campaign workflow using the MCP server.
   * Can accept a callback onStep to stream live events to the frontend.
   */
  public static async runAutonomousCampaign(
    sessionId: string,
    campaignId: string,
    goalPrompt: string,
    onStep?: (event: AgentStepEvent) => void
  ): Promise<AgentRunSummary> {
    const steps: AgentStepEvent[] = [];
    let checkpointsTriggered = 0;
    let totalSpendAllocated = 0;

    const campaign = queryOne<any>(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
    const campaignTitle = campaign?.title || 'Target Campaign';

    // Step 1: Inspect campaign status
    {
      const stepNum = 1;
      const thought = `I need to first inspect the campaign '${campaignTitle}' (${campaignId}) to check available budget, existing collaborations, and brief guidelines before taking any action.`;
      const toolName = 'get_campaign_status';
      const args = { campaign_id: campaignId };

      const execResult = await mcpServerInstance.callTool(sessionId, toolName, args);
      const stepEvent: AgentStepEvent = {
        step: stepNum,
        thought,
        tool_name: toolName,
        tool_arguments: args,
        result: execResult.result || execResult.error,
        status: execResult.status,
        guardrail_notes: execResult.guardrail_notes,
        duration_ms: execResult.duration_ms,
      };
      steps.push(stepEvent);
      if (onStep) onStep(stepEvent);
    }

    // Step 2: Search creators based on campaign niche
    let shortlistedCreators: any[] = [];
    {
      const stepNum = 2;
      const targetNiche = 'Tech & Gadgets';
      const thought = `Based on campaign objectives for '${campaignTitle}', I will search the creator marketplace for verified creators in '${targetNiche}' with engagement rates > 3.5% and rates under $2,000.`;
      const toolName = 'search_creators';
      const args = {
        niche: targetNiche,
        min_followers: 100000,
        min_engagement: 3.5,
        max_rate: 2000,
      };

      const execResult = await mcpServerInstance.callTool(sessionId, toolName, args);
      shortlistedCreators = execResult.result?.creators || [];
      const stepEvent: AgentStepEvent = {
        step: stepNum,
        thought,
        tool_name: toolName,
        tool_arguments: args,
        result: execResult.result || execResult.error,
        status: execResult.status,
        guardrail_notes: execResult.guardrail_notes,
        duration_ms: execResult.duration_ms,
      };
      steps.push(stepEvent);
      if (onStep) onStep(stepEvent);
    }

    // Step 3: Refine campaign brief with explicit deliverables
    {
      const stepNum = 3;
      const thought = `To ensure high creator response and brand alignment, I will formulate a structured brief with key talking points, required deliverables (1x YouTube Video + 1x Reel), and discount code specifications.`;
      const toolName = 'draft_campaign_brief';
      const args = {
        campaign_id: campaignId,
        brief: `High-impact creator launch for ${campaignTitle}. Deliverables must showcase active noise cancellation, 38-hour battery longevity, and include discount code in first 3 lines of caption.`,
        objectives: 'Maximize organic conversions and drive 4.5%+ engagement rate across tech enthusiasts.',
        target_audience: 'Aged 18-35 tech buyers, commuters, audiophiles.',
        required_deliverables: ['1x YouTube Video Review', '1x Instagram Reel'],
      };

      const execResult = await mcpServerInstance.callTool(sessionId, toolName, args);
      const stepEvent: AgentStepEvent = {
        step: stepNum,
        thought,
        tool_name: toolName,
        tool_arguments: args,
        result: execResult.result || execResult.error,
        status: execResult.status,
        guardrail_notes: execResult.guardrail_notes,
        duration_ms: execResult.duration_ms,
      };
      steps.push(stepEvent);
      if (onStep) onStep(stepEvent);
    }

    // Step 4: Dispatch collaboration offer to top creator
    const topCreator = shortlistedCreators[0] || { id: 'cr_marcus', handle: 'marcus_tech', rate_video: 1800 };
    {
      const stepNum = 4;
      const proposedRate = topCreator.rate_video || 1800;
      const thought = `Top candidate is @${topCreator.handle} with ${topCreator.follower_count || '420k'} followers and strong engagement. I will dispatch an official collaboration offer of $${proposedRate} with escrow hold.`;
      const toolName = 'send_collaboration_offer';
      const args = {
        campaign_id: campaignId,
        creator_id: topCreator.id,
        proposed_rate: proposedRate,
        deliverables: ['YOUTUBE_VIDEO', 'REEL'],
        deadline: '2026-11-05',
        terms: 'Exclusive tech category sponsor for 30 days. Includes custom tracking link.',
      };

      const execResult = await mcpServerInstance.callTool(sessionId, toolName, args);
      if (execResult.status === 'HELD_FOR_APPROVAL') {
        checkpointsTriggered++;
      } else if (execResult.status === 'SUCCESS') {
        totalSpendAllocated += proposedRate;
      }

      const stepEvent: AgentStepEvent = {
        step: stepNum,
        thought,
        tool_name: toolName,
        tool_arguments: args,
        result: execResult.result || execResult.error,
        status: execResult.status,
        guardrail_notes: execResult.guardrail_notes,
        duration_ms: execResult.duration_ms,
      };
      steps.push(stepEvent);
      if (onStep) onStep(stepEvent);
    }

    // Step 5: Test High-Impact Guardrail - Trigger payment checkpoint
    {
      const stepNum = 5;
      const payoutAmount = 1800;
      const thought = `I will now invoke release_payment() for deliverable 'deliv_marcus_yt' ($${payoutAmount}). Because this amount exceeds the $1,000 autonomous release threshold, system governance will route this to a human-approval checkpoint on the dashboard.`;
      const toolName = 'release_payment';
      const args = {
        collaboration_id: 'collab_marcus_techpulse',
        deliverable_id: 'deliv_marcus_yt',
        amount: payoutAmount,
        note: 'Autonomous release request following verified video metrics.',
      };

      const execResult = await mcpServerInstance.callTool(sessionId, toolName, args);
      if (execResult.status === 'HELD_FOR_APPROVAL') {
        checkpointsTriggered++;
      }

      const stepEvent: AgentStepEvent = {
        step: stepNum,
        thought,
        tool_name: toolName,
        tool_arguments: args,
        result: execResult.result || execResult.error,
        status: execResult.status,
        guardrail_notes: execResult.guardrail_notes,
        duration_ms: execResult.duration_ms,
      };
      steps.push(stepEvent);
      if (onStep) onStep(stepEvent);
    }

    return {
      session_id: sessionId,
      campaign_id: campaignId,
      steps,
      completed: true,
      message: `Autonomous campaign orchestration completed. Executed ${steps.length} MCP tool steps with ${checkpointsTriggered} action(s) held at human-approval checkpoints.`,
      checkpoints_triggered: checkpointsTriggered,
      total_spend_allocated: totalSpendAllocated,
    };
  }
}
