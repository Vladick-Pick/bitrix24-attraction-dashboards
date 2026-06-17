# Plan 009: Precompute source-quality stage progression

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c760416..HEAD -- apps/api/src/domain/operational-reports.ts apps/api/test/source-quality-conversion.test.ts apps/api/src/server/service.ts apps/api/test/http.test.ts plans/009-precompute-source-quality-stage-progression.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c760416`, 2026-06-15

## Why This Matters

`buildSourceQualityConversionReport` is in the CRG-identified affected flow and
is called from the public `/api/reports/source-quality-conversion` endpoint. The
current implementation repeatedly scans deals and stage-history rows inside
row/stage/deal loops. The report already has focused tests, so this is a good
candidate for a low-risk algorithmic cleanup: precompute per-deal progression
once, then aggregate from maps.

## Current State

- `buildStageHistoryMap` already groups and sorts history rows by deal id.
- `buildSourceQualityConversionReport` first filters `input.stageHistory` by
  calling `input.deals.find(...)` for every history row.
- Then for every result row and every stage, it filters each deal's history to
  `<= report.to` and rebuilds `Set`s and `Map`s repeatedly.
- `createReportingService.getSourceQualityConversionReport` already scopes deals
  and stage history before calling the builder, but the builder still repeats
  work internally.

Relevant excerpts:

```ts
// apps/api/src/domain/operational-reports.ts:253-275
function buildStageHistoryMap(stageHistory: StageHistorySnapshot[]) {
  const map = new Map<string, StageHistorySnapshot[]>();

  for (const row of stageHistory) {
    const current = map.get(row.ownerId) ?? [];
    current.push(row);
    map.set(row.ownerId, current);
  }

  for (const rows of map.values()) {
    rows.sort((left, right) => {
      const leftTime = Date.parse(left.createdTime);
      const rightTime = Date.parse(right.createdTime);
      // ...
    });
  }

  return map;
}
```

```ts
// apps/api/src/domain/operational-reports.ts:1052-1067
export function buildSourceQualityConversionReport(
  input: SourceQualityConversionInput
): SourceQualityConversionReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageSequence = getStageSequence(input.stageCatalog);
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => {
      const deal = input.deals.find((item) => item.id === row.ownerId);
      return Boolean(
        deal && allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
      );
    })
  );
```

```ts
// apps/api/src/domain/operational-reports.ts:1101-1128
const stageMetrics = stageSequence.map<StageProgressionMetric>((stage) => {
  const reachedDeals = row.deals.filter((deal) => {
    const historyAsOf = (stageHistoryMap.get(deal.id) ?? []).filter((entry) => {
      const entryTime = Date.parse(entry.createdTime);
      return Number.isFinite(entryTime) && entryTime <= toMs;
    });
    const stages = new Set(
      historyAsOf.map((entry) => entry.stageId)
    );
    if (historyAsOf.length === 0) {
      stages.add(deal.stageId);
    }
    return stages.has(stage.stageId);
  });
  const durationHistoryMap = new Map(
    reachedDeals.map((deal) => [
      deal.id,
      (stageHistoryMap.get(deal.id) ?? []).filter((entry) => {
        const entryTime = Date.parse(entry.createdTime);
        return Number.isFinite(entryTime) && entryTime <= toMs;
      })
    ])
  );
  const durations = reachedDeals.flatMap((deal) =>
    resolveDurationMetrics(deal.id, stage.stageId, durationHistoryMap)
  );
```

```ts
// apps/api/src/server/service.ts:2176-2205
async getSourceQualityConversionReport({ periodDays, range, compareRanges, filters }) {
  const scopedFilters = await normalizeAttractionReportFilters(filters);
  const [deals, stageCatalog, stageHistory, wonStageIds] = await Promise.all([
    input.repository.getAllDeals(),
    getScopedStageCatalog(true),
    input.repository.getAllStageHistory(),
    input.repository.getWonStageIds()
  ]);
  const canonical = await loadCanonicalReportInputs({ stageHistory });
  const reportStageHistory = canonical.stageHistory;
  const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
  const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
  const scopedStageHistory = reportStageHistory.filter((row) =>
    scopedDealIds.has(row.ownerId)
  );
  const buildSnapshot = (targetRange: ReportRange) =>
    buildSourceQualityConversionReport({ range: targetRange, wonStageIds, deals: scopedDeals, stageCatalog, stageHistory: scopedStageHistory });
}
```

Existing coverage:

```ts
// apps/api/test/source-quality-conversion.test.ts:293-414
it("cuts stage progression at the report end instead of using future history or current stage", () => {
  // Future May history must not make an April report count later stages.
  expect(result.rows[0]?.stageMetrics.map((stage) => ({
    stageId: stage.stageId,
    reachedDeals: stage.reachedDeals,
    conversionRate: stage.conversionRate
  }))).toEqual([
    { stageId: "C10:NEW", reachedDeals: 1, conversionRate: 100 },
    { stageId: "C10:PREPARATION", reachedDeals: 1, conversionRate: 100 },
    { stageId: "C10:UC_9E0XYG", reachedDeals: 0, conversionRate: 0 },
    { stageId: "C10:WON", reachedDeals: 0, conversionRate: 0 }
  ]);
});
```

Documented constraints to preserve:

```md
// AGENTS.md:96-101
Reports should use the local API and SQLite snapshot. Do not add direct Bitrix
reads to page rendering.
Bitrix sync is a separate operation; dashboard screens should read cached local
data.
Never fetch or store deal names or contact personal data for reporting.
```

```md
// docs/modules/attraction/MODULE_ONTOLOGY.md:122-145
Inside the ontology: potential participants, Bitrix24 deals in the attraction
funnel, funnel states and transition decisions, meetings, conversion events,
contract terms, handoff to the club, losses/returns, and aggregate analytics
over safe local data.

Outside the ontology: ... personal data: names, phones, email, raw comments,
raw payloads, raw files.
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| Source-quality tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts` | all tests pass |
| HTTP source-quality route tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0, no TypeScript errors |

## Scope

**In scope**:

- `apps/api/src/domain/operational-reports.ts`
- `apps/api/test/source-quality-conversion.test.ts`
- Only if existing route coverage needs assertion updates:
  `apps/api/test/http.test.ts`
- `plans/README.md` status row

**Out of scope**:

- Changing API response shapes
- Changing source/quality labels or sorting
- Changing win/loss semantics
- Changing service-level snapshot loading
- Adding SQL indexes or repository query methods
- Web UI changes
- Bitrix sync changes

## Git Workflow

- Branch: `codex/precompute-source-quality-stage-progression`
- Start from updated `main`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested:
  `perf(api): precompute source quality stage progression`

## Steps

### Step 1: Add a behavior-preserving large-input test

In `apps/api/test/source-quality-conversion.test.ts`, add a test with synthetic
data large enough to exercise repeated history processing, but assert behavior
rather than wall-clock timing.

Suggested test:

- create 40 deals in category `10`;
- give each deal the same source and quality;
- give each deal three stage-history rows before report end and one future row
  after report end;
- call `buildSourceQualityConversionReport`;
- assert:
  - `totalCreatedDeals` is 40;
  - future stage is not counted;
  - reached counts for the first three stages are 40;
  - average durations are the same as a small hand-calculated example.

Do not add a flaky performance threshold such as "must finish under 50ms".

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts`
passes before the refactor.

### Step 2: Replace history-row deal lookup with a deal map

In `buildSourceQualityConversionReport`, build a deal map once:

```ts
const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));
```

Use it in the `stageHistory` filter instead of `input.deals.find(...)`.

Preserve the category filter:

```ts
const deal = dealById.get(row.ownerId);
return Boolean(deal && allowedCategoryIds.has(normalizeCategoryId(deal.categoryId)));
```

**Verify**:

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts` passes.
- `rg -n "input\\.deals\\.find" apps/api/src/domain/operational-reports.ts` returns no matches in `buildSourceQualityConversionReport`.

### Step 3: Precompute per-deal progression as of report end

Create a private helper near `resolveDurationMetrics`, for example:

```ts
interface StageProgressionAsOf {
  historyAsOf: StageHistorySnapshot[];
  reachedStageIds: Set<string>;
  durationsByStageId: Map<string, number[]>;
}
```

Build one `Map<string, StageProgressionAsOf>` before `resultRows`:

```ts
const progressionByDealId = new Map<string, StageProgressionAsOf>();

for (const deal of deals) {
  const historyAsOf = (stageHistoryMap.get(deal.id) ?? []).filter((entry) => {
    const entryTime = Date.parse(entry.createdTime);
    return Number.isFinite(entryTime) && entryTime <= toMs;
  });
  const reachedStageIds = new Set(historyAsOf.map((entry) => entry.stageId));
  if (historyAsOf.length === 0) {
    reachedStageIds.add(deal.stageId);
  }
  progressionByDealId.set(deal.id, {
    historyAsOf,
    reachedStageIds,
    durationsByStageId: buildDurationsByStageId(historyAsOf)
  });
}
```

Preserve the current subtle behavior:

- if a deal has no history at or before report end, fall back to the current
  `deal.stageId`;
- if a deal has some history before report end, do not add the current stage just
  because the current stage changed after the report end.

Implement `buildDurationsByStageId` by walking adjacent history rows once. It
should produce the same durations currently returned by `resolveDurationMetrics`.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts`
passes.

### Step 4: Rewrite `stageMetrics` aggregation to use precomputed maps

Replace the nested filter/map block with direct aggregation:

```ts
const stageMetrics = stageSequence.map<StageProgressionMetric>((stage) => {
  let reachedDeals = 0;
  const durations: number[] = [];

  for (const deal of row.deals) {
    const progression = progressionByDealId.get(deal.id);
    if (!progression?.reachedStageIds.has(stage.stageId)) {
      continue;
    }

    reachedDeals += 1;
    durations.push(...(progression.durationsByStageId.get(stage.stageId) ?? []));
  }

  return {
    stageId: stage.stageId,
    stageName: stage.stageName,
    reachedDeals,
    conversionRate: toRate(reachedDeals, row.deals.length),
    averageStageDurationHours:
      durations.length === 0
        ? 0
        : toHours(durations.reduce((total, duration) => total + duration, 0) / durations.length)
  };
});
```

Do not change the final row sorting or `wonDeals` calculations.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts` passes.
- `rg -n "historyAsOf =|durationHistoryMap|reachedDeals = row\\.deals\\.filter" apps/api/src/domain/operational-reports.ts` returns no matches in `buildSourceQualityConversionReport`.

### Step 5: Run route-level regression coverage

The public endpoint uses the service method at `apps/api/src/server/service.ts`
and should not change response shape.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.
- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

## Test Plan

- Existing source-quality tests must still pass:
  - ordered stage progression metrics;
  - cutting progression at report end;
  - win counting from won-stage history when `dateClosed` is missing.
- Add one synthetic large-input test that verifies behavior under repeated
  stage history without asserting timing.
- Existing HTTP tests must keep `/api/reports/source-quality-conversion`
  response shape unchanged.

## Done Criteria

All must hold:

- [ ] `buildSourceQualityConversionReport` uses a deal map rather than
  `input.deals.find(...)` inside the stage-history filter.
- [ ] Per-deal history as-of, reached stage ids, and stage durations are computed
  once per deal per report snapshot.
- [ ] Future history after `range.to` is still ignored for stage progression.
- [ ] Existing response shape and sorting are unchanged.
- [ ] `pnpm --filter @bitrix24-reporting/api exec vitest run test/source-quality-conversion.test.ts` passes.
- [ ] `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.
- [ ] `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- [ ] `plans/README.md` status row is updated.

## STOP Conditions

Stop and report back if:

- The current source-quality implementation has moved or already uses
  precomputed progression maps.
- The refactor changes totals, row ordering, stage ordering, conversion rates, or
  average duration semantics in existing tests.
- The fix appears to require service/repository query changes.
- You need to expose private helpers only for tests. Prefer testing through
  `buildSourceQualityConversionReport`.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance Notes

- This plan intentionally optimizes in-memory report building only. A later
  read-model/query-layer plan may still be valuable if snapshots grow much
  larger.
- Reviewers should scrutinize the "as of report end" behavior because it is easy
  to accidentally count future stage history.
- Avoid adding timing assertions to unit tests; they are noisy in CI.
