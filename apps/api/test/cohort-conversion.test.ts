import { describe, expect, it } from "vitest";
import type { DealSnapshot } from "@bitrix24-reporting/contracts";

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

    expect(result).toMatchObject({
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

  it("builds source, quality and customer breakdown rows with relative sale buckets", () => {
    const makeDeal = (overrides: Partial<DealSnapshot>): DealSnapshot => ({
      id: "deal",
      leadId: null,
      categoryId: "10",
      stageId: "C10:PREPARATION",
      stageSemanticId: "P",
      opportunity: 0,
      assignedById: "7",
      sourceId: "LIDGEN",
      qualityValue: null,
      businessClubValue: null,
      targetGroupValue: null,
      tariffValue: null,
      dateCreate: "2026-01-01T00:00:00.000Z",
      dateModify: "2026-01-01T00:00:00.000Z",
      dateClosed: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      ...overrides
    });

    const result = buildCohortConversionReport({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-06-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      stageCatalog: [
        {
          entityType: "source",
          categoryId: null,
          statusId: "LIDGEN",
          name: "Лидген УС",
          semanticId: null
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "SELF",
          name: "Самостоятельно",
          semanticId: null
        }
      ],
      deals: [
        makeDeal({
          id: "LIDGEN-WON-LATE",
          stageId: "C10:WON",
          stageSemanticId: "S",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-01-10T00:00:00.000Z",
          dateModify: "2026-03-05T00:00:00.000Z",
          dateClosed: "2026-03-05T00:00:00.000Z"
        }),
        makeDeal({
          id: "LIDGEN-OPEN",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-01-12T00:00:00.000Z"
        }),
        makeDeal({
          id: "LIDGEN-LOST",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-01-11T00:00:00.000Z",
          dateModify: "2026-02-11T00:00:00.000Z",
          dateClosed: "2026-02-11T00:00:00.000Z"
        }),
        makeDeal({
          id: "LIDGEN-WON-FAST",
          stageId: "C10:WON",
          stageSemanticId: "S",
          qualityValue: "4.1 Пришел на встречу",
          businessClubValue: "ClubFirst Future",
          dateCreate: "2026-01-15T00:00:00.000Z",
          dateModify: "2026-01-25T00:00:00.000Z",
          dateClosed: "2026-01-25T00:00:00.000Z"
        }),
        makeDeal({
          id: "SELF-WON",
          sourceId: "SELF",
          stageId: "C10:WON",
          stageSemanticId: "S",
          qualityValue: "5 Готов к заключению Договора",
          tariffValue: "ClubFirst One",
          dateCreate: "2026-01-20T00:00:00.000Z",
          dateModify: "2026-02-02T00:00:00.000Z",
          dateClosed: "2026-02-02T00:00:00.000Z"
        }),
        makeDeal({
          id: "LIDGEN-FEB-WON",
          stageId: "C10:WON",
          stageSemanticId: "S",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          dateCreate: "2026-02-10T00:00:00.000Z",
          dateModify: "2026-02-20T00:00:00.000Z",
          dateClosed: "2026-02-20T00:00:00.000Z"
        })
      ]
    });

    expect(result.breakdownRows).toEqual([
      expect.objectContaining({
        level: "cohort",
        parentId: null,
        cohortMonth: "2026-01",
        createdDeals: 5,
        closedDeals: 4,
        wonDeals: 3,
        wonConversionRate: 60
      }),
      expect.objectContaining({
        level: "source",
        parentId: expect.stringContaining("cohort:2026-01"),
        cohortMonth: "2026-01",
        sourceKey: "LIDGEN",
        sourceLabel: "Лидген УС",
        createdDeals: 4,
        closedDeals: 3,
        wonDeals: 2,
        closedRate: 75,
        wonConversionRate: 50,
        averageDaysToClose: 31.67,
        averageDaysToWin: 32
      }),
      expect.objectContaining({
        level: "quality",
        parentId: expect.stringContaining("source:2026-01"),
        cohortMonth: "2026-01",
        sourceKey: "LIDGEN",
        qualityKey: "3.1 Готов ко встрече",
        qualityLabel: "3.1 Готов ко встрече",
        createdDeals: 3,
        closedDeals: 2,
        wonDeals: 1,
        wonConversionRate: 33.33
      }),
      expect.objectContaining({
        level: "customer",
        parentId: expect.stringContaining("quality:2026-01"),
        cohortMonth: "2026-01",
        customerKey: "business_club:ClubFirst One",
        customerLabel: "ClubFirst One",
        createdDeals: 3,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "quality",
        parentId: expect.stringContaining("source:2026-01"),
        cohortMonth: "2026-01",
        qualityKey: "4.1 Пришел на встречу",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "customer",
        parentId: expect.stringContaining("quality:2026-01"),
        cohortMonth: "2026-01",
        customerKey: "business_club:ClubFirst Future",
        customerLabel: "ClubFirst Future",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "source",
        parentId: expect.stringContaining("cohort:2026-01"),
        cohortMonth: "2026-01",
        sourceKey: "SELF",
        sourceLabel: "Самостоятельно",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "quality",
        parentId: expect.stringContaining("source:2026-01"),
        cohortMonth: "2026-01",
        qualityKey: "5 Готов к заключению Договора",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "customer",
        parentId: expect.stringContaining("quality:2026-01"),
        cohortMonth: "2026-01",
        customerKey: "UNSPECIFIED",
        customerLabel: "Без бизнес-клуба заказчика",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "cohort",
        parentId: null,
        cohortMonth: "2026-02",
        createdDeals: 1,
        wonDeals: 1,
        wonConversionRate: 100
      }),
      expect.objectContaining({
        level: "source",
        parentId: expect.stringContaining("cohort:2026-02"),
        cohortMonth: "2026-02",
        sourceKey: "LIDGEN",
        sourceLabel: "Лидген УС",
        createdDeals: 1,
        wonDeals: 1,
        wonConversionRate: 100
      }),
      expect.objectContaining({
        level: "quality",
        parentId: expect.stringContaining("source:2026-02"),
        cohortMonth: "2026-02",
        qualityKey: "3.1 Готов ко встрече",
        createdDeals: 1,
        wonDeals: 1
      }),
      expect.objectContaining({
        level: "customer",
        parentId: expect.stringContaining("quality:2026-02"),
        cohortMonth: "2026-02",
        customerKey: "business_club:ClubFirst One",
        customerLabel: "ClubFirst One",
        createdDeals: 1,
        wonDeals: 1
      })
    ]);
    const januaryLeadgenSourceRow = result.breakdownRows.find(
      (row) =>
        row.level === "source" &&
        row.cohortMonth === "2026-01" &&
        row.sourceKey === "LIDGEN"
    );
    expect(januaryLeadgenSourceRow?.relativeClosureBuckets).toEqual([
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
        wonDeals: 1,
        closedRate: 25,
        wonConversionRate: 25
      },
      {
        bucketKey: "month_4_plus",
        label: "В 4+ месяц",
        closedDeals: 0,
        wonDeals: 0,
        closedRate: 0,
        wonConversionRate: 0
      }
    ]);
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

  it("uses business club as the customer breakdown even when target group is present", () => {
    const result = buildCohortConversionReport({
      range: {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-01-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "DEAL-1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 0,
          assignedById: "7",
          sourceId: "LIDGEN",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          tariffValue: "ClubFirst Future",
          dateCreate: "2026-01-10T00:00:00.000Z",
          dateModify: "2026-01-20T00:00:00.000Z",
          dateClosed: "2026-01-20T00:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ]
    });

    expect(result.breakdownRows).toContainEqual(
      expect.objectContaining({
        level: "customer",
        customerKey: "business_club:ClubFirst One",
        customerLabel: "ClubFirst One",
        createdDeals: 1,
        wonDeals: 1
      })
    );
    expect(result.breakdownRows).not.toContainEqual(
      expect.objectContaining({
        level: "customer",
        customerKey: "target:ClubFirst Russia"
      })
    );
    expect(result.breakdownRows).not.toContainEqual(
      expect.objectContaining({
        level: "customer",
        customerKey: "tariff:ClubFirst Future"
      })
    );
  });
});
