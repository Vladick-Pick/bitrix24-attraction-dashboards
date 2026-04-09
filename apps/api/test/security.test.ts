import { describe, expect, it } from "vitest";

import {
  ALLOWED_BITRIX_METHODS,
  FORBIDDEN_FIELD_TOKENS,
  assertAllowedBitrixMethod,
  assertSafeSelectFields,
  redactWebhookUrl
} from "../src/bitrix/security";

describe("Bitrix transport security", () => {
  it("keeps the runtime method policy on a strict allowlist", () => {
    expect(ALLOWED_BITRIX_METHODS).toEqual([
      "crm.deal.list",
      "crm.lead.list",
      "crm.status.list"
    ]);
    expect(() => assertAllowedBitrixMethod("crm.contact.list")).toThrow(
      /forbidden/i
    );
  });

  it("rejects selects that contain pii or wildcard fields", () => {
    expect(FORBIDDEN_FIELD_TOKENS).toContain("PHONE");
    expect(() => assertSafeSelectFields(["ID", "PHONE"])).toThrow(/PHONE/);
    expect(() => assertSafeSelectFields(["ID", "*"])).toThrow(/\*/);
    expect(() => assertSafeSelectFields(["ID", "DATE_CREATE"])).not.toThrow();
  });

  it("redacts the secret part of the webhook url before logging", () => {
    expect(
      redactWebhookUrl("https://portal.bitrix24.ru/rest/1/secrettoken/crm.deal.list")
    ).toBe("https://portal.bitrix24.ru/rest/1/[REDACTED]/crm.deal.list");
  });
});
