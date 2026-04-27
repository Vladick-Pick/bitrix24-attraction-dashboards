import { describe, expect, it } from "vitest";

import { buildActivitiesWorkloadReport } from "../src/domain/operational-reports";

describe("buildActivitiesWorkloadReport", () => {
  it("aggregates created and closed activities by manager and stage while keeping deadline reschedules disabled", () => {
    const result = buildActivitiesWorkloadReport({
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
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-04-03T15:00:00.000Z",
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
          businessClubValue: "ClubTwo",
          targetGroupValue: "ClubFuture",
          meetingTypeValue: "Онлайн",
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
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
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
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T10:00:00.000Z"
        },
        {
          id: "T2",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "T3",
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
          id: "A1",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-04-02T10:00:00.000Z",
          deadline: "2026-04-03T15:00:00.000Z",
          lastUpdated: "2026-04-02T10:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "A2",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-03T12:00:00.000Z",
          deadline: "2026-04-03T15:00:00.000Z",
          lastUpdated: "2026-04-03T12:00:00.000Z",
          completed: true,
          completedTime: "2026-04-03T12:00:00.000Z"
        },
        {
          id: "A3",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "7",
          createdTime: "2026-04-03T10:00:00.000Z",
          deadline: "2026-04-04T15:00:00.000Z",
          lastUpdated: "2026-04-04T10:00:00.000Z",
          completed: true,
          completedTime: "2026-04-04T10:00:00.000Z"
        },
        {
          id: "A4",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "9",
          createdTime: "2026-04-07T13:00:00.000Z",
          deadline: "2026-04-08T13:00:00.000Z",
          lastUpdated: "2026-04-07T13:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "A5",
          ownerTypeId: "2",
          ownerId: "3",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: null,
          createdTime: "2026-04-07T13:00:00.000Z",
          deadline: "2026-04-08T13:00:00.000Z",
          lastUpdated: "2026-04-07T13:00:00.000Z",
          completed: false,
          completedTime: null
        }
      ],
      deadlineChanges: [
        {
          id: "D1",
          activityId: "A2",
          ownerId: "1",
          responsibleId: "7",
          previousDeadline: "2026-04-04T12:00:00.000Z",
          nextDeadline: "2026-04-04T15:00:00.000Z",
          changedAt: "2026-04-04T09:00:00.000Z"
        }
      ],
      managerDirectory: [
        { id: "7", name: "Анна Куратор" },
        { id: "9", name: "Илья Менеджер" },
        { id: "99", name: "Ольга Без событий" }
      ]
    });

    expect(result).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCreatedCount: 3,
      totalRescheduledCount: 0,
      totalClosedCount: 1,
      totalMeetingCount: 1,
      warnings: [
        "Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available."
      ],
      managerRows: [
        {
          managerId: "7",
          managerName: "Анна Куратор",
          dealCount: 1,
          createdCount: 2,
          rescheduledCount: 0,
          closedCount: 1,
          meetingCount: 1,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1,
          averageMeetingsPerDeal: 1,
          meetingTypeBreakdown: [
            {
              meetingTypeKey: "Очная",
              meetingTypeLabel: "Очная",
              count: 1
            }
          ],
          businessClubBreakdown: [
            {
              businessClubKey: "ClubOne",
              businessClubLabel: "ClubOne",
              dealCount: 1
            }
          ],
          slaMetrics: [
            {
              slaKey: "sla1",
              label: "Время в работу",
              onTimeCount: 1,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 1
            },
            {
              slaKey: "sla2",
              label: "Первый контакт",
              onTimeCount: 1,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 27
            },
            {
              slaKey: "sla3",
              label: "Обработка лида",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 0
            }
          ],
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 0,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0
            },
            {
              stageId: "C10:UC_9E0XYG",
              stageName: "Встреча-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 1,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 1
            }
          ]
        },
        {
          managerId: "9",
          managerName: "Илья Менеджер",
          dealCount: 1,
          createdCount: 1,
          rescheduledCount: 0,
          closedCount: 0,
          meetingCount: 0,
          averageCreatedPerDeal: 1,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 0,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [
            {
              businessClubKey: "ClubTwo",
              businessClubLabel: "ClubTwo",
              dealCount: 1
            }
          ],
          slaMetrics: [
            {
              slaKey: "sla1",
              label: "Время в работу",
              onTimeCount: 0,
              lateCount: 1,
              noTouchCount: 0,
              medianHours: 3
            },
            {
              slaKey: "sla2",
              label: "Первый контакт",
              onTimeCount: 0,
              lateCount: 0,
              noTouchCount: 1,
              medianHours: 0
            },
            {
              slaKey: "sla3",
              label: "Обработка лида",
              onTimeCount: 0,
              lateCount: 0,
              noTouchCount: 1,
              medianHours: 0
            }
          ],
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 0,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0
            }
          ]
        },
        {
          managerId: "99",
          managerName: "Ольга Без событий",
          dealCount: 0,
          createdCount: 0,
          rescheduledCount: 0,
          closedCount: 0,
          meetingCount: 0,
          averageCreatedPerDeal: 0,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 0,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: []
        }
      ]
    });
  });

  it("counts deal meeting-date field values and retained overwrite history", () => {
    const result = buildActivitiesWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      deals: [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "7",
          sourceId: "WEB",
          qualityValue: null,
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: "Zoom",
          meetingDateValue: "2026-05-01T10:00:00.000Z",
          dateCreate: "2026-03-01T09:00:00.000Z",
          dateModify: "2026-04-10T10:00:00.000Z",
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
          name: "Новая",
          semanticId: "P",
          sortOrder: 10
        }
      ],
      stageHistory: [],
      activities: [
        {
          id: "PLANNED_IN_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-05T10:00:00.000Z",
          deadline: "2026-04-20T10:00:00.000Z",
          lastUpdated: "2026-04-05T10:00:00.000Z",
          completed: false,
          completedTime: null
        },
        {
          id: "COMPLETED_WITH_SCHEDULE_AFTER_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-04-06T10:00:00.000Z",
          deadline: "2026-05-01T10:00:00.000Z",
          lastUpdated: "2026-05-01T10:00:00.000Z",
          completed: true,
          completedTime: "2026-05-01T10:00:00.000Z"
        },
        {
          id: "COMPLETED_WITH_SCHEDULE_IN_PERIOD",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "7",
          createdTime: "2026-03-28T10:00:00.000Z",
          deadline: "2026-04-10T10:00:00.000Z",
          lastUpdated: "2026-05-01T11:00:00.000Z",
          completed: true,
          completedTime: "2026-05-01T11:00:00.000Z"
        }
      ],
      deadlineChanges: [],
      meetingDateChanges: [
        {
          id: "1:2026-04-12T10:00:00.000Z:meeting-date",
          dealId: "1",
          assignedById: "7",
          previousMeetingDate: "2026-04-10T10:00:00.000Z",
          nextMeetingDate: "2026-05-01T10:00:00.000Z",
          changedAt: "2026-04-12T10:00:00.000Z"
        }
      ],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const managerRow = result.managerRows.find((row) => row.managerId === "7");

    expect(result.totalMeetingCount).toBe(1);
    expect(managerRow).toMatchObject({
      meetingCount: 1,
      averageMeetingsPerDeal: 1,
      meetingTypeBreakdown: [
        {
          meetingTypeKey: "Zoom",
          meetingTypeLabel: "Zoom",
          count: 1
        }
      ]
    });
  });
});
