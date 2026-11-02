# CMI dashboard — page author guide

This is the contract every page in `client/src/pages` follows. Read it fully before writing a page.

## Stack & conventions
- React 18 + TypeScript (strict), Vite, Tailwind 3 with CSS-variable tokens (`client/src/index.css`), react-router-dom 6, TanStack Query 5, zustand, Radix primitives, lucide-react icons, recharts, sonner toasts, framer-motion (optional; keep subtle).
- Path alias `@/` → `client/src/`. Every page is a **default export** function component and renders inside `<AppShell>` (sidebar + top bar already present). Do **not** add your own sidebar/header.
- Wrap page content in `<div className="page">` (max-width, padding) and start with `<PageHeader …/>` from `@/components/ui/page-header` (title, description, crumbs, actions, meta).
- Data: use the hooks in `@/hooks/queries.ts` (one per endpoint) and the `api` object in `@/lib/api.ts`. For writes use `useAction(fn, { invalidate: ['key', …], success: 'Toast text' })` from `@/hooks/queries.ts` — it toasts errors automatically. Query keys: `campaigns`, `campaign`, `creators`, `creator`, `collaborations`, `collaboration`, `checkpoints`, `checkpoint`, `ledger`, `trial-balance`, `audit`, `audit-verify`, `notifications`, `sessions`, `session`, `runs`, `run`, `mcp-tools`, `overview`, `evaluation`, `wallet`, `brands`, `agencies`, `campaign-analytics`, `shortlist`. The SSE feed (`usePlatformEvents` in the shell) already invalidates these on server events, so pages update live.
- Types: everything is in `@/types.ts`. Never redefine API shapes.
- Current user: `useAuth((s) => s.me)` / `useUser()` from `@/store/auth`. Roles: BRAND, AGENCY, CREATOR, ADMIN. `me.org` is the brand/agency/creator record.
- Formatting helpers in `@/lib/utils.ts`: `cn`, `money(n, {compact})`, `num(n, {compact})`, `pct`, `timeAgo`, `fmtDate`, `fmtDateTime`, `titleCase`, `duration(sec)`, `minutes(min)`, `platformLabel`, `deliverableLabel`, `initials`.

## UI kit (`@/components/ui/*`) — use these, don't hand-roll
- `button`: `<Button variant="primary|secondary|ghost|subtle|danger|success|outline|link|agent" size="xs|sm|md|lg|icon|icon-sm" loading leftIcon rightIcon>`.
- `badge`: `<Badge tone="neutral|primary|success|warning|danger|info|agent|outline" size="sm|md|lg" dot>`.
- `card`: `<Card hover padded={false}>`, `<CardHeader title description action icon/>`, `<Section title description action>`.
- `avatar`: `<Avatar name src size="xs…2xl" square ring/>`, `<AvatarStack items max/>`, `<OrgMark/>`.
- `field`: `Label`, `Input` (leftIcon/rightSlot/error), `Textarea`, `SearchInput`, `Select` (options, allowEmpty), `Switch`, `Slider`, `ChipGroup` (multi/single), `SegmentedControl`, `TagInput`, `FieldError`, `Hint`.
- `overlay`: `Dialog` (title, description, footer, size), `Sheet` (side drawer; width sm…xl), `ConfirmDialog`, `Dropdown/DropdownTrigger/DropdownContent/DropdownItem/DropdownLabel/DropdownSeparator`, `Tooltip`, `Popover/PopoverTrigger/PopoverContent`.
- `tabs`: `Tabs`, `TabsList`/`TabsTrigger` (underlined, supports `count` and `icon`), `PillTabsList`/`PillTabsTrigger`, `TabsContent`.
- `feedback`: `Progress` (value or `segments`), `Skeleton`, `SkeletonRows`, `SkeletonCards`, `EmptyState` (icon,title,description,action,compact), `Stat` (label,value,icon,tone,hint,delta,onClick), `Kbd`, `Spinner`, `PulseDot`, `Callout` (tone,title,icon,action), `Score` (0–100 ring).
- `status`: domain badges — `CampaignStatusBadge`, `CollabStatusBadge`, `DeliverableStatusBadge`, `ExecStatusBadge`, `RunStatusBadge`, `SessionStatusBadge`, `CheckpointStatusBadge`, `RiskBadge`, `ActorBadge(type,name)`, `PlatformIcon`, `PlatformIcons`, `ToolChip`; plus the maps `CAMPAIGN_STATUS`, `COLLAB_STATUS`, `CHECKPOINT_ACTION` (label/tone/description).
- `charts`: `ChartFrame` (title/description/height/legend; wraps ResponsiveContainer — pass a single recharts chart as child), `ChartTooltip` (use as `<Tooltip content={<ChartTooltip format={…} />} />`), `CHART` colors (`primary, teal, amber, violet, rose, blue`), `CHART_SERIES`, `Sparkline`, `BarList`, `Donut`. Always: `<CartesianGrid vertical={false} strokeDasharray="3 3" />`, axes with `axisLine={false} tickLine={false}`.
- `data`: `DataTable` (columns with render/sortValue/align/width, onRowClick, selectedKey, empty), `KeyValue` (columns 1–3), `Timeline`, `JsonView`, `CodeBlock`, `CopyButton`, `Mono`, `Collapsible`.
- `page-header`: `PageHeader`. `logo`: `Logo`, `LogoMark`.

## Visual language (match `pages/Overview.tsx` and `pages/Login.tsx` exactly)
- Calm, dense-but-airy SaaS. White/near-black surfaces, 1px borders, `rounded-2xl` cards, `shadow-card`. Indigo primary, teal/amber/rose/violet for semantics. **Agent-related** UI uses the `agent` tone (violet). Pending/held = warning (amber). Blocked = danger. Success = emerald.
- Typography: page titles via `PageHeader`; card titles 15px semibold; body 13–14px; meta 11–12px muted; numbers `tabular-nums`; ids/tool names in `font-mono` via `ToolChip`/`Mono`.
- Spacing: sections `space-y-6`; grids `gap-4`/`gap-6`; responsive (`sm:`, `lg:`, `xl:`) — must work at 390px wide with no horizontal scroll.
- Both themes must look right: only use token colors (`bg-surface`, `text-muted-foreground`, `border-border`, tone classes). Never hard-code hex colors except inside the provided chart color constants.
- Loading: use skeletons (`SkeletonCards`, `SkeletonRows`) not spinners for page loads. Empty states via `EmptyState` with a helpful action.
- Every destructive or money-moving action gets a `ConfirmDialog` or a `Dialog` with a clear summary of what will happen.
- Toasts: `useAction` success strings; keep them short.
- Links: `Link` from react-router. Campaign → `/campaigns/:id`, creator → `/creators/:id`, collaboration → `/collaborations/:id`, checkpoint → `/approvals?checkpoint=:id`, run → `/agents/runs/:id`, session → `/agents/sessions/:id`, creator-side offer → `/creator/offers/:id`.
- Keep files reasonably sized; extract sub-components into `client/src/components/<area>/` if a page passes ~400 lines.
- No `any` unless interacting with loosely typed payloads (`checkpoint.payload`, run event payloads).

## Governance vocabulary (use these words in copy)
- Agent **session** = an authorised agent identity with a **scope** (DISCOVERY_ONLY / CAMPAIGN_MANAGER / FULL_OPERATOR), a **budget ceiling** (hard cap on spend it can commit) and a **rate ceiling** (per-collaboration cap; above it → checkpoint).
- **Checkpoint** = an agent action held for human approval (PAYMENT_ABOVE_THRESHOLD, OUT_OF_BAND_RATE, BRIEF_MODIFICATION, AGENT_ESCALATION). Approving executes the held action on the reviewer's authority; rejecting leaves state untouched.
- **Guardrail block** = REJECTED_BY_GUARDRAIL (budget ceiling, permission scope, campaign binding, inactive session). Nothing is written.
- **Escrow** = funds locked in the campaign for an offer; **payout** moves escrow to the creator wallet. **Ledger** is double-entry (debit/credit accounts).
- **Audit trail** = append-only, hash-chained log of every tool call and human action.

## Verifying your work
- `cd client && npx tsc -p tsconfig.json --noEmit` must pass with zero errors.
- The dev server runs at http://localhost:5173 (API proxied to :3001). Screenshot script: `node /private/tmp/claude-501/-Users-dhruv/b6c5e2cb-669c-430c-852a-41ac3383c2f8/scratchpad/shot/shot.mjs <out.png> <path> [email] [light|dark] [width] [height] [fullPage 0|1]` — logs console errors; fix every error. Demo logins (password demo1234): maya@techpulse.audio (brand), sam@omnimedia.co (agency), marcus@creator.cmi / elena@creator.cmi (creators). Seeded ids: campaign `camp_techpulse_earbuds`, `camp_glow_radiance`, `camp_apex_training`; collaboration `collab_marcus_techpulse`, `collab_elena_glow`; session `sess_techpulse_operator`; creator `cr_marcus`.
