import { describe, expect, it } from "vitest";

import { createReportingService } from "../src/server/service";

describe("createReportingService", () => {
  it("keeps operational report manager rows scoped to the attraction team", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-01T10:00:00.000Z",
          dateClosed: null,
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
          opportunity: 2000,
          assignedById: "999",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-01T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [
        {
          id: "A_ALLOWED",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-07T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T10:00:00.000Z",
          completed: true,
          completedTime: "2026-04-07T10:10:00.000Z"
        },
        {
          id: "A_OUTSIDER_ON_ALLOWED_DEAL",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "999",
          createdTime: "2026-04-07T11:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T11:00:00.000Z",
          completed: true,
          completedTime: "2026-04-07T11:10:00.000Z"
        },
        {
          id: "A_OUTSIDER_DEAL",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "999",
          createdTime: "2026-04-07T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T12:00:00.000Z",
          completed: true,
          completedTime: "2026-04-07T12:10:00.000Z"
        }
      ],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [
        {
          id: "CALL_ALLOWED",
          crmActivityId: "A_ALLOWED",
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-07T10:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "DEAL",
          crmEntityId: "1",
          callFailedCode: "200"
        },
        {
          id: "CALL_OUTSIDER_ON_ALLOWED_DEAL",
          crmActivityId: "A_OUTSIDER_ON_ALLOWED_DEAL",
          portalUserId: "999",
          callType: "1",
          callStartDate: "2026-04-07T11:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "DEAL",
          crmEntityId: "1",
          callFailedCode: "200"
        }
      ],
      getManagerDirectory: async () => [
        { id: "78", name: "Андрей Егоров" },
        { id: "999", name: "Лишний Менеджер" }
      ],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });
    const range = {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    };

    const [activities, calls, actionOutcomes] = await Promise.all([
      service.getActivitiesWorkloadReport({ range }),
      service.getCallsWorkloadReport({ range }),
      service.getManagerActionOutcomeReport({ range })
    ]);
    const reportManagerIds = new Set([
      ...activities.managerRows.map((row) => row.managerId),
      ...calls.managerRows.map((row) => row.managerId),
      ...actionOutcomes.rows.map((row) => row.managerId)
    ]);

    expect(reportManagerIds).not.toContain("999");
    expect(activities.totalDealCount).toBe(1);
    expect(actionOutcomes.rows.find((row) => row.managerId === "78")?.createdTasks).toBe(1);
  });

  it("pre-filters manager catalogs and default report scope to the attraction team", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-01T10:00:00.000Z",
          dateClosed: null,
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
          opportunity: 2000,
          assignedById: "999",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-01T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [
        {
          id: "CALL_ALLOWED",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-07T10:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "CONTACT",
          crmEntityId: "100",
          callFailedCode: "200"
        },
        {
          id: "CALL_OUTSIDER",
          crmActivityId: null,
          portalUserId: "999",
          callType: "1",
          callStartDate: "2026-04-07T11:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "CONTACT",
          crmEntityId: "200",
          callFailedCode: "200"
        }
      ],
      getManagerDirectory: async () => [
        { id: "78", name: "Андрей Егоров" },
        { id: "999", name: "Лишний Менеджер" }
      ],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const [meta, dashboard, calls] = await Promise.all([
      service.getMeta(),
      service.getDashboard({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        }
      }),
      service.getCallsWorkloadReport({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        }
      })
    ]);

    expect(meta.managerCatalog.map((manager) => manager.id)).toEqual([
      "78",
      "11234",
      "7824",
      "6994",
      "72",
      "2236",
      "2764"
    ]);
    expect(meta.managerCatalog.map((manager) => manager.name)).not.toContain(
      "Лишний Менеджер"
    );
    expect(dashboard.salesSummary.newDealsCount).toBe(1);
    expect(calls.managerRows.map((row) => row.managerId)).not.toContain("999");
    expect(calls.totalCalls).toBe(1);
  });

  it("applies shared manager and source filters and exposes filter catalogs", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-01T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
          dateClosed: "2026-04-05T10:00:00.000Z",
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
          opportunity: 2000,
          assignedById: "11234",
          sourceId: "REFERRAL",
          qualityValue: null,
          dateCreate: "2026-04-02T10:00:00.000Z",
          dateModify: "2026-04-03T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 20
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "REFERRAL",
          name: "Referral",
          semanticId: null,
          sortOrder: 20
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [{ id: "999", name: "Лишний Менеджер" }],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const dashboard = await service.getDashboard({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["78"],
        sourceKeys: ["WEB"]
      }
    });

    const meta = await service.getMeta();

    expect(dashboard.salesSummary.salesCount).toBe(1);
    expect(dashboard.salesSummary.newDealsCount).toBe(1);
    expect(meta.managerCatalog.map((manager) => manager.id)).toEqual([
      "78",
      "11234",
      "7824",
      "6994",
      "72",
      "2236",
      "2764"
    ]);
    expect(meta.sourceCatalog).toEqual([
      { key: "REFERRAL", label: "Referral" },
      { key: "WEB", label: "Website" }
    ]);
  });

  it("returns comparison snapshots for compare ranges with the same filters", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-05T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
          dateClosed: null,
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
          opportunity: 2000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-03-05T10:00:00.000Z",
          dateModify: "2026-03-05T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [
        {
          id: "A1",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-07T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T10:00:00.000Z",
          completed: true,
          completedTime: "2026-04-07T10:10:00.000Z"
        },
        {
          id: "A2",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-03-07T10:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-03-07T10:00:00.000Z",
          completed: true,
          completedTime: "2026-03-07T10:10:00.000Z"
        }
      ],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const report = await service.getActivitiesWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      compareRanges: [
        {
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.999Z"
        }
      ],
      filters: {
        managerIds: ["78"],
        sourceKeys: ["WEB"]
      }
    });

    expect(report.totalCreatedCount).toBe(1);
    expect(report.comparisons).toEqual([
      {
        compareIndex: 1,
        range: {
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.999Z"
        },
        snapshot: {
          range: {
            from: "2026-03-01T00:00:00.000Z",
            to: "2026-03-31T23:59:59.999Z"
          },
          totalDealCount: 1,
          totalCreatedCount: 1,
          totalRescheduledCount: 0,
          totalClosedCount: 1,
          totalMeetingCount: 0,
          warnings: [
            "Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available."
          ],
          managerRows: [
            {
              managerId: "78",
              managerName: "Егоров Андрей",
              dealCount: 1,
              createdCount: 1,
              rescheduledCount: 0,
              closedCount: 1,
              meetingCount: 0,
              averageCreatedPerDeal: 1,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 1,
              averageMeetingsPerDeal: 0,
              meetingTypeBreakdown: [],
              businessClubBreakdown: [
                {
                  businessClubKey: "UNSPECIFIED",
                  businessClubLabel: "Без business club",
                  dealCount: 1
                }
              ],
              slaMetrics: [
                {
                  slaKey: "sla1",
                  label: "Время в работу",
                  onTimeCount: 0,
                  lateCount: 0,
                  noTouchCount: 1,
                  medianHours: 0
                },
                {
                  slaKey: "sla2",
                  label: "Первый контакт",
                  onTimeCount: 0,
                  lateCount: 0,
                  noTouchCount: 1,
                  medianHours: 0
                }
              ],
              stageBreakdown: [
                {
                  stageId: "C10:PREPARATION",
                  stageName: "Preparation",
                  dealCount: 1,
                  createdCount: 1,
                  rescheduledCount: 0,
                  closedCount: 1,
                  averageCreatedPerDeal: 1,
                  averageRescheduledPerDeal: 0,
                  averageClosedPerDeal: 1
                }
              ]
            }
          ]
        }
      }
    ]);
  });

  it("builds the cohort report from the latest twelve calendar months regardless of selected ranges", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-01-10T10:00:00.000Z",
          dateModify: "2026-03-05T10:00:00.000Z",
          dateClosed: null,
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
          opportunity: 2000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-18T10:00:00.000Z",
          dateModify: "2026-04-18T10:00:00.000Z",
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
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 5000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2025-04-30T10:00:00.000Z",
          dateModify: "2025-05-10T10:00:00.000Z",
          dateClosed: "2025-05-10T10:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:WON",
          name: "Won",
          semanticId: "S",
          sortOrder: 20
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [
        {
          id: "H1",
          ownerId: "1",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: 2,
          createdTime: "2026-03-05T10:00:00.000Z"
        }
      ],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-20T12:00:00.000Z")
    });

    const report = await service.getCohortConversionReport({
      range: {
        from: "2026-04-13T00:00:00.000Z",
        to: "2026-04-19T23:59:59.999Z"
      },
      compareRanges: [
        {
          from: "2026-04-06T00:00:00.000Z",
          to: "2026-04-12T23:59:59.999Z"
        }
      ],
      filters: {
        managerIds: ["78"],
        sourceKeys: ["WEB"]
      }
    });

    expect(report.range).toEqual({
      from: "2025-05-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    });
    expect(report.totalCreatedDeals).toBe(2);
    expect(report.totalClosedDeals).toBe(1);
    expect(report.totalWonDeals).toBe(1);
    expect(report.closureMonths).toEqual(["2026-03"]);
    expect(report.rows.map((row) => row.createdMonth)).toEqual([
      "2026-01",
      "2026-04"
    ]);
    expect(report.comparisons).toBeUndefined();
  });

  it("keeps manager call totals from broad call snapshots even when calls are not linked to funnel activities", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-05T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:PREPARATION",
          name: "Preparation",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Website",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [
        {
          id: "CALL1",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-07T10:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "CONTACT",
          crmEntityId: "100",
          callFailedCode: "200"
        },
        {
          id: "CALL2",
          crmActivityId: null,
          portalUserId: "999",
          callType: "1",
          callStartDate: "2026-04-07T11:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "200",
          callFailedCode: "200"
        }
      ],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const report = await service.getCallsWorkloadReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["78"]
      }
    });

    expect(report.managerRows).toEqual([
      expect.objectContaining({
        managerId: "78",
        managerName: "Егоров Андрей",
        dealCount: 0,
        totalCalls: 1,
        outgoingCalls: 1,
        connectedCallsOverThirtySeconds: 1,
        stageBreakdown: []
      })
    ]);
  });

  it("builds attraction acquisition outcomes with shared manager and source filters", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: "Готов ко встрече",
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-04-05T10:00:00.000Z",
          dateModify: "2026-04-05T10:00:00.000Z",
          dateClosed: null,
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
          opportunity: 2000,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: "Готов к коммуникации",
          refusalReasonValue: "Клиенту не интересен формат",
          refusalReasonDetail: null,
          dateCreate: "2026-03-05T10:00:00.000Z",
          dateModify: "2026-04-06T10:00:00.000Z",
          dateClosed: "2026-04-06T10:00:00.000Z",
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
          opportunity: 2000,
          assignedById: "11234",
          sourceId: "REFERRAL",
          qualityValue: null,
          refusalReasonValue: "Выбрал конкурента",
          refusalReasonDetail: null,
          dateCreate: "2026-03-05T10:00:00.000Z",
          dateModify: "2026-04-06T10:00:00.000Z",
          dateClosed: "2026-04-06T10:00:00.000Z",
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
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
          statusId: "C10:LOSE",
          name: "Корзина",
          semanticId: "F",
          sortOrder: 90
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "REFERRAL",
          name: "Партнеры",
          semanticId: null,
          sortOrder: 20
        }
      ],
      getWonStageIds: async () => [],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [{ id: "78", name: "Егоров Андрей" }],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const report = await service.getAcquisitionOutcomesReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["78"],
        sourceKeys: ["WEB"]
      }
    });

    expect(report.totalNewDeals).toBe(1);
    expect(report.totalLostDeals).toBe(1);
    expect(report.newDealsByManager).toHaveLength(1);
    expect(report.lostStages).toEqual([
      {
        stageId: "C10:LOSE",
        stageName: "Корзина",
        count: 1
      }
    ]);
    expect(report.topLossReasons).toEqual([
      expect.objectContaining({
        managerId: "78",
        reasonLabel: "Клиенту не интересен формат",
        count: 1
      })
    ]);
  });
});
