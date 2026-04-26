import { describe, expect, it } from "vitest";

import { buildSourceQualityConversionReport } from "../src/domain/operational-reports";

describe("buildSourceQualityConversionReport", () => {
  it("builds source and quality conversion rows with ordered stage progression metrics", () => {
    const result = buildSourceQualityConversionReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 12000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-04-05T11:00:00.000Z",
          dateClosed: "2026-04-05T11:00:00.000Z",
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
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 5000,
          assignedById: "9",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          dateCreate: "2026-04-07T09:00:00.000Z",
          dateModify: "2026-04-10T11:00:00.000Z",
          dateClosed: null,
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
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 3000,
          assignedById: "11",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-04-09T08:00:00.000Z",
          dateModify: "2026-04-09T09:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "REFERRAL",
          name: "Referral",
          semanticId: null,
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:NEW",
          name: "База входящая",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:UC_9E0XYG",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 30
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 40
        }
      ],
      stageHistory: [
        {
          id: "T1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T09:00:00.000Z"
        },
        {
          id: "T2",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        },
        {
          id: "T3",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "T4",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-05T11:00:00.000Z"
        },
        {
          id: "T5",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-07T09:00:00.000Z"
        },
        {
          id: "T6",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-07T12:00:00.000Z"
        },
        {
          id: "T7",
          ownerId: "3",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-09T08:00:00.000Z"
        }
      ]
    });

    expect(result.totalCreatedDeals).toBe(3);
    expect(result.totalWonDeals).toBe(1);
    expect(result.stageSequence).toEqual([
      {
        stageId: "C10:NEW",
        stageName: "База входящая",
        sortOrder: 10
      },
      {
        stageId: "C10:PREPARATION",
        stageName: "Звонок-знакомство",
        sortOrder: 20
      },
      {
        stageId: "C10:UC_9E0XYG",
        stageName: "Встреча-знакомство",
        sortOrder: 30
      },
      {
        stageId: "C10:WON",
        stageName: "Передано в клуб",
        sortOrder: 40
      }
    ]);
    expect(result.rows).toEqual([
      {
        sourceKey: "WEB",
        sourceLabel: "Website",
        qualityKey: "3.1 Готов ко встрече",
        qualityLabel: "3.1 Готов ко встрече",
        createdDeals: 2,
        wonDeals: 1,
        stageMetrics: [
          {
            stageId: "C10:NEW",
            stageName: "База входящая",
            reachedDeals: 2,
            conversionRate: 100,
            averageStageDurationHours: 2
          },
          {
            stageId: "C10:PREPARATION",
            stageName: "Звонок-знакомство",
            reachedDeals: 2,
            conversionRate: 100,
            averageStageDurationHours: 24
          },
          {
            stageId: "C10:UC_9E0XYG",
            stageName: "Встреча-знакомство",
            reachedDeals: 1,
            conversionRate: 50,
            averageStageDurationHours: 49
          },
          {
            stageId: "C10:WON",
            stageName: "Передано в клуб",
            reachedDeals: 1,
            conversionRate: 50,
            averageStageDurationHours: 0
          }
        ]
      },
      {
        sourceKey: "REFERRAL",
        sourceLabel: "Referral",
        qualityKey: "UNQUALIFIED",
        qualityLabel: "UNQUALIFIED",
        createdDeals: 1,
        wonDeals: 0,
        stageMetrics: [
          {
            stageId: "C10:NEW",
            stageName: "База входящая",
            reachedDeals: 1,
            conversionRate: 100,
            averageStageDurationHours: 0
          },
          {
            stageId: "C10:PREPARATION",
            stageName: "Звонок-знакомство",
            reachedDeals: 0,
            conversionRate: 0,
            averageStageDurationHours: 0
          },
          {
            stageId: "C10:UC_9E0XYG",
            stageName: "Встреча-знакомство",
            reachedDeals: 0,
            conversionRate: 0,
            averageStageDurationHours: 0
          },
          {
            stageId: "C10:WON",
            stageName: "Передано в клуб",
            reachedDeals: 0,
            conversionRate: 0,
            averageStageDurationHours: 0
          }
        ]
      }
    ]);
  });

  it("cuts stage progression at the report end instead of using future history or current stage", () => {
    const result = buildSourceQualityConversionReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 12000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-05-08T11:00:00.000Z",
          dateClosed: "2026-05-08T11:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "source",
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:NEW",
          name: "База входящая",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 20
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:UC_9E0XYG",
          name: "Встреча-знакомство",
          semanticId: "P",
          sortOrder: 30
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 40
        }
      ],
      stageHistory: [
        {
          id: "T1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T09:00:00.000Z"
        },
        {
          id: "T2",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-10T09:00:00.000Z"
        },
        {
          id: "T3",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-05-02T09:00:00.000Z"
        },
        {
          id: "T4",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-05-08T11:00:00.000Z"
        }
      ]
    });

    expect(result.totalCreatedDeals).toBe(1);
    expect(result.totalWonDeals).toBe(0);
    expect(result.rows[0]?.stageMetrics.map((stage) => ({
      stageId: stage.stageId,
      reachedDeals: stage.reachedDeals,
      conversionRate: stage.conversionRate
    }))).toEqual([
      { stageId: "C10:NEW", reachedDeals: 1, conversionRate: 100 },
      { stageId: "C10:PREPARATION", reachedDeals: 1, conversionRate: 100 },
      { stageId: "C10:UC_9E0XYG", reachedDeals: 0, conversionRate: 0 },
      { stageId: "C10:WON", reachedDeals: 0, conversionRate: 0 }
    ]);
  });
  it("counts wins by won-stage history instead of dateModify when dateClosed is missing", () => {
    const baseInput = {
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "W1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 25000,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          dateCreate: "2026-04-02T09:00:00.000Z",
          dateModify: "2026-05-03T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      stageCatalog: [
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:NEW",
          name: "База входящая",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 20
        }
      ],
      stageHistory: [
        {
          id: "W1-H1",
          ownerId: "W1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T09:00:00.000Z"
        },
        {
          id: "W1-H2",
          ownerId: "W1",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-29T15:00:00.000Z"
        }
      ]
    };

    const aprilReport = buildSourceQualityConversionReport({
      ...baseInput,
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      }
    });
    const mayReport = buildSourceQualityConversionReport({
      ...baseInput,
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      }
    });

    expect(aprilReport.totalWonDeals).toBe(1);
    expect(aprilReport.rows[0]?.wonDeals).toBe(1);
    expect(mayReport.totalWonDeals).toBe(0);
  });
});
