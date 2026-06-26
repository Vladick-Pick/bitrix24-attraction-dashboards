# Plan 013: Add Stdio MCP Server And Agent Evals

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**:
  - plans/011-complete-agent-readable-report-catalog.md
  - plans/012-build-read-only-attraction-agent-gateway.md
- **Category**: agent integration
- **Status**: DONE
- **Planned at**: commit `8712892`, 2026-06-25

## Objective

Expose the read-only attraction agent gateway as a local stdio MCP server so any
agent host that can spawn a process can read ontology, read/search the KI
playbook, list analytics reports, and run approved safe reports.

V1 is local stdio only. Remote Streamable HTTP, auth tokens, write tools,
dashboard comments, sync operations, and production deployment are explicit
future work.

## Current State

- The repository has `zod` and `tsx` in the API package.
- The lockfile currently contains `@modelcontextprotocol/sdk`, but
  `apps/api/package.json` does not declare it as a direct dependency.
- MCP TypeScript SDK imports and package paths have changed across versions, so
  the executor must verify current official docs before writing code.
- Plans 011 and 012 are required so MCP stays a thin protocol adapter over a
  tested read-only gateway.

## Pre-Implementation Code Review Gate

Before editing MCP code, run a short review pass with a fresh reviewer context
or the `reviewer` role:

1. Confirm Plans 011 and 012 are complete and reviewed.
2. Confirm Context7 or official MCP TypeScript SDK docs were checked for the
   current package name, import paths, server API, resource API, tool API, and
   stdio transport.
3. Confirm `@modelcontextprotocol/sdk` is declared as a direct dependency of the
   package that imports it.
4. Confirm the MCP server imports the gateway, not `SqliteRepository`,
   `BitrixClient`, Express app, sync clients, auth cookies, or production
   secrets.
5. Confirm the MCP server exposes read-only resources/tools only.
6. Confirm prompt-injection text in ontology or playbook content is treated as
   data and cannot alter server policy.

Stop if the implementation requires remote HTTP, tokens, writes, sync, or raw
database access.

## Scope

In scope:

- `apps/api/package.json`
- `pnpm-lock.yaml`
- `apps/api/src/agent/mcp-server.ts`
- `apps/api/src/tools/agent-mcp.ts`
- `apps/api/test/agent-mcp-server.test.ts`
- `docs/architecture/agent-mcp.md`
- `plans/README.md`

Out of scope:

- Streamable HTTP transport.
- Remote hosting or production deployment.
- Authentication token design.
- Write tools, sync tools, settings tools, dashboard comment tools, or
  Paperclip orchestration.
- LLM provider SDKs or prompts beyond MCP tool descriptions and server
  instructions.

## MCP Surface

Resources:

- `attraction://ontology/overview`
- `attraction://ontology/sources`
- `attraction://ontology/sources/{sourceId}`
- `attraction://playbook/sections`
- `attraction://playbook/sections/{sectionId}`
- `attraction://reports/catalog`
- `attraction://capabilities`

Tools:

- `search_ontology`
- `read_ontology_source`
- `search_playbook`
- `read_playbook_section`
- `list_reports`
- `run_report`

Tool outputs must be compact, serializable, and bounded. Prefer
`structuredContent` for machine-readable data plus short text summaries for
agent UX.

## Implementation Loop

1. Verify current MCP TypeScript SDK docs:
   - package name;
   - `McpServer` import path;
   - `StdioServerTransport` import path;
   - resource registration API;
   - tool registration API;
   - supported `structuredContent` shape.
2. Add the direct SDK dependency to `apps/api/package.json` and update the
   lockfile with pnpm.
3. Add `createAttractionMcpServer(gateway)`:
   - register resources listed above;
   - register tools listed above;
   - validate tool input with `zod`;
   - convert gateway errors into MCP tool errors without leaking internals;
   - include server instructions that restate data boundaries.
4. Add `apps/api/src/tools/agent-mcp.ts`:
   - load environment/config using existing API conventions;
   - construct the read-only gateway without starting Express;
   - do not run sync recovery or mutate data;
   - connect the server to stdio transport.
5. Add an API script such as:
   - `"mcp:attraction": "tsx src/tools/agent-mcp.ts"`
6. Add tests with a fake gateway:
   - all resources call the expected gateway method;
   - invalid tool arguments are rejected;
   - unavailable/non-agent-readable report errors are returned safely;
   - prompt-injection strings in source/playbook content are returned as data;
   - outputs are truncated or bounded.
7. Add `docs/architecture/agent-mcp.md`:
   - how to run locally;
   - what tools/resources exist;
   - privacy/data boundaries;
   - why V1 is stdio-only;
   - future conditions for Streamable HTTP.

## Post-Implementation Code Review Gate

Before marking this plan done, run a final review pass:

1. Review dependency changes and lockfile scope.
2. Review MCP imports against official docs and local typecheck.
3. Review all registered tools/resources for read-only behavior.
4. Review startup code for accidental Express server start, sync, writes, or
   secret printing.
5. Review error paths for leaks of file paths, SQL, tokens, raw payloads, or
   personal data.
6. Review eval tests for prompt-injection and denial paths.

Do not mark the plan done until all review findings are fixed or explicitly
deferred with a reason and owner.

## Verification

Run from a clean `codex/*` branch:

- `pnpm session:preflight`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/agent-mcp-server.test.ts test/attraction-agent-gateway.test.ts test/playbook-reader.test.ts`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api lint`
- Manual smoke: start the stdio command through an MCP inspector or a minimal
  local MCP client and call `list_reports`, `search_ontology`, and
  `read_playbook_section`.

Use Node `>=24 <25` and pnpm `>=10 <11`.

## STOP Conditions

- Context7 and official docs cannot confirm the SDK API/imports.
- The MCP server needs direct SQLite, Bitrix, Express app internals, sync,
  cookies, tokens, raw payloads, or write operations.
- A report tool must bypass the gateway or manifest gate.
- Stdio smoke cannot prove the server starts without mutating data.
- Output bounding cannot be enforced.

## Done Criteria

- Local stdio MCP server starts and exposes the documented resources/tools.
- MCP remains a thin adapter over the reviewed gateway.
- Agent-visible tools are read-only and bounded.
- Focused tests, typecheck, lint, and stdio smoke pass.
- Pre- and post-implementation review gates are recorded.

## Execution Notes

### Pre-Implementation Review Gate

- Session gate: `npx -y pnpm@10.9.0 session:preflight --allow-dirty`
  passed on `codex/agent-mcp-plans`; local runtime warned that Node is
  `v20.17.0` while the repository target is `>=24 <25`.
- CRG gate: `get_minimal_context_tool` for Plan 013 returned low risk
  (`3035 nodes`, `40170 edges`) with affected flows limited to existing report
  readers; `get_review_context_tool` also returned low risk for the planned MCP
  files.
- Plans 011 and 012 are marked DONE in `plans/README.md` and have focused tests
  passing from their execution notes.
- MCP TypeScript SDK docs check: Context7 lookup failed with `fetch failed`;
  official MCP TypeScript SDK docs and local installed SDK types were checked.
  The official docs describe v2 as pre-alpha and recommend v1.x for production;
  this branch uses direct dependency `@modelcontextprotocol/sdk@1.29.0`.
- Local SDK types confirmed imports:
  `@modelcontextprotocol/sdk/server/mcp.js`,
  `@modelcontextprotocol/sdk/server/stdio.js`,
  `@modelcontextprotocol/sdk/client/index.js`, and
  `@modelcontextprotocol/sdk/inMemory.js`.
- Boundary decision: `mcp-server.ts` must import only the gateway contract,
  MCP SDK, and validation helpers. Runtime bootstrap may construct existing
  service dependencies, but no MCP tool may expose writes, sync, raw SQLite,
  direct Bitrix, Express, cookies, tokens, or production secrets.

### RED

- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/agent-mcp-server.test.ts`
  failed as expected because `../src/agent/mcp-server` did not exist.

### GREEN

- Added `apps/api/src/agent/mcp-server.ts` as a thin read-only MCP adapter over
  the attraction agent gateway.
- Added `apps/api/src/tools/agent-mcp.ts` as the local stdio bootstrap without
  Express startup, sync recovery, auto-sync, auth, Paperclip, Telegram, or write
  tools.
- Added `apps/api/test/agent-mcp-server.test.ts` covering resources, templates,
  read-only tool annotations, structured results, prompt-injection-as-data,
  invalid args, denied reports, outside source denial, and truncation.
- Added `docs/architecture/agent-mcp.md` with run command, resources, tools,
  boundaries, and future HTTP conditions.

### Verification

- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/agent-mcp-server.test.ts test/attraction-agent-gateway.test.ts test/playbook-reader.test.ts`
  passed.
- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/agent-mcp-server.test.ts test/attraction-agent-gateway.test.ts test/playbook-reader.test.ts test/attraction-ontology.test.ts`
  passed.
- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api typecheck` passed.
- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api lint` passed.
- `npx -y pnpm@10.9.0 ontology:validate` passed.
- `npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts test/http.test.ts -t "capability"`
  passed.
- `npx -y pnpm@10.9.0 typecheck` passed.
- `npx -y pnpm@10.9.0 lint` passed.
- `git diff --check` passed.

All commands were run on local Node `v20.17.0`, which emits the repository
engine warning because the target runtime is Node `>=24 <25`.

### Stdio E2E Smoke

Minimal MCP client over `StdioClientTransport` spawned:

```bash
npx -y pnpm@10.9.0 --filter @bitrix24-reporting/api mcp:attraction
```

The smoke passed:

- listed all six tools and the static resources;
- `list_reports` returned 12 report descriptors;
- `search_ontology` returned ontology matches;
- `read_ontology_source` read `module_ontology`;
- `search_playbook` and `read_playbook_section` read KI playbook section `t5`;
- `run_report` executed `dashboard` with manager/date/source filters;
- `unit-economics` returned `REPORT_NOT_AGENT_READABLE`;
- unknown/unavailable report returned `REPORT_NOT_FOUND`;
- outside source returned `SOURCE_NOT_FOUND`;
- invalid args were rejected by SDK validation;
- `source-quality-conversion` with `maxBytes: 64` returned `truncated: true`.

The smoke-created ignored runtime DB under `apps/api/data` was removed after the
run.

### Post-Implementation Review Gate

- CRG `get_review_context_tool` and `detect_changes_tool` both reported low /
  zero risk for the MCP adapter files.
- Import review confirmed `mcp-server.ts` imports only contract types, MCP SDK,
  zod, and gateway/playbook types. It does not import SQLite, Bitrix, Express,
  sync, auth, Paperclip, Telegram, cookies, or secrets.
- Bootstrap review confirmed `agent-mcp.ts` constructs the existing reporting
  service for read access only and does not start Express, run sync recovery,
  register write tools, or print secrets.
- Tool/resource review confirmed every tool is read-only annotated and calls
  gateway methods; report execution goes through the existing manifest-gated
  gateway.
- Error review confirmed expected gateway/ontology/playbook denial codes are
  exposed without file paths, SQL, tokens, raw payloads, or personal data.
