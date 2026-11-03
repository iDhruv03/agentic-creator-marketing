<div align="center">

# CMI — Agentic Creator Marketing Infrastructure

**A governed, MCP-enabled platform for brands, agencies, creators, and autonomous AI marketing agents.**

[![CI](https://github.com/iDhruv03/agentic-creator-marketing/actions/workflows/ci.yml/badge.svg)](https://github.com/iDhruv03/agentic-creator-marketing/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6366f1.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-2025--06--18-14b8a6.svg)](https://modelcontextprotocol.io/)
[![Node](https://img.shields.io/badge/Node.js-22.x-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)

Reference implementation of the paper *“Agentic Creator Marketing Infrastructure: An MCP-Enabled Platform for Brands, Agencies, Creators, and Autonomous AI Marketing Agents”* ([PDF](docs/Creator%20Marketing%20Infrastructure%20for%20the%20AI%20Era%20—%20Research%20Paper.pdf)).

</div>

---

## What it is

Creator-marketing software today is built for humans only. CMI rebuilds the category around **one shared core with two interfaces**:

- a **web dashboard** for brands, agencies and creators (campaigns, discovery, negotiation, content review, escrow payouts), and
- a **governed MCP server** through which AI agents operate the *same* core — search creators, draft briefs, send offers, track deliverables and release payments — inside budget ceilings, permission scopes and human-approval checkpoints, with every call written to an immutable audit trail.

Anything an agent does is immediately visible, reviewable and reversible from the dashboard, and vice-versa.

## Highlights

| Area | What you get |
|---|---|
| **Governance engine** | Per-session budget ceiling (hard block), per-collaboration rate ceiling (checkpoint), permission scopes (`DISCOVERY_ONLY` / `CAMPAIGN_MANAGER` / `FULL_OPERATOR`), campaign binding, payment threshold checkpoints, post-acceptance brief lock. Approving a checkpoint executes the held action on the reviewer's authority. |
| **MCP server** | 15 tools, 3 resources, 1 prompt over **stdio** (Claude Desktop / Cursor) and **Streamable HTTP**, built on the official SDK. The tool list is filtered to the session's scope. |
| **Agent runtime** | Claude (`claude-opus-5-5`, adaptive thinking, streaming tool use) plans and executes runs through the governed tools; a deterministic planner runs the same arc when no API key is configured. Runs stream live to the dashboard. |
| **Money** | Double-entry ledger (brand budget → campaign available → escrow → creator wallet), escrow holds on offers, refunds on decline, milestone payouts, trial balance. |
| **Audit** | Append-only, SHA-256 hash-chained log of every agent tool call *and* human dashboard action; UPDATE/DELETE blocked at the database; one-click chain verification. |
| **Global + India marketplace** | 24 seeded creators across the US, UK, EU and India (Hindi/English, India-majority audiences, INR-realistic USD rates), with audience-country filtering and India-specific campaign and evaluation scenario. |
| **Marketplace intelligence** | Predictive creator↔campaign match score (niche, audience, performance, budget fit, reliability) with reasons; rate benchmarking by tier and niche; sponsored-content compliance checker (#ad disclosure, platform, required tags/handles/codes). |
| **Workflows** | Campaign wizard & lifecycle, shortlists with human approval, offers → counter-offers → acceptance, deliverable submission with compliance + metrics, review, payouts, notifications, realtime updates (SSE). |
| **Creator portal** | Offer inbox with negotiation, brief & must-include checklist, content submission with live compliance preview, wallet & payouts, media-kit editor with rate benchmarks. |
| **Agency workspace** | Multi-client view with consolidated budgets, approvals and agent activity. |
| **Evaluation lab** | Paper §10 matched scenarios: agent-operated runs measured live against the server vs a modelled manual baseline (time-to-launch, human minutes, matching accuracy). |

## Quickstart

Requirements: Node.js **22.5+** (uses the built-in `node:sqlite`).

```bash
git clone https://github.com/iDhruv03/agentic-creator-marketing.git
cd agentic-creator-marketing
npm run setup      # installs root, server and client dependencies
npm run dev        # API on :3001, dashboard on :5173 (database auto-seeds on first boot)
```

Open **http://localhost:5173** and pick a demo persona (password `demo1234`):

| Persona | Email | Sees |
|---|---|---|
| Brand · TechPulse Audio | `maya@techpulse.audio` | live agent-run campaign with pending checkpoints |
| Brand · Glow Botanicals | `james@glowbotanicals.com` | mid-flight campaign with content review |
| Brand · Apex Athletics | `lena@apexathletics.co` | agency-managed campaign |
| Brand · Zestra Naturals (India) | `riya@zestranaturals.in` | India-market launch with Indian creators |
| Agency · OmniMedia | `sam@omnimedia.co` | three clients in one workspace |
| Agency · Elevate | `ava@elevate.io` | |
| Creators | `marcus@creator.cmi`, `elena@creator.cmi`, `ananya@creator.cmi`, `david@creator.cmi` | offers, content, wallet |

Optional: copy `server/.env.example` to `server/.env` and set `ANTHROPIC_API_KEY` to let Claude drive agent runs. Without it, runs use the simulated planner — governance, ledger and audit behave identically.

### Other commands

```bash
npm test            # 29 tests: governance, ledger invariants, audit chain, MCP registry, agent runtime, evaluation
npm run typecheck   # server + client
npm run seed        # reset & reseed the database
npm run build       # production build (server → dist, client → dist, served by the API)
npm start           # run the production build on :3001
docker compose up   # same, containerised
```

## Demo video

A narrated 3-minute product tour can be regenerated from the live app with `scripts/demo/record-demo.mjs` (see `scripts/demo/README.md`).

## Connect an MCP client

**Claude Desktop / Cursor (stdio)** — add to your MCP config:

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

**Streamable HTTP** — `POST http://localhost:3001/mcp` with header `X-CMI-Session: <session id>`.

Then ask your assistant: *“Inspect campaign camp_techpulse_earbuds, shortlist the three best tech creators with rationale, and send offers inside the rate band.”* Offers above the session's rate ceiling and payouts above $1,000 land in the dashboard's approval queue instead of executing.

## Architecture

```
Actors        Brands · Agencies · Creators · AI agents
Interfaces    React dashboard (REST + SSE)   |   Governed MCP server (stdio / HTTP)
Core          campaigns · marketplace · collaborations · payments · governance · ledger · audit · analytics · evaluation
Data          SQLite — single source of truth, double-entry ledger, hash-chained audit log
External      Anthropic Claude (agent runtime)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/MCP_SPECIFICATION.md](docs/MCP_SPECIFICATION.md) and [docs/API.md](docs/API.md).

## Repository layout

```
server/src
  core/          Infrastructure Core — the only code that writes to the database
  mcp/           tool registry (zod → JSON Schema), governed executor, stdio + HTTP transports
  agent/         Claude runner, simulated planner, run persistence & streaming
  routes/        REST API (auth, orgs, creators, campaigns, collaborations, governance, agents, insights)
  realtime/      event bus + SSE
  auth/          users, signed tokens, role scoping
  db/            schema.sql, connection, seed
  tests/         node:test suite
client/src
  pages/         Overview · Campaigns · Creators · Collaborations · Approvals · Finance · Audit · Agents · MCP · Evaluation · Agency · Creator portal · Settings
  components/ui  design system (tokens in index.css, light + dark)
  lib/ hooks/    API client, TanStack Query hooks, realtime
docs/            architecture, MCP spec, API reference, research paper
```

## Evaluation results (seeded + live)

The Evaluation Lab runs matched scenarios through both workflows. Seeded history reflects the paper's expected pattern, and every new run is measured live:

| Metric | Manual (modelled) | Agent-operated (measured) |
|---|---|---|
| Time to launch (brief → first offer) | ~44–56 h | ~2–3 min |
| Human labour per campaign | ~6 h | ~15 min of oversight |
| Shortlist acceptance (matching accuracy) | 82–86 % | 90–93 % |

## Citation

```bibtex
@article{cmi2026agentic,
  title   = {Agentic Creator Marketing Infrastructure: An MCP-Enabled Platform for Brands, Agencies, Creators, and Autonomous AI Marketing Agents},
  author  = {Dhruv},
  journal = {Department of Computer Science and Engineering, Minor Project},
  year    = {2026}
}
```

## License

MIT — see [LICENSE](LICENSE).
