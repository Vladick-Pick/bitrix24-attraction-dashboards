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
      "crm.status.list",
      "crm.deal.fields",
      "crm.item.list",
      "crm.stagehistory.list",
      "crm.activity.list",
      "voximplant.statistic.get",
      "user.get"
    ]);
    expect(() => assertAllowedBitrixMethod("crm.contact.list")).toThrow(
      /forbidden/i
    );
  });

  it("rejects selects that contain pii or wildcard fields while allowing the configured quality field", () => {
    expect(FORBIDDEN_FIELD_TOKENS).toContain("PHONE");
    expect(() => assertSafeSelectFields(["ID", "PHONE"])).toThrow(/PHONE/);
    expect(() => assertSafeSelectFields(["ID", "*"])).toThrow(/\*/);
    expect(() =>
      assertSafeSelectFields(["ID", "UF_CRM_999"], ["UF_CRM_1730380390"])
    ).toThrow(/UF_CRM_999/);
    expect(() =>
      assertSafeSelectFields(
        ["ID", "UF_CRM_1730380390", "UF_CRM_1647422744"],
        ["UF_CRM_1730380390", "UF_CRM_1647422744"]
      )
    ).not.toThrow();
    expect(() => assertSafeSelectFields(["ID", "DATE_CREATE"])).not.toThrow();
  });

  it("redacts the secret part of the webhook url before logging", () => {
    expect(
      redactWebhookUrl("https://portal.bitrix24.ru/rest/1/secrettoken/crm.deal.list")
    ).toBe("https://portal.bitrix24.ru/rest/1/[REDACTED]/crm.deal.list");
  });
});
