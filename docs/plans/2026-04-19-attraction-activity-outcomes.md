# Attraction Activity Outcomes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add category `10` attraction-only deal outcome analytics to the activity dashboard and clarify no-data KPI states.

**Architecture:** Build a backend acquisition outcome report from existing deal snapshots first, then extend deal sync for attraction refusal reasons. Expose the report through a new API endpoint, normalize it in the web client, map it into the activity scene runtime data, and render a separate `Сделки и потери` group below `Сводка по менеджерам`.

**Tech Stack:** TypeScript, Express, Vitest, SQLite, Vite React.

---

### Task 1: Backend Report Builder

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Test: `apps/api/test/acquisition-outcomes.test.ts`

**Steps:**
1. Write a failing builder test for category `10` new deals by manager/source/quality, lost deals by `Корзина` and `Возврат в Лидген`, and top refusal reasons.
2. Add contract interfaces for `AcquisitionOutcomesReport`.
3. Implement `buildAcquisitionOutcomesReport` using `DealSnapshot`, `StageCatalogEntry`, and `ManagerDirectoryEntry`.
4. Run the targeted test and keep it green.

### Task 2: Sync Refusal Reasons

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/bitrix/selectors.ts`
- Modify: `apps/api/src/bitrix/client.ts`
- Modify: `apps/api/src/domain/sync.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/selectors.test.ts`
- Test: `apps/api/test/security.test.ts`
- Test: `apps/api/test/sync.test.ts`
- Test: `apps/api/test/sqlite.test.ts`

**Steps:**
1. Write failing tests for allowed custom fields, persisted `refusalReasonValue`, and sync mapping.
2. Add `UF_CRM_1647422744` and `UF_CRM_1647422890` to the category `10` sync path.
3. Preserve the existing security allowlist behavior for arbitrary `UF_*`.
4. Run targeted API tests.

### Task 3: API and Web Client

**Files:**
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/api/test/service.test.ts`
- Test: `apps/api/test/http.test.ts`
- Test: `apps/web/src/lib/api-client.test.ts`

**Steps:**
1. Write failing tests for `/api/reports/acquisition-outcomes` and client normalization.
2. Add service method, route, and defensive web normalizer.
3. Run API and web client tests.

### Task 4: Activity Scene UI

**Files:**
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/live-reporting.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`
- Test: `apps/web/src/proto/proto-app.test.tsx`

**Steps:**
1. Write failing UI tests for `Сделки и потери` and no-data `Звонков на сделку`.
2. Fetch acquisition outcomes alongside activity/call/cohort/toc reports.
3. Render new deals, lost stage split, and reasons as separate panels below the manager activity table.
4. Show explicit no-data copy for KPI ratios when denominator data is missing.
5. Run web tests and typecheck.
