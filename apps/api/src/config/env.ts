import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

loadDotenv({
  path: resolve(CONFIG_DIR, "../../../../.env")
});

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  APP_TIMEZONE: z.string().default("Europe/Istanbul"),
  BITRIX24_DEAL_CATEGORY_IDS: z.string().default("10"),
  BITRIX24_DEAL_QUALITY_FIELD: z.string().default("UF_CRM_1730380390"),
  BITRIX24_DEAL_TARIFF_FIELD: z.string().default("UF_CRM_1643901145"),
  BITRIX24_DEAL_BUSINESS_CLUB_FIELD: z
    .string()
    .default("UF_CRM_1747682957"),
  BITRIX24_DEAL_TARGET_GROUP_FIELD: z.string().optional(),
  BITRIX24_DEAL_MEETING_TYPE_FIELD: z.string().optional(),
  BITRIX24_PORTAL_HOST: z.string().optional(),
  BITRIX24_WEBHOOK_USER_ID: z.string().optional(),
  BITRIX24_WEBHOOK_TOKEN: z.string().optional(),
  BITRIX24_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  BITRIX24_REQUEST_INTERVAL_MS: z.coerce.number().int().nonnegative().default(250),
  DATABASE_URL: z.string().default("file:./data/bitrix24-reporting.db"),
  REPORT_DEFAULT_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
  REPORT_WON_STAGE_IDS: z.string().default("C10:WON"),
  WEB_ORIGIN: z.string().default("http://localhost:5173")
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
