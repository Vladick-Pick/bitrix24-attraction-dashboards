# Plan 019: Add a cheap OpenRouter dialogue gate before full call analysis

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/server/openrouter-call-analysis.ts apps/api/src/server/call-analysis-service.ts apps/api/src/config/env.ts apps/api/test/openrouter-call-analysis.test.ts apps/api/test/call-analysis-service.test.ts apps/api/test/env.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/018-add-bitrix-call-event-intake.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

Duration alone is not enough. A 30+ second call can be voicemail, a robot, or an
operator message saying the person did not answer. The full call analysis is more
expensive and creates downstream manager attention. This plan adds a cheap gate
that decides only whether a live dialogue happened.

## Current state

Relevant files:

- `apps/api/src/server/openrouter-call-analysis.ts` - current OpenRouter provider
  for full call analysis.
- `apps/api/src/server/call-analysis-service.ts` - downloads recording and calls
  the provider.
- `apps/api/src/config/env.ts` - OpenRouter model/prompt env values.
- `apps/api/test/openrouter-call-analysis.test.ts` - strict JSON schema tests.
- `apps/api/test/call-analysis-service.test.ts` - service orchestration tests.

Current excerpts:

- `apps/api/src/server/openrouter-call-analysis.ts:24-25` sets one default model
  and prompt version for full analysis.
- `apps/api/src/server/openrouter-call-analysis.ts:43-87` defines the full
  analysis schema, including `failed_or_no_conversation` classification.
- `apps/api/src/server/openrouter-call-analysis.ts:403-437` sends audio to
  OpenRouter with strict JSON schema.
- `apps/api/src/server/openrouter-call-analysis.ts:440-463` prompt says to
  classify call type but also asks for full transcript/evaluation.
- `apps/api/src/server/call-analysis-service.ts:193-198` downloads the recording
  and calls `provider.analyzeCall`.
- `apps/api/test/openrouter-call-analysis.test.ts:15-180` verifies base64 audio,
  strict schema, prompt contents, and JSON parsing.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Provider tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-call-analysis.test.ts` | exits 0 |
| Service tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-analysis-service.test.ts` | exits 0 |
| Env tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/openrouter-dialogue-gate.ts` (create) or a clearly
  separated section in `openrouter-call-analysis.ts`
- `apps/api/src/server/call-analysis-service.ts`
- `apps/api/src/config/env.ts`
- `apps/api/test/openrouter-dialogue-gate.test.ts` (create)
- `apps/api/test/call-analysis-service.test.ts`
- `apps/api/test/env.test.ts`

**Out of scope**:

- Enrichment field extraction.
- Proposal storage writes, except status reason passed through an interface.
- Telegram notifications.
- Bitrix writes.

## Git workflow

- Branch: `codex/cheap-dialogue-gate`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add dialogue gate provider and schema

Create `apps/api/src/server/openrouter-dialogue-gate.ts`.

Schema:

```ts
{
  hasDialogue: boolean;
  evidenceType:
    | "human_dialogue"
    | "voicemail"
    | "robot"
    | "silence"
    | "short_failed_call"
    | "operator_no_answer"
    | "other";
  confidence: number; // 0..1
  reason: string;
  evidenceSnippet: string;
}
```

The provider should:

- use OpenRouter chat completions endpoint;
- use strict JSON schema;
- accept `callId`, `audio`, `audioFormat`, and optional metadata such as
  duration/call failed code;
- return model, prompt version, analyzedAt, usage tokens.

Prompt requirements:

- Decide only whether a live human dialogue occurred.
- Do not evaluate sales quality.
- Do not extract CRM fields.
- Treat voicemail, robot, silence, one-sided operator messages, and "не удалось
  дозвониться" as no dialogue even if the duration is 30+ seconds.
- Return `hasDialogue=true` only when there are meaningful human replies from
  manager and client or enough evidence of real two-way conversation.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-dialogue-gate.test.ts
```

Expected: new provider tests pass.

### Step 2: Add env config

In `apps/api/src/config/env.ts`, add:

- `OPENROUTER_DIALOGUE_GATE_MODEL`, default to a cheaper model than full
  analysis. Use the product-approved OpenRouter model if provided; do not hard
  code an expensive model.
- `OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION`, default
  `dialogue-gate-v1`.
- `CALL_ANALYSIS_DIALOGUE_GATE_ENABLED`, default `"true"` if call enrichment is
  enabled, otherwise safe default `"false"` if the feature flag from Plan 018 is
  disabled.

Add tests for defaults and override parsing.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` -> exits 0.

### Step 3: Add service-level gate hook

In `apps/api/src/server/call-analysis-service.ts`, extend
`CreateCallAnalysisServiceInput` with optional `dialogueGate`.

Do not break existing manual analysis:

- Manual `analyzeCall({ triggerMode: "manual" })` should still be able to run
  full analysis. If product wants the gate on manual path too, make it explicit
  via config.
- Automatic call analysis should run the gate before full provider.

Suggested service behavior:

- Download recording once.
- Run dialogue gate.
- If `hasDialogue=false` and confidence >= threshold, finish/record a skipped
  state through the automatic orchestration layer from Plan 020.
- If confidence is low/potentially ambiguous, continue to full analysis.
- If full analysis later classifies `failed_or_no_conversation`, downstream
  enrichment should still stop.

If existing `call_analysis_runs.status` cannot represent skipped states without
schema churn, do not overload it in this plan. Return a typed gate result to the
automatic orchestrator in Plan 020.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-analysis-service.test.ts` -> exits 0.

### Step 4: Add fixtures

Add provider/service tests for:

- real two-way dialogue -> `hasDialogue=true`;
- voicemail -> `hasDialogue=false`;
- robot -> `hasDialogue=false`;
- silence/empty transcript -> `hasDialogue=false`;
- operator says no answer after 30+ seconds -> `hasDialogue=false`;
- low confidence -> full analysis still allowed by service.

Use mocked fetch/provider responses; do not call live OpenRouter in tests.

## Test plan

- New `apps/api/test/openrouter-dialogue-gate.test.ts`.
- Extend `apps/api/test/call-analysis-service.test.ts`.
- Extend `apps/api/test/env.test.ts`.

## Done criteria

- [ ] Cheap dialogue gate provider exists with strict JSON schema.
- [ ] Gate prompt does not ask for full analysis or CRM extraction.
- [ ] Automatic path can skip no-dialogue calls without Telegram.
- [ ] Existing manual call analysis tests continue to pass.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- OpenRouter model support cannot accept the same `input_audio` payload for the
  chosen cheap model.
- The gate requires full transcription from a separate paid service; that is a
  product/cost decision.
- Manual analysis behavior would change for existing users without explicit
  approval.

## Maintenance notes

Keep the gate cheap and narrow. If the prompt starts scoring sales quality or
extracting fields, it is no longer a gate and should be rejected in review.

