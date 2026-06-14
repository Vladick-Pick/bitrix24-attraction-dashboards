# Plan 004: Define module capability manifest and agent data boundary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat d3c9fe1..HEAD -- CONTEXT-MAP.md docs/adr/0001-separate-attraction-and-leadgen-products.md docs/architecture/web-runtime.md docs/modules/README.md docs/modules/attraction/MODULE_ONTOLOGY.md docs/modules/leadgen/MODULE_ONTOLOGY.md packages/contracts/src/index.ts apps/api/src/server/app.ts apps/api/src/server/routes/platform-routes.ts apps/api/src/server/routes/attraction-routes.ts apps/api/src/server/routes/leadgen-routes.ts apps/web/src/lib/api-client.ts plans/004-define-module-capability-manifest-and-agent-data-boundary.md`
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
- **Category**: platform
- **Planned at**: commit `d3c9fe1`, 2026-06-14
- **Last updated**: 2026-06-14 after hardening review and open-source
  forkability clarification

## Why This Matters

The project needs to support open-source forks where an operator can use
vibe-coding to add fork-owned modules, integrations, source data, and reports.
It also needs a future AI-agent layer over module data. That must not re-create
the current coupling by letting a fork-owned module copy attraction assumptions
or letting an agent read arbitrary SQLite tables. A module capability manifest
gives shared/platform a safe, explicit contract for what each module exposes:
reports, ontology, allowed scopes, safe read models, and agent-usable
capabilities.

This plan does not implement an AI agent. It defines the boundary that a future
agent must use.

## Current State

- `CONTEXT-MAP.md` and ADR 0001 define `attraction` and `leadgen` as separate
  products with a narrow shared/platform layer.
- `docs/architecture/web-runtime.md` requires `ProtoApp` to remain the only
  supported web runtime interface.
- Plans 001, 002, and 003 have landed on `main`; module route registrars exist,
  and PR #99 preserved route isolation for future module IDs.
- `apps/api/src/server/app.ts` still has an ad hoc `ModuleService` shape:
  leadgen report methods, attraction ontology methods, `getMeta`, and
  `performSync`.
- `createApp` builds `moduleServices` from a default `attraction` service plus
  `config.modules`.
- Route definitions live in registrar files under `apps/api/src/server/routes/`.
  New capability endpoints must be registered through a route registrar. It is
  acceptable for `createApp` to provide handler implementations and call the
  registrar, but do not add new inline `app.get(...)` declarations in
  `createApp`.
- `apps/web/src/lib/api-client.ts` contains module path behavior, including
  legacy attraction paths and `/api/modules/:moduleId/...` paths for other
  modules.
- Module ontologies define data boundaries and privacy exclusions, but there is
  no typed capability contract that future modules or AI-agent tools can read.

Relevant excerpts:

```ts
// apps/api/src/server/app.ts:211-225
interface ModuleService {
  getLeadgenFunnelReport?(input: RangeRequest): Promise<LeadgenFunnelReport>;
  getActivitiesWorkloadReport?(input: RangeRequest): Promise<ActivitiesWorkloadReport>;
  getCallsWorkloadReport?(input: RangeRequest): Promise<CallsWorkloadReport>;
  getAttractionOntology?(): Promise<AttractionOntologyResponse>;
  getAttractionOntologySourceDocument?(
    sourceId: string
  ): Promise<OntologySourceDocumentResponse>;
  getMeta?(): Promise<MetaResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
}
```

```ts
// apps/api/src/server/app.ts:1459-1462
const moduleServices = new Map<string, ModuleService>([
  ["attraction", service],
  ...Object.entries(config.modules ?? {})
]);
```

```ts
// apps/api/src/server/routes/platform-routes.ts:20-35
export function registerPlatformRoutes(
  app: express.Express,
  handlers: PlatformRouteHandlers
) {
  app.get("/api/health", handlers.health);
  app.get("/api/auth/me", handlers.getCurrentUser);
  app.patch("/api/auth/me", handlers.updateCurrentUser);
  app.post("/api/auth/change-password", handlers.changePassword);
  app.post("/api/auth/logout", handlers.logout);
  app.get("/api/admin/platform/access", handlers.getPlatformAccess);
  app.patch(
    "/api/admin/platform/users/:id/module-memberships",
    handlers.updatePlatformUserModuleMemberships
  );
}
```

```ts
// apps/api/src/server/routes/leadgen-routes.ts:12-26
export function registerLeadgenRoutes(
  app: express.Express,
  handlers: LeadgenRouteHandlers
) {
  app.get("/api/modules/:moduleId/reports/funnel", handlers.getFunnelReport);
  app.get(
    "/api/modules/:moduleId/reports/activities-workload",
    handlers.getActivitiesWorkloadReport
  );
  app.get(
    "/api/modules/:moduleId/reports/calls-workload",
    handlers.getCallsWorkloadReport
  );
  app.get("/api/modules/leadgen/ontology", handlers.notFound);
  app.get("/api/modules/leadgen/ontology/sources/:sourceId", handlers.notFound);
}
```

```text
// docs/architecture/web-runtime.md:3-11
The web app has one supported runtime interface: `ProtoApp`.

Live report data must continue to flow through the local API and SQLite
snapshot. The browser must not read Bitrix directly.
```

Context7 check during plan refresh: Express 5.1 supports `next("route")` for
conditional route skipping, and `app.use`/route registration order is
load-bearing. Preserve the route isolation behavior added by PR #99 when adding
capability endpoints.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| Ontology docs | `pnpm ontology:validate` | exit 0, `Attraction ontology registry valid` |
| Contracts typecheck | `pnpm --filter @bitrix24-reporting/contracts typecheck` | exit 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0 |
| Focused API tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |
| Workspace typecheck | `pnpm typecheck` | exit 0 |
| Workspace lint | `pnpm lint` | exit 0 |

## Scope

**In scope**:

- A documented module capability manifest contract, for example
  `docs/architecture/module-capabilities.md`.
- Typed manifest contracts in `packages/contracts/src/index.ts` or a new
  contracts source file re-exported from `index.ts`.
- API-side module capability registry/adapters, for example
  `apps/api/src/server/module-capabilities.ts`.
- Route registration changes in `apps/api/src/server/routes/platform-routes.ts`
  or a new focused registrar such as
  `apps/api/src/server/routes/module-capability-routes.ts`, wired from
  `createApp`.
- Manifest data for existing `attraction` and `leadgen` modules.
- Focused tests proving:
  - attraction and leadgen manifests are available;
  - live report descriptors expose `status: "available"` only when the backing
    route/service is wired, otherwise future descriptors stay `planned`;
  - duplicate module ids fail fast instead of silently replacing a manifest;
  - HTTP response envelopes are represented in shared contracts;
  - password-authenticated APIs return `401` before serving capability manifests
    without a valid session cookie;
  - a fake custom module manifest can be represented without
    attraction-specific report methods;
  - agent-readable capabilities exclude personal data and raw payload access.
- `plans/README.md` status row.

**Out of scope**:

- Implementing an AI agent, LLM orchestration, OpenAI/Anthropic SDK usage, or
  prompt/runtime code.
- Adding a real third product module, UI, CRM funnel, sync, or reports.
- Creating a plugin/package runtime for fork-owned modules; that is deferred to
  `plans/005-define-fork-owned-module-extension-seam.md`.
- Rewriting `ProtoApp`.
- Changing report calculations, sync semantics, Bitrix category/stage scopes,
  or manager whitelist behavior.
- Giving agents direct SQLite, Bitrix, filesystem, token, cookie, or raw payload
  access.
- Physical repository split.

## Git Workflow

- Branch: `codex/module-capability-manifest`
- Start from updated `main` at or after `d3c9fe1`.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested:
  `feat(platform): define module capability manifest`

## Steps

### Step 1: Document the manifest contract

Create `docs/architecture/module-capabilities.md`.

Required content:

- State that the manifest is the shared/platform contract for module discovery,
  fork-owned module integration, and AI-agent-safe read access.
- State that a manifest is not a report implementation and not an agent runtime.
- Define ownership:
  - shared/platform owns the manifest schema and registry plumbing;
  - each module owns its manifest values, ontology links, report descriptors,
    data scope, privacy rules, and capability semantics.
- State that future agents must call module capabilities or safe read models,
  not arbitrary repository methods or SQLite tables.

**Verify**:
`rg -n "module capability|AI-agent|safe read|fork|custom|SQLite" docs/architecture/module-capabilities.md`
prints matches for the required terms.

### Step 2: Add typed manifest contracts

In contracts, add types with narrow, serializable fields. Suggested shape:

```ts
export type ModuleCapabilityKind =
  | "report"
  | "ontology"
  | "sync"
  | "comments"
  | "agent-safe-read";

export interface ModuleReportCapability {
  id: string;
  title: string;
  description: string;
  route: string;
  inputSchemaId: string;
  outputSchemaId: string;
  status: "available" | "planned" | "disabled";
  agentReadable: boolean;
}

export interface ModuleDataPolicy {
  allowedScopes: string[];
  forbiddenFields: string[];
  piiExcluded: boolean;
  rawPayloadAccess: false;
}

export interface ModuleCapabilityManifest {
  moduleId: string;
  displayName: string;
  ontologyRef: string;
  reports: ModuleReportCapability[];
  capabilities: ModuleCapabilityKind[];
  dataPolicy: ModuleDataPolicy;
}

export interface ModuleCapabilityManifestListResponse {
  manifests: ModuleCapabilityManifest[];
}

export interface ModuleCapabilityManifestResponse {
  manifest: ModuleCapabilityManifest;
}
```

Adjust names to match existing contract style. Keep the first version
serializable and metadata-only. Do not include executable functions in the
contract package.

**Verify**:
`pnpm --filter @bitrix24-reporting/contracts typecheck` exits 0.

### Step 3: Add API-side manifest registry

Create an API-side registry that maps module IDs to manifests. Keep executable
behavior out of the manifest object.

Suggested file:

```text
apps/api/src/server/module-capabilities.ts
```

Suggested exports:

- `getModuleCapabilityManifest(moduleId: string)`
- `listModuleCapabilityManifests()`
- `createAttractionCapabilityManifest()`
- `createLeadgenCapabilityManifest()`

The leadgen manifest must not include attraction-only reports or manager
whitelist assumptions. The attraction manifest may include legacy route paths,
but it must label them as attraction-owned.

**Verify**:
`pnpm --filter @bitrix24-reporting/api typecheck` exits 0.

### Step 4: Expose manifests through platform/module routes

Plans 001-003 are now landed. Expose manifests through a shared/platform
registrar without changing report routes.

Suggested routes:

- `GET /api/modules/capabilities`
- `GET /api/modules/:moduleId/capabilities`

Behavior:

- super admins can list all manifests;
- module users can read only manifests for modules they can access;
- unauthenticated behavior follows the existing auth mode;
- unknown module returns the existing error style;
- response bodies contain metadata only, no report rows or raw payloads.

Routing rules:

- define the route paths in `apps/api/src/server/routes/platform-routes.ts` or
  a new focused route registrar file;
- `createApp` may implement handlers and call the registrar, matching existing
  registrar wiring;
- do not add new inline `app.get(...)` declarations directly in `createApp`;
- do not weaken the `next("route")` isolation behavior that lets fork-owned
  module routes handle custom module IDs.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts
```

### Step 5: Prove future module support with a fake custom module manifest

Add a contract or API test fixture for a fake custom module manifest. The
fixture must prove that a fork-owned module can declare:

- its own `moduleId`;
- its own ontology reference;
- no attraction-specific report methods;
- its own data policy;
- optional agent-readable report descriptors.

Do not add real custom-module routes, sync, database URLs, or UI. If an existing
product-looking placeholder name is used in tests, treat it as a neutral fixture
only, not as a product decision. The follow-up plan 005 should replace
product-looking placeholder names with a neutral `custom-module` example before
the repository is published as fork-friendly open source.

**Verify**:
Run the focused test file that contains the fixture, plus API typecheck.
If the fixture lives in `apps/api/test/http.test.ts`, run:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts
pnpm --filter @bitrix24-reporting/api typecheck
```

### Step 6: Keep AI-agent access as a boundary, not runtime

Add explicit tests or docs showing that an AI agent would consume:

- manifest metadata;
- report descriptors;
- safe read models;
- data policy and forbidden fields.

It must not consume:

- raw SQLite handles;
- full `SqliteRepository`;
- Bitrix webhooks or direct Bitrix clients;
- raw Bitrix payloads;
- deal names, contact names, phones, emails, or other personal data.

Do not add SDK dependencies or model calls in this plan.

**Verify**:
`rg -n "OpenAI|Anthropic|llm|model|agent runtime" apps packages` should not show
new runtime code from this plan. Documentation may mention future AI-agent
access boundaries.

## Test Plan

Required:

- `pnpm ontology:validate`
- `pnpm --filter @bitrix24-reporting/contracts typecheck`
- `pnpm --filter @bitrix24-reporting/api typecheck`
- `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`

Add focused contract/API tests for manifest shape and fake custom-module support.

## Done Criteria

- [x] `docs/architecture/module-capabilities.md` exists.
- [x] A serializable `ModuleCapabilityManifest` contract exists.
- [x] Existing `attraction` and `leadgen` manifests are available through an
      API-side registry.
- [x] A fake custom module manifest fixture proves future-module support
      without attraction-specific assumptions.
- [x] Manifest data policies explicitly forbid PII, raw Bitrix payloads, direct
      Bitrix access, and arbitrary SQLite access.
- [x] If HTTP routes are added, their paths live in a route registrar, `createApp`
      only wires handlers, and existing auth behavior is preserved.
- [x] No AI-agent runtime, SDK dependency, model call, or prompt orchestration is
      implemented.
- [x] Required verification commands pass.
- [x] `plans/README.md` row for plan 004 is updated.

## STOP Conditions

Stop and report back if:

- The manifest requires rewriting `ProtoApp`.
- The manifest requires changing report calculations, sync semantics, Bitrix
  scopes, manager whitelist behavior, or contracts for existing report payloads.
- A route must be added as a new inline `app.get(...)` directly in `createApp`
  instead of through a registrar.
- A capability endpoint would require changing the `next("route")` route
  isolation behavior added by PR #99.
- The implementation requires exposing full repository adapters, SQLite handles,
  direct Bitrix clients, raw payloads, secrets, or personal fields to an agent.
- Fake custom-module support starts turning into a real third product module.

## Maintenance Notes

- Future AI-agent work should cite this plan and ADR 0001 before adding any
  model runtime.
- Future fork-owned module work should start from module ontology plus
  capability manifest, not by copying attraction or leadgen route/service
  shapes.
- Open-source forkability needs a follow-up extension seam so fork maintainers
  can bring their own integrations and source data without editing
  shared/platform internals; see plan 005.
- Reviewers should treat `agentReadable: true` as a privacy-sensitive flag.
