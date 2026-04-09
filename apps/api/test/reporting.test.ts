import { describe, expect, it } from "vitest";

import { buildDashboard } from "../src/domain/reporting";

describe("buildDashboard", () => {
  it("computes sales overview, funnel snapshot and source breakdown from anonymized snapshots", () => {
    const result = buildDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C1:WON"],
      deals: [
        {
          id: "1",
          leadId: "L1",
          categoryId: "1",
          stageId: "C1:WON",
          stageSemanticId: "S",
          opportunity: 12000,
          assignedById: "7",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-04-05T11:00:00.000Z",
          dateClosed: "2026-04-05T11:00:00.000Z",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "spring",
          utmContent: null,
          utmTerm: null
        },
        {
          id: "2",
          leadId: "L2",
          categoryId: "1",
          stageId: "C1:IN_PROGRESS",
          stageSemanticId: "P",
          opportunity: 5000,
          assignedById: "9",
          dateCreate: "2026-04-07T09:00:00.000Z",
          dateModify: "2026-04-10T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      leads: [
        {
          id: "L1",
          statusId: "CONVERTED",
          sourceId: "WEB",
          opportunity: 10000,
          assignedById: "7",
          dateCreate: "2026-04-01T08:00:00.000Z",
          dateModify: "2026-04-02T08:00:00.000Z",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "spring",
          utmContent: null,
          utmTerm: null
        },
        {
          id: "L2",
          statusId: "IN_PROCESS",
          sourceId: "REFERRAL",
          opportunity: 4000,
          assignedById: "9",
          dateCreate: "2026-04-03T08:00:00.000Z",
          dateModify: "2026-04-06T08:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:WON",
          name: "Won",
          semanticId: "S"
        },
        {
          entityType: "deal",
          categoryId: "1",
          statusId: "C1:IN_PROGRESS",
          name: "Negotiation",
          semanticId: "P"
        }
      ]
    });

    expect(result.salesOverview).toEqual({
      salesCount: 1,
      salesAmount: 12000,
      averageSaleAmount: 12000,
      newDealsCount: 2,
      conversionRate: 50,
      salesTimeline: [
        {
          date: "2026-04-05",
          salesCount: 1,
          salesAmount: 12000
        }
      ]
    });

    expect(result.funnelSnapshot).toEqual([
      {
        stageId: "C1:WON",
        stageName: "Won",
        count: 1,
        amount: 12000
      },
      {
        stageId: "C1:IN_PROGRESS",
        stageName: "Negotiation",
        count: 1,
        amount: 5000
      }
    ]);

    expect(result.sourceBreakdown).toEqual([
      {
        sourceKey: "google",
        sourceLabel: "google",
        salesCount: 1,
        salesAmount: 12000,
        newDealsCount: 1,
        newLeadsCount: 1
      },
      {
        sourceKey: "REFERRAL",
        sourceLabel: "REFERRAL",
        salesCount: 0,
        salesAmount: 0,
        newDealsCount: 1,
        newLeadsCount: 1
      }
    ]);
  });
});
