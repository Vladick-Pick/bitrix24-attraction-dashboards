# Bitrix Data Pipeline Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make attraction dashboards trustworthy for both historical year-long cohorts and current operational control updates.

**Architecture:** Keep dashboards reading only the local SQLite snapshot; Bitrix REST remains a separate sync/audit operation. Split the pipeline into exact source-of-truth scope selection, versioned historical coverage, independent delta cursors per data stream, and report-level completeness warnings so the UI never silently turns missing data into zeros.

**Tech Stack:** TypeScript, Node.js, Express, better-sqlite3, Vitest, Bitrix24 REST (`crm.deal.list`, `crm.activity.list`, `voximplant.statistic.get`, `crm.stagehistory.list`), local SQLite.

---

## Confirmed Bitrix Contracts

Context7 source: `/bitrix-tools/b24-rest-docs`.

- Deals: use `crm.deal.list` with `filter`, `select`, `order`, `start`; response supports `next`/`total`.
- Activity by many deals: use `crm.activity.list` with `filter.BINDINGS = [{ OWNER_TYPE_ID: 2, OWNER_ID }]`; paginate with `start`/`next`.
- Calls: use `voximplant.statistic.get` with `FILTER.CRM_ACTIVITY_ID`; paginate with `start`/`next`.
- Stage history: use `crm.stagehistory.list` with `entityTypeId: 2`, `filter.OWNER_ID` or category filter, and pagination.

## Non-Negotiable Data Rules

- Scope for the product report is category `10`, attraction managers `78,11234,7824,6994,72,2236,2764`, and the agreed year/cohort range.
- Do not use UI `dealDetails` as the source selection for data audits or backfills.
- Do not fetch/store PII: no deal titles, names, phones, emails, comments, or contact personal fields.
- A report can show zero only after the local snapshot coverage proves that stream/range/provider was synced.
- Every sync must pull new deltas if Bitrix has newer deals, activities, calls, or stage history.

## Dependency Graph For Async Work

Parallel first wave:

- Task 1 can run alone: read-only audit tool.
- Task 2 can run alone: SQLite coverage/cursor schema and repository methods.
- Task 5 can run alone: report detail filtering and task classification tests.

Second wave after Task 2:

- Task 3 depends on Task 2: sync planner with coverage and independent cursors.
- Task 4 depends on Task 3: call-stat completeness retry window.
- Task 6 depends on Task 2 and Task 5: report warnings/data completeness.

Final wave:

- Task 7 depends on Tasks 1-6: integration verification and live-data audit.
- Task 8 depends on Task 7: cleanup, docs, review.

---

### Task 1: Read-Only Scope Audit Command

**Owner:** backend/debugger subagent.

**Files:**
- Create: `apps/api/src/tools/audit-attraction-scope.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/test/audit-attraction-scope.test.ts`

**Step 1: Write failing tests**

Test that the audit selection is built from Bitrix deal filters, not from report rows:

```ts
expect(buildAttractionScopeDealFilter({
  categoryId: "10",
  managerIds: ["78", "11234"],
  from: "2025-05-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
})).toEqual({
  CATEGORY_ID: "10",
  "@ASSIGNED_BY_ID": ["78", "11234"],
  ">=DATE_CREATE": "2025-05-01T00:00:00.000Z",
  "<=DATE_CREATE": "2026-04-30T23:59:59.999Z"
});
```

Test that output rows contain only non-PII fields:

```ts
expect(Object.keys(row).sort()).toEqual([
  "bitrixCallCount",
  "bitrixMeetingCount",
  "bitrixTaskCount",
  "dealId",
  "localCallCount",
  "localMeetingCount",
  "localTaskCount",
  "managerId",
  "missingReasons"
]);
```

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/audit-attraction-scope.test.ts
```

Expected: FAIL because the tool/helpers do not exist.

**Step 3: Implement minimal read-only command**

The command must:

- Read `.env` through existing `readEnv`.
- Build exact scope with category `10`, 7 manager IDs, and explicit range args.
- Fetch deal IDs via `crm.deal.list` with safe `select`: `ID`, `ASSIGNED_BY_ID`, `DATE_CREATE`, `CATEGORY_ID`.
- Fetch activities with `crm.activity.list` using `BINDINGS`, provider-scoped:
  - `VOXIMPLANT_CALL`
  - `CRM_TODO`
  - `CRM_TASKS_TASK`
  - `CRM_MEETING`
- Fetch call stats via `voximplant.statistic.get` for `VOXIMPLANT_CALL` activity IDs.
- Compare against local SQLite counts.
- Print summary and a per-deal mismatch table to stdout; do not commit generated data.

Add script:

```json
{
  "scripts": {
    "audit:attraction-scope": "tsx src/tools/audit-attraction-scope.ts"
  }
}
```

**Step 4: Run targeted tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/audit-attraction-scope.test.ts
```

Expected: PASS.

**Step 5: Manual verification command**

Run read-only:

```bash
pnpm --filter @bitrix24-reporting/api audit:attraction-scope -- --from 2025-05-01T00:00:00.000Z --to 2026-04-30T23:59:59.999Z
```

Expected: summary shows exact deal count, local-vs-Bitrix mismatch counts, and no PII.

---

### Task 2: Sync Coverage And Independent Cursor Schema

**Owner:** backend/database subagent.

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/domain/sync.ts`
- Test: `apps/api/test/sqlite.test.ts`
- Test: `apps/api/test/sync.test.ts`

**Step 1: Write failing SQLite tests**

Test the repository can store separate cursors:

```ts
await repo.setSyncCursor({
  key: "category:10:deals",
  cursorValue: "2026-04-25T10:00:00.000Z",
  updatedAt: "2026-04-25T10:01:00.000Z"
});
await expect(repo.getSyncCursor("category:10:deals")).resolves.toBe(
  "2026-04-25T10:00:00.000Z"
);
```

Test historical coverage is range-aware:

```ts
await repo.upsertSyncCoverage({
  scopeKey: "category:10",
  stream: "activity_history",
  providerId: "CRM_TODO",
  coveredFrom: "2026-01-25T00:00:00.000Z",
  coveredTo: null,
  algorithmVersion: "activity-bindings-v2",
  syncedAt: "2026-04-25T10:00:00.000Z"
});
await expect(repo.hasSyncCoverage({
  scopeKey: "category:10",
  stream: "activity_history",
  providerId: "CRM_TODO",
  requiredFrom: "2025-04-25T00:00:00.000Z",
  algorithmVersion: "activity-bindings-v2"
})).resolves.toBe(false);
```

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sqlite.test.ts test/sync.test.ts
```

Expected: FAIL because the schema/methods do not exist.

**Step 3: Add schema**

Add two tables:

```sql
CREATE TABLE IF NOT EXISTS sync_cursors (
  key TEXT PRIMARY KEY,
  cursor_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_coverage (
  scope_key TEXT NOT NULL,
  stream TEXT NOT NULL,
  provider_id TEXT,
  covered_from TEXT NOT NULL,
  covered_to TEXT,
  algorithm_version TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (scope_key, stream, provider_id, algorithm_version)
);
```

Add repository methods:

- `getSyncCursor(key: string): Promise<string | null>`
- `setSyncCursor(input): Promise<void>`
- `hasSyncCoverage(input): Promise<boolean>`
- `upsertSyncCoverage(input): Promise<void>`
- `getMissingCoverage(input): Promise<...>`

Keep existing `sync_state` reads for backward compatibility, but new code must prefer `sync_cursors` and `sync_coverage`.

**Step 4: Run tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sqlite.test.ts test/sync.test.ts
```

Expected: PASS.

---

### Task 3: Fix Sync Planner For History And Fresh Deltas

**Owner:** backend/sync subagent.

**Files:**
- Modify: `apps/api/src/domain/sync.ts`
- Test: `apps/api/test/sync.test.ts`

**Root bug to fix:** activity delta currently reuses the deal modified cursor. That can skip fresh tasks/calls if a deal has a later `DATE_MODIFY` than an activity `LAST_UPDATED`.

**Step 1: Write failing test for independent activity cursor**

Scenario:

- last successful activity cursor is `2026-04-25T09:00:00.000Z`
- max local deal `DATE_MODIFY` is `2026-04-25T12:00:00.000Z`
- a task changed at `2026-04-25T10:00:00.000Z`

Expected: `listActivities.modifiedAfter` must be `09:00`, not `12:00`.

```ts
expect(activityRequests).toContainEqual({
  modifiedAfter: "2026-04-25T09:00:00.000Z"
});
```

**Step 2: Write failing test for expanded lookback**

Scenario:

- existing coverage for `CRM_TODO` starts `2026-01-25`
- required bootstrap cutoff is `2025-04-25`

Expected: sync runs historical `CRM_TODO` request from `2025-04-25` and updates coverage only after `upsertActivities` succeeds.

**Step 3: Implement planner**

Use separate cursor keys:

- `category:10:deals:date_modify`
- `category:10:activities:last_updated`
- `category:10:stage_history`

Use coverage keys:

- stream `activity_history`, providers `VOXIMPLANT_CALL`, `CRM_MEETING`, `CRM_TODO`, `CRM_TASKS_TASK`
- stream `deal_custom_fields`
- stream `call_stats_by_activity`

Historical sync logic:

- Compute `requiredFrom = now - bootstrapLookbackDays`.
- For each required provider, call `hasSyncCoverage`.
- If missing or too narrow, request that provider with `modifiedAfter = requiredFrom`.
- Upsert rows.
- Mark coverage only after all dependent writes succeed.

Delta sync logic:

- Deals: use deal cursor.
- Activities: use activity cursor, not deal cursor.
- Calls: fetch stats for newly seen call activity IDs plus recent retry window from Task 4.
- Stage history: keep full category fetch initially; later optimization is separate.

**Step 4: Run sync tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sync.test.ts
```

Expected: PASS.

---

### Task 4: Call Stats Completeness Retry Window

**Owner:** backend/sync subagent.

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/domain/sync.ts`
- Test: `apps/api/test/sync.test.ts`
- Test: `apps/api/test/sqlite.test.ts`

**Step 1: Write failing test**

If a `VOXIMPLANT_CALL` activity exists locally but no call snapshot exists for its activity ID, next sync must retry `voximplant.statistic.get`.

```ts
await expect(repo.getCallActivityIdsMissingCallStats(1000, cutoff)).resolves.toEqual([
  "A_CALL_WITHOUT_STAT"
]);
```

**Step 2: Implement repository query**

Query activity snapshots:

- `provider_id = 'VOXIMPLANT_CALL'`
- `owner_type_id = '2'`
- no matching `call_snapshots.crm_activity_id`
- `created_time >= recentCutoff`

**Step 3: Wire sync**

`callActivityIds` for `listCalls` must include:

- call activities fetched in this sync
- locally missing call stats from retry query
- optionally recent last N days of call activities to handle delayed telephony stats

Deduplicate IDs before `voximplant.statistic.get`.

**Step 4: Run tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sync.test.ts test/sqlite.test.ts
```

Expected: PASS.

---

### Task 5: Report Detail Must Use Deal-Level Data, Not Manager-Filtered Data

**Owner:** backend/reporting subagent.

**Files:**
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Test: `apps/api/test/service.test.ts`
- Test: `apps/api/test/manager-action-outcome.test.ts`

**Step 1: Write failing service test**

Create a deal assigned to manager `78`, with a task or call on that deal where `responsibleId`/`portalUserId` is outside the 7-manager whitelist.

Expected:

- deal detail shows the task/call count
- manager aggregate does not create a misleading attraction-manager row for the outside user

**Step 2: Write failing task classification test**

`IMOPENLINES_SESSION` must not count as a task:

```ts
expect(detail.taskSummary.created).toBe(0);
```

`CRM_TODO` and `CRM_TASKS_TASK` must count.

**Step 3: Implement split inputs**

Inside service:

- `dealScopedActivities`: all activities linked to scoped deals.
- `dealScopedCalls`: all calls linked to scoped deals.
- `managerScopedActivities`: activities linked to scoped deals and responsible in manager scope.
- `managerScopedCalls`: calls linked to scoped deals and portal/responsible in manager scope.

Inside `buildManagerActionOutcomeReport`, either:

- add separate internal input fields for detail vs aggregate, or
- build detail using deal-scoped maps and aggregate using manager-scoped maps.

Do not change public API unless needed.

**Step 4: Tighten task classifier**

Change task logic to explicit providers:

```ts
const TASK_ACTIVITY_PROVIDER_IDS = new Set(["CRM_TODO", "CRM_TASKS_TASK"]);

function isTaskActivity(activity: ActivitySnapshot) {
  return activity.providerId ? TASK_ACTIVITY_PROVIDER_IDS.has(activity.providerId) : false;
}
```

If the product confirms plain CRM task rows with null provider and `TYPE_ID=6`, add that as an explicit documented fallback in a separate test.

**Step 5: Run targeted tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/service.test.ts test/manager-action-outcome.test.ts
```

Expected: PASS.

---

### Task 6: Completeness Warnings In API And UI

**Owner:** backend + frontend subagents, split after contract shape is agreed.

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/scenes.tsx`
- Test: API and web tests touching manager action outcome and warnings.

**Step 1: Write failing contract/API test**

When required activity coverage is missing for report range, `manager-action-outcomes` returns a warning:

```ts
expect(report.warnings).toContain(
  "Данные по делам/звонкам неполные: требуется историческая синхронизация за выбранный период."
);
```

**Step 2: Add warning contract**

Add `warnings: string[]` to `ManagerActionOutcomeReportSnapshot` or the top-level report type. Prefer the same style as workload reports.

**Step 3: Compute required coverage**

For manager action outcome:

- Required range is latest 12 cohort months.
- Required providers: `CRM_TODO`, `CRM_TASKS_TASK`, `VOXIMPLANT_CALL`, `CRM_MEETING`.
- Required custom field coverage: meeting date field.
- Required call stats coverage: call activity stats.

If coverage is missing, surface warnings in API and UI. Do not hide the report; label it as incomplete.

**Step 4: Update frontend rendering**

Show warnings near the report header/detail area. Use existing warning UI patterns; no decorative redesign.

**Step 5: Run tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/web exec vitest run
```

Expected: PASS.

---

### Task 7: End-To-End Verification On Real Local Snapshot

**Owner:** debugger/reviewer subagent, read-only except running sync.

**Files:**
- No committed source changes expected.

**Step 1: Baseline audit**

Run:

```bash
pnpm --filter @bitrix24-reporting/api audit:attraction-scope -- --from 2025-05-01T00:00:00.000Z --to 2026-04-30T23:59:59.999Z
```

Record:

- scoped deal count
- deals with Bitrix tasks but local zero
- deals with Bitrix calls but local zero
- provider totals

**Step 2: Run sync**

Run the existing sync path or API endpoint after code fixes:

```bash
curl -X POST http://localhost:8787/api/sync
```

If API is not running, start it with:

```bash
pnpm --filter @bitrix24-reporting/api dev
```

**Step 3: Re-run audit**

Expected:

- missing local task/call counts drop to near zero
- known screenshot deals no longer show local `0/0` when Bitrix has rows
- any remaining mismatch has an explicit reason: permissions, Bitrix method returned zero, unsupported provider, or deleted activity.

**Step 4: Run full verification**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/web typecheck
git diff --check
```

Expected: all pass.

---

### Task 8: Review, Docs, And Rollout Guardrails

**Owner:** reviewer/documenter subagents.

**Files:**
- Modify: `docs/backlog.md` or create issue notes if remote GitHub is active.
- Modify: `.env.example` only if new env vars are introduced.
- Optional: `docs/audits/README.md`

**Step 1: Code review checklist**

Verify:

- no direct Bitrix reads from dashboard render paths
- no PII fields added to selects or persisted tables
- every Bitrix list method paginates
- every historical coverage mark happens after successful writes
- delta cursors are stream-specific
- report warnings appear when coverage is incomplete

**Step 2: Operational docs**

Document:

- how to run read-only audit
- how to run sync
- how to interpret coverage warnings
- how to expand lookback from 90 to 365 safely

**Step 3: Final acceptance**

Acceptance criteria:

- API tests pass.
- Web tests pass.
- Read-only audit confirms local snapshot matches Bitrix for the year scope or lists explicit exceptions.
- Manager action outcome detail rows show deal-level tasks/calls/meetings without hiding them due to responsible-user mismatch.
- New sync pulls fresh deals and fresh activities independently on every run.
- UI never silently presents incomplete history as trustworthy zeros.
