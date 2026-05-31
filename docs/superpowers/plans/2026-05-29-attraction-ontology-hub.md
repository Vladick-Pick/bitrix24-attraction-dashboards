# Attraction Ontology Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an attraction-only Ontology Hub that keeps the module ontology maintainable, exposes source/regulation/report links in the dashboard, and detects when Bitrix process metadata drifts from the ontology.

**Architecture:** Keep the canonical ontology for `attraction` in a structured registry under `docs/modules/attraction/ontology/registry/`, backed by the current narrative markdown files. The API serves an authenticated attraction-only ontology endpoint, computes drift against the current attraction stage catalog, and the web dashboard renders a dedicated `Онтология` scene with concept cards, source links, report anchors, and drift status. `leadgen` is explicitly out of scope and must return no ontology data until a separate leadgen ontology is designed.

**Tech Stack:** TypeScript, Express, React/Vite, Vitest, Node test runner, local JSON registry, existing `@bitrix24-reporting/contracts`, `@bitrix24-reporting/api`, and `@bitrix24-reporting/web`.

---

## Scope

In scope:

- Attraction module only: module slug `attraction`, Bitrix category `10`.
- Ontology registry for attraction stages, transitions, outcomes, delivery qualities, formats, sources, report bindings, and drift status.
- Dashboard scene `Онтология` visible only in the attraction dashboard.
- Links to regulations, Google Sheets, module markdown docs, and existing dashboard report blocks.
- Local validation, local build, user acceptance test, then deploy after explicit user approval.

Out of scope:

- Leadgen ontology.
- Leadgen dashboard ontology UI.
- Mutating Google Docs, Google Sheets, or Bitrix settings.
- Reworking existing report calculations beyond adding report block anchors and ontology links.
- Showing personal owner names in the UI. Use role/contour wording: `Технолог бизнес-процессов`, `Центр Технологизации`.

## File Structure

Create:

- `docs/modules/attraction/ontology/registry/attraction-ontology.json`
  Canonical attraction ontology registry consumed by validation, API, and UI.
- `scripts/validate-attraction-ontology.mjs`
  Local validation script for registry structure, unique ids, source references, report bindings, and known Bitrix stage coverage.
- `scripts/validate-attraction-ontology.test.mjs`
  Node tests for the validation script.
- `apps/api/src/domain/attraction-ontology.ts`
  Loads the attraction registry and computes runtime drift from `getMeta().stageCatalog`.
- `apps/api/test/attraction-ontology.test.ts`
  Domain tests for registry loading and drift classification.
- `apps/web/src/proto/ontology-hub.tsx`
  Attraction-only Ontology Hub scene component.
- `apps/web/src/proto/ontology-hub.test.tsx`
  UI tests for the ontology scene.

Modify:

- `package.json`
  Add `ontology:validate`.
- `packages/contracts/src/index.ts`
  Add shared ontology response types.
- `apps/api/src/server/service.ts`
  Add `getAttractionOntology()`.
- `apps/api/src/server/app.ts`
  Add attraction-only ontology routes.
- `apps/api/test/http.test.ts`
  Cover API access and leadgen exclusion.
- `apps/web/src/lib/dashboard-types.ts`
  Add web ontology types matching contracts.
- `apps/web/src/lib/api-client.ts`
  Add `getAttractionOntology()` and normalizer.
- `apps/web/src/lib/api-client.test.ts`
  Cover ontology response normalization.
- `apps/web/src/proto/types.ts`
  Add ontology runtime data.
- `apps/web/src/proto/proto-app.tsx`
  Fetch ontology only for attraction and pass it to scenes.
- `apps/web/src/proto/scenes.tsx`
  Add the `Онтология` scene and stable report block anchors where needed.
- `apps/web/src/proto/proto-app.test.tsx`
  Cover attraction-only tab visibility and leadgen exclusion.
- `docs/modules/attraction/MODULE_ONTOLOGY.md` and `docs/modules/attraction/ontology/README.md`
  Link to the registry and document the update workflow.

## Data Model

The registry should be a single JSON object:

```json
{
  "moduleKey": "attraction",
  "title": "Онтология Привлечения",
  "governance": {
    "decisionRole": "Технолог бизнес-процессов",
    "decisionUnit": "Центр Технологизации"
  },
  "lastReviewedAt": "2026-05-29",
  "sources": [],
  "concepts": [],
  "transitions": [],
  "reportBindings": []
}
```

Required concept shape:

```json
{
  "id": "handoff_rejected_by_club",
  "type": "outcome",
  "label": "Отклонено потребителем",
  "status": "confirmed",
  "definition": "Клуб не принял участника или карточку на этапе \"На передаче\".",
  "not": ["отказ клиента", "корзина"],
  "bitrix": {
    "categoryId": "10",
    "stageId": "C10:UC_XEEP0A"
  },
  "sourceIds": ["bitrix_stage_10", "ontology_review_2026_05_29"],
  "reportBindingIds": ["attraction-outcomes-lost-reasons", "attraction-funnel-flow"]
}
```

Required report binding shape:

```json
{
  "id": "attraction-outcomes-lost-reasons",
  "label": "Проигрыши по причинам",
  "sceneId": "sales",
  "blockId": "attraction-acquisition-outcomes",
  "href": "#attraction-acquisition-outcomes"
}
```

## Task 1: Create Registry And Validator

**Files:**

- Create: `docs/modules/attraction/ontology/registry/attraction-ontology.json`
- Create: `scripts/validate-attraction-ontology.mjs`
- Create: `scripts/validate-attraction-ontology.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing validator tests**

Create tests that assert:

- duplicate concept ids fail;
- a concept source id that does not exist fails;
- a concept report binding id that does not exist fails;
- every `bitrix.stageId` concept uses `categoryId: "10"`;
- `moduleKey` must be `attraction`;
- leadgen category `28` is rejected.

Run:

```bash
node --test scripts/validate-attraction-ontology.test.mjs
```

Expected: FAIL because the validator does not exist.

- [ ] **Step 2: Implement the validator**

The script should export `validateAttractionOntology(input)` and support CLI usage:

```bash
node scripts/validate-attraction-ontology.mjs docs/modules/attraction/ontology/registry/attraction-ontology.json
```

Expected valid CLI output:

```text
Attraction ontology registry valid
```

Expected invalid CLI behavior: non-zero exit code and one line per validation error.

- [ ] **Step 3: Add package script**

Add:

```json
"ontology:validate": "node ./scripts/validate-attraction-ontology.mjs docs/modules/attraction/ontology/registry/attraction-ontology.json"
```

- [ ] **Step 4: Create initial registry**

Include at minimum:

- governance role/unit;
- sources for the three Google Docs regulations, conversion events Google Sheet, Bitrix metadata, module ontology docs, and dashboard report anchors;
- stage concepts for `База входящая`, `Звонок-знакомство`, `Встреча-знакомство`, `На передаче`, `Передано в клуб`, `Корзина`, `Возврат в Лидген(неквал)`, `Отклонено потребителем`;
- outcome concepts for `Корзина`, `Прогрев`, `Возврат в Лидген(неквал)`, `Отклонено потребителем`;
- delivery quality concepts for `Готов ко встрече`, `Готов к мероприятию`, `Пришел на встречу`;
- transition concepts for manual acceptance, autopurchase, successful contact, handoff accepted, handoff rejected;
- report bindings for funnel, lost reasons, conversion events, SLA/activity, and ontology drift.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm ontology:validate
node --test scripts/validate-attraction-ontology.test.mjs
```

Expected: PASS.

## Task 2: Add API Contract And Endpoint

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/domain/attraction-ontology.ts`
- Modify: `apps/api/src/server/service.ts`
- Modify: `apps/api/src/server/app.ts`
- Create: `apps/api/test/attraction-ontology.test.ts`
- Modify: `apps/api/test/http.test.ts`

- [ ] **Step 1: Add contract types**

Add exported types:

```ts
export type OntologyStatus = "confirmed" | "needs-sync" | "draft" | "deprecated" | "unclassified";

export interface OntologySourceRef {
  id: string;
  label: string;
  kind: "google-doc" | "google-sheet" | "markdown" | "bitrix" | "dashboard" | "decision";
  href: string;
  canonicality: "canonical" | "supporting" | "implementation" | "decision";
}

export interface OntologyConcept {
  id: string;
  type: "stage" | "transition" | "outcome" | "delivery_quality" | "format" | "source";
  label: string;
  status: OntologyStatus;
  definition: string;
  not: string[];
  bitrix?: { categoryId: string; stageId?: string; fieldCode?: string; enumValue?: string };
  sourceIds: string[];
  reportBindingIds: string[];
}

export interface OntologyReportBinding {
  id: string;
  label: string;
  sceneId: string;
  blockId: string;
  href: string;
}

export interface OntologyDriftItem {
  kind: "stage" | "source" | "reason" | "report_binding";
  severity: "info" | "warning" | "blocking";
  label: string;
  message: string;
}

export interface AttractionOntologyResponse {
  moduleKey: "attraction";
  title: string;
  governance: { decisionRole: string; decisionUnit: string };
  lastReviewedAt: string;
  sources: OntologySourceRef[];
  concepts: OntologyConcept[];
  transitions: OntologyConcept[];
  reportBindings: OntologyReportBinding[];
  drift: OntologyDriftItem[];
}
```

- [ ] **Step 2: Write domain tests**

Tests must prove:

- registry loads from `docs/modules/attraction/ontology/registry/attraction-ontology.json`;
- runtime stage `C10:UC_XEEP0A` maps to an existing concept;
- unknown attraction stage becomes a `warning` drift item;
- leadgen stage/category is ignored by the attraction ontology response.

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/attraction-ontology.test.ts
```

Expected: FAIL before implementation.

- [ ] **Step 3: Implement domain loader and drift**

`apps/api/src/domain/attraction-ontology.ts` should:

- read the registry from the repository root;
- validate `moduleKey === "attraction"`;
- compare registry stage concepts against `StageCatalogEntry[]`;
- return drift for attraction stages not represented by ontology concepts;
- never include leadgen category `28`.

- [ ] **Step 4: Add service method**

Add `getAttractionOntology()` to the concrete service and return the loader output using the existing attraction meta stage catalog.

- [ ] **Step 5: Add routes**

Add:

```text
GET /api/ontology
GET /api/modules/:moduleId/ontology
```

Behavior:

- `/api/ontology` returns attraction ontology for attraction users;
- `/api/modules/attraction/ontology` returns the same response;
- `/api/modules/leadgen/ontology` returns `404 NOT_FOUND`;
- unauthenticated requests return the existing auth behavior;
- non-attraction users do not receive attraction ontology.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/attraction-ontology.test.ts apps/api/test/http.test.ts
pnpm --filter @bitrix24-reporting/contracts build
```

Expected: PASS.

## Task 3: Add Web Client Support

**Files:**

- Modify: `apps/web/src/lib/dashboard-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/api-client.test.ts`
- Modify: `apps/web/src/proto/types.ts`

- [ ] **Step 1: Add web types**

Mirror the contract ontology response types in `dashboard-types.ts`.

- [ ] **Step 2: Add failing API client tests**

Tests must cover:

- normalizing concepts, sources, report bindings, and drift;
- fallback arrays for missing optional collections;
- preserving `moduleKey: "attraction"`;
- rejecting leadgen-shaped ontology payloads by normalizing to safe defaults or throwing `ApiClientError`, depending on existing api-client pattern.

Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts
```

Expected: FAIL before client implementation.

- [ ] **Step 3: Implement client method**

Add:

```ts
async getAttractionOntology() {
  return requestJson(
    buildUrl('/api/ontology'),
    { method: 'GET' },
    normalizeAttractionOntology,
  )
}
```

- [ ] **Step 4: Add runtime field**

Add `ontology?: AttractionOntologyResponse` to the runtime data shape consumed by attraction scenes.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts
```

Expected: PASS.

## Task 4: Build Attraction Ontology Hub UI

**Files:**

- Create: `apps/web/src/proto/ontology-hub.tsx`
- Create: `apps/web/src/proto/ontology-hub.test.tsx`
- Modify: `apps/web/src/proto/proto-app.tsx`
- Modify: `apps/web/src/proto/scenes.tsx`
- Modify: `apps/web/src/proto/proto-app.test.tsx`
- Modify: `apps/web/src/proto/proto.css` only if existing primitives cannot cover the layout.

- [ ] **Step 1: Write UI tests**

Tests must assert:

- attraction dashboard shows tab `Онтология`;
- leadgen dashboard does not show `Онтология`;
- hub renders governance as role/unit, not a personal name;
- hub renders source links for regulations and conversion events sheet;
- hub renders concept cards for `Корзина`, `Прогрев`, `Возврат в Лидген(неквал)`, `Отклонено потребителем`;
- hub renders drift warnings when API returns drift.

Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/proto/ontology-hub.test.tsx apps/web/src/proto/proto-app.test.tsx
```

Expected: FAIL before UI implementation.

- [ ] **Step 2: Add fetch path**

In `proto-app.tsx`, fetch ontology only when active module is attraction. Do not call ontology API for leadgen.

- [ ] **Step 3: Add scene**

Add scene:

```ts
{
  id: 'ontology',
  label: 'Онтология',
  description: 'Карта процесса, источники, статусы актуальности и связанные отчеты.',
  focus: 'Смыслы / источники / расхождения',
  kpis: [],
  component: OntologyHubScene,
}
```

- [ ] **Step 4: Implement hub layout**

Use existing dashboard primitives:

- top status strip with `Статус`, `Последняя сверка`, `Основание`;
- process map section;
- outcome cards section;
- source links section;
- related report links section;
- drift section.

Required stable comment block ids:

```text
attraction-ontology-overview
attraction-ontology-process-map
attraction-ontology-outcomes
attraction-ontology-sources
attraction-ontology-report-links
attraction-ontology-drift
```

- [ ] **Step 5: Verify UI tests**

Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/proto/ontology-hub.test.tsx apps/web/src/proto/proto-app.test.tsx
```

Expected: PASS.

## Task 5: Add Report Anchors And Bidirectional Links

**Files:**

- Modify: `apps/web/src/proto/scenes.tsx`
- Modify: `docs/modules/attraction/ontology/registry/attraction-ontology.json`
- Modify: `apps/web/src/proto/proto-app.test.tsx`

- [ ] **Step 1: Identify existing blocks**

Use existing `data-comment-block-id` where present. Add `id` attributes matching ontology `href` values when missing.

Required anchors:

```text
attraction-funnel-flow
attraction-acquisition-outcomes
attraction-conversion-events
attraction-activities-sla
attraction-revenue-velocity
```

- [ ] **Step 2: Add report binding tests**

Test that each registry `reportBindings[].blockId` appears as either:

- `data-comment-block-id="<blockId>"`; or
- `id="<blockId>"`.

- [ ] **Step 3: Render links from ontology to reports**

In the Ontology Hub, clicking a report link should update `window.location.hash` and scroll to the block when the linked scene is active. If the link points to another scene, show the scene label and keep the href as stable anchor text.

- [ ] **Step 4: Verify**

Run:

```bash
pnpm ontology:validate
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/proto/proto-app.test.tsx apps/web/src/proto/ontology-hub.test.tsx
```

Expected: PASS.

## Task 6: Update Documentation Workflow

**Files:**

- Modify: `docs/modules/attraction/MODULE_ONTOLOGY.md`
- Modify: `docs/modules/attraction/ontology/README.md`
- Modify: `docs/modules/attraction/ontology/CHANGELOG.md`
- Modify: `docs/modules/attraction/REPORT_REGISTRY.md`

- [ ] **Step 1: Document source hierarchy**

Add this rule:

```text
Битрикс показывает фактическую настройку процесса.
Регламенты и таблицы являются источниками/evidence.
Онтология фиксирует каноническую трактовку.
При расхождении появляется drift, который классифицирует Технолог бизнес-процессов из Центра Технологизации.
```

- [ ] **Step 2: Document update cadence**

Add:

- update ontology when Bitrix stages, enum reasons, fields, SLA, report logic, or conversion event catalog changes;
- run `pnpm ontology:validate` before PR;
- review drift before deploy;
- do not update leadgen ontology in attraction docs.

- [ ] **Step 3: Verify docs**

Run:

```bash
pnpm ontology:validate
rg -n "leadgen ontology|Лидген.*Онтология|Влад Богдан" docs/modules/attraction apps/web/src/proto/ontology-hub.tsx
```

Expected:

- validator passes;
- no UI copy exposes personal owner name;
- leadgen is mentioned only as out of scope or separate future ontology.

## Task 7: Full Local Verification Before User Test

**Files:** no file changes.

- [ ] **Step 1: Run targeted tests**

```bash
pnpm ontology:validate
node --test scripts/validate-attraction-ontology.test.mjs
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/attraction-ontology.test.ts apps/api/test/http.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/ontology-hub.test.tsx apps/web/src/proto/proto-app.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run broader checks**

```bash
pnpm --filter @bitrix24-reporting/contracts build
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm lint
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Start local app**

```bash
pnpm start
```

Expected:

- local web and API start successfully;
- dashboard loads for attraction users;
- `Онтология` tab is visible in attraction;
- `Онтология` tab is not visible in leadgen;
- API `GET /api/modules/leadgen/ontology` returns no ontology data.

- [ ] **Step 4: Manual local smoke**

Open the local dashboard and check:

- Ontology Hub is readable on desktop width;
- key source links open in a new tab;
- conversion events sheet is linked as source;
- outcome cards distinguish `Корзина`, `Прогрев`, `Возврат в Лидген(неквал)`, `Отклонено потребителем`;
- drift block is visible and not alarming when there is no drift;
- report links are visible and point to stable report blocks;
- comments still attach to stable ontology blocks.

Stop here and wait for local user acceptance.

## Task 8: User Acceptance Gate

**Files:** no file changes unless user reports issues.

- [ ] **Step 1: Send local test checklist to user**

Include:

- URL;
- which account/module to open;
- what to check in `Онтология`;
- explicit note that leadgen is not included.

- [ ] **Step 2: Wait for user result**

Allowed outcomes:

- approved for deploy;
- needs copy/layout fixes;
- needs ontology content fixes;
- blocked by data/API issue.

- [ ] **Step 3: Fix only reported issues**

If fixes are needed, return to the smallest relevant task and rerun Task 7.

Do not deploy before explicit user approval.

## Task 9: PR, CI, Deploy, Production Verification

**Files:** no additional code changes unless CI fails.

- [ ] **Step 1: Prepare git state**

Before committing:

```bash
git status --short
git diff -- docs/modules/attraction apps/api apps/web packages/contracts scripts package.json
```

Confirm only ontology-hub changes are included. Preserve unrelated WIP in a separate branch/commit if needed before switching or merging.

- [ ] **Step 2: Commit after user approval**

Use a scoped message:

```bash
git add docs/modules/attraction apps/api apps/web packages/contracts scripts package.json
git commit -m "feat(attraction): add ontology hub"
```

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin codex/attraction-ontology-hub
```

Open a draft PR first. Mark ready only after CI passes.

- [ ] **Step 4: Wait for CI**

Required checks:

- API tests;
- web tests;
- lint;
- typecheck;
- Docker build if configured.

Fix CI failures on the same branch and rerun relevant local checks.

- [ ] **Step 5: Merge and wait for production deploy**

After approval and green checks, merge to `main` and wait for the GitHub Actions production deploy workflow.

- [ ] **Step 6: Production smoke**

Run the standard production checks without printing secrets:

```bash
curl -fsS https://dashboardpriv.claricont.com/api/health
```

Expected:

```json
{"ok":true}
```

Then verify through the browser with an authenticated session:

- attraction dashboard loads;
- `Онтология` tab is visible;
- leadgen dashboard does not show `Онтология`;
- ontology source links render;
- report links are present;
- no personal data appears in ontology UI.

- [ ] **Step 7: Production API boundary check**

With authenticated session, verify:

- `/api/ontology` returns attraction ontology;
- `/api/modules/attraction/ontology` returns attraction ontology;
- `/api/modules/leadgen/ontology` returns `404 NOT_FOUND`.

Unauthenticated access should return `401`.

## Self-Review

Spec coverage:

- Attraction-only scope is covered in Tasks 2, 4, 7, and 9.
- Source links and regulation evidence are covered in Tasks 1, 4, and 6.
- Dashboard links to report blocks are covered in Task 5.
- Drift and update workflow are covered in Tasks 1, 2, and 6.
- Local build, local user test, and deploy sequencing are covered in Tasks 7, 8, and 9.

Placeholder scan:

- No implementation placeholders are left for core behavior.
- Uncertain future leadgen ontology is explicitly out of scope, not a placeholder.

Risk notes:

- Current worktree is dirty. Execute this plan on a clean task branch `codex/attraction-ontology-hub` after preserving existing WIP.
- The registry must not include personal data or personal owner names in UI-facing fields.
- If Docker/runtime cannot read docs files reliably, move the registry file into `packages/contracts/src/ontology/attraction.ts` and keep docs registry generated from that source in the same PR.
