# Operational Metrics And TOC Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Lock one canonical calculation model for activities, calls, cohorts, and TOC/constraint metrics in the "Привлечение" dashboard while keeping the current sales screen out of scope until its methodology changes are finalized.

**Architecture:** Keep report builders pure and deterministic. Reuse the synced deal, stage-history, activity, call, manager, and source datasets that already exist in the API, then add a dedicated TOC report builder on top of them instead of overloading the current sales dashboard builder. Treat prototype formulas as UI targets, but treat the Leadgen TOC dashboard as the calculation canon for queue, throughput, bottleneck, and capacity-buffer logic.

**Tech Stack:** TypeScript, Express, better-sqlite3, Vitest, Bitrix24 REST, React prototype shell

---

## Canonical Scope

### Final Now

- Activities report:
  - Absolute values by manager: `createdCount`, `closedCount`, `dealCount`
  - Averages by deal: `averageCreatedPerDeal`, `averageClosedPerDeal`
  - Stage averages by deal via `stageBreakdown`
- Calls report:
  - Absolute values by manager: `totalCalls`, `incomingCalls`, `outgoingCalls`, `dealCount`
  - Averages by deal: `averageCallsPerDeal`
  - Stage averages by deal via `stageBreakdown`
- Shared filters:
  - `managerIds`
  - `sourceKeys`
- Directory catalogs:
  - `managerCatalog`
  - `sourceCatalog`

### Must Be Fixed Before UI Goes Live

- Cohorts must switch from absolute `closedMonth` buckets to relative buckets:
  - `month_1`
  - `month_2`
  - `month_3`
  - `month_4_plus`
- Call semantics must be frozen:
  - what counts as `successful_call`
  - what counts as `no_answer`
  - whether `successful > 30 sec` means `duration > 30` only, or also excludes failed codes
- Activities report must explicitly hide deadline reschedules until trustworthy history exists
- Compare-window semantics must be frozen:
  - delta against first compare period
  - not pairwise period-to-period

### Planned Next

- Dedicated TOC / funnel-flow report
- Queue buffer and bottleneck API
- Compare-ready TOC payload
- One-button smoke command for sync + report verification

## Canonical Formulas

These formulas are borrowed from the Leadgen TOC dashboard and should be treated as the default canon for the "Привлечение" module as well, unless the business explicitly changes them.

### 1. Throughput Per Day

```text
throughput_per_day(stage) = moved_next(stage, period) / business_days(period)
```

- `moved_next(stage, period)` = count of deals that moved from this stage to the next stage during the period
- `business_days(period)` = number of Mon-Fri days in the selected period, minimum `1`

### 2. Queue At End

```text
queue_end(stage) = deals remaining in stage at period end
```

- This is an end-of-period queue snapshot, not a cumulative entered count

### 3. Queue Buffer In Days

```text
queue_buffer_days(stage) = queue_end(stage) / throughput_per_day(stage)
```

- If `throughput_per_day(stage) <= 0`, return `0` or `null` in the API and render `—` in UI

### 4. Bottleneck

```text
bottleneck = stage with MIN(throughput_per_day) across the canonical stage chain
```

- The canonical stage chain for this module must be frozen before implementation
- Initial candidate chain from the prototype:
  - `База входящая`
  - `Звонок-знакомство`
  - `Встреча-знакомство`
  - `Активация`
  - `Проблематизация`
  - `Демонстрация`
  - `Контрактация`
  - `На передаче`

### 5. Estimated Gain Per Day

```text
estimated_gain_per_day =
  max(next_throughput - bottleneck_throughput, 0)
  * avg_check
  * winrate
```

- `next_throughput` = second-lowest throughput in the canonical stage chain
- `winrate` must use the report-level definition chosen for this module
- Since sales methodology is currently unstable, this field should remain hidden or marked `planned` until the denominator for winrate is frozen

### 6. Opportunities

```text
opportunities = queue_end(stage_a) + queue_end(stage_b)
```

- In Leadgen this is hardwired to specific stages
- In "Привлечение" this must not be implemented until the business confirms which stages define pipeline opportunities

### 7. Cohorts

```text
cohort_created_month = YYYY-MM(dateCreate)
relative_close_bucket =
  month_1      if close happens in creation month or within first full month window
  month_2      if close happens in second month window
  month_3      if close happens in third month window
  month_4_plus otherwise
```

- Bucket boundaries must be computed from calendar months, not raw 30-day windows
- Each cohort row needs:
  - `createdDeals`
  - `closedDeals`
  - `wonDeals`
  - `closedRate`
  - `wonConversionRate`
  - average days to close / win

### 8. Activities And Calls

```text
activities_per_deal = created_activities / distinct_deals_in_scope
closed_activities_per_deal = closed_activities / distinct_deals_in_scope
calls_per_deal = total_calls / distinct_deals_in_scope
```

- `distinct_deals_in_scope` = deals after applying date range + manager/source filters
- Stage averages must use the stage of the deal at the activity/call timestamp
- Deadline reschedule stays disabled until a trustworthy history source exists

### 9. Missing Data Rule

```text
If the source data required for a metric does not exist with trustworthy fidelity,
return 0/null and an explicit warning instead of using hidden heuristics.
```

- This is already how the Leadgen TOC dashboard handles missing conversions/stages data
- Apply the same rule to deadline reschedules in this module

---

### Task 1: Freeze methodology and contracts for non-sales reports

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/proto/src/proto/scenes.tsx`
- Create: `docs/methodology/operational-metrics.md`
- Test: `apps/api/test/http.test.ts`

**Step 1: Write the failing contract and parsing tests**

- Add expectations for:
  - relative cohort buckets
  - explicit activity/call metric semantics
  - TOC placeholder contract shape

**Step 2: Run the narrow tests to confirm the gaps**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- cohort-conversion http
```

Expected:

- Existing cohort test fails once relative buckets replace absolute months
- HTTP contract test fails until new payloads are parsed

**Step 3: Update the contracts and client parsers**

- Replace absolute cohort bucket typing with relative buckets
- Add report-level warnings arrays where a metric can be intentionally unavailable
- Keep sales report untouched

**Step 4: Add a methodology doc**

- Document frozen formulas for:
  - activities
  - calls
  - cohorts
  - TOC
- Document explicitly that deadline reschedules are disabled

**Step 5: Re-run the narrow tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- cohort-conversion http
pnpm --filter @bitrix24-reporting/web typecheck
```

Expected:

- Contracts compile
- Parsing tests pass

### Task 2: Rebuild the cohort report around relative month buckets

**Files:**
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/domain/report-dimensions.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/test/cohort-conversion.test.ts`
- Modify: `apps/api/test/http.test.ts`

**Step 1: Write failing cohort tests for relative buckets**

- Cover:
  - close in creation month -> `month_1`
  - close in next calendar month -> `month_2`
  - close in third month -> `month_3`
  - anything later -> `month_4_plus`
  - still-open deals stay outside closed buckets

**Step 2: Run the cohort test and confirm failure**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- cohort-conversion
```

Expected:

- Existing implementation still returns `closureMonths`
- Test fails on payload shape

**Step 3: Implement month-delta bucket helpers**

- Add a helper to convert `dateCreate` and `dateClosed` into relative calendar month distance
- Keep the builder pure

**Step 4: Update endpoint and meta wiring**

- Ensure manager/source filters still apply before aggregation
- Keep totals aligned with filtered input

**Step 5: Re-run cohort verification**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- cohort-conversion http
pnpm --filter @bitrix24-reporting/api typecheck
```

Expected:

- Cohort tests pass
- API compiles

### Task 3: Freeze call semantics and keep deadline reschedules intentionally disabled

**Files:**
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/domain/report-dimensions.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/test/calls-workload.test.ts`
- Modify: `apps/api/test/activities-workload.test.ts`

**Step 1: Write failing tests for semantic buckets**

- Add cases for:
  - successful call
  - no-answer call
  - calls under and over 30 seconds
  - activity report warnings when reschedules are unavailable

**Step 2: Run narrow tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- calls-workload activities-workload
```

Expected:

- Failures on missing semantic fields or warnings

**Step 3: Implement explicit classification helpers**

- Centralize call classification in one helper instead of scattering logic in report builders
- Keep `rescheduledCount` at `0` and add a warning until a real history source exists

**Step 4: Re-run the workload tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- calls-workload activities-workload
```

Expected:

- Workload tests pass with explicit, documented semantics

### Task 4: Add a dedicated TOC / funnel-flow report

**Files:**
- Create: `apps/api/src/domain/toc-report.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/api/test/toc-report.test.ts`
- Modify: `apps/api/test/http.test.ts`

**Step 1: Write the failing TOC builder test**

- Cover:
  - `entered`
  - `throughputPerDay`
  - `queueEnd`
  - `queueBufferDays`
  - `bottleneck`
  - warnings when source data is incomplete

**Step 2: Run the new TOC test**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- toc-report
```

Expected:

- FAIL because the builder and endpoint do not exist

**Step 3: Implement the pure TOC builder**

- Derive stage entry and throughput from stage-history transitions
- Derive end-of-period queue from the last known stage state in the selected range
- Reuse canonical stage ordering from one shared constant
- Keep `estimated_gain_per_day` nullable until `avg_check` and `winrate` are frozen for this module

**Step 4: Expose the endpoint**

- Add `GET /api/reports/toc-flow`
- Support `managerIds` and `sourceKeys`
- Return warnings rather than heuristic estimates when data is insufficient

**Step 5: Re-run the TOC tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- toc-report http
pnpm --filter @bitrix24-reporting/api typecheck
```

Expected:

- TOC builder and HTTP contract tests pass

### Task 5: Add compare-window semantics for non-sales reports

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/domain/toc-report.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/proto/src/App.tsx`
- Modify: `apps/api/test/http.test.ts`

**Step 1: Write failing tests for compare parameters**

- Verify reports accept a primary range plus one compare range
- Verify deltas are always computed against the first compare range

**Step 2: Run compare-related tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- http
```

Expected:

- FAIL until compare parsing and delta builders exist

**Step 3: Implement one compare range end-to-end**

- Do not implement all five prototype compare windows yet
- Freeze server support at one compare range and let UI degrade gracefully

**Step 4: Re-run verification**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- http
pnpm --filter @bitrix24-reporting/web test
```

Expected:

- Compare-range contract passes
- Prototype stays stable

### Task 6: Add one-button verification and reporting smoke flow

**Files:**
- Modify: `package.json`
- Create: `scripts/verify-reporting.mjs`
- Create: `scripts/smoke-operational-reports.mjs`
- Modify: `README.md`

**Step 1: Write the scripts with a failing dry run**

- `pnpm verify:reporting`
- `pnpm smoke:operations`

**Step 2: Run the scripts and confirm failures are actionable**

Run:

```bash
pnpm verify:reporting
pnpm smoke:operations
```

Expected:

- Fail with clear missing-env or missing-sync guidance

**Step 3: Make the scripts production-usable**

- `verify:reporting` should run:
  - API tests
  - API typecheck
  - web tests
  - web typecheck
- `smoke:operations` should:
  - hit sync once
  - request activities, calls, cohorts, and TOC
  - print one compact summary

**Step 4: Re-run the one-button commands**

Run:

```bash
pnpm verify:reporting
pnpm smoke:operations
```

Expected:

- Both commands complete without manual multi-step work

### Task 7: Final full verification

**Files:**
- Run only

**Step 1: Run all verification commands**

Run:

```bash
pnpm verify:reporting
pnpm --filter @bitrix24-reporting/api test
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web test
pnpm --filter @bitrix24-reporting/web typecheck
```

Expected:

- Full green local verification

**Step 2: Manual smoke**

Run:

```bash
pnpm smoke:operations
```

Expected:

- Report endpoints return stable payloads with filters, manager names, and warnings where appropriate

**Step 3: Commit in small slices**

Suggested commit order:

```bash
git add docs/methodology/operational-metrics.md docs/plans/2026-04-11-operational-metrics-and-toc-alignment.md
git commit -m "docs: freeze operational metrics methodology"

git add packages/contracts/src/index.ts apps/api/src/domain/operational-reports.ts apps/api/test/cohort-conversion.test.ts apps/api/test/calls-workload.test.ts apps/api/test/activities-workload.test.ts
git commit -m "feat: align cohort and workload report semantics"

git add apps/api/src/domain/toc-report.ts apps/api/src/server/service.ts apps/api/src/server/app.ts apps/api/test/toc-report.test.ts
git commit -m "feat: add toc flow report"

git add package.json scripts/verify-reporting.mjs scripts/smoke-operational-reports.mjs README.md
git commit -m "chore: add one-button reporting verification"
```
