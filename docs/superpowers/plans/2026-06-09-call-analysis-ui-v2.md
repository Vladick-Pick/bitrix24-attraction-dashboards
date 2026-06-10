# Call Analysis UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `calls-v2` analysis in the product UI without losing any AI output, transcript, CRM attributes, evidence, scores, or raw JSON.

**Architecture:** Treat backend SQLite as the source of truth for persisted call analysis. Keep CRM attributes code-owned and AI analysis model-owned. The frontend must normalize known `calls-v2` fields for UI, while preserving the raw AI object so future prompt fields are still inspectable.

**Tech Stack:** TypeScript, React, Vite, Vitest, SQLite-backed API, OpenRouter Gemini audio analysis, existing project design system in `design.md` / `proto.css`.

**Execution status 2026-06-10:** Contract, backend, API client, queue UI, selected-call details, transcript, `calls-v2` analysis sections, raw JSON, ready/error action rules, and automated tests are implemented on `codex/openrouter-call-analysis`. Review Gate 1 found a raw-data preservation gap across provider -> service -> SQLite; the backend now persists `raw_ai_evaluation_json` separately from normalized `ai_evaluation_json`, and the web normalizer preserves server `rawAiEvaluation`. Review Gate 1 also added active-run protection, recording download timeout/size guards, timestamp-based stage lookup, stale selected-call UI reset, and manual apply semantics for filters. Session 4 tabs are deferred; the current UI exposes the same data as stacked sections plus a collapsible Raw JSON block. Browser screenshot QA is still pending and remains a separate gate before final completion.

---

## Current State

- Backend persists full transcript, normalized `aiEvaluation`, separate `rawAiEvaluation`, attributes, model, promptVersion, timestamps in `call_analysis_results`.
- `calls-v2` now returns:
  - `score`
  - `callClassification`
  - `rubricApplicability`
  - `communicationScore`
  - `narrativeScore`
  - `callTypeInterpretation`
  - `summary`
  - `strengths`
  - `risks`
  - `nextStepQuality`
  - `suggestedNextStep`
  - `emotionalBackground`
  - `evidenceQuotes`
  - `confidence`
- Frontend now normalizes the known `calls-v2` fields and preserves backend `rawAiEvaluation` for unknown future fields.
- `apps/web/src/proto/call-analysis-workspace.tsx` is the current first-class React screen for the call analysis section.

## Non-Negotiable Data Contract

No `calls-v2` data may be lost between SQLite, API response, frontend normalizer, component state, and UI.

Required preservation layers:

```ts
aiEvaluation: {
  score: number
  callClassification: { type: string; confidence: number; reason: string }
  rubricApplicability: { level: string; reason: string }
  communicationScore: {
    score: number
    rationale: string
    evidenceQuotes: string[]
  }
  narrativeScore: {
    score: number
    rationale: string
    evidenceQuotes: string[]
    applicableNarratives: string[]
    missedNarratives: string[]
  }
  callTypeInterpretation: string
  summary: string
  strengths: string[]
  risks: string[]
  nextStepQuality: string
  suggestedNextStep: string
  emotionalBackground: {
    managerTone: string
    clientTone: string
    frictionSignals: string[]
    confidence: number
  }
  evidenceQuotes: string[]
  confidence: number
}
rawAiEvaluation: Record<string, unknown>
```

`rawAiEvaluation` is mandatory. It is the safety net for future prompt fields.

## Files

### Contract And Normalization

- Modify: `packages/contracts/src/index.ts`
  - Add `CallAnalysisClassification`, `CallAnalysisRubricApplicability`, `CallAnalysisScoreBlock`, `CallAnalysisNarrativeScore`.
  - Extend `CallAnalysisAiEvaluation`.
  - Add `rawAiEvaluation` to `CallAnalysisResult`.
- Modify: `apps/web/src/lib/dashboard-types.ts`
  - Mirror contract changes for frontend use.
- Modify: `apps/web/src/lib/api-client.ts`
  - Normalize all known `calls-v2` fields.
  - Preserve raw AI object.
- Modify: `apps/web/src/lib/api-client.test.ts`
  - Add regression test proving no `calls-v2` fields are dropped.

### UI

- Create or modify: `apps/web/src/proto/call-analysis-workspace.tsx`
  - First-class call analysis screen.
  - Queue, selected call details, analysis panel, transcript, rubric-style sections, raw JSON.
- Modify: `apps/web/src/proto/proto-app.tsx`
  - Route/sidebar switch between `Аналитика` and `Анализ звонков`.
  - Load call list and selected analysis state.
- Modify only if needed: `apps/web/src/proto/proto.css`
  - Shared screen layout, tabs, score cards, transcript rows, raw JSON pre block.
- Modify: `apps/web/src/App.test.tsx` or create `apps/web/src/proto/call-analysis-screen.test.tsx`
  - UI regression tests for rendered `calls-v2` analysis.

### Backend Safety

- Modify if needed: `apps/api/src/server/app.ts`
  - Ensure API returns result unchanged enough for frontend raw preservation.
- Modify if needed: `apps/api/test/http.test.ts`
  - Verify `calls-v2` fields are returned from analysis endpoints.

## Session 1: Contract And Normalizer

**Purpose:** Make it impossible for the frontend to drop `calls-v2` fields silently.

- [ ] Read current types in `packages/contracts/src/index.ts` and `apps/web/src/lib/dashboard-types.ts`.
- [ ] Add frontend/API type definitions for `callClassification`, `rubricApplicability`, `communicationScore`, `narrativeScore`.
- [ ] Add `rawAiEvaluation: Record<string, unknown>` to `CallAnalysisResult`.
- [ ] Update `normalizeCallAnalysisAiEvaluation` in `apps/web/src/lib/api-client.ts`.
- [ ] Update `normalizeCallAnalysisResult` to set `rawAiEvaluation`.
- [ ] Add a failing test to `apps/web/src/lib/api-client.test.ts`:

```ts
expect(analyzed.result.aiEvaluation.communicationScore.score).toBe(96)
expect(analyzed.result.aiEvaluation.narrativeScore.missedNarratives).toContain(
  'Club First не продается как календарь мероприятий',
)
expect(analyzed.result.rawAiEvaluation).toMatchObject({
  communicationScore: expect.any(Object),
  narrativeScore: expect.any(Object),
  rubricApplicability: expect.any(Object),
})
```

- [ ] Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/web typecheck
```

**Review Gate 1**

- [ ] Run `git diff -- packages/contracts/src/index.ts apps/web/src/lib/dashboard-types.ts apps/web/src/lib/api-client.ts apps/web/src/lib/api-client.test.ts`.
- [ ] Run CRG `detect_changes_tool` for the changed contract/normalizer files.
- [ ] Review question: "Can any field from the persisted `aiEvaluation` disappear before UI render?"
- [ ] Fix every dropped-field or type mismatch finding before starting Session 2.

**Done When**

- API client test proves `calls-v2` known fields and raw object survive normalization.
- Web typecheck passes.

## Session 2: UI Data Model And Loading States

**Purpose:** Connect the screen to real API data without starting from visual polish.

- [ ] Create a small UI data adapter, colocated with the screen, that derives:
  - score cards
  - classification badge
  - rubric applicability badge
  - transcript rows
  - raw JSON text
- [ ] Add states:
  - no selected call
  - selected call without analysis
  - analyzing
  - ready
  - error
- [ ] Ensure ready results are not auto reanalyzed. Manual analyze button should:
  - start analysis only when no ready result exists
  - allow retry only when latest run is error, if backend exposes that state
- [ ] Add tests for adapter behavior:

```ts
expect(toCallAnalysisViewModel(result).scoreCards).toEqual([
  expect.objectContaining({ label: 'Score', value: '96' }),
  expect.objectContaining({ label: 'Communication', value: '96' }),
  expect.objectContaining({ label: 'Narrative', value: '96' }),
])
```

- [ ] Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/web typecheck
```

**Review Gate 2**

- [ ] Self-review all null/undefined handling.
- [ ] Confirm no UI adapter reads CRM attributes from `aiEvaluation`.
- [ ] Fix any state that can show stale analysis for a newly selected call.

**Done When**

- Screen state model can render all backend states without runtime errors.
- Existing API client tests still pass.

## Session 3: Main Call Analysis Screen

**Purpose:** Build the real interface around the data model.

- [ ] Implement the two-section navigation:
  - `Аналитика`
  - `Анализ звонков`
  - collapsible sidebar remains available.
- [ ] Implement call queue:
  - compact rows
  - manager/date/source/type/status filters
  - selected call highlight
  - score/status column
- [ ] Implement selected call header:
  - ID
  - manager
  - startedAt
  - call type
  - duration
  - deal ID
  - stage at call
  - source
  - model/promptVersion/analyzedAt if ready
- [ ] Implement action area:
  - `Проанализировать` only when no ready result exists
  - `Повторить после ошибки` only for error state
  - `Таймлайн` link placeholder with deal ID
- [ ] Add UI tests:

```ts
expect(screen.getByText('Communication')).toBeInTheDocument()
expect(screen.getByText('Narrative')).toBeInTheDocument()
expect(screen.getByText('calls-v2')).toBeInTheDocument()
expect(screen.getByText('Звонок-знакомство')).toBeInTheDocument()
```

- [ ] Run:

```bash
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/web typecheck
```

**Review Gate 3**

- [ ] Use `reviewer` stance or reviewer agent for UI logic and data loss review.
- [ ] Fix all P0/P1 findings before continuing.
- [ ] Defer only visual polish findings that do not hide or corrupt data.

**Done When**

- User can select a call and see full top-level `calls-v2` analysis values.

## Session 4: Detail Tabs

**Purpose:** Make the full analysis inspectable without overcrowding the main screen.

- [ ] Add tabs:
  - `Разбор`
  - `Rubric`
  - `Transcript`
  - `Raw JSON`
- [ ] `Разбор` tab:
  - summary
  - strengths
  - risks
  - next step
  - emotional background
  - evidence quotes
- [ ] `Rubric` tab:
  - communication rationale/evidence
  - narrative rationale/evidence
  - applicable narratives
  - missed narratives
  - rubric applicability reason
- [ ] `Transcript` tab:
  - role
  - timestamp
  - text
  - stable row height and wrapping
- [ ] `Raw JSON` tab:
  - `JSON.stringify(rawAiEvaluation, null, 2)`
  - copy button if existing UI patterns support it; otherwise skip.
- [ ] Preserve tab state while selecting within the same call. Reset tab only when call ID changes.
- [ ] Add UI tests:

```ts
await user.click(screen.getByRole('tab', { name: /Raw JSON/i }))
expect(screen.getByText(/communicationScore/)).toBeInTheDocument()
expect(screen.getByText(/narrativeScore/)).toBeInTheDocument()

await user.click(screen.getByRole('tab', { name: /Transcript/i }))
expect(screen.getByText(/manager/i)).toBeInTheDocument()
```

**Review Gate 4**

- [ ] Run browser check at desktop width.
- [ ] Inspect for text clipping and overlap.
- [ ] Fix any clipped score cards, transcript rows, side panel overflow, or invisible raw JSON.

**Done When**

- Every `calls-v2` field is either shown directly or visible in Raw JSON.

## Session 5: Browser QA And Design Pass

**Purpose:** Validate actual usability in the in-app browser.

- [ ] Start local app if not already running:

```bash
pnpm dev:web
```

- [ ] Open `http://127.0.0.1:5173/` in Browser plugin.
- [ ] Verify desktop viewport:
  - sidebar navigation works
  - call analysis screen opens
  - queue is compact
  - selected call does not overflow
  - analysis cards fit
  - tabs work
  - transcript scrolls
  - raw JSON is visible
- [ ] Verify mobile/narrow viewport:
  - no horizontal text clipping
  - cards stack predictably
  - buttons remain usable
- [ ] Visual metrics:
  - no nested cards inside cards
  - no decorative gradient blobs
  - font size matches current product density
  - score cards fit without layout shift
  - long Russian words wrap inside containers

**Review Gate 5**

- [ ] Run design self-review against `design.md`.
- [ ] Use `frontend` or reviewer agent for visual/UX review if available.
- [ ] Fix layout regressions before final verification.

**Done When**

- Browser screenshots prove the screen is usable at desktop and narrow widths.

## Session 6: Backend/API Safety Review

**Purpose:** Check privacy and endpoint behavior before calling the feature ready.

- [ ] Verify API does not return audio bytes or recording URLs in analysis result.
- [ ] Verify `attributes` are code-derived and not part of prompt input.
- [ ] Verify ready result reuse still prevents accidental repeated analysis.
- [ ] Verify error runs can be retried when the selected call has no ready result.
- [ ] Run:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api lint
```

**Review Gate 6**

- [ ] Security/privacy review:
  - transcript is full text and visible to all module users by current MVP decision
  - no audio stored
  - no secrets in logs or UI
  - no recording URL exposed to frontend
- [ ] Fix every auth/privacy leak before final report.

**Done When**

- Backend behavior matches MVP privacy decision and does not expand risk accidentally.

## Session 7: Final Verification And Handoff

- [ ] Run full relevant checks:

```bash
pnpm --filter @bitrix24-reporting/api test -- --runInBand
pnpm --filter @bitrix24-reporting/api typecheck
pnpm --filter @bitrix24-reporting/api lint
pnpm --filter @bitrix24-reporting/web exec vitest run
pnpm --filter @bitrix24-reporting/web typecheck
pnpm --filter @bitrix24-reporting/web lint
```

- [ ] Run `git diff` and inspect changed files.
- [ ] Run CRG `detect_changes_tool`.
- [ ] Run final code review with reviewer stance:
  - findings first
  - P0/P1 fixed
  - P2 either fixed or explicitly deferred
- [ ] Re-run tests after fixes.
- [ ] Final browser smoke:
  - analysis screen opens
  - `calls-v2` fields visible
  - transcript visible
  - Raw JSON visible

**Done When**

- No known data loss.
- Tests pass.
- Browser verified.
- Final report includes branch, changed scope, verification, CRG tools, and remaining risk.

## Quality Metrics

### Data Completeness

- 100% of known `calls-v2` fields have typed access in frontend.
- 100% of unknown future AI fields remain available in `rawAiEvaluation`.
- Raw JSON tab contains `communicationScore`, `narrativeScore`, `rubricApplicability`, and `callClassification`.

### UI Completeness

- Each selected ready analysis shows:
  - overall score
  - communication score
  - narrative score
  - classification
  - applicability
  - summary
  - strengths
  - risks
  - next step
  - emotional background
  - evidence
  - transcript
  - raw JSON
- CRM attributes are displayed from `attributes`, not AI output.

### Behavioral Correctness

- Ready result is reused, not reanalyzed automatically.
- Manual analyze works for calls without ready analysis.
- Retry path is available only after error or no ready result.
- Selecting another call does not show stale analysis from previous call.

### Design Quality

- No clipped text at desktop and narrow widths.
- No oversized fonts compared to the current dashboard.
- Queue remains compact.
- AI panel width and selected-call panel remain balanced.
- Long transcript lines wrap without horizontal page scroll.

### Privacy/Safety

- No audio persisted in SQLite.
- No recording URL exposed in frontend JSON.
- Full transcript visibility remains an explicit MVP risk, not an accidental leak.
- API key never appears in logs, tests, UI, or final output.

## Test Matrix

| Layer | Command | Pass Criteria |
| --- | --- | --- |
| API contract | `pnpm --filter @bitrix24-reporting/api test -- --runInBand` | Existing call analysis and HTTP tests pass |
| API call analysis service | `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-analysis-service.test.ts` | Active run guard, recording timeout signal, size cap, raw provider fields pass |
| API SQLite persistence | `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts` | `raw_ai_evaluation_json` persists separately and stage-at-call uses timestamp order |
| API OpenRouter provider | `pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-call-analysis.test.ts` | Parsed analysis and raw model JSON both survive |
| API types | `pnpm --filter @bitrix24-reporting/api typecheck` | No TypeScript errors |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | No lint errors |
| Web normalizer | `pnpm --filter @bitrix24-reporting/web exec vitest run src/lib/api-client.test.ts` | `calls-v2` fields and raw object survive |
| Web call analysis UI | `pnpm --filter @bitrix24-reporting/web exec vitest run src/proto/proto-app.test.tsx` | Selected-call result reset and manual filter apply behavior pass |
| Web UI | `pnpm --filter @bitrix24-reporting/web exec vitest run` | Tabs/cards/render tests pass |
| Web types | `pnpm --filter @bitrix24-reporting/web typecheck` | No TypeScript errors |
| Web lint | `pnpm --filter @bitrix24-reporting/web lint` | No lint errors |
| Browser desktop | Browser plugin screenshot | No clipping/overlap, all panels usable |
| Browser narrow | Browser plugin screenshot | Responsive layout usable |
| Data smoke | SQLite query on `call_analysis_results` | `prompt_version='calls-v2'` and JSON has expected keys |

## Review Cadence

Every session has a mandatory review/fix checkpoint:

1. Contract review after Session 1.
2. State/data review after Session 2.
3. UI review after Session 3.
4. Detail/tabs review after Session 4.
5. Browser/design review after Session 5.
6. Privacy/backend review after Session 6.
7. Final integrated review after Session 7.

No session is considered done until its review findings are either fixed or explicitly deferred with a reason.
