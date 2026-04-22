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
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Не готов к формату клуба",
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
        tariffValue: "Федеральный Москва",
        refusalReasonValue: "Клиенту не интересен формат",
        refusalReasonDetail: "Не готов к формату клуба",
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
    expect((await repository.getStageCatalog())[0]?.name).toBe("Won");
    expect(await repository.getDealIdsByCategoryIds(["1"])).toEqual(["D1"]);
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
      }
    ]);
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
  });
});
