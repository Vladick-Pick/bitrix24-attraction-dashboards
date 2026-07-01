# Plan 016: Add the call enrichment field allowlist and value contracts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If a STOP condition occurs, stop and report; do not improvise. When done,
> update the status row for this plan in `plans/README.md` unless a reviewer says
> they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 912fb5d..HEAD -- apps/api/src/bitrix/security.ts apps/api/src/bitrix/selectors.ts apps/api/src/config/env.ts apps/api/src/server/openrouter-call-analysis.ts apps/api/test/security.test.ts apps/api/test/env.test.ts apps/api/test/openrouter-call-analysis.test.ts`
>
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding. On mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: plans/015-record-call-enrichment-security-contract.md
- **Category**: security
- **Planned at**: commit `912fb5d`, 2026-06-28

## Why this matters

The enrichment agent and Bitrix writer must share one field/entity contract. If
the allowlist is spread across prompts, selectors, env parsing, and write code,
the system can propose a contact field into a deal or accept a field that was
never approved. This plan adds the central contract before any extraction,
Telegram, or writeback code.

## Current state

Relevant files:

- `apps/api/src/bitrix/security.ts` - runtime method/field guards.
- `apps/api/src/bitrix/selectors.ts` - read selectors and allowed Bitrix methods.
- `apps/api/src/config/env.ts` - hardcoded allowed custom fields for reporting.
- `apps/api/test/security.test.ts` and `apps/api/test/env.test.ts` - existing
  guard tests.

Current excerpts:

- `apps/api/src/bitrix/security.ts:5-23` currently treats `UF_*` as forbidden.
- `apps/api/src/bitrix/security.ts:34-49` allows custom `UF_*` only when passed
  through an explicit `allowedCustomFields` parameter.
- `apps/api/src/bitrix/selectors.ts:36-53` does not include
  `crm.contact.update` or `crm.deal.update`.
- `apps/api/src/config/env.ts:14-34` hardcodes reporting custom fields only.

Approved V1 field contract:

Contact fields:

| Logical key | Title | Bitrix code | Value kind |
|---|---|---|---|
| `gender` | Пол | `UF_CRM_1643718541418` | enum |
| `city` | Город проживания участника | `UF_CRM_1649418456` | crm multiple, `DYNAMIC_131` |
| `age` | Возраст | `UF_CRM_1766136147` | integer |
| `relevantExperienceYears` | Релевантный совокупный опыт работы | `UF_CRM_1766145168923` | double |
| `businessRevenue` | Оборот бизнеса | `UF_CRM_1647946359` | enum |
| `primaryIndustry` | Сфера деятельности основная | `UF_CRM_1667127836` | iblock element, `IBLOCK_ID=76` |
| `companySpecifics` | Специфика компании основная | `UF_CRM_1643721389` | string |
| `primaryRole` | Роль/должность основная | `UF_CRM_1643793756` | enum |
| `roleExperienceYears` | Опыт в текущей должности | `UF_CRM_1766145312607` | double |
| `clubGoals` | Цели/задачи по клубу | `UF_CRM_1643816950` | string |
| `wasInCommunity` | Состоял ли в сообществе? | `UF_CRM_1765895191819` | enum |
| `previousCommunityDetails` | Состоял ли ранее в каком-либо сообществе, если да, то в каком? | `UF_CRM_1643816816` | string |
| `newProjects` | Проекты: новые запускающиеся бизнесы участника | `UF_CRM_1667310772911` | string |
| `clubUsefulness` | Чем участник может быть полезен клубу | `UF_CRM_1643816879` | string |
| `hobbies` | Увлечения/хобби | `UF_CRM_1643817006` | string |
| `personalIncome` | Личный доход | `UF_CRM_1766145330402` | double |
| `familyChildren` | Семья/дети | `UF_CRM_1643817014` | string |
| `publicMentionsUrls` | Ссылки на упоминания в сети | `UF_CRM_1766147011846` | url |
| `additionalInfo` | Дополнительная информация | `UF_CRM_1768223556404` | string |

Deal fields:

| Logical key | Title | Bitrix code | Value kind |
|---|---|---|---|
| `keyProjects` | Ключевые проекты | `UF_CRM_1766147164481` | string |
| `clubConnections` | Связи и знакомства внутри клуба | `UF_CRM_1766147207634` | string |

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Session gate | `pnpm session:preflight` | exits 0 on a clean fresh task branch |
| Security tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/security.test.ts test/env.test.ts` | exits 0 |
| Provider/schema tests | `pnpm --filter @bitrix24-reporting/api exec vitest run test/openrouter-call-analysis.test.ts` | exits 0 |
| API typecheck | `pnpm --filter @bitrix24-reporting/api typecheck` | exits 0 |
| Workspace lint | `pnpm lint` | exits 0 |

## Scope

**In scope**:

- `apps/api/src/server/call-enrichment-fields.ts` (create)
- `apps/api/src/bitrix/security.ts`
- `apps/api/src/bitrix/selectors.ts` only if method constants need explicit
  separation between read methods and enrichment write methods
- `apps/api/src/config/env.ts` only for feature-flag env names if needed by the
  validator
- `apps/api/test/security.test.ts`
- `apps/api/test/env.test.ts`
- `apps/api/test/call-enrichment-fields.test.ts` (create)

**Out of scope**:

- OpenRouter prompts.
- Bitrix write adapter implementation.
- Reading or writing live Bitrix values.
- Database migrations.
- Telegram flow.

## Git workflow

- Branch: `codex/call-enrichment-field-allowlist`.
- Do not commit, push, or open a PR unless instructed.
- Do not read `.env` values or print secrets.

## Steps

### Step 1: Create the central field contract module

Create `apps/api/src/server/call-enrichment-fields.ts`.

Export:

- `CALL_ENRICHMENT_CONTACT_FIELDS`
- `CALL_ENRICHMENT_DEAL_FIELDS`
- `CALL_ENRICHMENT_FIELDS`
- `CALL_ENRICHMENT_CONTACT_FIELD_CODES`
- `CALL_ENRICHMENT_DEAL_FIELD_CODES`
- `CALL_ENRICHMENT_ALL_FIELD_CODES`
- `isCallEnrichmentFieldCode(value: string): boolean`
- `getCallEnrichmentFieldByCode(code: string)`
- `assertCallEnrichmentFieldAllowed(entityType, fieldCode)`

Each field descriptor should include:

```ts
type CallEnrichmentEntityType = "contact" | "deal";
type CallEnrichmentValueKind =
  | "string"
  | "integer"
  | "double"
  | "enum"
  | "url"
  | "crm_multiple"
  | "iblock_element";

interface CallEnrichmentFieldDescriptor {
  logicalKey: string;
  entityType: CallEnrichmentEntityType;
  bitrixFieldCode: string;
  title: string;
  valueKind: CallEnrichmentValueKind;
  multiple: boolean;
  writableInV1: boolean;
  enumOptions?: Array<{ id: string; label: string }>;
  externalCatalog?: { kind: "dynamic" | "iblock"; id: string };
}
```

For `city` and `primaryIndustry`, set `writableInV1: true` only if the
implementation can map labels to existing Bitrix IDs. Otherwise set
`writableInV1: false` and let later plans create proposals but block writeback
with `UNMAPPED_REFERENCE_VALUE`. Do not invent new Bitrix reference records.

**Verify**: `pnpm --filter @bitrix24-reporting/api typecheck` -> exits 0.

### Step 2: Keep read guards strict and add explicit enrichment helpers

Do not remove `UF_*` from `FORBIDDEN_FIELD_TOKENS`.

Instead add separate helpers in `apps/api/src/bitrix/security.ts`:

- `assertAllowedBitrixReadMethod(method: string)` can remain the current
  behavior or alias existing `assertAllowedBitrixMethod`.
- `assertAllowedCallEnrichmentWriteMethod(method: string)` allows only
  `crm.contact.update` and `crm.deal.update`.
- `assertSafeCallEnrichmentWriteFields(entityType, fields)` validates:
  - exactly one entity type;
  - every key is in the matching allowlist;
  - no standard PII/multifield keys;
  - no field outside `call-enrichment-fields.ts`.

Do not add write methods to the general reporting read allowlist unless the
adapter explicitly needs a single shared method set. If you must add them, add a
comment that they are not available to reporting selectors.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/security.test.ts` -> exits 0 with new negative tests.

### Step 3: Add tests for entity routing and rejected fields

Create `apps/api/test/call-enrichment-fields.test.ts`.

Test cases:

- There are 19 contact descriptors and 2 deal descriptors.
- `UF_CRM_1766147164481` and `UF_CRM_1766147207634` are entity `deal`.
- `UF_CRM_1647946359` is entity `contact` and kind `enum`.
- Unknown `UF_CRM_*` is rejected.
- Contact field passed to deal write validation is rejected.
- Deal field passed to contact write validation is rejected.
- `PHONE`, `EMAIL`, `NAME`, `COMMENTS`, `CONTACT_IDS`, `COMPANY_ID` are rejected.

**Verify**:

```bash
pnpm --filter @bitrix24-reporting/api exec vitest run test/call-enrichment-fields.test.ts test/security.test.ts
```

Expected: all tests pass.

### Step 4: Add explicit env flags only if needed

If this plan introduces no runtime feature flags, skip this step.

If you add flags, prefer:

- `CALL_ENRICHMENT_ENABLED`
- `CALL_ENRICHMENT_TELEGRAM_ENABLED`
- `CALL_ENRICHMENT_WRITEBACK_ENABLED`
- `CALL_ENRICHMENT_PILOT_MANAGER_IDS`

Do not overload `TELEGRAM_ACTIVITY_REPORT_*`.

**Verify**: `pnpm --filter @bitrix24-reporting/api exec vitest run test/env.test.ts` -> exits 0.

## Test plan

- New `apps/api/test/call-enrichment-fields.test.ts`.
- Extend `apps/api/test/security.test.ts` for write-field validation.
- Extend `apps/api/test/env.test.ts` only if env flags are added.

## Done criteria

- [ ] One central descriptor list contains exactly the approved 21 field codes.
- [ ] Entity routing for `contact` vs `deal` is tested.
- [ ] Generic `UF_*` remains forbidden outside enrichment-specific guards.
- [ ] No Bitrix write adapter exists yet.
- [ ] Focused tests, API typecheck, and lint pass.

## STOP conditions

Stop and report if:

- A field code from this plan does not exist in live Bitrix metadata.
- Product owner changes field ownership again.
- A reviewer asks to allow arbitrary `UF_*`.
- `city`/`primaryIndustry` require creating new CRM reference records; V1 should
  not do that without a separate product decision.

## Maintenance notes

Every later plan must import this descriptor module instead of copying field
codes into prompts, tests, Telegram formatting, or Bitrix adapter code. Reviewers
should reject duplicated allowlists.

