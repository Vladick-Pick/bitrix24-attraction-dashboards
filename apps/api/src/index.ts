import { BitrixClient } from "./bitrix/client";
import { readEnv } from "./config/env";
import { createApp } from "./server/app";
import { createSqliteRepository } from "./server/sqlite-repository";
import { createReportingService } from "./server/service";

const env = readEnv();
const repository = createSqliteRepository({
  databaseUrl: env.DATABASE_URL,
  defaultWonStageIds: env.reportWonStageIds
});
const clientConfig = {
  timeoutMs: env.BITRIX24_TIMEOUT_MS
};

const client = new BitrixClient({
  ...clientConfig,
  ...(env.BITRIX24_PORTAL_HOST
    ? { portalHost: env.BITRIX24_PORTAL_HOST }
    : {}),
  ...(env.BITRIX24_WEBHOOK_USER_ID
    ? { userId: env.BITRIX24_WEBHOOK_USER_ID }
    : {}),
  ...(env.BITRIX24_WEBHOOK_TOKEN
    ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN }
    : {})
});
const service = createReportingService({
  repository,
  client,
  defaultPeriodDays: env.REPORT_DEFAULT_PERIOD_DAYS
});
const app = createApp(service);

const server = app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});

process.on("SIGINT", () => {
  repository.close();
  server.close(() => process.exit(0));
});
