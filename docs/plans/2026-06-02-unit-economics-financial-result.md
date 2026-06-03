# Unit Economics And Financial Result For Attraction

> **For future Codex implementation:** treat this as the product and technical
> specification for adding a separate unit-economics / financial-result block to
> the attraction dashboard. Do not implement from this document without first
> running the repository Session Currency Gate and the Code Review Graph gate
> required by `AGENTS.md`.

## Goal

Add a separate `Финрезультат / Юнит-экономика` report block to the attraction
dashboard.

The block should connect the dashboard data that already exists:

- won deals and attraction revenue;
- club membership amount / club average check;
- source and lead quality;
- leadgen purchase mechanics and auto-purchase risk;
- conversion events and event performance;
- manager workload / employee cost allocation;
- cost facts imported or maintained locally.

The result should answer:

1. How much did attraction earn in the selected period?
2. How much club revenue did the same deals represent?
3. How much did the module spend on leads, events, employees and other direct
   costs?
4. Which source, quality, event, manager or cost category creates or destroys
   contribution?
5. Which numbers are trusted, inferred, missing or manually overridden?

## Executive Decision

Do **not** rewrite the dashboard from scratch.

The current architecture already has the right shape for this feature:

- cached SQLite snapshots;
- domain report builders;
- service methods;
- Express report endpoints;
- shared TS contracts;
- web client normalizers;
- a lazy-loaded heavy report pattern in `RevenueVelocityScene`;
- settings endpoints for leader-owned financial rules such as pricing.

The missing piece is not a new dashboard shell. The missing piece is a local
financial data layer for costs, with traceability and coverage warnings.

Recommended implementation:

- add a new `unit-economics` report endpoint;
- reuse `resolveDealEconomics` for attraction revenue;
- reuse deal source, quality, stage, event and manager facts from current
  reports;
- add local `unit_economics_cost_facts`, `unit_economics_cost_rules` and import
  batch tables;
- add leader-only settings/import endpoints for cost rules and cost facts;
- add a new lazy-loaded dashboard scene with stable comment block ids.

## Current Project State

### Branch And Recovery State

This document was prepared on branch:

`codex/unit-economics-financial-result-spec`

At recovery time the branch existed but had no unique commits and no saved
specification changes. It was fast-forwarded to `origin/main` and passed:

`pnpm session:preflight`

with only the expected warning that the task branch has no upstream yet.

### Existing Backlog Item

`docs/backlog.md` already contains a matching backlog item:

`Financial result by source, quality, and events`

It asks for:

- lead purchase cost by source and quality;
- event costs;
- earned amount;
- attraction average check;
- club average check;
- earning formula by customer and contract/tariff type;
- source of lead and event costs.

This specification expands that backlog item into an implementation-ready plan.

### Current Local Data Snapshot

Local aggregate checks were run against:

`apps/api/data/bitrix24-attraction.db`

No personal data, raw payloads, deal titles, contact names, phone numbers or
emails were read for this analysis.

Current aggregate coverage:

| Metric | Count |
| --- | ---: |
| `deal_snapshots` rows | 3,756 |
| Source filled | 3,696 |
| Quality filled | 676 |
| Tariff filled | 781 |
| Business club filled | 613 |
| Target group filled | 1,651 |
| Positive `opportunity` | 1,782 |
| Won deals (`stage_semantic_id = 'S'`) | 483 |

Current won-deal economics through `resolveDealEconomics`:

| Metric | Value |
| --- | ---: |
| Won deals | 483 |
| Club membership amount / `opportunity` | 436,195,000 ₽ |
| Attraction revenue | 133,730,000 ₽ |
| Priced won deals | 461 |
| Missing contract fields | 6 |
| Missing pricing rule | 15 |
| Pricing conflict | 1 |

Current top won sources by attraction revenue:

| Source | Won | Club amount | Attraction revenue | Unpriced |
| --- | ---: | ---: | ---: | ---: |
| СБЕР (ВСП) | 110 | 90,360,000 ₽ | 30,075,000 ₽ | 6 |
| Рекомендация от действующего участника | 98 | 87,965,000 ₽ | 25,800,000 ₽ | 8 |
| Сайт clubfirst.ru | 84 | 73,020,000 ₽ | 23,925,000 ₽ | 3 |
| Лидген УС | 52 | 56,560,000 ₽ | 13,968,000 ₽ | 3 |
| Самостоятельно | 47 | 43,640,000 ₽ | 13,800,000 ₽ | 0 |
| Рекомендация от сотрудника | 35 | 32,790,000 ₽ | 10,500,000 ₽ | 0 |
| Сообщение | 35 | 33,300,000 ₽ | 9,675,000 ₽ | 1 |

Interpretation:

- The dashboard already has enough deal-side data to calculate revenue and
  source/quality revenue.
- The dashboard does **not** currently have enough cost-side data to calculate a
  real financial result.
- Any first release must expose coverage warnings and avoid implying precision
  where quality, tariff, target group or cost facts are missing.

### Current SQLite Tables

Relevant existing tables:

- `deal_snapshots`
- `lead_snapshots`
- `stage_catalog`
- `stage_history_snapshots`
- `activity_snapshots`
- `call_snapshots`
- `deal_stage_facts`
- `deal_touchpoint_facts`
- `event_snapshots`
- `event_visit_facts`
- `identity_links`
- `pricing_rules`
- `sales_plan_rows`
- `module_manager_whitelist_settings`

There are no current tables for:

- lead purchase cost facts;
- event cost facts;
- employee salary / employee cost facts;
- finance transaction ledger;
- unit economics actuals;
- cost allocation rules.

### Leadgen DB State

Local `apps/api/data/bitrix24-leadgen.db` currently has zero rows in the core
snapshot tables checked:

- `deal_snapshots`
- `lead_snapshots`
- `activity_snapshots`
- `call_snapshots`

Therefore V1 must not depend on a live leadgen snapshot as the mandatory cost
source.

## Existing Code And Data Map

### Revenue Calculation

Revenue is already implemented in:

- `apps/api/src/domain/deal-economics.ts`
- `apps/api/src/domain/reporting.ts`
- `apps/api/src/domain/operational-reports.ts`
- `apps/api/src/domain/revenue-velocity.ts`
- `apps/api/src/server/sqlite-repository.ts`
- `apps/api/src/server/app.ts`
- `apps/web/src/proto/scenes.tsx`

The key function is:

`resolveDealEconomics({ deal, context, pricingRules })`

It returns:

- `membershipAmount` from deal `opportunity`;
- `attractionRevenueAmount` from `pricing_rules`;
- `pricingStatus`;
- `pricingWarnings`.

Current pricing rules map customer/tariff to attraction revenue:

- ClubFirst Russia / One + Federal;
- ClubFirst Russia / One + Regional;
- ClubFirst GlobAll;
- ClubFirst Future / CFF.

The new report should reuse this function. It should not invent another revenue
formula.

### Existing Financial Fields In Reports

`ManagerActionOutcomeReport` already carries:

- `financialAmount`;
- `averageFinancialAmount`;
- per-deal `amount`;
- source, quality, target group, tariff and SLA details.

This is currently revenue-side financial amount, not net result.

`RevenueVelocityReport` already carries:

- `salesAmount`;
- `averageCheck`;
- `activePipelineAmount`;
- `realizedWonAmountInPeriod`;
- money-per-action metrics.

This is useful for unit economics because it already connects money, sources,
managers, actions and cohorts.

### Source And Quality

Source and quality are already stored on `deal_snapshots`:

- `source_id`;
- `quality_value`;
- `business_club_value`;
- `target_group_value`;
- `tariff_value`;
- UTM fields.

Source labels are resolved from `stage_catalog`.

Current source/quality report paths:

- `buildSourceQualityConversionReport`
- `buildAcquisitionOutcomesReport`
- source and quality filters in service/report code;
- frontend source picker from `/api/meta`.

The new report should use the same source key/label resolution as current
reports.

### Leadgen Purchase Boundary

The attraction ontology already defines:

- Leadgen is a separate production module.
- Attraction should not model leadgen internal mechanics.
- Attraction should track source, final quality, acceptance/return criteria,
  SLA and purchase moment.
- Auto-purchase happens when a `Готов ко встрече` delivery moves from
  `База входящая` to `Встреча-знакомство` because SLA-1 was missed.
- After purchase, the lead cannot be returned as unpaid/unaccepted.

Important files:

- `docs/modules/attraction/ontology/03-lidgen-us-interface.md`
- `docs/modules/attraction/ontology/07-reporting-and-guardrails.md`

The field audit contains candidate Bitrix linkage/cost fields:

| Funnel | Field | Meaning |
| --- | --- | --- |
| Лидген УС | `UF_CRM_1757493844528` | `Стоимость лида` |
| Лидген УС | `UF_CRM_1730380390` | `Итоговое качество лида` |
| Лидген УС | `UF_CRM_1726577403124` | `Вид лида (что передаем)` |
| Привлечение | `UF_CRM_1726157916` | `id сделки лидгена` |
| Привлечение | `UF_CRM_1758872073` | `Сделка лидген УС` |
| Привлечение | `UF_CRM_1730380390` | `Итоговое качество лида` |
| Привлечение | `UF_CRM_1726577403124` | `Вид лида (что передаем)` |

These are documented in:

`docs/audits/2026-04-13-bitrix-field-duplicates/field-registry.csv`

But the current sync allowlist in `apps/api/src/config/env.ts` does not include
`UF_CRM_1757493844528`, and current local leadgen tables are empty. That means
Bitrix leadgen cost sync should be a V2/V1.5 enhancement, not the first critical
path.

### Conversion Events

Conversion event facts already exist in the canonical layer:

- `event_snapshots`
- `event_visit_facts`
- `deal_touchpoint_facts`
- `event_visit_stage_history`

The activity report already uses:

- `ActivitiesWorkloadReport.conversionEventRows`;
- direct attraction deal links only;
- stage-at-invitation logic;
- manager scope by attraction deal owner.

This should be reused for event economics. Event cost should be a cost fact
allocated to event rows, not a new direct Bitrix read from the dashboard.

### Employee / Manager Costs

The current dashboard has manager workload, manager outcomes and manager
whitelist settings, but it has no salary or employee-cost table.

`Фин модельер` provides a useful conceptual model:

- financial model rows are classified as `revenue`, `cost`,
  `profit_sharing`;
- cost rows require a supplier/executor;
- rows should carry traceability, source and coverage;
- actuals can come from connectors such as `finance` or
  `planning_economics`;
- transaction/ledger rows should be imported as evidence.

However, `Фин модельер` should not be embedded as a runtime dependency in this
dashboard. Use it as a model for data semantics, not as a code dependency.

## Recommended Domain Model

### Canonical Terms

Use these terms in product copy and contracts:

| Term | Meaning |
| --- | --- |
| `Доход Привлечения` | Management revenue attributable to attraction, from `resolveDealEconomics`. |
| `Клубный доход` | Membership / contract amount from deal `opportunity`. |
| `Расход на покупку лида` | Cost paid or accrued for accepted/purchased lead delivery. |
| `Расход на мероприятие` | Event cost allocated to a conversion event or event type. |
| `Расход на сотрудников` | Payroll/contractor cost allocated to attraction work. |
| `Прямые расходы` | Lead, event, employee and other direct costs assigned to attraction. |
| `Финрезультат` | `Доход Привлечения - прямые расходы` for selected scope. |
| `Contribution margin` | `Финрезультат / Доход Привлечения`. |
| `Средний чек Привлечения` | `Доход Привлечения / wonDeals`. |
| `Средний чек клуба` | `Клубный доход / wonDeals`. |

### Report Formulas

For a selected `range + filters`:

```text
attractionRevenue = SUM(resolveDealEconomics(wonDeal).attractionRevenueAmount)
clubRevenue = SUM(wonDeal.opportunity)
leadPurchaseCost = SUM(costFacts where costKind = lead_purchase)
eventCost = SUM(costFacts where costKind = event)
employeeCost = SUM(costFacts where costKind = employee)
otherDirectCost = SUM(costFacts where costKind = other_direct)
directCosts = leadPurchaseCost + eventCost + employeeCost + otherDirectCost
financialResult = attractionRevenue - directCosts
contributionMargin = financialResult / attractionRevenue
attractionAverageCheck = attractionRevenue / wonDeals
clubAverageCheck = clubRevenue / wonDeals
costPerWonDeal = directCosts / wonDeals
costPerCreatedDeal = directCosts / createdDeals
leadPurchaseCostPerPurchasedLead = leadPurchaseCost / purchasedLeadCount
```

All divisions must handle zero denominators and produce explicit warnings or
null values, never `NaN`, `Infinity` or fake zero precision.

### Cost Fact Grain

Costs should be stored as facts, not hidden in formulas.

Recommended table: `unit_economics_cost_facts`

Required columns:

```sql
id TEXT PRIMARY KEY,
module_key TEXT NOT NULL,
period_start TEXT NOT NULL,
period_end TEXT NOT NULL,
cost_kind TEXT NOT NULL,
amount REAL NOT NULL,
currency TEXT NOT NULL DEFAULT 'RUB',
source_system TEXT NOT NULL,
source_reference TEXT,
source_label TEXT,
confidence TEXT NOT NULL,
status TEXT NOT NULL,
allocation_method TEXT NOT NULL,
manager_id TEXT,
source_key TEXT,
quality_value TEXT,
event_id TEXT,
event_label TEXT,
event_type_key TEXT,
deal_id TEXT,
leadgen_deal_id TEXT,
article TEXT,
counterparty TEXT,
comment TEXT,
import_batch_id TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

Allowed `cost_kind` values:

- `lead_purchase`
- `event`
- `employee`
- `other_direct`
- `overhead_allocation`

Allowed `confidence` values:

- `confirmed`
- `imported`
- `inferred`
- `manual`
- `needs_review`
- `conflicting`

Allowed `status` values:

- `draft`
- `active`
- `superseded`
- `rejected`

Recommended table: `unit_economics_cost_rules`

Purpose: fallback rules where exact cost facts are unavailable.

Required columns:

```sql
id TEXT PRIMARY KEY,
module_key TEXT NOT NULL,
cost_kind TEXT NOT NULL,
amount_per_unit REAL NOT NULL,
currency TEXT NOT NULL DEFAULT 'RUB',
unit TEXT NOT NULL,
source_key TEXT,
quality_value TEXT,
event_type_key TEXT,
manager_id TEXT,
article TEXT,
allocation_method TEXT NOT NULL,
effective_from TEXT NOT NULL,
effective_to TEXT,
enabled INTEGER NOT NULL,
priority INTEGER NOT NULL,
source_reference TEXT,
created_at TEXT NOT NULL,
updated_at TEXT NOT NULL
```

Allowed `unit` values:

- `deal`
- `purchased_lead`
- `created_deal`
- `won_deal`
- `event`
- `event_visit`
- `manager_period`
- `period`

Recommended table: `unit_economics_import_batches`

Purpose: import traceability for CSV/XLSX/manual imports.

Required columns:

```sql
id TEXT PRIMARY KEY,
module_key TEXT NOT NULL,
source_system TEXT NOT NULL,
source_label TEXT NOT NULL,
file_name TEXT,
row_count INTEGER NOT NULL,
accepted_count INTEGER NOT NULL,
rejected_count INTEGER NOT NULL,
status TEXT NOT NULL,
warnings_json TEXT NOT NULL,
created_by_user_id INTEGER,
created_at TEXT NOT NULL
```

## Cost Allocation Rules

### Lead Purchase Cost

V1 should support three sources in priority order:

1. Exact active `unit_economics_cost_facts` linked by `deal_id` or
   `leadgen_deal_id`.
2. Period/source/quality cost facts allocated by created or purchased lead count.
3. `unit_economics_cost_rules` by `source_key + quality_value`.

Recommended default:

- Use exact fact when present.
- Else, for source `Лидген УС`, use cost rule by final quality.
- Show a warning when the rule is missing.

Future Bitrix-backed enhancement:

- Add allowlisted `UF_CRM_1757493844528` as a leadgen cost field.
- Sync it only through the backend sync pipeline.
- Join it through attraction technical leadgen-link fields where safe.
- Keep the current rule/import path as fallback.

### Auto-Purchase Detection

Auto-purchase is a business event derived from stage movement:

`База входящая -> Встреча-знакомство`

for deliveries with final quality `Готов ко встрече`, when manual SLA-1
acceptance did not happen.

The report should expose:

- total purchased leads;
- manual purchases;
- auto-purchases;
- auto-purchase share;
- lead purchase cost from exact/rule facts;
- cost leakage caused by auto-purchases.

Implementation should reuse stage history and ontology stage ids. Do not infer
auto-purchase only from a Russian label string without stage registry mapping.

### Event Cost

V1 should support event cost facts at these grains:

- exact event id;
- event label/type;
- period-level event cost allocated to invited, visited or won counts.

Recommended default allocation:

1. If `event_id` exact fact exists, use it for that event.
2. Else if event-type fact exists, allocate to events of that type in the
   selected period.
3. Else if period event cost exists, allocate by event visits.

The UI must show the allocation basis.

### Employee Cost

V1 should support employee costs as cost facts by:

- manager id;
- period;
- amount;
- source reference;
- optional role/article.

Recommended report behavior:

- Module summary includes all active employee cost facts in the selected period.
- Manager rows include exact manager-linked employee costs.
- If employee costs are only period-level without manager id, keep them in the
  total and show them as `Нераспределенные расходы на сотрудников`.

Optional allocation drivers for future releases:

- by weighted action points;
- by created deals;
- by won deals;
- by active deal-days;
- by configured fixed share.

V1 should not silently allocate employee costs by manager unless the allocation
method is explicitly stored.

### Other Direct Costs

Keep an escape hatch for known direct costs that are not leads, events or
employees:

- tools;
- contractor support;
- one-off direct expenses;
- other module-specific direct costs.

These should still require source, period, amount and confidence.

## Report Contract

Add shared contract types in `packages/contracts/src/index.ts`.

Suggested types:

```ts
export type UnitEconomicsDimension =
  | "sourceQuality"
  | "source"
  | "quality"
  | "event"
  | "manager"
  | "costKind";

export interface UnitEconomicsReport {
  range: ReportRange;
  filters: ReportFilters;
  summary: UnitEconomicsSummary;
  rows: UnitEconomicsRow[];
  costRows: UnitEconomicsCostRow[];
  coverage: UnitEconomicsCoverage;
  warnings: string[];
  comparisons?: Array<ReportComparison<UnitEconomicsReportSnapshot>>;
}
```

Recommended `UnitEconomicsSummary` fields:

- `createdDeals`;
- `wonDeals`;
- `purchasedLeads`;
- `autoPurchasedLeads`;
- `attractionRevenue`;
- `clubRevenue`;
- `leadPurchaseCost`;
- `eventCost`;
- `employeeCost`;
- `otherDirectCost`;
- `directCosts`;
- `financialResult`;
- `contributionMargin`;
- `attractionAverageCheck`;
- `clubAverageCheck`;
- `costPerWonDeal`;
- `costPerCreatedDeal`;
- `leadPurchaseCostPerPurchasedLead`;

Recommended `UnitEconomicsRow` fields:

- `dimension`;
- `key`;
- `label`;
- `sourceKey`;
- `sourceLabel`;
- `qualityValue`;
- `eventId`;
- `eventLabel`;
- `managerId`;
- `managerName`;
- all summary numeric fields;
- `pricingWarningCount`;
- `costCoverageStatus`;
- `warnings`.

Recommended `UnitEconomicsCoverage` fields:

- `dealsTotal`;
- `sourceFilled`;
- `qualityFilled`;
- `tariffFilled`;
- `targetGroupFilled`;
- `pricingPriced`;
- `pricingWarnings`;
- `exactLeadCostFacts`;
- `ruleLeadCostFacts`;
- `missingLeadCostFacts`;
- `exactEventCostFacts`;
- `allocatedEventCostFacts`;
- `missingEventCostFacts`;
- `exactEmployeeCostFacts`;
- `unallocatedEmployeeCostFacts`;

## API Design

Add read endpoint:

`GET /api/reports/unit-economics`

Query parameters:

- same range/filter params as existing report endpoints;
- optional `dimension`;
- optional `includeCostRows=true`;
- optional compare ranges.

Access:

- any user with attraction access may read the report;
- no direct Bitrix calls inside the endpoint;
- report reads cached SQLite only.

Add leader-only cost settings endpoints:

- `GET /api/settings/unit-economics/cost-rules`
- `PUT /api/settings/unit-economics/cost-rules`
- `GET /api/settings/unit-economics/cost-facts`
- `POST /api/settings/unit-economics/cost-facts/import`
- `PUT /api/settings/unit-economics/cost-facts/:id`

Access:

- read settings: attraction access;
- mutate settings/import facts: `leader` or `super_admin`, matching pricing
  settings behavior.

Import format for V1 CSV:

```csv
periodStart,periodEnd,costKind,amount,currency,sourceSystem,sourceReference,sourceLabel,confidence,allocationMethod,managerId,sourceKey,qualityValue,eventId,eventLabel,eventTypeKey,dealId,leadgenDealId,article,counterparty,comment
```

V1 should also allow manual entry of rules through the settings UI if CSV import
is too heavy for first release.

## Backend Implementation Shape

Add files:

- `apps/api/src/domain/unit-economics.ts`
- `apps/api/test/unit-economics.test.ts`

Modify:

- `packages/contracts/src/index.ts`
- `apps/api/src/server/sqlite-repository.ts`
- `apps/api/src/server/service.ts`
- `apps/api/src/server/app.ts`
- `apps/api/test/http.test.ts`
- `apps/api/test/service.test.ts` where useful
- `apps/api/test/sqlite.test.ts`
- `apps/api/test/security.test.ts` if adding new Bitrix custom fields later

Domain builder input should include:

- deals;
- stage catalog;
- stage history;
- manager directory;
- event facts / event visit facts / touchpoints;
- pricing rules;
- cost facts;
- cost rules;
- filters;
- range.

The builder should:

1. Filter attraction deals by current filter rules and manager whitelist.
2. Resolve won deals and revenue through `resolveDealEconomics`.
3. Resolve created deals, purchased leads and auto-purchases.
4. Attach exact/rule/allocated costs.
5. Aggregate summary and rows.
6. Compute coverage and warnings.
7. Return deterministic sorted rows.

## Frontend Design

Add a new scene:

- id: `unit-economics`
- label: `Финрезультат`
- focus: `Доход / расходы / маржа`
- comment block id: `attraction-unit-economics-financial-result`
- route/tab placement: after `Денежная скорость`

Use the existing design system:

- `panel`;
- `metric`;
- `badge-chip`;
- dense tables;
- existing filter shell;
- no new visual theme.

Load lazily like `RevenueVelocityScene`, not in the initial report bundle.

Recommended scene sections:

1. Summary KPI strip
   - Доход Привлечения
   - Клубный доход
   - Расходы
   - Финрезультат
   - Маржинальность
   - Средний чек Привлечения
   - Средний чек клуба
   - Cost per won deal

2. Source × quality table
   - created deals
   - purchased leads
   - won deals
   - attraction revenue
   - club revenue
   - lead purchase cost
   - direct costs
   - financial result
   - margin
   - coverage status

3. Leadgen purchase block
   - Лидген УС source rows
   - manual/auto purchase split
   - cost by final quality
   - missing cost rules

4. Event economics block
   - event label/type
   - invited / visited / won after event
   - event cost
   - revenue after event
   - cost per visit
   - revenue per visit

5. Employee cost block
   - manager
   - employee cost
   - created/won deals
   - attraction revenue
   - financial result after exact manager cost
   - unallocated employee costs warning

6. Cost ledger / sources block
   - cost fact list
   - source label
   - confidence
   - allocation method
   - import batch

7. Coverage and warnings block
   - pricing warnings
   - missing source/quality/tariff/target group
   - missing cost rules
   - unallocated employee/event costs

## Settings UI

The first implementation can add a compact settings panel section near existing
pricing settings:

- lead purchase cost rules by source + quality;
- event cost rules by event type;
- employee cost facts upload / manual row entry;
- import history;
- warnings for inactive or overlapping rules.

Do not block report read access on settings permissions. Non-leader users should
see report data and source/coverage warnings but not mutate cost settings.

## Integration With `Фин модельер`

Use `Фин модельер` as conceptual and future integration context, not as a hard
dependency.

Useful ideas to copy:

- cost rows are first-class rows with source and confidence;
- `Транзакции` / ledger rows are evidence;
- `System` dictionaries prevent free-text drift;
- formulas and results need traceability;
- rows classify into revenue, production/direct/other costs and profit sharing;
- missing denominator and missing source must be explicit warnings.

Do not copy:

- Univer spreadsheet runtime;
- full AI-CFO agent harness;
- 12-month workbook matrix;
- full plan/fact model.

Future integration option:

- export a cost ledger or actuals CSV from `Фин модельер`;
- import it into `unit_economics_cost_facts`;
- store `source_system = 'fin_modeler'`;
- keep dashboard read path local and deterministic.

## Implementation Plan

### Phase 0. Business Decisions

Owner: product/domain.

- Confirm that `Доход Привлечения` should use current `pricing_rules`.
- Confirm that `Клубный доход` is deal `opportunity`.
- Confirm whether `Финрезультат` is attraction contribution after direct costs,
  not full company net profit.
- Confirm V1 employee-cost grain: manager-period exact facts or module-period
  facts.
- Confirm first lead purchase cost source: manual/rule import vs Bitrix
  `UF_CRM_1757493844528`.

If no answer is available, implement V1 with:

- `pricing_rules` for revenue;
- manual/imported cost facts and rules;
- Bitrix cost sync as future enhancement.

### Phase 1. Contracts And Tests

Owner: backend + tester.

- Add `UnitEconomics*` contract types.
- Add parser/normalizer tests in web client once frontend starts.
- Add domain tests with synthetic deals, pricing rules, cost facts and cost
  rules.

Required cases:

- revenue with priced and unpriced won deals;
- source/quality aggregation;
- exact lead cost fact wins over rule;
- missing cost rule produces warning;
- period-level event cost allocation;
- manager employee cost exact vs unallocated;
- zero denominator handling.

### Phase 2. SQLite Cost Layer

Owner: backend.

- Add tables and migrations in `sqlite-repository.ts`.
- Add repository methods:
  - list/upsert/delete cost rules;
  - list/upsert cost facts;
  - create import batch;
  - query active facts/rules by module/range.
- Add SQLite tests.

### Phase 3. Domain Report Builder

Owner: backend.

- Implement `buildUnitEconomicsReport`.
- Reuse existing helpers for:
  - source labels;
  - manager directory;
  - pricing;
  - stage history;
  - event facts.
- Keep builder pure and deterministic.
- Add focused domain tests.

### Phase 4. Service And HTTP Endpoint

Owner: backend.

- Add `getUnitEconomicsReport` to service interface.
- Load canonical inputs similarly to revenue velocity.
- Scope to attraction filters and manager whitelist.
- Add `GET /api/reports/unit-economics`.
- Add leader-only settings/import endpoints.
- Add HTTP tests for access, parse errors and payload shape.

### Phase 5. Frontend Client And Types

Owner: frontend.

- Add web dashboard types.
- Add `normalizeUnitEconomicsReport`.
- Add `apiClient.getUnitEconomicsReport`.
- Add client tests for numeric coercion, null handling and warning arrays.

### Phase 6. Dashboard Scene

Owner: frontend.

- Add `UnitEconomicsScene`.
- Register tab after `revenue-velocity`.
- Lazy-load report by filters/dimension.
- Add stable comment block ids.
- Add empty states and warnings.
- Reuse existing table/KPI/panel styling.
- Add focused React tests.

### Phase 7. Settings / Import UI

Owner: frontend + backend.

- Add cost rules editor.
- Add cost facts import preview.
- Add validation errors before activation.
- Keep mutate actions leader-only.

If time is limited, V1 can ship with backend import endpoint and minimal JSON/CSV
upload UI later, as long as seed/test data can prove report behavior.

### Phase 8. Documentation And Ontology

Owner: product/domain.

- Add `attraction-unit-economics-financial-result` to
  `docs/modules/attraction/REPORT_REGISTRY.md`.
- Update the narrow ontology section if business terms are finalized:
  - lead purchase cost;
  - employee cost allocation;
  - financial result definition.
- Keep implementation details out of ontology.

### Phase 9. Verification

Run relevant checks:

```bash
pnpm session:preflight
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/unit-economics.test.ts
pnpm --filter @bitrix24-reporting/api test -- --runInBand apps/api/test/sqlite.test.ts apps/api/test/http.test.ts
pnpm --filter @bitrix24-reporting/web exec vitest run apps/web/src/lib/api-client.test.ts apps/web/src/proto/proto-app.test.tsx
pnpm lint
pnpm typecheck
```

For UI work, also run the local web app and verify the scene in the in-app
Browser at desktop and mobile widths.

## Acceptance Criteria

The feature is ready when:

- A separate dashboard scene/block `Финрезультат` exists.
- The block loads lazily and does not block initial dashboard rendering.
- The report shows attraction revenue, club revenue, direct costs, financial
  result, margin, attraction average check and club average check.
- The report has source/quality rows.
- The report has a leadgen purchase/cost section.
- The report has event cost rows if event costs are configured.
- The report has employee cost rows if employee costs are configured.
- Missing cost facts/rules produce visible warnings.
- Pricing gaps produce visible warnings.
- All data is read from local API/SQLite, not directly from Bitrix in UI.
- Mutating cost settings requires leader/super-admin access.
- No raw personal data is persisted or exposed.
- Tests cover domain formulas, repository persistence, HTTP access and client
  normalization.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cost source is not confirmed | Report may show revenue but no net result | Ship cost rules/import first; mark missing cost coverage clearly. |
| Quality field coverage is low | Source/quality economics may be sparse | Show coverage and allow source-only aggregation. |
| Pricing fields are incomplete | Revenue may be understated | Reuse existing pricing warnings and expose warning count. |
| Leadgen DB is empty | Cannot rely on leadgen snapshot | V1 cost ledger/rules; Bitrix leadgen cost sync later. |
| Employee costs are not manager-linked | Manager profitability may be misleading | Keep unallocated employee costs separate until allocation method is explicit. |
| Event costs need allocation | Event ROI may look arbitrary | Store allocation method and display it. |
| Dashboard becomes too heavy | Slow UI | Lazy-load scene like revenue velocity. |
| Finance data has weak traceability | Users distrust numbers | Store source reference, confidence, import batch and warnings. |

## Open Questions

These are product decisions, not code blockers if V1 uses conservative defaults:

1. Should `Финрезультат` mean attraction contribution after direct costs, or full
   net profit after overhead/profit sharing?
2. Should employee costs be included in V1 totals by default, or only after
   manager-period facts are available?
3. Is `Стоимость лида` in Лидген УС the authoritative purchase cost, or is there
   a finance/PEU source that should override Bitrix?
4. Which event cost basis is correct first: cost per event, cost per visit, or
   full period event budget allocation?
5. Should auto-purchase be shown as a separate cost leakage metric in the first
   UI release?
6. Should cost settings live in the dashboard settings panel, or be imported
   from `Фин модельер` / finance system only?

## Recommended First Slice

Implement the first vertical slice narrowly:

1. Add cost tables and repository methods.
2. Seed/import two lead purchase cost rules for `Лидген УС` by quality in tests.
3. Build `GET /api/reports/unit-economics` with summary + source/quality rows.
4. Use existing attraction revenue and club revenue.
5. Display missing cost and pricing coverage warnings.
6. Add a lazy frontend scene with KPI strip and source/quality table.

This slice proves the integration path without waiting for perfect finance
source automation.

After that, add event costs, employee costs and Bitrix leadgen cost sync as
separate reviewable tasks.
