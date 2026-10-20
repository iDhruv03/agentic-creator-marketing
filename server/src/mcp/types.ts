export interface AgentSession {
  id: string;
  name: string;
  campaign_id?: string;
  role_scope: 'DISCOVERY_ONLY' | 'CAMPAIGN_MANAGER' | 'FULL_OPERATOR';
  allowed_tools: string[]; // parsed from JSON array
  budget_ceiling: number;
  rate_ceiling: number;
  spent_amount: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  created_at: string;
}

export interface GuardrailDecision {
  allowed: boolean;
  requires_checkpoint: boolean;
  checkpoint_id?: string;
  reason?: string;
  guardrail_notes?: string;
}

export interface ToolExecutionResult {
  status: 'SUCCESS' | 'REJECTED_BY_GUARDRAIL' | 'HELD_FOR_APPROVAL' | 'FAILED';
  result?: any;
  error?: string;
  checkpoint?: any;
  audit_id: string;
  duration_ms: number;
  guardrail_notes?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}
