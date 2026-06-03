import { describe, expect, it } from "vitest";

import { createReportingService } from "../src/server/service";

describe("createReportingService", () => {
  it("prorates monthly sales plan rows by calendar days for effective report ranges", async () => {
    const repository = {
      getSalesPlanRows: async (periodStart: string, periodEnd: string) => {
        if (
          periodStart === "2026-04-01T00:00:00.000+03:00" &&
          periodEnd === "2026-04-30T23:59:59.999+03:00"
        ) {
          return [
            {
              periodStart,
              periodEnd,
              managerId: "78",
              managerName: "Егоров Андрей",
              targetGroupKey: "ClubFirst Russia",
              targetGroupLabel: "ClubFirst Russia",
              plannedDeals: 5,
              plannedAmount: 5000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            }
          ];
        }

        return [];
      }
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

    await expect(
      service.getEffectiveSalesPlan({
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-07T23:59:59.999+03:00"
      })
    ).resolves.toMatchObject({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-07T23:59:59.999+03:00",
      rows: [
        {
          managerId: "78",
          targetGroupKey: "ClubFirst Russia",
          plannedDeals: 2,
          plannedAmount: 1166667
        }
      ],
      updatedAt: "2026-04-10T12:00:00.000Z"
    });
  });

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
        },
        {
          id: "A_CONTACT_WITH_DEAL_ID",
          ownerTypeId: "3",
          ownerId: "1",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-07T13:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T13:00:00.000Z",
          completed: true,
          completedTime: "2026-04-07T13:10:00.000Z"
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
        },
        {
          id: "CALL_NUMERIC_DEAL_ENTITY",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-08T10:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "2",
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

    const [activities, calls, actionOutcomes, revenueVelocity] = await Promise.all([
      service.getActivitiesWorkloadReport({ range }),
      service.getCallsWorkloadReport({ range }),
      service.getManagerActionOutcomeReport({ range }),
      service.getRevenueVelocityReport({ range, dimension: "manager" })
    ]);
    const reportManagerIds = new Set([
      ...activities.managerRows.map((row) => row.managerId),
      ...calls.managerRows.map((row) => row.managerId),
      ...actionOutcomes.rows.map((row) => row.managerId),
      ...revenueVelocity.rows.map((row) => row.managerId)
    ]);

    expect(reportManagerIds).not.toContain("999");
    expect(activities.totalDealCount).toBe(1);
    expect(revenueVelocity.totals.createdDeals).toBe(1);
    expect(revenueVelocity.totals.actions.totalCalls).toBe(3);
    expect(revenueVelocity.totals.actions.closedTasks).toBe(2);
    expect(actionOutcomes.rows.find((row) => row.managerId === "78")?.createdTasks).toBe(1);
    expect(
      actionOutcomes.cohortStatusRows
        .find((row) => row.managerId === "78" && row.statusKey === "wip")
        ?.dealDetails[0]?.taskSummary
    ).toEqual({
      created: 2,
      closed: 2
    });
    expect(
      actionOutcomes.cohortStatusRows
        .find((row) => row.managerId === "78" && row.statusKey === "wip")
        ?.dealDetails[0]?.callSummary
    ).toEqual(
      expect.objectContaining({
        total: 2,
        connectedOverThirtySeconds: 2
      })
    );
    expect(
      actionOutcomes.cohortStatusRows
        .find((row) => row.managerId === "78" && row.statusKey === "wip")
        ?.dealDetails[0]?.sourceLabel
    ).toBe("Website");
  });

  it("counts manager phone calls even when Bitrix attaches the activity to another funnel", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "ATTRACTION_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "2236",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-24T17:51:42.000Z",
          dateModify: "2026-04-24T17:51:42.000Z",
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
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 10
        }
      ],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [
        {
          id: "A_LEADGEN_CALL",
          ownerTypeId: "2",
          ownerId: "LEADGEN_DEAL",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "2236",
          createdTime: "2026-04-27T19:22:33.000Z",
          deadline: null,
          lastUpdated: "2026-04-27T19:22:33.000Z",
          completed: true,
          completedTime: "2026-04-27T19:22:33.000Z"
        }
      ],
      getAllActivityBindings: async () => [
        {
          activityId: "A_LEADGEN_CALL",
          ownerTypeId: "2",
          ownerId: "LEADGEN_DEAL"
        },
        {
          activityId: "A_LEADGEN_CALL",
          ownerTypeId: "2",
          ownerId: "ATTRACTION_DEAL"
        }
      ],
      getAllCalls: async () => [
        {
          id: "CALL_BOUND_TO_ATTRACTION",
          crmActivityId: "A_LEADGEN_CALL",
          portalUserId: "2236",
          callType: "1",
          callStartDate: "2026-04-27T19:22:33.000Z",
          callDurationSeconds: 240,
          crmEntityType: "CONTACT",
          crmEntityId: "37454",
          callFailedCode: "200"
        },
        {
          id: "CALL_MANAGER_CONTACT_ONLY",
          crmActivityId: null,
          portalUserId: "2236",
          callType: "2",
          callStartDate: "2026-04-28T10:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "37454",
          callFailedCode: "200"
        },
        {
          id: "CALL_OUTSIDER",
          crmActivityId: null,
          portalUserId: "999",
          callType: "1",
          callStartDate: "2026-04-28T11:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "CONTACT",
          crmEntityId: "1",
          callFailedCode: "200"
        }
      ],
      getManagerDirectory: async () => [
        { id: "2236", name: "Потапова Мария" },
        { id: "999", name: "Лишний Менеджер" }
      ],
      upsertManagerDirectory: async () => 1
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-30T12:00:00.000Z")
    });

    const report = await service.getCallsWorkloadReport({
      range: {
        from: "2026-04-27T00:00:00.000Z",
        to: "2026-05-01T23:59:59.999Z"
      }
    });
    const potapova = report.managerRows.find((row) => row.managerId === "2236");

    expect(report.allCalls.totalCalls).toBe(2);
    expect(report.linkedDealCalls.totalCalls).toBe(1);
    expect(potapova?.allCalls.totalCalls).toBe(2);
    expect(potapova?.linkedDealCalls).toMatchObject({
      dealCount: 1,
      totalCalls: 1
    });
    expect(report.managerRows.map((row) => row.managerId)).not.toContain("999");
  });

  it("warns when manager action outcome historical activity coverage is missing", async () => {
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
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
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
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [{ id: "78", name: "Андрей Егоров" }],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined,
      hasSyncCoverage: async () => false,
      getDealMeetingDateFieldBootstrappedAt: async () =>
        "2026-04-01T00:00:00.000Z",
      getCallActivityIdsMissingCallStats: async () => []
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

    const report = await service.getManagerActionOutcomeReport({});

    expect(report.warnings).toContain(
      "Данные по делам/звонкам неполные: требуется историческая синхронизация за выбранный период."
    );
  });

  it("does not warn when manager action outcome coverage is confirmed without legacy bootstrap flags", async () => {
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
          businessClubValue: null,
          targetGroupValue: null,
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
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
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [{ id: "78", name: "Андрей Егоров" }],
      upsertManagerDirectory: async () => 1,
      getLastSyncSummary: async () => null,
      setWonStageIds: async () => undefined,
      hasSyncCoverage: async () => true,
      getDealMeetingDateFieldBootstrappedAt: async () => null,
      getDealIdsByCategoryIds: async () => ["1"],
      getCallActivityIdsMissingCallStats: async () => []
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T12:00:00.000Z")
    });

    const report = await service.getManagerActionOutcomeReport({});

    expect(report.warnings).not.toContain(
      "Данные по делам/звонкам неполные: требуется историческая синхронизация за выбранный период."
    );
  });

  it("warns in conversion events report when smart-process snapshot coverage is missing", async () => {
    const coverageStreams: string[] = [];
    const repository = {
      getAllDeals: async () => [],
      getStageCatalog: async () => [],
      getAllStageHistory: async () => [],
      getAllConversionEventVisits: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 0,
      hasSyncCoverage: async (input: { stream: string }) => {
        coverageStreams.push(input.stream);
        return false;
      }
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-30T12:00:00.000Z")
    });

    const report = await service.getConversionEventsReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      }
    });

    expect(coverageStreams).toContain("conversion_event_visits");
    expect(report.rows).toEqual([]);
    expect(report.warnings.join(" ")).toContain(
      "snapshot конверсионных мероприятий не загружен"
    );
  });

  it("exposes blocking sync health from meta and recovers stale running sync runs", async () => {
    let recoveredBefore: string | null = null;
    const repository = {
      getAllDeals: async () => [],
      getStageCatalog: async () => [],
      getWonStageIds: async () => ["C10:WON"],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 0,
      getLastSyncSummary: async () => ({
        finishedAt: "2026-04-19T00:00:00.000Z",
        leadsSynced: 0,
        dealsSynced: 0,
        mode: "delta" as const
      }),
      recoverStaleSyncRuns: async (input: { staleBefore: string }) => {
        recoveredBefore = input.staleBefore;
        return 2;
      },
      hasSyncCoverage: async () => false
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      bootstrapLookbackDays: 365,
      now: () => new Date("2026-04-26T12:00:00.000Z")
    });

    const meta = await service.getMeta();

    expect(recoveredBefore).toBe("2026-04-26T10:00:00.000Z");
    expect(meta.syncHealth).toMatchObject({
      status: "blocked",
      blocking: true,
      lastSuccessfulSync: "2026-04-19T00:00:00.000Z"
    });
    expect(meta.syncHealth.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "STALE_RUNNING_SYNC", severity: "blocking" }),
        expect.objectContaining({ code: "STALE_SUCCESSFUL_SYNC", severity: "blocking" }),
        expect.objectContaining({ code: "MISSING_COVERAGE", severity: "blocking" })
      ])
    );
  });

  it("does not require historical coverage to be rewritten by every delta sync", async () => {
    const requiredSyncedAtValues: Array<string | null | undefined> = [];
    const repository = {
      getAllDeals: async () => [],
      getStageCatalog: async () => [],
      getWonStageIds: async () => ["C10:WON"],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 0,
      getLastSyncSummary: async () => ({
        finishedAt: "2026-04-26T09:00:00.000Z",
        leadsSynced: 0,
        dealsSynced: 2,
        mode: "delta" as const
      }),
      recoverStaleSyncRuns: async () => 0,
      hasSyncCoverage: async (input: { requiredSyncedAt?: string | null }) => {
        requiredSyncedAtValues.push(input.requiredSyncedAt);
        return true;
      }
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      bootstrapLookbackDays: 365,
      now: () => new Date("2026-04-26T12:00:00.000Z")
    });

    const meta = await service.getMeta();

    expect(requiredSyncedAtValues.every((value) => value == null)).toBe(true);
    expect(meta.syncHealth.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_COVERAGE" })
      ])
    );
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
      "7814",
      "72",
      "2236",
      "2764",
      "13020"
    ]);
    expect(meta.managerCatalog.map((manager) => manager.name)).not.toContain(
      "Лишний Менеджер"
    );
    expect(dashboard.salesSummary.newDealsCount).toBe(1);
    expect(calls.managerRows.map((row) => row.managerId)).not.toContain("999");
    expect(calls.totalCalls).toBe(1);
    expect(calls.linkedDealCalls.totalCalls).toBe(0);
  });

  it("uses saved manager whitelist settings as the attraction reporting scope", async () => {
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
          opportunity: 20000,
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
      getAllCalls: async () => [],
      getManagerDirectory: async () => [
        { id: "78", name: "Егоров Андрей" },
        { id: "999", name: "Новый Менеджер" }
      ],
      getManagerWhitelistSettings: async () => [
        {
          moduleKey: "attraction",
          managerId: "999",
          managerName: "Новый Менеджер",
          enabled: true,
          sortOrder: 0,
          updatedAt: "2026-06-01T10:00:00.000Z"
        }
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

    const [meta, dashboard] = await Promise.all([
      service.getMeta(),
      service.getDashboard({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        }
      })
    ]);

    expect(meta.managerCatalog.map((manager) => manager.id)).toEqual(["999"]);
    expect(dashboard.salesSummary.newDealsCount).toBe(1);
    expect(dashboard.managerGroups.map((group) => group.managerId)).not.toContain("78");
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
      "7814",
      "72",
      "2236",
      "2764",
      "13020"
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
          conversionEventRows: [],
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
                  businessClubLabel: "Без бизнес-клуба заказчика",
                  dealCount: 1
                }
              ],
              meetingBusinessClubBreakdown: [],
              slaMetrics: [],
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

  it("scopes activity conversion events by deal manager instead of visit owner", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_61CBCU",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
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
          statusId: "C10:UC_61CBCU",
          name: "Активация (Встреча проведена)",
          semanticId: "P",
          sortOrder: 50
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
      getAllCalls: async () => [],
      getAllEventVisitFacts: async () => [
        {
          visitId: "457300",
          eventId: "31148",
          dealId: "1",
          contactId: null,
          leadId: null,
          managerId: "1",
          sourceId: "WEB",
          currentStageId: "C10:UC_61CBCU",
          currentStageName: "Активация (Встреча проведена)",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: "2026-05-28T12:00:00.000Z",
          finalStatus: "refused",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C10:UC_61CBCU",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн"
          })
        }
      ],
      getAllDealTouchpointFacts: async () => [
        {
          factId: "TP1",
          kind: "conversion_event_visit",
          sourceSystem: "bitrix24",
          sourceEntityType: "event_visit_fact",
          sourceEntityId: "457300",
          occurredAt: "2026-05-28T00:00:00.000Z",
          dealId: "1",
          contactId: null,
          leadId: null,
          managerId: "1",
          sourceId: "WEB",
          stageIdAtEvent: "C10:UC_61CBCU",
          stageNameAtEvent: "Активация (Встреча проведена)",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: null
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
      now: () => new Date("2026-05-31T12:00:00.000Z")
    });

    const report = await service.getActivitiesWorkloadReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z"
      },
      filters: {
        managerIds: ["78"]
      }
    });

    expect(report.conversionEventRows).toEqual([
      {
        eventKey: "31148",
        eventName: "Бизнес-диалог: Виктор Найшуллер, 28.05",
        eventDate: "2026-05-28T00:00:00.000Z",
        invitedCount: 1,
        attendedCount: 0,
        refusedCount: 1,
        waitingCount: 0,
        stageBreakdown: [
          {
            stageId: "C10:UC_61CBCU",
            stageName: "Активация",
            invitedCount: 1
          }
        ]
      }
    ]);
  });

  it("scopes unit economics event costs by deal manager instead of visit owner", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "1",
          title: null,
          contactId: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:UC_61CBCU",
          stageSemanticId: "P",
          opportunity: 1_100_000,
          assignedById: "78",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          businessClubValue: "ClubFirst One",
          targetGroupValue: "ClubFirst Russia",
          meetingTypeValue: null,
          meetingDateValue: null,
          tariffValue: "Федеральный",
          conversionEventValue: null,
          refusalReasonValue: null,
          refusalReasonDetail: null,
          dateCreate: "2026-05-20T09:00:00.000Z",
          dateModify: "2026-05-28T10:00:00.000Z",
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
          statusId: "C10:UC_61CBCU",
          name: "Активация (Встреча проведена)",
          semanticId: "P",
          sortOrder: 50
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [],
      getAllEventVisitFacts: async () => [
        {
          visitId: "457300",
          eventId: "31148",
          dealId: "1",
          contactId: null,
          leadId: null,
          managerId: "1",
          sourceId: "8",
          currentStageId: "C10:UC_61CBCU",
          currentStageName: "Активация (Встреча проведена)",
          invitedAt: "2026-05-28T10:00:00.000Z",
          confirmedAt: null,
          attendedAt: null,
          refusedAt: "2026-05-28T12:00:00.000Z",
          finalStatus: "refused",
          eventDate: "2026-05-28T00:00:00.000Z",
          stageIdAtEvent: "C10:UC_61CBCU",
          linkConfidence: "high",
          linkReason: "event_visit_deal",
          payloadJson: JSON.stringify({
            eventName:
              "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн"
          })
        }
      ],
      getAllEventSnapshots: async () => [
        {
          eventId: "31148",
          entityTypeId: 1036,
          categoryId: null,
          title:
            "МСК Бизнес-диалог: Виктор Найшуллер 28.05.26 Виктор Найшуллер оффлайн",
          eventDate: "2026-05-28T00:00:00.000Z",
          startAt: null,
          endAt: null,
          stageId: "SUCCESS",
          stageName: "Проведено",
          status: "completed",
          eventTypeId: null,
          eventTypeLabel: null,
          formatId: null,
          createdTime: "2026-05-20T00:00:00.000Z",
          updatedTime: "2026-05-28T00:00:00.000Z"
        }
      ],
      getUnitEconomicsCostRules: async () => [
        {
          id: "other-event-participant",
          articleId: "demo_events",
          pnlLevel: "above_ebitda",
          costBehavior: "variable",
          calculationMethod: "amount_per_participant",
          unitPrice: 15_000,
          percent: null,
          amount: null,
          sourceKey: null,
          qualityValue: null,
          eventNamePattern: null,
          enabled: true,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          sortOrder: 10
        }
      ],
      getUnitEconomicsCostFacts: async () => [],
      getPricingRules: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 1
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-31T12:00:00.000Z")
    });

    const report = await service.getUnitEconomicsReport({
      range: {
        from: "2026-05-25T00:00:00.000Z",
        to: "2026-06-01T00:00:00.000Z"
      },
      filters: {
        managerIds: ["78"]
      },
      eventParticipantMode: "invited"
    });

    expect(report.summary.eventCost).toBe(15_000);
    expect(report.managerRows).toEqual([
      expect.objectContaining({
        managerId: "78",
        eventCost: 15_000,
        directCostRows: [
          expect.objectContaining({
            articleId: "demo_events",
            amount: 15_000,
            basis: "Приглашенные участники периода"
          })
        ]
      })
    ]);
  });

  it("keeps source labels available when scoping activities SLA", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "LEADGEN_READY",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 10000,
          assignedById: "78",
          sourceId: "8",
          qualityValue: "3.1 Готов ко встрече с представителем клуба",
          dateCreate: "2026-04-05T10:00:00.000Z",
          dateModify: "2026-04-05T11:00:00.000Z",
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
          name: "Звонок-знакомство",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "8",
          name: "Лидген УС",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getWonStageIds: async () => ["C10:WON"],
      getAllStageHistory: async () => [
        {
          id: "H1",
          ownerId: "LEADGEN_READY",
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-05T11:00:00.000Z"
        }
      ],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllDealMeetingDateChanges: async () => [],
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
      filters: {
        managerIds: ["78"]
      }
    });

    expect(report.managerRows[0]?.slaMetrics).toEqual([
      {
        slaKey: "sla1",
        label: "Время в работу",
        onTimeCount: 1,
        lateCount: 0,
        noTouchCount: 0,
        medianHours: 0
      },
      {
        slaKey: "sla2",
        label: "Первый контакт",
        onTimeCount: 0,
        lateCount: 1,
        noTouchCount: 0,
        medianHours: 0
      },
      {
        slaKey: "sla3",
        label: "Обработка лида",
        onTimeCount: 0,
        lateCount: 1,
        noTouchCount: 0,
        medianHours: 0
      }
    ]);
  });

  it("does not read touchpoint or event facts for stage-only reports", async () => {
    let stageFactReads = 0;
    let touchpointFactReads = 0;
    let eventVisitFactReads = 0;
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
          statusId: "C10:NEW",
          name: "Новая",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:WON",
          name: "Успех",
          semanticId: "S",
          sortOrder: 20
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
      getAllDealStageFacts: async () => {
        stageFactReads += 1;
        return [];
      },
      getAllDealTouchpointFacts: async () => {
        touchpointFactReads += 1;
        return [];
      },
      getAllEventVisitFacts: async () => {
        eventVisitFactReads += 1;
        return [];
      }
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

    await service.getCohortConversionReport({ filters: { managerIds: ["78"] } });
    await service.getTocFlowReport({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: { managerIds: ["78"] }
    });

    expect(stageFactReads).toBe(1);
    expect(touchpointFactReads).toBe(0);
    expect(eventVisitFactReads).toBe(0);
  });

  it("coalesces canonical fact reads across parallel workload reports", async () => {
    let stageFactReads = 0;
    let touchpointFactReads = 0;
    let eventVisitFactReads = 0;
    const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 5));
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
          statusId: "C10:NEW",
          name: "Новая",
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
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 0,
      getAllDealStageFacts: async () => {
        stageFactReads += 1;
        await delay();
        return [];
      },
      getAllDealTouchpointFacts: async () => {
        touchpointFactReads += 1;
        await delay();
        return [];
      },
      getAllEventVisitFacts: async () => {
        eventVisitFactReads += 1;
        await delay();
        return [];
      }
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

    await Promise.all([
      service.getActivitiesWorkloadReport({ range, filters: { managerIds: ["78"] } }),
      service.getCallsWorkloadReport({ range, filters: { managerIds: ["78"] } })
    ]);

    expect(stageFactReads).toBe(1);
    expect(touchpointFactReads).toBe(1);
    expect(eventVisitFactReads).toBe(1);
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

  it("keeps broad manager call snapshots in all-calls while leaving them unlinked to scoped funnel deals", async () => {
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
        linkedDealCalls: expect.objectContaining({
          dealCount: 0,
          totalCalls: 0
        }),
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

  it("builds the leadgen funnel only from category 28 and the leadgen manager whitelist", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "LEADGEN_ALLOWED",
          leadId: null,
          categoryId: "28",
          stageId: "C28:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "501",
          sourceId: "WEB",
          qualityValue: null,
          refusalReasonValue: null,
          dateCreate: "2026-05-02T10:00:00.000Z",
          dateModify: "2026-05-02T10:00:00.000Z",
          dateClosed: null,
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "leadgen-us",
          utmContent: null,
          utmTerm: null
        },
        {
          id: "LEADGEN_OUTSIDE_MANAGER",
          leadId: null,
          categoryId: "28",
          stageId: "C28:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "999",
          sourceId: "WEB",
          qualityValue: null,
          refusalReasonValue: null,
          dateCreate: "2026-05-03T10:00:00.000Z",
          dateModify: "2026-05-03T10:00:00.000Z",
          dateClosed: null,
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "leadgen-us",
          utmContent: null,
          utmTerm: null
        },
        {
          id: "ATTRACTION_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "501",
          sourceId: "WEB",
          qualityValue: null,
          refusalReasonValue: null,
          dateCreate: "2026-05-04T10:00:00.000Z",
          dateModify: "2026-05-04T10:00:00.000Z",
          dateClosed: null,
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "leadgen-us",
          utmContent: null,
          utmTerm: null
        }
      ],
      getStageCatalog: async () => [
        {
          entityType: "deal" as const,
          categoryId: "28",
          statusId: "C28:NEW",
          name: "Новый лид",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getManagerDirectory: async () => [
        {
          id: "501",
          name: "Лидген менеджер"
        }
      ],
      upsertManagerDirectory: async () => 0
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      leadgenCategoryId: "28",
      leadgenManagerIds: ["501"],
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-14T12:00:00.000Z")
    });

    const report = await service.getLeadgenFunnelReport({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      }
    });

    expect(report.totalDeals).toBe(1);
    expect(report.createdDeals).toBe(1);
    expect(report.stageRows).toEqual([
      {
        stageId: "C28:NEW",
        stageName: "Новый лид",
        sortOrder: 10,
        activeDeals: 1,
        createdDeals: 1,
        closedDeals: 0
      }
    ]);
    expect(report.managerRows).toEqual([
      {
        managerId: "501",
        managerName: "Лидген менеджер",
        dealCount: 1
      }
    ]);
    expect(report.sourceRows).toEqual([
      {
        sourceKey: "WEB",
        sourceLabel: "Сайт",
        dealCount: 1
      }
    ]);
  });

  it("builds leadgen workload reports from category 28 and the leadgen manager whitelist", async () => {
    const repository = {
      getAllDeals: async () => [
        {
          id: "LEADGEN_ALLOWED",
          leadId: null,
          categoryId: "28",
          stageId: "C28:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "501",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-05-12T10:00:00.000Z",
          dateModify: "2026-05-12T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "LEADGEN_OUTSIDE_MANAGER",
          leadId: null,
          categoryId: "28",
          stageId: "C28:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "999",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-05-12T10:00:00.000Z",
          dateModify: "2026-05-12T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "LEADGEN_OLD_DEAL_WITH_PERIOD_TASK",
          leadId: null,
          categoryId: "28",
          stageId: "C28:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "501",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-05-01T10:00:00.000Z",
          dateModify: "2026-05-12T10:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "ATTRACTION_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:NEW",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "501",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-05-12T10:00:00.000Z",
          dateModify: "2026-05-12T10:00:00.000Z",
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
          categoryId: "28",
          statusId: "C28:NEW",
          name: "Новый лид",
          semanticId: "P",
          sortOrder: 10
        },
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        }
      ],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [
        {
          id: "A_ALLOWED",
          ownerTypeId: "2",
          ownerId: "LEADGEN_ALLOWED",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "501",
          createdTime: "2026-05-12T11:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-12T11:00:00.000Z",
          completed: true,
          completedTime: "2026-05-12T11:30:00.000Z"
        },
        {
          id: "A_CALL",
          ownerTypeId: "2",
          ownerId: "LEADGEN_ALLOWED",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "501",
          createdTime: "2026-05-12T11:05:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-12T11:05:00.000Z",
          completed: true,
          completedTime: "2026-05-12T11:06:00.000Z"
        },
        {
          id: "A_OUTSIDE_MANAGER",
          ownerTypeId: "2",
          ownerId: "LEADGEN_ALLOWED",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "999",
          createdTime: "2026-05-12T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-12T12:00:00.000Z",
          completed: true,
          completedTime: "2026-05-12T12:30:00.000Z"
        },
        {
          id: "A_OLD_DEAL",
          ownerTypeId: "2",
          ownerId: "LEADGEN_OLD_DEAL_WITH_PERIOD_TASK",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "501",
          createdTime: "2026-05-12T13:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-05-12T13:30:00.000Z",
          completed: true,
          completedTime: "2026-05-12T13:30:00.000Z"
        }
      ],
      getAllActivityDeadlineChanges: async () => [],
      getAllDealMeetingDateChanges: async () => [],
      getAllActivityBindings: async () => [],
      getAllCalls: async () => [
        {
          id: "CALL_ALLOWED",
          crmActivityId: "A_CALL",
          portalUserId: "501",
          callType: "1",
          callStartDate: "2026-05-12T11:05:00.000Z",
          callDurationSeconds: 65,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "CALL_OUTSIDE_MANAGER",
          crmActivityId: "A_ALLOWED",
          portalUserId: "999",
          callType: "1",
          callStartDate: "2026-05-12T11:10:00.000Z",
          callDurationSeconds: 65,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        }
      ],
      getManagerDirectory: async () => [{ id: "501", name: "Лидген менеджер" }],
      upsertManagerDirectory: async () => 0
    };

    const service = createReportingService({
      dealCategoryIds: ["28"],
      leadgenCategoryId: "28",
      leadgenManagerIds: ["501"],
      workloadScope: "leadgen",
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-14T12:00:00.000Z")
    });

    const range = {
      from: "2026-05-11T00:00:00.000Z",
      to: "2026-05-17T23:59:59.999Z"
    };
    const [activities, calls] = await Promise.all([
      service.getActivitiesWorkloadReport({ range }),
      service.getCallsWorkloadReport({ range })
    ]);

    expect(activities.totalDealCount).toBe(1);
    expect(activities.totalCreatedCount).toBe(1);
    expect(activities.totalClosedCount).toBe(1);
    expect(activities.managerRows.map((row) => row.managerId)).toEqual(["501"]);
    expect(calls.totalDealCount).toBe(1);
    expect(calls.totalCalls).toBe(1);
    expect(calls.linkedDealCalls.totalCalls).toBe(1);
    expect(calls.managerRows.map((row) => row.managerId)).toEqual(["501"]);
  });

  it("returns empty leadgen workload reports with a warning when the leadgen whitelist is empty", async () => {
    const repository = {
      getAllDeals: async () => [],
      getStageCatalog: async () => [],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllActivityDeadlineChanges: async () => [],
      getAllDealMeetingDateChanges: async () => [],
      getAllActivityBindings: async () => [],
      getAllCalls: async () => [],
      getManagerDirectory: async () => [],
      upsertManagerDirectory: async () => 0
    };
    const service = createReportingService({
      dealCategoryIds: ["28"],
      leadgenCategoryId: "28",
      leadgenManagerIds: [],
      workloadScope: "leadgen",
      qualityFieldName: "UF_CRM_TEST",
      repository: repository as never,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-14T12:00:00.000Z")
    });

    const range = {
      from: "2026-05-11T00:00:00.000Z",
      to: "2026-05-17T23:59:59.999Z"
    };
    const [activities, calls] = await Promise.all([
      service.getActivitiesWorkloadReport({ range }),
      service.getCallsWorkloadReport({ range })
    ]);

    expect(activities.totalDealCount).toBe(0);
    expect(activities.warnings).toContain("Leadgen manager whitelist is empty.");
    expect(calls.totalDealCount).toBe(0);
    expect(calls.totalCalls).toBe(0);
    expect(calls.warnings).toContain("Leadgen manager whitelist is empty.");
  });

  it("keeps attraction service sync scoped to attraction even when leadgen report config exists", async () => {
    const dealStageCategoryRequests: string[][] = [];
    const dealRequests: Array<{
      categoryIds: string[];
      assignedByIds?: string[];
      customFieldNames?: string[];
    }> = [];
    const storedDeals: Array<Array<{ categoryId: string }>> = [];
    const repository = {
      getLatestSuccessCursor: async () => null,
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-01-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => "2026-01-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: Array<{ categoryId: string }>) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      createSyncRun: async () => 68,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        dealStageCategoryRequests.push(categoryIds);
        return [
          {
            entityType: "deal" as const,
            categoryId: "10",
            statusId: "C10:RETURN",
            name: "Возврат в Лидген(неквал)",
            semanticId: "F",
            sortOrder: 100
          }
        ];
      },
      fetchSourceCatalog: async () => [
        {
          entityType: "source" as const,
          categoryId: null,
          statusId: "WEB",
          name: "Сайт",
          semanticId: null,
          sortOrder: 10
        }
      ],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        assignedByIds?: string[];
        customFieldNames?: string[];
      }) => {
        dealRequests.push({
          categoryIds: cursor.categoryIds,
          ...(cursor.assignedByIds ? { assignedByIds: cursor.assignedByIds } : {}),
          ...(cursor.customFieldNames
            ? { customFieldNames: cursor.customFieldNames }
            : {})
        });

        if (cursor.categoryIds[0] === "28") {
          throw new Error("Attraction service sync must not request leadgen category 28");
        }

        return [
          {
            ID: "A_RETURN",
            LEAD_ID: null,
            DATE_CREATE: "2026-04-09T10:00:00.000Z",
            DATE_MODIFY: "2026-04-09T10:00:00.000Z",
            DATE_CLOSED: "2026-04-09T10:00:00.000Z",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:RETURN",
            STAGE_SEMANTIC_ID: "F",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      leadgenCategoryId: "28",
      leadgenManagerIds: ["501", "502"],
      qualityFieldName: "UF_CRM_1730380390",
      repository: repository as never,
      client: client as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-04-10T00:00:00.000Z")
    });

    await service.performSync();

    expect(dealStageCategoryRequests).toEqual([["10"]]);
    expect(dealRequests).toEqual([
      expect.objectContaining({
        categoryIds: ["10"],
        customFieldNames: [
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890",
          "UF_CRM_1776949411825",
          "UF_CRM_1772109151192"
        ]
      })
    ]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          categoryId: "10"
        })
      ]
    ]);
  });

  it("marks the sync run failed when analytics fact rebuild fails", async () => {
    const finishCalls: unknown[] = [];
    const failCalls: unknown[] = [];
    const repository = {
      getLatestSuccessCursor: async () => "2026-05-01T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-05-01T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getSnapshotStats: async () => ({
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0
      }),
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getOpenDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      createSyncRun: async () => 69,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async (input: unknown) => {
        finishCalls.push(input);
      },
      failSyncRun: async (input: unknown) => {
        failCalls.push(input);
      },
      getAllDeals: async () => [],
      getStageCatalog: async () => [],
      getAllStageHistory: async () => [],
      getAllActivities: async () => [],
      getAllCalls: async () => [],
      getAllConversionEventVisits: async () => [],
      replaceAnalyticsFacts: async () => {
        throw new Error("fact rebuild failed");
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      repository: repository as never,
      client: client as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-25T12:00:00.000Z")
    });

    await expect(service.performSync()).rejects.toThrow("fact rebuild failed");

    expect(finishCalls).toEqual([]);
    expect(failCalls).toEqual([
      expect.objectContaining({
        syncRunId: 69,
        status: "failed",
        diagnostics: ["SYNC_FAILED", "error=Error"]
      })
    ]);
  });
});
