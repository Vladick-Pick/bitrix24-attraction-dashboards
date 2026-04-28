# Revenue Velocity System State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework PR #12 so `Денежная скорость` defaults to a live money-system state report, while keeping the original created-cohort logic as a separate view.

**Architecture:** Extend the existing Revenue Velocity contracts and pure domain builder with a `RevenueVelocityView` mode. `systemState` and `operationalPeriod` use the selected dates as an observation window and compare current system state against the previous period; `createdCohort` keeps the original dateCreate cohort behavior. The web scene loads this heavy report lazily when the tab is opened and refetches on view/dimension changes.

**Tech Stack:** TypeScript, Vitest, Express, React, existing local SQLite snapshot repository, existing prototype scene shell.

---

### Task 1: Backend Red Tests

**Files:**
- Modify: `apps/api/test/revenue-velocity.test.ts`
- Modify: `apps/api/test/http.test.ts`
- Modify: `apps/api/test/service.test.ts`

**Steps:**
1. Add tests proving `systemState` shows active pipeline when the week has no new deals or wins.
2. Add tests proving wins created before the period count in `realizedWonAmountInPeriod`.
3. Add formula tests for `systemValueCreated = realizedWonAmount + currentEV - previousEV`, `velocityDelta`, and `velocityDeltaPercent`.
4. Add tests proving period actions are counted by event/completion timestamps in `from/to`, not by deal creation date.
5. Add tests proving `createdCohort` still uses dateCreate filtering.
6. Add a post-close action test: lifetime money-per-action ignores actions after `dateClosed`.
7. Add route parsing coverage for `view=systemState|operationalPeriod|createdCohort`.

### Task 2: Backend Implementation

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/domain/revenue-velocity.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/server/service.ts`

**Steps:**
1. Add `RevenueVelocityView` and system-state fields to contracts.
2. Teach `buildRevenueVelocityReport` to build three views:
   - `systemState`: state at `to`, previous state before `from`, period wins/actions, system value delta.
   - `operationalPeriod`: same period-event base with operational naming.
   - `createdCohort`: existing cohort calculation.
3. Add active deal state at `asOf`, historical stage probability fallback, expected pipeline amount, live velocity, and remaining days.
4. Count period actions only from attraction-scope deal-linked events in `from/to`.
5. For lifetime/cohort actions, end action windows at `min(dateClosed, asOf)` so post-close actions do not affect money-per-action.
6. Parse `view` in `/api/reports/revenue-velocity` and pass it through service.

### Task 3: Frontend Red Tests

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/proto/proto-app.test.tsx`

**Steps:**
1. Assert `apiClient.getRevenueVelocityReport` is not called during initial app load.
2. Assert opening `Денежная скорость` triggers the lazy request.
3. Assert the default selected view is `Состояние системы`.
4. Assert system-state KPI labels render and static placeholder KPI cards do not render.
5. Assert switching to `Когорты` refetches with `view: "createdCohort"`.

### Task 4: Frontend Implementation

**Files:**
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/revenue-velocity-tooltips.ts`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`

**Steps:**
1. Add `RevenueVelocityView` to local types and query normalization.
2. Remove `getRevenueVelocityReport` from the global `ProtoApp` `Promise.all`.
3. Give `RevenueVelocityScene` its own lazy request state keyed by filters, view, and dimension.
4. Add view switcher: `[Состояние системы] [Оперативно] [Когорты]`.
5. Render system-state KPI set by default.
6. Keep existing cohort table fields for `createdCohort`, and use system/operational labels for the new default view.
7. Remove static scene-level placeholder KPI definitions for `revenue-velocity`.

### Task 5: Verification And Push

**Commands:**
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/revenue-velocity.test.ts apps/api/test/http.test.ts apps/api/test/service.test.ts`
- `pnpm --filter @bitrix24-reporting/web test -- --runInBand apps/web/src/App.test.tsx apps/web/src/proto/proto-app.test.tsx`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

Commit the PR update and push `codex/revenue-velocity-report`.
