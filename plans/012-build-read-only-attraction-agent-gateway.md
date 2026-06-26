# Plan 012: Build Read-Only Attraction Agent Gateway

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/011-complete-agent-readable-report-catalog.md
- **Category**: agent boundary
- **Status**: DONE
- **Planned at**: commit `8712892`, 2026-06-25

## Execution Notes

- 2026-06-25 pre-implementation gate: `pnpm session:preflight --allow-dirty`
  passed on `codex/agent-mcp-plans`; dirty files are the active Plan 011/012
  changes.
- 2026-06-25 CRG gate: checked the registered repository graph with
  `get_minimal_context_tool`; reported low risk and expected reporting flows.
- 2026-06-25 pre-implementation review: Plan 011 is DONE. Gateway design will
  accept only a safe report service, the capability manifest, ontology reader,
  and playbook reader. It must not import `SqliteRepository`, `BitrixClient`,
  Express app/server internals, auth cookies, secrets, sync clients, production
  paths, MCP SDK, or LLM provider code. Report execution must be gated by
  `status === "available"` and `agentReadable === true`. Playbook parsing will
  start with standard-library/string parsing and no new dependency.
- 2026-06-25 RED: `pnpm --filter @bitrix24-reporting/api exec vitest run
  test/playbook-reader.test.ts test/attraction-agent-gateway.test.ts` failed
  because `src/agent/playbook-reader` and `src/agent/attraction-agent-gateway`
  did not exist.
- 2026-06-25 GREEN verification passed:
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/playbook-reader.test.ts test/attraction-agent-gateway.test.ts`
  - `pnpm --filter @bitrix24-reporting/api exec vitest run test/attraction-ontology.test.ts test/module-capabilities.test.ts`
  - `pnpm --filter @bitrix24-reporting/api typecheck`
  - `pnpm --filter @bitrix24-reporting/api lint`
  - `git diff --check`
- 2026-06-25 post-implementation review: CRG review context reported low risk.
  Gateway imports are limited to contracts, `zod`, the playbook reader, and Node
  file/path helpers for the playbook allowlist. No `SqliteRepository`,
  `BitrixClient`, Express app/server, MCP SDK, sync client, cookie, token,
  secret, webhook, or write path was introduced. Tests cover allowed report
  execution, non-agent-readable denial, unavailable denial, invalid input,
  ontology source allowlist errors, prompt-injection-as-data, playbook parsing,
  and output truncation. All findings closed.

## Objective

Create a small read-only application gateway that exposes ontology, KI playbook,
report catalog, and safe report execution to future MCP tools. The gateway must
be testable without MCP SDK, Express, LLM calls, or direct database access.

This is the layer that makes the later MCP server simple: MCP should translate
tool/resource calls into this gateway, not reimplement report, ontology, or
playbook logic.

## Current State

- Ontology loading already exists in `apps/api/src/domain/attraction-ontology.ts`
  with registry reading, drift generation, and local markdown source allowlist.
- KI playbook source lives in
  `docs/modules/attraction/playbook/playbook-ki.html`. It has tab buttons,
  panel sections, and a `DATA` catalog for conversion event formats.
- Report execution already exists behind `ReportingService`.
- Module capabilities already define which reports and safe read models are
  agent-readable.
- There is no single read-only service that an MCP server can safely expose.

## Pre-Implementation Code Review Gate

Before editing gateway code, run a short review pass with a fresh reviewer
context or the `reviewer` role:

1. Confirm Plan 011 is complete or re-read the live manifest and explicitly
   account for any missing descriptors.
2. Confirm the gateway constructor receives only safe dependencies:
   `ReportingService`, capability registry/manifest, ontology reader, and a
   playbook file reader.
3. Confirm the gateway will not import `SqliteRepository`, `BitrixClient`,
   Express `app`, auth cookies, secrets, sync clients, or production paths.
4. Confirm report execution is gated by manifest `status === "available"` and
   `agentReadable === true`.
5. Confirm playbook parsing can be done with standard library/string parsing
   before adding dependencies such as `cheerio` or `jsdom`.

Stop if the proposed design requires lower-level storage or CRM access.

## Scope

In scope:

- `apps/api/src/agent/attraction-agent-gateway.ts`
- `apps/api/src/agent/playbook-reader.ts`
- `apps/api/test/attraction-agent-gateway.test.ts`
- `apps/api/test/playbook-reader.test.ts`
- Minimal supporting types in the API package when needed.

Out of scope:

- MCP SDK imports or server registration.
- HTTP transport, auth tokens, remote access, or deployment.
- Writes, sync, settings, comments, call-analysis queue, or Paperclip actions.
- New playbook content.
- New report calculations.
- New package dependencies unless the dependency-free parser fails focused
  tests and the reviewer approves the dependency.

## Gateway Contract

Expose a narrow TypeScript API similar to:

```ts
export interface AttractionAgentGateway {
  getOntologyOverview(): Promise<unknown>;
  listOntologySources(): Promise<unknown>;
  readOntologySource(input: { sourceId: string }): Promise<unknown>;
  searchOntology(input: { query: string; limit?: number }): Promise<unknown>;
  listPlaybookSections(): Promise<unknown>;
  readPlaybookSection(input: { sectionId: string }): Promise<unknown>;
  searchPlaybook(input: { query: string; limit?: number }): Promise<unknown>;
  listReports(): Promise<unknown>;
  runReport(input: AttractionAgentReportRequest): Promise<unknown>;
}
```

Prefer precise local types as implementation clarifies. Keep outputs serializable
and bounded.

## Implementation Loop

1. Add `playbook-reader.ts`:
   - read the local `playbook-ki.html`;
   - extract tab labels from `button.tab[data-t]`;
   - extract matching `section.panel` HTML by id;
   - strip tags/entities into a text field for search;
   - preserve `sectionId`, `label`, `html`, and `text`;
   - expose search with deterministic ordering and a small default limit.
2. Add `attraction-agent-gateway.ts`:
   - wrap existing ontology methods;
   - search ontology concepts, transitions, report bindings, source labels, and
     readable local source documents;
   - list report descriptors from the attraction manifest;
   - run only available and agent-readable reports;
   - map report ids to existing `ReportingService` methods;
   - accept existing date range, compare range, manager/source/customer/quality
     filters, and report-specific options where already supported.
3. Validate inputs with `zod` or local narrow validators already used by the API.
4. Add output bounds:
   - default search limit;
   - maximum search limit;
   - report result truncation or compact summary when a result is too large;
   - `truncated: true` metadata when data is omitted.
5. Treat ontology and playbook text as untrusted data. Do not allow source
   content to change gateway instructions or policy.
6. Add focused tests with fake services:
   - ontology source allowlist errors are preserved;
   - playbook sections/search work for current HTML;
   - unavailable reports are denied;
   - non-agent-readable reports are denied;
   - manager filters pass only through existing report filter fields;
   - no test imports `SqliteRepository`, `BitrixClient`, or Express app.

## Post-Implementation Code Review Gate

Before marking this plan done, run a final review pass:

1. Review gateway imports and constructor dependencies for boundary violations.
2. Review every `runReport` branch against manifest ids and service methods.
3. Review truncation and validation behavior for large or malformed inputs.
4. Review playbook parsing for fragile assumptions and no new dependency creep.
5. Review tests to ensure they prove denial paths, not only happy paths.

Do not mark the plan done until all review findings are fixed or explicitly
deferred with a reason and owner.

## Verification

Run from a clean `codex/*` branch:

- `pnpm session:preflight`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/playbook-reader.test.ts test/attraction-agent-gateway.test.ts`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/attraction-ontology.test.ts test/module-capabilities.test.ts`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api lint`

Use Node `>=24 <25` and pnpm `>=10 <11`.

## STOP Conditions

- The gateway needs raw SQLite, direct Bitrix, Express internals, cookies,
  secrets, filesystem browsing beyond the playbook/ontology allowlist, or sync.
- A report cannot be executed through `ReportingService`.
- A report is missing from the capability manifest after Plan 011.
- Playbook parsing requires a broad HTML runtime dependency without reviewer
  approval.
- Outputs cannot be bounded without changing report contracts.

## Done Criteria

- Gateway exposes ontology, playbook, report catalog, and safe report execution.
- Gateway is read-only and dependency-light.
- Unit tests cover both allowed and denied paths.
- Focused verification passes.
- Pre- and post-implementation review gates are recorded.
