# Leadgen Module Ontology

Module key: `leadgen`

Russian name: `Лидогенерация`

Primary funnel: `Лидген УС`

Bitrix deal category: `28`

## Purpose

The leadgen module helps module users inspect lead generation performance for deals that belong only to the Bitrix24 funnel `Лидген УС`.

The module has its own dashboard interface, report registry, Paperclip context, and manager whitelist. It must not reuse attraction-only assumptions unless a shared platform issue explicitly allows that behavior.

## Users And Roles

- `super_admin`: platform administrator. Can see every module, switch modules from the top dashboard switcher, and manage module memberships.
- `leader`: module admin. Can manage users and comments only for modules where they have a `leader` membership.
- `employee`: module user. Can view the module and create comments when allowed by membership.

Leaders do not automatically receive access to other modules. A super admin can grant a separate membership for another module; by default that membership should be `employee` unless the reviewed issue explicitly grants `leader`.

## Data Boundary

Allowed:

- local API data derived from the SQLite reporting snapshot;
- deal IDs when needed for aggregation or diagnostics;
- manager IDs from the configured leadgen manager whitelist;
- category `28`;
- aggregate metrics, counts, conversion rates, stage distributions, source and UTM buckets, return/basket reason buckets, and date ranges.

Not allowed:

- deal names;
- contact names or contact IDs for reporting output;
- phone numbers;
- emails;
- raw Bitrix payloads;
- Bitrix webhooks, tokens, cookies, or secrets.

If upstream Bitrix responses include personal fields, the sync/reporting code must ignore, redact, or drop them before persistence, UI output, logs, and Paperclip payloads.

## Reporting Scope

All leadgen reports must use only deals where:

- `CATEGORY_ID = 28`;
- `ASSIGNED_BY_ID` is in the leadgen manager whitelist configured by `BITRIX24_LEADGEN_MANAGER_IDS`;
- the requested date/source/manager filters still remain inside that whitelist.

An empty leadgen whitelist means the module returns an empty report with a warning; it must not fall back to the attraction manager whitelist.

V1 report ownership:

- funnel by stage;
- created deal count;
- stage distribution;
- source and UTM distribution;
- manager distribution;
- return/basket reasons when available.

Out of scope for V1:

- CRM Leads from `lead_snapshots`;
- detailed finance reports;
- SLA reports;
- direct Bitrix reads from dashboard rendering;
- personal/contact-level tables.

## UI Boundary

`leadgen` has a separate report registry and dashboard screen. Comments, comment anchors, notifications, and module admin actions must resolve through the active module context.

Attraction UI/report behavior is protected. A leadgen comment or leadgen-only issue must not change attraction reports, scenes, filters, copy, or layout unless the issue is explicitly marked as shared/platform and lists attraction as affected.

## Comment Context

Leadgen comments may include:

- module key `leadgen`;
- author login;
- dashboard scene id, usually `leadgen-funnel`;
- comment block id and label;
- element selector when available;
- relative coordinates inside the block;
- selected period and safe filters;
- comment text.

Leadgen comments must not include personal Bitrix data, contact details, deal names, or raw payloads.

## Paperclip Mapping

- Company: `Bitrix24 Dashboards` unless overridden by `PAPERCLIP_LEADGEN_COMPANY_ID`.
- Goal: leadgen-specific goal when `PAPERCLIP_LEADGEN_GOAL_ID` is configured; otherwise the shared dashboard modules goal.
- Project: leadgen-specific project when `PAPERCLIP_LEADGEN_PROJECT_ID` is configured.
- Workflow lane: `Dashboard Comment Intake`.
- Default worker owner: `Dashboard Engineering Manager`.
- Service identity: `Dashboard Intake Service`.

Leadgen issue payloads must state `Module: leadgen` and include the module-specific instruction:

```text
Work only in leadgen module-owned code and docs unless the issue is explicitly shared/platform.
Do not change attraction UI or reports from a leadgen-only comment.
Keep leadgen scoped to Bitrix category 28 and the leadgen manager whitelist.
```

## Acceptance Checks For Module Changes

- module membership enforced server-side;
- super admin can see and switch to all modules;
- leader-only actions rejected outside the leader's module;
- leadgen manager whitelist remains separate from attraction manager whitelist;
- leadgen reports use only category `28`;
- CSRF required on mutating browser routes;
- no Paperclip token returned to the browser;
- no PII in storage, UI, logs, or Paperclip payloads;
- attraction behavior remains unchanged unless explicitly listed as affected;
- focused API/web tests run or explicitly documented as unrun.
