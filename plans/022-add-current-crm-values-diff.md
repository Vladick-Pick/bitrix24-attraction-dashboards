# Plan 022: Add current CRM value reads and meaningful enrichment diff

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/bitrix/client.ts apps/api/src/bitrix/selectors.ts apps/api/src/bitrix/security.ts apps/api/src/server/call-enrichment-fields.ts apps/api/src/server/call-enrichment-orchestrator.ts apps/api/test/security.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/016-add-call-enrichment-field-allowlist.md, plans/021-add-enrichment-extraction-agent.md
- **Category**: feature
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The manager should not receive noise. If the conversation only confirms values
already present in Bitrix, there should be no Telegram message. This plan reads
only the approved current CRM fields and classifies candidates into: fill empty,
material overwrite, duplicate confirmation, low confidence, or conflict.

## Current state

Relevant files:

- `apps/api/src/bitrix/client.ts` - Bitrix REST client and read methods.
- `apps/api/src/bitrix/selectors.ts` - read selectors and method allowlist.
- `apps/api/src/bitrix/security.ts` - field/method guards.
- `apps/api/src/server/call-enrichment-fields.ts` - field descriptors from Plan
  016.

Current excerpts:

- `apps/api/src/bitrix/client.ts:183-186` defines a generic `ContactRow`.
- `apps/api/src/bitrix/selectors.ts:36-53` includes `crm.contact.list`,
  `crm.contact.fields`, `crm.deal.fields`, and read methods, but no update.
- `apps/api/src/bitrix/security.ts:34-49` supports safe custom-field selection
  when `allowedCustomFields` is passed.
- `apps/api/src/server/call-analysis-service.ts:255-258` already resolves a
  `dealId` via call/activity context, and Plan 020 adds `contactId`.

External docs note:

- Bitrix REST field metadata can be fetched with `crm.contact.fields` and
  `crm.deal.fields`; updates use a `fields` object for the target entity. Custom
  user fields use original `UF_CRM_*` names when `useOriginalUfNames` is enabled
  or when legacy entity-specific methods accept original names.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Security tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/security.test.ts test/call-enrichment-diff.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/bitrix/client.ts`
- `apps/api/src/bitrix/selectors.ts`
- `apps/api/src/bitrix/security.ts`
- `apps/api/src/server/call-enrichment-current-values.ts` (create)
- `apps/api/src/server/call-enrichment-diff.ts` (create)
- `apps/api/src/server/call-enrichment-orchestrator.ts`
- `apps/api/test/call-enrichment-diff.test.ts` (create)
- `apps/api/test/security.test.ts`

**Out of scope**:

- Bitrix write methods.
- Telegram.
- New CRM reference record creation.
- Dashboard UI.

## Git workflow

- Branch: `codex/call-enrichment-current-values-diff`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add safe read selectors for enrichment current values

Add selector helpers that build params for:

- current contact values by contact id;
- current deal enrichment values by deal id.

Use only:

- `ID`;
- approved contact field codes for contacts;
- approved deal field codes plus `ID`, `CONTACT_ID`, `ASSIGNED_BY_ID` if needed
  for deals.

Call `assertSafeSelectFields` with the approved custom field codes. Do not use
`select: ["*"]`.

**Verify**: security tests reject selectors with non-allowlisted `UF_*`.

### Step 2: Add Bitrix client methods

In `apps/api/src/bitrix/client.ts`, add methods such as:

- `getContactEnrichmentValues(contactId: string)`
- `getDealEnrichmentValues(dealId: string)`
- optional `getCallEnrichmentFieldMetadata()`

Use existing Bitrix request style and rate-limit handling. Do not print raw
response bodies. Return maps keyed by field code with raw Bitrix values.

If `crm.contact.list`/`crm.deal.list` by id is used, validate method and fields
with the security helpers. Do not use forbidden single-record `crm.contact.get`
or `crm.deal.get` unless Plan 015/SECURITY explicitly allowed it; current
contract forbids those methods.

**Verify**: typecheck and new client unit tests with mocked fetch.

### Step 3: Normalize current and proposed values

Create `apps/api/src/server/call-enrichment-current-values.ts`.

Responsibilities:

- parse current values from Bitrix row maps;
- normalize empty values: `null`, `undefined`, empty string, empty array;
- normalize enum values by option id when available;
- normalize numbers with numeric comparison;
- normalize urls by trimmed string;
- normalize text by trimmed whitespace but do not over-merge different facts;
- normalize multiple/reference fields into arrays of ids/labels.

For `city` and `primaryIndustry`, if only a label exists and no id mapping can
be confirmed, mark as unresolved and do not make it writable.

**Verify**: unit tests for empty, same enum, same text with whitespace, number,
url, unresolved reference.

### Step 4: Implement meaningful diff

Create `apps/api/src/server/call-enrichment-diff.ts`.

Input:

- candidates from Plan 021;
- current contact/deal values;
- field descriptors.

Output:

```ts
type EnrichmentDiffDecision =
  | { kind: "proposal"; actionType: "fill_empty" | "overwrite"; ... }
  | { kind: "skip"; reason: "duplicate_confirmation" | "low_confidence" | "unmapped_reference" | "invalid_value" | "not_writable_v1" };
```

Rules:

- Empty current + confident valid candidate -> `fill_empty`.
- Non-empty current + materially different confident candidate -> `overwrite`.
- Non-empty current + same normalized value -> skip duplicate confirmation.
- Low confidence -> skip.
- Inferred sensitive/personal value -> skip unless field explicitly allows
  inferred values; default is no inferred sensitive facts.
- Unmapped reference -> proposal may be stored as not writable only if Telegram
  should show it later; V1 recommendation is skip with audit reason until mapping
  is implemented.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/call-enrichment-diff.test.ts`.

### Step 5: Wire diff into orchestrator without Telegram

After extraction, orchestrator should:

- fetch current CRM values;
- build diff decisions;
- if no proposals, record `skipped_no_material_updates` and stop;
- if proposals exist, call repository creation methods from Plan 017;
- do not send Telegram yet.

**Verify**: orchestrator tests prove no proposal -> no Telegram/downstream call.

## Test plan

- New `apps/api/test/call-enrichment-diff.test.ts`.
- Extend `apps/api/test/security.test.ts`.
- Extend orchestrator tests from Plan 020.

## Done criteria

- [ ] Current value reads select only approved fields.
- [ ] `crm.contact.get` and `crm.deal.get` remain unused unless security docs
  explicitly changed.
- [ ] Diff skips duplicate confirmations.
- [ ] Diff creates proposals only for fill-empty or material overwrite.
- [ ] No Telegram is sent in this plan.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- Current values require forbidden fields such as names, phone, email, comments,
  or raw payloads.
- Bitrix cannot read required custom fields through list/select under the current
  webhook permissions.
- Reference fields cannot be mapped to ids; mark them non-writable for V1 rather
  than inventing ids.

## Maintenance notes

Reviewers should focus on false positives. The correct default is silence: when
the system is not sure, it should create no proposal and write an audit reason.

