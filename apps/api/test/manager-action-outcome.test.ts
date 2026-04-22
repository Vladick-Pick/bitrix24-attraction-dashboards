import { describe, expect, it } from "vitest";

import { buildManagerActionOutcomeReport } from "../src/domain/operational-reports";

describe("buildManagerActionOutcomeReport", () => {
  it("combines actions, meetings, SLA and results per manager", () => {
    const report = buildManagerActionOutcomeReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "D1",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 120000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-04T10:00:00.000Z",
          dateClosed: "2026-04-04T10:00:00.000Z",
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
          statusId: "C10:WON",
          name: "Выиграно",
          semanticId: "S",
          sortOrder: 100
        }
      ],
      stageHistory: [
        {
          id: "H1",
          ownerId: "D1",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T10:00:00.000Z"
        },
        {
          id: "H2",
          ownerId: "D1",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T12:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "A1",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-01T10:30:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-01T11:00:00.000Z",
          completed: true,
          completedTime: "2026-04-01T11:00:00.000Z"
        },
        {
          id: "A2",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-04-01T13:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-01T14:00:00.000Z",
          completed: true,
          completedTime: "2026-04-01T14:00:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL1",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-01T12:30:00.000Z",
          callDurationSeconds: 80,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        },
        {
          id: "CALL2",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-01T13:30:00.000Z",
          callDurationSeconds: 90,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [
        { id: "78", name: "Егоров Андрей" }
      ]
    });

    expect(report.rows).toEqual([
      {
        managerId: "78",
        managerName: "Егоров Андрей",
        createdTasks: 1,
        closedTasks: 1,
        totalCalls: 2,
        successfulCallsOverThirtySeconds: 2,
        meetingsCount: 1,
        sla1OnTimeCount: 1,
        sla1LateCount: 0,
        sla1NoTouchCount: 0,
        sla1MedianHours: 2,
        sla2OnTimeCount: 1,
        sla2LateCount: 0,
        sla2NoTouchCount: 0,
        sla2MedianHours: 2.5,
        sla3OnTimeCount: 1,
        sla3LateCount: 0,
        sla3NoTouchCount: 0,
        sla3MedianHours: 1.5,
        newDealsCount: 1,
        wonDealsCount: 1,
        winRate: 1,
        salesAmount: 120000,
        averageSaleAmount: 120000,
        averageCycleDays: 3
      }
    ]);
  });
});
