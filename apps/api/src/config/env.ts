import { dirname, resolve } from "node:path";
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
  "UF_CRM_1712252375",
  "UF_CRM_1691070302"
]);

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
    AUTH_MODE: z.enum(["none", "password"]).default("none"),
    BITRIX24_DEAL_CATEGORY_IDS: z.string().default("10"),
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
    JSON_BODY_LIMIT: z.string().trim().min(1).default("256kb"),
    NODE_ENV: z.string().default("development"),
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
    REPORT_DEFAULT_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
    REPORT_WON_STAGE_IDS: z.string().default("C10:WON"),
    SESSION_COOKIE_NAME: z.string().trim().min(1).default("b24dash_session"),
    SESSION_SECRET: optionalTrimmedString(),
    SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
    TRUST_PROXY: z
      .union([z.literal("loopback"), z.literal("false"), z.literal("true")])
      .default("loopback"),
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
  });

export type AppEnv = z.infer<typeof envSchema> & {
  bitrixDealCategoryIds: string[];
  reportWonStageIds: string[];
  bitrixEnabled: boolean;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.parse(source);

  return {
    ...parsed,
    bitrixDealCategoryIds: parsed.BITRIX24_DEAL_CATEGORY_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    reportWonStageIds: parsed.REPORT_WON_STAGE_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    bitrixEnabled: Boolean(
      parsed.BITRIX24_PORTAL_HOST &&
        parsed.BITRIX24_WEBHOOK_USER_ID &&
        parsed.BITRIX24_WEBHOOK_TOKEN
    )
  };
}
