import { describe, expect, it } from "vitest";

import { performManualSync } from "../src/domain/sync";

describe("performManualSync", () => {
  it("runs a category-scoped delta sync for deals and operational snapshots", async () => {
    const calls: Array<{ modifiedAfter: string | null }> = [];
    let requestedDealStageCategories: string[] = [];
    let requestedSourceCatalog = false;
    const storedDeals: unknown[][] = [];
    const storedStageHistory: unknown[][] = [];
    const storedActivities: unknown[][] = [];
    const storedCalls: unknown[][] = [];
    const storedDeadlineChanges: unknown[][] = [];
    const storedManagers: unknown[][] = [];
    const repo = {
      getLatestSuccessCursor: async (categoryIds: string[]) => {
        requestedDealStageCategories = categoryIds;
        return "2026-04-07T00:00:00.000Z";
      },
      getOperationalHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getCallHistoryBootstrappedAt: async () =>
        "2026-04-07T00:00:00.000Z",
      getActivitySnapshotCount: async () => 1,
      getDealIdsByCategoryIds: async (categoryIds: string[]) => {
        expect(categoryIds).toEqual(["10"]);
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
      listDeals: async (cursor: {
        modifiedAfter: string | null;
        categoryIds: string[];
        customFieldNames?: string[];
      }) => {
        calls.push({ modifiedAfter: cursor.modifiedAfter });
        if (cursor.categoryIds[0] === "28") {
          return [];
        }

        expect(cursor.categoryIds).toEqual(["10"]);
        expect(cursor.customFieldNames).toEqual([
          "UF_CRM_1730380390",
          "UF_CRM_1643901145",
          "UF_CRM_1747682957",
          "UF_CRM_TARGET_GROUP",
          "UF_CRM_MEETING_TYPE",
          "UF_CRM_1647422744",
          "UF_CRM_1647422890"
        ]);
        return [
          {
            ID: "D1",
            LEAD_ID: "L1",
            DATE_CREATE: "2026-04-01T00:00:00.000Z",
            DATE_MODIFY: "2026-04-08T10:00:00.000Z",
            DATE_CLOSED: null,
            CATEGORY_ID: "1",
            STAGE_ID: "C1:NEW",
            STAGE_SEMANTIC_ID: "P",
            OPPORTUNITY: 1000,
            ASSIGNED_BY_ID: "7",
            SOURCE_ID: "WEB",
            UF_CRM_1730380390: "6",
            UF_CRM_1643901145: "114",
            UF_CRM_1747682957: "388",
            UF_CRM_TARGET_GROUP: "512",
            UF_CRM_MEETING_TYPE: "90",
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
      listStageHistory: async (input: { categoryIds?: string[] }) => {
        expect(input.categoryIds).toEqual(["10"]);
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
        expect(input.ids.sort()).toEqual(["7", "9"]);
        return [
          {
            ID: "7",
            NAME: "Анна",
            LAST_NAME: "Куратор"
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
      now: () => "2026-04-09T00:00:00.000Z"
    });

    expect(calls).toEqual([
      { modifiedAfter: "2026-04-07T00:00:00.000Z" },
      { modifiedAfter: "2026-04-07T00:00:00.000Z" }
    ]);
    expect(requestedDealStageCategories).toEqual(["10"]);
    expect(requestedSourceCatalog).toBe(true);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "D1",
          sourceId: "WEB",
          qualityValue: "3.1 Готов ко встрече",
          businessClubValue: "ClubOne",
          targetGroupValue: "ClubFirst",
          meetingTypeValue: "Очная",
          tariffValue: "Федеральный Москва",
          refusalReasonValue: "Клиенту не интересен формат",
          refusalReasonDetail: "Не готов к формату клуба"
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
    expect(storedManagers).toEqual([
      [
        { id: "7", name: "Анна Куратор" },
        { id: "9", name: "Илья Менеджер" }
      ]
    ]);
    expect(result).toEqual({
      syncRunId: 17,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-07T00:00:00.000Z",
      finishedAt: "2026-04-09T00:00:00.000Z"
    });
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

    expect(cursors).toEqual([null, null]);
    expect(result.mode).toBe("full");
  });

  it("prefers shared attraction loss reason field for both loss stages and only falls back to linked leadgen values", async () => {
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
              ASSIGNED_BY_ID: "7",
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
              ASSIGNED_BY_ID: "7",
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
            ASSIGNED_BY_ID: "7",
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
            ASSIGNED_BY_ID: "7",
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
      },
      {
        categoryIds: ["28"],
        customFieldNames: [
          "UF_CRM_1730360968",
          "UF_CRM_1647422890",
          "UF_CRM_1758715585",
          "UF_CRM_1772109151192"
        ]
      }
    ]);
    expect(storedDeals).toEqual([
      [
        expect.objectContaining({
          id: "A_LOSE",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: "Общая детализация"
        }),
        expect.objectContaining({
          id: "A_RETURN",
          refusalReasonValue: "Общая причина",
          refusalReasonDetail: "Общая детализация"
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
            ASSIGNED_BY_ID: "7",
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
    expect(result).toEqual({
      syncRunId: 33,
      leadsSynced: 0,
      dealsSynced: 1,
      mode: "delta",
      modifiedAfter: "2026-04-10T00:00:00.000Z",
      finishedAt: "2026-04-13T09:00:00.000Z"
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

        if (input.providerId === "VOXIMPLANT_CALL") {
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
      {
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      },
      { modifiedAfter: null, providerId: "VOXIMPLANT_CALL" }
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

        if (input.providerId === "CRM_MEETING") {
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
        modifiedAfter: "2026-04-10T00:00:00.000Z"
      },
      {
        modifiedAfter: null,
        providerId: "CRM_MEETING"
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
        status: "failed"
      }
    ]);
  });
});
