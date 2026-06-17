# Plan 007: Load leadgen workload reports lazily

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c760416..HEAD -- apps/web/src/proto/proto-app.tsx apps/web/src/proto/proto-app.test.tsx apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts design.md docs/modules/leadgen/MODULE_ONTOLOGY.md plans/007-load-leadgen-workload-lazily.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c760416`, 2026-06-15

## Why This Matters

The attraction module already loads non-sales scenes lazily, but leadgen still
blocks initial readiness on funnel, activities workload, and calls workload.
That makes every leadgen entry pay for the activity tab even when the user only
needs the sales/funnel report. This plan makes leadgen match the repository rule
that heavy reports load by active screen, while keeping the existing API and UI
shell intact.

## Current State

- `ProtoApp` owns leadgen data state in `apps/web/src/proto/proto-app.tsx`.
- The leadgen branch inside `loadRuntimeData` fetches meta, funnel, activities,
  and calls in one `Promise.all`.
- Attraction has a separate lazy scene loader after the initial sales scene is
  ready.
- `LeadgenDashboard` owns its active tab state internally, so the parent cannot
  currently trigger data loads based on the leadgen activity tab.
- Existing tests assert the old eager behavior.

Relevant excerpts:

```tsx
// apps/web/src/proto/proto-app.tsx:1880-1904
if (isLeadgenModule) {
  setLeadgenReportStatus('loading')
  setLeadgenReportError(null)
  setLeadgenWorkload(null)
  // ...

  const [meta, report, activities, calls] = await Promise.all([
    apiClient.getMeta(activeModuleId),
    apiClient.getLeadgenFunnelReport(activeModuleId, query),
    apiClient.getLeadgenActivitiesWorkloadReport(activeModuleId, query),
    apiClient.getLeadgenCallsWorkloadReport(activeModuleId, query),
  ])

  setLeadgenReport(report)
  setLeadgenWorkload({
    activities,
    calls,
    scene: mapActivitiesCallsSceneData({ activities, calls }),
  })
}
```

```tsx
// apps/web/src/proto/proto-app.tsx:2056-2104
useEffect(() => {
  if (isLeadgenModule || activeAttractionSceneLoadKey === 'sales') {
    return
  }

  if (salesSceneStatus !== 'ready') {
    return
  }

  async function loadActiveAttractionScene() {
    setRuntimeData((current) =>
      setRuntimeSceneState(current, activeAttractionSceneLoadKey, 'loading', null),
    )

    if (activeAttractionSceneLoadKey === 'activities-calls') {
      const [activities, calls, acquisitionOutcomes, targetGroupConversion, conversionEvents] =
        await Promise.all([
          apiClient.getActivitiesWorkloadReport(query),
          apiClient.getCallsWorkloadReport(query),
          apiClient.getAcquisitionOutcomesReport(query),
          apiClient.getTargetGroupConversionReport(query),
          apiClient.getConversionEventsReport(query),
        ])
    }
  }
}, [activeAttractionSceneLoadKey, appliedFilters, isLeadgenModule, salesSceneStatus])
```

```tsx
// apps/web/src/proto/proto-app.tsx:1111-1136
type LeadgenReportId = 'sales' | 'activity'

const leadgenReportTabs: Array<{ id: LeadgenReportId; label: string }> = [
  { id: 'sales', label: 'Отчет по продажам' },
  { id: 'activity', label: 'Отчет активности' },
]

function LeadgenDashboard(...) {
  const [activeReportId, setActiveReportId] = useState<LeadgenReportId>('sales')
  const isSalesReport = activeReportId === 'sales'
}
```

```tsx
// apps/web/src/proto/proto-app.test.tsx:3000-3015
await waitFor(() => {
  expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
    'leadgen',
    expect.objectContaining({ preset: 'custom' }),
  )
  expect(apiClient.getLeadgenActivitiesWorkloadReport).toHaveBeenCalledWith(
    'leadgen',
    expect.objectContaining({ preset: 'custom' }),
  )
  expect(apiClient.getLeadgenCallsWorkloadReport).toHaveBeenCalledWith(
    'leadgen',
    expect.objectContaining({ preset: 'custom' }),
  )
})
```

Documented constraints to preserve:

```md
// AGENTS.md:96-101
Reports should use the local API and SQLite snapshot. Do not add direct Bitrix
reads to page rendering.
Bitrix sync is a separate operation; dashboard screens should read cached local
data.
Heavy reports should be loaded lazily by active screen or background prefetch,
not block the initial UI render.
```

```md
// design.md:86-90
`leadgen` has a separate report registry and dashboard screen. Comments,
comment anchors, notifications, and module admin actions must resolve through
the active module context.

Attraction UI/report behavior is protected.
```

```md
// docs/modules/leadgen/MODULE_ONTOLOGY.md:48-55
All leadgen reports must use only deals where:
- `CATEGORY_ID = 28`;
- `ASSIGNED_BY_ID` is in the leadgen manager whitelist configured by
  `BITRIX24_LEADGEN_MANAGER_IDS`;
- the requested date/source/manager filters still remain inside that whitelist.
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| Web typecheck | `pnpm --filter @bitrix24-reporting/web typecheck` | exit 0, no TypeScript errors |
| ProtoApp tests | `pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx` | all tests pass |
| API client tests | `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts` | all tests pass |
| Web build | `pnpm --filter @bitrix24-reporting/web build` | exit 0 |

## Scope

**In scope**:

- `apps/web/src/proto/proto-app.tsx`
- `apps/web/src/proto/proto-app.test.tsx`
- Only if needed for test fixtures: `apps/web/src/lib/api-client.test.ts`
- `plans/README.md` status row

**Out of scope**:

- API route changes
- Leadgen report SQL/domain logic
- New visual design, CSS theme changes, or layout redesign
- Attraction scene behavior changes
- Direct Bitrix reads from the browser
- Changing comment block ids or labels

## Git Workflow

- Branch: `codex/lazy-load-leadgen-workload`
- Start from updated `main`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `perf(web): lazy-load leadgen workload reports`

## Steps

### Step 1: Lift the leadgen active tab state to `ProtoApp`

In `apps/web/src/proto/proto-app.tsx`, move the active leadgen report tab state
out of `LeadgenDashboard` and into `ProtoApp`.

Target shape:

```tsx
const [leadgenActiveReportId, setLeadgenActiveReportId] =
  useState<LeadgenReportId>('sales')
```

Change `LeadgenDashboard` props to accept:

```tsx
activeReportId: LeadgenReportId
onActiveReportChange: (reportId: LeadgenReportId) => void
```

Inside `LeadgenDashboard`, remove its local `useState` and call
`onActiveReportChange(tab.id)` from the tab buttons.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` exits 0.

### Step 2: Split funnel status from workload status

Keep `leadgenReportStatus` for the funnel/sales report. Add separate workload
state in `ProtoApp`:

```tsx
const [leadgenWorkloadStatus, setLeadgenWorkloadStatus] =
  useState<'idle' | 'loading' | 'error'>('idle')
const [leadgenWorkloadError, setLeadgenWorkloadError] = useState<string | null>(null)
```

Pass both to `LeadgenDashboard`. In `LeadgenDashboard`:

- sales metrics should use `leadgenReportStatus`;
- activity metrics and activity empty/loading state should use
  `leadgenWorkloadStatus`;
- sales errors should not automatically make the activity tab look failed unless
  the workload request failed too.

Do not change the visual primitives; continue using existing `.panel`,
`.metric`, `.tab-chip`, and current copy.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` exits 0.

### Step 3: Make initial leadgen load fetch only meta and funnel

In the `isLeadgenModule` branch of `loadRuntimeData`, replace the four-way
`Promise.all` with meta and funnel only:

```tsx
const [meta, report] = await Promise.all([
  apiClient.getMeta(activeModuleId),
  apiClient.getLeadgenFunnelReport(activeModuleId, query),
])
```

On every leadgen initial reload or filter change:

- set `leadgenReportStatus` to `loading`;
- clear `leadgenReportError`;
- set `leadgenWorkload(null)`;
- reset `leadgenWorkloadStatus` to `idle`;
- clear `leadgenWorkloadError`;
- leave `leadgenActiveReportId` unchanged unless existing UX requires resetting
  to sales. Prefer preserving the selected tab and letting Step 4 load workload
  if the active tab is still `activity`.

Do not remove the API client methods; they are still used for lazy activity
loading.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` exits 0.

### Step 4: Add a leadgen workload lazy loader effect

Add a `useEffect` in `ProtoApp` after the initial runtime loader. It should:

- return immediately unless `isLeadgenModule` is true;
- return unless `leadgenActiveReportId === 'activity'`;
- return if the funnel report has not loaded yet;
- return if workload is already `loading` or already present for the current
  request;
- build the same query with `buildDashboardQueryFromProtoFilters(appliedFilters)`;
- fetch activities and calls in parallel;
- guard against stale responses using `runtimeRequestRef.current` and
  `isMountedRef.current`, matching the attraction lazy loader pattern;
- on success set `leadgenWorkload({ activities, calls, scene:
  mapActivitiesCallsSceneData({ activities, calls }) })`;
- on error set `leadgenWorkloadStatus` to `error` and store a user-facing
  Russian error message.

Target request body behavior must remain identical to the old eager calls:
`apiClient.getLeadgenActivitiesWorkloadReport(activeModuleId, query)` and
`apiClient.getLeadgenCallsWorkloadReport(activeModuleId, query)`.

**Verify**:
`pnpm --filter @bitrix24-reporting/web typecheck` exits 0.

### Step 5: Update ProtoApp tests to lock in lazy behavior

In `apps/web/src/proto/proto-app.test.tsx`, update the leadgen module test around
line 2800/3000:

1. After switching to leadgen and before clicking the activity tab, assert:

```tsx
expect(apiClient.getLeadgenFunnelReport).toHaveBeenCalledWith(
  'leadgen',
  expect.objectContaining({ preset: 'custom' }),
)
expect(apiClient.getLeadgenActivitiesWorkloadReport).not.toHaveBeenCalled()
expect(apiClient.getLeadgenCallsWorkloadReport).not.toHaveBeenCalled()
```

2. Click the "Отчет активности" tab.
3. Then assert the activity/calls workload endpoints are called with the same
   module id and query shape.
4. Keep the existing assertions that attraction report endpoints are not called.

Add one focused test if it does not already fall out of the updated test:

- when filters change while the activity tab is active, the workload is cleared
  and reloaded for the new `preset: 'custom'` query.

Do not snapshot the whole DOM.

**Verify**:
`pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx`
passes.

### Step 6: Run the focused web checks

Run the relevant tests and build after the UI state refactor.

**Verify**:

- `pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx src/lib/api-client.test.ts` passes.
- `pnpm --filter @bitrix24-reporting/web typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/web build` exits 0.

## Test Plan

- Update the existing leadgen switch test in
  `apps/web/src/proto/proto-app.test.tsx`.
- Cover the new lazy boundary:
  - initial leadgen entry calls meta + funnel only;
  - clicking "Отчет активности" calls activities + calls workload;
  - attraction endpoints are still not called from leadgen;
  - stale or repeated tab clicks do not duplicate in-flight workload requests.
- Keep `apps/web/src/lib/api-client.test.ts` passing to prove endpoint URL
  shapes did not change.

## Done Criteria

All must hold:

- [ ] Initial leadgen module load no longer calls
  `getLeadgenActivitiesWorkloadReport` or `getLeadgenCallsWorkloadReport`.
- [ ] Leadgen activity tab loads workload on demand.
- [ ] Leadgen workload is reset when filters/module request changes.
- [ ] Attraction lazy scene loading behavior is unchanged.
- [ ] No CSS/theme redesign is included.
- [ ] `pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx src/lib/api-client.test.ts` passes.
- [ ] `pnpm --filter @bitrix24-reporting/web typecheck` exits 0.
- [ ] `pnpm --filter @bitrix24-reporting/web build` exits 0.
- [ ] `plans/README.md` status row is updated.

## STOP Conditions

Stop and report back if:

- `LeadgenDashboard` has been substantially rewritten since this plan and no
  longer owns tab state.
- Lazy loading requires API changes or new server endpoints.
- The implementation appears to change attraction scenes, filters, comments, or
  layout.
- Tests require brittle timers or arbitrary sleeps. Use `waitFor` and visible UI
  signals instead.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance Notes

- Future leadgen tabs should follow this pattern: initial module load should
  fetch only meta and the default visible report; secondary report data should be
  loaded by active tab or safe background prefetch.
- Reviewers should check for duplicate requests when filters change quickly.
- This plan intentionally does not optimize the server-side leadgen report
  builders.
