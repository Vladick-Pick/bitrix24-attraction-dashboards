import { describe, expect, it } from "vitest";

import { performManualSync } from "../src/domain/sync";

describe("performManualSync", () => {
  const attractionScopeKey =
    "category:10:assigned:11234,2236,2764,6994,72,78,7814,7824";

  it("runs a category-scoped delta sync for deals and operational snapshots", async () => {
    const calls: Array<{ modifiedAfter: string | null }> = [];
    let requestedDealStageCategories: string[] = [];
    let requestedSourceCatalog = false;
    const storedDeals: unknown[][] = [];
    const storedStageHistory: unknown[][] = [];
    const storedActivities: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const storedDeadlineChanges: unknown[][] = [];
    const storedConversionEventVisits: unknown[][] = [];
    const storedManagers: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async (
        categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        requestedDealStageCategories = categoryIds;
        expect(assignedByIds).toEqual([
          "78",
          "11234",
          "7824",
          "6994",
          "7814",
          "72",
          "2236",
          "2764"
        ]);
        return "2026-04-07T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async (
        categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        expect(categoryIds).toEqual(["10"]);
        expect(assignedByIds).toEqual([
          "78",
          "11234",
          "7824",
          "6994",
          "7814",
          "72",
          "2236",
          "2764"
        ]);
        return ["D1", "D2"];
      },
      getActivitiesByIds: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A1", "A2"]);
        return [
          {
            id: "A2",
            ownerTypeId: "2",
            ownerId: "D2",
            typeId: "6",
            providerId: "CRM_TODO",
            responsibleId: "9",
            createdTime: "2026-04-08T10:00:00.000Z",
            deadline: "2026-04-09T12:00:00.000Z",
            lastUpdated: "2026-04-08T10:00:00.000Z",
            completed: false,
            completedTime: null
          }
        ];
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async (rows: unknown[]) => {
        storedStageHistory.push(rows);
        return rows.length;
      },
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async (rows: unknown[]) => {
        storedDeadlineChanges.push(rows);
        return rows.length;
      },
      upsertConversionEventVisits: async (rows: unknown[]) => {
        storedConversionEventVisits.push(rows);
        return rows.length;
      },
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async (rows: unknown[]) => {
        storedManagers.push(rows);
        return rows.length;
      },
      createSyncRun: async () => 17,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return [
          {
            entityType: "deal" as const,
            categoryId: "10",
            statusId: "C10:NEW",
            name: "New",
            semanticId: "P",
            sortOrder: 10
          }
        ];
      },
      fetchSourceCatalog: async () => {
        requestedSourceCatalog = true;
        return [
          {
            entityType: "source" as const,
            categoryId: null,
            statusId: "WEB",
            name: "Website",
            semanticId: null,
            sortOrder: 10
          }
        ];
      },
      fetchDealQualityMap: async (fieldName: string) => {
        expect(fieldName).toBe("UF_CRM_1730380390");
        return {
          "6": "3.1 Готов ко встрече"
        };
      },
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_EVENT_OF") {
          return {
            "700": "Знакомство с клубом 29.04."
          };
        }

        if (fieldName === "UF_CRM_1647422744") {
          return {
            "182": "Клиенту не интересен формат"
          };
        }

        if (fieldName === "UF_CRM_1643901145") {
          return {
            "114": "Федеральный Москва"
          };
        }

        if (fieldName === "UF_CRM_1747682957") {
          return {
            "388": "ClubOne"
          };
        }

        if (fieldName === "UF_CRM_TARGET_GROUP") {
          return {
            "512": "ClubFirst"
          };
        }

        if (fieldName === "UF_CRM_MEETING_TYPE") {
          return {
            "90": "Очная"
          };
        }

        if (
          fieldName === "UF_CRM_1758715585" ||
          fieldName === "UF_CRM_1772109151192"
        ) {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      fetchConversionEventDealFieldName: async () => "UF_CRM_EVENT_OF",
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        assignedByIds?: string[];
        customFieldNames?: string[];
      }) => {
        calls.push({ modifiedAfter: cursor.modifiedAfter });
        if (cursor.categoryIds[0] === "28") {
          expect(cursor.assignedByIds).toEqual([
            "78",
            "11234",
            "7824",
            "6994",
            "7814",
            "72",
            "2236",
            "2764"
          ]);
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        expect(cursor.assignedByIds).toEqual([
          "78",
          "11234",
          "7824",
          "6994",
          "7814",
          "72",
          "2236",
          "2764"
        ]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730380390",
          "UF_CRM_1643901145",
          "UF_CRM_1747682957",
          "UF_CRM_TARGET_GROUP",
          "UF_CRM_MEETING_TYPE",
          "UF_CRM_MEETING_DATE",
          "UF_CRM_EVENT_OF",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]);
        return [
          {
            ID: "D1",
            CONTACT_ID: "9001",
            LEAD_ID: "L1",
            DATE_CREATE: "2026-04-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-08T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730380390: "6",
            UF_CRM_1643901145: "114",
            UF_CRM_1747682957: "388",
            UF_CRM_TARGET_GROUP: "512",
            UF_CRM_MEETING_TYPE: "90",
            UF_CRM_MEETING_DATE: "2026-04-03T13:00:00.000Z",
            UF_CRM_EVENT_OF: "700",
            UF_CRM_1647422744: "182",
            UF_CRM_1647422890: "Не готов к формату клуба",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          }
        ];
      },
      listConversionEventVisits: async (input: {
        modifiedAfter: string | null;
        reportYear: number;
      }) => {
        expect(input).toEqual({
          modifiedAfter: "2026-04-07T00:00:00.000Z",
          reportYear: 2026
        });
        return [
          {
            id: "VISIT-1",
            eventName: "Знакомство с клубом 29.04.",
            eventDate: "2026-04-29T00:00:00.000Z",
            status: "attended" as const,
            stageId: "DT:ATTENDED",
            stageName: "На мероприятии",
            dealId: "D1",
            contactId: "9001",
            managerId: "78",
            sourceId: "WEB",
            createdTime: "2026-04-20T10:00:00.000Z",
            updatedTime: "2026-04-29T13:56:00.000Z"
          }
        ];
      },
      listStageHistory: async (input: { ownerIds?: string[] }) => {
        expect(input.ownerIds).toEqual(["D1", "D2"]);
        return [
          {
            ID: "H1",
            OWNER_ID: "D1",
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
            TYPE_ID: 1,
            CREATED_TIME: "2026-04-08T10:00:00.000Z"
          }
        ];
      },
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        expect(input.ownerIds).toEqual(["D1", "D2"]);
        expect(input.modifiedAfter).toBe("2026-04-07T00:00:00.000Z");
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "7",
            CREATED: "2026-04-08T10:30:00.000Z",
            DEADLINE: "2026-04-08T10:30:00.000Z",
            LAST_UPDATED: "2026-04-08T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-04-08T10:32:00.000Z"
          },
          {
            ID: "A2",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D2",
            TYPE_ID: "6",
            PROVIDER_ID: "CRM_TODO",
            RESPONSIBLE_ID: "9",
            CREATED: "2026-04-08T10:00:00.000Z",
            DEADLINE: "2026-04-10T12:00:00.000Z",
            LAST_UPDATED: "2026-04-09T09:00:00.000Z",
            COMPLETED: "N"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        expect(input.activityIds).toEqual(["A1"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A1",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-04-08T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async (input: { ids: string[] }) => {
        expect(input.ids.sort()).toEqual(["7", "78", "9"]);
        return [
          {
            ID: "7",
            NAME: "Анна",
            LAST_NAME: "Куратор"
          },
          {
            ID: "78",
            NAME: "Андрей",
            LAST_NAME: "Егоров"
          },
          {
            ID: "9",
            NAME: "Илья",
            LAST_NAME: "Менеджер"
          }
        ];
      }
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      tariffFieldName: "UF_CRM_1643901145",
      businessClubFieldName: "UF_CRM_1747682957",
      targetGroupFieldName: "UF_CRM_TARGET_GROUP",
      meetingTypeFieldName: "UF_CRM_MEETING_TYPE",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(calls).toEqual([{ modifiedAfter: "2026-04-07T00:00:00.000Z" }]);
    expect(requestedDealStageCategories).toEqual(["10"]);
    expect(requestedSourceCatalog).toBe(true);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D1",
          contactId: "9001",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          meetingDateValue: "2026-04-03T13:00:00.000Z",
          tariffValue: "Федеральный Москва",
          conversionEventValue: "Знакомство с клубом 29.04.",
          refusalReasonValue: "Клиенту не интересен формат",
          refusalReasonDetail: null
        })
      ]
    ]);
    expect(storedStageHistory).toEqual([
      [
        expect.objectContaining({
          id: "H1",
          ownerId: "D1"
        })
      ]
    ]);
    expect(storedActivities).toEqual([
      [
        expect.objectContaining({
          id: "A1",
          providerId: "VOXIMPLANT_CALL"
        }),
        expect.objectContaining({
          id: "A2",
          deadline: "2026-04-10T12:00:00.000Z"
        })
      ]
    ]);
    expect(storedDeadlineChanges).toEqual([
      [
        expect.objectContaining({
          activityId: "A2",
          previousDeadline: "2026-04-09T12:00:00.000Z",
          nextDeadline: "2026-04-10T12:00:00.000Z",
          changedAt: "2026-04-09T09:00:00.000Z"
        })
      ]
    ]);
    expect(storedCalls).toEqual([
      [
        expect.objectContaining({
          id: "CALL1",
          crmActivityId: "A1",
          callDurationSeconds: 64
        })
      ]
    ]);
    expect(storedConversionEventVisits).toEqual([
      [
        expect.objectContaining({
          id: "VISIT-1",
          eventName: "Знакомство с клубом 29.04.",
          dealId: "D1"
        })
      ]
    ]);
    expect(storedManagers).toEqual([
      [
        { id: "7", name: "Анна Куратор" },
        { id: "78", name: "Андрей Егоров" },
        { id: "9", name: "Илья Менеджер" }
      ]
    ]);
    expect(result).toMatchObject({
      syncRunId: 17,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-07T00:00:00.000Z",
      finishedAt: "2026-04-09T00:00:00.000Z"
    });
    expect(result.changes).toEqual({
      deals: 1,
      dealBreakdown: {
        total: 1,
        created: 1,
        updated: 0,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      activities: 2,
      calls: 1,
      stageHistory: 1,
      managers: 3
    });
  });

  it("hydrates target group from contact fields when the deal itself has no target-group field", async () => {
    const storedDeals: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 19,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        throw new Error(`Unexpected deal field map request: ${fieldName}`);
      },
      fetchContactFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1691070302") {
          return {
            "4734": "ClubFirst Russia",
            "4986": "ClubFirst Ladies"
          };
        }

        throw new Error(`Unexpected contact field map request: ${fieldName}`);
      },
      listDeals: async () => [
        {
          ID: "D_CONTACT_TARGET",
          CONTACT_ID: "4964",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T10:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "11",
          STAGE_ID: "C11:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: 1000,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listContacts: async (input: {
        ids: string[];
        customFieldNames?: string[];
      }) => {
        expect(input.ids).toEqual(["4964"]);
        expect(input.customFieldNames).toEqual([
          "UF_CRM_1712252375",
          "UF_CRM_1691070302"
        ]);
        return [
          {
            ID: "4964",
            UF_CRM_1712252375: "140488",
            UF_CRM_1691070302: "4986"
          }
        ];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      contactTargetGroupFieldName: "UF_CRM_1712252375",
      legacyContactTargetGroupFieldName: "UF_CRM_1691070302",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_CONTACT_TARGET",
          targetGroupValue: "ClubFirst Russia"
        })
      ]
    ]);
  });

  it("drops unresolved raw Bitrix target-group ids instead of leaking them into snapshots", async () => {
    const storedDeals: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 20,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        throw new Error(`Unexpected deal field map request: ${fieldName}`);
      },
      fetchContactFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1691070302") {
          return {
            "4734": "ClubFirst Russia",
            "4986": "ClubFirst Ladies"
          };
        }

        throw new Error(`Unexpected contact field map request: ${fieldName}`);
      },
      listDeals: async () => [
        {
          ID: "D_CONTACT_TARGET_UNKNOWN",
          CONTACT_ID: "4508",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-01T00:00:00.000Z",
          DATE_MODIFY: "2026-04-08T10:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "11",
          STAGE_ID: "C11:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: 1000,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listContacts: async () => [
        {
          ID: "4508",
          UF_CRM_1712252375: "395454",
          UF_CRM_1691070302: null
        }
      ],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      contactTargetGroupFieldName: "UF_CRM_1712252375",
      legacyContactTargetGroupFieldName: "UF_CRM_1691070302",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_CONTACT_TARGET_UNKNOWN",
          targetGroupValue: null
        })
      ]
    ]);
  });

  it("falls back to full backfill when no successful cursor exists", async () => {
    const repo = {
      getLatestSuccessCursor: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return null;
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 1,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const cursors: Array<string | null> = [];
    const client = {
      fetchDealStages: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return [];
      },
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null; categoryIds: string[] }) => {
        cursors.push(cursor.modifiedAfter);
        if (cursor.categoryIds[0] === "28") {
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        return [];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(cursors).toEqual([null]);
    expect(result.mode).toBe("full");
  });

  it("prefers the shared attraction loss reason field without fetching linked leadgen deals", async () => {
    const storedDeals: unknown[][] = [];
    const dealRequests: Array<{ categoryIds: string[]; customFieldNames?: string[] }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-07T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 18,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:LOSE",
          name: "Корзина",
          semanticId: "F",
          sortOrder: 90
        },
        {
          entityType: "deal" as const,
          categoryId: "10",
          statusId: "C10:RETURN",
          name: "Возврат в Лидген(неквал)",
          semanticId: "F",
          sortOrder: 100
        }
      ],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1647422744") {
          return { "182": "Общая причина" };
        }

        if (fieldName === "UF_CRM_1758715585") {
          return { "301": "Не соответствует критериям" };
        }

        if (fieldName === "UF_CRM_1772109151192") {
          return { "401": "Перестал выходить на связь" };
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealRequests.push(
          cursor.customFieldNames
            ? {
                categoryIds: cursor.categoryIds,
                customFieldNames: cursor.customFieldNames
              }
            : {
                categoryIds: cursor.categoryIds
              }
        );

        if (cursor.categoryIds[0] === "10") {
          return [
            {
              ID: "A_LOSE",
              LEAD_ID: null,
              DATE_CREATE: "2026-03-20T10:00:00.000Z",
              DATE_MODIFY: "2026-04-08T10:00:00.000Z",
              DATE_CLOSED: "2026-04-08T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:LOSE",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1647422744: "182",
              UF_CRM_1647422890: "Общая детализация",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            },
            {
              ID: "A_RETURN",
              LEAD_ID: null,
              DATE_CREATE: "2026-03-21T10:00:00.000Z",
              DATE_MODIFY: "2026-04-09T10:00:00.000Z",
              DATE_CLOSED: "2026-04-09T10:00:00.000Z",
              CATEGORY_ID: "10",
              STAGE_ID: "C10:RETURN",
              STAGE_SEMANTIC_ID: "F",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "78",
              SOURCE_ID: "WEB",
              UF_CRM_1647422744: "182",
              UF_CRM_1647422890: "Общая детализация",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            }
          ];
        }

        expect(cursor.categoryIds).toEqual(["28"]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730360968",
          "UF_CRM_1647422890",
          "UF_CRM_1758715585",
          "UF_CRM_1772109151192"
        ]);

        return [
          {
            ID: "L1",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-19T10:00:00.000Z",
            DATE_MODIFY: "2026-04-08T09:00:00.000Z",
            DATE_CLOSED: "2026-04-08T09:00:00.000Z",
            CATEGORY_ID: "28",
            STAGE_ID: "C28:LOSE",
            STAGE_SEMANTIC_ID: "F",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730360968: "A_LOSE",
            UF_CRM_1647422890: "Деталь корзины",
            UF_CRM_1772109151192: "401",
            UTM_SOURCE: null,
            UTM_MEDIUM: null,
            UTM_CAMPAIGN: null,
            UTM_CONTENT: null,
            UTM_TERM: null
          },
          {
            ID: "L2",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-20T10:00:00.000Z",
            DATE_MODIFY: "2026-04-09T09:00:00.000Z",
            DATE_CLOSED: "2026-04-09T09:00:00.000Z",
            CATEGORY_ID: "28",
            STAGE_ID: "C28:LOSE",
            STAGE_SEMANTIC_ID: "F",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1730360968: "A_RETURN",
            UF_CRM_1647422890: "Деталь неквала",
            UF_CRM_1758715585: "301",
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

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(dealRequests).toEqual([
      {
        categoryIds: ["10"],
        customFieldNames: [
          "UF_CRM_1730380390",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]
      }
    ]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "A_LOSE",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: null
        }),
        expect.objectContaining({
          id: "A_RETURN",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: null
        })
      ]
    ]);
  });

  it("bootstraps the full operational history once even during a delta deal sync", async () => {
    const activitySyncCursors: Array<string | null> = [];
    const bootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
        return "2026-04-10T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-10T00:00:00.000Z",
      getActivitySnapshotCount: async () => 0,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 1,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 33,
      markOperationalHistoryBootstrapped: async (timestamp: string) => {
        bootstrapMarks.push(timestamp);
      },
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null; categoryIds: string[] }) => {
        expect(cursor.modifiedAfter).toBe("2026-04-10T00:00:00.000Z");
        if (cursor.categoryIds[0] === "28") {
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        return [
          {
            ID: "D1",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-11T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
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
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activitySyncCursors.push(input.modifiedAfter);
        return [
          {
            ID: "A1",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: "7",
            CREATED: "2026-03-03T10:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-03-03T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        expect(input.activityIds).toEqual(["A1"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A1",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activitySyncCursors).toEqual([null]);
    expect(bootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
    expect(result).toMatchObject({
      syncRunId: 33,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-10T00:00:00.000Z",
      finishedAt: "2026-04-13T09:00:00.000Z"
    });
    expect(result.changes).toEqual({
      deals: 1,
      dealBreakdown: {
        total: 1,
        created: 1,
        updated: 0,
        closed: 0,
        reopened: 0,
        unchanged: 0
      },
      activities: 1,
      calls: 1,
      stageHistory: 0,
      managers: 1
    });
  });

  it("backfills historical call activities before the regular delta activity sync", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const callRequests: Array<{
      activityIds?: string[];
    }> = [];
    let stageHistoryCalls = 0;
    const storedActivities: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const callBootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () => null,
      getCallActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 44,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async (timestamp: string) => {
        callBootstrapMarks.push(timestamp);
      },
      markCallActivityHistoryBootstrapped: async (timestamp: string) => {
        callBootstrapMarks.push(`v2:${timestamp}`);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => {
        stageHistoryCalls += 1;
        return [];
      },
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (
          input.providerId === "VOXIMPLANT_CALL" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_CALL",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "2",
              PROVIDER_ID: "VOXIMPLANT_CALL",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-03T10:30:00.000Z",
              DEADLINE: null,
              LAST_UPDATED: "2026-03-03T10:32:00.000Z",
              COMPLETED: "Y",
              COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
            }
          ];
        }

        return [];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        callRequests.push({ activityIds: input.activityIds ?? [] });
        if (!input.activityIds || input.activityIds.length === 0) {
          return [];
        }

        expect(input.activityIds).toEqual(["A_CALL"]);
        return [
          {
            ID: "CALL1",
            CRM_ACTIVITY_ID: "A_CALL",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      { modifiedAfter: null, providerId: "VOXIMPLANT_CALL" },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(callRequests).toEqual([{ activityIds: ["A_CALL"] }]);
    expect(stageHistoryCalls).toBe(1);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_CALL",
        providerId: "VOXIMPLANT_CALL",
        ownerId: "D1"
      })
    ]);
    expect(storedCalls[0]).toEqual([
      expect.objectContaining({
        id: "CALL1",
        crmActivityId: "A_CALL"
      })
    ]);
    expect(callBootstrapMarks).toEqual([
      "2026-04-13T09:00:00.000Z",
      "v2:2026-04-13T09:00:00.000Z"
    ]);
  });

  it("hydrates missing deal-owned call activities for existing call snapshots", async () => {
    const missingActivityRequests: string[][] = [];
    const storedActivities: unknown[][] = [];
    const listCallRequests: Array<{ activityIds?: string[] }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async (activityIds: string[]) => {
        expect(activityIds).toEqual(["A_MISSING_CALL"]);
        return [];
      },
      getCallActivityIdsMissingActivities: async () => ["A_MISSING_CALL"],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 46,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listActivitiesByIds: async (activityIds: string[]) => {
        missingActivityRequests.push(activityIds);
        return [
          {
            ID: "A_MISSING_CALL",
            OWNER_TYPE_ID: 2 as unknown as string,
            OWNER_ID: "D1",
            TYPE_ID: "2",
            PROVIDER_ID: "VOXIMPLANT_CALL",
            RESPONSIBLE_ID: 7 as unknown as string,
            CREATED: "2026-03-03T10:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-03-03T10:32:00.000Z",
            COMPLETED: "Y",
            COMPLETED_DATE: "2026-03-03T10:32:00.000Z"
          }
        ];
      },
      listCalls: async (input: { activityIds?: string[] }) => {
        listCallRequests.push({ activityIds: input.activityIds ?? [] });
        return [
          {
            ID: "CALL_MISSING",
            CRM_ACTIVITY_ID: "A_MISSING_CALL",
            PORTAL_USER_ID: "7",
            CALL_TYPE: "2",
            CALL_START_DATE: "2026-03-03T10:30:00.000Z",
            CALL_DURATION: "64",
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: null
          }
        ];
      },
      fetchUsers: async (input: { ids: string[] }) => {
        expect(input.ids).toEqual(["7"]);
        return [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
        ];
      }
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(missingActivityRequests).toEqual([["A_MISSING_CALL"]]);
    expect(listCallRequests).toEqual([{ activityIds: ["A_MISSING_CALL"] }]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_MISSING_CALL",
        providerId: "VOXIMPLANT_CALL",
        ownerTypeId: "2",
        ownerId: "D1",
        responsibleId: "7"
      })
    ]);
  });

  it("backfills historical meeting activities once via CRM_MEETING provider", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const meetingBootstrapMarks: string[] = [];
    const storedActivities: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 45,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async (timestamp: string) => {
        meetingBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (
          input.providerId === "CRM_MEETING" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_MEETING",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "1",
              PROVIDER_ID: "CRM_MEETING",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-17T10:00:00.000Z",
              DEADLINE: "2026-03-18T16:00:00.000Z",
              LAST_UPDATED: "2026-03-17T10:00:00.000Z",
              COMPLETED: "N"
            }
          ];
        }

        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: null,
        providerId: "CRM_MEETING"
      },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_MEETING",
        providerId: "CRM_MEETING",
        typeId: "1",
        ownerId: "D1",
        deadline: "2026-03-18T16:00:00.000Z"
      })
    ]);
    expect(meetingBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills historical task activities once via CRM task providers", async () => {
    const activityRequests: Array<{
      modifiedAfter: string | null;
      providerId?: string;
    }> = [];
    const taskBootstrapMarks: string[] = [];
    const storedActivities: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async (rows: unknown[]) => {
        storedActivities.push(rows);
        return rows.length;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 47,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async (timestamp: string) => {
        taskBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        expect(input.ownerIds).toEqual(["D1"]);
        activityRequests.push(
          input.providerId
            ? {
                modifiedAfter: input.modifiedAfter,
                providerId: input.providerId
              }
            : {
                modifiedAfter: input.modifiedAfter
              }
        );

        if (input.providerId === "CRM_TODO" && input.modifiedAfter === null) {
          return [
            {
              ID: "A_TODO",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "6",
              PROVIDER_ID: "CRM_TODO",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-10T10:00:00.000Z",
              DEADLINE: "2026-03-11T10:00:00.000Z",
              LAST_UPDATED: "2026-03-10T10:00:00.000Z",
              COMPLETED: "N"
            }
          ];
        }

        if (
          input.providerId === "CRM_TASKS_TASK" &&
          input.modifiedAfter === null
        ) {
          return [
            {
              ID: "A_TASK",
              OWNER_TYPE_ID: "2",
              OWNER_ID: "D1",
              TYPE_ID: "6",
              PROVIDER_ID: "CRM_TASKS_TASK",
              RESPONSIBLE_ID: "7",
              CREATED: "2026-03-12T10:00:00.000Z",
              DEADLINE: "2026-03-13T10:00:00.000Z",
              LAST_UPDATED: "2026-03-12T10:00:00.000Z",
              COMPLETED: "Y",
              COMPLETED_DATE: "2026-03-12T12:00:00.000Z"
            }
          ];
        }

        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "7",
          NAME: "Анна",
          LAST_NAME: "Куратор"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: null,
        providerId: "CRM_TODO"
      },
      {
        modifiedAfter: null,
        providerId: "CRM_TASKS_TASK"
      },
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      }
    ]);
    expect(storedActivities[0]).toEqual([
      expect.objectContaining({
        id: "A_TODO",
        providerId: "CRM_TODO",
        ownerId: "D1"
      }),
      expect.objectContaining({
        id: "A_TASK",
        providerId: "CRM_TASKS_TASK",
        ownerId: "D1"
      })
    ]);
    expect(taskBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills deal custom fields once even when a delta cursor exists", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const customFieldBootstrapMarks: string[] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 48,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async (timestamp: string) => {
        customFieldBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1747682957") {
          return { "5844": "ClubFirst One" };
        }

        if (fieldName === "UF_CRM_1669784114991") {
          return { "3868": "Мероприятие" };
        }

        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        expect(cursor.categoryIds).toEqual(["11"]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730380390",
          "UF_CRM_1747682957",
          "UF_CRM_1669784114991",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]);

        return [
          {
            ID: "D_OLD",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-03-15T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "11",
            STAGE_ID: "C11:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_1747682957: "5844",
            UF_CRM_1669784114991: "3868",
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

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingTypeFieldName: "UF_CRM_1669784114991",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual([null]);
    expect(customFieldBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("backfills the meeting date deal field even after generic custom fields were bootstrapped", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const meetingDateBootstrapMarks: string[] = [];
    const storedDeals: unknown[][] = [];
    const storedMeetingDateChanges: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-10T00:00:00.000Z",
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getDealMeetingDateFieldBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 805,
      getDealIdsByCategoryIds: async () => [],
      getDealsByIds: async () => [
        {
          id: "D_MEETING_DATE",
          leadId: null,
          categoryId: "11",
          stageId: "C11:NEW",
          stageSemanticId: "P",
          opportunity: null,
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: null,
          meetingDateValue: "2026-03-11T13:00:00+03:00",
          dateCreate: "2026-03-01T00:00:00.000Z",
          dateModify: "2026-03-14T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async (rows: unknown[]) => {
        storedDeals.push(rows);
        return rows.length;
      },
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertDealMeetingDateChanges: async (rows: unknown[]) => {
        storedMeetingDateChanges.push(rows);
        return rows.length;
      },
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 49,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async (timestamp: string) => {
        meetingDateBootstrapMarks.push(timestamp);
      },
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async (fieldName: string) => {
        if (fieldName === "UF_CRM_1647422744") {
          return {};
        }

        throw new Error(`Unexpected field map request: ${fieldName}`);
      },
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        expect(cursor.categoryIds).toEqual(["11"]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730380390",
          "UF_CRM_MEETING_DATE",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]);

        return [
          {
            ID: "D_MEETING_DATE",
            LEAD_ID: null,
            DATE_CREATE: "2026-03-01T00:00:00.000Z",
            DATE_MODIFY: "2026-03-15T00:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "11",
            STAGE_ID: "C11:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: null,
            ASSIGNED_BY_ID: "78",
            SOURCE_ID: "WEB",
            UF_CRM_MEETING_DATE: "2026-03-13T13:00:00+03:00",
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

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["11"],
      qualityFieldName: "UF_CRM_1730380390",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      now: () => "2026-04-13T09:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual([null]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D_MEETING_DATE",
          meetingDateValue: "2026-03-13T13:00:00+03:00"
        })
      ]
    ]);
    expect(storedMeetingDateChanges).toEqual([
      [
        expect.objectContaining({
          dealId: "D_MEETING_DATE",
          previousMeetingDate: "2026-03-11T13:00:00+03:00",
          nextMeetingDate: "2026-03-13T13:00:00+03:00",
          changedAt: "2026-03-15T00:00:00.000Z"
        })
      ]
    ]);
    expect(meetingDateBootstrapMarks).toEqual(["2026-04-13T09:00:00.000Z"]);
  });

  it("reopens deal field backfill when stored field coverage is narrower than the required lookback", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: { stream: string }) =>
        input.stream !== "deal_custom_fields" &&
        input.stream !== "deal_meeting_date_field",
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealMeetingDateFieldBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 50,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        return [];
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(dealSyncCursors).toContain("2025-04-25T00:00:00.000Z");
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "deal_custom_fields",
          providerId: "all",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "deal_meeting_date_field",
          providerId: "UF_CRM_MEETING_DATE",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("uses existing scoped snapshot coverage for delta sync instead of reopening year backfill", async () => {
    const dealSyncCursors: Array<string | null> = [];
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const callRequests: Array<{
      activityIds?: string[];
      callStartDateFrom?: string;
      portalUserIds?: string[];
    }> = [];
    const stageHistoryRequests: Array<{ ownerIds?: string[] }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T13:20:59+03:00",
      getSyncCursor: async () => null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => false,
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getSnapshotStats: async () => ({
        deals: 3600,
        activities: 3611,
        calls: 1771,
        stageHistory: 12527
      }),
      getOperationalHistoryBootstrappedAt: async () => null,
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-17T10:18:05.677Z",
      getCallActivityHistoryBootstrappedAt: async () => null,
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-19T21:29:03.426Z",
      getTaskActivityHistoryBootstrappedAt: async () => null,
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-22T19:23:32.265Z",
      getDealMeetingDateFieldBootstrappedAt: async () => null,
      getActivitySnapshotCount: async () => 3611,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => ["A_OLD_CALL"],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 57,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      markDealMeetingDateFieldBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealSyncCursors.push(cursor.modifiedAfter);
        return [];
      },
      listStageHistory: async (input: { ownerIds?: string[] }) => {
        stageHistoryRequests.push(input);
        return [];
      },
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });
        return [];
      },
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
        portalUserIds?: string[];
      }) => {
        callRequests.push(input);
        return [];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      businessClubFieldName: "UF_CRM_1747682957",
      meetingDateFieldName: "UF_CRM_MEETING_DATE",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(dealSyncCursors).toEqual(["2026-04-24T13:20:59+03:00"]);
    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2026-04-24T13:20:59+03:00"
      }
    ]);
	    expect(callRequests).toEqual([
	      {
	        activityIds: ["A_OLD_CALL"]
	      },
	      {
	        callStartDateFrom: "2025-04-25T00:00:00.000Z",
	        callStartDateTo: "2026-04-25T00:00:00.000Z",
	        portalUserIds: ["78", "11234", "7824", "6994", "7814", "72", "2236", "2764"]
	      }
    ]);
    expect(stageHistoryRequests).toEqual([]);
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "deal_custom_fields",
          providerId: "all",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "activity_history",
          providerId: "VOXIMPLANT_CALL",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        }),
        expect.objectContaining({
          stream: "call_stats",
          providerId: "VOXIMPLANT_CALL",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("uses open deals for refresh but includes changed closed deals in activity delta sync", async () => {
    const activityOwnerRequests: string[][] = [];
    const stageHistoryOwnerRequests: string[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 3,
        activities: 2,
        calls: 1,
        stageHistory: 2
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 2,
      getDealIdsByCategoryIds: async () => [
        "D_STILL_OPEN",
        "D_NOW_CLOSED"
      ],
      getOpenDealIdsByCategoryIds: async () => [
        "D_STILL_OPEN",
        "D_NOW_CLOSED"
      ],
      getDealsByIds: async () => [
        {
          id: "D_NOW_CLOSED",
          title: null,
          leadId: null,
          categoryId: "10",
          stageId: "C10:IN_PROGRESS",
          stageSemanticId: "P",
          opportunity: null,
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
          dateCreate: "2026-04-20T00:00:00.000Z",
          dateModify: "2026-04-24T00:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        }
      ],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 58,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_NOW_CLOSED",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-20T00:00:00.000Z",
          DATE_MODIFY: "2026-04-25T12:00:00.000Z",
          DATE_CLOSED: "2026-04-25T12:00:00.000Z",
          CATEGORY_ID: "10",
          STAGE_ID: "C10:LOSE",
          STAGE_SEMANTIC_ID: "F",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        },
        {
          ID: "D_NEW_OPEN",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-25T10:00:00.000Z",
          DATE_MODIFY: "2026-04-25T12:30:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async (input: { ownerIds?: string[] }) => {
        stageHistoryOwnerRequests.push(input.ownerIds ?? []);
        return [];
      },
      listActivities: async (input: { ownerIds: string[] }) => {
        activityOwnerRequests.push(input.ownerIds);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(activityOwnerRequests).toEqual([
      ["D_STILL_OPEN", "D_NOW_CLOSED", "D_NEW_OPEN"]
    ]);
    expect(stageHistoryOwnerRequests).toEqual([
      ["D_NOW_CLOSED", "D_NEW_OPEN"]
    ]);
  });

  it("refreshes all call statistics in the lookback when call-stat coverage is missing", async () => {
    const requestedCallInputs: Array<{
      activityIds?: string[];
      callStartDateFrom?: string;
      portalUserIds?: string[];
    }> = [];
    const storedCalls: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
	      hasSyncCoverage: async (input: { stream: string }) =>
	        input.stream !== "call_stats",
	      upsertSyncCoverage: async () => undefined,
	      getSnapshotStats: async () => ({
	        deals: 1,
	        activities: 1,
	        calls: 1,
	        stageHistory: 1
	      }),
	      getOperationalHistoryBootstrappedAt: async () =>
	        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1", "D_CLOSED"],
      getOpenDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async (activityIds: string[]) =>
        [
          ...(activityIds.includes("A_EXISTING_CONTACT_CALL")
            ? [
                {
                  id: "A_EXISTING_CONTACT_CALL",
                  ownerTypeId: "2",
                  ownerId: "D1",
                  typeId: "6",
                  providerId: "VOXIMPLANT_CALL",
                  responsibleId: "78",
                  createdTime: "2026-04-21T12:00:00.000Z",
                  deadline: null,
                  lastUpdated: "2026-04-21T12:00:00.000Z",
                  completed: true,
                  completedTime: "2026-04-21T12:00:00.000Z"
                }
              ]
            : []),
          ...(activityIds.includes("A_CLOSED_CONTACT_CALL")
            ? [
                {
                  id: "A_CLOSED_CONTACT_CALL",
                  ownerTypeId: "2",
                  ownerId: "D_CLOSED",
                  typeId: "6",
                  providerId: "VOXIMPLANT_CALL",
                  responsibleId: "78",
                  createdTime: "2026-04-22T12:00:00.000Z",
                  deadline: null,
                  lastUpdated: "2026-04-22T12:00:00.000Z",
                  completed: true,
                  completedTime: "2026-04-22T12:00:00.000Z"
                }
              ]
            : [])
        ],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async (
        _limit: number,
        _activityCreatedFrom: string | null,
        ownerIds: string[]
      ) => {
        expect(ownerIds).toEqual(["D1", "D_CLOSED"]);
        return ["A_CALL_PARTIAL"];
      },
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async (rows: unknown[]) => {
        storedCalls.push(rows);
        return rows.length;
      },
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 51,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async (input: {
        activityIds?: string[];
        callStartDateFrom?: string;
        portalUserIds?: string[];
      }) => {
        requestedCallInputs.push(input);
        if (input.activityIds) {
          return [
            {
              ID: "CALL_1",
              CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
              PORTAL_USER_ID: "78",
              CALL_TYPE: "1",
              CALL_START_DATE: "2026-04-20T10:00:00.000Z",
              CALL_DURATION: 60,
              CRM_ENTITY_TYPE: "DEAL",
              CRM_ENTITY_ID: "D1",
              CALL_FAILED_CODE: "200"
            },
            {
              ID: "CALL_2",
              CRM_ACTIVITY_ID: "A_CALL_PARTIAL",
              PORTAL_USER_ID: "78",
              CALL_TYPE: "1",
              CALL_START_DATE: "2026-04-20T11:00:00.000Z",
              CALL_DURATION: 45,
              CRM_ENTITY_TYPE: "DEAL",
              CRM_ENTITY_ID: "D1",
              CALL_FAILED_CODE: "200"
            }
          ];
        }

        return [
          {
            ID: "CALL_SUPPLEMENTAL_DIRECT_DEAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T10:00:00.000Z",
            CALL_DURATION: 30,
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CONTACT_LEVEL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T11:00:00.000Z",
            CALL_DURATION: 15,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CONTACT_ACTIVITY",
            CRM_ACTIVITY_ID: "A_EXISTING_CONTACT_CALL",
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-21T12:00:00.000Z",
            CALL_DURATION: 50,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C1",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CLOSED_DIRECT_DEAL",
            CRM_ACTIVITY_ID: null,
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-22T10:00:00.000Z",
            CALL_DURATION: 35,
            CRM_ENTITY_TYPE: "DEAL",
            CRM_ENTITY_ID: "D_CLOSED",
            CALL_FAILED_CODE: "200"
          },
          {
            ID: "CALL_SUPPLEMENTAL_CLOSED_CONTACT_ACTIVITY",
            CRM_ACTIVITY_ID: "A_CLOSED_CONTACT_CALL",
            PORTAL_USER_ID: "78",
            CALL_TYPE: "1",
            CALL_START_DATE: "2026-04-22T12:00:00.000Z",
            CALL_DURATION: 55,
            CRM_ENTITY_TYPE: "CONTACT",
            CRM_ENTITY_ID: "C2",
            CALL_FAILED_CODE: "200"
          }
        ];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(requestedCallInputs).toEqual([
      {
        activityIds: ["A_CALL_PARTIAL"]
      },
      expect.objectContaining({
        callStartDateFrom: "2025-04-25T00:00:00.000Z",
        portalUserIds: expect.arrayContaining([
          "78",
          "11234",
          "7824",
          "6994",
          "7814",
          "72",
          "2236",
          "2764"
        ])
      })
    ]);
    expect(storedCalls[0]).toEqual([
      expect.objectContaining({ id: "CALL_1", crmActivityId: "A_CALL_PARTIAL" }),
      expect.objectContaining({ id: "CALL_2", crmActivityId: "A_CALL_PARTIAL" }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_DIRECT_DEAL",
        crmActivityId: null,
        crmEntityType: "DEAL",
        crmEntityId: "D1"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CONTACT_ACTIVITY",
        crmActivityId: "A_EXISTING_CONTACT_CALL",
        crmEntityType: "CONTACT",
        crmEntityId: "C1"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CLOSED_DIRECT_DEAL",
        crmActivityId: null,
        crmEntityType: "DEAL",
        crmEntityId: "D_CLOSED"
      }),
      expect.objectContaining({
        id: "CALL_SUPPLEMENTAL_CLOSED_CONTACT_ACTIVITY",
        crmActivityId: "A_CLOSED_CONTACT_CALL",
        crmEntityType: "CONTACT",
        crmEntityId: "C2"
      })
    ]);
  });

  it("uses an independent activity cursor instead of the latest deal cursor", async () => {
    const dealRequests: Array<string | null> = [];
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const storedCursors: Array<{ key: string; cursorValue: string }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:30:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T09:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        storedCursors.push(input);
      },
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 1,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 55,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: { modifiedAfter: string | null }) => {
        dealRequests.push(cursor.modifiedAfter);
        return [
          {
            ID: "D1",
            LEAD_ID: null,
            DATE_CREATE: "2026-04-20T00:00:00.000Z",
            DATE_MODIFY: "2026-04-25T12:30:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
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
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });

        return [
          {
            ID: "A_FRESH",
            OWNER_TYPE_ID: "2",
            OWNER_ID: "D1",
            TYPE_ID: "6",
            PROVIDER_ID: "CRM_TODO",
            RESPONSIBLE_ID: "78",
            CREATED: "2026-04-25T09:30:00.000Z",
            DEADLINE: null,
            LAST_UPDATED: "2026-04-25T10:00:00.000Z",
            COMPLETED: "N"
          }
        ];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "78",
          NAME: "Андрей",
          LAST_NAME: "Егоров"
        }
      ]
    };

    const result = await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(dealRequests).toEqual(["2026-04-25T12:00:00.000Z"]);
    expect(result.modifiedAfter).toBe("2026-04-25T12:00:00.000Z");
    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2026-04-25T09:00:00.000Z"
      }
    ]);
    expect(storedCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:deals:date_modify`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:activities:last_updated`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:call_stats:call_start_date`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        })
      ])
    );
  });

  it("advances stream cursors through empty delta windows and skips deal field metadata", async () => {
    const storedCursors: Array<{ key: string; cursorValue: string }> = [];
    const callRequests: Array<{
      callStartDateFrom?: string;
      callStartDateTo?: string;
      portalUserIds?: string[];
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-25T12:00:00.000Z",
      getSyncCursor: async (key: string) => {
        if (key === `${attractionScopeKey}:deals:date_modify`) {
          return "2026-04-25T12:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:activities:last_updated`) {
          return "2026-04-25T11:00:00.000Z";
        }

        if (key === `${attractionScopeKey}:call_stats:call_start_date`) {
          return "2026-04-25T10:00:00.000Z";
        }

        return null;
      },
      setSyncCursor: async (input: { key: string; cursorValue: string }) => {
        storedCursors.push(input);
      },
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 1,
        activities: 1,
        calls: 1,
        stageHistory: 1
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D1"],
      getOpenDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 59,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => {
        throw new Error("deal field maps should not be fetched for empty delta");
      },
      fetchDealFieldValueMap: async () => {
        throw new Error("deal field maps should not be fetched for empty delta");
      },
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async (input: {
        callStartDateFrom?: string;
        callStartDateTo?: string;
        portalUserIds?: string[];
      }) => {
        callRequests.push(input);
        return [];
      },
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      now: () => "2026-04-25T13:00:00.000Z"
    });

    expect(callRequests).toEqual([
      {
        callStartDateFrom: "2026-04-25T10:00:00.000Z",
        callStartDateTo: "2026-04-25T13:00:00.000Z",
        portalUserIds: expect.arrayContaining(["78"])
      }
    ]);
    expect(storedCursors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: `${attractionScopeKey}:deals:date_modify`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:activities:last_updated`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        }),
        expect.objectContaining({
          key: `${attractionScopeKey}:call_stats:call_start_date`,
          cursorValue: "2026-04-25T13:00:00.000Z"
        })
      ])
    );
  });

  it("reopens historical provider backfill when stored coverage is narrower than the required lookback", async () => {
    const activityRequests: Array<{ modifiedAfter: string | null; providerId?: string }> = [];
    const coverageWrites: Array<{
      stream: string;
      providerId: string | null;
      coveredFrom: string;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-24T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-24T00:00:00.000Z",
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        requiredFrom: string;
      }) =>
        !(
          input.stream === "activity_history" &&
          input.providerId === "CRM_TODO" &&
          input.requiredFrom === "2025-04-25T00:00:00.000Z"
        ),
      upsertSyncCoverage: async (input: {
        stream: string;
        providerId: string | null;
        coveredFrom: string;
      }) => {
        coverageWrites.push(input);
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-24T00:00:00.000Z",
      getActivitySnapshotCount: async () => 10,
      getDealIdsByCategoryIds: async () => ["D1"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 1,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 1,
      createSyncRun: async () => 56,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [],
      listStageHistory: async () => [],
      listActivities: async (input: {
        modifiedAfter: string | null;
        providerId?: string;
      }) => {
        activityRequests.push({
          modifiedAfter: input.modifiedAfter,
          ...(input.providerId ? { providerId: input.providerId } : {})
        });

        return input.providerId === "CRM_TODO"
          ? [
              {
                ID: "A_TODO_HISTORY",
                OWNER_TYPE_ID: "2",
                OWNER_ID: "D1",
                TYPE_ID: "6",
                PROVIDER_ID: "CRM_TODO",
                RESPONSIBLE_ID: "78",
                CREATED: "2025-06-01T10:00:00.000Z",
                DEADLINE: null,
                LAST_UPDATED: "2025-06-01T10:01:00.000Z",
                COMPLETED: "N"
              }
            ]
          : [];
      },
      listCalls: async () => [],
      fetchUsers: async () => [
        {
          ID: "78",
          NAME: "Андрей",
          LAST_NAME: "Егоров"
        }
      ]
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-25T00:00:00.000Z"
    });

    expect(activityRequests).toEqual([
      {
        modifiedAfter: "2025-04-25T00:00:00.000Z",
        providerId: "CRM_TODO"
      },
      {
        modifiedAfter: "2026-04-24T00:00:00.000Z"
      }
    ]);
    expect(coverageWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stream: "activity_history",
          providerId: "CRM_TODO",
          coveredFrom: "2025-04-25T00:00:00.000Z"
        })
      ])
    );
  });

  it("uses a compatible previous scope cursor and backfills only newly added managers", async () => {
    const dealRequests: Array<{
      modifiedAfter: string | null;
      assignedByIds?: string[];
    }> = [];
    const activityRequests: Array<{
      ownerIds: string[];
      modifiedAfter: string | null;
    }> = [];
    const repo = {
      getLatestSuccessCursor: async (
        _categoryIds: string[],
        assignedByIds?: string[]
      ) => {
        if (assignedByIds?.includes("7814")) {
          return null;
        }

        return "2026-04-26T21:31:21.964Z";
      },
      getLatestSuccessfulScope: async () => ({
        scopeKey: "category:10:assigned:11234,2236,2764,6994,72,78,7824",
        categoryIds: ["10"],
        assignedByIds: ["11234", "2236", "2764", "6994", "72", "78", "7824"]
      }),
      getSyncCursor: async () => null,
      setSyncCursor: async () => undefined,
      hasSyncCoverage: async () => true,
      upsertSyncCoverage: async () => undefined,
      getSnapshotStats: async () => ({
        deals: 3605,
        activities: 3804,
        calls: 1816,
        stageHistory: 12701
      }),
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getCallActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getMeetingActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getTaskActivityHistoryBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getDealCustomFieldsBootstrappedAt: async () =>
        "2026-04-26T21:31:21.964Z",
      getActivitySnapshotCount: async () => 3804,
      getDealIdsByCategoryIds: async () => ["D_OPEN"],
      getOpenDealIdsByCategoryIds: async () => ["D_OPEN"],
      getActivitiesByIds: async () => [],
      getCallActivityIdsMissingActivities: async () => [],
      getCallActivityIdsMissingCallStats: async () => [],
      getCallActivityIdsForCallStatsRefresh: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async (input?: { mode: "full" | "delta" }) => {
        expect(input?.mode).toBe("delta");
        return 60;
      },
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      markCallActivityHistoryBootstrapped: async () => undefined,
      markMeetingActivityHistoryBootstrapped: async () => undefined,
      markTaskActivityHistoryBootstrapped: async () => undefined,
      markDealCustomFieldsBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async () => undefined
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        assignedByIds?: string[];
      }) => {
        dealRequests.push({
          modifiedAfter: cursor.modifiedAfter,
          ...(cursor.assignedByIds ? { assignedByIds: cursor.assignedByIds } : {})
        });

        if (cursor.assignedByIds?.length === 1 && cursor.assignedByIds[0] === "7814") {
          return [
            {
              ID: "D_NEW_MANAGER",
              LEAD_ID: null,
              DATE_CREATE: "2026-04-24T09:00:00+03:00",
              DATE_MODIFY: "2026-04-24T09:00:00+03:00",
              DATE_CLOSED: null,
              CATEGORY_ID: "10",
              STAGE_ID: "C10:NEW",
              STAGE_SEMANTIC_ID: "P",
              OPPORTUNITY: null,
              ASSIGNED_BY_ID: "7814",
              SOURCE_ID: "WEB",
              UTM_SOURCE: null,
              UTM_MEDIUM: null,
              UTM_CAMPAIGN: null,
              UTM_CONTENT: null,
              UTM_TERM: null
            }
          ];
        }

        return [
          {
            ID: "D_DELTA",
            LEAD_ID: null,
            DATE_CREATE: "2026-04-27T08:00:00+03:00",
            DATE_MODIFY: "2026-04-27T08:00:00+03:00",
            DATE_CLOSED: null,
            CATEGORY_ID: "10",
            STAGE_ID: "C10:NEW",
            STAGE_SEMANTIC_ID: "P",
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
      listActivities: async (input: {
        ownerIds: string[];
        modifiedAfter: string | null;
      }) => {
        activityRequests.push(input);
        return [];
      },
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await performManualSync({
      client,
      repository: repo,
      categoryIds: ["10"],
      qualityFieldName: "UF_CRM_1730380390",
      bootstrapLookbackDays: 365,
      now: () => "2026-04-27T08:00:00+03:00"
    });

    expect(dealRequests).toEqual([
      {
        modifiedAfter: "2026-04-26T21:31:21.964Z",
        assignedByIds: ["78", "11234", "7824", "6994", "7814", "72", "2236", "2764"]
      },
      {
        modifiedAfter: "2025-04-27T05:00:00.000Z",
        assignedByIds: ["7814"]
      }
    ]);
    expect(activityRequests).toEqual([
      {
        ownerIds: ["D_OPEN", "D_DELTA", "D_NEW_MANAGER"],
        modifiedAfter: "2026-04-26T21:31:21.964Z"
      },
      {
        ownerIds: ["D_NEW_MANAGER"],
        modifiedAfter: "2025-04-27T05:00:00.000Z"
      }
    ]);
  });

  it("marks a sync run as failed when the Bitrix client throws", async () => {
    const failedRuns: Array<{ syncRunId: number; finishedAt: string; status: "failed" }> = [];
    const repo = {
      getLatestSuccessCursor: async () => null,
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-09T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => [],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => undefined,
      upsertDeals: async () => 0,
      upsertStageHistory: async () => 0,
      upsertActivities: async () => 0,
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 25,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => undefined,
      failSyncRun: async (input: {
        syncRunId: number;
        finishedAt: string;
        status: "failed";
      }) => {
        failedRuns.push(input);
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      listDeals: async () => {
        throw new Error("Bitrix24 crm.deal.list failed: OPERATION_TIME_LIMIT");
      },
      listStageHistory: async () => [],
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await expect(
      performManualSync({
        client,
        repository: repo,
        categoryIds: ["10"],
        qualityFieldName: "UF_CRM_1730380390",
        now: () => "2026-04-09T00:00:00.000Z"
      })
    ).rejects.toThrow("OPERATION_TIME_LIMIT");

    expect(failedRuns).toEqual([
      {
        syncRunId: 25,
        finishedAt: "2026-04-09T00:00:00.000Z",
        status: "failed",
        diagnostics: [
          "SYNC_FAILED",
          "bitrix=Bitrix24 crm.deal.list failed: OPERATION_TIME_LIMIT"
        ]
      }
    ]);
  });

  it("does not persist snapshot data or advance cursors when stage-history fetch fails", async () => {
    const writes: string[] = [];
    const failedRuns: Array<{ syncRunId: number; status: "failed" }> = [];
    const repo = {
      getLatestSuccessCursor: async () => "2026-04-08T00:00:00.000Z",
      getSyncCursor: async () => "2026-04-08T00:00:00.000Z",
      setSyncCursor: async () => {
        writes.push("cursor");
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-08T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-08T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async () => ["D_EXISTING"],
      getActivitiesByIds: async () => [],
      replaceStageCatalog: async () => {
        writes.push("stage-catalog");
      },
      upsertDeals: async () => {
        writes.push("deals");
        return 1;
      },
      upsertStageHistory: async () => {
        writes.push("stage-history");
        return 0;
      },
      upsertActivities: async () => {
        writes.push("activities");
        return 0;
      },
      upsertActivityDeadlineChanges: async () => 0,
      upsertCalls: async () => 0,
      upsertManagerDirectory: async () => 0,
      createSyncRun: async () => 61,
      markOperationalHistoryBootstrapped: async () => undefined,
      markCallHistoryBootstrapped: async () => undefined,
      finishSyncRun: async () => {
        writes.push("finish");
      },
      failSyncRun: async (input: { syncRunId: number; status: "failed" }) => {
        failedRuns.push(input);
      }
    };
    const client = {
      fetchDealStages: async () => [],
      fetchSourceCatalog: async () => [],
      fetchDealQualityMap: async () => ({}),
      fetchDealFieldValueMap: async () => ({}),
      listDeals: async () => [
        {
          ID: "D_NEW",
          LEAD_ID: null,
          DATE_CREATE: "2026-04-08T00:00:00.000Z",
          DATE_MODIFY: "2026-04-09T00:00:00.000Z",
          DATE_CLOSED: null,
          CATEGORY_ID: "10",
          STAGE_ID: "C10:NEW",
          STAGE_SEMANTIC_ID: "P",
          OPPORTUNITY: null,
          ASSIGNED_BY_ID: "78",
          SOURCE_ID: "WEB",
          UTM_SOURCE: null,
          UTM_MEDIUM: null,
          UTM_CAMPAIGN: null,
          UTM_CONTENT: null,
          UTM_TERM: null
        }
      ],
      listStageHistory: async () => {
        throw new Error("stage history unavailable");
      },
      listActivities: async () => [],
      listCalls: async () => [],
      fetchUsers: async () => []
    };

    await expect(
      performManualSync({
        client,
        repository: repo,
        categoryIds: ["10"],
        qualityFieldName: "UF_CRM_1730380390",
        now: () => "2026-04-09T00:00:00.000Z"
      })
    ).rejects.toThrow("stage history unavailable");

    expect(writes).toEqual([]);
    expect(failedRuns).toEqual([
      expect.objectContaining({
        syncRunId: 61,
        status: "failed"
      })
    ]);
  });
});
