import type {
  DealSnapshot,
  ManagerDirectoryEntry
} from "@bitrix24-reporting/contracts";

import { BitrixClient } from "../bitrix/client.js";
import { readEnv } from "../config/env.js";
import {
  ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
  LEADGEN_US_BASKET_REASON_FIELD_NAME,
  LEADGEN_US_RETURN_REASON_FIELD_NAME,
  LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME
} from "../domain/sync.js";
import { createSqliteRepository } from "../server/sqlite-repository.js";

const LEADGEN_FROM = "2026-01-01T00:00:00+03:00";

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeMappedFieldValue(
  value: unknown,
  valueMap: Record<string, string>
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = normalizeString(
    typeof rawValue === "number" ? String(rawValue) : rawValue
  );

  if (!normalized) {
    return null;
  }

  return valueMap[normalized] ?? normalized;
}

function sanitizeRefusalReasonDetail(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function mapLeadgenDealRow(
  row: Record<string, unknown>,
  returnReasonMap: Record<string, string>,
  basketReasonMap: Record<string, string>
): DealSnapshot {
  const returnReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_RETURN_REASON_FIELD_NAME],
    returnReasonMap
  );
  const basketReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_BASKET_REASON_FIELD_NAME],
    basketReasonMap
  );
  const genericReasonDetail = normalizeMappedFieldValue(
    row[ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME],
    {}
  );

  return {
    id: String(row.ID),
    title: null,
    contactId: null,
    leadId: null,
    categoryId: normalizeString(row.CATEGORY_ID),
    stageId: String(row.STAGE_ID),
    stageSemanticId: normalizeString(row.STAGE_SEMANTIC_ID),
    opportunity:
      typeof row.OPPORTUNITY === "number"
        ? row.OPPORTUNITY
        : row.OPPORTUNITY
          ? Number(row.OPPORTUNITY)
          : null,
    assignedById: normalizeString(row.ASSIGNED_BY_ID),
    sourceId: normalizeString(row.SOURCE_ID),
    qualityValue: null,
    businessClubValue: null,
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: null,
    refusalReasonValue: returnReasonValue ?? basketReasonValue,
    refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail),
    dateCreate: String(row.DATE_CREATE),
    dateModify: String(row.DATE_MODIFY),
    dateClosed: normalizeString(row.DATE_CLOSED),
    utmSource: normalizeString(row.UTM_SOURCE),
    utmMedium: normalizeString(row.UTM_MEDIUM),
    utmCampaign: normalizeString(row.UTM_CAMPAIGN),
    utmContent: normalizeString(row.UTM_CONTENT),
    utmTerm: normalizeString(row.UTM_TERM)
  };
}

function mapUserRow(row: { ID: string; NAME: string | null; LAST_NAME: string | null }) {
  const fullName = [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim();

  return {
    id: String(row.ID),
    name: fullName || String(row.ID)
  } satisfies ManagerDirectoryEntry;
}

const env = readEnv();
const leadgenCategoryId = env.leadgenCategoryId;
const leadgenManagerIds = env.leadgenManagerIds;

if (leadgenManagerIds.length === 0) {
  throw new Error("BITRIX24_LEADGEN_MANAGER_IDS is empty.");
}

const repository = createSqliteRepository({
  databaseUrl: env.DATABASE_URL,
  defaultWonStageIds: env.reportWonStageIds
});

const client = new BitrixClient({
  dealCategoryIds: [leadgenCategoryId],
  timeoutMs: env.BITRIX24_TIMEOUT_MS,
  requestIntervalMs: env.BITRIX24_REQUEST_INTERVAL_MS,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
  ...(env.BITRIX24_PORTAL_HOST ? { portalHost: env.BITRIX24_PORTAL_HOST } : {}),
  ...(env.BITRIX24_WEBHOOK_USER_ID ? { userId: env.BITRIX24_WEBHOOK_USER_ID } : {}),
  ...(env.BITRIX24_WEBHOOK_TOKEN ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN } : {})
});

const [dealStages, sourceCatalog, dealRows, returnReasonMap, basketReasonMap] =
  await Promise.all([
    client.fetchDealStages([leadgenCategoryId]),
    client.fetchSourceCatalog(),
    client.listDeals({
      modifiedAfter: LEADGEN_FROM,
      categoryIds: [leadgenCategoryId],
      assignedByIds: leadgenManagerIds,
      customFieldNames: [
        LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME,
        ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
        LEADGEN_US_RETURN_REASON_FIELD_NAME,
        LEADGEN_US_BASKET_REASON_FIELD_NAME
      ]
    }),
    client.fetchDealFieldValueMap(LEADGEN_US_RETURN_REASON_FIELD_NAME),
    client.fetchDealFieldValueMap(LEADGEN_US_BASKET_REASON_FIELD_NAME)
  ]);

const allowedManagers = new Set(leadgenManagerIds);
const scopedRows = dealRows.filter((row) => {
  const categoryId = normalizeString(row.CATEGORY_ID);
  const managerId = normalizeString(row.ASSIGNED_BY_ID);
  const dateCreate = normalizeString(row.DATE_CREATE);

  return (
    categoryId === leadgenCategoryId &&
    Boolean(managerId && allowedManagers.has(managerId)) &&
    Boolean(dateCreate && dateCreate >= LEADGEN_FROM)
  );
});
const deals = scopedRows.map((row) =>
  mapLeadgenDealRow(row, returnReasonMap, basketReasonMap)
);
const managerDirectory = (await client.fetchUsers({
  ids: Array.from(
    new Set(
      deals
        .map((deal) => deal.assignedById)
        .filter((managerId): managerId is string => Boolean(managerId))
    )
  )
})).map(mapUserRow);

await repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);
await repository.upsertDeals(deals);
await repository.upsertManagerDirectory(managerDirectory);

console.log(
  JSON.stringify(
    {
      categoryId: leadgenCategoryId,
      from: LEADGEN_FROM,
      whitelistManagers: leadgenManagerIds.length,
      rawDealRows: dealRows.length,
      persistedDeals: deals.length,
      managers: managerDirectory.map((manager) => ({
        id: manager.id,
        name: manager.name,
        deals: deals.filter((deal) => deal.assignedById === manager.id).length
      }))
    },
    null,
    2
  )
);
