# Plan 017: Add call enrichment proposal storage, lifecycle, and audit events

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/sqlite-repository.ts apps/api/src/server/sqlite/call-analysis.ts apps/api/test/sqlite.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/016-add-call-enrichment-field-allowlist.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

Enrichment proposals are not the same thing as call analysis results. Call
analysis can be ready while proposals are pending, partially applied, declined,
expired, or failed. Storing that lifecycle separately prevents accidental CRM
writeback and gives auditability for every manager click and system decision.

## Current state

Relevant files:

- `apps/api/src/server/sqlite-repository.ts` - owns SQLite schema and repository
  interface exports.
- `apps/api/src/server/sqlite/call-analysis.ts` - current pattern for extracting
  a repository method group into a focused file.
- `apps/api/test/sqlite.test.ts` - existing SQLite repository tests.

Current excerpts:

- `apps/api/src/server/sqlite-repository.ts:210-212` defines call analysis run
  status types.
- `apps/api/src/server/sqlite-repository.ts:256-269` defines
  `CallAnalysisResultRecord`.
- `apps/api/src/server/sqlite-repository.ts:1009-1049` creates
  `call_snapshots`, `call_analysis_runs`, and `call_analysis_results`.
- `apps/api/src/server/sqlite-repository.ts:1222-1225` indexes calls and call
  analysis runs.
- `apps/api/src/server/sqlite/call-analysis.ts:35-275` shows the preferred
  pattern: prepare statements once and return focused repository methods.
- `apps/api/test/sqlite.test.ts:65-185` tests call analysis persistence without
  storing audio.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| SQLite tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/sqlite-repository.ts`
- `apps/api/src/server/sqlite/enrichment-proposals.ts` (create)
- `apps/api/test/sqlite.test.ts`

**Out of scope**:

- OpenRouter extraction.
- Telegram sending/callbacks.
- Bitrix writes.
- HTTP routes.
- Dashboard UI.

## Git workflow

- Branch: `codex/call-enrichment-proposal-storage`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add repository types

In `apps/api/src/server/sqlite-repository.ts`, add types:

```ts
export type EnrichmentProposalBatchStatus =
  | "pending"
  | "partially_applied"
  | "applied"
  | "declined"
  | "expired"
  | "failed";

export type EnrichmentProposalStatus =
  | "pending"
  | "approved"
  | "declined"
  | "applied"
  | "failed"
  | "expired"
  | "conflict";

export type EnrichmentProposalActionType = "fill_empty" | "overwrite";
export type EnrichmentProposalEntityType = "contact" | "deal";
```

Add input/record interfaces for:

- `CreateEnrichmentProposalBatchInput`
- `CreateEnrichmentProposalInput`
- `EnrichmentProposalBatchRecord`
- `EnrichmentProposalRecord`
- `EnrichmentProposalEventInput`
- `EnrichmentProposalEventRecord`

Store values as JSON strings in SQLite but expose parsed `unknown` or
`Record<string, unknown>` values from repository methods.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 2: Add SQLite tables and indexes

In `createSqliteRepository`, add tables:

- `enrichment_proposal_batches`
- `enrichment_proposals`
- `enrichment_proposal_events`

Required columns:

`enrichment_proposal_batches`:

- `id TEXT PRIMARY KEY`
- `call_id TEXT NOT NULL`
- `activity_id TEXT`
- `deal_id TEXT NOT NULL`
- `contact_id TEXT`
- `manager_id TEXT NOT NULL`
- `call_analysis_run_id TEXT`
- `status TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `telegram_chat_id TEXT`
- `telegram_message_id TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

Add `UNIQUE(call_id)` or a unique index on `call_id` to guarantee one active
batch per call in V1.

`enrichment_proposals`:

- `id TEXT PRIMARY KEY`
- `batch_id TEXT NOT NULL`
- `entity_type TEXT NOT NULL`
- `entity_id TEXT NOT NULL`
- `field_code TEXT NOT NULL`
- `field_title TEXT NOT NULL`
- `action_type TEXT NOT NULL`
- `current_value_json TEXT`
- `proposed_value_json TEXT NOT NULL`
- `normalized_value_json TEXT NOT NULL`
- `confidence REAL NOT NULL`
- `evidence_snippet TEXT`
- `status TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

`enrichment_proposal_events`:

- `id TEXT PRIMARY KEY`
- `batch_id TEXT NOT NULL`
- `proposal_id TEXT`
- `actor_type TEXT NOT NULL`
- `actor_id TEXT`
- `action TEXT NOT NULL`
- `before_status TEXT`
- `after_status TEXT`
- `reason TEXT`
- `metadata_json TEXT`
- `created_at TEXT NOT NULL`

Indexes:

- `idx_enrichment_batches_call`
- `idx_enrichment_batches_manager_status`
- `idx_enrichment_batches_expires`
- `idx_enrichment_proposals_batch_status`
- `idx_enrichment_events_batch_created`

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 3: Implement focused repository methods

Create `apps/api/src/server/sqlite/enrichment-proposals.ts`, following the style
of `apps/api/src/server/sqlite/call-analysis.ts`.

Methods to add to `SqliteRepository`:

- `createEnrichmentProposalBatch(input)`
- `getEnrichmentProposalBatch(batchId)`
- `getEnrichmentProposalBatchByCallId(callId)`
- `listEnrichmentProposals(batchId)`
- `appendEnrichmentProposalEvent(input)`
- `markEnrichmentProposalDecision(input)` for manager decline/approve status
- `markEnrichmentProposalApplied(input)`
- `markEnrichmentProposalFailed(input)`
- `expirePendingEnrichmentProposals(input: { expiredAt: string })`

`expirePendingEnrichmentProposals` must:

- find batches with `status='pending'` and `expires_at <= expiredAt`;
- mark pending proposals as `expired`;
- mark batch as `expired` unless it is already applied/declined/failed;
- append audit events.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts
```

Expected: existing tests still pass.

### Step 4: Add SQLite tests

Extend `apps/api/test/sqlite.test.ts` with tests:

- creates a batch with two proposals and reads them back with parsed JSON values;
- rejects duplicate `call_id` batch;
- appends system and manager events;
- expires pending proposal after 48h timestamp;
- does not expire an already applied proposal;
- records `conflict`/`failed` status without losing original proposed value.

Use the existing temp database pattern from `apps/api/test/sqlite.test.ts:18-25`.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts
```

Expected: all SQLite tests pass.

## Test plan

- Extend `apps/api/test/sqlite.test.ts`.
- No HTTP tests yet.
- No Bitrix or Telegram mocks yet.

## Done criteria

- [ ] Proposal batch/proposal/event tables exist.
- [ ] One call cannot create duplicate V1 batches.
- [ ] Pending proposals can expire after 48 hours.
- [ ] Every status-changing repository method can append audit events.
- [ ] Existing call analysis persistence still passes.
- [ ] API typecheck and lint pass.

## STOP conditions

Stop and report if:

- The schema needs to store full call transcript in proposal rows.
- The unique `call_id` constraint conflicts with a real requirement to create
  multiple independent proposal batches for one call in V1.
- Implementing expiry requires a scheduler in this plan; only repository expiry
  behavior belongs here.

## Maintenance notes

Future plans should treat these tables as the source of truth for manager
decisions. Telegram callbacks and Bitrix writes should never act from callback
payload alone.

