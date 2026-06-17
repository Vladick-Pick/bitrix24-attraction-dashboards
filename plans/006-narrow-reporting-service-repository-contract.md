# Plan 006: Narrow the reporting service repository contract

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c760416..HEAD -- apps/api/src/server/repository-roles.ts apps/api/src/server/service.ts apps/api/src/server/leadgen-service.ts apps/api/src/index.ts apps/api/test/service.test.ts apps/api/test/service-analytics-facts.test.ts apps/api/test/http.test.ts plans/006-narrow-reporting-service-repository-contract.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-split-sqlite-repository-roles.md`
- **Category**: tech-debt
- **Planned at**: commit `c760416`, 2026-06-15

## Why This Matters

Plan 002 created storage role types, but `createReportingService` still accepts
the full `SqliteRepository`. That keeps every report engine coupled to the
entire SQLite adapter and forces tests to use `repository as never`. The goal of
this plan is to make reporting depend on a named, compile-checked
`ReportingRepository` role so future report extraction and module separation do
not inherit hidden SQLite coupling.

## Current State

- `apps/api/src/server/repository-roles.ts` already defines narrow roles such as
  `SnapshotReadRepository`, `AttractionSettingsRepository`, and
  `LeadgenSettingsRepository`.
- `apps/api/src/server/service.ts` still imports `SqliteRepository`, types
  `CreateReportingServiceInput.repository` as the full repository, and contains
  a TODO from the earlier platform-foundation plan.
- `service.ts` uses many `input.repository as Partial<SqliteRepository>` casts
  to probe optional methods.
- `apps/api/test/service.test.ts` creates service instances with
  `repository: repository as never` because the service input type is too wide
  for focused test doubles.

Relevant excerpts:

```ts
// apps/api/src/server/service.ts:131-151
import type {
  CallAnalysisResultRecord,
  CallAnalysisRunSummary,
  SqliteRepository
} from "./sqlite-repository.js";

interface CreateReportingServiceInput {
  // ...
  // TODO(platform-foundation Plan 002): narrow to ReportingRepository after report engines split.
  repository: SqliteRepository;
  client: SyncClient;
}
```

```ts
// apps/api/src/server/service.ts:1008-1079
const getPricingRules = async () => {
  const repositoryWithPricing = input.repository as Partial<SqliteRepository>;
  return typeof repositoryWithPricing.getPricingRules === "function"
    ? repositoryWithPricing.getPricingRules()
    : DEFAULT_PRICING_RULES;
};

const getCachedDealStageFacts = () => {
  const repositoryWithFacts = input.repository as Partial<SqliteRepository>;
  if (typeof repositoryWithFacts.getAllDealStageFacts !== "function") {
    return Promise.resolve([] as DealStageFacts);
  }
  // ...
};
```

```ts
// apps/api/src/server/repository-roles.ts:28-58
export type SnapshotReadRepository = Pick<
  SqliteRepository,
  | "getLatestSuccessCursor"
  | "getLatestSuccessfulScope"
  | "getSnapshotStats"
  | "getActivitySnapshotCount"
  | "getDealIdsByCategoryIds"
  | "getOpenDealIdsByCategoryIds"
  | "getDealsByIds"
  | "getActivitiesByIds"
  | "getCallById"
  | "getStageAtDealTime"
  | "getAllLeads"
  | "getAllDeals"
  | "getAllStageHistory"
  | "getAllActivities"
  | "getAllActivityBindings"
  | "getAllActivityDeadlineChanges"
  | "getAllDealMeetingDateChanges"
  | "getAllConversionEventVisits"
  | "getAllIdentityLinks"
  | "getAllDealStageFacts"
  | "getAllDealTouchpointFacts"
  | "getAllEventSnapshots"
  | "getAllEventVisitFacts"
  | "getAllEventVisitStageHistory"
  | "getAllCalls"
  | "getManagerDirectory"
  | "getStageCatalog"
  | "getWonStageIds"
>;
```

```ts
// apps/api/test/service.test.ts:32-38
const service = createReportingService({
  dealCategoryIds: ["10"],
  qualityFieldName: "UF_CRM_TEST",
  repository: repository as never,
  client: {
    fetchUsers: async () => []
  } as never,
  defaultPeriodDays: 30,
});
```

Documented constraints to preserve:

```md
// docs/adr/0001-separate-attraction-and-leadgen-products.md:19-30
Treat `attraction` and `leadgen` as separate products. Keep shared/platform
narrow: auth, RBAC, module membership, dashboard comments, Paperclip routing
primitives, safe local snapshot primitives, contracts/tooling needed by both
products, and shared UI primitives.

Do not put module-owned report logic, report registry, ontology, manager
whitelist, sync policy, screen copy, or module-specific dashboard layout into
the shared platform.
```

```md
// docs/architecture/module-capabilities.md:72-80
Agents must not consume or receive:
- raw SQLite handles;
- full repository adapters such as `SqliteRepository`;
- direct Bitrix clients or webhooks;
- raw Bitrix payloads;
- deal names;
- contact names, phones, emails or other personal fields;
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0, no TypeScript errors |
| Service tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts test/service-analytics-facts.test.ts` | all tests pass |
| HTTP smoke tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |
| Workspace typecheck | `pnpm typecheck` | exit 0, no TypeScript errors |

## Scope

**In scope**:

- `apps/api/src/server/repository-roles.ts`
- `apps/api/src/server/service.ts`
- `apps/api/src/server/leadgen-service.ts`
- `apps/api/src/index.ts`
- Focused test type cleanup in:
  - `apps/api/test/service.test.ts`
  - `apps/api/test/service-analytics-facts.test.ts`
  - `apps/api/test/http.test.ts`
- `plans/README.md` status row

**Out of scope**:

- SQL schema changes or migrations
- Changing report output shapes
- Changing Bitrix sync behavior
- Moving route handlers out of `createApp` (plan 008)
- Optimizing report algorithms (plan 009)
- Web UI changes
- Renaming or deleting existing repository methods

## Git Workflow

- Branch: `codex/narrow-reporting-repository-contract`
- Start from updated `main`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `refactor(api): narrow reporting repository contract`

## Steps

### Step 1: Inventory the live service method surface

Run:

`rg -n "input\\.repository\\.|Partial<SqliteRepository>|SqliteRepository\\[|TODO\\(platform-foundation Plan 002\\)" apps/api/src/server/service.ts`

Create a scratch checklist from the output. Classify each repository method into:

- required snapshot/report read methods;
- optional settings/default methods that currently fall back when absent;
- sync/write methods used only by `performSync`, `rebuildAnalyticsFacts`, or
  settings replacement paths;
- type-only references such as `ReturnType<SqliteRepository["getAllDeals"]>`.

Do not edit code in this step.

**Verify**: The checklist includes every match from the command above. If the
command returns methods not represented in `repository-roles.ts`, note them for
Step 2.

### Step 2: Add an explicit `ReportingRepository` role

In `apps/api/src/server/repository-roles.ts`, add a role that describes exactly
what `createReportingService` is allowed to use. Prefer composing existing roles
over copying long method lists.

Target shape:

```ts
export type ReportingRepository =
  SnapshotReadRepository &
  SnapshotWriteRepository &
  SyncRunRepository &
  AttractionSettingsRepository &
  Pick<
    SqliteRepository,
    | "getLastSyncSummary"
    | "hasSyncCoverage"
    | "upsertSyncCoverage"
    | "getOperationalHistoryBootstrappedAt"
    | "setOperationalHistoryBootstrappedAt"
    | "getCallHistoryBootstrappedAt"
    | "setCallHistoryBootstrappedAt"
    | "getCallActivityHistoryBootstrappedAt"
    | "setCallActivityHistoryBootstrappedAt"
    | "getMeetingActivityHistoryBootstrappedAt"
    | "setMeetingActivityHistoryBootstrappedAt"
    | "getTaskActivityHistoryBootstrappedAt"
    | "setTaskActivityHistoryBootstrappedAt"
    | "getDealCustomFieldsBootstrappedAt"
    | "setDealCustomFieldsBootstrappedAt"
    | "getDealMeetingDateFieldBootstrappedAt"
    | "setDealMeetingDateFieldBootstrappedAt"
  >;
```

Adjust the list using the Step 1 inventory. If a method is used only through a
safe optional fallback, represent that optionality explicitly with a helper type,
for example:

```ts
type OptionalReportingRepositoryMethods = Partial<Pick<SqliteRepository, "...">>;
export type ReportingRepository = RequiredReportingRepository & OptionalReportingRepositoryMethods;
```

The important constraint is: optional methods are named on
`ReportingRepository`; `service.ts` must no longer cast to
`Partial<SqliteRepository>`.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 3: Switch `createReportingService` to the role

In `apps/api/src/server/service.ts`:

1. Import `ReportingRepository` from `./repository-roles.js`.
2. Remove `SqliteRepository` from the `./sqlite-repository.js` import if it is
   no longer needed for call-analysis record types.
3. Change `CreateReportingServiceInput.repository` from `SqliteRepository` to
   `ReportingRepository`.
4. Delete the TODO at `service.ts:150`.
5. Replace type aliases based on `SqliteRepository["method"]` with aliases based
   on `ReportingRepository["method"]`.
6. Replace every `input.repository as Partial<SqliteRepository>` with direct
   optional-method checks against `ReportingRepository`.

Example target style:

```ts
const getPricingRules = async () =>
  typeof input.repository.getPricingRules === "function"
    ? input.repository.getPricingRules()
    : DEFAULT_PRICING_RULES;
```

Do not change report behavior in this step.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `rg -n "Partial<SqliteRepository>|TODO\\(platform-foundation Plan 002\\)|SqliteRepository\\[" apps/api/src/server/service.ts` returns no matches.

### Step 4: Update callers without widening the role again

Review these callers:

- `apps/api/src/index.ts:92` creates the attraction reporting service.
- `apps/api/src/server/leadgen-service.ts:196` creates a leadgen-scoped
  reporting service.

Both currently pass concrete SQLite repositories. They should compile against
`ReportingRepository` without adapters because `createSqliteRepository`
implements the full method set.

Do not add `as SqliteRepository` or `as never` at the production call sites. If
TypeScript complains, fix the role definition instead of weakening the caller.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 5: Tighten focused test doubles

Update tests that instantiate `createReportingService` so the narrow role earns
its keep. In `apps/api/test/service.test.ts`, replace easy
`repository as never` cases with one of these safer patterns:

```ts
import type { ReportingRepository } from "../src/server/repository-roles";

const repository = {
  getSalesPlanRows: async () => []
} satisfies Partial<ReportingRepository>;
```

Only keep `as never` where a test intentionally supplies a very small partial
and the alternative would make the test much noisier than the behavior it
covers. Do not spend time building a large fake repository factory unless it
reduces repeated setup.

For `apps/api/test/service-analytics-facts.test.ts`, keep the real
`createSqliteRepository` integration style.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts test/service-analytics-facts.test.ts`
passes.

### Step 6: Run HTTP regression tests

Because the reporting service is wired into `createApp`, run the broad API HTTP
test file after type narrowing.

**Verify**:
`pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts`
passes.

## Test Plan

- Existing `apps/api/test/service.test.ts` should continue to cover reporting
  service behavior with focused doubles.
- Existing `apps/api/test/service-analytics-facts.test.ts` should continue to
  cover real SQLite integration for analytics facts.
- Existing `apps/api/test/http.test.ts` should continue to cover route-level
  wiring and response shapes.
- No new runtime behavior test is required unless the type narrowing exposes a
  missing fallback path; if it does, add the smallest test in `service.test.ts`
  that reproduces the fallback.

## Done Criteria

All must hold:

- [ ] `CreateReportingServiceInput.repository` is typed as `ReportingRepository`.
- [ ] `apps/api/src/server/service.ts` has no `Partial<SqliteRepository>` casts.
- [ ] The old `TODO(platform-foundation Plan 002)` is removed.
- [ ] Production callers compile without `as never` or widening casts.
- [ ] `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- [ ] `pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts test/service-analytics-facts.test.ts` passes.
- [ ] `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.
- [ ] `plans/README.md` status row is updated.

## STOP Conditions

Stop and report back if:

- The code at the cited locations does not match the current-state excerpts.
- `ReportingRepository` needs methods that are not implemented by
  `createSqliteRepository`.
- Type narrowing appears to require changing report output, sync behavior, or SQL
  schema.
- More than a few tests require large, noisy fake repositories; report that the
  service needs a test fixture plan instead of improvising a broad rewrite.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance Notes

- This is a contract cleanup, not a behavior change. Reviewers should scrutinize
  casts and type aliases more than runtime logic.
- Future report engines should depend on `ReportingRepository` or smaller
  report-specific read roles, never on `SqliteRepository`.
- This plan intentionally leaves route handler extraction to plan 008 and report
  algorithm performance to plan 009.
