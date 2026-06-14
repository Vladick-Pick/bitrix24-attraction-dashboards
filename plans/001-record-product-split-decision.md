# Plan 001: Record the product split decision

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 5a2884f..HEAD -- AGENTS.md design.md docs/modules/README.md docs/modules/attraction/MODULE_ONTOLOGY.md docs/modules/leadgen/MODULE_ONTOLOGY.md .github/ISSUE_TEMPLATE/task.md .github/pull_request_template.md docs/adr CONTEXT-MAP.md plans/001-record-product-split-decision.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code/docs before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `5a2884f`, 2026-06-14

## Why This Matters

The project already contains two module ontologies and issue/PR labels for
shared/platform work, but the hard product decision is not recorded in one
place. Without that decision, future agents can keep reintroducing a single
combined dashboard product instead of a narrow shared platform with two
module-owned products. This plan creates the decision record that plans 002 and
003 must obey.

## Current State

- `AGENTS.md` is the repository-wide operating contract.
- `design.md` is the shared dashboard design contract.
- `.github/ISSUE_TEMPLATE/task.md` and `.github/pull_request_template.md`
  already recognize `shared/platform`.
- `docs/modules/leadgen/MODULE_ONTOLOGY.md` explicitly says leadgen has its own
  dashboard interface and report registry.
- `docs/modules/attraction/MODULE_ONTOLOGY.md` is the current attraction module
  contract.
- There is no `docs/adr/` directory and no root `CONTEXT-MAP.md` at commit
  `5a2884f`.

Relevant excerpts:

```text
AGENTS.md:75-80
- Every business module must have `docs/modules/<module-key>/MODULE_ONTOLOGY.md`
  before broad automation or Paperclip delegation.
- Module ontology must define entities, roles, states, data scope, report
  ownership, access boundaries, and privacy exclusions.
- V1 module is `attraction`; use `docs/modules/attraction/MODULE_ONTOLOGY.md`
  as the current module contract.
- Future modules may have different dashboard interfaces. Do not force new
  modules into the attraction UI if their workflow, metrics, or roles differ.
- Shared platform changes must state which modules and roles they affect and how
  attraction behavior remains protected.
```

```text
design.md:1-4
This file is the shared UI contract for every dashboard module in this
repository. Module reports may differ by workflow and metrics, but they must not
invent a separate visual language unless a reviewed shared/platform issue
explicitly changes the product design system.
```

```text
design.md:75-95
Shared UI:
- app shell;
- module switcher;
- account/admin screens;
- filters panel;
- comments drawer and comment mode affordances;
- notification controls;
- buttons, inputs, badges, metrics, panels, tables.

Module-owned UI:
- report registry;
- report section ordering;
- report copy;
- comment block ids and labels;
- module-specific empty states and warnings.
```

```text
docs/modules/leadgen/MODULE_ONTOLOGY.md:13-16
The leadgen module helps module users inspect lead generation performance for
deals that belong only to the Bitrix24 funnel `Лидген УС`.

The module has its own dashboard interface, report registry, Paperclip context,
and manager whitelist. It must not reuse attraction-only assumptions unless a
shared platform issue explicitly allows that behavior.
```

```text
.github/ISSUE_TEMPLATE/task.md:12-21
## Module
- [ ] `attraction`
- [ ] `leadgen`
- [ ] shared/platform

Apply exactly one module label:
- `module:attraction`
- `module:leadgen`
- `module:shared-platform`
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| Ontology docs | `pnpm ontology:validate` | exit 0, `Attraction ontology registry valid` |
| Docs grep | `rg -n "shared/platform|module:shared-platform|leadgen|attraction" docs .github AGENTS.md design.md` | finds the expected docs references |

## Scope

**In scope**:

- `docs/adr/0001-separate-attraction-and-leadgen-products.md` (create)
- `CONTEXT-MAP.md` (create)
- `docs/modules/README.md` (update only if needed to point to the context map)
- `plans/README.md` (status update only when done)

**Out of scope**:

- Any source code under `apps/` or `packages/`
- Any change to module ontology facts, Bitrix stage IDs, manager whitelists, or
  report registry content
- Any GitHub issue publication unless the operator explicitly asks for it

## Git Workflow

- Branch: `codex/platform-product-split-decision`
- Start from the current local `main`, which includes commit `5a2884f`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested: `docs: record platform product split decision`

## Steps

### Step 1: Create the ADR directory and decision record

Create `docs/adr/0001-separate-attraction-and-leadgen-products.md`.

Use this structure:

```markdown
# ADR 0001: Separate attraction and leadgen as products

## Status

Accepted

## Context

- `attraction` and `leadgen` have separate module ontologies.
- `leadgen` owns its report registry, dashboard interface, Paperclip context, and
  manager whitelist.
- The shared design contract keeps shell/control/component language common, but
  module reports remain module-owned.
- The project will be split into two repositories only after platform seams are
  explicit enough to avoid copying hidden coupling.

## Decision

Treat `attraction` and `leadgen` as separate products. Keep shared/platform
narrow: auth, RBAC, module membership, dashboard comments, Paperclip routing
primitives, safe local snapshot primitives, contracts/tooling needed by both
products, and shared UI primitives.

Do not put module-owned report logic, report registry, ontology, manager
whitelist, sync policy, screen copy, or module-specific dashboard layout into the
shared platform.

## Consequences

- Shared/platform changes must list which modules and roles they affect.
- Module-owned work must not change the other product unless explicitly marked
  shared/platform.
- Repository extraction should happen after storage, route, sync, and web runtime
  seams are visible.
```

Keep the ADR concise. Do not include implementation steps beyond consequences.

**Verify**: `test -f docs/adr/0001-separate-attraction-and-leadgen-products.md`
exits 0.

### Step 2: Create the context map

Create root `CONTEXT-MAP.md`.

Required content:

- List `attraction` context pointing to
  `docs/modules/attraction/MODULE_ONTOLOGY.md`.
- List `leadgen` context pointing to `docs/modules/leadgen/MODULE_ONTOLOGY.md`.
- List `shared/platform` context pointing to the ADR and `design.md`.
- State relationships:
  - shared/platform provides auth, RBAC, module membership, comments, safe
    snapshot primitives, deployment/tooling, and shared UI primitives.
  - `attraction` and `leadgen` own their reports, report registry, ontology,
    manager whitelist, sync policy, and dashboard content.
  - `leadgen` must not reuse attraction-only assumptions unless a reviewed
    shared/platform issue explicitly allows it.

**Verify**:
`rg -n "attraction|leadgen|shared/platform|docs/adr/0001" CONTEXT-MAP.md`
prints matches for all four terms.

### Step 3: Link from module docs only if the link is missing

Open `docs/modules/README.md`. If it already describes the module map clearly,
do not change it. If it does not mention the context map, add one short sentence
near the top:

```markdown
For cross-module relationships and the shared/platform contract, see
[`CONTEXT-MAP.md`](../../CONTEXT-MAP.md).
```

Do not duplicate the ADR text in `docs/modules/README.md`.

**Verify**:
`rg -n "CONTEXT-MAP|shared/platform" docs/modules/README.md CONTEXT-MAP.md`
prints the expected references.

### Step 4: Run docs verification

Run:

```bash
pnpm ontology:validate
```

Expected result: exit 0 and output includes `Attraction ontology registry valid`.

Then run:

```bash
git diff --check
```

Expected result: exit 0 with no whitespace errors.

## Test Plan

No unit tests are needed; this is a docs-only decision plan.

Run:

- `pnpm ontology:validate`
- `git diff --check`

## Done Criteria

- [ ] `docs/adr/0001-separate-attraction-and-leadgen-products.md` exists.
- [ ] `CONTEXT-MAP.md` exists and links `attraction`, `leadgen`, and
      `shared/platform`.
- [ ] No source files under `apps/` or `packages/` changed.
- [ ] `pnpm ontology:validate` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] `plans/README.md` row for plan 001 is updated.

## STOP Conditions

Stop and report back if:

- `docs/adr/` already exists with a contradictory ADR about modules or repository
  split.
- `CONTEXT-MAP.md` already exists and uses a different context structure.
- Updating the decision requires changing module ontology facts rather than only
  linking to them.
- Any step appears to require source code changes.

## Maintenance Notes

- Future platform-foundation plans should cite this ADR instead of restating the
  split rationale.
- Reviewers should reject shared/platform PRs that move report logic, ontology,
  manager whitelist policy, or module-specific dashboard copy into shared code.
