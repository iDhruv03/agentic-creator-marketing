# CMI REST API

Base URL `http://localhost:3001/api`. All endpoints except `/auth/login` and `/auth/personas` require `Authorization: Bearer <token>`. Errors are `{ error, code, details? }` with an appropriate HTTP status. Role column: **B** brand, **A** agency, **C** creator; ADMIN can do everything.

## Auth
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/login` | – | `{ email, password }` → `{ token, user }` |
| GET | `/auth/personas` | – | demo users for the login screen |
| GET | `/auth/me` | any | `{ user, org, unread_notifications }` |

## Organisations
| GET | `/brands` | B A C | brands in scope with budget totals |
| GET | `/brands/:id` | any | brand + campaigns |
| GET | `/agencies` | A B | agency with `clients[]` (budget, spent, escrow, pending checkpoints) |

## Creators
| GET | `/creators` | any | query: `q, niche, platform, min_followers, max_followers, min_engagement, max_rate, rate_type, country, verified, sort, limit, campaign_id` (adds `match_score`, `match_breakdown`, `match_reasons`) |
| GET | `/creators/niches` | any | niche list |
| GET | `/creators/benchmark` | any | `follower_count, deliverable, niche?` → p25/median/p75 |
| GET | `/creators/:id` | any | media kit + collaborations + analytics |
| GET | `/creators/me/wallet` | C | balance, pending escrow, lifetime, ledger, analytics |
| PATCH | `/creators/me/profile` | C | editable media-kit fields |

## Campaigns
| GET | `/campaigns` | B A | query `status, brand_id` (scoped to the caller) |
| POST | `/campaigns` | B A | create (budget is allocated in the ledger) |
| GET | `/campaigns/:id` | any | + shortlist, collaborations, checkpoints, sessions, runs |
| PATCH | `/campaigns/:id` | B A | update brief / budget (ledger adjustment) |
| POST | `/campaigns/:id/status` | B A | `{ status }` with enforced transitions |
| GET | `/campaigns/:id/analytics` | any | reach, cost, funnel, by creator/platform, timeline |
| GET | `/campaigns/:id/ledger` | B A | ledger entries |
| GET | `/campaigns/:id/audit` | B A | audit entries |
| GET/POST | `/campaigns/:id/shortlist` | B A | list / add `{ creator_id, rationale }` |
| POST | `/campaigns/:id/shortlist/:entryId/review` | B A | `{ status: APPROVED | REJECTED }` |
| DELETE | `/campaigns/:id/shortlist/:entryId` | B A | remove |

## Collaborations
| GET | `/collaborations` | any | scoped; query `status, campaign_id` |
| POST | `/collaborations` | B A | send offer (escrow hold) |
| GET | `/collaborations/:id` | any | + messages + deliverables |
| POST | `/collaborations/:id/counter` | any | `{ amount, message }` (escrow re-balanced) |
| POST | `/collaborations/:id/accept` | any | |
| POST | `/collaborations/:id/decline` | any | creator → DECLINED, brand → CANCELLED; escrow refunded |
| POST | `/collaborations/:id/start` | C | ACCEPTED → IN_PROGRESS |
| POST | `/collaborations/:id/messages` | any | `{ body }` |
| POST | `/collaborations/:id/compliance-preview` | any | dry-run compliance check |
| POST | `/collaborations/:id/deliverables/:dId/submit` | any | `{ content_url, caption }` → compliance + metrics |
| POST | `/collaborations/:id/deliverables/:dId/review` | B A | `{ decision: APPROVED | CHANGES_REQUESTED, notes }` |
| POST | `/collaborations/:id/release-payment` | B A | `{ deliverable_id?, amount?, note? }` escrow → wallet |

## Governance
| GET | `/checkpoints` | B A | query `status, campaign_id, session_id` |
| GET | `/checkpoints/:id` | B A | with `context` (creator / deliverable) |
| POST | `/checkpoints/:id/resolve` | B A | `{ decision, notes }` — approval executes the held action |
| GET | `/ledger` | any | query `campaign_id, collaboration_id, entry_type, limit` |
| GET | `/ledger/trial-balance` | B A | accounts + balanced flag |
| GET | `/audit` | any | query `q, actor_type, status, tool_name, campaign_id, session_id, run_id, limit, offset` → `{ items, total }` |
| GET | `/audit/verify` | any | hash-chain verification + stats |
| GET | `/notifications` | any | `{ items, unread }` |
| POST | `/notifications/read` | any | `{ ids? }` |

## Agents & MCP
| GET | `/agents/scopes` | any | scope → tools, payment threshold, runtime info |
| GET/POST | `/agents/sessions` | B A | list / authorise a session |
| GET/PATCH | `/agents/sessions/:id` | B A | detail (+runs) / update policy |
| POST | `/agents/sessions/:id/status` | B A | `{ status }` pause / resume / revoke |
| GET | `/agents/runs` | B A | query `session_id, campaign_id` |
| POST | `/agents/runs` | B A | `{ session_id, campaign_id?, goal?, mode?: AUTO | LLM | SIMULATED, model? }` → 202 run |
| GET | `/agents/runs/:id` | B A | run + events |
| GET | `/agents/runs/:id/stream` | B A | SSE: replay then live (`Last-Event-ID` supported) |
| POST | `/agents/runs/:id/cancel` | B A | |
| GET | `/agents/mcp/tools` | any | protocol, transports, tool definitions (session-filtered with `session_id`) |
| POST | `/agents/mcp/call` | B A | `{ session_id, tool_name, params }` → governed result envelope |

## Insights
| GET | `/insights/overview` | B A | dashboard totals, campaigns, activity, pipeline |
| GET | `/insights/evaluation` | any | manual vs agentic summary, scenarios, runs |
| POST | `/insights/evaluation/run` | B A | `{ scenario, mode? }` runs a matched scenario live |

## Realtime
`GET /api/events` (SSE) publishes `campaign.updated`, `shortlist.updated`, `collaboration.updated`, `deliverable.updated`, `checkpoint.created`, `checkpoint.resolved`, `ledger.posted`, `audit.appended`, `notification.created`, `agent.run`, `session.updated`, `evaluation.recorded`.

`GET /health` reports version, MCP protocol and agent runtime mode.
