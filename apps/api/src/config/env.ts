import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

loadDotenv({
  path: resolve(CONFIG_DIR, "../../../../.env"),
  quiet: true
});

const ALLOWED_BITRIX_CUSTOM_FIELDS = new Set([
  "UF_CRM_1730380390",
  "UF_CRM_1643901145",
  "UF_CRM_1747682957",
  "UF_CRM_1669784114991",
  "UF_CRM_1669784197394",
  "UF_CRM_1669784273591",
  "UF_CRM_1677669882",
  "UF_CRM_MEET2_DT",
  "UF_CRM_DEAL_MEET2_KIND",
  "UF_CRM_DEAL_MEET2_PLACE",
  "UF_CRM_DEAL_MEET2_CAL",
  "UF_CRM_DEAL_MEET2_EVENT",
  "UF_CRM_MEET3_DT",
  "UF_CRM_DEAL_MEET3_KIND",
  "UF_CRM_DEAL_MEET3_PLACE",
  "UF_CRM_DEAL_MEET3_CAL",
  "UF_CRM_DEAL_MEET3_EVENT",
  "UF_CRM_1712252375",
  "UF_CRM_1691070302"
]);
const REPORT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function assertAllowedCustomField(value: string) {
  if (!ALLOWED_BITRIX_CUSTOM_FIELDS.has(value)) {
    throw new Error(`Bitrix24 custom field is not allowed: ${value}`);
  }
}

function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim().length === 0
    ? undefined
    : value;
}

function optionalTrimmedString() {
  return z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(1).optional()
  );
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseManagerChatIdPairs(value: string | undefined) {
  return Object.fromEntries(
    parseCsv(value).map((item) => {
      const separatorIndex = item.indexOf(":");
      if (separatorIndex === -1) {
        throw new Error(
          "TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS must use bitrixUserId:telegramChatId pairs."
        );
      }

      const managerId = item.slice(0, separatorIndex).trim();
      const chatId = item.slice(separatorIndex + 1).trim();
      if (!managerId || !chatId) {
        throw new Error(
          "TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS must use bitrixUserId:telegramChatId pairs."
        );
      }

      return [managerId, chatId];
    })
  );
}

function canonicalDatabaseUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawPath = databaseUrl.slice("file:".length);
  return `file:${isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)}`;
}

function requiredCustomField(defaultValue: string) {
  return z
    .string()
    .trim()
    .refine((value) => {
      assertAllowedCustomField(value);
      return true;
    }, "Bitrix24 custom field is not allowed")
    .default(defaultValue);
}

function optionalCustomField() {
  return z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine((value) => {
        assertAllowedCustomField(value);
        return true;
      }, "Bitrix24 custom field is not allowed")
      .optional()
  );
}

const envSchema = z
  .object({
    API_AUTH_TOKEN: optionalTrimmedString(),
    API_HOST: z.string().trim().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().positive().default(8787),
    APP_TIMEZONE: z.string().default("Europe/Istanbul"),
    APP_PUBLIC_URL: optionalTrimmedString(),
    ATTRACTION_AUTO_SYNC_ENABLED: z.enum(["true", "false"]).optional(),
    ATTRACTION_AUTO_SYNC_INTERVAL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    AUTH_MODE: z.enum(["none", "password"]).default("none"),
    BITRIX24_DEAL_CATEGORY_IDS: z.string().default("10"),
    BITRIX24_LEADGEN_US_CATEGORY_ID: z.string().trim().min(1).default("28"),
    BITRIX24_LEADGEN_MANAGER_IDS: z.string().default(""),
    BITRIX24_DEAL_QUALITY_FIELD: requiredCustomField("UF_CRM_1730380390"),
    BITRIX24_DEAL_TARIFF_FIELD: requiredCustomField("UF_CRM_1643901145"),
    BITRIX24_DEAL_BUSINESS_CLUB_FIELD: requiredCustomField("UF_CRM_1747682957"),
    BITRIX24_DEAL_TARGET_GROUP_FIELD: optionalCustomField(),
    BITRIX24_DEAL_MEETING_TYPE_FIELD: requiredCustomField(
      "UF_CRM_1669784114991"
    ),
    BITRIX24_DEAL_MEETING_DATE_FIELD: requiredCustomField(
      "UF_CRM_1669784197394"
    ),
    BITRIX24_CONTACT_TARGET_GROUP_FIELD: requiredCustomField("UF_CRM_1712252375"),
    BITRIX24_CONTACT_TARGET_GROUP_LEGACY_FIELD: requiredCustomField(
      "UF_CRM_1691070302"
    ),
    BITRIX24_PORTAL_HOST: optionalTrimmedString(),
    BITRIX24_WEBHOOK_USER_ID: optionalTrimmedString(),
    BITRIX24_WEBHOOK_TOKEN: optionalTrimmedString(),
    BITRIX24_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    BITRIX24_REQUEST_INTERVAL_MS: z.coerce.number().int().nonnegative().default(250),
    BITRIX24_BOOTSTRAP_LOOKBACK_DAYS: z.coerce.number().int().positive().default(365),
    DATABASE_URL: z.string().default("file:./data/bitrix24-reporting.db"),
    PLATFORM_DATABASE_URL: optionalTrimmedString(),
    ATTRACTION_DATABASE_URL: optionalTrimmedString(),
    LEADGEN_DATABASE_URL: optionalTrimmedString(),
    JSON_BODY_LIMIT: z.string().trim().min(1).default("256kb"),
    MCP_ACCESS_TOKEN: optionalTrimmedString(),
    NODE_ENV: z.string().default("development"),
    CALL_ANALYSIS_DOWNLOAD_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60_000),
    CALL_ANALYSIS_MAX_AUDIO_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(50 * 1024 * 1024),
    CALL_ENRICHMENT_INTAKE_ENABLED: z.enum(["true", "false"]).default("false"),
    BITRIX_CALL_EVENT_WEBHOOK_SECRET: optionalTrimmedString(),
    OPENROUTER_API_KEY: optionalTrimmedString(),
    OPENROUTER_MODEL: z.string().trim().min(1).default("google/gemini-3.5-flash"),
    OPENROUTER_PROMPT_VERSION: z.string().trim().min(1).default("calls-v2"),
    OPENROUTER_DIALOGUE_GATE_MODEL: z
      .string()
      .trim()
      .min(1)
      .default("google/gemini-2.5-flash-lite"),
    OPENROUTER_DIALOGUE_GATE_PROMPT_VERSION: z
      .string()
      .trim()
      .min(1)
      .default("dialogue-gate-v1"),
    CALL_ANALYSIS_DIALOGUE_GATE_ENABLED: z.preprocess(
      emptyStringToUndefined,
      z.enum(["true", "false"]).optional()
    ),
    OPENROUTER_APP_REFERER: optionalTrimmedString(),
    OPENROUTER_APP_TITLE: optionalTrimmedString(),
    PAPERCLIP_API_URL: optionalTrimmedString(),
    PAPERCLIP_API_TOKEN: optionalTrimmedString(),
    PAPERCLIP_BOARD_API_TOKEN: optionalTrimmedString(),
    PAPERCLIP_REWORK_COMMENT_MODE: z
      .enum(["board", "service"])
      .default("board"),
    PAPERCLIP_ATTRACTION_COMPANY_ID: optionalTrimmedString(),
    PAPERCLIP_ATTRACTION_PROJECT_ID: optionalTrimmedString(),
    PAPERCLIP_ATTRACTION_GOAL_ID: optionalTrimmedString(),
    PAPERCLIP_ATTRACTION_TRIAGE_AGENT_ID: optionalTrimmedString(),
    PAPERCLIP_LEADGEN_COMPANY_ID: optionalTrimmedString(),
    PAPERCLIP_LEADGEN_PROJECT_ID: optionalTrimmedString(),
    PAPERCLIP_LEADGEN_GOAL_ID: optionalTrimmedString(),
    PAPERCLIP_LEADGEN_TRIAGE_AGENT_ID: optionalTrimmedString(),
    REPORT_DEFAULT_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
    REPORT_WON_STAGE_IDS: z.string().default("C10:WON"),
    SESSION_COOKIE_NAME: z.string().trim().min(1).default("b24dash_session"),
    SESSION_SECRET: optionalTrimmedString(),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
    TRUST_PROXY: z
      .union([z.literal("loopback"), z.literal("false"), z.literal("true")])
      .default("loopback"),
    TELEGRAM_ACTIVITY_REPORT_ENABLED: z.enum(["true", "false"]).default("false"),
    TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN: optionalTrimmedString(),
    TELEGRAM_ACTIVITY_REPORT_CHAT_ID: optionalTrimmedString(),
    TELEGRAM_ACTIVITY_REPORT_CHAT_IDS: optionalTrimmedString(),
    TELEGRAM_ACTIVITY_REPORT_TIME: z
      .string()
      .trim()
      .regex(REPORT_TIME_PATTERN, "TELEGRAM_ACTIVITY_REPORT_TIME must be HH:mm")
      .default("20:00"),
    TELEGRAM_ENRICHMENT_ENABLED: z.enum(["true", "false"]).default("false"),
    TELEGRAM_ENRICHMENT_BOT_TOKEN: optionalTrimmedString(),
    TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS: optionalTrimmedString(),
    TELEGRAM_ENRICHMENT_CALLBACK_SECRET: optionalTrimmedString(),
    WEB_STATIC_DIR: optionalTrimmedString(),
    WEB_ORIGIN: z.string().default("http://localhost:5173")
  })
  .superRefine((value, context) => {
    const webhookKeys = [
      "BITRIX24_PORTAL_HOST",
      "BITRIX24_WEBHOOK_USER_ID",
      "BITRIX24_WEBHOOK_TOKEN"
    ] as const;
    const configuredKeys = webhookKeys.filter((key) => Boolean(value[key]));

    if (
      configuredKeys.length > 0 &&
      configuredKeys.length < webhookKeys.length
    ) {
      const message =
        "BITRIX24_PORTAL_HOST, BITRIX24_WEBHOOK_USER_ID, and BITRIX24_WEBHOOK_TOKEN must be configured together.";

      for (const key of webhookKeys) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message
        });
      }
    }

    if (value.AUTH_MODE === "password") {
      if (!value.SESSION_SECRET || value.SESSION_SECRET.length < 32) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SESSION_SECRET"],
          message:
            "SESSION_SECRET must be configured and at least 32 characters when AUTH_MODE=password."
        });
      }
    }

    if (value.MCP_ACCESS_TOKEN && value.MCP_ACCESS_TOKEN.length < 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MCP_ACCESS_TOKEN"],
        message: "MCP_ACCESS_TOKEN must be at least 32 characters when configured."
      });
    }

    if (
      value.CALL_ENRICHMENT_INTAKE_ENABLED === "true" &&
      (!value.BITRIX_CALL_EVENT_WEBHOOK_SECRET ||
        value.BITRIX_CALL_EVENT_WEBHOOK_SECRET.length < 32)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BITRIX_CALL_EVENT_WEBHOOK_SECRET"],
        message:
          "BITRIX_CALL_EVENT_WEBHOOK_SECRET must be configured and at least 32 characters when CALL_ENRICHMENT_INTAKE_ENABLED=true."
      });
    }

    if (value.NODE_ENV === "production") {
      if (value.AUTH_MODE !== "password") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_MODE"],
          message: "Production requires AUTH_MODE=password."
        });
      }

      if (!value.APP_PUBLIC_URL?.startsWith("https://")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["APP_PUBLIC_URL"],
          message: "Production APP_PUBLIC_URL must be an HTTPS URL."
        });
      }
    }

    if (value.TELEGRAM_ACTIVITY_REPORT_ENABLED === "true") {
      if (!value.TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN"],
          message:
            "TELEGRAM_ACTIVITY_REPORT_BOT_TOKEN must be configured when TELEGRAM_ACTIVITY_REPORT_ENABLED=true."
        });
      }

      if (
        !value.TELEGRAM_ACTIVITY_REPORT_CHAT_ID &&
        !value.TELEGRAM_ACTIVITY_REPORT_CHAT_IDS
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_ACTIVITY_REPORT_CHAT_IDS"],
          message:
            "TELEGRAM_ACTIVITY_REPORT_CHAT_IDS or TELEGRAM_ACTIVITY_REPORT_CHAT_ID must be configured when TELEGRAM_ACTIVITY_REPORT_ENABLED=true."
        });
      }
    }

    if (value.TELEGRAM_ENRICHMENT_ENABLED === "true") {
      if (!value.TELEGRAM_ENRICHMENT_BOT_TOKEN) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_ENRICHMENT_BOT_TOKEN"],
          message:
            "TELEGRAM_ENRICHMENT_BOT_TOKEN must be configured when TELEGRAM_ENRICHMENT_ENABLED=true."
        });
      }

      if (!value.TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS"],
          message:
            "TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS must be configured when TELEGRAM_ENRICHMENT_ENABLED=true."
        });
      }

      if (
        !value.TELEGRAM_ENRICHMENT_CALLBACK_SECRET ||
        value.TELEGRAM_ENRICHMENT_CALLBACK_SECRET.length < 32
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TELEGRAM_ENRICHMENT_CALLBACK_SECRET"],
          message:
            "TELEGRAM_ENRICHMENT_CALLBACK_SECRET must be at least 32 characters when TELEGRAM_ENRICHMENT_ENABLED=true."
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema> & {
  bitrixDealCategoryIds: string[];
  leadgenCategoryId: string;
  leadgenManagerIds: string[];
  platformDatabaseUrl: string;
  attractionDatabaseUrl: string;
  leadgenDatabaseUrl: string;
  reportWonStageIds: string[];
  bitrixEnabled: boolean;
  attractionAutoSyncEnabled: boolean;
  attractionAutoSyncIntervalMs: number;
  callEnrichmentIntakeEnabled: boolean;
  bitrixCallEventWebhookSecret?: string;
  callAnalysisDialogueGateEnabled: boolean;
  telegramActivityReportEnabled: boolean;
  telegramActivityReportChatIds: string[];
  telegramActivityReportTime: string;
  telegramEnrichmentEnabled: boolean;
  telegramEnrichmentManagerChatIds: Record<string, string>;
  telegramEnrichmentCallbackSecret?: string;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.parse(source);
  const platformDatabaseUrl = parsed.PLATFORM_DATABASE_URL ?? parsed.DATABASE_URL;
  const attractionDatabaseUrl =
    parsed.ATTRACTION_DATABASE_URL ?? "file:./data/bitrix24-attraction.db";
  const leadgenDatabaseUrl =
    parsed.LEADGEN_DATABASE_URL ?? "file:./data/bitrix24-leadgen.db";
  const databaseUrls = [
    platformDatabaseUrl,
    attractionDatabaseUrl,
    leadgenDatabaseUrl
  ].map(canonicalDatabaseUrl);

  if (new Set(databaseUrls).size !== databaseUrls.length) {
    throw new Error(
      "Platform, attraction, and leadgen database URLs must be distinct"
    );
  }

  const attractionAutoSyncEnabled =
    parsed.ATTRACTION_AUTO_SYNC_ENABLED === undefined
      ? parsed.NODE_ENV === "production"
      : parsed.ATTRACTION_AUTO_SYNC_ENABLED === "true";
  const callEnrichmentIntakeEnabled =
    parsed.CALL_ENRICHMENT_INTAKE_ENABLED === "true";
  const callAnalysisDialogueGateEnabled =
    parsed.CALL_ANALYSIS_DIALOGUE_GATE_ENABLED === undefined
      ? callEnrichmentIntakeEnabled
      : parsed.CALL_ANALYSIS_DIALOGUE_GATE_ENABLED === "true";
  const telegramActivityReportChatIds = Array.from(
    new Set([
      ...parseCsv(parsed.TELEGRAM_ACTIVITY_REPORT_CHAT_IDS),
      ...parseCsv(parsed.TELEGRAM_ACTIVITY_REPORT_CHAT_ID)
    ])
  );
  const telegramEnrichmentManagerChatIds = parseManagerChatIdPairs(
    parsed.TELEGRAM_ENRICHMENT_MANAGER_CHAT_IDS
  );

  return {
    ...parsed,
    bitrixDealCategoryIds: parsed.BITRIX24_DEAL_CATEGORY_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    leadgenCategoryId: parsed.BITRIX24_LEADGEN_US_CATEGORY_ID.trim(),
    leadgenManagerIds: parsed.BITRIX24_LEADGEN_MANAGER_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    platformDatabaseUrl,
    attractionDatabaseUrl,
    leadgenDatabaseUrl,
    reportWonStageIds: parsed.REPORT_WON_STAGE_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    bitrixEnabled: Boolean(
      parsed.BITRIX24_PORTAL_HOST &&
        parsed.BITRIX24_WEBHOOK_USER_ID &&
        parsed.BITRIX24_WEBHOOK_TOKEN
    ),
    attractionAutoSyncEnabled,
    attractionAutoSyncIntervalMs:
      parsed.ATTRACTION_AUTO_SYNC_INTERVAL_MINUTES * 60 * 1_000,
    callEnrichmentIntakeEnabled,
    ...(parsed.BITRIX_CALL_EVENT_WEBHOOK_SECRET
      ? { bitrixCallEventWebhookSecret: parsed.BITRIX_CALL_EVENT_WEBHOOK_SECRET }
      : {}),
    callAnalysisDialogueGateEnabled,
    telegramActivityReportEnabled:
      parsed.TELEGRAM_ACTIVITY_REPORT_ENABLED === "true",
    telegramActivityReportChatIds,
    telegramActivityReportTime: parsed.TELEGRAM_ACTIVITY_REPORT_TIME,
    telegramEnrichmentEnabled: parsed.TELEGRAM_ENRICHMENT_ENABLED === "true",
    telegramEnrichmentManagerChatIds,
    ...(parsed.TELEGRAM_ENRICHMENT_CALLBACK_SECRET
      ? {
          telegramEnrichmentCallbackSecret:
            parsed.TELEGRAM_ENRICHMENT_CALLBACK_SECRET
        }
      : {})
  };
}
