import { BitrixClient } from "../bitrix/client.js";
import { readEnv } from "../config/env.js";
import { performLeadgenSync } from "../domain/leadgen-sync.js";
import { createSqliteRepository } from "../server/sqlite-repository.js";

const env = readEnv();
const leadgenCategoryId = env.leadgenCategoryId;
const leadgenManagerIds = env.leadgenManagerIds;

if (leadgenManagerIds.length === 0) {
  throw new Error("BITRIX24_LEADGEN_MANAGER_IDS is empty.");
}

const repository = createSqliteRepository({
  databaseUrl: env.leadgenDatabaseUrl,
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

try {
  const summary = await performLeadgenSync({
    client,
    repository,
    categoryId: leadgenCategoryId,
    managerIds: leadgenManagerIds,
    now: () => new Date().toISOString()
  });

  console.log(
    JSON.stringify(
      {
        categoryId: leadgenCategoryId,
        whitelistManagers: leadgenManagerIds.length,
        persistedDeals: summary.dealsSynced,
        finishedAt: summary.finishedAt,
        diagnostics: summary.diagnostics
      },
      null,
      2
    )
  );
} finally {
  repository.close();
}
