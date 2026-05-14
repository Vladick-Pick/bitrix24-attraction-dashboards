import { BitrixClient } from "./bitrix/client.js";
import { readEnv } from "./config/env.js";
import { createPasswordAuthService, createSqliteAuthStore } from "./server/auth.js";
import { createApp } from "./server/app.js";
import { PaperclipClient } from "./server/paperclip-client.js";
import { createSqliteRepository } from "./server/sqlite-repository.js";
import { createReportingService } from "./server/service.js";

const env = readEnv();
const repository = createSqliteRepository({
  databaseUrl: env.DATABASE_URL,
  defaultWonStageIds: env.reportWonStageIds
});
const startupRecoveredAt = new Date().toISOString();
await repository
  .recoverStaleSyncRuns({
    staleBefore: startupRecoveredAt,
    failedAt: startupRecoveredAt,
    diagnostics: ["SYNC_FAILED", "error=API_RESTART_RECOVERED_RUNNING_SYNC"]
  })
  .then((count) => {
    if (count > 0) {
      console.warn(
        "sync.recovered_orphaned_runs",
        JSON.stringify({ count, failedAt: startupRecoveredAt })
      );
    }
  });
const clientConfig = {
  timeoutMs: env.BITRIX24_TIMEOUT_MS,
  requestIntervalMs: env.BITRIX24_REQUEST_INTERVAL_MS,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD
};

const client = new BitrixClient({
  ...clientConfig,
  dealCategoryIds: env.bitrixDealCategoryIds,
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
  dealCategoryIds: env.bitrixDealCategoryIds,
  qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
  tariffFieldName: env.BITRIX24_DEAL_TARIFF_FIELD,
  businessClubFieldName: env.BITRIX24_DEAL_BUSINESS_CLUB_FIELD,
  ...(env.BITRIX24_DEAL_TARGET_GROUP_FIELD
    ? { targetGroupFieldName: env.BITRIX24_DEAL_TARGET_GROUP_FIELD }
    : {}),
  ...(env.BITRIX24_DEAL_MEETING_TYPE_FIELD
    ? { meetingTypeFieldName: env.BITRIX24_DEAL_MEETING_TYPE_FIELD }
    : {}),
  ...(env.BITRIX24_DEAL_MEETING_DATE_FIELD
    ? { meetingDateFieldName: env.BITRIX24_DEAL_MEETING_DATE_FIELD }
    : {}),
  ...(env.BITRIX24_CONTACT_TARGET_GROUP_FIELD
    ? { contactTargetGroupFieldName: env.BITRIX24_CONTACT_TARGET_GROUP_FIELD }
    : {}),
  ...(env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
    ? {
        legacyContactTargetGroupFieldName:
          env.BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD
      }
    : {}),
  repository,
  client,
  defaultPeriodDays: env.REPORT_DEFAULT_PERIOD_DAYS,
  bootstrapLookbackDays: env.BITRIX24_BOOTSTRAP_LOOKBACK_DAYS
});
const authStore =
  env.AUTH_MODE === "password"
    ? createSqliteAuthStore({
        databaseUrl: env.DATABASE_URL
      })
    : null;
if (authStore) {
  await authStore.ensureModule({
    id: "attraction",
    slug: "attraction",
    name: "Привлечение",
    bitrixCategoryId: env.bitrixDealCategoryIds[0] ?? "10",
    paperclipCompanyId: env.PAPERCLIP_ATTRACTION_COMPANY_ID ?? null,
    paperclipProjectId: env.PAPERCLIP_ATTRACTION_PROJECT_ID ?? null,
    paperclipGoalId: env.PAPERCLIP_ATTRACTION_GOAL_ID ?? null,
    paperclipTriageAgentId: env.PAPERCLIP_ATTRACTION_TRIAGE_AGENT_ID ?? null
  });
  await authStore.ensureDefaultModuleLeader("attraction");
}
const auth =
  authStore && env.SESSION_SECRET
    ? createPasswordAuthService({
        store: authStore,
        sessionSecret: env.SESSION_SECRET,
        cookieName: env.SESSION_COOKIE_NAME,
        ttlHours: env.SESSION_TTL_HOURS,
        secureCookie: Boolean(
          env.NODE_ENV === "production" ||
            env.APP_PUBLIC_URL?.startsWith("https://")
        )
      })
    : undefined;
const paperclip =
  env.PAPERCLIP_API_URL && env.PAPERCLIP_API_TOKEN
    ? new PaperclipClient({
        apiUrl: env.PAPERCLIP_API_URL,
        apiToken: env.PAPERCLIP_API_TOKEN,
        ...(env.PAPERCLIP_BOARD_API_TOKEN
          ? { boardApiToken: env.PAPERCLIP_BOARD_API_TOKEN }
          : {}),
        reworkCommentMode: env.PAPERCLIP_REWORK_COMMENT_MODE
      })
    : undefined;
const app = createApp(service, {
  webOrigin: env.WEB_ORIGIN,
  ...(env.API_AUTH_TOKEN ? { apiAuthToken: env.API_AUTH_TOKEN } : {}),
  ...(auth ? { auth } : {}),
  ...(authStore ? { authStore } : {}),
  comments: repository,
  ...(paperclip ? { paperclip } : {}),
  protoComments: repository,
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  trustProxy:
    env.TRUST_PROXY === "true"
      ? true
      : env.TRUST_PROXY === "false"
        ? false
        : env.TRUST_PROXY,
  ...(env.WEB_STATIC_DIR ? { webStaticDir: env.WEB_STATIC_DIR } : {})
});

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});

process.on("SIGINT", () => {
  repository.close();
  authStore?.close();
  server.close(() => process.exit(0));
});
