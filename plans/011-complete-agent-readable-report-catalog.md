# Plan 011: Complete Agent-Readable Attraction Report Catalog

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-define-module-capability-manifest-and-agent-data-boundary.md
- **Category**: agent boundary
- **Status**: DONE
- **Planned at**: commit `8712892`, 2026-06-25

## Execution Notes

- 2026-06-25 pre-implementation gate: `pnpm session:preflight --allow-dirty`
  passed on `codex/agent-mcp-plans`; dirty files were the active plan files.
- 2026-06-25 CRG gate: new worktree graph was empty, so the registered
  repository graph at the original worktree was checked with
  `get_minimal_context_tool`; reported low risk and expected reporting flows.
- 2026-06-25 pre-implementation review: live attraction analytics route
  inventory and `ReportingService` methods match the missing descriptors in this
  plan. No planned descriptor requires raw SQLite, direct Bitrix, contact fields,
  raw payloads, cookies, tokens, or filesystem access. `unit-economics` remains
  cataloged but non-agent-readable for an explicit denial path; `revenue-velocity`
  is treated as an aggregate approved report unless focused tests contradict
  that policy.
- 2026-06-25 RED: `pnpm --filter @bitrix24-reporting/api exec vitest run
  test/module-capabilities.test.ts` failed on missing attraction report routes,
  missing `revenue-velocity`, and missing availability descriptors.
- 2026-06-25 GREEN verification passed:
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts`
  - `pnpm ontology:validate`
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts -t "capability"`
  - `pnpm --filter @bitrix24-reporting/api typecheck`
  - `git diff --check`
- 2026-06-25 post-implementation review: CRG review context reported low risk;
  route parity, service-method parity, status semantics, and `agentReadable`
  policy are tested. No hidden report allowlist or implementation detail below
  the module capability boundary was introduced. All findings closed.

## Objective

Make the attraction capability manifest describe every existing attraction
analytics surface before any MCP or agent gateway can execute reports. The
catalog must remain metadata-only and must not grant direct SQLite, Bitrix, raw
payload, contact, token, cookie, or filesystem access.

This plan does not implement MCP. It closes the catalog drift that would make an
agent gateway incomplete or force it to keep a hidden report allowlist.

## Current State

- `docs/architecture/module-capabilities.md` already defines the manifest as the
  AI-agent-safe read boundary.
- `apps/api/src/server/routes/attraction-routes.ts` exposes these analytics
  routes:
  - `/api/dashboard`
  - `/api/reports/source-quality-conversion`
  - `/api/reports/activities-workload`
  - `/api/reports/acquisition-outcomes`
  - `/api/reports/target-group-conversion`
  - `/api/reports/manager-action-outcomes`
  - `/api/reports/calls-workload`
  - `/api/reports/conversion-events`
  - `/api/reports/cohort-conversion`
  - `/api/reports/toc-flow`
  - `/api/reports/revenue-velocity`
  - `/api/reports/unit-economics`
- `createAttractionCapabilityManifest()` currently describes only six report
  routes and marks `unit-economics` as `agentReadable: false`.
- The missing manifest descriptors make a future agent layer choose between an
  incomplete catalog and unsafe duplicated routing knowledge.

## Pre-Implementation Code Review Gate

Before editing implementation files, run a short review pass with a fresh
reviewer context or the `reviewer` role:

1. Confirm the live route inventory against `attraction-routes.ts` and
   `ReportingService`.
2. Confirm every proposed manifest descriptor has an existing service method or
   is intentionally `planned`.
3. Confirm no proposed descriptor needs raw deal titles, contact fields, raw
   Bitrix payloads, direct Bitrix reads, arbitrary SQL, secrets, cookies, or
   filesystem access.
4. Confirm `unit-economics` and `revenue-velocity` are treated as
   privacy-sensitive financial analytics. They may be cataloged, but execution
   by agents must be allowed only after explicit safe-output review.
5. Stop if the reviewer finds that any route can return forbidden fields or raw
   personal data.

Record the review result in the branch notes, PR description, or issue before
implementation starts.

## Scope

In scope:

- `apps/api/src/server/module-capabilities.ts`
- `apps/api/test/module-capabilities.test.ts`
- `apps/api/test/http.test.ts` only if HTTP manifest expectations must change
- `docs/architecture/module-capabilities.md`
- `docs/modules/attraction/REPORT_REGISTRY.md`
- `plans/README.md`

Out of scope:

- MCP server code.
- Agent runtime, prompts, LLM orchestration, or SDK dependencies.
- New report calculations.
- New report filters not already supported by the service.
- Direct SQLite, direct Bitrix, sync, settings writes, comments, or production
  data changes.

## Implementation Loop

1. Add the missing attraction report descriptors to
   `createAttractionCapabilityManifest()`:
   - `dashboard`
   - `manager-action-outcomes`
   - `conversion-events`
   - `cohort-conversion`
   - `toc-flow`
   - `revenue-velocity`
2. Extend `AttractionCapabilityService` and
   `attractionCapabilityReportAvailability` for the matching service methods:
   - `getDashboard`
   - `getManagerActionOutcomeReport`
   - `getConversionEventsReport`
   - `getCohortConversionReport`
   - `getTocFlowReport`
   - `getRevenueVelocityReport`
3. Keep `unit-economics` cataloged. Do not flip it to
   `agentReadable: true` unless the same branch adds focused tests proving the
   output is aggregate, PII-free, and compatible with the manifest data policy.
4. Decide whether `revenue-velocity` is `agentReadable: true` or `false` based
   on the same output-safety review. If in doubt, keep it visible but not
   executable by agents.
5. Add a route parity test: every existing attraction analytics route listed
   above has exactly one manifest descriptor.
6. Add an availability test: a descriptor is `available` only when the narrow
   capability service exposes the backing method.
7. Add or extend unsafe metadata tests so the full manifest still rejects
   SQLite/Bitrix implementation details and forbidden personal fields.
8. Update report registry or architecture docs with the agent-readable catalog
   rule.

## Post-Implementation Code Review Gate

Before marking this plan done, run a final review pass:

1. Review the full diff, not only test output.
2. Verify route parity, service-method parity, and manifest status semantics.
3. Verify `agentReadable` decisions are documented and tested.
4. Verify no implementation detail below the module capability boundary leaked
   into contracts, docs, or test fixtures.
5. Verify the review found no hidden report allowlist that would later bypass
   the manifest.

Do not mark the plan done until all review findings are fixed or explicitly
deferred with a reason and owner.

## Verification

Run from a clean `codex/*` branch:

- `pnpm session:preflight`
- `pnpm ontology:validate`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts -t "capability"`
- `pnpm --filter @bitrix24-reporting/api typecheck`

Use Node `>=24 <25` and pnpm `>=10 <11`. If the local runtime is older, record
that limitation and run verification in a matching runtime before PR.

## STOP Conditions

- A report route requires raw deal names, contact personal data, raw Bitrix
  payloads, direct Bitrix calls, or arbitrary SQLite access.
- The route inventory and service methods disagree in a way that cannot be
  represented as `planned`.
- A reviewer cannot determine whether `unit-economics` or `revenue-velocity`
  output is safe for agent execution.
- The implementation needs MCP, LLM, prompt, or transport code.

## Done Criteria

- The attraction manifest describes every existing attraction analytics route.
- The manifest remains metadata-only.
- Agent-readable decisions are explicit and tested.
- Focused verification passes.
- Pre- and post-implementation review gates are recorded.
