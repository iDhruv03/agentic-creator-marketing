# CMI Governed MCP Server — Specification

Implements the Model Context Protocol (spec revision `2025-06-18`) with the official `@modelcontextprotocol/sdk`. Server info: `cmi-governed-mcp-server` v2.0.0. Capabilities: `tools`, `resources`, `prompts`.

## Transports

| Transport | Entry point | Session binding |
|---|---|---|
| stdio | `npm run mcp:stdio` (`server/src/mcp/stdio.ts`) | `CMI_SESSION_ID` env var |
| Streamable HTTP | `POST http://localhost:3001/mcp` (`server/src/mcp/http.ts`, stateless) | `X-CMI-Session` header or `?session=` |
| In-process | `server/src/agent/runner.ts` (Claude) / `simulator.ts` | run's session |
| REST playground | `POST /api/agents/mcp/call` | `session_id` in body |

All transports resolve to one executor, `CmiMcpServer.callTool`, so governance is identical regardless of how a call arrives.

### Claude Desktop / Cursor configuration

```json
{
  "mcpServers": {
    "cmi-creator-marketing": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/agentic-creator-marketing/server/src/mcp/stdio.ts"],
      "env": { "CMI_SESSION_ID": "sess_techpulse_operator" }
    }
  }
}
```

### Streamable HTTP example

```bash
curl -s -X POST http://localhost:3001/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -H 'x-cmi-session: sess_techpulse_operator' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_creators","arguments":{"campaign_id":"camp_techpulse_earbuds","niche":"Tech & Gadgets","limit":5}}}'
```

## Session model

A tool call is only possible under an `agent_session` authorised by a human:

| Field | Meaning |
|---|---|
| `role_scope` | `DISCOVERY_ONLY` · `CAMPAIGN_MANAGER` · `FULL_OPERATOR` — determines the maximum tool set |
| `allowed_tools` | Explicit allow-list (subset of the scope) |
| `budget_ceiling` | Hard cap on spend the session may commit (offers). Breach → `REJECTED_BY_GUARDRAIL` |
| `rate_ceiling` | Per-collaboration cap. Breach → `HELD_FOR_APPROVAL` checkpoint |
| `campaign_id` | Optional binding; calls naming another campaign are rejected |
| `status` | `ACTIVE` · `PAUSED` · `REVOKED` · `COMPLETED` — only `ACTIVE` sessions can call tools |

`tools/list` returns only the tools the bound session may call.

## Tool registry

| Tool | Category | Risk | Governance |
|---|---|---|---|
| `search_creators` | discovery | read | scope |
| `get_creator_profile` | discovery | read | scope |
| `get_rate_benchmark` | insight | read | scope |
| `get_campaign_status` | campaign | read | scope, campaign binding |
| `get_campaign_analytics` | insight | read | scope |
| `add_to_shortlist` | campaign | write | scope |
| `draft_campaign_brief` | campaign | write | scope; **checkpoint** `BRIEF_MODIFICATION` once any creator has accepted |
| `send_collaboration_offer` | contracts | financial | scope; **block** on budget ceiling; **checkpoint** `OUT_OF_BAND_RATE` above rate ceiling; escrow hold on success |
| `respond_to_counter_offer` | contracts | financial | same as offers when accepting/countering |
| `track_deliverable` | delivery | write | scope; runs compliance checks |
| `check_compliance` | delivery | read | scope |
| `review_deliverable` | delivery | write | scope |
| `release_payment` | payments | high_impact | scope; **checkpoint** `PAYMENT_ABOVE_THRESHOLD` above `CMI_PAYMENT_THRESHOLD` (default $1,000) or when amount omitted |
| `list_audit_logs` | governance | read | scope |
| `request_human_approval` | governance | write | always creates an `AGENT_ESCALATION` checkpoint |

Scope → tools:

- **DISCOVERY_ONLY**: search_creators, get_creator_profile, get_rate_benchmark, get_campaign_status, add_to_shortlist, list_audit_logs, request_human_approval
- **CAMPAIGN_MANAGER**: + get_campaign_analytics, draft_campaign_brief, send_collaboration_offer, respond_to_counter_offer, track_deliverable, check_compliance, review_deliverable
- **FULL_OPERATOR**: + release_payment

Input schemas are defined with zod in `server/src/mcp/tools.ts` and exported as JSON Schema (`GET /api/agents/mcp/tools`).

## Result envelope

Every call returns (as the text content of the MCP result, and directly from the REST playground):

```json
{
  "status": "SUCCESS | HELD_FOR_APPROVAL | REJECTED_BY_GUARDRAIL | FAILED",
  "result": { "...tool specific..." },
  "error": "human-readable reason when not SUCCESS",
  "checkpoint_id": "chk_… (when HELD_FOR_APPROVAL)",
  "audit_id": "aud_…",
  "duration_ms": 12,
  "guardrail_notes": "Passed 5 governance rules (…)",
  "rules_evaluated": ["session_status", "permission_scope", "campaign_binding", "budget_ceiling", "rate_ceiling"]
}
```

`isError` is set on the MCP result for `REJECTED_BY_GUARDRAIL` and `FAILED`. `HELD_FOR_APPROVAL` is **not** an error: the call was accepted but has not executed; the model is told to continue with other work and never assume approval.

## Resources & prompts

- `cmi://campaigns` — campaign index visible to the session (JSON)
- `cmi://campaigns/{campaignId}/brief` — the brief as Markdown
- `cmi://audit/session` — last 50 audit entries for the session
- prompt `launch-campaign(campaign_id)` — an end-to-end campaign launch instruction

## Checkpoint resolution

`POST /api/checkpoints/:id/resolve { decision: APPROVED | REJECTED, notes }` (dashboard). On approval the core executes the held tool with the reviewer as the actor and stores `executed_result`; on rejection nothing changes. Both outcomes are appended to the audit trail as `resolve_checkpoint`.

## Audit record

```
seq · id · timestamp · actor_type (HUMAN|AGENT|SYSTEM) · actor_id · actor_name · session_id · run_id · campaign_id
tool_name · parameters_json · execution_status · result_summary · guardrail_notes · duration_ms · prev_hash · hash
```

`hash = sha256(prev_hash | canonical_json(row fields))`. Verify with `GET /api/audit/verify`.
