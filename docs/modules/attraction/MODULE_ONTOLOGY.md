# Attraction Module Ontology

Module key: `attraction`

Russian name: `Privlechenie`

## Purpose

The attraction module helps module users inspect acquisition and sales-attraction performance from the local Bitrix24 reporting snapshot.

V1 is the first module connected to dashboard comments and Paperclip issue creation.

## Users And Roles

- `leader`: module admin. Can manage module users, assign `leader` or `employee`, archive/close comments, and view module notifications.
- `employee`: module user. Can view the attraction dashboard and create comments when allowed by module membership.

## Data Boundary

Allowed:

- local API data derived from the SQLite reporting snapshot;
- deal/contact IDs when needed for aggregation;
- manager IDs and configured attraction manager whitelist;
- aggregate metrics, counts, sums, conversion rates, stage distributions, and date ranges.

Not allowed:

- deal names;
- contact names;
- phone numbers;
- emails;
- raw Bitrix payloads;
- Bitrix webhooks, tokens, cookies, or secrets.

## Reporting Scope

All attraction reports must remain scoped to the agreed attraction manager whitelist unless a reviewed issue explicitly changes that rule.

Dashboard screens read cached local data through the API. They must not add direct Bitrix reads to page rendering.

## Comment Context

Attraction comments may include:

- module key `attraction`;
- author login;
- dashboard scene id;
- comment block id and label;
- element selector when available;
- relative coordinates inside the block;
- selected period and safe filters;
- comment text.

Attraction comments must not include personal Bitrix data or raw payloads.

## Paperclip Mapping

- Company: `Bitrix24 Dashboards`
- Goal: `Operate Bitrix24 dashboard modules`
- Project V1: `Attraction Dashboard`
- Workflow lane: `Dashboard Comment Intake`
- Default worker owner: `Dashboard Engineering Manager`
- Service identity: `Dashboard Intake Service`

Future module-specific Paperclip projects should keep the same platform specialists unless confidentiality or task volume requires a dedicated module triage agent.

## Acceptance Checks For Module Changes

- module membership enforced server-side;
- leader-only actions rejected for employees;
- CSRF required on mutating browser routes;
- no Paperclip token returned to the browser;
- no PII in Paperclip payloads;
- existing attraction manager whitelist preserved;
- focused API/web tests run or explicitly documented as unrun.
