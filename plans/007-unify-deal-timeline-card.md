# Plan 007: Unify the deal timeline card with all events and sale cost economics

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. After each implementation block, do a local code review before
> continuing. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat f108f54..HEAD -- packages/contracts/src/index.ts apps/api/src/domain apps/api/test apps/web/src/lib apps/web/src/proto plans/007-unify-deal-timeline-card.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: direction / tech-debt / tests
- **Planned at**: commit `f108f54`, 2026-06-22

## Current execution goal

Implement this plan on branch `codex/unified-deal-timeline-card` as a
block-by-block TDD loop. The working objective is:

> Realize the unified deal lifecycle card described in this file, keeping
> source behavior compatible for existing dashboard consumers. After every
> block, run the scoped verification command, inspect the diff as a code review,
> and only then move to the next block. Do not deploy, push, commit or touch
> production without an explicit operator request.

Current progress for this execution:

| Block | Scope | Status | Required gate before next block |
| --- | --- | --- | --- |
| A | Contracts and type tests | DONE | contracts typecheck plus DTO review |
| B | Backend lifecycle/economics mapper | DONE | focused API tests plus cost/PII review |
| C | Report builders and web API normalization | DONE | API/web focused tests plus compatibility review |
| D | Shared frontend deal lifecycle card | DONE | RED/GREEN UI test, web typecheck/lint, UI diff review |
| E | Full QA and browser verification | DONE | focused suites, workspace checks, browser smoke, final CRG/code review |

Implementation preserved the `/improve` boundaries:

- edit only in-scope frontend files needed by Step 5;
- keep the newly added lifecycle-card UI test red before implementation and
  green after implementation;
- render event lists with stable `event.id` React keys, matching current React
  docs guidance to use stable IDs from data instead of indexes or generated
  random keys;
- keep fallback behavior for older rows that have no `lifecycleCard`;
- do not display technical calculation status or fixed-cost warning text.

## Goal

Build one shared deal lifecycle card that can render won, lost and in-progress
attraction deals with the same structure:

- deal header, status and dates;
- economics: attraction revenue, membership amount, sale cost, margin and cost
  rows;
- safe deal attributes;
- activity summary;
- a stage-based timeline that also shows every safe event inside the relevant
  stage: calls, tasks, meetings, meeting date changes and conversion event
  visits with event name plus participation status.

The card must not show technical calculation status text or internal warnings
such as "Статус расчета: оценка" or "фиксированные расходы менеджера не
распределены". Those may remain internal report metadata if useful for tests or
debugging, but the visible deal card should stay business-facing.

## Why this matters

The dashboard now has two similar deal-detail cards that drift: the sales card
has pricing economics and a richer stage timeline, while the manager action
card covers won/lost/wip but lacks the same economics and does not attach calls
or tasks to stages. Users need one way to inspect a deal lifecycle and compare
won, lost and active deals. The repository already has canonical touchpoint
facts and unit-economics rules, so the right implementation is a shared backend
view model plus one frontend card, not more UI branching.

## Current state

- `packages/contracts/src/index.ts` defines canonical touchpoint facts:

```ts
// packages/contracts/src/index.ts:532
export type DealTouchpointKind =
  | "call"
  | "task_created"
  | "task_completed"
  | "meeting"
  | "meeting_date_changed"
  | "conversion_event_visit"
  | "message_count"
  | "comment_quality_signal";

// packages/contracts/src/index.ts:542
export interface DealTouchpointFactSnapshot {
  factId: string;
  kind: DealTouchpointKind;
  occurredAt: string;
  dealId: string | null;
  managerId: string | null;
  stageIdAtEvent: string | null;
  stageNameAtEvent: string | null;
  linkConfidence: AnalyticsLinkConfidence;
  linkReason: string;
  payloadJson: string | null;
}
```

- `packages/contracts/src/index.ts:813` has `DealStageTimelineEntry`, but it
  only carries aggregate summaries and optional meeting events:

```ts
export interface DealStageTimelineEntry {
  stageId: string;
  stageName: string;
  enteredAt: string;
  leftAt: string;
  durationHours: number;
  callSummary: DealCallSummary;
  taskSummary: DealTaskSummary;
  meetingEvents?: DealMeetingEvent[];
}
```

- `SalesDealRow` at `packages/contracts/src/index.ts:824` is won-deal oriented
  and has pricing fields: `attractionRevenueAmount`, `membershipAmount`,
  `pricingStatus`, `pricingWarnings`, `cohortContext`, summaries and
  `stageTimeline`.
- `ManagerActionOutcomeDealDetail` at `packages/contracts/src/index.ts:1415`
  supports `won | lost | wip` report rows and SLA, but has no pricing or
  per-deal economics fields.
- `apps/api/src/domain/reporting.ts:43` resolves dashboard deal economics only
  with `context: "finalWon"`, and `buildDashboard` at
  `apps/api/src/domain/reporting.ts:520` builds `dealEconomics` only for
  `wonDeals`.
- `apps/api/src/domain/operational-reports.ts:2365` builds manager action stage
  timelines with empty call/task summaries. It attaches meeting events, but not
  calls/tasks by stage:

```ts
// apps/api/src/domain/operational-reports.ts:2389
return {
  stageId: row.stageId,
  stageName: resolveManagerActionStageName(...),
  enteredAt: row.createdTime,
  leftAt,
  durationHours: toDurationHours(row.createdTime, leftAt) ?? 0,
  callSummary: buildManagerActionCallSummary([]),
  taskSummary: { created: 0, closed: 0 },
  meetingEvents: []
};
```

- `apps/api/src/domain/analytics-facts.ts:152` already creates
  `DealTouchpointFactSnapshot[]` for calls, task created/completed, meetings,
  meeting date changes and conversion event visits. Conversion visit payloads
  include event name, date and status:

```ts
// apps/api/src/domain/analytics-facts.ts:364
payloadJson: JSON.stringify({
  eventId: visit.eventId ?? null,
  eventName: visit.eventName,
  eventDate: visit.eventDate,
  status: visit.status,
  visitStageId: visit.stageId,
  visitStageName: visit.stageName,
  upstreamDealId: visit.dealId
})
```

- `apps/api/src/domain/unit-economics.ts:1250` computes aggregate unit
  economics. It handles `amount_per_lead`, `amount_per_contract`,
  sales bonuses and event participant costs, but it does not emit per-deal cost
  rows.
- `docs/plans/2026-06-02-unit-economics-financial-result.md:559` states event
  costs should support exact event id, event label/type, and period-level
  allocation. It also states at line 599 that employee costs must not be
  silently allocated unless the allocation method is explicitly stored.
- `apps/web/src/proto/scenes.tsx:1867` renders `StageTimelineInteractionBadges`.
  It currently always renders "Мероприятия недоступны" and
  "Сообщения недоступны".
- `SalesDealDetails` at `apps/web/src/proto/scenes.tsx:1911` and
  `ManagerActionDealDetails` at `apps/web/src/proto/scenes.tsx:3261` duplicate
  similar attributes, summary and stage timeline UI. The sales card has
  economics; the manager action card has SLA.
- `apps/web/src/proto/proto-app.test.tsx:4355` currently asserts the old
  timeline badge behavior, including `Мероприятия недоступны`. This test must
  be updated to assert event names and participation statuses.

## Product and design constraints

- `README.md` says this is a local app for anonymized Bitrix24 reporting. Do
  not show contact/company data, phone, email, raw Bitrix fields, comments or
  real deal titles.
- `AGENTS.md` requires all business dashboards to stay scoped to the attraction
  manager whitelist unless an issue explicitly changes that rule.
- `AGENTS.md` requires report pages to read from local API and SQLite snapshot,
  not direct Bitrix reads from rendering.
- `design.md` requires the operational, dense dashboard style and existing
  primitives: panels, badges, metrics, tables, buttons and shared proto CSS.
  Do not add a separate visual language.
- `docs/modules/attraction/MODULE_ONTOLOGY.md` says `Потенциальный участник`
  and `Сделка в воронке "Привлечение"` must not be conflated. The card may be
  keyed by deal id, but the language must stay about the attraction process and
  safe facts, not contact identity.
- The visible card must not show technical calculation statuses or internal cost
  coverage warnings. Keep the UI business-facing.
- React list rendering must use stable IDs from data as keys. Context7 official
  React docs confirm that list keys should usually come from database/data IDs,
  not array indexes or generated random values.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Node version | `nvm use` | Node `v24.x` is active |
| Session gate | `pnpm session:preflight` | exit 0 on a `codex/*` branch with clean/current base |
| Ontology | `pnpm ontology:validate` | exit 0 |
| Contracts typecheck | `pnpm --filter @bitrix24-reporting/contracts typecheck` | exit 0 |
| API focused tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/analytics-facts.test.ts test/unit-economics.test.ts test/http.test.ts` | all pass |
| Web focused tests | `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/proto/proto-app.test.tsx` | all pass |
| Workspace typecheck | `pnpm typecheck` | exit 0 |
| Workspace lint | `pnpm lint` | exit 0 |

If local Node is not 24.x, stop before implementation and switch runtime. Do not
interpret Node 20 build/test failures as product failures.

## Suggested executor toolkit

- Use `test-driven-development` as the primary workflow if available.
- Use `code-reviewer` or the repository `reviewer` preset after each block.
- Use Code Review Graph before implementation and before review if available:
  `get_minimal_context_tool` first, then `detect_changes_tool` after a block.
- Use Context7 for React documentation if changing list rendering or component
  composition.

## Scope

**In scope**:

- `packages/contracts/src/index.ts`
- `apps/api/src/domain/reporting.ts`
- `apps/api/src/domain/operational-reports.ts`
- `apps/api/src/domain/unit-economics.ts`
- new focused helper module(s) under `apps/api/src/domain/` if needed
- `apps/api/test/analytics-facts.test.ts`
- `apps/api/test/unit-economics.test.ts`
- `apps/api/test/http.test.ts`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/dashboard-types.ts`
- `apps/web/src/lib/api-client.test.ts`
- `apps/web/src/proto/scenes.tsx`
- `apps/web/src/proto/proto-app.test.tsx`
- `apps/web/src/proto/proto.css` only if existing primitives cannot express the
  event list cleanly

**Out of scope**:

- Direct Bitrix reads from the web app.
- Any change that stores or renders contact names, phones, emails, company
  names, raw comments, raw payloads or real deal titles.
- Changing attraction manager whitelist semantics.
- Reallocating employee/fixed period costs to individual deals without an
  explicit stored allocation method.
- Reworking the whole unit economics scene.
- Deploy, production sync, migrations or GitHub PR unless the operator
  explicitly asks for them after implementation.

## Git workflow

- Start from latest `main` and create `codex/unified-deal-timeline-card`.
- Do not implement on `main`.
- Keep commits scoped by block if the operator asks for commits later.
- Do not push or open a PR unless explicitly instructed.

## Target data model

Add a shared contract that both existing cards can use. Names may be adjusted to
match local style, but keep the shape explicit.

```ts
export type DealLifecycleStatus = "won" | "lost" | "wip";

export type DealTimelineEventKind =
  | "call"
  | "task_created"
  | "task_completed"
  | "meeting"
  | "meeting_date_changed"
  | "conversion_event_visit";

export interface DealTimelineEvent {
  id: string;
  kind: DealTimelineEventKind;
  occurredAt: string;
  stageId: string | null;
  stageName: string | null;
  title: string;
  detail: string | null;
  badgeLabel: string | null;
  linkConfidence: AnalyticsLinkConfidence;
}

export interface DealEventSummary {
  callSummary: DealCallSummary;
  taskSummary: DealTaskSummary;
  meetingSummary: DealMeetingSummary;
  conversionEventVisits: number;
}

export interface DealSaleCostRow {
  articleId: string;
  label: string;
  amount: number;
  basis: string;
  sourceSystem: "rule" | "fact";
  confidence: UnitEconomicsCostConfidence;
}

export interface DealSaleEconomics {
  revenueMode: "actual" | "planned" | "none";
  attractionRevenueAmount: number | null;
  membershipAmount: number;
  saleCostAmount: number;
  marginAmount: number | null;
  costRows: DealSaleCostRow[];
}

export interface DealLifecycleCard {
  dealId: string;
  managerId: string;
  managerName: string;
  status: DealLifecycleStatus;
  stageId: string;
  stageName: string;
  dateCreate: string;
  dateClosed: string | null;
  dateModify: string;
  cycleDays: number | null;
  sourceKey?: string;
  sourceLabel?: string;
  qualityValue?: string | null;
  businessClubValue?: string | null;
  targetGroupValue?: string | null;
  meetingTypeValue?: string | null;
  meetingDateValue?: string | null;
  tariffValue?: string | null;
  economics: DealSaleEconomics;
  eventSummary: DealEventSummary;
  stageTimeline: Array<DealStageTimelineEntry & { events: DealTimelineEvent[] }>;
  cohortContext?: DealCohortContext;
  sla?: ManagerActionOutcomeDealDetail["sla"];
}
```

Visible event status mapping:

- `attended` -> `пришел`
- `refused` -> `отказ`
- `invited` -> `приглашен`
- `confirmed` -> `приглашен` unless product later asks for separate
  `подтвержден`
- `missed` -> `не пришел`
- `unknown` -> `статус неизвестен`

Call badges must preserve the current stage format:

```text
Звонки N · X вход. · Y исход. · Z >30с
```

The overall activity summary may also show failed/missed calls because the
existing `DealCallSummary` already has `failed`.

## Steps

### Step 1: Add shared contracts and characterization tests

Add the shared lifecycle/timeline/economics contract to
`packages/contracts/src/index.ts`. Prefer appending near the existing
`DealStageTimelineEntry`, `SalesDealRow` and manager action deal detail types so
related DTOs stay together.

Do not remove `SalesDealRow` or `ManagerActionOutcomeDealDetail` in this step.
Compatibility should remain intact while the backend starts producing shared
fields.

Add or update tests that compile against the new contract. If there is no
contracts test file, rely on package typecheck for this block.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/contracts typecheck
```

Expected: exit 0.

**Review gate A**:

- Inspect `git diff -- packages/contracts/src/index.ts`.
- Confirm no PII fields were added.
- Confirm `DealTimelineEvent.id` can be a stable source fact id, not an array
  index.
- Confirm old DTOs are still exported.

### Step 2: Build a backend lifecycle card mapper

Create a focused domain helper, for example
`apps/api/src/domain/deal-lifecycle-card.ts`, or reuse an existing domain file if
that better matches the repository style.

The helper should accept:

- deal snapshots;
- stage history/stage facts;
- activities;
- calls;
- meeting date changes if available at the call site;
- conversion event visits and event snapshots;
- pricing rules;
- unit economics cost rules/facts;
- manager directory and source labels;
- status context: `won`, `lost` or `wip`.

It should return `DealLifecycleCard[]` or a single `DealLifecycleCard`.

Implementation requirements:

- Build stage rows once, then attach summaries and event rows by event timestamp
  and `stageIdAtEvent`.
- Prefer `DealTouchpointFactSnapshot` as the event source. Do not recreate
  parallel linking rules in UI code.
- For conversion event visits, display event name from payload/event snapshot
  and mapped participation status.
- For calls, parse payload safely and render direction/duration/connected
  metadata into safe labels only.
- For tasks, show created/completed as business events without raw task subject
  or comments.
- For meeting date changes, show safe date movement text only.
- Use `linkConfidence` internally for ordering/debug/test metadata, but do not
  expose confidence copy in the visible card.
- Preserve current call summary semantics. Incoming is call type `"2"`;
  outgoing is call type `"1"` or non-incoming; connected over 30 seconds should
  match existing report logic.
- Compute `cycleDays` as:
  - won/lost: create date to closed/terminal date;
  - wip: create date to report/evaluation date.

Sale cost requirements:

- Reuse `resolveDealEconomics` for revenue:
  - `won`: `context: "finalWon"`;
  - `wip`: `context: "pipelinePlan"` for planned revenue;
  - `lost`: actual revenue is 0; planned revenue may be calculated internally
    but should not be presented as a sale.
- Add a deal-level cost allocation helper. It may live near
  `unit-economics.ts`, but avoid breaking the aggregate report.
- Include only costs that can be fairly tied to a deal:
  - `lead_purchase` / `amount_per_lead` for created deals matching
    source/quality rules;
  - `contractation` / `amount_per_contract` only for won deals;
  - `sales_bonus` / `percent_of_club_membership` only when the revenue basis is
    actual or explicitly planned for wip;
  - event participant costs for linked conversion event visits that match the
    active event participant mode;
  - exact cost facts if a future or existing field ties them to `dealId` or a
    safe source reference that can be matched without parsing personal data.
- Do not allocate employee/fixed period costs to a deal without an explicit
  stored allocation method. Do not show the internal warning in the card.
- `marginAmount` should be:
  - won: `actual attraction revenue - sale cost`;
  - lost: `0 - sale cost`;
  - wip: `null` unless the UI labels it as planned; prefer planned revenue and
    incurred cost, not final margin.

Add tests in `apps/api/test/unit-economics.test.ts` or a new focused API domain
test:

- won leadgen deal: lead purchase + contractation + event cost;
- lost leadgen deal: lead purchase + event cost, no contractation;
- wip leadgen deal: lead purchase + linked event cost and planned revenue;
- employee/fixed cost fact remains unallocated to a deal;
- conversion visit statuses map to `пришел`, `отказ`, `приглашен`,
  `не пришел`.

Also update `apps/api/test/analytics-facts.test.ts` only if the lifecycle mapper
needs new touchpoint fact assertions.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/analytics-facts.test.ts test/unit-economics.test.ts
```

Expected: all tests pass.

**Review gate B**:

- Inspect the new helper and `unit-economics.ts` diff.
- Confirm there is one cost allocation rule path, not duplicate copies in
  dashboard and manager-action report builders.
- Confirm no raw payload is sent to web DTOs.
- Confirm lost/wip economics cannot be mistaken for closed won revenue.

### Step 3: Wire lifecycle cards into reports without breaking old consumers

Update backend report builders so both current surfaces can use the shared card:

- In `apps/api/src/domain/reporting.ts`, keep existing dashboard response fields
  for compatibility, but populate sales deal rows from the shared lifecycle card
  where possible.
- In `apps/api/src/domain/operational-reports.ts`, add lifecycle/economics data
  to `ManagerActionOutcomeDealDetail` or add a nested `lifecycleCard` field.
  Prefer a nested field if replacing the row shape would cause a wider test
  blast radius.
- Ensure manager action stage timelines now include calls/tasks summaries per
  stage and event rows, matching sales card behavior.
- Ensure reports still respect the selected attraction manager whitelist and
  existing team-scoped manager filters.

Update HTTP tests in `apps/api/test/http.test.ts` to assert the new response
shape for one won and one non-won deal if the endpoint exposes deal details.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts test/unit-economics.test.ts
```

Expected: all tests pass.

**Review gate C**:

- Inspect report builder diffs.
- Confirm no endpoint starts reading Bitrix directly.
- Confirm old required fields still exist for frontend normalization.
- Confirm no manager whitelist behavior changed.

### Step 4: Normalize lifecycle cards in the web client

Update `apps/web/src/lib/dashboard-types.ts` and
`apps/web/src/lib/api-client.ts` with normalizers for:

- lifecycle card;
- stage timeline events;
- economics;
- cost rows;
- mapped event statuses.

Use defensive normalization patterns already present in `api-client.ts`:
`isRecord`, `asString`, `asNumber`, `asNullableString`, `asArray`.

Add/update `apps/web/src/lib/api-client.test.ts`:

- lifecycle event arrays normalize to safe fallback arrays;
- event name + status survive normalization;
- cost rows normalize numbers safely;
- unknown/missing fields do not crash the card;
- raw payload is not exposed as a typed UI field.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts
```

Expected: all tests pass.

**Review gate D**:

- Inspect `api-client.ts` and type diffs.
- Confirm stable `id` is preserved for React keys.
- Confirm no `any` escape hatch was added where existing helpers could handle
  unknown API data.

### Step 5: Replace duplicated deal detail UI with one shared card

In `apps/web/src/proto/scenes.tsx`, extract one shared component, for example:

- `DealLifecycleDetails`;
- `DealEconomicsPanel`;
- `DealAttributesPanel`;
- `DealActivitySummaryPanel`;
- `DealStageTimelinePanel`;
- `DealTimelineEventList`.

Then have both `SalesDealDetails` and `ManagerActionDealDetails` call the shared
component or become thin adapters. Preserve the parent table layouts and existing
expand/collapse controls.

Visible UI requirements:

- Keep current dense dashboard styling with existing primitives.
- Do not show "Статус расчета: оценка".
- Do not show internal warning copy about fixed/employee costs not allocated.
- Replace the permanent "Мероприятия недоступны" placeholder when conversion
  events exist.
- Render conversion events as:

```text
Мероприятие: <название мероприятия> · <статус участия>
```

- Keep current call badge format in the stage timeline:

```text
Звонки N · X вход. · Y исход. · Z >30с
```

- The activity summary can include failed/missed call counts when available.
- Use stable event ids for React keys: `event.id`, not indexes or random values.
- Do not render deal title if it may contain personal/company data. Use deal ID.
- Keep optional panels:
  - cohort panel for sales/won context;
  - SLA panel for manager action context.

Update `apps/web/src/proto/proto-app.test.tsx`:

- old sales card still hides deal title and shows safe ID;
- sales card shows economics: revenue, membership, sale cost and margin;
- manager action detail shows the same event timeline structure;
- timeline event list shows call badge, task badge, meeting row, event name and
  status;
- `Мероприятия недоступны` is absent when events exist and present only when
  there are no event facts, if that empty state is still useful;
- technical calculation status/warning text is absent;
- responsive classes still keep timeline rows from overflowing.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx
```

Expected: all tests pass.

**Review gate E**:

- Inspect the UI diff for duplicated card logic. The shared component should
  own the card layout; wrappers should only adapt optional panels.
- Confirm no nested-card-heavy redesign. Small bordered fact rows inside a panel
  are acceptable under `design.md`.
- Confirm all lists have stable keys.
- Confirm visible text matches the business language requested in this plan.

### Step 6: Full verification and manual browser QA

Run the focused checks, then broader checks:

```bash
pnpm ontology:validate
pnpm --filter @bitrix24-reporting/contracts typecheck
pnpm --filter @bitrix24-reporting/api exec vitest run test/analytics-facts.test.ts test/unit-economics.test.ts test/http.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts src/proto/proto-app.test.tsx
pnpm typecheck
pnpm lint
```

Expected: every command exits 0.

Start the local app only after automated checks pass:

```bash
pnpm start
```

Manual checks in the browser:

- Open the sales-by-manager section and expand a won deal.
- Open the manager action/cohort section and expand won, lost and wip examples
  if fixture/local data has them.
- Confirm the card shows economics and cost rows but not technical calculation
  warning/status text.
- Confirm event rows include event names and statuses: `пришел`, `отказ`,
  `приглашен`, `не пришел` where present.
- Confirm stage call badges still match current format.
- Check a narrow viewport: badges wrap cleanly and do not overflow.

**Final review gate**:

- Run `git diff --check`.
- Run Code Review Graph `detect_changes_tool` if available.
- Perform a code-review pass focused on:
  - PII leakage;
  - broken manager attribution;
  - lost/wip economics being displayed as actual sales;
  - duplicated cost allocation logic;
  - frontend list key stability;
  - test coverage for all event kinds.

## Test plan

API tests:

- `apps/api/test/analytics-facts.test.ts`: touchpoint facts include call,
  task-created, task-completed, meeting, meeting-date-changed and
  conversion-event-visit with `stageIdAtEvent`.
- `apps/api/test/unit-economics.test.ts`: per-deal sale costs for won/lost/wip;
  event costs by invited/attended mode; no silent employee/fixed cost allocation.
- `apps/api/test/http.test.ts`: endpoint response includes lifecycle card shape
  without raw payloads.

Web tests:

- `apps/web/src/lib/api-client.test.ts`: normalizers preserve safe timeline and
  cost data.
- `apps/web/src/proto/proto-app.test.tsx`: one shared card behavior from both
  sales and manager-action entry points; no technical warning text; no deal
  title/PII; events render with names/statuses.

## Done criteria

All must hold:

- [ ] `SalesDealDetails` and `ManagerActionDealDetails` no longer carry two
      divergent copies of the same detailed card layout.
- [ ] A shared lifecycle card DTO exists and supports `won`, `lost`, `wip`.
- [ ] The timeline can render calls, task-created, task-completed, meetings,
      meeting-date-changed and conversion-event-visit events.
- [ ] Conversion events render as event name plus participation status.
- [ ] Stage call badges preserve current call-type format.
- [ ] Economics show revenue/membership/sale cost/margin where applicable.
- [ ] Lost deals show incurred cost without being counted as won revenue.
- [ ] Wip deals show planned revenue/incurred cost without pretending the sale
      is final.
- [ ] Employee/fixed costs are not silently allocated to a deal.
- [ ] The visible deal card does not show technical calculation status/warning
      text.
- [ ] No contact/company PII, raw comments, raw payloads or real deal titles are
      exposed.
- [ ] Focused API and web tests pass.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `plans/README.md` status row is updated by the executor.

## STOP conditions

Stop and report back if:

- Existing report endpoints cannot access the data needed for conversion event
  names/statuses without adding direct Bitrix reads to page rendering.
- Per-deal cost allocation requires parsing raw personal fields, comments, deal
  titles or other forbidden payloads.
- The only way to allocate employee/fixed costs is implicit spreading by deal
  count without an explicit stored allocation method.
- Contract changes require deleting or breaking existing `SalesDealRow` or
  `ManagerActionOutcomeDealDetail` consumers before the shared card is ready.
- A required test file has drifted so far from the excerpts above that the test
  plan no longer maps to the current product surface.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Keep the shared lifecycle card as the only place where deal detail UI semantics
  are defined. Future deal-detail reports should consume this shape instead of
  inventing another card.
- If the business later decides to show cost coverage/confidence, add a compact
  business-facing label, not raw internal warning strings.
- If employee cost allocation becomes a product requirement, create a separate
  plan and store the allocation method explicitly before putting those costs
  into deal cards.
- If message counts become available, add them as counts only. Do not render
  message text or comments.
