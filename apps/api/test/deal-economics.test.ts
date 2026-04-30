import { describe, expect, it } from "vitest";

import type { DealSnapshot } from "@bitrix24-reporting/contracts";
import {
  DEFAULT_PRICING_RULES,
  resolveDealEconomics
} from "../src/domain/deal-economics";

const baseDeal: DealSnapshot = {
  id: "D1",
  title: null,
  leadId: null,
  categoryId: "10",
  stageId: "C10:WON",
  stageSemanticId: "S",
  opportunity: 1_300_000,
  assignedById: "78",
  sourceId: "WEB",
  qualityValue: null,
  businessClubValue: null,
  targetGroupValue: null,
  meetingTypeValue: null,
  meetingDateValue: null,
  tariffValue: null,
  refusalReasonValue: null,
  refusalReasonDetail: null,
  dateCreate: "2026-04-01T00:00:00.000Z",
  dateModify: "2026-04-10T00:00:00.000Z",
  dateClosed: "2026-04-10T00:00:00.000Z",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null
};

function economics(overrides: Partial<DealSnapshot>, context: "finalWon" | "pipelinePlan" = "finalWon") {
  return resolveDealEconomics({
    deal: {
      ...baseDeal,
      ...overrides
    },
    context,
    pricingRules: DEFAULT_PRICING_RULES
  });
}

describe("resolveDealEconomics", () => {
  it("prices final won ClubFirst Russia federal sales as attraction revenue", () => {
    expect(
      economics({
        targetGroupValue: "ClubFirst Russia",
        tariffValue: "Федеральный Москва"
      })
    ).toEqual(
      expect.objectContaining({
        membershipAmount: 1_300_000,
        attractionRevenueAmount: 300_000,
        pricingStatus: "priced"
      })
    );
  });

  it("prices final won ClubFirst Russia regional sales", () => {
    expect(
      economics({
        targetGroupValue: "ClubFirst Russia",
        tariffValue: "Региональный"
      }).attractionRevenueAmount
    ).toBe(225_000);
  });

  it("prices GlobAll and CFF special cases", () => {
    expect(
      economics({
        targetGroupValue: "ClubFirst GlobAll",
        tariffValue: "Globall",
        opportunity: 480_000
      }).attractionRevenueAmount
    ).toBe(150_000);

    expect(
      economics({
        targetGroupValue: "ClubFirst Future",
        tariffValue: "Федеральный"
      })
    ).toEqual(
      expect.objectContaining({
        attractionRevenueAmount: 181_000,
        pricingStatus: "priced",
        pricingWarnings: []
      })
    );

    const cff = economics({
      targetGroupValue: "ClubFirst Russia",
      tariffValue: "CFF",
      opportunity: 800_000
    });
    expect(cff.attractionRevenueAmount).toBe(181_000);
    expect(cff.pricingStatus).toBe("conflict");
    expect(cff.pricingWarnings.join(" ")).toContain("CFF");
  });

  it("prices final won CFF sales by tariff even when contract target group is missing", () => {
    expect(
      economics({
        businessClubValue: "ClubFirst Future",
        targetGroupValue: null,
        tariffValue: "CFF",
        opportunity: 800_000
      })
    ).toEqual(
      expect.objectContaining({
        membershipAmount: 800_000,
        attractionRevenueAmount: 181_000,
        pricingStatus: "priced",
        pricingWarnings: []
      })
    );
  });

  it("does not price final won sales without contract target group or tariff", () => {
    expect(
      economics({
        businessClubValue: "ClubFirst One",
        targetGroupValue: null,
        tariffValue: null
      })
    ).toEqual(
      expect.objectContaining({
        attractionRevenueAmount: null,
        pricingStatus: "missingContractFields"
      })
    );
  });

  it("prices pipeline plan by target group or business club and federal fallback tariff", () => {
    expect(
      economics(
        {
          businessClubValue: "ClubFirst One",
          targetGroupValue: null,
          tariffValue: null,
          opportunity: 1_300_000
        },
        "pipelinePlan"
      )
    ).toEqual(
      expect.objectContaining({
        membershipAmount: 1_300_000,
        attractionRevenueAmount: 300_000,
        pricingStatus: "priced"
      })
    );
  });

  it("does not apply ClubFirst pricing automatically to Guest or Ladies", () => {
    expect(
      economics({
        targetGroupValue: "ClubFirst Guest",
        tariffValue: "Федеральный Москва"
      })
    ).toEqual(
      expect.objectContaining({
        attractionRevenueAmount: null,
        pricingStatus: "missingPricingRule"
      })
    );
  });
});
