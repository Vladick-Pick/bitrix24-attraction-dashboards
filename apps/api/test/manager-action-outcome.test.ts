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

  it("builds cohort status rows with per-deal action averages and WIP", () => {
    const stageCatalog = [
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
        statusId: "C10:PREPARATION",
        name: "Звонок-знакомство",
        semanticId: "P",
        sortOrder: 20
      },
      {
        entityType: "deal" as const,
        categoryId: "10",
        statusId: "C10:WON",
        name: "Передано в клуб",
        semanticId: "S",
        sortOrder: 100
      },
      {
        entityType: "deal" as const,
        categoryId: "10",
        statusId: "C10:LOSE",
        name: "Корзина",
        semanticId: "F",
        sortOrder: 110
      }
    ];
    const baseDeal = {
      title: null,
      leadId: null,
      categoryId: "10",
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
      dateClosed: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null
    };
    const report = buildManagerActionOutcomeReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          ...baseDeal,
          id: "D1",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 120000,
          dateClosed: "2026-04-04T10:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D2",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 50000,
          dateClosed: "2026-04-05T10:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D3",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 70000
        }
      ],
      stageCatalog,
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
          createdTime: "2026-04-01T11:00:00.000Z"
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
          ownerId: "D2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-02T10:30:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-02T11:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "A3",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-04-02T13:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-02T14:00:00.000Z",
          completed: true,
          completedTime: "2026-04-02T14:00:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL1",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-01T11:30:00.000Z",
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
          callStartDate: "2026-04-01T12:30:00.000Z",
          callDurationSeconds: 90,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        },
        {
          id: "CALL3",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-02T12:30:00.000Z",
          callDurationSeconds: 12,
          crmEntityType: "DEAL",
          crmEntityId: "D2",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }]
    });

    expect(report.cohortMonths).toEqual([
      {
        cohortMonth: "2026-04",
        cohortLabel: "2026-04",
        totalCreatedDeals: 3
      }
    ]);
    expect(report.cohortStatusRows.filter((row) => row.cohortMonth === null)).toEqual([
      expect.objectContaining({
        managerId: "78",
        managerName: "Егоров Андрей",
        statusKey: "won",
        statusLabel: "Выиграно",
        cohortCreatedDeals: 3,
        dealCount: 1,
        statusShare: 0.3333,
        createdTasksPerDeal: 1,
        closedTasksPerDeal: 1,
        totalCallsPerDeal: 2,
        successfulCallsOverThirtySecondsPerDeal: 2,
        meetingsPerDeal: 1,
        sla1OnTimeRate: 1,
        sla2OnTimeRate: 1,
        sla3OnTimeRate: 1,
        financialAmount: 120000,
        averageFinancialAmount: 120000
      }),
      expect.objectContaining({
        statusKey: "lost",
        statusLabel: "Проиграно",
        dealCount: 1,
        createdTasksPerDeal: 1,
        totalCallsPerDeal: 1,
        successfulCallsOverThirtySecondsPerDeal: 0,
        financialAmount: 50000
      }),
      expect.objectContaining({
        statusKey: "wip",
        statusLabel: "В работе сейчас",
        dealCount: 1,
        financialAmount: 70000
      })
    ]);
    const wonRow = report.cohortStatusRows.find(
      (row) => row.cohortMonth === null && row.statusKey === "won"
    );
    expect(wonRow?.dealDetails[0]).toEqual(
      expect.objectContaining({
        dealId: "D1",
        stageId: "C10:WON",
        stageName: "Передано в клуб",
        amount: 120000,
        taskSummary: { created: 1, closed: 1 },
        callSummary: expect.objectContaining({
          total: 2,
          connectedOverThirtySeconds: 2
        }),
        meetingSummary: { total: 1 },
        sla: expect.objectContaining({
          sla1: expect.objectContaining({ status: "onTime" }),
          sla2: expect.objectContaining({ status: "onTime" }),
          sla3: expect.objectContaining({ status: "onTime" })
        })
      })
    );
  });

  it("uses deal meeting date as a meeting fallback when no meeting activity exists", () => {
    const report = buildManagerActionOutcomeReport({
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "146166",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 1300000,
          assignedById: "6994",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-03-13T13:00:00+03:00",
          tariffValue: "Федеральный Москва",
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-03-06T13:44:57+03:00",
          dateModify: "2026-03-30T14:54:37+03:00",
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
          statusId: "C10:WON",
          name: "Передано в клуб",
          semanticId: "S",
          sortOrder: 100
        },
        {
          entityType: "source",
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 30
        }
      ],
      stageHistory: [],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "6994", name: "Кузнецова Анастасия" }]
    });

    const detail = report.cohortStatusRows[0]?.dealDetails[0];

    expect(detail).toEqual(
      expect.objectContaining({
        dealId: "146166",
        sourceLabel: "Лидген УС",
        meetingDateValue: "2026-03-13T13:00:00+03:00",
        meetingSummary: { total: 1 }
      })
    );
    expect(detail?.stageTimeline[0]?.meetingEvents).toEqual([
      expect.objectContaining({
        activityId: "deal-field:146166:meeting-date",
        timelineAt: "2026-03-13T13:00:00+03:00"
      })
    ]);
  });

  it("counts only CRM_TODO and CRM_TASKS_TASK as tasks", () => {
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
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
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
        }
      ],
      stageHistory: [],
      activities: [
        {
          id: "A_IMOL",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "6",
          providerId: "IMOPENLINES_SESSION",
          responsibleId: "78",
          createdTime: "2026-04-02T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-02T10:30:00.000Z",
          completed: true,
          completedTime: "2026-04-02T10:30:00.000Z"
        },
        {
          id: "A_TODO",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-03T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-03T10:30:00.000Z",
          completed: true,
          completedTime: "2026-04-03T10:30:00.000Z"
        },
        {
          id: "A_TASK",
          ownerTypeId: "2",
          ownerId: "D1",
          typeId: "6",
          providerId: "CRM_TASKS_TASK",
          responsibleId: "78",
          createdTime: "2026-04-04T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-04T10:30:00.000Z",
          completed: true,
          completedTime: "2026-04-04T10:30:00.000Z"
        }
      ],
      calls: [],
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }]
    });

    expect(report.rows).toEqual([
      expect.objectContaining({
        managerId: "78",
        createdTasks: 2,
        closedTasks: 2
      })
    ]);
    expect(report.cohortStatusRows[0]?.dealDetails[0]?.taskSummary).toEqual({
      created: 2,
      closed: 2
    });
  });
  it("includes no-touch deals in the SLA on-time denominator", () => {
    const report = buildManagerActionOutcomeReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      wonStageIds: ["C10:WON"],
      deals: [
        {
          id: "D-ON-TIME",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-01T11:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "D-NO-TOUCH",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 12000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-02T10:00:00.000Z",
          dateModify: "2026-04-02T10:00:00.000Z",
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
        }
      ],
      stageHistory: [
        {
          id: "D-ON-TIME-H1",
          ownerId: "D-ON-TIME",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T10:00:00.000Z"
        },
        {
          id: "D-ON-TIME-H2",
          ownerId: "D-ON-TIME",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T11:00:00.000Z"
        },
        {
          id: "D-NO-TOUCH-H1",
          ownerId: "D-NO-TOUCH",
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        }
      ],
      activities: [],
      calls: [],
      managerDirectory: [{ id: "78", name: "Егоров Андрей" }]
    });

    const wipRow = report.cohortStatusRows.find(
      (row) => row.cohortMonth === null && row.managerId === "78" && row.statusKey === "wip"
    );

    expect(wipRow?.dealCount).toBe(2);
    expect(wipRow?.sla1OnTimeRate).toBe(0.5);
  });
});
