import { describe, expect, it } from "vitest";

import { buildTocFlowReport } from "../src/domain/toc-report";

describe("buildTocFlowReport", () => {
  it("calculates stage entry, forward throughput, queue, buffer and bottleneck from stage history", () => {
    const result = buildTocFlowReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-10T23:59:59.999Z"
      },
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
          dateCreate: "2026-04-01T09:00:00.000Z",
          dateModify: "2026-04-10T09:00:00.000Z",
          dateClosed: "2026-04-10T09:00:00.000Z",
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
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-02T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
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
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          opportunity: 7000,
          assignedById: "9",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-04-03T11:00:00.000Z",
          dateModify: "2026-04-08T11:00:00.000Z",
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
          statusId: "C10:DEMO",
          name: "Демонстрация",
          semanticId: "P",
          sortOrder: 30
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:WON",
          name: "Успешно реализовано",
          semanticId: "S",
          sortOrder: 40
        },
        {
          entityType: "deal",
          categoryId: "10",
          statusId: "C10:LOSE",
          name: "Проиграно",
          semanticId: "F",
          sortOrder: 50
        }
      ],
      stageHistory: [
        {
          id: "H1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T09:00:00.000Z"
        },
        {
          id: "H2",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T09:00:00.000Z"
        },
        {
          id: "H3",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-06T09:00:00.000Z"
        },
        {
          id: "H4",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-10T09:00:00.000Z"
        },
        {
          id: "H5",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        },
        {
          id: "H6",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-05T10:00:00.000Z"
        },
        {
          id: "H7",
          ownerId: "3",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T11:00:00.000Z"
        },
        {
          id: "H8",
          ownerId: "3",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-04T11:00:00.000Z"
        },
        {
          id: "H9",
          ownerId: "3",
          categoryId: "10",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-08T11:00:00.000Z"
        }
      ]
    });

    expect(result).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-10T23:59:59.999Z"
      },
      businessDays: 8,
      warnings: [],
      estimatedGainPerDay: null,
      bottleneck: {
        stageId: "C10:DEMO",
        stageName: "Демонстрация",
        throughputPerDay: 0.13,
        queueEnd: 1,
        queueBufferDays: 8
      },
      rows: [
        {
          stageId: "C10:NEW",
          stageName: "База входящая",
          stageSemanticId: "P",
          sortOrder: 10,
          enteredDeals: 3,
          movedNextDeals: 3,
          throughputPerDay: 0.38,
          queueEnd: 0,
          queueBufferDays: 0,
          averageStageDurationDays: 2
        },
        {
          stageId: "C10:PREPARATION",
          stageName: "Звонок-знакомство",
          stageSemanticId: "P",
          sortOrder: 20,
          enteredDeals: 3,
          movedNextDeals: 2,
          throughputPerDay: 0.25,
          queueEnd: 1,
          queueBufferDays: 4,
          averageStageDurationDays: 3.5
        },
        {
          stageId: "C10:DEMO",
          stageName: "Демонстрация",
          stageSemanticId: "P",
          sortOrder: 30,
          enteredDeals: 2,
          movedNextDeals: 1,
          throughputPerDay: 0.13,
          queueEnd: 1,
          queueBufferDays: 8,
          averageStageDurationDays: 4
        }
      ]
    });
  });
});
