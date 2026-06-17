# Plan 008: Extract route handler factories from `createApp`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat c760416..HEAD -- apps/api/src/server/app.ts apps/api/src/server/routes apps/api/test/http.test.ts apps/api/test/comments-paperclip.test.ts apps/api/test/security.test.ts docs/adr/0001-separate-attraction-and-leadgen-products.md plans/008-extract-create-app-handler-factories.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/003-extract-platform-and-module-route-registrars.md`
- **Category**: tech-debt
- **Planned at**: commit `c760416`, 2026-06-15

## Why This Matters

Plan 003 extracted route registrars, but `createApp` still owns most route
handler bodies. The result is a high-blast-radius function: auth, module admin,
comments, Paperclip, leadgen, sync, settings, reports, and call analysis all
change the same file and closure. This plan moves handler construction into
route-specific factories while keeping path registration, response shapes, and
authorization semantics unchanged.

## Current State

- `apps/api/src/server/routes/*.ts` registers paths and handler interfaces.
- `apps/api/src/server/app.ts` imports those registrars but passes large inline
  handler objects.
- CRG marks `createApp` as the top hub: total degree 761.
- `createApp` starts at `app.ts:1461` and contains route-local helpers,
  request schemas, auth checks, Paperclip delivery helpers, and route handler
  objects.

Relevant excerpts:

```ts
// apps/api/src/server/app.ts:72-84
import {
  registerAttractionCallRoutes,
  registerAttractionReportRoutes,
  registerAttractionSettingsRoutes
} from "./routes/attraction-routes.js";
import { registerCommentRoutes } from "./routes/comment-routes.js";
import { registerLeadgenRoutes } from "./routes/leadgen-routes.js";
import { registerModuleAdminRoutes } from "./routes/module-admin-routes.js";
import {
  registerPlatformPublicRoutes,
  registerPlatformRoutes
} from "./routes/platform-routes.js";
import { registerSyncRoutes } from "./routes/sync-routes.js";
```

```ts
// apps/api/src/server/app.ts:1461-1493
export function createApp(
  service: AppService,
  config: AppConfig = {}
): express.Express {
  const app = express();
  const activeSyncByModule = new Map<string, Promise<ManualSyncSummary>>();
  // ...

  async function sendTimedJson<T>(input: {
    request: express.Request;
    response: express.Response;
    next: express.NextFunction;
    moduleId: string;
    route: string;
    handler: () => Promise<T>;
  }) {
```

```ts
// apps/api/src/server/app.ts:2310-2403
registerAttractionCallRoutes(app, {
  listCallAnalysisQueue: async (request, response, next) => {
    const moduleId = requestModuleId(request);
    if (moduleId !== "attraction") {
      next("route");
      return;
    }

    if (denyIfMissingAttractionAccess(response)) {
      return;
    }

    try {
      response.json(
        await service.getCallAnalysisQueue(
          parseCallAnalysisQueueRequest(request.query)
        )
      );
    } catch (error) {
      next(error);
    }
  },
  // analyzeCall and getCallAnalysis follow in the same inline object.
});
```

```ts
// apps/api/src/server/app.ts:2563-2670
registerCommentRoutes(app, {
  getProtoComments: async (_request, response, next) => { ... },
  replaceProtoComments: async (request, response, next) => { ... },
  listComments: async (request, response, next) => { ... },
  createComment: async (request, response, next) => { ... },
  // update/archive/rework/retry/notifications continue below.
});
```

```ts
// apps/api/src/server/routes/attraction-routes.ts:62-68
export function registerAttractionCallRoutes(
  app: express.Express,
  handlers: AttractionCallRouteHandlers
) {
  app.get(callAnalysisQueuePaths, handlers.listCallAnalysisQueue);
  app.post(analyzeCallPaths, handlers.analyzeCall);
  app.get(callAnalysisPaths, handlers.getCallAnalysis);
}
```

Documented constraints to preserve:

```md
// docs/adr/0001-separate-attraction-and-leadgen-products.md:32-40
- Shared/platform changes must list which modules and roles they affect.
- Module-owned work must not change the other product unless explicitly marked
  shared/platform.
- Repository extraction should happen after storage, route, sync, and web
  runtime seams are visible.
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0, no TypeScript errors |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |
| Comments tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/comments-paperclip.test.ts` | all tests pass |
| Security tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/security.test.ts` | all tests pass |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/server/app.ts`
- New or updated route handler factory files under
  `apps/api/src/server/routes/`
- Optional shared support module under `apps/api/src/server/routes/` if needed
  for route helpers/schemas
- Focused tests only when extraction exposes a missing route regression:
  - `apps/api/test/http.test.ts`
  - `apps/api/test/comments-paperclip.test.ts`
  - `apps/api/test/security.test.ts`
- `plans/README.md` status row

**Out of scope**:

- Changing any HTTP path, method, status code, or response envelope
- Changing auth/RBAC/CSRF semantics
- Changing Paperclip payload text, redaction, or comment lifecycle
- Changing report logic or service interfaces beyond what is necessary to pass
  dependencies into handler factories
- Splitting `createApp` into multiple Express apps
- Web UI changes
- SQL or repository changes

## Git Workflow

- Branch: `codex/extract-create-app-handler-factories`
- Start from updated `main`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `refactor(api): extract route handler factories`

## Steps

### Step 1: Add a narrow route context type

Create a support file such as
`apps/api/src/server/routes/route-context.ts`.

Do not dump the entire `AppConfig` and every private helper into one giant
object. Instead, define small context shapes that factories can compose:

- `RouteErrorHelpers`: `createErrorResponse`, `requestModuleId`,
  `requestRouteParam`.
- `RouteAccessHelpers`: `requireModuleAccess`, `denyIfMissingAttractionAccess`,
  `requireSuperAdmin` if needed.
- `TimedJsonSender`: the `sendTimedJson` function type.
- `SyncRequestRunner`: the `runSyncRequest` function type.

Only add types in this step. Do not move handler bodies yet.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 2: Extract attraction call handlers first

Create `apps/api/src/server/routes/attraction-call-handlers.ts`.

Move the handler bodies currently passed to `registerAttractionCallRoutes` into:

```ts
export function createAttractionCallRouteHandlers(input: {
  service: AppService;
  callAnalysis?: AppConfig["callAnalysis"];
  requestModuleId: typeof requestModuleId;
  requestRouteParam: typeof requestRouteParam;
  createErrorResponse: typeof createErrorResponse;
  denyIfMissingAttractionAccess: typeof denyIfMissingAttractionAccess;
}): AttractionCallRouteHandlers {
  return { listCallAnalysisQueue, analyzeCall, getCallAnalysis };
}
```

Move the call-analysis-specific schemas with the factory if they are only used
there:

- `callAnalysisCallIdSchema`
- `callAnalysisQueueQuerySchema`
- `parseCallAnalysisQueueRequest`

After extraction, `createApp` should call:

```ts
registerAttractionCallRoutes(
  app,
  createAttractionCallRouteHandlers({
    service,
    callAnalysis: config.callAnalysis,
    // helpers
  })
);
```

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.

### Step 3: Extract leadgen and attraction report handlers

Create:

- `apps/api/src/server/routes/leadgen-handlers.ts`
- `apps/api/src/server/routes/attraction-report-handlers.ts`

Move the bodies currently passed to `registerLeadgenRoutes` and
`registerAttractionReportRoutes`. Keep `sendTimedJson` behavior exactly the
same for report timing logs. Keep `parseRangeRequest` and
`parseRevenueVelocityRequest` close to the report handlers unless another route
group needs them.

Do not change module selection behavior:

- leadgen module handlers must keep `requestModuleId(request)` and
  `moduleServices.get(moduleId)` semantics;
- attraction root report routes must keep attraction access semantics;
- module ontology/meta routes must keep current 404/403 behavior.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.

### Step 4: Extract settings and sync handlers

Create:

- `apps/api/src/server/routes/attraction-settings-handlers.ts`
- `apps/api/src/server/routes/sync-handlers.ts`

Move bodies currently passed to `registerAttractionSettingsRoutes` and
`registerSyncRoutes`.

Keep leader-only checks intact:

- replacing sales plans;
- replacing pricing settings;
- replacing unit economics rules;
- replacing conversion event settings;
- replacing manager whitelist settings;
- updating won stages;
- triggering sync.

Keep the special manager whitelist side effect:

```ts
await config.authStore.clearModuleDefaultManagersExcept({
  moduleId: "attraction",
  managerIds: payload.managerIds
});
```

Do not change sync streaming, keepalive, active-sync conflict handling, or sync
error response details.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` passes.

### Step 5: Extract comments handlers last

Create `apps/api/src/server/routes/comment-handlers.ts`.

Comments are the riskiest group because they touch dashboard comments,
Paperclip, notifications, rework, retry, status refresh, redaction, and module
access. Move these only after the earlier groups pass.

You may keep Paperclip helper functions in a separate
`apps/api/src/server/routes/comment-paperclip-support.ts` if that prevents one
large handler file. If you do, move code mechanically and preserve all existing
redaction and formatting behavior.

Required preserved behaviors:

- `/api/proto-comments` still returns 404 when `config.protoComments` is absent;
- module comments require module access;
- create/update/archive/rework/retry permission checks remain unchanged;
- Paperclip failures keep current status codes and payload shapes;
- production dashboard comments remain server-side SQLite comments, not
  `.codex/proto-comments/comments.json`.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/comments-paperclip.test.ts test/http.test.ts` passes.

### Step 6: Extract platform and module-admin handlers if still inline

Create:

- `apps/api/src/server/routes/platform-handlers.ts`
- `apps/api/src/server/routes/module-admin-handlers.ts`

Move bodies currently passed to `registerPlatformPublicRoutes`,
`registerPlatformRoutes`, and `registerModuleAdminRoutes`.

Keep auth cookie and CSRF behavior in `createApp` middleware unless moving it is
purely mechanical and still covered by tests. The main goal is to remove route
handler objects from `createApp`, not to redesign authentication.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts test/security.test.ts` passes.

### Step 7: Remove inline handler objects from `createApp`

After all factories exist, `createApp` should mostly:

- configure middleware;
- create shared runtime objects such as `moduleServices` and
  `moduleCapabilityRegistry`;
- define or import shared helpers;
- call `register*Routes(app, create*Handlers(...))`;
- configure error/static handling.

Run these static checks:

```bash
rg -n "register(AttractionCall|AttractionReport|AttractionSettings|Comment|Leadgen|ModuleAdmin|Platform|PlatformPublic|Sync)Routes\\(app, \\{" apps/api/src/server/app.ts
rg -n "listCallAnalysisQueue: async|getProtoComments: async|syncAttraction: async|getPricingSettings: async" apps/api/src/server/app.ts
```

Both commands should return no matches. If a small inline handler remains for a
good reason, document it in the PR and in the plan status update.

**Verify**:

- `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- `pnpm --filter @bitrix24-reporting/api lint` exits 0.
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts test/comments-paperclip.test.ts test/security.test.ts` passes.

## Test Plan

- Use existing HTTP tests as the primary regression suite:
  `apps/api/test/http.test.ts`.
- Use `apps/api/test/comments-paperclip.test.ts` for comment/Paperclip routes.
- Use `apps/api/test/security.test.ts` for CORS/security/auth invariants.
- Do not add tests just to test factory construction. Add tests only if an
  extracted route exposes a missing route-level behavior.

## Done Criteria

All must hold:

- [ ] `createApp` no longer passes large inline handler objects to the route
  registrars.
- [ ] Route paths, HTTP methods, status codes, and response envelopes are
  unchanged.
- [ ] Auth, module access, leader-only checks, CSRF, and Paperclip redaction
  behavior are unchanged.
- [ ] `pnpm --filter @bitrix24-reporting/api typecheck` exits 0.
- [ ] `pnpm --filter @bitrix24-reporting/api lint` exits 0.
- [ ] `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts test/comments-paperclip.test.ts test/security.test.ts` passes.
- [ ] `plans/README.md` status row is updated.

## STOP Conditions

Stop and report back if:

- The cited `app.ts` structure has drifted substantially.
- Extracting handlers requires changing route paths or public response shapes.
- Auth/session/CSRF helpers need semantic changes instead of mechanical moves.
- Comment/Paperclip extraction starts changing text, redaction, retry status, or
  issue payloads.
- The diff grows to include report logic, sync domain logic, SQLite, or web UI.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance Notes

- This plan reduces blast radius but does not make `createApp` tiny by itself.
  Middleware, static serving, and shared runtime setup may remain there.
- Reviewers should compare moved handler bodies carefully; most hunks should be
  mechanical relocation plus dependency injection.
- After this lands, future route work should add handler factories first and
  keep `app.ts` as composition glue.
