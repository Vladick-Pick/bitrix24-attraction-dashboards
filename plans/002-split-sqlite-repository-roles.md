# Plan 002: Split the SQLite repository interface by role

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 5a2884f..HEAD -- apps/api/src/index.ts apps/api/src/server/sqlite-repository.ts apps/api/src/server/service.ts apps/api/src/server/leadgen-service.ts apps/api/src/server/app.ts apps/api/test/sqlite.test.ts apps/api/test/service.test.ts apps/api/test/http.test.ts plans/002-split-sqlite-repository-roles.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-record-product-split-decision.md`
- **Category**: tech-debt
- **Planned at**: commit `5a2884f`, 2026-06-14

## Why This Matters

The entrypoint already creates `platformRepository`, `attractionRepository`, and
`leadgenRepository`, but all three are the same full `SqliteRepository` adapter.
That interface exposes sync cursors, snapshots, facts, settings, comments, sales
plans, call analysis, and module whitelists to every caller. A clean platform
base needs role interfaces first, so later route and package extraction can
depend on narrow storage roles instead of the entire SQLite implementation.

## Current State

- `apps/api/src/index.ts` creates three repository instances with different
  database URLs.
- `apps/api/src/server/sqlite-repository.ts` exports a single wide
  `SqliteRepository` interface and one `createSqliteRepository` adapter.
- `apps/api/src/server/app.ts` defines private comments store interfaces that
  overlap with storage responsibilities.
- `apps/api/src/server/service.ts` and `apps/api/src/server/leadgen-service.ts`
  both depend on the full repository interface.

Relevant excerpts:

```ts
// apps/api/src/index.ts:14-28
const platformRepository = createSqliteRepository({
  databaseUrl: env.platformDatabaseUrl,
  defaultWonStageIds: env.reportWonStageIds
});
const attractionRepository =
  env.attractionDatabaseUrl === env.platformDatabaseUrl
    ? platformRepository
    : createSqliteRepository({
        databaseUrl: env.attractionDatabaseUrl,
        defaultWonStageIds: env.reportWonStageIds
      });
const leadgenRepository = createSqliteRepository({
  databaseUrl: env.leadgenDatabaseUrl,
  defaultWonStageIds: env.reportWonStageIds
});
```

```ts
// apps/api/src/index.ts:198-210
const app = createApp(service, {
  webOrigin: env.WEB_ORIGIN,
  ...(auth ? { auth } : {}),
  ...(authStore ? { authStore } : {}),
  comments: platformRepository,
  protoComments: platformRepository,
  modules: {
    attraction: service,
    leadgen: leadgenService
  },
```

```ts
// apps/api/src/server/sqlite-repository.ts:262-283
export interface SqliteRepository {
  getLatestSuccessCursor(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<string | null>;
  getLatestSuccessfulScope(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<SuccessfulSyncScope | null>;
  runSnapshotTransaction<T>(task: () => T): T;
  getSyncCursor(key: string): Promise<string | null>;
  setSyncCursor(input: SyncCursorInput): Promise<void>;
  hasSyncCoverage(input: SyncCoverageQuery): Promise<boolean>;
  upsertSyncCoverage(input: SyncCoverageInput): Promise<void>;
  getOperationalHistoryBootstrappedAt(): Promise<string | null>;
  getCallHistoryBootstrappedAt(): Promise<string | null>;
  getCallActivityHistoryBootstrappedAt(): Promise<string | null>;
  getMeetingActivityHistoryBootstrappedAt(): Promise<string | null>;
  getTaskActivityHistoryBootstrappedAt(): Promise<string | null>;
  getDealCustomFieldsBootstrappedAt(): Promise<string | null>;
  getDealMeetingDateFieldBootstrappedAt(): Promise<string | null>;
  getSnapshotStats(scope?: SnapshotStatsScope): Promise<SnapshotStats>;
```

```ts
// apps/api/src/server/sqlite-repository.ts:449-480
  getProtoComments(): Promise<ProtoCommentStore>;
  replaceProtoComments(input: ProtoCommentStore): Promise<ProtoCommentStore>;
  getDashboardComments(moduleId: string): Promise<{
    comments: DashboardCommentRecord[];
    updatedAt: string | null;
  }>;
  getDashboardCommentById(id: string): Promise<DashboardCommentRecord | null>;
  createDashboardComment(input: DashboardCommentRecord): Promise<DashboardCommentRecord>;
  updateDashboardComment(input: {
    id: string;
    text?: string;
    context?: DashboardCommentContext;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  archiveDashboardComment(input: {
    id: string;
    archivedAt: string;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  updateDashboardCommentPaperclip(input: {
    id: string;
    paperclipIssueId?: string | null;
```

```sql
-- apps/api/src/server/sqlite-repository.ts:1043-1060
CREATE TABLE IF NOT EXISTS module_event_type_settings (...);
CREATE TABLE IF NOT EXISTS module_manager_whitelist_settings (...);
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0, no TypeScript errors |
| SQLite tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts` | all tests pass |
| Service tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts` | all tests pass |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |

## Scope

**In scope**:

- `apps/api/src/server/repository-roles.ts` (create)
- `apps/api/src/server/sqlite-repository.ts`
- `apps/api/src/server/app.ts` (only to import/use shared store role types if
  needed; do not move routes in this plan)
- `apps/api/src/server/service.ts`
- `apps/api/src/server/leadgen-service.ts`
- `apps/api/src/index.ts`
- Focused API tests if TypeScript narrowing exposes missing role coverage:
  `apps/api/test/sqlite.test.ts`, `apps/api/test/service.test.ts`,
  `apps/api/test/http.test.ts`
- `plans/README.md` status row

**Out of scope**:

- Moving route handlers out of `apps/api/src/server/app.ts` (plan 003)
- Rewriting SQL schema or data migrations
- Changing response shapes
- Changing Bitrix sync behavior, cursors, or manager whitelist semantics
- Splitting `packages/contracts`
- Web UI changes

## Git Workflow

- Branch: `codex/split-sqlite-repository-roles`
- Start after plan 001 lands.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `refactor(api): split sqlite repository roles`

## Steps

### Step 1: Create repository role types

Create `apps/api/src/server/repository-roles.ts`.

Use `Pick<SqliteRepository, ...>` to define role interfaces without changing the
SQLite implementation yet. Keep the first version conservative and type-only:

```ts
import type { SqliteRepository } from "./sqlite-repository.js";

export type PlatformCommentRepository = Pick<
  SqliteRepository,
  | "getDashboardComments"
  | "getDashboardCommentById"
  | "createDashboardComment"
  | "updateDashboardComment"
  | "archiveDashboardComment"
  | "updateDashboardCommentPaperclip"
>;

export type ProtoCommentRepository = Pick<
  SqliteRepository,
  "getProtoComments" | "replaceProtoComments"
>;

export type SyncRunRepository = Pick<
  SqliteRepository,
  | "createSyncRun"
  | "recoverStaleSyncRuns"
  | "failSyncRun"
  | "finishSyncRun"
  | "listSyncRuns"
  | "getLastSyncSummary"
>;
```

Then add separate types for read/report and module settings roles. Use method
names that already exist on `SqliteRepository`; do not invent methods in this
step. Suggested names:

- `SnapshotReadRepository`
- `SnapshotWriteRepository`
- `AttractionSettingsRepository`
- `LeadgenSettingsRepository`
- `CallAnalysisRepository`

The role type can overlap initially. The goal is a narrow named interface at the
seam, not a perfect final package split.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 2: Export role aliases from the SQLite module

In `apps/api/src/server/sqlite-repository.ts`, keep `SqliteRepository` and
`createSqliteRepository` intact. If importing role types directly from
`repository-roles.ts` creates a circular import, do not import them here.

Allowed options:

1. Keep `repository-roles.ts` as the only role export location.
2. Or re-export type-only roles from `sqlite-repository.ts`:

```ts
export type {
  PlatformCommentRepository,
  ProtoCommentRepository,
  SyncRunRepository,
  SnapshotReadRepository,
  SnapshotWriteRepository,
  AttractionSettingsRepository,
  LeadgenSettingsRepository,
  CallAnalysisRepository
} from "./repository-roles.js";
```

Do not change SQL statements in this step.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 3: Narrow app configuration storage roles

In `apps/api/src/server/app.ts`, replace private storage interface definitions
that duplicate repository roles with imports from `repository-roles.ts`.

Current private interfaces:

```ts
// apps/api/src/server/app.ts:212-245
interface ProtoCommentsStore { ... }
interface DashboardCommentsStore { ... }
```

Target:

- `AppConfig.comments?: PlatformCommentRepository`
- `AppConfig.protoComments?: ProtoCommentRepository`

Do not move any route handlers in this plan. Only narrow the config interface.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 4: Type the entrypoint repositories by role

In `apps/api/src/index.ts`, keep the runtime values the same, but make role
intent explicit near repository creation.

Acceptable pattern:

```ts
import type {
  PlatformCommentRepository,
  ProtoCommentRepository,
  SyncRunRepository
} from "./server/repository-roles.js";

const platformComments: PlatformCommentRepository = platformRepository;
const protoComments: ProtoCommentRepository = platformRepository;
```

Then pass `platformComments` and `protoComments` into `createApp`. Keep
`repositories` as full SQLite repositories for lifecycle closing if needed.

Do not alter database URL selection.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 5: Narrow service constructor inputs where safe

Inspect `apps/api/src/server/service.ts` and `apps/api/src/server/leadgen-service.ts`.
Only narrow constructor repository types where TypeScript can prove all required
methods are present using your role interfaces.

Safe first targets:

- `CreateLeadgenServiceInput.repository` can reference a named role but may need
  to include the current report engine dependency because `leadgen-service.ts`
  still calls `createReportingService`.
- `CreateReportingServiceInput.repository` can remain `SqliteRepository` if
  narrowing it would cause a broad report-engine refactor. If it stays full,
  add a short TODO comment with the exact future role name and plan number:
  `// TODO(platform-foundation): narrow ReportingService repository after report engines split.`

Do not force a large report-engine rewrite into this plan.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 6: Add tests only for behavior that could change

This plan should be type-only or near type-only. If implementation changes are
limited to type imports and assignments, no new tests are required.

If you change runtime wiring in `index.ts` or `app.ts`, add or update focused
tests in:

- `apps/api/test/http.test.ts` for comments/proto-comments wiring
- `apps/api/test/sqlite.test.ts` for repository method availability

Use existing tests as patterns:

- `apps/api/test/http.test.ts:1916` creates `createApp(service, { modules: ... })`
  for module route behavior.
- `apps/api/test/sqlite.test.ts` repeatedly creates a real
  `createSqliteRepository(...)` adapter for storage behavior.

**Verify**:
Run all three:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts
pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts
pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts
```

Expected result: all pass.

## Test Plan

- Required: `pnpm --filter @bitrix24-reporting/api typecheck`
- Required: `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts`
- Required: `pnpm --filter @bitrix24-reporting/api exec vitest run test/service.test.ts`
- Required: `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts`
- Add tests only if runtime behavior changes.

## Done Criteria

- [ ] `apps/api/src/server/repository-roles.ts` exists.
- [ ] `AppConfig.comments` and `AppConfig.protoComments` depend on narrow role
      types, not private duplicated interfaces.
- [ ] `apps/api/src/index.ts` makes platform storage roles explicit without
      changing database URL behavior.
- [ ] `SqliteRepository` remains source-compatible for existing callers.
- [ ] No route handlers were moved.
- [ ] No SQL schema changed.
- [ ] API typecheck exits 0.
- [ ] Focused API tests listed above pass.
- [ ] `plans/README.md` row for plan 002 is updated.

## STOP Conditions

Stop and report back if:

- Narrowing `CreateReportingServiceInput.repository` requires rewriting report
  engines or changing report behavior.
- Any SQL migration becomes necessary.
- The plan appears to require moving routes out of `app.ts`; that belongs to
  plan 003.
- Type-only role exports create circular runtime imports. Use `import type` or
  keep roles in a separate file instead of improvising runtime wrappers.

## Maintenance Notes

- This is an interface split, not the final package split.
- Reviewers should check that role names describe ownership:
  platform comments, snapshot read/write, module settings, sync runs, and call
  analysis.
- Future plans should depend on these roles rather than importing the full
  `SqliteRepository` unless a full adapter is truly required.
