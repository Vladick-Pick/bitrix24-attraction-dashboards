# Sales Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sales-plan tab where users enter and persist plan rows by period, manager, and target group/customer club, then compare that plan with actual won sales in the sales report.

**Architecture:** Persist plans in SQLite through the existing API so values survive reloads and are shared by the local app. The web client loads plan rows beside dashboard data, renders an editable matrix, and derives plan/fact comparison from existing won-deal dashboard rows.

**Tech Stack:** Express, SQLite/better-sqlite3 repository, shared TypeScript contracts, React/Vite dashboard UI, Vitest.

---

### Task 1: Contracts And API Tests

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/test/http.test.ts`
- Modify: `apps/api/test/sqlite.test.ts`

**Steps:**
1. Add shared sales-plan row/request interfaces.
2. Add failing HTTP tests for `GET /api/sales-plan` and `PUT /api/sales-plan`.
3. Add failing SQLite test for replacing and reading plan rows by period.

### Task 2: API And SQLite Persistence

**Files:**
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`

**Steps:**
1. Create `sales_plan_rows` table with unique key `period_start, period_end, manager_id, target_group_key`.
2. Implement replace/read methods.
3. Expose service methods and HTTP routes with validation.

### Task 3: Web Client

**Files:**
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/api-client.test.ts`

**Steps:**
1. Add client-side types and normalizers.
2. Add `getSalesPlan` and `saveSalesPlan`.
3. Test URL/body mapping and response normalization.

### Task 4: UI Tab And Sales Comparison

**Files:**
- Modify: `apps/web/src/proto/proto-app.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/proto.css`
- Modify: `apps/web/src/proto/proto-app.test.tsx`

**Steps:**
1. Load sales plan for the selected report range.
2. Add editable `План продаж` scene.
3. Add plan/fact summary to `Отчет по продажам`.
4. Test that the new tab renders and saved plan appears in sales comparison.
