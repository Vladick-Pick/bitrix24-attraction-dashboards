# Plan 024: Add the narrow Bitrix enrichment write adapter

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/bitrix/client.ts apps/api/src/bitrix/security.ts apps/api/src/server/call-enrichment-fields.ts apps/api/src/server/call-enrichment-current-values.ts apps/api/src/server/sqlite/enrichment-proposals.ts apps/api/test/security.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: plans/015-record-call-enrichment-security-contract.md, plans/016-add-call-enrichment-field-allowlist.md, plans/022-add-current-crm-values-diff.md, plans/023-add-telegram-enrichment-approval-flow.md
- **Category**: security
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

This is the only destructive part of the feature. The adapter must not accept
arbitrary Bitrix method names or arbitrary field maps. It should apply only a
stored, unexpired, manager-approved proposal, re-read the current Bitrix field,
and write exactly one approved field to the correct entity.

## Current state

Relevant files:

- `apps/api/src/bitrix/client.ts` - Bitrix REST client and allowed request style.
- `apps/api/src/bitrix/security.ts` - method/field guards.
- `apps/api/src/server/call-enrichment-fields.ts` - entity/field allowlist.
- `apps/api/src/server/call-enrichment-current-values.ts` - current value
  normalization from Plan 022.
- `apps/api/src/server/sqlite/enrichment-proposals.ts` - proposal lifecycle from
  Plan 017.

Current excerpts:

- `apps/api/src/bitrix/security.ts:28-31` currently throws on methods outside
  `ALLOWED_BITRIX_METHODS`.
- `apps/api/src/bitrix/security.ts:34-49` rejects forbidden and unapproved
  custom fields in selects.
- `apps/api/src/bitrix/client.ts:317-320` has safe Bitrix error description
  helpers; do not log raw secrets.
- `apps/api/src/server/telegram-client.ts` should only call a decision service,
  not Bitrix directly, after Plan 023.

External docs note:

- Bitrix update methods accept an `id` and a `fields` object. For deal custom
  fields, official examples show `crm.deal.update` with `fields:
  { UF_CRM_...: value }`. Universal `crm.item.update` supports
  `useOriginalUfNames`, but this plan should use the narrower entity-specific
  methods approved in SECURITY unless ADR/security review chooses otherwise.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Security/write tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/security.test.ts test/call-enrichment-writeback.test.ts` | exits 0 |
| SQLite tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/sqlite.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| API lint | `pnpm --filter @bitrix24-reporting/api lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/bitrix/client.ts`
- `apps/api/src/bitrix/security.ts`
- `apps/api/src/server/call-enrichment-writeback.ts` (create)
- `apps/api/src/server/call-enrichment-fields.ts`
- `apps/api/src/server/call-enrichment-current-values.ts`
- `apps/api/src/server/sqlite/enrichment-proposals.ts`
- `apps/api/test/call-enrichment-writeback.test.ts` (create)
- `apps/api/test/security.test.ts`
- `apps/api/test/sqlite.test.ts`

**Out of scope**:

- Bulk apply all proposals.
- Auto-write without manager action.
- Manual Telegram value editing.
- Writing fields outside the allowlist.
- Creating Bitrix reference/catalog values.

## Git workflow

- Branch: `codex/bitrix-enrichment-write-adapter`.
- Do not commit, push, or open a PR unless instructed.

## Steps

### Step 1: Add Bitrix client update methods behind explicit guards

In `apps/api/src/bitrix/client.ts`, add:

- `updateContactEnrichmentField(input)`
- `updateDealEnrichmentField(input)`

Each method accepts:

```ts
{
  entityId: string;
  fieldCode: string;
  value: unknown;
}
```

Before calling Bitrix:

- assert method is exactly `crm.contact.update` or `crm.deal.update`;
- assert field belongs to the target entity;
- assert only one field is written;
- assert field is `writableInV1`;
- reject undefined values and unresolved references.

Request body:

```ts
{ id: entityId, fields: { [fieldCode]: value } }
```

Do not expose a generic `callMethod(method, params)` update helper to other
modules.

**Verify**: writeback tests with mocked fetch prove correct method/body and
rejection of wrong entity fields.

### Step 2: Create manager decision apply service

Create `apps/api/src/server/call-enrichment-writeback.ts`.

Input:

```ts
applyManagerEnrichmentDecision({
  proposalId,
  managerId,
  action: "approve" | "decline",
  decidedAt
})
```

Behavior for `decline`:

- mark proposal declined;
- append event;
- do not call Bitrix.

Behavior for `approve`:

1. Load proposal and batch.
2. Confirm batch/proposal are `pending`.
3. Confirm `expires_at > decidedAt`.
4. Confirm manager id matches batch manager id.
5. Confirm field descriptor exists and entity matches.
6. Re-read current Bitrix value for that one entity/field using Plan 022 reader.
7. Re-run relevant diff guard:
   - `fill_empty`: current must still be empty;
   - `overwrite`: current must still equal original `current_value_json`.
8. If stale/conflict, mark proposal `conflict`, append event, do not write.
9. If valid, call the narrow Bitrix update method.
10. Mark proposal `applied` and batch `applied` or `partially_applied`.

**Verify**: unit tests cover approve, decline, expired, wrong manager, stale
field, Bitrix failure.

### Step 3: Handle Bitrix errors without losing audit

If Bitrix update fails:

- mark proposal `failed`;
- append event with safe `errorCode`/short message;
- return a safe error to Telegram callback service;
- do not retry automatically in this plan.

Do not store raw Bitrix response body if it can include sensitive data.

**Verify**: mocked Bitrix 500/error response test.

### Step 4: Add security tests

Extend `apps/api/test/security.test.ts`:

- generic `crm.item.update` rejected unless security decision chooses it;
- `crm.contact.update` allowed only in enrichment write guard;
- contact field into deal update rejected;
- deal field into contact update rejected;
- `PHONE`, `EMAIL`, `NAME`, `COMMENTS`, `CONTACT_IDS` rejected.

**Verify**: security tests pass.

### Step 5: Wire Telegram callback decision service

Update the service interface used by Plan 023 callback route to call
`applyManagerEnrichmentDecision`.

The callback route still should not construct Bitrix fields. It passes proposal
id/action/manager id only.

**Verify**: Telegram callback tests from Plan 023 still pass after replacing the
fake decision service with the real service in one integration test.

## Test plan

- New `apps/api/test/call-enrichment-writeback.test.ts`.
- Extend `apps/api/test/security.test.ts`.
- Extend `apps/api/test/sqlite.test.ts` only if batch aggregate status helpers
  change.
- Extend Telegram callback tests for integration with apply service.

## Done criteria

- [ ] Only stored proposal id can trigger writeback.
- [ ] Writeback re-reads current CRM value before writing.
- [ ] Contact fields write only through contact update.
- [ ] `Ключевые проекты` and `Связи...` write only through deal update.
- [ ] Expired, stale, wrong-manager, wrong-entity, and failed Bitrix cases are
  auditable and do not write.
- [ ] Focused tests, typecheck, and lint pass.

## STOP conditions

Stop and report if:

- Implementing writeback requires storing or printing Bitrix webhook secrets.
- Bitrix permissions do not allow the approved update methods.
- A field requires creating a new reference/catalog option.
- Product asks for auto-write without manager click.

## Maintenance notes

This adapter is intentionally boring. Any future need for multiple-field writes,
manual edits, bulk approval, or new field types should be a new plan with
security review, not a casual extension to this adapter.

