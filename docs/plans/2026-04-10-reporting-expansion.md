# Reporting Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make reporting endpoints production-ready for named managers, shared filters, and cohort analytics.

**Architecture:** Persist manager names in SQLite, derive real filter catalogs from synced data, and keep report builders pure by filtering inputs before aggregation. Add a new cohort builder and endpoint while leaving deadline-reschedule logic disabled until a trustworthy data source exists.

**Tech Stack:** TypeScript, Express, better-sqlite3, Vitest, Bitrix24 REST

---

### Task 1: Extend contracts for managers, filters, cohorts, and meta catalogs

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/api/test/http.test.ts`

### Task 2: Persist and resolve manager directory data

**Files:**
- Modify: `apps/api/src/bitrix/client.ts`
- Modify: `apps/api/src/domain/sync.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/sync.test.ts`
- Test: `apps/api/test/sqlite.test.ts`
- Test: `apps/api/test/bitrix-client.test.ts`

### Task 3: Add shared manager/source filtering and manager name decoration

**Files:**
- Modify: `apps/api/src/domain/reporting.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Test: `apps/api/test/reporting.test.ts`
- Test: `apps/api/test/source-quality-conversion.test.ts`
- Test: `apps/api/test/activities-workload.test.ts`
- Test: `apps/api/test/calls-workload.test.ts`

### Task 4: Add cohort conversion report

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/api/test/cohort-conversion.test.ts`

### Task 5: Expose filter catalogs through meta and verify end-to-end

**Files:**
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/test/http.test.ts`
- Run: API tests, API typecheck, web tests, web typecheck
