# Attraction Canonical Facts And Event Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable local analytics layer for attraction reports where deals, leads, contacts, calls, tasks, meetings, conversion events, visit histories, message counts, and future AI quality reviews can be connected through stable cached facts instead of report-specific interpretation.

**Architecture:** Keep the current SQLite snapshot tables and reports working, then add canonical event/entity/fact tables beside them. Sync writes raw-safe normalized facts once; reports read only the local repository and share the same lifecycle/linking functions.

**Tech Stack:** Bitrix24 REST, TypeScript, Vitest, SQLite via `better-sqlite3`, existing `@bitrix24-reporting/api`, `@bitrix24-reporting/contracts`, and web prototype dashboard.

---

## Pre-Implementation Evidence

- Context7 Bitrix docs confirm `crm.status.list` for smart-process stages with `ENTITY_ID = DYNAMIC_{entityTypeId}_STAGE_{categoryId}`.
- Context7 Bitrix docs confirm `crm.stagehistory.list` accepts `entityTypeId`, `filter.OWNER_ID`, `select`, `order`, and pagination.
- Real server read-only calls confirmed:
  - `137` is smart process `Мероприятия`.
  - `162` is smart process `Посещения мероприятий`.
  - event `137/31394` is `Гостевая встреча 28.05.`, stage `Планируется`, event date `2026-05-28`.
  - visits for event `31394`: `0` as of `2026-05-24T10:55:57Z`.
  - event `137/29402` has visits `455354`, `455356`, `455358`; visit `455358` links deal `156562`.
  - `crm.stagehistory.list` for visit `455358` returns history row `147080`, stage `DT162_14:NEW`, changed at `2026-05-18T15:41:58+03:00`.
  - scanning recent visit stage history found real statuses `Приглашен`, `Отказ`, `На мероприятии`, including cases where an item moved from `Отказ` to `На мероприятии`.
- Real server field checks confirmed that event module ownership cannot be inferred from category or title alone:
  - `Гостевая встреча 28.05.` has `parentId156=128`, resolved through smart process `156` as `Мероприятие Привлечения (встреча с участниками сообщества)`;
  - `МСК Networking-сессия CF EXPERIENCE 21.05.26 оффлайн` has `parentId156=52`, resolved as `Нетворкинг сессия`;
  - recent linked event candidates also included type ids `4`, `64`, and `82`;
  - `categoryId=12` and `formatField=2788` are not sufficient by themselves to prove attraction scope.

## Locked Business Rules

- The report scope is attraction-funnel events only, not the full Bitrix event catalog, but it has two sub-scopes:
  - `planned_event_inventory`: planned attraction events by event date, even when no one has been invited yet;
  - `participant_event_metrics`: events that have visits linked to attraction deals/contacts and can produce invitation/attendance/conversion counts.
- An event is in `participant_event_metrics` when it is connected to attraction through at least one scoped visit/deal/contact relation:
  - primary: `Посещения мероприятий.parentId2` points to an attraction deal in the configured attraction categories and manager whitelist;
  - fallback: visit `contactId` resolves to an attraction deal for the same contact when the visit is not linked to the deal or is linked incorrectly;
  - fallback: an attraction deal has the existing conversion-event field value and can be matched to an event safely;
  - participant counts use only visits that pass the same attraction scope rule.
- An event is in `planned_event_inventory` when it belongs to the attraction event configuration, even if it has zero visits. This scope is needed to catch operational gaps like `Гостевая встреча 28.05.` with no invitations.
- Planned inventory must be filtered by module settings, not hardcoded guesses. In the module account/settings UI, the leader selects which Bitrix event types from `parentId156`/`Виды мероприятий` count as planned attraction events.
- The primary planned-event classifier is the selected `parentId156` event-type allowlist from settings, not title matching. Seed the dropdown with Bitrix event-type options, but only selected options drive planned zero-invitation tracking.
- Participant post-analysis does not require the event type to be selected in settings. If a demo-stage deal is linked to any event through a visit/deal/contact relation, it can be counted in `participant_event_metrics` because the real attraction/deal link proves relevance.
- Event snapshots are persisted for:
  - event ids discovered through scoped participant visits or safe scoped fallbacks;
  - planned future/past events matching the selected module event-type settings.
- Do not sync or report all `Мероприятия` globally.
- `Гостевая встреча 28.05.` is a valid planned attraction event if it matches the attraction event configuration. With `0` linked scoped visits it must appear in the upcoming/planned section with zero invited/confirmed and a `no invitations yet` operational flag, but it must not inflate participant conversion counts.
- Demo events selected on the `Демонстрация` stage can use any event item for post-analysis through links; they only need to be selected in settings if the team wants zero-invitation planning control for that event type.
- Historical event report range is by event date, not invitation date.
- `приглашено` means a visit item exists or entered `Приглашен`.
- `подтвердили` means the visit history contains `Пойду`.
- `дошли` means the visit history contains `На мероприятии`.
- `не дошли` is derived after the event: no `На мероприятии`, and final effective state is `Отказ`, `Приглашен`, `Пойду`, or another non-attended active state.
- If a visit has both `Отказ` and later `На мероприятии`, it counts as attended, not no-show.
- Future next-week events use event date and current visit status: `Приглашен` and `Пойду`; canceled events are excluded.
- Activity report call/task logic must continue counting all relevant calls/tasks across linked deals/contacts where the existing report intentionally does that.
- No report rendering may read Bitrix directly. UI reads only cached API/SQLite data.
- Do not persist raw contact names, phone numbers, emails, deal titles, raw message text, call transcripts, raw comments, Bitrix payloads, webhooks, tokens, or cookies.

## Files To Modify

- `packages/contracts/src/index.ts`  
  Add canonical snapshot and report contract types.
- `apps/api/src/bitrix/selectors.ts`  
  Add safe selector builders for event items, visit items, and smart-process stage histories.
- `apps/api/src/bitrix/client.ts`  
  Add Bitrix read methods for conversion events, event-type options, visits, smart-process stages, and visit stage history.
- `apps/api/src/domain/sync.ts`  
  Extend sync client/repository interfaces and orchestrate additive backfill/delta writes.
- `apps/api/src/domain/conversion-events.ts`  
  Keep public report builder, but move lifecycle-specific logic into a focused helper.
- `apps/api/src/domain/conversion-event-lifecycle.ts`  
  New file. Normalize visit history into invited/confirmed/attended/no-show/future counts.
- `apps/api/src/domain/conversion-event-scope.ts`  
  New file. Resolve whether event type/category/format belongs to attraction planned inventory or only to participant metrics.
- `apps/api/src/domain/timeline-facts.ts`  
  New file. Build report-safe timeline facts from existing calls/tasks/meetings and new event facts.
- `apps/api/src/server/sqlite-repository.ts`  
  Add tables, indexes, upserts, getters, and migration compatibility checks.
- `apps/api/src/server/service.ts`  
  Wire the conversion event report and deal timelines to canonical getters while preserving old fallbacks during rollout.
- `apps/api/src/server/app.ts`  
  Extend `/api/reports/conversion-events` response only after contract types are in place and add settings endpoints for selected event types.
- `apps/web/src/lib/api-client.ts`  
  Normalize new conversion-event fields, timeline facts, and event-type settings.
- `apps/web/src/proto/types.ts`  
  Add UI-side report fields.
- `apps/web/src/proto/proto-app.tsx`  
  Update the conversion events card, timeline labels, and module account settings multiselect.
- `apps/api/test/conversion-events.test.ts`  
  Add lifecycle tests for invitation, confirmation, attendance, no-show, and future events.
- `apps/api/test/bitrix-client.test.ts`  
  Add selector/client tests without raw PII.
- `apps/api/test/sync.test.ts`  
  Add sync coverage tests for events and visit stage history.
- `apps/api/test/sqlite.test.ts`  
  Add persistence tests for new tables.
- `apps/api/test/service.test.ts`  
  Add warning/fallback tests.
- `apps/web/src/lib/api-client.test.ts` and `apps/web/src/proto/proto-app.test.tsx`  
  Add normalization/rendering coverage for new fields.
- `docs/modules/attraction/REPORT_REGISTRY.md`  
  Link the final event analytics contract after implementation.

---

### Task 1: Contracts For Canonical Facts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: existing TypeScript build through `pnpm --filter @bitrix24-reporting/contracts build`

- [ ] **Step 1: Add explicit smart-process snapshot types**

Add these contracts near the existing `ConversionEventVisitSnapshot` types:

```ts
export type CrmEntityKind = "deal" | "lead" | "contact" | "activity" | "call" | "smart_process";

export interface ConversionEventSnapshot {
  id: string;
  entityTypeId: number;
  categoryId: number | null;
  title: string | null;
  eventDate: string;
  startAt: string | null;
  endAt: string | null;
  stageId: string;
  stageName: string;
  status: "draft" | "preannounce" | "planned" | "completed" | "canceled" | "unknown";
  formatId: string | null;
  typeId: string | null;
  createdTime: string;
  updatedTime: string;
}

export interface ConversionEventVisitStageHistorySnapshot {
  id: string;
  visitId: string;
  entityTypeId: number;
  categoryId: number | null;
  stageId: string;
  stageName: string | null;
  typeId: number | null;
  changedAt: string;
}

export interface ConversionEventVisitSnapshotV2 {
  id: string;
  entityTypeId: number;
  categoryId: number | null;
  eventId: string | null;
  eventName: string;
  eventDate: string;
  currentStatus: ConversionEventStatus;
  currentStageId: string;
  currentStageName: string;
  dealId: string | null;
  contactId: string | null;
  managerId: string | null;
  sourceId: string | null;
  createdTime: string;
  updatedTime: string;
}

export interface ConversionEventTypeOption {
  id: string;
  title: string;
  categoryId: number | null;
  stageId: string | null;
  selectedForPlannedInventory: boolean;
}

export interface ConversionEventScopeRuleSnapshot {
  id: string;
  ruleKind: "event_type_id";
  value: string;
  label: string;
  enabled: boolean;
  source: "module_settings" | "system_seed";
  updatedAt: string;
}
```

- [ ] **Step 2: Extend the report row contract**

Add fields to `ConversionEventRow`:

```ts
confirmedCount: number;
futureInvitedCount?: number;
futureConfirmedCount?: number;
eventStatus?: ConversionEventSnapshot["status"];
eventStageName?: string;
```

Do not remove old fields yet.

- [ ] **Step 3: Add timeline fact contracts**

```ts
export interface TimelineFactSnapshot {
  id: string;
  subjectKind: "deal" | "lead" | "contact";
  subjectId: string;
  factKind:
    | "stage_change"
    | "call"
    | "task_created"
    | "task_completed"
    | "meeting"
    | "conversion_event_visit"
    | "message_count";
  occurredAt: string;
  managerId: string | null;
  sourceId: string | null;
  dealId: string | null;
  leadId: string | null;
  contactId: string | null;
  externalEntityTypeId: number | null;
  externalEntityId: string | null;
  payloadJson: string | null;
}
```

- [ ] **Step 4: Reserve future AI quality contracts without implementing AI**

```ts
export interface QualityReviewSubjectSnapshot {
  id: string;
  subjectKind: "deal" | "lead" | "contact" | "timeline_fact";
  subjectId: string;
  sourceFactId: string | null;
  createdAt: string;
}
```

No AI scoring fields in this implementation. This only prevents a future schema rewrite.

- [ ] **Step 5: Run the contract build**

Run:

```bash
pnpm --filter @bitrix24-reporting/contracts build
```

Expected: build succeeds.

**Review Checkpoint 1:** Confirm no PII-bearing fields were added to public contracts.

---

### Task 2: SQLite Additive Schema

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/sqlite.test.ts`

- [ ] **Step 1: Add tables without dropping or replacing old data**

Add these `CREATE TABLE IF NOT EXISTS` blocks beside the current snapshot tables:

```sql
CREATE TABLE IF NOT EXISTS conversion_event_snapshots (
  id TEXT PRIMARY KEY,
  entity_type_id INTEGER NOT NULL,
  category_id INTEGER,
  title TEXT,
  event_date TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  stage_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  status TEXT NOT NULL,
  format_id TEXT,
  type_id TEXT,
  created_time TEXT NOT NULL,
  updated_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversion_event_scope_rules (
  id TEXT PRIMARY KEY,
  rule_kind TEXT NOT NULL,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversion_event_type_options (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category_id INTEGER,
  stage_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversion_event_visit_stage_history (
  id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL,
  entity_type_id INTEGER NOT NULL,
  category_id INTEGER,
  stage_id TEXT NOT NULL,
  stage_name TEXT,
  type_id INTEGER,
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_facts (
  id TEXT PRIMARY KEY,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  fact_kind TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  manager_id TEXT,
  source_id TEXT,
  deal_id TEXT,
  lead_id TEXT,
  contact_id TEXT,
  external_entity_type_id INTEGER,
  external_entity_id TEXT,
  payload_json TEXT
);
```

Extend the existing `conversion_event_visit_snapshots` table with `ensureColumn`:

```ts
ensureColumn(database, "conversion_event_visit_snapshots", "entity_type_id", "INTEGER");
ensureColumn(database, "conversion_event_visit_snapshots", "category_id", "INTEGER");
ensureColumn(database, "conversion_event_visit_snapshots", "event_id", "TEXT");
```

- [ ] **Step 2: Add indexes**

```sql
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_date
  ON conversion_event_snapshots (event_date);
CREATE INDEX IF NOT EXISTS idx_conversion_events_status_date
  ON conversion_event_snapshots (status, event_date);
CREATE INDEX IF NOT EXISTS idx_conversion_event_scope_rules_kind_value
  ON conversion_event_scope_rules (rule_kind, value, enabled);
CREATE INDEX IF NOT EXISTS idx_conversion_event_type_options_title
  ON conversion_event_type_options (title);
CREATE INDEX IF NOT EXISTS idx_conversion_event_visit_history_visit
  ON conversion_event_visit_stage_history (visit_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_conversion_event_visits_event_id
  ON conversion_event_visit_snapshots (event_id);
CREATE INDEX IF NOT EXISTS idx_timeline_facts_subject_time
  ON timeline_facts (subject_kind, subject_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_timeline_facts_deal_time
  ON timeline_facts (deal_id, occurred_at);
```

- [ ] **Step 3: Add repository methods**

Add interface and implementation methods:

```ts
upsertConversionEvents(rows: ConversionEventSnapshot[]): Promise<number>;
upsertConversionEventVisitStageHistory(
  rows: ConversionEventVisitStageHistorySnapshot[]
): Promise<number>;
replaceConversionEventScopeRules(rows: ConversionEventScopeRuleSnapshot[]): Promise<number>;
replaceConversionEventTypeOptions(rows: ConversionEventTypeOption[]): Promise<number>;
getAllConversionEvents(): Promise<ConversionEventSnapshot[]>;
getAllConversionEventVisitStageHistory(): Promise<ConversionEventVisitStageHistorySnapshot[]>;
getConversionEventScopeRules(): Promise<ConversionEventScopeRuleSnapshot[]>;
getConversionEventTypeOptions(): Promise<ConversionEventTypeOption[]>;
upsertTimelineFacts(rows: TimelineFactSnapshot[]): Promise<number>;
getTimelineFactsByDealIds(dealIds: string[]): Promise<TimelineFactSnapshot[]>;
```

- [ ] **Step 4: Add persistence tests**

In `apps/api/test/sqlite.test.ts`, add tests that:

- insert an event `31394` with date `2026-05-28`;
- insert scope rule `event_type_id=128` for `Мероприятие Привлечения`;
- insert visit `455358` linked to event `29402` and deal `156562`;
- insert history row `147080`;
- read all three back without any contact name/message text fields.

- [ ] **Step 5: Run SQLite test**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sqlite.test.ts
```

Expected: tests pass.

**Review Checkpoint 2:** Confirm migration is additive and old `conversion_event_visit_snapshots` readers still work.

---

### Task 3: Bitrix Client Extraction

**Files:**
- Modify: `apps/api/src/bitrix/selectors.ts`
- Modify: `apps/api/src/bitrix/client.ts`
- Test: `apps/api/test/bitrix-client.test.ts`, `apps/api/test/selectors.test.ts`

- [ ] **Step 1: Add safe selector builders**

Add builders for:

```ts
buildSmartProcessItemListParams({
  entityTypeId,
  modifiedAfter,
  select,
  filter,
  start
})
```

and:

```ts
buildSmartProcessStageHistoryParams({
  entityTypeId,
  ownerIds,
  categoryId,
  start
})
```

The stage history selector must select only:

```ts
["ID", "OWNER_ID", "CATEGORY_ID", "STAGE_ID", "STAGE_SEMANTIC_ID", "TYPE_ID", "CREATED_TIME"]
```

- [ ] **Step 2: Discover event and visit metadata**

In `BitrixClient`, replace the single-purpose conversion-visit discovery with a metadata object:

```ts
{
  eventEntityTypeId: 137,
  eventCategoryId: 12,
  visitEntityTypeId: 162,
  visitCategoryId: 14,
  eventDateFieldName: "ufCrm12_1645688127",
  eventStartFieldName: "ufCrm12_1689236985",
  eventEndFieldName: "ufCrm12_1689237021"
}
```

Still keep discovery by title as fallback, but warn if discovered ids differ from observed ids.

- [ ] **Step 3: Add client methods**

```ts
listConversionEvents(input: {
  eventIds?: string[];
  range?: {
    from: string;
    to: string;
  };
  attractionEventTypeIds?: string[];
  attractionEventFormatIds?: string[];
  modifiedAfter: string | null;
  signal?: AbortSignal;
}): Promise<ConversionEventSnapshot[]>;

listConversionEventTypeOptions(input: {
  signal?: AbortSignal;
}): Promise<ConversionEventTypeOption[]>;

listConversionEventVisitsV2(input: {
  modifiedAfter: string | null;
  reportYear: number;
  signal?: AbortSignal;
}): Promise<ConversionEventVisitSnapshotV2[]>;

listConversionEventVisitStageHistory(input: {
  visitIds: string[];
  categoryId?: number;
  signal?: AbortSignal;
}): Promise<ConversionEventVisitStageHistorySnapshot[]>;
```

`listConversionEvents` must support two fetch modes:

- explicit `eventIds` discovered from scoped visits;
- configured planned inventory by date range and attraction event criteria.

It must not fetch and persist every event from smart process `137`.

- [ ] **Step 4: Preserve old method**

Keep `listConversionEventVisits` as a compatibility adapter that calls `listConversionEventVisitsV2` and maps to the old contract.

- [ ] **Step 5: Add client tests**

Mock Bitrix responses for:

- event `31394`;
- event stages `DT137_12:UC_9FT1X8`;
- visit stages `DT162_14:NEW`, `PREPARATION`, `SUCCESS`, `FAIL`;
- visit history row `147080`.

Test that no raw title containing a client name is required to determine the event date when the dedicated date field exists.

Test that event-type options are fetched from smart process `156` and expose ids/titles such as `128 / Мероприятие Привлечения...` without selecting them automatically.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/bitrix-client.test.ts apps/api/test/selectors.test.ts
```

Expected: tests pass.

**Review Checkpoint 3:** Re-run a sanitized real Bitrix read-only sample before writing sync data.

---

### Task 4: Module Settings For Planned Event Types

**Files:**
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/api/test/service.test.ts`, `apps/api/test/http.test.ts`, `apps/web/src/lib/api-client.test.ts`, `apps/web/src/proto/proto-app.test.tsx`

- [ ] **Step 1: Add settings service contract**

Expose:

```ts
getConversionEventTypeSettings(): Promise<{
  options: ConversionEventTypeOption[];
  selectedTypeIds: string[];
  warnings: string[];
}>;

replaceConversionEventTypeSettings(input: {
  selectedTypeIds: string[];
  updatedAt: string;
}): Promise<{
  options: ConversionEventTypeOption[];
  selectedTypeIds: string[];
  warnings: string[];
}>;
```

`selectedTypeIds` must write `conversion_event_scope_rules` with `ruleKind="event_type_id"` and `source="module_settings"`.

- [ ] **Step 2: Add API endpoints**

Add authenticated module settings endpoints:

```http
GET /api/settings/conversion-event-types
PUT /api/settings/conversion-event-types
```

Only module leaders or super admins can mutate settings. Ordinary module users may read settings if they can view the module.

- [ ] **Step 3: Add local UI in личный кабинет**

Replace the placeholder module settings card with a compact settings section:

- label: `Плановые мероприятия привлечения`;
- multiselect options from Bitrix event types;
- selected chips show event-type titles;
- save button persists selected ids;
- helper copy: `Эти типы нужны только для планирования и нулей по приглашениям. Постфактум мероприятия считаются по связям со сделками и контактами.`

Keep this in the existing `Личный кабинет` surface, not on the report page.

- [ ] **Step 4: Add tests**

Test:

- options include `128 / Мероприятие Привлечения...` when available;
- saving `[128, 52]` writes exactly those scope rules;
- unselected type `64` does not create a planned zero row;
- linked demo events still count in participant metrics even if their event type is not selected.

- [ ] **Step 5: Run settings tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/service.test.ts apps/api/test/http.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/proto-app.test.tsx
```

Expected: tests pass.

**Review Checkpoint 4:** Confirm settings UX makes it impossible to accidentally include all events from other modules.

---

### Task 5: Sync Backfill And Coverage

**Files:**
- Modify: `apps/api/src/domain/sync.ts`
- Test: `apps/api/test/sync.test.ts`

- [ ] **Step 1: Add coverage streams**

```ts
export const CONVERSION_EVENTS_COVERAGE_STREAM = "conversion_events";
export const CONVERSION_EVENTS_COVERAGE_VERSION = "conversion-events-v1";
export const CONVERSION_EVENT_VISIT_HISTORY_COVERAGE_STREAM =
  "conversion_event_visit_stage_history";
export const CONVERSION_EVENT_VISIT_HISTORY_COVERAGE_VERSION =
  "conversion-event-visit-stage-history-v1";
```

- [ ] **Step 2: Extend sync interfaces**

Add optional client methods and repository methods from Tasks 2 and 3.

- [ ] **Step 3: Backfill order**

During sync:

1. Fetch stage catalogs.
2. Fetch deals/stage history/activities/calls as today.
3. Fetch conversion visits from smart process `162`.
4. Keep only visits linked to scoped attraction deals by `parentId2`, or linked through `contactId` to scoped attraction deals when direct deal linkage is missing/wrong.
5. Build a unique scoped event id set from `parentId137`.
6. Fetch conversion events from smart process `137` for the scoped participant event ids.
7. Fetch planned inventory events from smart process `137` by event date and explicit attraction event criteria, so planned events with zero visits are visible.
8. Merge participant events and planned inventory events by event id.
9. Fetch visit stage history for all scoped visits plus existing scoped visit ids when history coverage is missing.
10. Write all in the existing `runSnapshotTransaction` when available.
11. Mark coverage only after all writes succeed.

- [ ] **Step 4: Delta behavior**

For deltas, use `updatedTime` for visits first, then fetch events referenced by changed scoped visits. Also refresh planned inventory for the rolling future window because zero-visit events cannot be discovered from visits. For visit stage history, fetch history for changed/new scoped visits and for scoped visits attached to events in the report lookback.

- [ ] **Step 5: Failure behavior**

Access denied or timeout for event/visit history must not fail the full sync. It must:

- finish sync with diagnostics;
- not mark the missing coverage stream;
- keep the UI warning visible.

- [ ] **Step 6: Add sync tests**

Add tests for:

- does not backfill every event from smart process `137`;
- backfills only event ids discovered from scoped attraction visits when `conversion_events` coverage is missing;
- includes planned attraction events with zero visits when they match the attraction event configuration and date window;
- excludes planned non-attraction events with zero visits;
- keeps visits linked to attraction deals by `parentId2`;
- keeps visits linked through `contactId` when direct deal linkage is missing;
- drops visits linked only to non-attraction deals;
- backfills visit history when `conversion_event_visit_stage_history` coverage is missing;
- does not mark coverage when history fetch fails;
- keeps existing conversion visit snapshot behavior.

- [ ] **Step 7: Run sync tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sync.test.ts
```

Expected: tests pass.

**Review Checkpoint 5:** Inspect sync diff for idempotence and no direct Bitrix reads in report services.

---

### Task 6: Event Lifecycle Engine

**Files:**
- Create: `apps/api/src/domain/conversion-event-lifecycle.ts`
- Create: `apps/api/src/domain/conversion-event-scope.ts`
- Modify: `apps/api/src/domain/conversion-events.ts`
- Test: `apps/api/test/conversion-events.test.ts`

- [ ] **Step 1: Create scope resolver**

Export:

```ts
export function resolveConversionEventScope(input: {
  event: ConversionEventSnapshot;
  scopeRules: ConversionEventScopeRuleSnapshot[];
  participantVisitCount: number;
}): {
  participantMetrics: boolean;
  plannedInventory: boolean;
  reason: "linked_participant" | "allowed_event_type" | "allowed_format" | "out_of_scope";
};
```

Rules:

- participant metrics are allowed when `participantVisitCount > 0`;
- planned inventory is allowed only when an enabled rule matches `event.typeId`/`parentId156`, or another explicitly configured rule;
- category `12`, date, stage, or title alone are not enough;
- unclassified future events should be diagnostic candidates, not report rows.

- [ ] **Step 2: Create lifecycle resolver**

Export:

```ts
export function resolveVisitLifecycle(input: {
  visit: ConversionEventVisitSnapshotV2 | ConversionEventVisitSnapshot;
  history: ConversionEventVisitStageHistorySnapshot[];
  event: ConversionEventSnapshot | null;
  now: string;
}): {
  invited: boolean;
  confirmed: boolean;
  attended: boolean;
  refused: boolean;
  missed: boolean;
  currentStageName: string;
  firstInvitedAt: string | null;
  firstConfirmedAt: string | null;
  firstAttendedAt: string | null;
  finalStageName: string;
};
```

- [ ] **Step 3: Implement stage mapping**

Use normalized stage names and ids:

- `DT162_14:NEW` or `Приглашен` -> invited;
- `DT162_14:PREPARATION` or `Пойду` -> confirmed;
- `DT162_14:SUCCESS` or `На мероприятии` -> attended;
- `DT162_14:FAIL` or `Отказ` -> refused.

Attendance overrides refusal when attendance happened later.

- [ ] **Step 4: Update report builder**

`buildConversionEventsReport` must accept optional:

```ts
events?: ConversionEventSnapshot[];
visitStageHistory?: ConversionEventVisitStageHistorySnapshot[];
now?: string;
```

If these are absent, it must keep old behavior.

- [ ] **Step 5: Add lifecycle and scope tests**

Add tests:

- event with `typeId=128` and zero visits -> planned inventory row;
- event with category `12` but no enabled type rule -> excluded from planned inventory and emitted as diagnostic candidate;
- event with participants but no type rule -> included in participant metrics, not automatically promoted to planned inventory;
- NEW only -> invited, not missed before event, missed after event.
- NEW -> PREPARATION -> confirmed.
- NEW -> FAIL -> SUCCESS -> attended, not missed.
- FAIL only after event -> missed.
- Future planned event counts `futureInvitedCount` and `futureConfirmedCount`.

- [ ] **Step 6: Run conversion tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/conversion-events.test.ts
```

Expected: tests pass.

**Review Checkpoint 6:** Validate the lifecycle with the real examples from Bitrix before touching UI.

---

### Task 7: Service And Report Integration

**Files:**
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Test: `apps/api/test/service.test.ts`, `apps/api/test/http.test.ts`

- [ ] **Step 1: Load canonical event data in service**

In `getConversionEventsReport`, load:

```ts
getAllConversionEvents()
getAllConversionEventVisits()
getAllConversionEventVisitStageHistory()
```

Keep old `getAllConversionEventVisits` as fallback.

- [ ] **Step 2: Update coverage warning**

Conversion event report is considered complete only when all are covered:

- `conversion_events`;
- `conversion_event_visits`;
- `conversion_event_visit_stage_history`.

If any is missing, return the existing warning plus a concise diagnostic stream label.

- [ ] **Step 3: Add next-week section**

Extend report response with:

```ts
upcomingRows: ConversionEventRow[];
```

For `upcomingRows`, use next calendar week in app timezone and current visit statuses.

- [ ] **Step 4: Add service tests**

Test:

- report warns if event history coverage is absent;
- `Гостевая встреча 28.05.` with zero visits returns zero invited/confirmed, not an error;
- `Гостевая встреча 28.05.` appears in `upcomingRows` with zero invited/confirmed when it matches the attraction event configuration;
- `Гостевая встреча 28.05.` is excluded from participant conversion counts when there are no scoped visits;
- canceled events are excluded from upcoming rows;
- historical rows still include old snapshot visits when canonical tables are unavailable.

- [ ] **Step 5: Run service/http tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/service.test.ts apps/api/test/http.test.ts
```

Expected: tests pass.

**Review Checkpoint 7:** Confirm API compatibility for existing frontend consumers.

---

### Task 8: Timeline Facts Foundation

**Files:**
- Create: `apps/api/src/domain/timeline-facts.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/server/service.ts`
- Test: `apps/api/test/reporting.test.ts`, `apps/api/test/sqlite.test.ts`

- [ ] **Step 1: Build timeline facts from existing snapshots**

Create pure functions:

```ts
buildDealStageTimelineFacts(input: {
  stageHistory: StageHistorySnapshot[];
  stageCatalog: StageCatalogEntry[];
}): TimelineFactSnapshot[];

buildCallTimelineFacts(input: {
  calls: CallSnapshot[];
  activities: ActivitySnapshot[];
  activityBindings: ActivityBindingSnapshot[];
}): TimelineFactSnapshot[];

buildTaskTimelineFacts(input: {
  activities: ActivitySnapshot[];
}): TimelineFactSnapshot[];

buildMeetingTimelineFacts(input: {
  activities: ActivitySnapshot[];
}): TimelineFactSnapshot[];

buildConversionEventTimelineFacts(input: {
  visits: ConversionEventVisitSnapshotV2[];
  visitStageHistory: ConversionEventVisitStageHistorySnapshot[];
}): TimelineFactSnapshot[];
```

Each fact id must be deterministic:

- `stage:${dealId}:${historyId}`;
- `call:${callId}`;
- `task-created:${activityId}`;
- `task-completed:${activityId}`;
- `meeting:${activityId}`;
- `event-visit:${visitId}`;

- [ ] **Step 2: Do not rewrite current timeline UI in the same step**

First, persist facts and expose internal getters. Keep existing `stageTimeline` output unchanged.

- [ ] **Step 3: Add tests**

Test deal `156562`-style linkage:

- deal stage changes;
- calls attached through activity or binding;
- event visit attached through `dealId`;
- no PII in `payloadJson`.

- [ ] **Step 4: Run focused tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/reporting.test.ts apps/api/test/sqlite.test.ts
```

Expected: tests pass.

**Review Checkpoint 8:** Decide whether to switch the visible deal timeline in this PR or leave it as internal groundwork for a second PR.

---

### Task 9: Frontend Report Update

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/web/src/lib/api-client.test.ts`, `apps/web/src/proto/proto-app.test.tsx`

- [ ] **Step 1: Normalize new fields**

Update conversion report normalizer for:

```ts
confirmedCount
futureInvitedCount
futureConfirmedCount
eventStatus
eventStageName
upcomingRows
```

- [ ] **Step 2: Update conversion events card**

Show:

- invited;
- confirmed;
- attended;
- no-show;
- next-step conversion;
- upcoming next-week invited/confirmed.

Do not add explanatory wall text in the UI. Tooltips are acceptable for compact metric labels.

- [ ] **Step 3: Preserve warning behavior**

If coverage is missing, show the current warning style and keep zero-state clear.

- [ ] **Step 4: Run web tests**

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/proto-app.test.tsx
```

Expected: tests pass.

**Review Checkpoint 9:** UI screenshot review at desktop and narrow viewport before merge.

---

### Task 10: Message Counts And Future AI Readiness

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `docs/modules/attraction/REPORT_REGISTRY.md`
- Test: `apps/api/test/sqlite.test.ts`

- [ ] **Step 1: Do not implement raw message ingestion here**

Keep message work limited to count-safe schema and documentation. The prior research says Bitrix-only message counting can use Open Lines history, but exact sent/received split may be unreliable for Wazzup/OLChat without external provider data.

- [ ] **Step 2: Add optional count fact table only if timeline facts need it now**

If needed for timeline consistency, add:

```sql
CREATE TABLE IF NOT EXISTS message_count_facts (
  id TEXT PRIMARY KEY,
  channel_key TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  crm_entity_type TEXT,
  crm_entity_id TEXT,
  manager_id TEXT,
  source_id TEXT,
  occurred_date TEXT NOT NULL,
  sent_count INTEGER NOT NULL,
  received_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  confidence TEXT NOT NULL
);
```

If not needed for the event PR, defer this table and only document the future link to `timeline_facts`.

- [ ] **Step 3: Reserve AI quality namespace**

Do not store transcripts or message text. Only reserve ids and source fact references for future tables.

**Review Checkpoint 10:** Explicit privacy review before any AI quality implementation.

---

### Task 11: Backfill, Parity, And Production Safety

**Files:**
- Modify as needed after previous tasks.
- Test: full relevant API/Web suites.

- [ ] **Step 1: Local dry-run**

Run sync locally or in a disposable DB. Compare:

- old conversion visit count;
- new event count;
- new visit count;
- scoped event count, which must be less than or equal to total Bitrix event count and must include only participant-linked events plus planned events selected in module settings;
- visit history row count;
- existing sales/activity report totals.

- [ ] **Step 2: Production backup before mutating production data**

On VPS, before sync that mutates production SQLite:

```bash
cp /opt/bitrix24-reporting/data/bitrix24-attraction.db \
  /opt/bitrix24-reporting/data/bitrix24-attraction.db.backup-YYYYMMDD-HHMMSS
```

- [ ] **Step 3: Production sync**

Run sync through the app’s existing sync path, not ad hoc DB writes.

- [ ] **Step 4: Production smoke**

Verify:

- `/api/health`;
- `/api/reports/conversion-events`;
- `/api/settings/conversion-event-types`;
- sales report still loads;
- activity/calls report still loads;
- `Гостевая встреча 28.05.` appears in upcoming rows with zero invited/confirmed only when its event type is selected in module settings.

- [ ] **Step 5: Full verification before PR/merge**

Run, if feasible:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm lint
pnpm typecheck
```

Expected: all pass.

**Review Checkpoint 11:** Fresh reviewer pass focused on data correctness, privacy, and report compatibility.

---

## Rollout Strategy

1. Ship additive schema and event-type settings UI/API first.
2. Select planned attraction event types in the module account settings.
3. Backfill data and inspect sanitized counts.
4. Switch conversion events report to canonical lifecycle.
5. Keep old conversion visit table semantics until parity is proven.
6. Add timeline facts internally.
7. Switch visible timelines only after a separate parity check.
8. Defer raw message/AI quality ingestion until provider and privacy rules are explicitly approved.

## Non-Goals For This Plan

- Do not store raw messages.
- Do not store call recordings or transcripts.
- Do not expose contact names, phone numbers, emails, or raw Bitrix payloads.
- Do not replace production SQLite manually.
- Do not rewrite all reports in one risky change.
- Do not change the attraction manager whitelist unless a separate reviewed issue requests it.
