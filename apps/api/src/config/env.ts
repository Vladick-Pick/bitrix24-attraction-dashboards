import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  APP_TIMEZONE: z.string().default("Europe/Istanbul"),
  BITRIX24_PORTAL_HOST: z.string().optional(),
  BITRIX24_WEBHOOK_USER_ID: z.string().optional(),
  BITRIX24_WEBHOOK_TOKEN: z.string().optional(),
  BITRIX24_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  BITRIX24_REQUEST_INTERVAL_MS: z.coerce.number().int().nonnegative().default(250),
  DATABASE_URL: z.string().default("file:./apps/api/data/bitrix24-reporting.db"),
  REPORT_DEFAULT_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
  REPORT_WON_STAGE_IDS: z.string().default("WON,C1:WON"),
  WEB_ORIGIN: z.string().default("http://localhost:5173")
});

export type AppEnv = z.infer<typeof envSchema> & {
  reportWonStageIds: string[];
  bitrixEnabled: boolean;
};

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.parse(source);

  return {
    ...parsed,
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
