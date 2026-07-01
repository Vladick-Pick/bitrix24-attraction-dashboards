# Plan 025: Add rollout gates and end-to-end verification for call enrichment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/config/env.ts apps/api/src/index.ts apps/api/src/server/app.ts apps/api/src/tools/stand-data.ts apps/api/test/env.test.ts apps/api/test/http.test.ts apps/api/test/stand-data.test.ts docs/deploy-timeweb-vps.md`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/020-wire-automatic-call-analysis-enrichment-orchestrator.md, plans/021-add-enrichment-extraction-agent.md, plans/022-add-current-crm-values-diff.md, plans/023-add-telegram-enrichment-approval-flow.md, plans/024-add-narrow-bitrix-enrichment-write-adapter.md
- **Category**: dx
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The feature touches external calls, LLMs, Telegram, and CRM writes. It should not
launch directly in full write mode. This plan adds explicit rollout phases and
end-to-end verification so the team can prove no-dialogue skips, no-op skips,
Telegram-only approval, and limited writeback before enabling all managers.

## Current state

Relevant files:

- `apps/api/src/config/env.ts` - env schema and derived config.
- `apps/api/src/index.ts` - constructs runtime services.
- `apps/api/src/server/app.ts` - route and scheduler wiring.
- `apps/api/src/tools/stand-data.ts` - synthetic stand data generator.
- `docs/deploy-timeweb-vps.md` - production env/deploy documentation.
- `apps/api/test/env.test.ts`, `apps/api/test/http.test.ts`,
  `apps/api/test/stand-data.test.ts` - verification tests.

Current excerpts:

- `apps/api/src/config/env.ts:97-189` contains runtime env schema.
- `apps/api/src/config/env.ts:291-349` returns derived app env.
- `apps/api/src/index.ts:21-267` constructs repositories, Bitrix clients,
  services, Telegram client, and app config.
- `apps/api/src/tools/stand-data.ts:711-775` seeds call analysis results for
  stand/demo data.
- `docs/deploy-timeweb-vps.md:68-70` documents existing Telegram activity report
  env vars.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Env tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` | exits 0 |
| HTTP/e2e API tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts test/call-enrichment-e2e.test.ts` | exits 0 |
| Stand tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/stand-data.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| Workspace checks | `pnpm lint && pnpm typecheck` | both exit 0 |

## Scope

**In scope**:

- `apps/api/src/config/env.ts`
- `apps/api/src/index.ts`
- `apps/api/src/server/app.ts`
- `apps/api/src/tools/stand-data.ts`
- `apps/api/test/call-enrichment-e2e.test.ts` (create)
- `apps/api/test/env.test.ts`
- `apps/api/test/http.test.ts`
- `apps/api/test/stand-data.test.ts`
- `docs/deploy-timeweb-vps.md`
- `docs/deployment-pipeline.md` if production rollout steps belong there

**Out of scope**:

- Adding dashboard UI.
- Adding reminders for ignored Telegram messages.
- Bulk manager enablement without pilot.
- Production deployment itself unless the operator explicitly asks for deploy.

## Git workflow

- Branch: `codex/call-enrichment-rollout-e2e`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add rollout mode config

In `apps/api/src/config/env.ts`, add:

```ts
CALL_ENRICHMENT_MODE = "off" | "dry_run" | "telegram_only" | "limited_write" | "full_v1"
CALL_ENRICHMENT_PILOT_MANAGER_IDS = "..."
```

Derived:

- `callEnrichmentMode`
- `callEnrichmentPilotManagerIds`
- helpers:
  - `callEnrichmentAnalysisEnabled`
  - `callEnrichmentTelegramEnabled`
  - `callEnrichmentWritebackEnabled`

Rules:

- `off`: no intake/orchestration.
- `dry_run`: run gate/full analysis/extraction/diff/storage, no Telegram, no
  Bitrix writes.
- `telegram_only`: send Telegram approvals, but decision apply does not call
  Bitrix; it records manager decisions.
- `limited_write`: Bitrix writes only for pilot manager ids.
- `full_v1`: Bitrix writes for configured managers.

**Verify**: env tests cover all modes and invalid values.

### Step 2: Gate runtime construction

In `apps/api/src/index.ts`, wire services based on rollout mode:

- Do not construct Telegram enrichment sender unless mode needs Telegram.
- Do not construct Bitrix write adapter unless mode permits writeback.
- In `telegram_only`, decision service should mark approved decisions without
  writing Bitrix and append audit reason `WRITEBACK_DISABLED_TELEGRAM_ONLY`.
- In `dry_run`, proposals may be created and audited but no Telegram is sent.

**Verify**: HTTP/e2e tests with fake dependencies assert each mode.

### Step 3: Add expiry runner

Add a lightweight interval or startup-safe job that calls
`expirePendingEnrichmentProposals` from Plan 017.

Config:

- `CALL_ENRICHMENT_EXPIRY_INTERVAL_MINUTES`, default `60`.

Behavior:

- Works only when call enrichment mode is not `off`.
- Uses `setInterval` with `.unref?.()`, following existing auto sync/Telegram
  scheduling style in `apps/api/src/server/app.ts:1577-1857`.
- Logs count expired without raw proposal values.

**Verify**: fake timer tests similar to Telegram report scheduling tests around
`apps/api/test/http.test.ts:4072-4208`.

### Step 4: Add synthetic end-to-end tests

Create `apps/api/test/call-enrichment-e2e.test.ts` with mocked Bitrix,
OpenRouter, Telegram, and SQLite temp repository.

Scenarios:

- no-dialogue call:
  - intake returns queued/skipped;
  - no full extraction;
  - no Telegram;
  - no Bitrix write.
- dialogue with no meaningful updates:
  - analysis/extraction runs;
  - diff creates no proposals;
  - no Telegram;
  - audit has `skipped_no_material_updates`.
- dialogue with one contact field proposal:
  - creates batch/proposal;
  - in `dry_run`, no Telegram;
  - in `telegram_only`, sends Telegram and manager approval records no-op apply;
  - in `limited_write`, pilot manager approval writes contact field.
- dialogue with deal fields:
  - `Ключевые проекты` and `Связи...` route to deal write adapter.
- ignored proposal:
  - stays pending before 48h;
  - expires after 48h;
  - approval after expiry does not write.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/call-enrichment-e2e.test.ts
```

Expected: all scenarios pass.

### Step 5: Update stand data only if useful

If the local stand/demo environment benefits from sample enrichment proposals,
extend `apps/api/src/tools/stand-data.ts` to seed:

- one pending proposal batch;
- one applied proposal;
- one expired proposal.

Do not seed personal names, phones, emails, or raw transcript. Use deal/contact
ids and safe synthetic values.

If stand data does not need this yet, skip this step and record the decision in
the final report.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/stand-data.test.ts`.

### Step 6: Update deployment docs

Update `docs/deploy-timeweb-vps.md` with the new env variables and rollout
sequence:

1. `CALL_ENRICHMENT_MODE=dry_run`
2. validate metrics/logs;
3. `CALL_ENRICHMENT_MODE=telegram_only`
4. validate manager messages and decisions;
5. `CALL_ENRICHMENT_MODE=limited_write` with 1-2 pilot managers;
6. `CALL_ENRICHMENT_MODE=full_v1` only after pilot review.

Document rollback: set mode to `off` or `telegram_only` without database
migration.

**Verify**: `rg -n "CALL_ENRICHMENT_MODE|telegram_only|limited_write" docs/deploy-timeweb-vps.md`.

## Test plan

- Extend env tests.
- Add e2e API tests.
- Add fake timer expiry tests.
- Run stand-data tests if seeded.
- Run API typecheck, lint, and workspace typecheck.

## Done criteria

- [ ] Rollout modes exist and are tested.
- [ ] `dry_run`, `telegram_only`, `limited_write`, and `full_v1` have distinct
  behavior.
- [ ] Pending proposals expire after 48 hours through a runner.
- [ ] End-to-end tests cover no-dialogue, no-op, proposal, deal fields, and
  expiry.
- [ ] Deployment docs describe enablement and rollback.
- [ ] No production deploy is performed by this plan.

## STOP conditions

Stop and report if:

- The only way to test e2e requires live Bitrix writes.
- Rollout flags become ambiguous or overlap with Telegram activity report flags.
- Pilot manager ids are unavailable; keep mode at `telegram_only` until provided.

## Maintenance notes

The production rollout should start in `dry_run`. Review logs and proposal counts
before sending manager messages, then review manager decisions before enabling
writeback.

