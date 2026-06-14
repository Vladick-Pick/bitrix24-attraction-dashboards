# Plan 004: Define module capability manifest and agent data boundary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in the "STOP conditions" section occurs, stop and report -
> do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer dispatched you and told you they maintain
> the index.
>
> **Drift check (run first)**:
> `git diff --stat 5a2884f..HEAD -- CONTEXT-MAP.md docs/adr/0001-separate-attraction-and-leadgen-products.md docs/architecture/web-runtime.md docs/modules/README.md docs/modules/attraction/MODULE_ONTOLOGY.md docs/modules/leadgen/MODULE_ONTOLOGY.md packages/contracts/src/index.ts apps/api/src/server/app.ts apps/web/src/lib/api-client.ts plans/004-define-module-capability-manifest-and-agent-data-boundary.md`
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
- **Planned at**: commit `5a2884f`, 2026-06-14

## Why This Matters

The project needs to support future modules such as `onboarding` and a future
AI-agent layer over module data. That must not re-create the current coupling by
letting a new module copy attraction assumptions or letting an agent read
arbitrary SQLite tables. A module capability manifest gives shared/platform a
safe, explicit contract for what each module exposes: reports, ontology,
allowed scopes, safe read models, and agent-usable capabilities.

This plan does not implement an AI agent. It defines the boundary that a future
agent must use.

## Current State

- `CONTEXT-MAP.md` and ADR 0001 define `attraction` and `leadgen` as separate
  products with a narrow shared/platform layer.
- `docs/architecture/web-runtime.md` requires `ProtoApp` to remain the only
  supported web runtime interface.
- `apps/api/src/server/app.ts` currently has an ad hoc `ModuleService` shape:
  leadgen report methods, attraction ontology methods, `getMeta`, and
  `performSync`.
- `createApp` builds `moduleServices` from a default `attraction` service plus
  `config.modules`.
- `apps/web/src/lib/api-client.ts` contains module path behavior, including
  legacy attraction paths and `/api/modules/:moduleId/...` paths for other
  modules.
- Module ontologies define data boundaries and privacy exclusions, but there is
  no typed capability contract that future modules or AI-agent tools can read.

Relevant excerpts:

```ts
// apps/api/src/server/app.ts:196-210
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
// apps/api/src/server/app.ts:1478-1482
const moduleServices = new Map<string, ModuleService>([
  ["attraction", service],
  ...Object.entries(config.modules ?? {})
]);
```

```text
// docs/architecture/web-runtime.md
The web app has one supported runtime interface: `ProtoApp`.

Live report data must continue to flow through the local API and SQLite
snapshot. The browser must not read Bitrix directly.
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Session gate | `pnpm session:preflight` | exit 0 on a non-main `codex/*` branch |
| Ontology docs | `pnpm ontology:validate` | exit 0, `Attraction ontology registry valid` |
| Contracts typecheck | `pnpm --filter @bitrix24-reporting/contracts typecheck` | exit 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exit 0 |
| Focused API tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts` | all tests pass |

## Scope

**In scope**:

- A documented module capability manifest contract, for example
  `docs/architecture/module-capabilities.md`.
- Typed manifest contracts in `packages/contracts/src/index.ts` or a new
  contracts source file re-exported from `index.ts`.
- API-side module capability registry/adapters, for example
  `apps/api/src/server/module-capabilities.ts`.
- Manifest data for existing `attraction` and `leadgen` modules.
- Focused tests proving:
  - attraction and leadgen manifests are available;
  - a fake `onboarding` manifest can be represented without attraction-specific
    report methods;
  - agent-readable capabilities exclude personal data and raw payload access.
- `plans/README.md` status row.

**Out of scope**:

- Implementing an AI agent, LLM orchestration, OpenAI/Anthropic SDK usage, or
  prompt/runtime code.
- Adding a real `onboarding` product, UI, Bitrix funnel, sync, or reports.
- Rewriting `ProtoApp`.
- Changing report calculations, sync semantics, Bitrix category/stage scopes,
  or manager whitelist behavior.
- Giving agents direct SQLite, Bitrix, filesystem, token, cookie, or raw payload
  access.
- Physical repository split.

## Git Workflow

- Branch: `codex/module-capability-manifest`
- Start after plans 001, 002, and 003 land.
- Do not push or open a PR unless the operator instructed it.
- Commit message when requested:
  `feat(platform): define module capability manifest`

## Steps

### Step 1: Document the manifest contract

Create `docs/architecture/module-capabilities.md`.

Required content:

- State that the manifest is the shared/platform contract for module discovery,
  future module onboarding, and AI-agent-safe read access.
- State that a manifest is not a report implementation and not an agent runtime.
- Define ownership:
  - shared/platform owns the manifest schema and registry plumbing;
  - each module owns its manifest values, ontology links, report descriptors,
    data scope, privacy rules, and capability semantics.
- State that future agents must call module capabilities or safe read models,
  not arbitrary repository methods or SQLite tables.

**Verify**:
`rg -n "module capability|AI-agent|safe read|onboarding|SQLite" docs/architecture/module-capabilities.md`
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

After plan 003 route registrars exist, expose manifests through a shared or
module registrar without changing report routes.

Suggested routes:

- `GET /api/modules/capabilities`
- `GET /api/modules/:moduleId/capabilities`

Behavior:

- super admins can list all manifests;
- module users can read only manifests for modules they can access;
- unauthenticated behavior follows the existing auth mode;
- unknown module returns the existing error style;
- response bodies contain metadata only, no report rows or raw payloads.

If adding routes before plan 003 would expand `createApp`, stop and defer this
step until route registrars are in place.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api exec vitest run test/http.test.ts
```

### Step 5: Prove future module support with a fake onboarding manifest

Add a contract or API test fixture for a fake `onboarding` manifest. The fixture
must prove that a module can declare:

- its own `moduleId`;
- its own ontology reference;
- no attraction-specific report methods;
- its own data policy;
- optional agent-readable report descriptors.

Do not add real onboarding routes, sync, database URLs, or UI.

**Verify**:
Run the focused test file that contains the fixture, plus API typecheck.

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
- `git diff --check`

Add focused contract/API tests for manifest shape and fake onboarding support.

## Done Criteria

- [ ] `docs/architecture/module-capabilities.md` exists.
- [ ] A serializable `ModuleCapabilityManifest` contract exists.
- [ ] Existing `attraction` and `leadgen` manifests are available through an
      API-side registry.
- [ ] A fake `onboarding` manifest fixture proves future-module support without
      attraction-specific assumptions.
- [ ] Manifest data policies explicitly forbid PII, raw Bitrix payloads, direct
      Bitrix access, and arbitrary SQLite access.
- [ ] If HTTP routes are added, they are registered through plan 003 route
      registrars and preserve existing auth behavior.
- [ ] No AI-agent runtime, SDK dependency, model call, or prompt orchestration is
      implemented.
- [ ] Required verification commands pass.
- [ ] `plans/README.md` row for plan 004 is updated.

## STOP Conditions

Stop and report back if:

- The manifest requires rewriting `ProtoApp`.
- The manifest requires changing report calculations, sync semantics, Bitrix
  scopes, manager whitelist behavior, or contracts for existing report payloads.
- A route must be added directly to the pre-plan-003 monolithic `createApp`.
- The implementation requires exposing full repository adapters, SQLite handles,
  direct Bitrix clients, raw payloads, secrets, or personal fields to an agent.
- Adding fake onboarding support starts turning into a real onboarding product.

## Maintenance Notes

- Future AI-agent work should cite this plan and ADR 0001 before adding any
  model runtime.
- Future module work should start from module ontology plus capability manifest,
  not by copying attraction or leadgen route/service shapes.
- Reviewers should treat `agentReadable: true` as a privacy-sensitive flag.
