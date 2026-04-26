import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

loadDotenv({
  path: resolve(CONFIG_DIR, "../../../../.env")
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
    API_PORT: z.coerce.number().int().positive().default(8787),
    APP_TIMEZONE: z.string().default("Europe/Istanbul"),
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
    REPORT_DEFAULT_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
    REPORT_WON_STAGE_IDS: z.string().default("C10:WON"),
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
