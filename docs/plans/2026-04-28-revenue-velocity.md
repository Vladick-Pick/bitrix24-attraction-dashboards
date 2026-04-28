# Revenue Velocity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a cohort-based "Денежная скорость" report with backend API, contracts, frontend tab, KPI/table UI, formula tooltips, and unit tests.

**Architecture:** Add a pure domain builder in `apps/api/src/domain/revenue-velocity.ts`, then expose it through the existing reporting service and Express app. The web app keeps its current prototype shell and local dashboard type normalization, so the new report is loaded with the other runtime reports and rendered as a new scene.

**Tech Stack:** TypeScript, Vitest, Express, React, local SQLite snapshot through existing repository methods.

---

### Task 1: Backend Red Tests

**Files:**
- Create: `apps/api/test/revenue-velocity.test.ts`

**Steps:**
1. Write tests for formula calculations, cohort action binding, conversion-event stage filtering, dimensions, attraction manager scope input, and null denominators.
2. Run `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/revenue-velocity.test.ts`.
3. Expected: FAIL because `../src/domain/revenue-velocity` does not exist yet.

### Task 2: Backend Implementation

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/domain/revenue-velocity.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/test/http.test.ts`

**Steps:**
1. Add `ConversionEventSnapshot` and revenue velocity contracts.
2. Implement `buildRevenueVelocityReport` as a pure aggregator over deals, stage history, activities, calls, and conversion events.
3. Wire `getRevenueVelocityReport` into service with existing attraction manager scoping and empty conversion events for phase 1.
4. Add `GET /api/reports/revenue-velocity` with dimension/asOf/filter query parsing.
5. Run API targeted tests until green.

### Task 3: Frontend Red Tests

**Files:**
- Modify: `apps/web/src/App.test.tsx`
- Modify or add focused tests under `apps/web/src/proto`.

**Steps:**
1. Add tests for tab rendering, KPI/table rendering, sorting, formula tooltip presence, empty states, and conversion-event warning.
2. Run `pnpm --filter @bitrix24-reporting/web test -- --runInBand`.
3. Expected: FAIL until report types, client, runtime loading, and scene are implemented.

### Task 4: Frontend Implementation

**Files:**
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/revenue-velocity-tooltips.ts`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`

**Steps:**
1. Add local revenue velocity report types and response normalization.
2. Add `apiClient.getRevenueVelocityReport`.
3. Add tooltip registry.
4. Load the report with existing operational reports.
5. Add the `Денежная скорость` scene with KPI cards, dimension selector, sortable table, row expansion, warnings, and empty states.
6. Run web targeted tests until green.

### Task 5: Verification

**Commands:**
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/revenue-velocity.test.ts apps/api/test/http.test.ts`
- `pnpm --filter @bitrix24-reporting/web test -- --runInBand`
- `pnpm typecheck`
- `pnpm lint`

Record any command that cannot be run or fails for unrelated existing reasons.
