# Module-Scoped Sync Databases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Bitrix24 reporting sync storage by module so `attraction` and `leadgen` sync independently, and the dashboard refresh button updates only the active module.

**Architecture:** Keep platform state separate from reporting snapshots. Auth, module memberships, dashboard comments, and Paperclip status remain in a platform SQLite database; each business module gets its own reporting SQLite database and its own sync runner. `attraction` keeps the existing operational sync, while `leadgen` gets a first-class category 28 deal sync instead of being a side effect of attraction sync.

**Tech Stack:** Express, TypeScript, better-sqlite3, Vite/React, Vitest, existing Bitrix24 client and SQLite repository.

---

## Findings

- Current production compose sets one `DATABASE_URL=file:/app/data/bitrix24-reporting.db`; API reporting repository and auth store both use that same file in `apps/api/src/index.ts`.
- Current `POST /api/sync` in `apps/api/src/server/app.ts` is global and hard-coded to attraction access via `denyIfMissingAttractionAccess(...leaderOnly)`.
- Current web client `apiClient.triggerSync()` always posts to `/api/sync`, and `ProtoApp.handleRefreshData()` does not pass `activeModuleId`.
- Current `performManualSync()` always uses attraction manager IDs as the primary scope. Leadgen deals are fetched only as an optional side effect when `BITRIX24_LEADGEN_MANAGER_IDS` is non-empty.
- If `BITRIX24_LEADGEN_MANAGER_IDS` is missing or empty on the VPS, `shouldSyncLeadgen` becomes false and no leadgen deals are fetched even though the sync completes.
- `apps/api/src/tools/sync-leadgen-only.ts` already contains most of the desired leadgen-only sync logic, but it is a CLI script and writes to the same `DATABASE_URL`.
- Leadgen report rendering already has a module route: `GET /api/modules/leadgen/reports/funnel`, but it reads from the same repository that attraction uses.
- Auth/RBAC work is currently in progress on branch `codex/module-rbac-access`; implementation should avoid rewriting those changes and should integrate with the module access shape already being introduced.

## File Structure

- Modify `apps/api/src/config/env.ts`: add platform and per-module database URLs.
- Modify `apps/api/src/index.ts`: create platform repository/auth store plus one reporting repository/service per module.
- Modify `apps/api/src/server/app.ts`: route sync and module reports through a module service registry.
- Modify `apps/api/src/server/service.ts`: stop leadgen from being a side effect of attraction sync; expose attraction-only sync and metadata.
- Create `apps/api/src/server/leadgen-service.ts`: leadgen funnel report, leadgen metadata, and leadgen sync wrapper.
- Create `apps/api/src/domain/leadgen-sync.ts`: reusable leadgen sync domain function derived from `src/tools/sync-leadgen-only.ts`.
- Modify `apps/api/src/tools/sync-leadgen-only.ts`: call the reusable leadgen sync function.
- Modify `apps/api/src/server/sqlite-repository.ts` only if module-specific metadata needs repository helpers not already present.
- Modify `apps/web/src/lib/api-client.ts`: make sync module-aware.
- Modify `apps/web/src/proto/proto-app.tsx`: call sync for `activeModuleId` and refresh only the active module view.
- Modify `.env.example`, `Dockerfile`, `docker-compose.yml`, and `docs/deploy-timeweb-vps.md`: document new DB paths and VPS env requirements.
- Add or update focused tests in `apps/api/test/env.test.ts`, `apps/api/test/http.test.ts`, `apps/api/test/sync.test.ts`, `apps/api/test/service.test.ts`, `apps/web/src/lib/api-client.test.ts`, and `apps/web/src/proto/proto-app.test.tsx`.

---

### Task 1: Make Database Configuration Explicit

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docs/deploy-timeweb-vps.md`

- [ ] Add env parsing tests before implementation:
  - `PLATFORM_DATABASE_URL` defaults to `DATABASE_URL`.
  - `ATTRACTION_DATABASE_URL` defaults to `file:./data/bitrix24-attraction.db`.
  - `LEADGEN_DATABASE_URL` defaults to `file:./data/bitrix24-leadgen.db` locally or can be overridden by production compose.
  - `BITRIX24_LEADGEN_MANAGER_IDS` remains required for useful leadgen sync; empty whitelist should not fall back to attraction managers.

- [ ] Extend `AppEnv` with:
  - `platformDatabaseUrl`
  - `attractionDatabaseUrl`
  - `leadgenDatabaseUrl`

- [ ] Keep backward compatibility:
  - Existing production platform/auth/comment data stays at `/app/data/bitrix24-reporting.db`.
  - New attraction sync data goes to `/app/data/bitrix24-attraction.db`.
  - New leadgen data goes to `/app/data/bitrix24-leadgen.db`.
  - Platform/auth/comments initially keep using the existing reporting DB unless `PLATFORM_DATABASE_URL` is set explicitly.

- [ ] Update production docs with non-secret verification commands:

```bash
docker compose exec app node -e "console.log({
  platform: process.env.PLATFORM_DATABASE_URL ?? process.env.DATABASE_URL,
  attraction: process.env.ATTRACTION_DATABASE_URL ?? "file:./data/bitrix24-attraction.db",
  leadgen: process.env.LEADGEN_DATABASE_URL,
  leadgenManagers: (process.env.BITRIX24_LEADGEN_MANAGER_IDS ?? '').split(',').filter(Boolean).length
})"
```

### Task 2: Introduce Module Reporting Runtime

**Files:**
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/server/app.ts`

- [ ] Define an API-side module runtime registry:

```ts
type ReportingModuleId = "attraction" | "leadgen";

interface ModuleReportingRuntime {
  id: ReportingModuleId;
  service: {
    performSync(input?: { onProgress?: (event: SyncProgressEvent) => void }): Promise<ManualSyncSummary>;
    getMeta?(): Promise<unknown>;
    getLeadgenFunnelReport?(input: ParsedRangeRequest): Promise<LeadgenFunnelReport>;
  };
}
```

- [ ] In `apps/api/src/index.ts`, instantiate:
  - `platformRepository` from `env.platformDatabaseUrl` for comments/proto comments.
  - `authStore` from `env.platformDatabaseUrl`.
  - `attractionRepository` from `env.attractionDatabaseUrl`.
  - `leadgenRepository` from `env.leadgenDatabaseUrl`.

- [ ] Pass both the legacy attraction `service` and a `modules` map into `createApp`.

- [ ] Keep existing `/api/dashboard`, `/api/meta`, attraction reports, sales plan, pricing, and won-stage routes backed by the attraction service.

### Task 3: Extract Leadgen Sync Into a Reusable Domain Function

**Files:**
- Create: `apps/api/src/domain/leadgen-sync.ts`
- Modify: `apps/api/src/tools/sync-leadgen-only.ts`
- Test: `apps/api/test/sync.test.ts`

- [ ] Move the reusable parts of `sync-leadgen-only.ts` into `performLeadgenSync(input)`.

- [ ] The function must:
  - fetch deal stages for category `28`;
  - fetch source catalog;
  - fetch category `28` deals assigned only to `BITRIX24_LEADGEN_MANAGER_IDS`;
  - map only safe fields into `DealSnapshot`;
  - persist via the passed leadgen repository;
  - update manager directory for leadgen managers;
  - create and finish a sync run with a leadgen scope key, for example `module:leadgen:category:28:assigned:<ids>`;
  - emit progress events compatible with the existing SSE client.

- [ ] Add a test that proves leadgen sync writes category `28` rows into the leadgen repository and does not call attraction category `10`.

- [ ] Add a test that proves empty `leadgenManagerIds` produces a safe empty sync summary with a diagnostic or a controlled validation error, not an attraction fallback.

### Task 4: Remove Leadgen Side Effects From Attraction Sync

**Files:**
- Modify: `apps/api/src/domain/sync.ts`
- Modify: `apps/api/src/server/service.ts`
- Test: `apps/api/test/sync.test.ts`

- [ ] Update attraction `performManualSync()` so it only syncs `input.categoryIds` and attraction manager scope.

- [ ] Remove or disable the optional leadgen `listDeals({ categoryIds: [leadgenCategoryId] })` block from attraction sync.

- [ ] Preserve linked leadgen loss enrichment only if it can read from an explicit leadgen repository; otherwise document it as temporarily unavailable for attraction until a cross-module reporting task is approved.

- [ ] Update tests that currently expect leadgen side effects in attraction sync.

### Task 5: Add Module-Scoped Sync Endpoints

**Files:**
- Modify: `apps/api/src/server/app.ts`
- Test: `apps/api/test/http.test.ts`

- [ ] Add `POST /api/modules/:moduleId/sync`.

- [ ] Keep `POST /api/sync` as a backward-compatible alias for attraction only.

- [ ] Replace global `activeSync` with per-module tracking:

```ts
const activeSyncByModule = new Map<string, Promise<ManualSyncSummary>>();
```

- [ ] Authorization:
  - attraction legacy route keeps current behavior;
  - module route requires access to `moduleId`;
  - leader-only behavior should match the current sync policy until the RBAC branch decides whether to add a dedicated `sync:run` permission.

- [ ] Add API tests:
  - leadgen leader can run `/api/modules/leadgen/sync`;
  - attraction leader cannot sync leadgen without leadgen membership;
  - concurrent sync in the same module returns `409`;
  - attraction and leadgen syncs do not block each other unless Bitrix rate-limit policy later requires a shared queue.

### Task 6: Make Leadgen Reports Read The Leadgen Database

**Files:**
- Create: `apps/api/src/server/leadgen-service.ts`
- Modify: `apps/api/src/server/app.ts`
- Test: `apps/api/test/service.test.ts`
- Test: `apps/api/test/http.test.ts`

- [ ] Move leadgen funnel reporting out of the attraction service path and bind it to the leadgen repository.

- [ ] Preserve leadgen report contract:
  - category `28` only;
  - leadgen manager whitelist only;
  - no contact IDs, names, phones, emails, deal names, or raw Bitrix payloads in output.

- [ ] Add a test with separate in-memory/temp repositories proving:
  - attraction DB contains category `10`;
  - leadgen DB contains category `28`;
  - `GET /api/modules/leadgen/reports/funnel` only reads the leadgen DB.

### Task 7: Update Web Refresh Flow

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Test: `apps/web/src/lib/api-client.test.ts`
- Test: `apps/web/src/proto/proto-app.test.tsx`

- [ ] Change `triggerSync` signature:

```ts
async triggerSync(
  moduleId = "attraction",
  onProgress?: (event: SyncProgressEvent) => void,
): Promise<SyncSummary>
```

- [ ] Make attraction call `/api/sync` or `/api/modules/attraction/sync`; make leadgen call `/api/modules/leadgen/sync`.

- [ ] In `handleRefreshData()`, pass `activeModuleId`.

- [ ] After sync:
  - if active module is attraction, refresh attraction meta/dashboard as today;
  - if active module is leadgen, reload only `getLeadgenFunnelReport(activeModuleId, query)` and leadgen sync/meta display;
  - do not call attraction dashboard/report endpoints from a leadgen refresh.

- [ ] Update UI text so the current run and last import reflect the active module, not the global snapshot.

### Task 8: Production Migration And Verification

**Files:**
- Modify: `docs/deploy-timeweb-vps.md`

- [ ] Before deploy, backup current production DB:

```bash
cp /opt/bitrix24-reporting/data/bitrix24-reporting.db \
  /opt/bitrix24-reporting/data/bitrix24-reporting.db.backup-$(date +%Y%m%d-%H%M%S)
```

- [ ] Add production env:

```bash
PLATFORM_DATABASE_URL=file:/app/data/bitrix24-reporting.db
ATTRACTION_DATABASE_URL=file:/app/data/bitrix24-attraction.db
LEADGEN_DATABASE_URL=file:/app/data/bitrix24-leadgen.db
BITRIX24_LEADGEN_US_CATEGORY_ID=28
BITRIX24_LEADGEN_MANAGER_IDS=8244,84,11620,11486,12028,11610
```

- [ ] After deploy, verify non-secret runtime state:

```bash
docker compose exec app ls -lh /app/data
curl -fsS https://dashboardpriv.claricont.com/api/health
```

- [ ] Run authenticated smoke checks:
  - attraction refresh updates only attraction DB `sync_runs`;
  - leadgen refresh creates or updates `/app/data/bitrix24-leadgen.db`;
  - leadgen report has category `28` data;
  - attraction report still works and does not include category `28`.

### Task 9: Focused Verification Commands

**Files:**
- No production code files.

- [ ] Run focused API tests:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/env.test.ts apps/api/test/sync.test.ts apps/api/test/http.test.ts apps/api/test/service.test.ts
```

- [ ] Run focused web tests:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/proto-app.test.tsx
```

- [ ] Run typechecks:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/web typecheck
```

- [ ] Before handoff, review:

```bash
git diff
git status --short
git branch --show-current
```

## Recommended Execution Order

1. Land or stabilize the current `codex/module-rbac-access` work first, because sync authorization should use the same module membership model.
2. Implement Tasks 1-2 to create the runtime boundaries without changing behavior.
3. Implement Tasks 3-6 to make leadgen sync/reporting independent.
4. Implement Task 7 to connect the UI refresh button to the active module.
5. Implement Task 8 only after local tests pass and production env is ready.

## Risk Notes

- Do not store important production work only in stash before this change; the current branch already has auth/RBAC WIP.
- Do not copy a local SQLite file over production. Create the new leadgen DB by running leadgen sync on the VPS.
- Cross-module attraction enrichment from leadgen loss reasons needs an explicit design decision once databases are split. The safe default is no cross-module reads unless a shared/platform issue approves it.
- If Bitrix rate limits become a problem, add a shared queue after module-scoped sync works; do not keep a global sync endpoint just for rate limiting.
