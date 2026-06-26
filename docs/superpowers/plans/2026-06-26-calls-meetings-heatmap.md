# Calls And Meetings Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expandable per-manager heatmaps for segmented outgoing calls, combined created/closed tasks, and meetings in the existing activity report.

**Architecture:** Extend existing `ActivitiesWorkloadReport` and `CallsWorkloadReport` manager rows with bounded weekday-hour heatmap objects. Heatmap cells may include typed segments. Reuse the existing `activities-calls` scene and render drill-down rows inside current tables.

**Tech Stack:** TypeScript, Express API domain report builders, React, Vitest.

---

### Task 1: Backend Heatmap Contract

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/domain/operational-reports.ts`
- Test: `apps/api/test/activities-workload.test.ts`
- Test: `apps/api/test/calls-workload.test.ts`

- [x] Write failing tests for manager calls, combined tasks, and meetings heatmaps.
- [x] Add `HourlyWeekdayWorkloadHeatmap` segment contract.
- [x] Add heatmap helpers that initialize weekdays `1..7` and hours `9..21`.
- [x] Populate calls from `callStartDate` with successful/other/no-answer segments; populate tasks from created and completed timestamps; populate meetings from `meetingAt`.
- [x] Run focused API tests.

### Task 2: Web Normalization

**Files:**
- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Test: `apps/web/src/lib/api-client.test.ts`

- [x] Write failing normalizer tests for the new heatmap fields.
- [x] Mirror the contract types in dashboard types.
- [x] Normalize heatmap objects defensively, including cell segments.
- [x] Run focused web API client tests.

### Task 3: Expandable UI

**Files:**
- Modify: `apps/web/src/proto/scenes.tsx`
- Test: `apps/web/src/proto/live-reporting.test.ts`

- [x] Write failing UI/mapping tests for expandable heatmaps in activity and meeting sections.
- [x] Render manager summary rows as expandable groups with segmented calls and combined task heatmaps.
- [x] Render meetings rows as expandable groups with meeting heatmaps.
- [x] Keep table layout dense and consistent with `design.md`.
- [x] Run focused web tests and typecheck.
