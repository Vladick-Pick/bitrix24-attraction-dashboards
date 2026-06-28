# Plan 015: Record the call enrichment writeback security contract

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- README.md SECURITY.md AGENTS.md docs/architecture/agent-mcp.md docs/architecture/module-capabilities.md docs/adr docs/modules/attraction/MODULE_ONTOLOGY.md plans/README.md`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The repository currently has an explicit read-only Bitrix security model for
reporting. The new feature needs a narrow, manager-approved CRM write path after
call analysis. Without a recorded decision, later implementation can either
violate the existing security contract silently or overcorrect by making a
generic CRM editor. This plan creates the governance boundary before code.

## Current state

Relevant files:

- `README.md` - states the current product and security model.
- `SECURITY.md` - lists allowed/forbidden Bitrix methods and fields.
- `docs/architecture/agent-mcp.md` - says agent integrations are read-only.
- `docs/architecture/module-capabilities.md` - says future AI-agent work must
  use safe boundaries and must not receive direct Bitrix clients/webhooks.
- `docs/adr/0001-separate-attraction-and-leadgen-products.md` - keeps module
  ownership explicit.
- `docs/modules/attraction/MODULE_ONTOLOGY.md` - defines attraction module
  scope, candidate/deal vocabulary, and privacy exclusions.

Current excerpts:

- `SECURITY.md:3-24` allows read/list methods and forbids
  `crm.contact.update`, any `*.update`, `crm.deal.get`, and `crm.item.get`.
- `SECURITY.md:26-40` allows contact `ID` plus target-group enum fields only,
  forbids `PHONE`, `EMAIL`, names, `COMMENTS`, and any `UF_*`.
- `README.md:9-18` says runtime Bitrix allowlist is read-only, contact reads are
  minimal, write/delete methods are forbidden, and raw `UF_*` payloads are not
  stored.
- `docs/architecture/agent-mcp.md:5-13` exposes only a read-only MCP surface;
  write tools and direct Bitrix access are out of scope.
- `docs/architecture/module-capabilities.md:55-72` requires future AI-agent work
  to consume safe surfaces and not receive direct Bitrix clients, raw payloads,
  deal names, contact names, phones, emails, filesystem, token, cookie, or secret
  access.
- `docs/adr/0001-separate-attraction-and-leadgen-products.md:17-24` says future
  automation must use explicit module capabilities and safe read models rather
  than bypassing module ownership.

Feature decision already confirmed by product owner:

- Do not notify the manager when no live dialogue happened.
- Do not notify the manager when no meaningful CRM field update exists.
- Telegram V1 is one batch per call, buttons per proposal, no manual text edit.
- Pending proposals expire after 48 hours; no auto-write.
- `Связи и знакомства внутри клуба` and `Ключевые проекты` are deal fields.
- All other agreed enrichment fields are contact fields.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Ontology/docs guard | `pnpm ontology:validate` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| Workspace lint | `pnpm lint` | exits 0 |

Use Node 24 and pnpm 10.9.0, as required by root `package.json`.

## Scope

**In scope**:

- `SECURITY.md`
- `README.md`
- `docs/adr/0002-manager-approved-call-enrichment-writeback.md` (create)
- `docs/architecture/module-capabilities.md`
- `docs/architecture/agent-mcp.md`
- `docs/modules/attraction/MODULE_ONTOLOGY.md` only if a short status note is
  needed to link the ADR
- `plans/README.md`

**Out of scope**:

- Any TypeScript source code.
- Any Bitrix method allowlist code.
- Any Telegram or OpenRouter implementation.
- Any database migration.
- Leadgen module behavior.

## Git workflow

- Start from updated `main` on `codex/call-enrichment-security-contract`.
- If the worktree is dirty before you start, STOP and ask the operator to
  preserve unrelated WIP.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add ADR 0002

Create `docs/adr/0002-manager-approved-call-enrichment-writeback.md` with:

- Status: Proposed or Accepted, depending on reviewer preference.
- Context: current repo is read-only for Bitrix reporting; this feature is a
  manager-approved CRM enrichment workflow after analyzed calls.
- Options:
  - keep strict read-only and do no writeback;
  - build a generic CRM field editor;
  - build a narrow proposal-approved write adapter.
- Decision: narrow proposal-approved write adapter.
- Consequences:
  - allowlist is required;
  - LLM output never writes directly;
  - Telegram click is required;
  - proposal expires after 48 hours;
  - no notification on no-dialogue/no-op;
  - audit event is mandatory for every state change;
  - MCP and reporting surfaces remain read-only.
- Revisit conditions:
  - after pilot writeback incidents;
  - if more CRM fields are requested;
  - if Telegram manual editing is added;
  - if another module wants the same capability.

**Verify**: `test -f docs/adr/0002-manager-approved-call-enrichment-writeback.md` -> exit 0.

### Step 2: Update `SECURITY.md`

Add a new section such as `Manager-approved call enrichment writeback`.

State that the old reporting path stays read-only, but the enrichment subsystem
may call only:

- `crm.contact.update` for the agreed contact field allowlist;
- `crm.deal.update` for the agreed deal field allowlist.

State that this exception is valid only when all are true:

- a call analysis/enrichment proposal exists in local SQLite;
- the proposal belongs to the manager receiving the Telegram action;
- the proposal is not expired;
- the target field is in the entity-specific allowlist;
- the proposed normalized value was produced by the enrichment validator;
- the current Bitrix value is re-read immediately before write;
- the manager clicked `Записать` or `Перезаписать`.

Keep forbidden:

- generic `crm.*.update`;
- direct LLM-specified method names;
- update/add/delete for fields outside the allowlist;
- phone/email/name/comments/company/address/multifields;
- transcript dumping into Telegram or logs.

**Verify**: `rg -n "Manager-approved call enrichment|crm.contact.update|crm.deal.update|generic crm" SECURITY.md` -> finds the new section and the narrow-method warning.

### Step 3: Update read-only architecture docs without weakening them

In `docs/architecture/agent-mcp.md`, add a short note: MCP remains read-only and
does not expose enrichment writeback. The writeback lives behind the local API
and Telegram manager approval, not the agent gateway.

In `docs/architecture/module-capabilities.md`, add a short note: a future module
can declare enrichment writeback only as an explicit destructive capability, but
the current module capability manifest remains metadata/read-safe.

**Verify**: `rg -n "enrichment|writeback|read-only" docs/architecture/agent-mcp.md docs/architecture/module-capabilities.md` -> finds both notes.

### Step 4: Add a short README warning

Update `README.md` security section to say the default reporting/sync surfaces
remain read-only, while the call enrichment feature introduces a separately
guarded manager-approved writeback path described in `SECURITY.md` and ADR 0002.

**Verify**: `rg -n "call enrichment|manager-approved|writeback" README.md` -> finds the warning.

### Step 5: Run docs verification

Run:

```bash
pnpm ontology:validate
pnpm --filter @bitrix24-reporting/api typecheck
pnpm lint
```

Expected result: all exit 0. If lint fails only because markdown line length is
not enforced here, still fix obvious markdown formatting before reporting.

## Test plan

This plan is documentation-only, but it blocks all code plans. The executable
checks are:

- `pnpm ontology:validate`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm lint`

No new unit tests are required in this plan; Plan 016 adds code-level allowlist
tests.

## Done criteria

- [ ] ADR 0002 exists and records the narrow writeback decision.
- [ ] `SECURITY.md` keeps the existing read-only reporting model and adds only a
  narrow enrichment exception.
- [ ] MCP docs still say MCP exposes no write tools.
- [ ] README points to the new exception instead of implying all Bitrix access is
  read-only.
- [ ] Verification commands above exit 0.
- [ ] Only in-scope docs and `plans/README.md` are modified.

## STOP conditions

Stop and report if:

- The reviewer wants a generic CRM editor; that contradicts the accepted V1
  product boundary.
- Security review requires no Bitrix writeback at all; subsequent implementation
  plans must be revised.
- You need to inspect or print secrets from `.env`.
- Any source code change appears necessary for this plan.

## Maintenance notes

Reviewers should check that this plan does not normalize broad CRM writes. The
future code must make the safe path easier than the unsafe path: LLM output
creates candidates, candidates create proposals, manager action creates a
server-side apply request, and only then can Bitrix update happen.

