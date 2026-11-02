# CMI — System Architecture

This document maps the research paper's five-layer architecture (§5.4) onto the code in this repository.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1 · Actors        Brands · Agencies · Creators · AI marketing agents   │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ Layer 2 · Dual interface     │                                              │
│  Web dashboard (React)       │  Governed MCP server                         │
│  client/src/pages/*          │  server/src/mcp/{protocol,stdio,http}.ts     │
│  REST: server/src/routes/*   │  Executor: server/src/mcp/server.ts          │
├──────────────────────────────┴──────────────────────────────────────────────┤
│ Layer 3 · Infrastructure Core (the only layer that writes to the store)     │
│  campaigns.ts   marketplace.ts   collaborations.ts   payments.ts            │
│  governance.ts  ledger.ts        analytics.ts        evaluation.ts          │
│  audit.ts       notifications.ts                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Layer 4 · Shared data layer  SQLite (node:sqlite) · server/src/db/schema.sql │
│  creators · campaigns · campaign_shortlist · collaborations · deliverables   │
│  negotiation_messages · ledger_entries (double-entry) · agent_sessions       │
│  agent_runs · agent_run_events · approval_checkpoints · audit_logs (hash     │
│  chained, append-only) · notifications · evaluation_runs · users             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Layer 5 · External         Anthropic Claude (agent runtime) · social/payment │
│                            integrations are simulated at the core boundary   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design rules

1. **One core, two interfaces.** `routes/*` (humans) and `mcp/*` (agents) both call the same functions in `core/*`. There is no code path where an agent writes to the database without going through the core, and no human-only shortcut either. This is what keeps the dashboard and the agent's view of a campaign from drifting (paper §5.1).
2. **Governance wraps every agent call.** `mcp/server.ts#callTool` is the single executor: it validates input (zod), evaluates guardrails (`core/governance.ts#evaluateGuardrails`), either executes, blocks, or parks the call at a checkpoint, and always appends to the audit log. The stdio transport, the Streamable HTTP transport, the REST playground and the in-process Claude runner all route through it.
3. **Money is double-entry.** `core/ledger.ts` posts every movement as a debit/credit pair between named accounts (`brand:*:budget`, `campaign:*:available`, `campaign:*:escrow`, `creator:*:wallet`). Campaign financials (available / escrow / spent) are *derived* from the ledger, never stored. `trialBalance()` proves the books balance.
4. **The audit log is immutable.** `core/audit.ts` hash-chains each row to the previous one (SHA-256 over canonical JSON + prev hash); SQLite triggers reject UPDATE/DELETE. `verifyAuditChain()` re-derives every hash.
5. **Agents are sessions, not users.** An `agent_session` carries a role scope (tool allow-list), a hard budget ceiling, a per-collaboration rate ceiling and an optional campaign binding. A human authorises it; the agent can never widen it.

## Request lifecycle for an agent tool call

```
MCP client ──tools/call──▶ protocol.ts ──▶ CmiMcpServer.callTool(sessionId, tool, args)
                                              │
                                              ├─ resolve session (unknown → REJECTED + audit)
                                              ├─ zod validation (invalid → FAILED + audit)
                                              ├─ evaluateGuardrails()
                                              │     session status · permission scope · campaign binding
                                              │     budget ceiling (hard block) · rate ceiling (checkpoint)
                                              │     payment threshold (checkpoint) · post-acceptance brief lock
                                              ├─ requires_checkpoint → approval_checkpoints row, notify owners,
                                              │     audit HELD_FOR_APPROVAL, return checkpoint id
                                              ├─ !allowed → audit REJECTED_BY_GUARDRAIL, return error
                                              └─ execute handler inside a transaction → audit SUCCESS/FAILED
```

When a reviewer approves a checkpoint (`CmiMcpServer.resolveCheckpoint`), the held action is executed by the core **with the reviewer as actor**; the agent session never gains the permission. Both the decision and the execution are audited.

## Agent runtime

`server/src/agent/`:

| File | Role |
|---|---|
| `runner.ts` | Claude loop (`@anthropic-ai/sdk`, `claude-opus-5-5`, adaptive thinking, streaming). Tools are the session-scoped MCP tool definitions; every `tool_use` goes through `AgentToolkit.call` → `callTool`. HELD / REJECTED results are returned to the model as errors so it plans around them. |
| `simulator.ts` | Deterministic planner used when no Anthropic credentials are present. Reads real campaign data, follows the same discover → shortlist → brief → offer → track → pay arc, and deliberately exercises the checkpoint and block paths. |
| `toolkit.ts` | Shared wrapper that records run events, counters and cancellation. |
| `runs.ts` | Persistence of runs + ordered events, in-process pub/sub for SSE tailing. |
| `service.ts` | Starts runs asynchronously, picks LLM vs simulated mode, finalises status. |

Run events are streamed to the dashboard at `GET /api/agents/runs/:id/stream` (replay + live tail) and platform-wide changes at `GET /api/events`.

## Evaluation lab

`core/evaluation.ts` implements the paper's §10 methodology: each scenario creates a sandbox campaign and a scoped session, runs the agent against the live governed server, and records *measured* time-to-launch (first successful offer), human oversight minutes (checkpoints cleared + shortlist review) and matching accuracy (shortlisted creators clearing the approval bar), next to a modelled manual baseline (sequential profile review, hand-written brief, DM negotiation).

## Front end

`client/` is a Vite + React 18 + TypeScript app. Data access is centralised in `src/lib/api.ts` and `src/hooks/queries.ts` (TanStack Query); `src/lib/realtime.ts` subscribes to the SSE feed and invalidates affected queries so every screen is live. The design system lives in `src/components/ui/*` with CSS-variable tokens (`src/index.css`) for light and dark themes. Role-based routing (`src/App.tsx`) serves brand/agency operators and creators from the same build.
