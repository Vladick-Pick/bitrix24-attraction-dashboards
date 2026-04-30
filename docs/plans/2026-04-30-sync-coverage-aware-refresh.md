# Coverage-Aware Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the existing refresh button run a delta sync plus any missing historical coverage needed by all reports.

**Architecture:** Keep the web UI and `/api/sync` contract unchanged. Fix the backend sync planner so missing activity-history coverage is fetched even when activity snapshots and delta cursors already exist, matching how deal fields and call stats are repaired by coverage state.

**Tech Stack:** TypeScript, Vitest/Jest-style API tests, local SQLite repository, Bitrix sync domain.

---

### Task 1: Activity Coverage Regression Test

**Files:**
- Modify: `apps/api/test/sync.test.ts`
- Modify: `apps/api/src/domain/sync.ts`

**Step 1: Write the failing test**

Add a test showing that a delta sync with existing scoped snapshots and missing `activity_history` coverage still requests historical activities for `CRM_TODO`, `CRM_TASKS_TASK`, `VOXIMPLANT_CALL`, and `CRM_MEETING`.

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sync.test.ts -t "backfills missing activity history coverage during delta sync"
```

Expected: FAIL because the current planner adopts coverage from existing snapshots instead of fetching historical activities for all required providers.

**Step 3: Implement minimal planner change**

In `apps/api/src/domain/sync.ts`, make missing activity-history coverage trigger provider backfill requests even when the snapshot has existing activity rows. Preserve coverage writes after snapshot persistence succeeds.

**Step 4: Run targeted test**

Run the same command again.

Expected: PASS.

**Step 5: Run related API sync tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sync.test.ts
```

Expected: PASS.

