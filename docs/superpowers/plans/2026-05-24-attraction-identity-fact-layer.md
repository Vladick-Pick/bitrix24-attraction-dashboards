# Attraction Identity And Fact Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the reporting foundation into a canonical local analytics layer where lead, contact, deal, stage history, calls, tasks, meetings, conversion events, and future message counts are linked to one analytical subject model and can power any report consistently.

**Architecture:** Keep existing snapshot tables and APIs as source/fallback. Add normalized identity and fact tables, backfill them from current snapshots first, compare report parity, then migrate reports gradually. Conversion events are the first new domain implemented on top of the fact layer, not a separate reporting island.

**Tech Stack:** Bitrix24 REST, TypeScript, Vitest, SQLite via `better-sqlite3`, existing `@bitrix24-reporting/api`, `@bitrix24-reporting/contracts`, and web prototype dashboard.

---

## Current State

The project already stores useful raw-safe snapshots:

- `deal_snapshots`: deals, contact id, lead id, category, manager, source, fields used by reports.
- `lead_snapshots`: leadgen-side snapshot data.
- `stage_history_snapshots`: deal stage transitions.
- `activity_snapshots`: tasks, meetings, call activities.
- `activity_binding_snapshots`: extra CRM bindings for activities.
- `call_snapshots`: Voximplant call stats.
- `deal_meeting_date_changes`: meeting date field changes.
- `conversion_event_visit_snapshots`: current event-visit placeholder, currently empty in production.

This is close to the right raw layer, but not yet a canonical analytics layer:

- reports join and interpret these tables independently;
- calls/tasks/meetings are linked to stages differently in different code paths;
- contact/deal/lead identity is not normalized as a reusable subject graph;
- there is no single event/fact stream for timelines;
- conversion events and messages would become more report-specific logic if added directly.

## Target Data Model

Use three levels:

1. **Raw snapshots**  
   Existing tables stay. They are the cached Bitrix source layer.

2. **Canonical analytics layer**  
   New identity and fact tables. These are built from snapshots and later directly maintained by sync.

3. **Report projections**  
   Reports read canonical facts. Existing reports stay on snapshots until parity is proven.

## Canonical Tables

### `identity_links`

One row per known analytical relation.

Required columns:

```sql
identity_id TEXT PRIMARY KEY,
module_key TEXT NOT NULL,
deal_id TEXT,
lead_id TEXT,
contact_id TEXT,
deal_category_id TEXT,
lead_category_id TEXT,
current_manager_id TEXT,
current_stage_id TEXT,
source_id TEXT,
created_at TEXT,
updated_at TEXT,
link_confidence TEXT NOT NULL,
link_reason TEXT NOT NULL
```

Purpose:

- answer “which deal/contact/lead is this person/entity connected to?”;
- provide stable scope for attraction reports;
- allow multiple deals per contact without pretending everything is one row;
- support future cross-report identity resolution.

### `deal_stage_facts`

Canonical stage transitions for deals.

Required columns:

```sql
fact_id TEXT PRIMARY KEY,
source_system TEXT NOT NULL,
source_entity_id TEXT NOT NULL,
deal_id TEXT NOT NULL,
contact_id TEXT,
lead_id TEXT,
category_id TEXT,
stage_id TEXT NOT NULL,
stage_name TEXT,
stage_semantic_id TEXT,
entered_at TEXT NOT NULL,
left_at TEXT,
manager_id TEXT,
source_id TEXT,
sort_order INTEGER,
payload_json TEXT
```

Purpose:

- one source for stage timelines;
- one function to resolve `stage_id_at_event`;
- one basis for funnel progression and SLA reports.

### `deal_touchpoint_facts`

Canonical event stream for timelines and activity reports.

Required columns:

```sql
fact_id TEXT PRIMARY KEY,
kind TEXT NOT NULL,
source_system TEXT NOT NULL,
source_entity_type TEXT NOT NULL,
source_entity_id TEXT NOT NULL,
occurred_at TEXT NOT NULL,
deal_id TEXT,
contact_id TEXT,
lead_id TEXT,
manager_id TEXT,
source_id TEXT,
stage_id_at_event TEXT,
stage_name_at_event TEXT,
link_confidence TEXT NOT NULL,
link_reason TEXT NOT NULL,
payload_json TEXT
```

Allowed `kind` values for this plan:

- `call`;
- `task_created`;
- `task_completed`;
- `meeting`;
- `meeting_date_changed`;
- `conversion_event_visit`;
- `message_count` later, count-only;
- `comment_quality_signal` later, AI-only projection.

Purpose:

- one timeline source for deal detail;
- one source for activity/count reports;
- one place to handle “call attached to contact, not deal” logic;
- one future input for AI quality review.

### `event_snapshots`

Conversion event itself.

Required columns:

```sql
event_id TEXT PRIMARY KEY,
entity_type_id INTEGER NOT NULL,
category_id INTEGER,
title TEXT,
event_date TEXT NOT NULL,
start_at TEXT,
end_at TEXT,
stage_id TEXT NOT NULL,
stage_name TEXT,
status TEXT NOT NULL,
event_type_id TEXT,
event_type_label TEXT,
format_id TEXT,
created_time TEXT NOT NULL,
updated_time TEXT NOT NULL
```

Purpose:

- event inventory;
- planned zero-invitation monitoring;
- link target for event visits.

### `event_visit_facts`

Participant lifecycle for an event visit.

Required columns:

```sql
visit_id TEXT PRIMARY KEY,
event_id TEXT,
deal_id TEXT,
contact_id TEXT,
lead_id TEXT,
manager_id TEXT,
source_id TEXT,
current_stage_id TEXT NOT NULL,
current_stage_name TEXT,
invited_at TEXT,
confirmed_at TEXT,
attended_at TEXT,
refused_at TEXT,
final_status TEXT NOT NULL,
event_date TEXT,
stage_id_at_event TEXT,
link_confidence TEXT NOT NULL,
link_reason TEXT NOT NULL,
payload_json TEXT
```

Purpose:

- count invited/confirmed/attended/no-show;
- link event visits to deal/contact;
- write a corresponding `deal_touchpoint_facts.kind = conversion_event_visit`.

### `event_visit_stage_history`

Immutable Bitrix stage history for visits.

Required columns:

```sql
history_id TEXT PRIMARY KEY,
visit_id TEXT NOT NULL,
entity_type_id INTEGER NOT NULL,
category_id INTEGER,
stage_id TEXT NOT NULL,
stage_name TEXT,
type_id INTEGER,
changed_at TEXT NOT NULL
```

Purpose:

- prove lifecycle transitions;
- avoid relying only on current visit status.

### `module_event_type_settings`

User-managed planned-event configuration.

Required columns:

```sql
module_key TEXT NOT NULL,
event_type_id TEXT NOT NULL,
event_type_label TEXT NOT NULL,
enabled INTEGER NOT NULL,
updated_at TEXT NOT NULL,
PRIMARY KEY (module_key, event_type_id)
```

Purpose:

- module leaders choose which Bitrix event types count as planned attraction events;
- selected types affect only planning and zero-invitation monitoring;
- post-analysis still works from real deal/contact links.

### Future `message_count_facts`

Not implemented in this phase. Reserve the concept only:

- counts by provider/channel/date/manager/entity;
- no raw message text;
- no message body persistence without separate privacy decision.

## Linking Rules

### Deal/Contact/Lead Identity

Build `identity_links` from `deal_snapshots` first:

1. direct deal row creates `identity_id = deal:{deal_id}`;
2. attach `contact_id` and `lead_id` when present;
3. preserve deal category, current manager, current source, current stage;
4. do not collapse multiple deals for the same contact into one row;
5. add lookup indexes by `deal_id`, `contact_id`, `lead_id`.

For later cross-deal reports, contact can be a grouping key, not a replacement for deal identity.

### Stage At Event

Resolve `stage_id_at_event` once:

1. find deal stage row where `entered_at <= occurred_at`;
2. use latest such row;
3. if no row exists, use current deal stage with `link_confidence = low`;
4. store `stage_id_at_event` on every touchpoint fact.

### Calls

Build touchpoints from `call_snapshots`:

1. primary link: `call.crm_activity_id -> activity_snapshots.id -> owner_type_id/owner_id`;
2. if owner is deal, link directly;
3. if owner is contact, find active/scoped attraction deal for contact at call time;
4. use `activity_binding_snapshots` as fallback;
5. preserve current activity report behavior that intentionally counts calls attached to related contacts/deals;
6. payload stores only count-safe fields: duration, call type, failed code, connected flag.

### Tasks And Meetings

Build touchpoints from `activity_snapshots`:

1. task created fact at `created_time`;
2. task completed fact at `completed_time` when completed;
3. meeting fact for completed or scheduled meeting according to current report semantics;
4. meeting date change fact from `deal_meeting_date_changes`;
5. link by owner deal first, then contact fallback if needed.

### Conversion Events

Events are not a separate reporting island:

1. `event_snapshots` stores event inventory.
2. `event_visit_stage_history` stores Bitrix lifecycle.
3. `event_visit_facts` derives invited/confirmed/attended/refused/final status.
4. `deal_touchpoint_facts` gets one `conversion_event_visit` fact per linked visit.
5. Reports use event facts plus touchpoints, not ad hoc Bitrix interpretations.

Planning scope:

- `module_event_type_settings` selected ids define planned event inventory.
- selected planned types show events even with zero visits.

Post-analysis scope:

- any event linked to an attraction deal/contact through a visit can be analyzed, even if its type is not selected for planning.
- this covers demo-stage events where managers can select arbitrary events.

## Implementation Tasks

### Task 1: Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Test: `pnpm --filter @bitrix24-reporting/contracts build`

- [ ] Add `IdentityLinkSnapshot`.
- [ ] Add `DealStageFactSnapshot`.
- [ ] Add `DealTouchpointFactSnapshot`.
- [ ] Add `EventSnapshot`.
- [ ] Add `EventVisitFactSnapshot`.
- [ ] Add `EventVisitStageHistorySnapshot`.
- [ ] Add `ModuleEventTypeSetting`.
- [ ] Add `ConversionEventTypeOption`.
- [ ] Confirm no raw names/phones/emails/message text fields are exposed.

### Task 2: Additive SQLite Schema

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/sqlite.test.ts`

- [ ] Create tables listed above.
- [ ] Add indexes:
  - `identity_links(deal_id)`;
  - `identity_links(contact_id)`;
  - `identity_links(lead_id)`;
  - `deal_stage_facts(deal_id, entered_at)`;
  - `deal_touchpoint_facts(deal_id, occurred_at)`;
  - `deal_touchpoint_facts(contact_id, occurred_at)`;
  - `deal_touchpoint_facts(kind, occurred_at)`;
  - `event_snapshots(event_date)`;
  - `event_visit_facts(event_id)`;
  - `event_visit_facts(deal_id)`;
  - `event_visit_stage_history(visit_id, changed_at)`.
- [ ] Add repository upsert/getter methods for each table.
- [ ] Keep existing tables and getters unchanged.
- [ ] Add tests proving old snapshot persistence still works.

### Task 3: Fact Builder From Existing Snapshots

**Files:**
- Create: `apps/api/src/domain/identity-links.ts`
- Create: `apps/api/src/domain/stage-facts.ts`
- Create: `apps/api/src/domain/touchpoint-facts.ts`
- Test: `apps/api/test/identity-facts.test.ts`

- [ ] Build `identity_links` from `deal_snapshots` and `lead_snapshots`.
- [ ] Build `deal_stage_facts` from `stage_history_snapshots`.
- [ ] Compute `left_at` from next stage transition.
- [ ] Build call touchpoints from `call_snapshots`, `activity_snapshots`, `activity_binding_snapshots`.
- [ ] Build task/meeting touchpoints from `activity_snapshots`.
- [ ] Store deterministic ids:
  - `identity:deal:{dealId}`;
  - `stage:deal:{dealId}:{historyId}`;
  - `call:{callId}`;
  - `task-created:{activityId}`;
  - `task-completed:{activityId}`;
  - `meeting:{activityId}`;
  - `meeting-date:{dealId}:{changeId}`.
- [ ] Store `stage_id_at_event` on touchpoints.
- [ ] Add tests for direct deal link, contact fallback, and missing-stage fallback.

### Task 4: Backfill Orchestration

**Files:**
- Modify: `apps/api/src/domain/sync.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/sync.test.ts`

- [ ] After current snapshot sync completes, build canonical facts inside the same transaction where possible.
- [ ] Add coverage streams:
  - `identity_links`;
  - `deal_stage_facts`;
  - `deal_touchpoint_facts`.
- [ ] Backfill from current local snapshots before changing Bitrix sync behavior.
- [ ] Do not mark coverage if any canonical write fails.
- [ ] Existing reports must still work if fact backfill fails; expose warning instead.

### Task 5: Parity Harness

**Files:**
- Create: `apps/api/src/domain/fact-parity.ts`
- Test: `apps/api/test/fact-parity.test.ts`

- [ ] Compare old activity report counts vs touchpoint facts:
  - calls by manager;
  - connected calls;
  - tasks created;
  - tasks completed;
  - meetings.
- [ ] Compare old deal timeline vs facts for selected deal ids.
- [ ] Output explainable diffs:
  - direct deal link;
  - contact fallback;
  - activity binding fallback;
  - missing link.
- [ ] Do not switch reports until diffs are understood.

### Task 6: Bitrix Event Extraction

**Files:**
- Modify: `apps/api/src/bitrix/client.ts`
- Modify: `apps/api/src/bitrix/selectors.ts`
- Test: `apps/api/test/bitrix-client.test.ts`

- [ ] Fetch event type options from smart process `156`.
- [ ] Fetch events from smart process `137`.
- [ ] Fetch visits from smart process `162`.
- [ ] Fetch visit stage history through `crm.stagehistory.list`.
- [ ] Fetch planned events only for selected module event types and date window.
- [ ] Fetch participant events from linked visits regardless of selected type.
- [ ] Keep payload sanitized.

### Task 7: Module Settings UI/API

**Files:**
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/api/test/http.test.ts`, `apps/api/test/service.test.ts`, `apps/web/src/proto/proto-app.test.tsx`

- [ ] Add `GET /api/settings/conversion-event-types`.
- [ ] Add `PUT /api/settings/conversion-event-types`.
- [ ] Allow mutation only for module leader/super admin.
- [ ] Add multiselect in `Личный кабинет -> Настройки модуля`.
- [ ] Selected types affect only planned zero-invitation inventory.
- [ ] Linked participant analytics ignores this setting and follows real deal/contact links.

### Task 8: Event Fact Builder

**Files:**
- Create: `apps/api/src/domain/event-facts.ts`
- Test: `apps/api/test/event-facts.test.ts`

- [ ] Build `event_snapshots`.
- [ ] Build `event_visit_stage_history`.
- [ ] Build `event_visit_facts`.
- [ ] Write `deal_touchpoint_facts.kind = conversion_event_visit`.
- [ ] Lifecycle:
  - invited when visit exists or entered `Приглашен`;
  - confirmed when history contains `Пойду`;
  - attended when history contains `На мероприятии`;
  - no-show after event if no attended state;
  - attended overrides earlier refusal.
- [ ] Test demo event linked to attraction deal but not selected in settings still appears in post-analysis.
- [ ] Test selected planned event with zero visits appears in planning inventory.

### Task 9: First Report Migration

**Files:**
- Modify: `apps/api/src/domain/conversion-events.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/api/test/conversion-events.test.ts`, `apps/api/test/service.test.ts`

- [ ] Migrate conversion events report to `event_snapshots`, `event_visit_facts`, `deal_touchpoint_facts`.
- [ ] Show:
  - planned events next week;
  - invited;
  - confirmed;
  - attended;
  - no-show;
  - next funnel step;
  - breakdown by manager/source.
- [ ] Keep old `conversion_event_visit_snapshots` fallback until production parity is proven.

### Task 10: Timeline Migration

**Files:**
- Modify: `apps/api/src/domain/reporting.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Test: `apps/api/test/reporting.test.ts`, `apps/api/test/activities-workload.test.ts`, `apps/api/test/calls-workload.test.ts`

- [ ] Add fact-backed timeline builder.
- [ ] Keep current report output contract.
- [ ] Compare old timeline and fact timeline for sampled deals.
- [ ] Switch deal-detail timeline only after parity.
- [ ] Do not change activity report semantics until parity confirms counts.

### Task 11: Future Message Counts

**Files:**
- No implementation in this phase unless explicitly resumed.

- [ ] Keep message research documented.
- [ ] Later add `message_count_facts`.
- [ ] Store counts only:
  - provider;
  - channel;
  - direction if reliable;
  - deal/contact link;
  - manager;
  - date/time bucket.
- [ ] Do not store message text.

### Task 12: Future AI Quality Layer

**Files:**
- No AI implementation in this phase.

- [ ] Add later tables that reference `deal_touchpoint_facts.fact_id`.
- [ ] AI can score calls/messages/comments/field quality by fact id.
- [ ] Keep AI outputs separate from canonical facts.
- [ ] Do not add transcript/message storage without a privacy review.

## Rollout

1. Add schema and repository methods.
2. Build facts from existing snapshots.
3. Run parity harness against current reports.
4. Add event extraction and module settings.
5. Build event facts.
6. Migrate conversion event report first.
7. Backfill production after DB backup.
8. Verify production counts and warnings.
9. Migrate timeline and other reports only after parity.

## Verification

Run focused checks after each task:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sqlite.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/identity-facts.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/event-facts.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/conversion-events.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/proto/proto-app.test.tsx
pnpm lint
pnpm typecheck
```

Production smoke after deploy:

- `/api/health`;
- existing sales report;
- existing activity/calls report;
- conversion events report;
- module settings endpoint;
- sampled deal timeline.

## Non-Goals

- No destructive rebuild of production SQLite.
- No replacement of old tables before parity.
- No raw PII.
- No raw messages.
- No AI transcript ingestion.
- No change to attraction manager whitelist.

