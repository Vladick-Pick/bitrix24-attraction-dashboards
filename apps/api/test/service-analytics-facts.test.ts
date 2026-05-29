import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createReportingService } from "../src/server/service";
import { createSqliteRepository } from "../src/server/sqlite-repository";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("reporting service analytics facts", () => {
  it("rebuilds attraction identity, stage and touchpoint facts from existing snapshots", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bitrix24-facts-"));
    tempDirs.push(directory);

    const repository = createSqliteRepository({
      databaseUrl: `file:${join(directory, "reporting.db")}`,
      defaultWonStageIds: ["C10:WON"]
    });

    await repository.replaceStageCatalog([
      {
        entityType: "deal",
        categoryId: "10",
        statusId: "C10:CALL",
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
      }
    ]);
    await repository.upsertDeals([
      {
        id: "156562",
        contactId: "321",
        leadId: "900",
        categoryId: "10",
        stageId: "C10:DEMO",
        stageSemanticId: "P",
        opportunity: 181000,
        assignedById: "13020",
        sourceId: "LEADGEN_US",
        qualityValue: "3.1 Готов ко встрече",
        businessClubValue: "ClubFirst Future",
        targetGroupValue: null,
        meetingTypeValue: null,
        meetingDateValue: null,
        tariffValue: null,
        conversionEventValue: null,
        refusalReasonValue: null,
        refusalReasonDetail: null,
        dateCreate: "2026-05-13T09:00:00.000Z",
        dateModify: "2026-05-18T15:00:00.000Z",
        dateClosed: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null
      }
    ]);
    await repository.upsertStageHistory([
      {
        id: "stage-1",
        ownerId: "156562",
        categoryId: "10",
        stageId: "C10:CALL",
        stageSemanticId: "P",
        typeId: 1,
        createdTime: "2026-05-15T09:00:00.000Z"
      },
      {
        id: "stage-2",
        ownerId: "156562",
        categoryId: "10",
        stageId: "C10:DEMO",
        stageSemanticId: "P",
        typeId: 2,
        createdTime: "2026-05-18T09:00:00.000Z"
      }
    ]);
    await repository.upsertActivities([
      {
        id: "CALL_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "156562",
        typeId: "2",
        providerId: "VOXIMPLANT_CALL",
        responsibleId: "13020",
        createdTime: "2026-05-16T10:00:00.000Z",
        deadline: null,
        lastUpdated: "2026-05-16T10:01:00.000Z",
        completed: true,
        completedTime: "2026-05-16T10:01:00.000Z"
      },
      {
        id: "TASK_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "156562",
        typeId: "6",
        providerId: "CRM_TODO",
        responsibleId: "13020",
        createdTime: "2026-05-17T11:00:00.000Z",
        deadline: "2026-05-18T11:00:00.000Z",
        lastUpdated: "2026-05-17T12:00:00.000Z",
        completed: true,
        completedTime: "2026-05-18T12:00:00.000Z"
      }
    ]);
    await repository.upsertActivityBindings([
      {
        activityId: "CALL_ACTIVITY",
        ownerTypeId: "2",
        ownerId: "156562"
      }
    ]);
    await repository.upsertCalls([
      {
        id: "LINKED_CALL",
        crmActivityId: "CALL_ACTIVITY",
        portalUserId: "13020",
        callType: "1",
        callStartDate: "2026-05-16T10:00:00.000Z",
        callDurationSeconds: 95,
        crmEntityType: "CONTACT",
        crmEntityId: "321",
        callFailedCode: "200"
      },
      {
        id: "UNLINKED_CALL",
        crmActivityId: null,
        portalUserId: "13020",
        callType: "2",
        callStartDate: "2026-05-16T11:00:00.000Z",
        callDurationSeconds: 0,
        crmEntityType: null,
        crmEntityId: null,
        callFailedCode: "304"
      }
    ]);

    const service = createReportingService({
      dealCategoryIds: ["10"],
      qualityFieldName: "UF_CRM_TEST",
      repository,
      client: {
        fetchUsers: async () => []
      } as never,
      defaultPeriodDays: 30,
      now: () => new Date("2026-05-24T12:00:00.000Z")
    });

    await expect(service.rebuildAnalyticsFacts()).resolves.toEqual({
      identityLinks: 1,
      dealStageFacts: 2,
      dealTouchpointFacts: 4,
      eventVisitFacts: 0
    });
    await expect(repository.getAllIdentityLinks()).resolves.toEqual([
      expect.objectContaining({
        identityId: "identity:deal:156562",
        leadId: "900",
        contactId: "321"
      })
    ]);
    await expect(repository.getAllDealStageFacts()).resolves.toEqual([
      expect.objectContaining({
        stageId: "C10:CALL",
        leftAt: "2026-05-18T09:00:00.000Z"
      }),
      expect.objectContaining({
        stageId: "C10:DEMO",
        leftAt: null
      })
    ]);
    await expect(repository.getAllDealTouchpointFacts()).resolves.toEqual([
      expect.objectContaining({
        factId: "call:LINKED_CALL",
        dealId: "156562",
        stageIdAtEvent: "C10:CALL"
      }),
      expect.objectContaining({
        factId: "call:UNLINKED_CALL",
        dealId: null,
        managerId: "13020"
      }),
      expect.objectContaining({
        factId: "task-created:TASK_ACTIVITY",
        stageIdAtEvent: "C10:CALL"
      }),
      expect.objectContaining({
        factId: "task-completed:TASK_ACTIVITY",
        stageIdAtEvent: "C10:DEMO"
      })
    ]);
  });
});
