import { describe, expect, it } from "vitest";

import {
  CALL_ENRICHMENT_ALL_FIELD_CODES,
  CALL_ENRICHMENT_CONTACT_FIELDS,
  CALL_ENRICHMENT_DEAL_FIELDS,
  CALL_ENRICHMENT_FIELDS,
  assertCallEnrichmentFieldAllowed,
  getCallEnrichmentFieldByCode,
  isCallEnrichmentFieldCode
} from "../src/server/call-enrichment-fields";
import { assertSafeCallEnrichmentWriteFields } from "../src/bitrix/security";

describe("call enrichment field contract", () => {
  it("contains exactly the approved V1 contact and deal fields", () => {
    expect(CALL_ENRICHMENT_CONTACT_FIELDS).toHaveLength(19);
    expect(CALL_ENRICHMENT_DEAL_FIELDS).toHaveLength(2);
    expect(CALL_ENRICHMENT_FIELDS).toHaveLength(21);
    expect(new Set(CALL_ENRICHMENT_ALL_FIELD_CODES).size).toBe(21);
  });

  it("routes deal-owned enrichment fields to deals", () => {
    expect(getCallEnrichmentFieldByCode("UF_CRM_1766147164481")).toMatchObject({
      logicalKey: "keyProjects",
      entityType: "deal",
      valueKind: "string"
    });
    expect(getCallEnrichmentFieldByCode("UF_CRM_1766147207634")).toMatchObject({
      logicalKey: "clubConnections",
      entityType: "deal",
      valueKind: "string"
    });
  });

  it("routes contact-owned enrichment fields to contacts", () => {
    expect(getCallEnrichmentFieldByCode("UF_CRM_1647946359")).toMatchObject({
      logicalKey: "businessRevenue",
      entityType: "contact",
      valueKind: "enum"
    });
  });

  it("rejects unknown and wrong-entity fields", () => {
    expect(isCallEnrichmentFieldCode("UF_CRM_UNKNOWN")).toBe(false);
    expect(() =>
      assertCallEnrichmentFieldAllowed("contact", "UF_CRM_UNKNOWN")
    ).toThrow(/forbidden/i);
    expect(() =>
      assertCallEnrichmentFieldAllowed("deal", "UF_CRM_1647946359")
    ).toThrow(/belongs to contact/);
    expect(() =>
      assertCallEnrichmentFieldAllowed("contact", "UF_CRM_1766147164481")
    ).toThrow(/belongs to deal/);
  });

  it("rejects personal, multifield, and non-allowlisted write fields", () => {
    for (const field of [
      "PHONE",
      "EMAIL",
      "NAME",
      "COMMENTS",
      "CONTACT_IDS",
      "COMPANY_ID",
      "UF_CRM_UNKNOWN"
    ]) {
      expect(() =>
        assertSafeCallEnrichmentWriteFields("contact", { [field]: "x" })
      ).toThrow(new RegExp(field));
    }
  });
});
