import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readEnv } from "../src/config/env";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe("readEnv", () => {
  it("rejects unsafe Bitrix custom field overrides instead of trusting arbitrary UF fields", () => {
    expect(() =>
      readEnv({
        BITRIX24_DEAL_QUALITY_FIELD: "UF_CRM_9999999999"
      })
    ).toThrow(/not allowed/i);
  });

  it("treats an empty optional target-group field as disabled", () => {
    expect(
      readEnv({
        BITRIX24_DEAL_TARGET_GROUP_FIELD: ""
      }).BITRIX24_DEAL_TARGET_GROUP_FIELD
    ).toBeUndefined();
  });

  it("rejects partial Bitrix webhook configuration", () => {
    expect(() =>
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru"
      })
    ).toThrow(/configured together|all three/i);

    expect(() =>
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru",
        BITRIX24_WEBHOOK_USER_ID: "1"
      })
    ).toThrow(/configured together|all three/i);
  });

  it("enables Bitrix only when all webhook settings are present", () => {
    expect(
      readEnv({
        BITRIX24_PORTAL_HOST: "portal.bitrix24.ru",
        BITRIX24_WEBHOOK_USER_ID: "1",
        BITRIX24_WEBHOOK_TOKEN: "secret"
      }).bitrixEnabled
    ).toBe(true);
  });

  it("keeps Bitrix disabled when webhook settings are absent", () => {
    expect(readEnv({}).bitrixEnabled).toBe(false);
  });

  it("requires password auth configuration in production", () => {
    expect(() =>
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "none"
      })
    ).toThrow(/AUTH_MODE=password/i);

    expect(() =>
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password"
      })
    ).toThrow(/SESSION_SECRET/i);

    expect(
      readEnv({
        NODE_ENV: "production",
        AUTH_MODE: "password",
        SESSION_SECRET: "production-session-secret-with-at-least-32-bytes",
        APP_PUBLIC_URL: "https://dash.example.com"
      }).AUTH_MODE
    ).toBe("password");
  });

  it("sets NODE_ENV=production in the compiled production start script", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(TEST_DIR, "../package.json"), "utf8")
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts?.["start:prod"]).toMatch(
      /\bNODE_ENV=production\b/
    );
  });
});
