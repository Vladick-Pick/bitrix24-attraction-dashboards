# Plan 003: Extract platform and module route registrars

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 5a2884f..HEAD -- apps/api/src/server/app.ts apps/api/src/server/repository-roles.ts apps/api/src/index.ts apps/api/test/http.test.ts apps/api/test/auth.test.ts apps/api/test/comments-paperclip.test.ts apps/api/test/static-serving.test.ts plans/003-extract-platform-and-module-route-registrars.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**:
  - `plans/001-record-product-split-decision.md`
  - `plans/002-split-sqlite-repository-roles.md`
- **Category**: tech-debt
- **Planned at**: commit `5a2884f`, 2026-06-14

## Why This Matters

`createApp` is the HTTP interface for platform, attraction, and leadgen. It now
registers auth, comments, platform admin, module users, attraction reports,
leadgen reports, settings, sync, static serving, and error handling in one
implementation. Before repository extraction, route ownership must be visible:
platform routes should be shared, while attraction and leadgen routes should be
module-owned adapters.

## Current State

- `apps/api/src/server/app.ts` is 3907 lines at commit `5a2884f`.
- `createApp` builds an Express app and a `moduleServices` map.
- `ModuleService` mixes leadgen reports, attraction ontology, meta, and sync.
- Platform routes and module routes are registered in one function.
- Existing tests in `apps/api/test/http.test.ts`, `auth.test.ts`,
  `comments-paperclip.test.ts`, and `static-serving.test.ts` exercise this
  behavior through `createApp`.

Relevant excerpts:

```ts
// apps/api/src/server/app.ts:196-210
interface ModuleService {
  getLeadgenFunnelReport?(input: RangeRequest): Promise<LeadgenFunnelReport>;
  getActivitiesWorkloadReport?(input: RangeRequest): Promise<ActivitiesWorkloadReport>;
  getCallsWorkloadReport?(input: RangeRequest): Promise<CallsWorkloadReport>;
  getAttractionOntology?(): Promise<AttractionOntologyResponse>;
  getAttractionOntologySourceDocument?(
    sourceId: string
  ): Promise<OntologySourceDocumentResponse>;
  getMeta?(): Promise<MetaResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
}
```

```ts
// apps/api/src/server/app.ts:1470-1482
export function createApp(
  service: AppService,
  config: AppConfig = {}
): express.Express {
  const app = express();
  const activeSyncByModule = new Map<string, Promise<ManualSyncSummary>>();
  const webOrigin = config.webOrigin?.trim() || "http://localhost:5173";
  const apiAuthToken = config.apiAuthToken?.trim() || undefined;
  const auth = config.auth;
  const moduleServices = new Map<string, ModuleService>([
    ["attraction", service],
    ...Object.entries(config.modules ?? {})
  ]);
```

```ts
// apps/api/src/server/app.ts:1968
app.post("/api/auth/login", async (request, response, next) => {
```

```ts
// apps/api/src/server/app.ts:2455
app.get("/api/proto-comments", async (_request, response, next) => {
```

```ts
// apps/api/src/server/app.ts:2825
app.get("/api/admin/platform/access", async (_request, response, next) => {
```

```ts
// apps/api/src/server/app.ts:3087-3134
app.get("/api/dashboard", async (request, response, next) => { ... });
app.get("/api/modules/:moduleId/reports/funnel", async (request, response, next) => { ... });
```

```ts
// apps/api/src/server/app.ts:3736-3809
app.get("/api/settings/manager-whitelist", async (_request, response, next) => { ... });
app.put("/api/settings/manager-whitelist", async (request, response, next) => { ... });
app.post("/api/sync", async (request, response, next) => { ... });
app.post("/api/modules/:moduleId/sync", async (request, response, next) => { ... });
```

Existing test pattern:

```ts
// apps/api/test/http.test.ts:1916-1939
const app = createApp(service, {
  modules: {
    leadgen: {
      getLeadgenFunnelReport: async (input: unknown) => { ... },
      getActivitiesWorkloadReport: async (input: unknown) => { ... },
      getCallsWorkloadReport: async (input: unknown) => { ... },
      getMeta: async () => ({ ... })
    }
  }
});
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0, no TypeScript errors |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts` | all tests pass |
| Auth tests | `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/auth.test.ts` | all tests pass |
| Comments tests | `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/comments-paperclip.test.ts` | all tests pass |
| Static serving tests | `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/static-serving.test.ts` | all tests pass |

## Scope

**In scope**:

- `apps/api/src/server/app.ts`
- New route registrar files under `apps/api/src/server/routes/`, for example:
  - `platform-routes.ts`
  - `comment-routes.ts`
  - `module-admin-routes.ts`
  - `attraction-routes.ts`
  - `leadgen-routes.ts`
  - `sync-routes.ts`
- `apps/api/src/server/repository-roles.ts` only if a type from plan 002 needs
  to be imported into route context
- Focused tests:
  - `apps/api/test/http.test.ts`
  - `apps/api/test/auth.test.ts`
  - `apps/api/test/comments-paperclip.test.ts`
  - `apps/api/test/static-serving.test.ts`
- `plans/README.md` status row

**Out of scope**:

- Changing endpoint paths or response shapes
- Removing legacy attraction routes such as `/api/dashboard` or `/api/sync`
- Changing auth cookie, CSRF, CORS, or security header behavior
- Changing sync implementation internals
- Changing storage interfaces beyond importing plan 002 role types
- Web client changes
- Physical repository split

## Git Workflow

- Branch: `codex/extract-platform-module-route-registrars`
- Start after plans 001 and 002 land.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `refactor(api): extract platform and module route registrars`

## Steps

### Step 1: Introduce a route context without moving handlers

In `apps/api/src/server/app.ts`, define a local route context shape near
`createApp`. It should collect the helpers and dependencies route groups need.

Suggested shape:

```ts
interface AppRouteContext {
  service: AppService;
  config: AppConfig;
  auth: PasswordAuthService | undefined;
  moduleServices: Map<string, ModuleService>;
  sendTimedJson: typeof sendTimedJson;
  requireModuleAccess: typeof requireModuleAccess;
  requireSuperAdmin: typeof requireSuperAdmin;
  denyIfMissingAttractionAccess: typeof denyIfMissingAttractionAccess;
  denyIfMissingModuleSyncAccess: typeof denyIfMissingModuleSyncAccess;
  runSyncRequest: typeof runSyncRequest;
}
```

Do not copy this shape mechanically. Some helpers are nested inside
`createApp`; if a registrar type must be exported to a separate file, define
explicit structural callback signatures in that registrar instead of exporting
large helper types from `app.ts`. Keep the context local if exporting the full
helper set would create a large public interface too early.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 2: Extract platform auth and admin routes

Create `apps/api/src/server/routes/platform-routes.ts`.

Move only these groups first:

- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/change-password`
- `/api/auth/logout`
- `/api/admin/platform/access`
- `/api/admin/platform/users/:id/module-memberships`

The registrar interface should be small:

```ts
export function registerPlatformRoutes(app: express.Express, context: PlatformRouteContext) {
  // route registrations copied from app.ts
}
```

Keep helper functions in `app.ts` if moving them would expand the diff too much.
The registrar can receive helper callbacks in `context`.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/auth.test.ts
```

Expected result: both exit 0.

### Step 3: Extract comment routes

Create `apps/api/src/server/routes/comment-routes.ts`.

Move:

- `/api/proto-comments`
- `/api/comments`
- `/api/modules/:moduleId/comments`
- comment archive/rework/retry routes
- `/api/comment-notifications`
- `/api/modules/:moduleId/comment-notifications`

Keep Paperclip payload formatting behavior unchanged. Module context and PII
rules are load-bearing.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/comments-paperclip.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts
```

Expected result: all exit 0.

### Step 4: Extract leadgen route registrar

Create `apps/api/src/server/routes/leadgen-routes.ts`.

Move only leadgen-owned report routes:

- `/api/modules/:moduleId/reports/funnel`
- `/api/modules/:moduleId/reports/activities-workload`
- `/api/modules/:moduleId/reports/calls-workload`

Preserve current behavior:

- Non-`leadgen` module IDs return `404`.
- Missing module access returns `403` when auth is enabled.
- Missing service methods return `404`.
- Timed logs use routes `leadgen.funnel`, `leadgen.activities-workload`, and
  `leadgen.calls-workload`.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts
```

Expected result: all pass.

### Step 5: Extract attraction route registrar

Create `apps/api/src/server/routes/attraction-routes.ts`.

Move attraction-owned routes:

- `/api/dashboard`
- `/api/reports/*` attraction reports
- `/api/meta`
- `/api/sync-runs`
- `/api/ontology`
- `/api/modules/:moduleId/ontology`
- `/api/sales-plan*`
- `/api/settings/pricing`
- `/api/settings/unit-economics*`
- `/api/settings/conversion-event-types`
- `/api/settings/manager-whitelist`
- `/api/settings/won-stages`

Do not remove legacy paths. The web client still calls legacy attraction paths
such as `/api/dashboard`, `/api/settings/manager-whitelist`, and `/api/sync`.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts
```

Expected result: all pass.

### Step 6: Extract sync route registrar

Create `apps/api/src/server/routes/sync-routes.ts` if sync routes were not kept
inside attraction/leadgen registrars.

Move:

- `/api/sync`
- `/api/modules/:moduleId/sync`

Preserve:

- `/api/sync` remains attraction legacy path.
- `/api/modules/:moduleId/sync` uses `moduleServices`.
- concurrent sync rejection still uses the same per-module `activeSyncByModule`
  map.
- SSE behavior still emits keepalive, progress, complete, and error events.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts
```

Expected result: sync tests in `http.test.ts` pass, including concurrent sync
and SSE tests.

### Step 7: Keep createApp as the composition root

After moving route groups, `createApp` should still:

- create `app`
- set security/CORS/body middleware
- create shared state such as `activeSyncByModule`
- call route registrars
- configure static serving and error handlers
- return `app`

Do not turn route files into new application entrypoints.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/auth.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/comments-paperclip.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/static-serving.test.ts
```

Expected result: all pass.

## Test Plan

Required focused verification:

- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/http.test.ts`
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/auth.test.ts`
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/comments-paperclip.test.ts`
- `pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/static-serving.test.ts`

New tests are not required if behavior is unchanged and existing tests still
cover moved route groups. Add tests only if a route group lacked coverage after
the move.

## Done Criteria

- [ ] `createApp` remains the only exported Express app composition function.
- [ ] Route groups are registered through named registrar modules.
- [ ] Leadgen routes are in a leadgen-owned registrar and still reject non-leadgen
      module IDs.
- [ ] Attraction legacy routes remain available.
- [ ] Platform auth/admin routes are in a platform registrar.
- [ ] Comment/Paperclip routes preserve module context.
- [ ] No response shape changed.
- [ ] API typecheck exits 0.
- [ ] Focused route/auth/comment/static tests pass.
- [ ] `plans/README.md` row for plan 003 is updated.

## STOP Conditions

Stop and report back if:

- Extracting a route group requires changing endpoint paths or response JSON.
- Helper functions must be exported so broadly that the route context becomes as
  wide as the original `createApp` implementation. In that case, stop and
  propose a smaller extraction order.
- Tests show route behavior changed and the fix would require changing web
  client code.
- Sync SSE behavior becomes hard to preserve with the proposed registrar shape.
- A change appears to require modifying storage or report engines beyond imports
  and type names.

## Maintenance Notes

- This plan creates route ownership, not final package ownership.
- Reviewers should scrutinize route paths, auth checks, CSRF checks, module ID
  checks, Paperclip payload context, and legacy attraction paths.
- After this plan, future work can disable or extract a module at the route
  registrar level instead of editing one giant `createApp` function.
