# Plan 020: Wire automatic call analysis into an enrichment orchestrator

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/call-analysis-service.ts apps/api/src/server/routes/attraction-call-handlers.ts apps/api/src/server/app.ts apps/api/src/index.ts apps/api/test/call-analysis-service.test.ts apps/api/test/http.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/017-add-call-enrichment-proposal-storage.md, plans/018-add-bitrix-call-event-intake.md, plans/019-add-cheap-dialogue-gate.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The system needs one automatic path from Bitrix call event to analysis result to
enrichment proposal creation. That path must be idempotent and must stop early
for no-dialogue calls and no-op enrichment. If this logic is scattered across
routes, provider code, and Telegram code, retries will create duplicate messages
or write attempts.

## Current state

Relevant files:

- `apps/api/src/server/call-analysis-service.ts` - current manual call analysis
  service.
- `apps/api/src/server/routes/attraction-call-handlers.ts` - call route runner
  interface.
- `apps/api/src/server/app.ts` - app config and route wiring.
- `apps/api/src/index.ts` - builds Bitrix client, repositories, OpenRouter
  provider, and call analysis service.
- `apps/api/test/call-analysis-service.test.ts` - orchestration tests.
- `apps/api/test/http.test.ts` - route tests.

Current excerpts:

- `apps/api/src/server/call-analysis-service.ts:125-240` performs one manual
  `analyzeCall` flow.
- `apps/api/src/server/call-analysis-service.ts:147-154` blocks concurrent
  manual runs with `CALL_ANALYSIS_ALREADY_RUNNING`.
- `apps/api/src/server/call-analysis-service.ts:171-222` builds context,
  resolves recording, downloads audio, calls provider, saves result, and
  finishes run.
- `apps/api/src/server/call-analysis-service.ts:244-287` builds context with
  `callId`, `crmActivityId`, `managerId`, `dealId`, stage and activity fields.
- `apps/api/src/server/routes/attraction-call-handlers.ts:40-45` currently has
  only `analyzeCall` and optional `getCallAnalysisResult`.
- `apps/api/src/index.ts:136-152` constructs call analysis only when
  `OPENROUTER_API_KEY` is present.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Service tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-analysis-service.test.ts` | exits 0 |
| HTTP tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/call-enrichment-orchestrator.ts` (create)
- `apps/api/src/server/call-analysis-service.ts`
- `apps/api/src/server/routes/attraction-call-handlers.ts`
- `apps/api/src/server/app.ts`
- `apps/api/src/index.ts`
- `apps/api/test/call-enrichment-orchestrator.test.ts` (create)
- `apps/api/test/call-analysis-service.test.ts`
- `apps/api/test/http.test.ts`

**Out of scope**:

- Enrichment extraction prompt.
- Current CRM value resolver.
- Telegram formatting/callbacks.
- Bitrix write adapter.
- Scheduler for expiry.

## Git workflow

- Branch: `codex/call-enrichment-orchestrator`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Extract reusable call analysis context if needed

`buildCallAnalysisContext` is currently private in `call-analysis-service.ts`.
The orchestrator needs deal id, contact id, manager id, and call attributes. Use
the least invasive option:

- either expose a method from `createCallAnalysisService` like
  `getCallAnalysisContext(callId)`;
- or create a small helper module that both service and orchestrator can use.

Do not duplicate context resolution logic. Preserve existing behavior for manual
analysis.

Add `contactId` to context attributes by using `deal.contactId` from
`DealSnapshot` when available. If `DealSnapshot` type lacks it in tests, update
test fixtures. The database already has `deal_snapshots.contact_id`
(`sqlite-repository.ts:753-757` and `1236-1239`).

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-analysis-service.test.ts` -> exits 0.

### Step 2: Create the orchestrator interface

Create `apps/api/src/server/call-enrichment-orchestrator.ts`.

Input:

```ts
interface QueueAutomaticCallAnalysisInput {
  callId: string;
  activityId?: string | null;
  dealId?: string | null;
  contactId?: string | null;
  managerId?: string | null;
  durationSeconds?: number | null;
  occurredAt?: string | null;
}
```

Output:

```ts
type QueueAutomaticCallAnalysisResult =
  | { status: "queued"; callId: string }
  | { status: "duplicate"; callId: string }
  | { status: "skipped"; callId: string; reason: string };
```

Implementation responsibilities in this plan:

- idempotently reject duplicate active work for the same call;
- run dialogue gate on automatic path;
- if no dialogue, append proposal audit/system event or a lightweight skipped
  record if proposal batch is not created;
- run full call analysis only after gate passes;
- call a placeholder `enrichmentPipeline.runAfterCallAnalysis(result)` interface
  that later plans implement.

Do not send Telegram here. Do not write Bitrix here.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-enrichment-orchestrator.test.ts` -> exits 0.

### Step 3: Wire route runner to orchestrator

Update `CallAnalysisRunner` in `attraction-call-handlers.ts` to include
`queueAutomaticCallAnalysis`.

The intake endpoint from Plan 018 should call `queueAutomaticCallAnalysis`, while
manual `/api/calls/:callId/analyze` should keep calling `analyzeCall`.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` -> exits 0.

### Step 4: Wire app/index construction

In `apps/api/src/index.ts`, construct the orchestrator only when required config
exists:

- Bitrix client configured.
- OpenRouter API key configured.
- Call enrichment intake enabled.

Pass it into `createApp` as `callAnalysis` or a new explicit
`callEnrichment` config object. Prefer explicit naming if the interface grows.

Keep existing call analysis route behavior when enrichment is disabled.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 5: Add orchestration tests

Create `apps/api/test/call-enrichment-orchestrator.test.ts`.

Test cases:

- duplicate event for call with active run returns duplicate and does not call
  full analysis twice;
- no-dialogue gate returns skipped and does not call full analysis;
- gate pass calls full analysis with triggerMode `"automatic"`;
- full analysis classification `failed_or_no_conversation` stops downstream
  enrichment;
- call with missing deal id returns skipped with reason `DEAL_NOT_RESOLVED`;
- call with missing manager id returns skipped with reason `MANAGER_NOT_RESOLVED`;
- successful path calls downstream enrichment pipeline once.

Use mocked repository/provider/downstream. Do not call live Bitrix/OpenRouter.

## Test plan

- New `apps/api/test/call-enrichment-orchestrator.test.ts`.
- Extend `apps/api/test/call-analysis-service.test.ts`.
- Extend `apps/api/test/http.test.ts`.

## Done criteria

- [ ] Automatic call intake has one orchestrator entrypoint.
- [ ] Manual call analysis behavior remains unchanged.
- [ ] No-dialogue automatic calls do not run full analysis and do not notify.
- [ ] Full analysis no-conversation classification stops enrichment.
- [ ] Context includes `dealId`, `contactId`, `managerId`.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- Existing call snapshots cannot reliably resolve deal/contact/manager context.
- Context extraction requires broad sync changes.
- Implementing this plan requires sending Telegram or writing Bitrix.

## Maintenance notes

The orchestrator is the state machine boundary. Later extraction, diff, Telegram,
and writeback should plug into it through explicit interfaces so retries remain
idempotent.

