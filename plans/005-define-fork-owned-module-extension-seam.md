# Plan 005: Define fork-owned module extension seam

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat d3c9fe1..HEAD -- docs/architecture/module-capabilities.md packages/contracts/src/index.ts apps/api/src/server/app.ts apps/api/src/server/module-capabilities.ts apps/api/src/server/routes/platform-routes.ts apps/api/test/module-capabilities.test.ts apps/api/test/http.test.ts plans/004-define-module-capability-manifest-and-agent-data-boundary.md plans/005-define-fork-owned-module-extension-seam.md plans/README.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code/docs before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**:
  - `plans/001-record-product-split-decision.md`
  - `plans/002-split-sqlite-repository-roles.md`
  - `plans/003-extract-platform-and-module-route-registrars.md`
  - `plans/004-define-module-capability-manifest-and-agent-data-boundary.md`
- **Category**: platform
- **Planned at**: commit `d3c9fe1`, 2026-06-14

## Why This Matters

The open-source shape of this project should let a fork owner use vibe-coding to
connect their own CRM, source data, sync logic, and reports without rewriting the
shared/platform core. Plan 004 created the metadata contract, but live report
availability is still wired in `createApp` with attraction/leadgen-specific
tables. This plan creates a small extension seam: fork-owned modules bring a
capability adapter that declares manifest metadata and the live routes that are
available in that fork.

This does not implement a plugin marketplace, package loader, or real third
product module. It makes the source tree fork-friendly first, while leaving a
future package/plugin runtime possible.

## Current State

- `plans/004-define-module-capability-manifest-and-agent-data-boundary.md`
  defines the safe manifest and AI-agent data boundary.
- `packages/contracts/src/index.ts` has serializable manifest contracts:

```ts
// packages/contracts/src/index.ts:189-234
export type ModuleReportCapabilityStatus = "available" | "planned" | "disabled";

export interface ModuleReportCapability {
  id: string;
  title: string;
  description: string;
  route: string;
  inputSchemaId: string;
  outputSchemaId: string;
  status: ModuleReportCapabilityStatus;
  agentReadable: boolean;
}

export interface ModuleCapabilityManifest {
  moduleId: string;
  displayName: string;
  ontologyRef: string;
  reports: ModuleReportCapability[];
  safeReadModels: ModuleSafeReadModelCapability[];
  capabilities: ModuleCapabilityKind[];
  dataPolicy: ModuleDataPolicy;
}
```

- `apps/api/src/server/module-capabilities.ts` owns the registry and already
  prevents duplicate module IDs:

```ts
// apps/api/src/server/module-capabilities.ts:198-221
export function createModuleCapabilityRegistry(
  input: ModuleCapabilityRegistryInput = {}
): ModuleCapabilityRegistry {
  const availableReportRoutes = input.availableReportRoutes
    ? new Set(input.availableReportRoutes)
    : undefined;
  const manifests = [
    createAttractionCapabilityManifest(),
    createLeadgenCapabilityManifest(),
    ...(input.extraManifests ?? [])
  ].map((manifest) =>
    applyAvailableReportRoutes(manifest, availableReportRoutes)
  );
  const manifestsById = new Map<string, ModuleCapabilityManifest>();

  for (const manifest of manifests) {
    if (manifestsById.has(manifest.moduleId)) {
      throw new Error(
        `Duplicate module capability manifest for moduleId "${manifest.moduleId}"`
      );
    }

    manifestsById.set(manifest.moduleId, manifest);
  }
```

- `apps/api/src/server/app.ts` still computes live report availability with
  hardcoded attraction/leadgen tables:

```ts
// apps/api/src/server/app.ts:294-343
const attractionCapabilityReportAvailability = [
  {
    route: "/api/reports/source-quality-conversion",
    isAvailable: (service: AppService) =>
      typeof service.getSourceQualityConversionReport === "function"
  },
  // ...
];

const leadgenCapabilityReportAvailability = [
  {
    route: "/api/modules/leadgen/reports/funnel",
    isAvailable: (service: ModuleService | undefined) =>
      typeof service?.getLeadgenFunnelReport === "function"
  },
  // ...
];
```

- `createApp` passes one global `availableReportRoutes` set into the registry:

```ts
// apps/api/src/server/app.ts:1537-1549
const moduleServices = new Map<string, ModuleService>([
  ["attraction", service],
  ...Object.entries(config.modules ?? {})
]);
const moduleCapabilityRegistry = createModuleCapabilityRegistry({
  availableReportRoutes: createAvailableReportRoutes({
    attractionService: service,
    moduleServices
  }),
  ...(config.moduleCapabilityManifests
    ? { extraManifests: config.moduleCapabilityManifests }
    : {})
});
```

- Capability tests currently use `onboarding` as a fake future module name.
  That was only a placeholder. It must not become a product signal. Replace
  capability-specific placeholders with a neutral `custom-module` example.

- Context7 check during planning: Express 5.1 `app.use` registers middleware in
  registration order. Route and middleware ordering is load-bearing here; do not
  weaken the route-isolation behavior from PR #99.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight --allow-dirty` | exit 0 on a non-main `codex/*` branch |
| Focused API tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts test/http.test.ts` | all tests pass |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0 |
| Contracts typecheck | `pnpm --filter @bitrix24-reporting/contracts typecheck` | exit 0 |
| Workspace typecheck | `pnpm typecheck` | exit 0 |
| Workspace lint | `pnpm lint` | exit 0 |
| Ontology docs | `pnpm ontology:validate` | exit 0, `Attraction ontology registry valid` |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/server/module-capabilities.ts`
- `apps/api/src/server/app.ts`
- `apps/api/test/module-capabilities.test.ts`
- `apps/api/test/http.test.ts`
- `docs/architecture/module-capabilities.md`
- `plans/004-define-module-capability-manifest-and-agent-data-boundary.md`
- `plans/README.md`

**Out of scope**:

- Implementing a real third product module.
- Adding package/plugin loading, dynamic imports, npm package discovery, or a
  marketplace.
- Changing report calculations, sync semantics, Bitrix scopes, manager
  whitelist behavior, or existing report payload contracts.
- Rewriting `ProtoApp`.
- Giving agents direct SQLite, Bitrix, filesystem, token, cookie, or raw payload
  access.
- Renaming `attraction` or `leadgen`.

## Git Workflow

- Branch: `codex/fork-owned-module-extension-seam`
- Start from updated `main` at or after `d3c9fe1`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested:
  `feat(platform): define fork module extension seam`

## Steps

### Step 1: Rename product-looking placeholders to neutral custom-module wording

Replace capability-specific fake module examples named `onboarding` with a
neutral `custom-module` or `custom` fixture. This includes:

- `apps/api/test/module-capabilities.test.ts`
- the capability-manifest section of `apps/api/test/http.test.ts`
- `docs/architecture/module-capabilities.md`
- plan wording in `plans/004-define-module-capability-manifest-and-agent-data-boundary.md`

Route-isolation tests in `apps/api/test/http.test.ts` may also use `onboarding`
as a generic module ID. Prefer renaming them to `custom-module` for consistency
unless doing so hides the original PR #99 route-isolation intent. In either
case, comments and test names must make clear that this is not a planned product
module.

**Verify**:

```bash
rg -n "onboarding" docs/architecture/module-capabilities.md plans/004-define-module-capability-manifest-and-agent-data-boundary.md apps/api/test/module-capabilities.test.ts apps/api/test/http.test.ts
```

Expected: no product-planning references remain. If any test still uses
`onboarding`, the surrounding test name or comment must state that it is a
generic route-isolation fixture, not a product module.

### Step 2: Introduce a module capability adapter interface

In `apps/api/src/server/module-capabilities.ts`, introduce an API-side adapter
interface that pairs a manifest with its live route availability. Suggested
shape:

```ts
export interface ModuleCapabilityAdapter {
  manifest: ModuleCapabilityManifest;
  availableReportRoutes?: Iterable<string>;
}
```

Adjust `ModuleCapabilityRegistryInput` so it accepts adapters instead of, or in
addition to, plain `extraManifests`. The registry should:

- keep default attraction and leadgen capability adapters;
- accept fork-owned custom module adapters;
- normalize each adapter's manifest by its own `availableReportRoutes`;
- still reject duplicate `moduleId` values;
- keep the returned manifest serializable and metadata-only.

Do not put executable report functions in the contract package or in returned
manifest objects.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
```

Expected: exit 0.

### Step 3: Move hardcoded availability out of createApp and into adapters

Replace `attractionCapabilityReportAvailability`,
`leadgenCapabilityReportAvailability`, and `createAvailableReportRoutes` in
`apps/api/src/server/app.ts` with calls into capability adapters.

Suggested approach:

- create helper functions in `apps/api/src/server/module-capabilities.ts`, for
  example:
  - `createAttractionCapabilityAdapter(service: AppServiceLike)`
  - `createLeadgenCapabilityAdapter(service: ModuleServiceLike | undefined)`
- keep the helper input types narrow enough that `module-capabilities.ts` does
  not need to import the full `AppService` from `app.ts`;
- have `createApp` build adapters from existing `service`, `moduleServices`, and
  any fork-owned adapters from config;
- preserve current behavior:
  - default test app without a leadgen module service returns leadgen reports as
    `planned`;
  - production `index.ts`, which passes `modules.leadgen`, returns leadgen
    reports as `available`;
  - fake custom module manifests with no live routes return reports as
    `planned`.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts test/http.test.ts
```

Expected: all tests pass.

### Step 4: Add validation for fork-owned module manifests

Add validation in the API-side registry for fork-owned/custom adapters:

- duplicate `moduleId` fails fast;
- `moduleId` must be non-empty and stable URL-safe text;
- `reports[].route` must start with `/api/`;
- reports marked `available` must be listed in that adapter's
  `availableReportRoutes`; otherwise they are returned as `planned`;
- `dataPolicy.piiExcluded` must be true;
- `rawPayloadAccess`, `directBitrixAccess`, and `arbitrarySqliteAccess` must be
  false;
- returned JSON must not expose `SqliteRepository`, Bitrix webhook names,
  SQLite URLs, raw payload fields, or contact personal fields.

Use normal TypeScript checks plus runtime validation in the registry. Keep error
messages specific but do not include secrets or raw payload contents.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts
```

Expected: tests cover valid custom adapters and validation failures.

### Step 5: Document the fork-friendly extension contract

Update `docs/architecture/module-capabilities.md` with a section such as
`Fork-Owned Modules And Integrations`.

Required content:

- A fork-owned module is not a product roadmap promise in this repository.
- A fork owner may add their own CRM/source-data adapter, sync adapter, report
  routes, and manifest adapter in their fork.
- Shared/platform owns the manifest schema, registry, auth filtering, and safe
  data policy rules.
- A fork-owned module owns its data adapter, sync adapter, route registrar,
  report descriptors, ontology reference, and privacy exclusions.
- V1 is source-code fork friendly, not a package/plugin runtime.
- Future package/plugin loading is allowed only after this source-level seam is
  stable.

**Verify**:

```bash
rg -n "fork-owned|custom module|integration|source data|plugin runtime|AI-agent" docs/architecture/module-capabilities.md
```

Expected: matches for every required concept.

### Step 6: Update plan index and verification notes

Update `plans/README.md` so plan 005 is listed after plan 004 as TODO. Add a
dependency note explaining that plan 005 turns the plan 004 manifest into a
fork-friendly extension seam without doing a physical repository split or a
package plugin runtime.

**Verify**:

```bash
rg -n "005|fork-owned|extension seam|plugin runtime" plans/README.md plans/005-define-fork-owned-module-extension-seam.md
```

Expected: matches in both files.

## Test Plan

Required:

- `pnpm --filter @bitrix24-reporting/api exec vitest run test/module-capabilities.test.ts test/http.test.ts`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/contracts typecheck`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm ontology:validate`
- `git diff --check`

New or updated tests:

- `apps/api/test/module-capabilities.test.ts`
  - custom module adapter can publish a manifest without attraction assumptions;
  - custom module `available` report becomes `planned` when the route is not
    listed in its adapter's `availableReportRoutes`;
  - custom module `available` report stays `available` when its adapter lists
    the route;
  - duplicate module IDs fail fast;
  - invalid data policies fail fast.
- `apps/api/test/http.test.ts`
  - HTTP capability endpoints still filter by auth module access;
  - password auth without a cookie still returns `401`;
  - route isolation for unknown/custom module IDs remains intact.

## Done Criteria

- [x] Capability fixtures no longer imply `onboarding` is a planned product.
- [x] Fork-owned/custom module examples use neutral names such as
      `custom-module`.
- [x] `apps/api/src/server/module-capabilities.ts` exposes a module capability
      adapter interface or equivalent source-level extension seam.
- [x] `createApp` no longer owns attraction/leadgen-specific report
      availability tables directly.
- [x] Fork-owned adapters can supply manifest metadata and live route
      availability without editing the registry internals.
- [x] Manifest validation rejects unsafe custom module data policies.
- [x] Capability endpoint auth behavior is unchanged.
- [x] No plugin package runtime, dynamic loading, AI-agent runtime, SDK
      dependency, model call, or prompt orchestration is implemented.
- [x] Required verification commands pass.
- [x] `plans/README.md` row for plan 005 is updated.

## STOP Conditions

Stop and report back if:

- The change requires rewriting `ProtoApp`.
- The change requires physical repository splitting.
- The change requires a package/plugin loader, dynamic import system, or npm
  package discovery.
- The change requires changing existing report payload contracts, calculations,
  sync semantics, Bitrix category/stage scopes, or manager whitelist behavior.
- A fork-owned module needs direct SQLite handles, full repository adapters,
  direct Bitrix clients, raw payloads, secrets, or personal fields in a manifest.
- Capability endpoint auth behavior changes.
- Route ordering or `next("route")` isolation behavior must be weakened.

## Maintenance Notes

- This plan deliberately chooses a hybrid fork model: source-code fork friendly
  now, package/plugin runtime later.
- Reviewers should check that the new adapter interface is deep enough to hide
  availability normalization and validation, but not so broad that it becomes a
  generic plugin runtime.
- Future public documentation can use this seam as the basis for a "bring your
  own integration" guide.
