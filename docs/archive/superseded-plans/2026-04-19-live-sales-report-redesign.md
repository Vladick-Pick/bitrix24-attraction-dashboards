# Live Sales Report Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the old aggregate sales dashboard in the main interface with a won-deal drilldown report grouped by manager, while keeping the KPI strip for now.

**Architecture:** The backend keeps `/api/dashboard`, but its payload changes from aggregate source/funnel cards to a won-deal report snapshot. The frontend main shell stops rendering the old timeline/funnel/source sections and instead renders one sales report made of manager groups, deal rows, and a deal-detail expansion with stage history and time-on-stage.

**Tech Stack:** Express + TypeScript backend, shared contracts package, React 19 + Vite frontend, Vitest for api/web tests.

---

### Task 1: Replace the sales dashboard contract with a won-deal drilldown model

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Test: `apps/api/test/http.test.ts`
- Test: `apps/web/src/lib/api-client.test.ts`

**Step 1: Write the failing test**

Add expectations that `/api/dashboard` and the web API client expose a sales payload with:
- `managerGroups`
- per-deal rows
- deal detail fields for calls, tasks, cohort context, and stage timeline

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @bitrix24-reporting/api test -- http`

Run: `pnpm --filter @bitrix24-reporting/web test -- api-client`

Expected: FAIL because the old sales overview contract is still returned.

**Step 3: Write minimal implementation**

Replace the old `salesOverview/funnelSnapshot/sourceBreakdown` contract with:
- top-level KPI-compatible summary fields
- `managerGroups[]`
- `wonDeals[]` shape inside each group
- `cohortContext`
- `callSummary`
- `taskSummary`
- `stageTimeline`

Keep the shape minimal and explicit. Do not carry old unused aggregate cards forward.

**Step 4: Run test to verify it passes**

Run the two commands above again.

**Step 5: Commit**

```bash
git add packages/contracts/src/index.ts apps/web/src/lib/dashboard-types.ts apps/api/test/http.test.ts apps/web/src/lib/api-client.test.ts
git commit -m "feat: replace sales dashboard contract with won-deal drilldown model"
```

### Task 2: Build the live per-won-deal sales report in the backend

**Files:**
- Modify: `apps/api/src/domain/reporting.ts`
- Modify: `apps/api/src/server/service.ts`
- Test: `apps/api/test/reporting.test.ts`
- Test: `apps/api/test/service.test.ts`

**Step 1: Write the failing test**

Add backend tests that assert:
- won deals are grouped by manager
- each row includes cycle days, close date, amount, cohort context, call/task summaries
- detail rows include ordered stage history and time per stage

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @bitrix24-reporting/api test -- reporting service`

Expected: FAIL because `buildDashboard()` still computes the old aggregate cards only.

**Step 3: Write minimal implementation**

Implement `buildDashboard()` on raw data:
- only won deals closed in range
- group by current assigned manager
- compute cycle from `dateCreate/dateClosed`
- derive cohort month context from all deals created in the same month
- aggregate linked calls per deal
- aggregate non-call activities per deal
- derive stage timeline from `stageHistory`

In `service.ts`, pass the required datasets to the new sales builder, including stage history, activities, calls, and manager directory.

**Step 4: Run test to verify it passes**

Run the command from Step 2 again.

**Step 5: Commit**

```bash
git add apps/api/src/domain/reporting.ts apps/api/src/server/service.ts apps/api/test/reporting.test.ts apps/api/test/service.test.ts
git commit -m "feat: build live won-deal sales report"
```

### Task 3: Switch the app entrypoint from proto to the live dashboard shell

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.test.tsx`

**Step 1: Write the failing test**

Update `App.test.tsx` to expect the live dashboard shell heading/filter chrome instead of the proto shell.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @bitrix24-reporting/web test -- App`

Expected: FAIL because `App.tsx` still mounts `ProtoApp`.

**Step 3: Write minimal implementation**

Mount `DashboardShell` from `App.tsx`.

**Step 4: Run test to verify it passes**

Run the command from Step 2 again.

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat: mount live dashboard shell"
```

### Task 4: Remove the old sales cards and render the new report in the main shell

**Files:**
- Modify: `apps/web/src/features/dashboard/dashboard-shell.tsx`
- Modify: `apps/web/src/features/dashboard/report-filters.tsx`
- Create: `apps/web/src/features/dashboard/sales-report-card.tsx`
- Test: `apps/web/src/features/dashboard/dashboard-shell.test.tsx`

**Step 1: Write the failing test**

Add a shell test that expects:
- KPI strip stays visible
- old timeline/funnel/source cards are gone from the sales view
- manager-grouped won-deal rows render
- detail toggle reveals stage timeline and time-on-stage

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @bitrix24-reporting/web test -- dashboard-shell`

Expected: FAIL because the shell still renders old report tabs and cards.

**Step 3: Write minimal implementation**

In `report-filters.tsx`:
- remove old `overview/sources/stages` report switching
- remove source search summary and other sales-card-specific chrome that no longer applies

In `dashboard-shell.tsx`:
- keep KPI grid and refresh/sync controls
- remove timeline/funnel/source breakdown sections
- render a single `SalesReportCard`

In `sales-report-card.tsx`:
- group won deals by manager
- compact row for each sale
- expandable detail showing stage history, time on stage, call summary, task summary, and cohort context

**Step 4: Run test to verify it passes**

Run the command from Step 2 again.

**Step 5: Commit**

```bash
git add apps/web/src/features/dashboard/dashboard-shell.tsx apps/web/src/features/dashboard/report-filters.tsx apps/web/src/features/dashboard/sales-report-card.tsx apps/web/src/features/dashboard/dashboard-shell.test.tsx
git commit -m "feat: replace old sales cards with won-deal report"
```

### Task 5: Verify the live redesign end to end

**Files:**
- No new files required unless fixes are needed

**Step 1: Run focused tests**

```bash
pnpm --filter @bitrix24-reporting/api test -- reporting service http
pnpm --filter @bitrix24-reporting/web test -- App api-client dashboard-shell
```

**Step 2: Run typecheck**

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web typecheck
```

**Step 3: Run smoke validation against the live app**

Start the app if needed and verify:
- main shell opens instead of proto
- KPI strip still renders
- won-deal rows appear in the sales report
- `Подробнее` expands without layout jumps

**Step 4: Commit**

```bash
git add -A
git commit -m "test: verify live sales report redesign"
```
