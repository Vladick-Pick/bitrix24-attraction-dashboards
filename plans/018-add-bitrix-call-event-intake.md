# Plan 018: Add idempotent Bitrix call event intake for automatic analysis

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/app.ts apps/api/src/server/routes/attraction-routes.ts apps/api/src/server/routes/attraction-call-handlers.ts apps/api/src/config/env.ts apps/api/test/http.test.ts apps/api/test/env.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/017-add-call-enrichment-proposal-storage.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The current call analysis route is manual: a user or UI posts a known call id.
The product requirement is automatic: when Bitrix receives a call, it sends data
to this API for analysis. This plan creates a safe, idempotent intake endpoint
that normalizes the event and starts the downstream pipeline without sending any
manager Telegram notification yet.

## Current state

Relevant files:

- `apps/api/src/server/routes/attraction-routes.ts` - registers call routes.
- `apps/api/src/server/routes/attraction-call-handlers.ts` - manual call
  analysis handlers.
- `apps/api/src/server/app.ts` - auth, CSRF, JSON body, route registration.
- `apps/api/src/config/env.ts` - environment schema.
- `apps/api/test/http.test.ts` - HTTP route tests.

Current excerpts:

- `apps/api/src/server/routes/attraction-routes.ts:44-68` registers
  `GET /api/calls/analysis-queue`, `POST /api/calls/:callId/analyze`, and
  `GET /api/calls/:callId/analysis`.
- `apps/api/src/server/routes/attraction-call-handlers.ts:40-44` runner API has
  only `analyzeCall({ callId, triggerMode })`.
- `apps/api/src/server/app.ts:2186-2222` requires auth and CSRF for mutating
  `/api/*` routes when password auth is enabled.
- `apps/api/src/server/app.ts:2224-2250` supports `API_AUTH_TOKEN` for mutating
  requests only when password auth is disabled.

External docs note:

- The exact Bitrix event payload for telephony/activity should be confirmed in
  the portal before production rollout. This plan should accept a narrow
  normalized payload and not assume every Bitrix event shape is stable.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | exits 0 |
| Env tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/config/env.ts`
- `apps/api/src/server/routes/attraction-routes.ts`
- `apps/api/src/server/routes/attraction-call-handlers.ts`
- `apps/api/src/server/app.ts`
- `apps/api/test/http.test.ts`
- `apps/api/test/env.test.ts`

**Out of scope**:

- Registering the Bitrix event in the Bitrix portal.
- Cheap dialogue gate implementation.
- OpenRouter provider changes.
- Proposal extraction/diff.
- Telegram notifications.
- Bitrix CRM writeback.

## Git workflow

- Branch: `codex/bitrix-call-event-intake`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add intake env settings

In `apps/api/src/config/env.ts`, add:

- `BITRIX_CALL_EVENT_WEBHOOK_SECRET`: optional trimmed string.
- `CALL_ENRICHMENT_INTAKE_ENABLED`: enum `"true" | "false"`, default `"false"`.

Derived fields:

- `callEnrichmentIntakeEnabled: boolean`
- `bitrixCallEventWebhookSecret?: string`

Production rule: if `CALL_ENRICHMENT_INTAKE_ENABLED=true`, require
`BITRIX_CALL_EVENT_WEBHOOK_SECRET` length >= 32. This endpoint is not browser
CSRF-based; it should authenticate Bitrix/system-to-system events with a shared
secret header.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` -> exits 0 with new validation tests.

### Step 2: Extend route handlers with call event intake

In `apps/api/src/server/routes/attraction-call-handlers.ts`, add:

- `receiveCallEvent` route handler.
- Zod schema for normalized body:

```ts
{
  callId: string;
  activityId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  managerId?: string | null;
  durationSeconds?: number | null;
  occurredAt?: string | null;
}
```

Keep the schema strict and cap string lengths. Do not accept raw Bitrix payload
with arbitrary nested fields as the stored/intake contract. If the live Bitrix
webhook sends a larger raw shape, normalize it at the edge and discard unknown
fields.

Add a new runner method:

```ts
queueAutomaticCallAnalysis(input: NormalizedCallEventInput): Promise<{
  status: "queued" | "duplicate" | "skipped";
  callId: string;
  reason?: string;
}>
```

For this plan, the runner can be optional. If not configured, return 503
`CALL_ENRICHMENT_NOT_CONFIGURED`.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 3: Register the endpoint

In `apps/api/src/server/routes/attraction-routes.ts`, add route:

- `POST /api/calls/events/bitrix`
- `POST /api/modules/:moduleId/calls/events/bitrix`

Prefer a method name like `receiveCallEvent`.

In `apps/api/src/server/app.ts`, pass config:

- enabled flag;
- secret verifier;
- call analysis/enrichment runner.

Authentication behavior:

- If feature disabled: return 404 or 503 consistently; choose one and test it.
- If enabled: require header `X-Bitrix-Call-Event-Secret`.
- Do not require browser CSRF for this endpoint; it is a system webhook. If the
  current global CSRF middleware catches it, add a tightly scoped bypass only for
  this exact route and only when the shared secret validates.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` -> exits 0.

### Step 4: Add idempotency behavior at service boundary

The route should call a runner that can return duplicate status. If the runner
is not implemented until Plan 020, use a narrow interface and tests with a fake
runner.

Expected responses:

- `202 { status: "queued", callId }`
- `200 { status: "duplicate", callId }`
- `202 { status: "skipped", callId, reason }` for missing required downstream
  context such as no `callId`
- `401 { error: "UNAUTHORIZED", code: "UNAUTHORIZED" }` for missing/invalid
  secret

**Verify**: focused HTTP tests pass.

### Step 5: Add HTTP tests

In `apps/api/test/http.test.ts`, add tests:

- disabled intake does not accept events;
- missing secret returns 401;
- wrong secret returns 401;
- valid secret and valid body calls runner with normalized values;
- duplicate runner response returns 200 duplicate;
- module id other than attraction routes through or returns not found without
  calling attraction runner;
- unknown body fields are ignored or rejected; choose strict rejection if easy.

Use existing route handler tests around call analysis as structural examples:
`apps/api/test/http.test.ts` contains call analysis tests around references from
the `rg` output for `analyzeCall`.

## Test plan

- Extend `apps/api/test/env.test.ts`.
- Extend `apps/api/test/http.test.ts`.
- Run API typecheck and lint.

## Done criteria

- [ ] System-to-system call event endpoint exists and is disabled by default.
- [ ] Endpoint requires a 32+ char shared secret when enabled.
- [ ] Request body is schema-validated and normalized.
- [ ] Duplicate events can be acknowledged without duplicate downstream work.
- [ ] Endpoint does not send Telegram and does not write Bitrix.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- The live Bitrix event cannot provide or resolve a stable call id/activity id.
- A reviewer wants to accept and persist raw Bitrix webhook payloads.
- CSRF bypass would affect any route other than this exact webhook.
- The endpoint needs production secret values to be printed or committed.

## Maintenance notes

This is an intake boundary, not business logic. Dialogue detection, enrichment,
Telegram, and Bitrix writeback should stay behind service interfaces so retries
and duplicate events remain safe.

