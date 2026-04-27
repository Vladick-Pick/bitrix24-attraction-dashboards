import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("createSqliteRepository", () => {
  it("replaces and reads sales plan rows for a period", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([]);

    await repository.replaceSalesPlanRows({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      updatedAt: "2026-04-10T12:00:00.000Z",
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 3,
          plannedAmount: 2500000
        },
        {
          managerId: "81",
          managerName: "Ромашова Ольга",
          targetGroupKey: "ClubFirst Future",
          targetGroupLabel: "ClubFirst Future",
          plannedDeals: 2,
          plannedAmount: 1800000
        }
      ]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 3,
        plannedAmount: 2500000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      },
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "81",
        managerName: "Ромашова Ольга",
        targetGroupKey: "ClubFirst Future",
        targetGroupLabel: "ClubFirst Future",
        plannedDeals: 2,
        plannedAmount: 1800000,
        updatedAt: "2026-04-10T12:00:00.000Z"
      }
    ]);

    await repository.replaceSalesPlanRows({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      updatedAt: "2026-04-11T12:00:00.000Z",
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          plannedDeals: 4,
          plannedAmount: 3000000
        }
      ]
    });

    await expect(
      repository.getSalesPlanRows(
        "2026-04-01T00:00:00.000+03:00",
        "2026-04-30T23:59:59.999+03:00"
      )
    ).resolves.toEqual([
      {
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
        managerId: "78",
        managerName: "Егоров Андрей",
        targetGroupKey: "ClubFirst Russia",
        targetGroupLabel: "ClubFirst Russia",
        plannedDeals: 4,
        plannedAmount: 3000000,
        updatedAt: "2026-04-11T12:00:00.000Z"
      }
    ]);
  });

  it("finds a successful compatible scope when manager coverage expands", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    const oldScopeRunId = await repository.createSyncRun({
      startedAt: "2026-04-26T21:00:00.000Z",
      mode: "delta",
      modifiedAfter: "2026-04-26T20:00:00.000Z",
      scopeKey: "category:10:assigned:78"
    });
    await repository.finishSyncRun({
      syncRunId: oldScopeRunId,
      finishedAt: "2026-04-26T21:00:05.000Z",
      status: "success",
      leadsSynced: 0,
      dealsSynced: 0,
      modifiedAfter: "2026-04-26T20:00:00.000Z"
    });
    const failedExpandedRunId = await repository.createSyncRun({
      startedAt: "2026-04-27T05:00:00.000Z",
      mode: "full",
      modifiedAfter: null,
      scopeKey: "category:10:assigned:78,7814"
    });
    await repository.failSyncRun({
      syncRunId: failedExpandedRunId,
      finishedAt: "2026-04-27T05:15:00.000Z",
      status: "failed"
    });

    await expect(
      repository.getLatestSuccessfulScope(["10"], ["78", "7814"])
    ).resolves.toEqual({
      scopeKey: "category:10:assigned:78",
      categoryIds: ["10"],
      assignedByIds: ["78"]
    });
    await expect(
      repository.getLatestSuccessfulScope(["10"], ["7814"])
    ).resolves.toBe(null);
  });

  it("rolls back snapshot writes when the transaction callback throws", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    expect(() =>
      repository.runSnapshotTransaction(() => {
        void repository.upsertDeals([
          {
            id: "D_ROLLBACK",
            title: null,
            leadId: null,
            categoryId: "1",
            stageId: "C1:NEW",
            stageSemanticId: "P",
            opportunity: null,
            assignedById: null,
            sourceId: "WEB",
            qualityValue: null,
            businessClubValue: null,
            targetGroupValue: null,
            meetingTypeValue: null,
            meetingDateValue: null,
            tariffValue: null,
            refusalReasonValue: null,
            refusalReasonDetail: null,
            dateCreate: "2026-04-01T00:00:00.000Z",
            dateModify: "2026-04-08T00:00:00.000Z",
            dateClosed: null,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            utmContent: null,
            utmTerm: null
          }
        ]);
        void repository.setSyncCursor({
          key: "category:1:deals:date_modify",
          cursorValue: "2026-04-09T00:00:00.000Z",
          updatedAt: "2026-04-09T00:00:00.000Z"
        });

        throw new Error("stage history persistence failed");
      })
    ).toThrow("stage history persistence failed");

    await expect(repository.getAllDeals()).resolves.toEqual([]);
    await expect(
      repository.getSyncCursor("category:1:deals:date_modify")
    ).resolves.toBe(null);
  });

  it("initializes schema, persists won stage settings and tracks the latest sync cursor", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-reporting-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C1:WON"]
    });

    expect(await repository.getWonStageIds()).toEqual(["C1:WON"]);

    await repository.replaceStageCatalog([
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:WON",
        name: "Won",
        semanticId: "S"
      }
    ]);

    await repository.upsertLeads([
      {
        id: "L1",
        statusId: "NEW",
        sourceId: "WEB",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-02T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await repository.upsertDeals([
        {
          id: "D1",
          title: null,
          leadId: "L1",
        categoryId: "1",
        stageId: "C1:WON",
        stageSemanticId: "S",
        opportunity: 1000,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Связаться с Иваном по +7 900 000-00-00",
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    expect(await repository.getAllLeads()).toEqual([
      {
        id: "L1",
        statusId: "NEW",
        sourceId: "WEB",
        opportunity: 1000,
        assignedById: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-02T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    expect(await repository.getAllDeals()).toEqual([
      {
        id: "D1",
        title: null,
        leadId: "L1",
        categoryId: "1",
        stageId: "C1:WON",
        stageSemanticId: "S",
        opportunity: 1000,
        assignedById: null,
        sourceId: "WEB",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubOne",
        targetGroupValue: "ClubFirst",
        meetingTypeValue: "Очная",
        meetingDateValue: "2026-04-03T13:00:00.000Z",
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: null,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateModify: "2026-04-08T00:00:00.000Z",
        dateClosed: "2026-04-08T00:00:00.000Z",
        utmSource: "google",
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);

    await repository.upsertStageHistory([
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:NEW",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-04-01T00:00:00.000Z"
      }
    ]);

    await repository.upsertActivities([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      },
      {
        id: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "7",
        createdTime: "2026-04-08T13:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-04-08T13:01:00.000Z",
        completed: true,
        completedTime: "2026-04-08T13:01:00.000Z"
      }
    ]);

    await repository.upsertActivityDeadlineChanges([
      {
        id: "A1:2026-04-08T12:00:00.000Z",
        activityId: "A1",
        ownerId: "D1",
        responsibleId: "7",
        previousDeadline: "2026-04-09T10:00:00.000Z",
        nextDeadline: "2026-04-10T10:00:00.000Z",
        changedAt: "2026-04-08T12:00:00.000Z"
      }
    ]);

    await repository.upsertCalls([
      {
        id: "CALL1",
        crmActivityId: "A1",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T10:00:00.000Z",
        callDurationSeconds: 64,
        crmEntityType: "DEAL",
        crmEntityId: "D1",
        callFailedCode: null
      },
      {
        id: "CALL2",
        crmActivityId: "A_MISSING",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T11:00:00.000Z",
        callDurationSeconds: 32,
        crmEntityType: "CONTACT",
        crmEntityId: "C1",
        callFailedCode: null
      },
      {
        id: "CALL_ZERO",
        crmActivityId: "0",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T12:00:00.000Z",
        callDurationSeconds: 12,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: null
      }
    ]);

    await repository.upsertManagerDirectory([
      {
        id: "7",
        name: "Анна Куратор"
      }
    ]);

    expect(await repository.getLatestSuccessCursor()).toBe("2026-04-08T00:00:00.000Z");
    expect(await repository.getOperationalHistoryBootstrappedAt()).toBe(null);
    expect(await repository.getDealCustomFieldsBootstrappedAt()).toBe(null);
    expect(await repository.getDealMeetingDateFieldBootstrappedAt()).toBe(null);
    expect((await repository.getStageCatalog())[0]?.name).toBe("Won");
    expect(await repository.getDealIdsByCategoryIds(["1"])).toEqual(["D1"]);
    expect(await repository.getDealIdsByCategoryIds(["1"], ["78"])).toEqual([]);
    expect(await repository.getActivitiesByIds(["A1"])).toEqual([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      }
    ]);
    expect(await repository.getCallActivityIdsMissingActivities()).toEqual([
      "A_MISSING"
    ]);
    expect(
      await repository.getCallActivityIdsMissingCallStats(
        100,
        "2026-04-01T00:00:00.000Z"
      )
    ).toEqual(["A_CALL_NO_STAT"]);
    expect(
      await repository.getCallActivityIdsForCallStatsRefresh(
        100,
        "2026-04-01T00:00:00.000Z"
      )
    ).toEqual(["A_CALL_NO_STAT"]);
    expect(await repository.getAllStageHistory()).toEqual([
      {
        id: "H1",
        ownerId: "D1",
        categoryId: "1",
        stageId: "C1:NEW",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-04-01T00:00:00.000Z"
      }
    ]);
    expect(await repository.getAllActivities()).toEqual([
      {
        id: "A1",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "7",
        createdTime: "2026-04-08T10:00:00.000Z",
        deadline: "2026-04-09T10:00:00.000Z",
        lastUpdated: "2026-04-08T10:00:00.000Z",
        completed: false,
        completedTime: null
      },
      {
        id: "A_CALL_NO_STAT",
        ownerTypeId: "2",
        ownerId: "D1",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "7",
        createdTime: "2026-04-08T13:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-04-08T13:01:00.000Z",
        completed: true,
        completedTime: "2026-04-08T13:01:00.000Z"
      }
    ]);
    expect(await repository.getAllActivityDeadlineChanges()).toEqual([
      {
        id: "A1:2026-04-08T12:00:00.000Z",
        activityId: "A1",
        ownerId: "D1",
        responsibleId: "7",
        previousDeadline: "2026-04-09T10:00:00.000Z",
        nextDeadline: "2026-04-10T10:00:00.000Z",
        changedAt: "2026-04-08T12:00:00.000Z"
      }
    ]);
    expect(await repository.getAllCalls()).toEqual([
      {
        id: "CALL1",
        crmActivityId: "A1",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T10:00:00.000Z",
        callDurationSeconds: 64,
        crmEntityType: "DEAL",
        crmEntityId: "D1",
        callFailedCode: null
      },
      {
        id: "CALL2",
        crmActivityId: "A_MISSING",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T11:00:00.000Z",
        callDurationSeconds: 32,
        crmEntityType: "CONTACT",
        crmEntityId: "C1",
        callFailedCode: null
      },
      {
        id: "CALL_ZERO",
        crmActivityId: "0",
        portalUserId: "7",
        callType: "2",
        callStartDate: "2026-04-08T12:00:00.000Z",
        callDurationSeconds: 12,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: null
      }
    ]);
    await expect(repository.getSnapshotStats()).resolves.toEqual({
      deals: 1,
      activities: 2,
      calls: 3,
      stageHistory: 1
    });
    await expect(
      repository.getSnapshotStats({
        categoryIds: ["1"],
        assignedByIds: ["78"]
      })
    ).resolves.toEqual({
      deals: 0,
      activities: 0,
      calls: 0,
      stageHistory: 0
    });
    expect(await repository.getManagerDirectory()).toEqual([
      {
        id: "7",
        name: "Анна Куратор"
      }
    ]);

    await repository.setWonStageIds(["C1:PAID"]);
    expect(await repository.getWonStageIds()).toEqual(["C1:PAID"]);

    await repository.markOperationalHistoryBootstrapped("2026-04-13T09:00:00.000Z");
    expect(await repository.getOperationalHistoryBootstrappedAt()).toBe(
      "2026-04-13T09:00:00.000Z"
    );
    await repository.markDealCustomFieldsBootstrapped("2026-04-13T10:00:00.000Z");
    expect(await repository.getDealCustomFieldsBootstrappedAt()).toBe(
      "2026-04-13T10:00:00.000Z"
    );
    await repository.markDealMeetingDateFieldBootstrapped("2026-04-13T11:00:00.000Z");
    expect(await repository.getDealMeetingDateFieldBootstrappedAt()).toBe(
      "2026-04-13T11:00:00.000Z"
    );

    await repository.setSyncCursor({
      key: "category:10:activities:last_updated",
      cursorValue: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:01:00.000Z"
    });
    expect(
      await repository.getSyncCursor("category:10:activities:last_updated")
    ).toBe("2026-04-25T10:00:00.000Z");

    await repository.upsertSyncCoverage({
      scopeKey: "category:10",
      stream: "activity_history",
      providerId: "CRM_TODO",
      coveredFrom: "2026-01-25T00:00:00.000Z",
      coveredTo: null,
      algorithmVersion: "activity-bindings-v2",
      syncedAt: "2026-04-25T10:00:00.000Z"
    });
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2025-04-25T00:00:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(false);
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2026-02-01T00:00:00.000Z",
        requiredSyncedAt: "2026-04-25T10:01:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(false);
    await expect(
      repository.hasSyncCoverage({
        scopeKey: "category:10",
        stream: "activity_history",
        providerId: "CRM_TODO",
        requiredFrom: "2026-02-01T00:00:00.000Z",
        requiredSyncedAt: "2026-04-25T09:59:00.000Z",
        algorithmVersion: "activity-bindings-v2"
      })
    ).resolves.toBe(true);
  });
});
