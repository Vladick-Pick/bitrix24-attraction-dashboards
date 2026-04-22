import { describe, expect, it } from "vitest";

import { buildCallsWorkloadReport } from "../src/domain/operational-reports";

describe("buildCallsWorkloadReport", () => {
  it("aggregates call direction and connection semantics by manager and stage through activity linkage", () => {
    const result = buildCallsWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
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
          categoryId: "20",
          stageId: "C20:NEW",
          stageSemanticId: "P",
          opportunity: 1000,
          assignedById: "4",
          sourceId: "AD",
          qualityValue: null,
          dateCreate: "2026-04-07T09:00:00.000Z",
          dateModify: "2026-04-07T09:00:00.000Z",
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
        }
      ],
      stageHistory: [
        {
          id: "T1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "T2",
          ownerId: "2",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-07T12:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "CA1",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "7",
          createdTime: "2026-04-03T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-03T12:10:00.000Z",
          completed: true,
          completedTime: "2026-04-03T12:10:00.000Z"
        },
        {
          id: "CA2",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "9",
          createdTime: "2026-04-07T14:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T14:02:00.000Z",
          completed: true,
          completedTime: "2026-04-07T14:02:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL1",
          crmActivityId: "CA1",
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-04-03T12:00:00.000Z",
          callDurationSeconds: 120,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: null
        },
        {
          id: "CALL2",
          crmActivityId: "CA2",
          portalUserId: "9",
          callType: "2",
          callStartDate: "2026-04-07T14:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "CALL3",
          crmActivityId: "CA2",
          portalUserId: "9",
          callType: "2",
          callStartDate: "2026-04-07T14:05:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "486"
        },
        {
          id: "CALL4",
          crmActivityId: null,
          portalUserId: "12",
          callType: "1",
          callStartDate: "2026-04-07T14:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: null
        },
        {
          id: "CALL5",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-04-04T10:00:00.000Z",
          callDurationSeconds: 20,
          crmEntityType: "DEAL",
          crmEntityId: "1",
          callFailedCode: null
        }
      ],
      managerDirectory: [
        { id: "7", name: "Анна Куратор" },
        { id: "9", name: "Илья Менеджер" },
        { id: "99", name: "Ольга Без звонков" }
      ]
    });

    expect(result).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCalls: 5,
      totalIncomingCalls: 2,
      totalOutgoingCalls: 3,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 3,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 2,
      totalConnectedCallsOverThirtySeconds: 1,
      warnings: [],
      managerRows: [
        {
          managerId: "12",
          managerName: "12",
          dealCount: 0,
          totalCalls: 1,
          incomingCalls: 0,
          outgoingCalls: 1,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 1,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 0,
          averageDurationSeconds: 0,
          stageBreakdown: []
        },
        {
          managerId: "7",
          managerName: "Анна Куратор",
          dealCount: 1,
          totalCalls: 2,
          incomingCalls: 0,
          outgoingCalls: 2,
          otherOutgoingCalls: 1,
          connectedCalls: 2,
          failedCalls: 0,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 1,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 70,
          stageBreakdown: [
            {
              stageId: "C10:UC_9E0XYG",
              stageName: "Встреча-знакомство",
              dealCount: 1,
              totalCalls: 2,
              incomingCalls: 0,
              outgoingCalls: 2,
              otherOutgoingCalls: 1,
              connectedCalls: 2,
              failedCalls: 0,
              callsOverThirtySeconds: 1,
              connectedCallsOverThirtySeconds: 1,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 70
            }
          ]
        },
        {
          managerId: "9",
          managerName: "Илья Менеджер",
          dealCount: 1,
          totalCalls: 2,
          incomingCalls: 2,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 1,
          failedCalls: 0,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 30,
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              totalCalls: 2,
              incomingCalls: 2,
              outgoingCalls: 0,
              otherOutgoingCalls: 0,
              connectedCalls: 1,
              failedCalls: 0,
              callsOverThirtySeconds: 1,
              connectedCallsOverThirtySeconds: 0,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 30
            }
          ]
        },
        {
          managerId: "99",
          managerName: "Ольга Без звонков",
          dealCount: 0,
          totalCalls: 0,
          incomingCalls: 0,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 0,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 0,
          averageDurationSeconds: 0,
          stageBreakdown: []
        }
      ]
    });
  });
});
