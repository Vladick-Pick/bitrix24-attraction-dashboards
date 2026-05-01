# Security Contract

## Allowed Bitrix24 Methods

- `crm.deal.list`
- `crm.status.list`
- `crm.deal.fields`
- `crm.contact.list`
- `crm.contact.fields`
- `crm.item.list`
- `crm.stagehistory.list`
- `crm.activity.list`
- `voximplant.statistic.get`
- `user.get`

## Forbidden Methods

- `crm.contact.get`, `crm.contact.add`, `crm.contact.update`, `crm.contact.delete`
- `crm.company.*`
- `crm.deal.contact.*`
- `crm.timeline.*`
- `crm.requisite.*`
- `crm.address.*`
- `crm.documentgenerator.*`
- любые `*.add`, `*.update`, `*.delete`, `*.bind`
- `crm.item.get`, `crm.deal.get`, `crm.lead.get`

## Allowed Fields

- Deal: `ID`, `CONTACT_ID`, `LEAD_ID`, `DATE_CREATE`, `DATE_MODIFY`, `DATE_CLOSED`, `CATEGORY_ID`, `STAGE_ID`, `STAGE_SEMANTIC_ID`, `OPPORTUNITY`, `ASSIGNED_BY_ID`, `SOURCE_ID`, `UTM_*`
- Contact: `ID` plus only configured target-group custom enum fields: `BITRIX24_CONTACT_TARGET_GROUP_FIELD`, `BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD`
- Activity/call/stage history/user methods must select only the minimal IDs, timestamps, ownership, status, duration and manager display fields required by reports.
- Custom fields are denied by default and must be present in the hardcoded allowlist in `apps/api/src/config/env.ts`.

## Forbidden Fields

- `PHONE`, `EMAIL`, `WEB`, `IM`
- `NAME`, `LAST_NAME`, `SECOND_NAME`, `BIRTHDATE`
- `COMMENTS`, `ADDRESS`, `COMPANY_TITLE`, `SOURCE_DESCRIPTION`
- `CONTACT_IDS`, `COMPANY_ID`
- любые `UF_*`

`CONTACT_ID` is allowed only as a relationship key for resolving allowed target-group enum values. Contact names, phones, emails and other personal fields remain forbidden.

## Local API

- `WEB_ORIGIN` is the CORS allowlist origin; wildcard CORS is not used.
- In production, set `AUTH_MODE=password`, `SESSION_SECRET`, `APP_PUBLIC_URL`, and `WEB_ORIGIN`. All `/api/*` routes except `/api/health` and `/api/auth/login` require a valid HttpOnly session cookie.
- Mutating API routes additionally require `X-CSRF-Token`, obtained from `/api/auth/me` and held only in web memory.
- `API_AUTH_TOKEN` is legacy/local-only and applies only when password auth is not enabled.
- Error responses use a stable `{ error, code, details? }` shape and must not expose raw 500 exception messages.
- Browser security headers are set by Express: no-sniff, frame deny, referrer policy, permissions policy, and a production CSP.

## Prototype Comments

- `/__proto/comments` is a localhost-only development endpoint.
- It rejects cross-origin writes unless the origin is localhost or explicitly listed in `PROTO_COMMENTS_ALLOWED_ORIGINS`.
- Request bodies are capped and schema validated before writing `.codex/proto-comments/comments.json`.
- `vite preview` does not register the endpoint unless `PROTO_COMMENTS_ENABLED=true`.

## Logging Rules

- Не логировать raw Bitrix24 request/response bodies.
- Не логировать полный webhook URL с секретом.
- Не сохранять raw JSON payload для дебага.
- Не логировать passwords, session tokens, CSRF tokens или raw internal exception messages.
