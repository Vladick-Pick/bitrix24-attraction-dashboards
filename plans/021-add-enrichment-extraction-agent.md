# Plan 021: Add the CRM enrichment extraction agent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/openrouter-call-analysis.ts apps/api/src/server/call-enrichment-fields.ts apps/api/test/openrouter-call-analysis.test.ts apps/api/test/call-enrichment-fields.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/016-add-call-enrichment-field-allowlist.md, plans/020-wire-automatic-call-analysis-enrichment-orchestrator.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The full call analysis prompt intentionally says "CRM-атрибуты не генерируй".
That is correct for quality analysis, but the new feature needs a separate agent
that extracts only the approved CRM enrichment fields. Keeping extraction
separate makes the prompt smaller, testable, and easier to block when it tries
to return unauthorized fields.

## Current state

Relevant files:

- `apps/api/src/server/openrouter-call-analysis.ts` - current strict JSON schema
  OpenRouter provider.
- `apps/api/src/server/call-enrichment-fields.ts` - field allowlist from Plan
  016.
- `apps/api/test/openrouter-call-analysis.test.ts` - provider/schema tests.

Current excerpts:

- `apps/api/src/server/openrouter-call-analysis.ts:43-87` defines strict schema
  for full analysis.
- `apps/api/src/server/openrouter-call-analysis.ts:403-437` builds the
  OpenRouter chat request with `response_format.json_schema.strict=true`.
- `apps/api/src/server/openrouter-call-analysis.ts:440-463` includes the line
  "CRM-атрибуты не генерируй".
- `apps/api/test/openrouter-call-analysis.test.ts:131-139` asserts prompt text
  contains `CRM-атрибуты не генерируй` and does not contain deal/source/stage.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Extraction tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-enrichment-extraction.test.ts` | exits 0 |
| Existing analysis tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-call-analysis.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/openrouter-enrichment-extraction.ts` (create)
- `apps/api/src/server/call-enrichment-fields.ts` only if descriptors need
  schema helper exports
- `apps/api/test/openrouter-enrichment-extraction.test.ts` (create)
- `apps/api/test/openrouter-call-analysis.test.ts` only to guard no regression

**Out of scope**:

- Current Bitrix value reads.
- Diff/proposal creation.
- Telegram.
- Bitrix writes.
- Modifying the existing full analysis prompt to extract CRM fields.

## Git workflow

- Branch: `codex/enrichment-extraction-agent`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Create extraction provider and schema

Create `apps/api/src/server/openrouter-enrichment-extraction.ts`.

Input:

```ts
interface ExtractCallEnrichmentInput {
  callId: string;
  fullTranscriptText: string;
  transcriptByRoles: unknown[];
  analysisSummary?: string | null;
  dealId: string;
  contactId: string;
}
```

Output:

```ts
interface CallEnrichmentCandidate {
  entity: "contact" | "deal";
  fieldCode: string;
  fieldTitle: string;
  proposedValue: unknown;
  rawMention: string;
  evidenceSnippet: string;
  confidence: number;
  explicitness: "explicit" | "inferred";
  overwriteRisk: "low" | "medium" | "high";
}
```

Use Zod to parse the provider response and then validate every `fieldCode` with
`call-enrichment-fields.ts`.

Do not trust the model's `fieldTitle` or `entity`; normalize them from the
field descriptor after validation.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 2: Build strict JSON schema from descriptors

The JSON schema must constrain `fieldCode` to the approved codes. It should not
allow arbitrary strings for fields.

Use the descriptor arrays from Plan 016 to generate:

- enum of contact field codes;
- enum of deal field codes;
- `entity` enum;
- `confidence` 0..1.

If JSON schema generation from descriptors becomes too complex, hardcode the
enum once in this provider and add a test that it matches
`CALL_ENRICHMENT_ALL_FIELD_CODES`. Do not maintain two untested allowlists.

**Verify**: new extraction tests assert schema field enum equals descriptor
field codes.

### Step 3: Write the extraction prompt

Prompt requirements:

- Extract only fields from the provided schema.
- Do not invent facts.
- Prefer no candidate over a low-confidence candidate.
- Mark values as `explicit` only when the participant directly says it.
- Do not infer sensitive personal facts from tone, name, or background.
- Deal fields:
  - `UF_CRM_1766147164481` for `Ключевые проекты`;
  - `UF_CRM_1766147207634` for `Связи и знакомства внутри клуба`.
- All other approved fields are contact fields.
- If a value only confirms an already-known fact, still return candidate; the
  diff layer will decide whether to notify.
- Keep `evidenceSnippet` short and do not include full transcript.

**Verify**: tests inspect request body prompt text and schema.

### Step 4: Add normalization helpers

Normalize model output:

- trim strings;
- reject empty strings;
- parse integers/doubles;
- validate urls for `url` fields;
- map enum labels to known option ids when descriptor includes enum options;
- for `crm_multiple`/`iblock_element`, return a structured unresolved value if
  ID mapping is not available yet:

```ts
{ kind: "unresolved_reference", label: "Москва" }
```

Do not create new Bitrix reference values.

**Verify**: tests for string/number/enum/url/unresolved reference normalization.

### Step 5: Add tests

Create `apps/api/test/openrouter-enrichment-extraction.test.ts`:

- sends transcript text and strict schema to OpenRouter;
- returns normalized contact candidate for `Оборот бизнеса`;
- returns normalized deal candidate for `Ключевые проекты`;
- rejects unknown `UF_CRM_*`;
- rejects a deal field marked as contact by the model and normalizes from
  descriptor;
- rejects low-confidence/empty candidate;
- preserves short evidence snippet;
- does not modify existing full analysis prompt tests.

## Test plan

- New extraction provider tests.
- Existing full analysis provider tests must still pass.

## Done criteria

- [ ] Separate extraction provider exists.
- [ ] Full call analysis prompt still does not extract CRM attributes.
- [ ] Extraction schema allows only approved field codes.
- [ ] Candidate normalization rejects empty/invalid values.
- [ ] Deal/contact ownership is normalized from descriptors, not model trust.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- The extractor needs current CRM values in the prompt to work. That belongs to
  the diff layer and risks prompt leakage of stored CRM data.
- Product owner asks to extract fields outside the approved allowlist.
- The model needs full transcript to be sent to Telegram; Telegram receives only
  short evidence later.

## Maintenance notes

Extraction output is a candidate list, not a write instruction. Reviewers should
look for any code path that treats model output as authoritative.

