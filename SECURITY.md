# Security Contract

## Allowed Bitrix24 Methods

- `crm.deal.list`
- `crm.lead.list`
- `crm.status.list`

## Forbidden Methods

- `crm.contact.*`
- `crm.company.*`
- `crm.deal.contact.*`
- `crm.activity.*`
- `crm.timeline.*`
- `crm.requisite.*`
- `crm.address.*`
- `crm.documentgenerator.*`
- любые `*.add`, `*.update`, `*.delete`, `*.bind`
- `crm.item.get`, `crm.deal.get`, `crm.lead.get`

## Allowed Fields

- Deal: `ID`, `LEAD_ID`, `DATE_CREATE`, `DATE_MODIFY`, `DATE_CLOSED`, `CATEGORY_ID`, `STAGE_ID`, `STAGE_SEMANTIC_ID`, `OPPORTUNITY`, `ASSIGNED_BY_ID`, `UTM_*`
- Lead: `ID`, `DATE_CREATE`, `DATE_MODIFY`, `STATUS_ID`, `SOURCE_ID`, `OPPORTUNITY`, `ASSIGNED_BY_ID`, `UTM_*`

## Forbidden Fields

- `PHONE`, `EMAIL`, `WEB`, `IM`
- `NAME`, `LAST_NAME`, `SECOND_NAME`, `BIRTHDATE`
- `COMMENTS`, `ADDRESS`, `COMPANY_TITLE`, `SOURCE_DESCRIPTION`
- `CONTACT_ID`, `CONTACT_IDS`, `COMPANY_ID`
- любые `UF_*`

## Logging Rules

- Не логировать raw Bitrix24 request/response bodies.
- Не логировать полный webhook URL с секретом.
- Не сохранять raw JSON payload для дебага.
