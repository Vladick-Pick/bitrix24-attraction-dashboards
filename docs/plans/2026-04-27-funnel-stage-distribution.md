# Funnel Stage Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render a factual stage-transition distribution report below the funnel throughput chart.

**Architecture:** Extend the web-only scene data model with distribution nodes and edges. Keep API/database/sync untouched and map missing backend transition fields to an empty array. Render a compact SVG flow map from factual source-to-target edges, with static fallback data for prototype mode.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing `apps/web` proto scene components.

---

### Task 1: Add The Failing Test

**Files:**
- Modify: `apps/web/src/App.test.tsx`

**Step 1:** Add a test that navigates to "Движение по воронке".

**Step 2:** Assert "Пропускная способность и очереди" appears before "Распределение этапов воронки".

**Step 3:** Assert the distribution report includes a direct factual jump label, for example "Звонок-знакомство -> Контрактация".

**Step 4:** Run `pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/App.test.tsx`.

**Expected:** The new test fails because the distribution report does not exist yet.

### Task 2: Extend Scene Data Types

**Files:**
- Modify: `apps/web/src/proto/types.ts`
- Modify: `apps/web/src/proto/live-reporting.ts`

**Step 1:** Add `TocStageDistributionNode` and `TocStageDistributionEdge` interfaces.

**Step 2:** Add `stageDistribution` to `TocFlowSceneData`.

**Step 3:** Return an empty `stageDistribution` from live mapping until backend data exists.

**Step 4:** Run the failing test again.

**Expected:** The test still fails at the UI assertion.

### Task 3: Render The Report

**Files:**
- Modify: `apps/web/src/proto/scenes.tsx`

**Step 1:** Add static fallback nodes and edges using factual direct transitions, including a jump from "Звонок-знакомство" to "Контрактация".

**Step 2:** Add a `FunnelStageDistributionChart` component that renders nodes and edges under the throughput chart.

**Step 3:** Insert the component immediately after `FunnelTocChart`.

**Step 4:** Run `pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/App.test.tsx`.

**Expected:** The new test passes.

### Task 4: Verify Scope

**Files:**
- Inspect: `git diff -- apps/web/src/proto/scenes.tsx apps/web/src/proto/types.ts apps/web/src/proto/live-reporting.ts apps/web/src/App.test.tsx`

**Step 1:** Confirm no API, sync, SQLite, or contract changes were introduced.

**Step 2:** Run `pnpm --filter @bitrix24-reporting/web exec vitest run`.

**Expected:** Web tests pass or any unrelated existing failures are documented.
