import { describe, expect, it } from "vitest";

import { buildCohortConversionReport } from "../src/domain/operational-reports";

describe("buildCohortConversionReport", () => {
  it("groups cohorts by created month with both absolute close months and relative close buckets", () => {
    const result = buildCohortConversionReport({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 10000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-01-01T00:00:00.000Z",
          dateModify: "2026-01-11T00:00:00.000Z",
          dateClosed: "2026-01-11T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "2",
          leadId: null,
          categoryId: "10",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 3000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-01-01T00:00:00.000Z",
          dateModify: "2026-02-01T00:00:00.000Z",
          dateClosed: "2026-02-01T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "3",
          leadId: null,
          categoryId: "10",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 5000,
          assignedById: "9",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-01-01T00:00:00.000Z",
          dateModify: "2026-03-01T00:00:00.000Z",
          dateClosed: "2026-03-01T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "4",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 7000,
          assignedById: "9",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-01-01T00:00:00.000Z",
          dateModify: "2026-05-01T00:00:00.000Z",
          dateClosed: "2026-05-01T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "5",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 5000,
          assignedById: "9",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-02-04T10:00:00.000Z",
          dateModify: "2026-04-12T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ]
    });

    expect(result).toEqual({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      totalCreatedDeals: 5,
      totalClosedDeals: 4,
      totalWonDeals: 2,
      closureMonths: ["2026-01", "2026-02", "2026-03", "2026-05"],
      relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
      rows: [
        {
          createdMonth: "2026-01",
          createdDeals: 4,
          closedDeals: 4,
          wonDeals: 2,
          closedRate: 100,
          wonConversionRate: 50,
          averageDaysToClose: 55,
          averageDaysToWin: 65,
          closureBuckets: [
            {
              closedMonth: "2026-01",
              closedDeals: 1,
              wonDeals: 1,
              closedRate: 25,
              wonConversionRate: 25
            },
            {
              closedMonth: "2026-02",
              closedDeals: 1,
              wonDeals: 0,
              closedRate: 25,
              wonConversionRate: 0
            },
            {
              closedMonth: "2026-03",
              closedDeals: 1,
              wonDeals: 0,
              closedRate: 25,
              wonConversionRate: 0
            },
            {
              closedMonth: "2026-05",
              closedDeals: 1,
              wonDeals: 1,
              closedRate: 25,
              wonConversionRate: 25
            }
          ],
          relativeClosureBuckets: [
            {
              bucketKey: "month_1",
              label: "В 1 месяц",
              closedDeals: 1,
              wonDeals: 1,
              closedRate: 25,
              wonConversionRate: 25
            },
            {
              bucketKey: "month_2",
              label: "Во 2 месяц",
              closedDeals: 1,
              wonDeals: 0,
              closedRate: 25,
              wonConversionRate: 0
            },
            {
              bucketKey: "month_3",
              label: "В 3 месяц",
              closedDeals: 1,
              wonDeals: 0,
              closedRate: 25,
              wonConversionRate: 0
            },
            {
              bucketKey: "month_4_plus",
              label: "В 4+ месяц",
              closedDeals: 1,
              wonDeals: 1,
              closedRate: 25,
              wonConversionRate: 25
            }
          ]
        },
        {
          createdMonth: "2026-02",
          createdDeals: 1,
          closedDeals: 0,
          wonDeals: 0,
          closedRate: 0,
          wonConversionRate: 0,
          averageDaysToClose: 0,
          averageDaysToWin: 0,
          closureBuckets: [],
          relativeClosureBuckets: [
            {
              bucketKey: "month_1",
              label: "В 1 месяц",
              closedDeals: 0,
              wonDeals: 0,
              closedRate: 0,
              wonConversionRate: 0
            },
            {
              bucketKey: "month_2",
              label: "Во 2 месяц",
              closedDeals: 0,
              wonDeals: 0,
              closedRate: 0,
              wonConversionRate: 0
            },
            {
              bucketKey: "month_3",
              label: "В 3 месяц",
              closedDeals: 0,
              wonDeals: 0,
              closedRate: 0,
              wonConversionRate: 0
            },
            {
              bucketKey: "month_4_plus",
              label: "В 4+ месяц",
              closedDeals: 0,
              wonDeals: 0,
              closedRate: 0,
              wonConversionRate: 0
            }
          ]
        }
      ]
    });
  });
  it("counts lost terminal stage-history transitions when dateClosed is missing", () => {
    const result = buildCohortConversionReport({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-02-28T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "LOST-1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 3000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-01-05T00:00:00.000Z",
          dateModify: "2026-03-10T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageHistory: [
        {
          id: "LOST-1-H1",
          ownerId: "LOST-1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-01-05T00:00:00.000Z"
        },
        {
          id: "LOST-1-H2",
          ownerId: "LOST-1",
          categoryId: "10",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          typeId: null,
          createdTime: "2026-02-10T00:00:00.000Z"
        }
      ]
    });

    expect(result.totalClosedDeals).toBe(1);
    expect(result.closureMonths).toEqual(["2026-02"]);
    expect(result.rows[0]?.closureBuckets).toEqual([
      {
        closedMonth: "2026-02",
        closedDeals: 1,
        wonDeals: 0,
        closedRate: 100,
        wonConversionRate: 0
      }
    ]);
  });
});
