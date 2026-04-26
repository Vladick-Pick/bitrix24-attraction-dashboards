# Reporting Review Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the data-loss, calculation, security, frontend, and coverage issues found in the full-project reporting review.

**Architecture:** Split the work into independent streams with disjoint write scopes so multiple agents can work asynchronously. The only intentionally serial dependency is that API contract changes must be integrated before final web contract assertions, and the full test/audit gate runs after all streams are merged.

**Tech Stack:** TypeScript, Node.js, Express 5, cors, Zod, better-sqlite3, Vitest, React 19, Vite, pnpm workspaces.

**Context7 Notes:** better-sqlite3 `.transaction()` commits on success and rolls back on thrown errors; transaction callbacks must stay synchronous and not use `async/await`. Express error middleware must use the four-argument signature and be registered after routes. `cors` supports fixed or dynamic origin validation. Zod `superRefine` should add field-specific issues after parsing, but date ordering must compare timestamps, not strings. React data fetching effects need cleanup/ignore guards to avoid stale updates.

---

## Parallelization Map

Run each stream in its own task branch or worktree if possible.

- **Stream A, Backend Sync Integrity:** `apps/api/src/domain/sync.ts`, `apps/api/src/server/sqlite-repository.ts`, sync/sqlite tests.
- **Stream B, Report Calculation Correctness:** `apps/api/src/domain/operational-reports.ts`, `apps/api/src/domain/reporting.ts`, report tests.
- **Stream C, API Security and Contracts:** `apps/api/src/server/app.ts`, `apps/api/src/config/env.ts`, API HTTP/env/security tests.
- **Stream D, Frontend Runtime Behavior:** `apps/web/src/App.tsx`, `apps/web/src/features/dashboard/*`, web tests.
- **Stream E, Prototype/Comments and Dependency Hygiene:** `apps/web/vite.config.ts`, `apps/proto/vite.config.ts`, `apps/web/package.json`, targeted tests/audit.
- **Stream F, Documentation and Coverage Backfill:** `README.md`, `SECURITY.md`, test-only additions not owned by other streams.

Do not run agents that edit the same file concurrently. Streams A, B, C, D, E can start together. Stream F should wait until A/C/E decide final public behavior.

---

## Task 0: Baseline and Branch

**Owner:** main orchestrator

**Files:**
- No source edits.

**Steps:**
1. Capture baseline:
   ```bash
   git status --short --branch
   pnpm --filter @bitrix24-reporting/api test -- --runInBand
   pnpm --filter @bitrix24-reporting/web exec vitest run
   pnpm --filter @bitrix24-reporting/proto exec vitest run
   pnpm audit --prod
   ```
2. Expected baseline from review:
   - API: 18 files / 75 tests pass.
   - Web: 5 files / 32 tests pass.
   - Proto: 1 file / 11 tests pass.
   - Audit: fails with 2 moderate advisories through `apps__web > shadcn`.
3. Create implementation branch if not already isolated:
   ```bash
   git switch -c codex/reporting-review-fixes
   ```
4. Commit only after each stream has green targeted tests.

---

## Task A: Make Sync Snapshot Updates Safe

**Suggested agent:** `backend`

**Files:**
- Modify: `apps/api/src/domain/sync.ts`
- Modify: `apps/api/src/server/sqlite-repository.ts`
- Test: `apps/api/test/sync.test.ts`
- Test: `apps/api/test/sqlite.test.ts`
- Possibly Test: `apps/api/test/service.test.ts`

**Problem:** A failed sync can partially write deals/cursors/coverage and cause the next delta to skip data. Sync writes are not snapshot-atomic.

**Design:**
- Introduce a synchronous repository transaction method, for example `runSnapshotTransaction<T>(task: () => T): T`, implemented with better-sqlite3 `.transaction()`.
- Do not put Bitrix network calls inside the transaction.
- Fetch and map all remote data first.
- Apply all local writes and cursor/coverage markers inside one synchronous repository transaction.
- Stop using `MAX(date_modify)` as the authoritative successful cursor. Read the persisted successful cursor first. Fallback to `MAX(date_modify)` only for legacy DBs without a cursor, and migrate by writing a success cursor after a successful run.

**Step 1: Write failing tests**
- In `sync.test.ts`, add a test where:
  - deals are upserted,
  - `listStageHistory` throws after `setSyncCursor` would currently happen,
  - assert no success cursor/coverage advancement after failure.
- In `sqlite.test.ts`, add a transaction rollback test:
  - insert a deal inside `runSnapshotTransaction`,
  - throw,
  - assert the deal/cursor were not persisted.

**Step 2: Verify tests fail**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sync.test.ts test/sqlite.test.ts
```
Expected: new tests fail with current partial-write behavior.

**Step 3: Implement repository transaction**
- Add method to `SqliteRepository` interface:
  ```ts
  runSnapshotTransaction<T>(task: () => T): T;
  ```
- In `createSqliteRepository`, wrap:
  ```ts
  const runSnapshotTransaction = database.transaction(<T>(task: () => T) => task());
  ```
  and expose a method that invokes it.
- Keep the callback synchronous. Do not call `await` inside this transaction.

**Step 4: Rework `performManualSync` persistence phase**
- Keep all `await input.client.*` calls before transaction.
- Build arrays:
  - `dealsToUpsert`
  - `activitiesToUpsert`
  - `deadlineChangesToUpsert`
  - `callsToUpsert`
  - `managerDirectoryToUpsert`
  - `stageHistoryToUpsert`
  - `coverageRows`
  - `cursorRows`
- In one transaction:
  - replace stage catalog,
  - upsert deals,
  - upsert activities/deadline changes/calls/managers/stage history,
  - mark bootstrap states,
  - set sync cursors,
  - upsert coverage,
  - finish sync run.
- If an error occurs before the transaction, only mark sync run failed.
- If an error occurs inside the transaction, the transaction must roll back; then mark the sync run failed in a separate operation.

**Step 5: Cursor semantics**
- Add or reuse `sync_cursors` keys for successful cursors.
- Prefer `getSyncCursor(dealCursorKey)` over `getLatestSuccessCursor`.
- Use `getLatestSuccessCursor` only as migration fallback when no cursor exists.
- Update cursor only after all snapshot writes succeed.

**Step 6: Run targeted tests**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/sync.test.ts test/sqlite.test.ts test/service.test.ts
```
Expected: pass.

**Step 7: Commit**
```bash
git add apps/api/src/domain/sync.ts apps/api/src/server/sqlite-repository.ts apps/api/test/sync.test.ts apps/api/test/sqlite.test.ts apps/api/test/service.test.ts
git commit -m "fix(api): make reporting sync snapshot atomic"
```

---

## Task B: Fix Report Calculation Semantics

**Suggested agent:** `backend` or `reviewer`

**Files:**
- Modify: `apps/api/src/domain/operational-reports.ts`
- Modify: `apps/api/src/domain/reporting.ts`
- Test: `apps/api/test/source-quality-conversion.test.ts`
- Test: `apps/api/test/target-group-conversion.test.ts`
- Test: `apps/api/test/manager-action-outcome.test.ts`
- Test: `apps/api/test/cohort-conversion.test.ts`
- Test: `apps/api/test/reporting.test.ts`

**Problem:** Several reports use different terminal-date and call-success rules for the same business concepts.

**Design:**
- Add small shared helpers inside `operational-reports.ts`:
  - `resolveWonAt(deal, stageHistoryByDeal, wonStageIds)`
  - `resolveTerminalClosedAt(deal, stageHistoryByDeal, wonStageIds)` for won/lost terminal transitions.
  - `isConnectedSuccessfulCall(call)` equivalent to operational calls semantics.
- Keep helpers local unless multiple modules need them. If `reporting.ts` needs call semantics, either duplicate a small helper with a test or move to a new `report-calculations.ts` module.

**Step 1: Add failing tests**
1. `source-quality-conversion.test.ts`
   - Deal entered won stage in April, has `dateClosed = null`, modified in May.
   - May report must not count it as won.
   - April report must count it.
2. `target-group-conversion.test.ts`
   - Target group has a lost deal in range and no created/won deals in range.
   - Row must be present with `createdDeals: 0`, `wonDeals: 0`, `winRate: 0`.
3. `manager-action-outcome.test.ts`
   - Two cohort deals: one SLA on time, one no-touch.
   - SLA fulfillment rate must be `0.5`, not `1`.
4. `cohort-conversion.test.ts`
   - Lost deal has terminal lost stage-history row and `dateClosed = null`.
   - Cohort closure must count it as closed in that month.
5. `reporting.test.ts`
   - Call with `duration = 0` and `callFailedCode = null` must be failed, matching calls workload semantics.

**Step 2: Verify tests fail**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/source-quality-conversion.test.ts test/target-group-conversion.test.ts test/manager-action-outcome.test.ts test/cohort-conversion.test.ts test/reporting.test.ts
```

**Step 3: Fix source-quality conversion**
- Replace checks like:
  ```ts
  isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
  ```
  with a won timestamp resolved from won-stage history first.

**Step 4: Fix target-group conversion**
- Track `lostDeals` as already done.
- Change row filter to:
  ```ts
  row.createdDeals > 0 || row.wonDeals > 0 || row.lostDeals > 0
  ```
- Verify totals still mean created/won totals, not losses.

**Step 5: Fix SLA fulfillment**
- Change denominator:
  ```ts
  const denominator =
    accumulator.onTimeCount + accumulator.lateCount + accumulator.noTouchCount;
  ```
- Keep existing detail fields so UI can still show no-touch count separately.

**Step 6: Fix cohort terminal closure**
- For won deals, use latest won-stage history.
- For lost/terminal deals, use latest terminal failed stage-history entry when available.
- Fallback order: terminal stage-history timestamp -> `dateClosed` -> `dateModify` only for terminal semantic deals.

**Step 7: Align call success**
- Update `apps/api/src/domain/reporting.ts:isSuccessfulCall` to require a connected duration and successful status:
  ```ts
  return call.callDurationSeconds > 0 &&
    (call.callFailedCode === null || call.callFailedCode === "200");
  ```
- If Bitrix uses empty-string success codes, normalize and test that explicitly.

**Step 8: Run targeted tests**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/source-quality-conversion.test.ts test/target-group-conversion.test.ts test/manager-action-outcome.test.ts test/cohort-conversion.test.ts test/reporting.test.ts
```
Expected: pass.

**Step 9: Commit**
```bash
git add apps/api/src/domain/operational-reports.ts apps/api/src/domain/reporting.ts apps/api/test/source-quality-conversion.test.ts apps/api/test/target-group-conversion.test.ts apps/api/test/manager-action-outcome.test.ts apps/api/test/cohort-conversion.test.ts apps/api/test/reporting.test.ts
git commit -m "fix(api): align reporting calculation semantics"
```

---

## Task C: Harden API Security, Error Contracts, and Date Validation

**Suggested agent:** `security` or `backend`

**Files:**
- Modify: `apps/api/src/server/app.ts`
- Modify: `apps/api/src/config/env.ts`
- Test: `apps/api/test/http.test.ts`
- Test: `apps/api/test/env.test.ts`
- Test: `apps/api/test/security.test.ts`

**Problems:**
- Global `cors()` and no auth on local API.
- 500 responses leak raw error messages.
- Error shape is inconsistent.
- Date range validation compares ISO strings lexicographically.
- Partial Bitrix webhook env passes validation and fails only at sync time.

**Design:**
- Add env fields:
  - `API_AUTH_TOKEN?: string`
  - `WEB_ORIGIN` already exists; actually use it.
- Protect all `/api/*` endpoints except `/api/health`, or at least protect `POST /api/sync` and `PUT /api/settings/won-stages`.
- For local dashboard simplicity, allow unauthenticated GETs only if product owner explicitly wants that. Default plan: require token for mutating routes first, then consider GET auth.
- CORS:
  ```ts
  cors({
    origin: env.WEB_ORIGIN,
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Token"]
  })
  ```
- Error response shape:
  ```ts
  { error: string; code: string; details?: unknown }
  ```
- Do not include internal `error.message` for 500 in response.

**Step 1: Add failing tests**
- `http.test.ts`:
  - rejects unauthorized `POST /api/sync` if token configured.
  - rejects unauthorized `PUT /api/settings/won-stages` if token configured.
  - accepts authorized request with `X-API-Token` or `Authorization: Bearer`.
  - validation errors return `{ error, code, details }`.
  - generic thrown error returns 500 without raw message.
  - date offsets compare by timestamp, not string.
- `env.test.ts`:
  - one or two Bitrix webhook fields without all three fails validation.
  - all three fields passes.
  - none passes with `bitrixEnabled: false`.

**Step 2: Verify tests fail**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/http.test.ts test/env.test.ts test/security.test.ts
```

**Step 3: Implement env validation**
- In `readEnv`, add all-or-nothing refine for:
  - `BITRIX24_PORTAL_HOST`
  - `BITRIX24_WEBHOOK_USER_ID`
  - `BITRIX24_WEBHOOK_TOKEN`
- Add `API_AUTH_TOKEN` optional.

**Step 4: Implement app security middleware**
- Change `createApp` signature if needed to accept config:
  ```ts
  createApp(service, { webOrigin, apiAuthToken })
  ```
- In `index.ts`, pass env config.
- Add middleware before routes:
  - Skip `/api/health`.
  - For mutating routes, require token when configured.
  - Return 401 with stable error shape.

**Step 5: Fix CORS**
- Replace `app.use(cors())` with configured origin/methods.
- Add tests asserting `Access-Control-Allow-Origin` for allowed origin and no wildcard.

**Step 6: Fix date comparison**
- In `reportQuerySchema.superRefine`, compare:
  ```ts
  const fromMs = Date.parse(value.from);
  const toMs = Date.parse(value.to);
  if (Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > toMs) ...
  ```
- Do the same for compare ranges.

**Step 7: Fix error handler**
- Keep Express four-argument error middleware.
- For 500 response:
  ```ts
  response.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    code: "INTERNAL_SERVER_ERROR"
  });
  ```
- Log raw error server-side only.

**Step 8: Run targeted tests**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/http.test.ts test/env.test.ts test/security.test.ts
```

**Step 9: Commit**
```bash
git add apps/api/src/server/app.ts apps/api/src/config/env.ts apps/api/src/index.ts apps/api/test/http.test.ts apps/api/test/env.test.ts apps/api/test/security.test.ts
git commit -m "fix(api): harden local API boundaries"
```

---

## Task D: Restore Production Web Runtime Behavior

**Suggested agent:** `frontend`

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/dashboard/dashboard-shell.tsx`
- Modify: `apps/web/src/features/dashboard/sales-report-card.tsx`
- Modify: `apps/web/src/features/dashboard/dashboard-shell.test.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Possibly Modify: `apps/web/src/lib/api-client.ts`
- Possibly Test: `apps/web/src/lib/api-client.test.ts`

**Problems:**
- `apps/web` renders `ProtoApp` as the main app.
- `DashboardShell` silently falls back to demo data on live API failure.
- Sales card displays `dealTitle`, which is a privacy footgun.
- Date boundary construction uses local timezone.

**Design:**
- `apps/web` main entry should render `DashboardShell`.
- Demo/preview dataset must be opt-in, not automatic fallback.
- Sales UI displays `dealId` or `dealDisplayId`, not deal names/titles.
- Date boundary helpers should be UTC-stable, matching proto `T00:00:00.000Z` / `T23:59:59.999Z`.

**Step 1: Add/adjust failing tests**
- `App.test.tsx` should expect production dashboard heading, not prototype heading.
- `dashboard-shell.test.tsx`:
  - API failure renders explicit error state and retry, not demo rows.
  - Sales details show deal ID, not `dealTitle`.
  - Period query for date input serializes UTC boundaries.

**Step 2: Verify tests fail**
```bash
pnpm --filter @bitrix24-reporting/web exec vitest run src/App.test.tsx src/features/dashboard/dashboard-shell.test.tsx
```

**Step 3: Switch web App**
```tsx
import { DashboardShell } from "@/features/dashboard/dashboard-shell";

function App() {
  return <DashboardShell />;
}
```

**Step 4: Remove silent demo fallback**
- Replace catch branch in `hydrate()` with:
  - `setConnectionMode("live")` or remove connection mode if no longer useful.
  - `setStatusMessage("Не удалось загрузить live-данные...")`.
  - keep previous valid data if it exists, or show error empty state if initial load.
- Add retry button that calls `hydrate(dashboardQuery)`.
- Keep `getDemoSnapshot` only under explicit preview prop/route if still needed.

**Step 5: Hide deal titles**
- In `sales-report-card.tsx`, render:
  ```tsx
  Сделка #{deal.dealId}
  ```
  or just `{deal.dealId}`.
- Update test fixtures so `dealTitle` being present does not appear in UI.

**Step 6: Fix UTC boundaries**
- Change `toBoundaryIso` to avoid local `new Date(year, month...)`:
  ```ts
  return boundary === "start"
    ? new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0)).toISOString()
    : new Date(Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999)).toISOString();
  ```

**Step 7: Run targeted tests**
```bash
pnpm --filter @bitrix24-reporting/web exec vitest run src/App.test.tsx src/features/dashboard/dashboard-shell.test.tsx src/lib/api-client.test.ts
```

**Step 8: Commit**
```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/features/dashboard/dashboard-shell.tsx apps/web/src/features/dashboard/dashboard-shell.test.tsx apps/web/src/features/dashboard/sales-report-card.tsx apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts
git commit -m "fix(web): make dashboard live-first and privacy-safe"
```

---

## Task E: Harden Prototype Comments and Dependency Surface

**Suggested agent:** `security` or `frontend`

**Files:**
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/proto/vite.config.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `apps/web/src/proto/proto-app.test.tsx` if comment behavior changes.

**Problems:**
- `/__proto/comments` reads/writes a local file without validation, size limit, auth, or origin guard.
- `shadcn` is in runtime dependencies and brings prod audit advisories.

**Design:**
- Keep comments endpoint for dev only, or protect preview with a token.
- Validate comments payload shape with Zod or a local minimal validator.
- Enforce body size limit before JSON parse.
- Move `shadcn` to `devDependencies` and update lockfile.

**Step 1: Add failing tests where feasible**
- If Vite plugin functions are not currently exported, first extract pure helpers:
  - `parseCommentsPayload`
  - `isAllowedProtoOrigin`
- Add tests for:
  - rejects invalid shape,
  - rejects too-large body,
  - accepts valid comments.

**Step 2: Implement shared comments plugin helper**
- Avoid duplicating logic between `apps/web/vite.config.ts` and `apps/proto/vite.config.ts`.
- If sharing across apps is too much for this pass, duplicate small guarded logic and add a follow-up refactor issue.

**Step 3: Gate dev/preview**
- Register `configureServer` only for dev.
- Register `configurePreviewServer` only if `PROTO_COMMENTS_ENABLED=true`.
- Check `Origin`/`Host` is localhost or configured allowed origin.

**Step 4: Move `shadcn`**
```bash
pnpm --filter @bitrix24-reporting/web remove shadcn
pnpm --filter @bitrix24-reporting/web add -D shadcn@^4.2.0
pnpm install
```
- If advisories remain, update transitive lockfile within compatible ranges.

**Step 5: Run checks**
```bash
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/proto exec vitest run
pnpm audit --prod
```
Expected: tests pass; prod audit no longer reports the `apps__web > shadcn` path.

**Step 6: Commit**
```bash
git add apps/web/vite.config.ts apps/proto/vite.config.ts apps/web/package.json pnpm-lock.yaml apps/web/src/proto/proto-app.test.tsx
git commit -m "fix(web): harden prototype tooling surface"
```

---

## Task F: Backfill Coverage for Contracts and Documentation

**Suggested agent:** `tester` plus `documenter`

**Files:**
- Modify: `apps/api/test/http.test.ts`
- Modify: `apps/web/src/lib/api-client.test.ts`
- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `docs/backlog.md` only if product scope changes.

**Problems:**
- HTTP tests do not cover all production report endpoints.
- Frontend normalizers are only partially covered.
- `SECURITY.md` and README are stale relative to actual Bitrix methods and allowed fields.

**Step 1: API endpoint coverage**
- Add `http.test.ts` cases for:
  - `/api/reports/target-group-conversion`
  - `/api/reports/manager-action-outcomes`
  - error middleware 500 shape
  - auth/CORS behavior from Task C
- Verify filters/compare params are passed through.

**Step 2: Frontend api-client coverage**
- Add table-driven tests for:
  - dashboard
  - calls workload
  - cohort conversion
  - target-group conversion
  - manager-action outcomes
  - TOC flow
  - sync summary
  - non-OK response throws `ApiClientError` with status.

**Step 3: Documentation update**
- Update `SECURITY.md`:
  - list actual allowed methods: deal list, status, deal fields, contact field/list for target group only, item list for dictionaries, stage history, activity list, voximplant stats, user get.
  - explicitly say contact reads are restricted to configured target-group UF fields, no names/phones/emails.
  - state API auth/CORS behavior after Task C.
- Update `README.md` security model to match.

**Step 4: Run checks**
```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand test/http.test.ts test/security.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts
```

**Step 5: Commit**
```bash
git add apps/api/test/http.test.ts apps/web/src/lib/api-client.test.ts README.md SECURITY.md docs/backlog.md
git commit -m "test: cover reporting API contracts"
```

---

## Final Integration Gate

**Owner:** main orchestrator or `reviewer`

**Steps:**
1. Rebase/merge stream branches carefully. Resolve conflicts in:
   - `apps/api/src/domain/operational-reports.ts`
   - `apps/api/test/http.test.ts`
   - `apps/web/src/App.test.tsx`
2. Run full verification:
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   pnpm audit --prod
   ```
3. If full workspace commands are too slow, minimum gate:
   ```bash
   pnpm --filter @bitrix24-reporting/api test -- --runInBand
   pnpm --filter @bitrix24-reporting/web exec vitest run
   pnpm --filter @bitrix24-reporting/proto exec vitest run
   pnpm --filter @bitrix24-reporting/api typecheck
   pnpm --filter @bitrix24-reporting/web typecheck
   pnpm --filter @bitrix24-reporting/proto typecheck
   pnpm audit --prod
   ```
4. Manual smoke:
   - Start API/web locally.
   - Open web dashboard.
   - Verify no prototype comment mode on main web app.
   - Trigger failed API scenario and verify no demo data appears as live.
   - Trigger sync with missing token and valid token if `API_AUTH_TOKEN` is configured.
5. Final review:
   - Use `reviewer` agent for pre-merge review.
   - Use `security` agent for API/CORS/auth follow-up.

---

## Suggested Subagent Dispatch

Dispatch these in parallel after Task 0:

1. `backend`: Task A only. Owns sync and sqlite files.
2. `backend` or `reviewer`: Task B only. Owns report calculation files.
3. `security`: Task C only. Owns API boundary and env validation.
4. `frontend`: Task D only. Owns production web runtime.
5. `security` or `frontend`: Task E only. Owns proto comments and dependency audit.

Then dispatch after A/C/D/E land:

6. `tester`: Task F API/frontend coverage gaps.
7. `reviewer`: Final Integration Gate.
