import { describe, expect, it } from "vitest";

import { buildCallsWorkloadReport } from "../src/domain/operational-reports";

describe("buildCallsWorkloadReport", () => {
  it("adds per-manager outgoing call heatmaps by weekday and hour from 9 to 21", () => {
    const result = buildCallsWorkloadReport({
      range: {
        from: "2026-05-04T00:00:00.000Z",
        to: "2026-05-10T23:59:59.999Z"
      },
      deals: [],
      stageCatalog: [],
      stageHistory: [],
      activities: [],
      calls: [
        {
          id: "MONDAY_MORNING",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-05-04T09:15:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "MONDAY_MORNING_2",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-05-04T09:45:00.000Z",
          callDurationSeconds: 30,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "MONDAY_FAILED",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-05-04T09:50:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "304"
        },
        {
          id: "SUNDAY_EVENING",
          crmActivityId: null,
          portalUserId: "7",
          callType: "2",
          callStartDate: "2026-05-10T21:00:00.000Z",
          callDurationSeconds: 15,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "OUTSIDE_HOUR",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-05-06T22:00:00.000Z",
          callDurationSeconds: 15,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "7", name: "Анна Куратор" }]
    });

    const row = result.managerRows.find((item) => item.managerId === "7");
    const heatmap = (row as any)?.callsHourlyHeatmap;
    const mondayNine = heatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 1 && cell.hour === 9
    );
    const sundayTwentyOne = heatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 7 && cell.hour === 21
    );
    const outsideHour = heatmap?.cells.find(
      (cell: { weekday: number; hour: number }) =>
        cell.weekday === 3 && cell.hour === 22
    );

    expect(heatmap?.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
    expect(heatmap?.weekdays.map((weekday: { label: string }) => weekday.label)).toEqual([
      "Пн",
      "Вт",
      "Ср",
      "Чт",
      "Пт",
      "Сб",
      "Вс"
    ]);
    expect(heatmap?.basis).toEqual({
      key: "outgoing_calls",
      label: "Исходящие звонки"
    });
    expect(mondayNine).toMatchObject({ count: 3, intensity: 5 });
    expect(sundayTwentyOne).toMatchObject({ count: 0 });
    expect(outsideHour).toBeUndefined();
    expect(mondayNine?.segments).toEqual([
      {
        key: "successful_outgoing_calls",
        label: "Успешные >30 сек",
        count: 1,
        intensity: 5
      },
      {
        key: "other_outgoing_calls",
        label: "Прочие исходящие",
        count: 1,
        intensity: 5
      },
      {
        key: "no_answer_outgoing_calls",
        label: "Недозвоны",
        count: 1,
        intensity: 5
      }
    ]);
    expect(heatmap?.total).toBe(4);
    expect(heatmap?.gridTotal).toBe(3);
    expect(heatmap?.outsideGridTotal).toBe(1);
    expect(heatmap?.peak).toMatchObject({ weekday: 1, hour: 9, count: 3 });
  });

  it("scopes direct-only manager call heatmaps to the displayed linked outgoing calls", () => {
    const result = buildCallsWorkloadReport({
      range: {
        from: "2026-06-15T00:00:00.000Z",
        to: "2026-06-21T23:59:59.999Z"
      },
      deals: [
        {
          id: "DIRECT_ONLY_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "7538",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-06-15T09:00:00.000Z",
          dateModify: "2026-06-15T09:00:00.000Z",
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
      activities: [],
      calls: [
        {
          id: "DIRECT_LINKED_OUTGOING",
          crmActivityId: null,
          portalUserId: "7538",
          callType: "1",
          callStartDate: "2026-06-16T10:00:00.000Z",
          callDurationSeconds: 90,
          crmEntityType: "DEAL",
          crmEntityId: "DIRECT_ONLY_DEAL",
          callFailedCode: "200",
          linkReason: "activity_owner_deal",
          linkConfidence: "high"
        },
        {
          id: "DIRECT_LINKED_INCOMING",
          crmActivityId: null,
          portalUserId: "7538",
          callType: "2",
          callStartDate: "2026-06-16T11:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "DIRECT_ONLY_DEAL",
          callFailedCode: "200",
          linkReason: "activity_owner_deal",
          linkConfidence: "high"
        },
        {
          id: "DIRECT_ONLY_FALLBACK",
          crmActivityId: null,
          portalUserId: "7538",
          callType: "1",
          callStartDate: "2026-06-17T10:00:00.000Z",
          callDurationSeconds: 120,
          crmEntityType: "DEAL",
          crmEntityId: "DIRECT_ONLY_DEAL",
          callFailedCode: "200",
          linkReason: "contact_single_deal_fallback",
          linkConfidence: "medium"
        }
      ],
      managerDirectory: [
        {
          id: "7538",
          name: "Мария Саличева",
          callAttributionPolicy: "direct_only"
        }
      ]
    });

    const row = result.managerRows.find((item) => item.managerId === "7538");
    const heatmap = (row as any)?.callsHourlyHeatmap;
    const directLinkedSlot = heatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 2 && cell.hour === 10
    );
    const fallbackSlot = heatmap?.cells.find(
      (cell: { weekday: number; hour: number }) => cell.weekday === 3 && cell.hour === 10
    );

    expect(row?.callAttributionPolicy).toBe("direct_only");
    expect(row?.totalCalls).toBe(3);
    expect(row?.outgoingCalls).toBe(2);
    expect(row?.linkedDealCalls.outgoingCalls).toBe(1);
    expect(row?.linkedDealCalls.incomingCalls).toBe(1);
    expect(row?.linkedDealCalls.excludedByPolicyCalls?.outgoingCalls).toBe(1);
    expect(heatmap?.total).toBe(1);
    expect(heatmap?.gridTotal).toBe(1);
    expect(heatmap?.outsideGridTotal).toBe(0);
    expect(directLinkedSlot).toMatchObject({ count: 1 });
    expect(fallbackSlot).toMatchObject({ count: 0 });
  });

  it("links calls through activity bindings when Bitrix primary owner is another funnel", () => {
    const input = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      deals: [
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
        },
        {
          id: "LEADGEN_DEAL",
          leadId: null,
          categoryId: "28",
          stageId: "C28:WON",
          stageSemanticId: "S",
          opportunity: 0,
          assignedById: "12028",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-04-24T11:08:50.000Z",
          dateModify: "2026-04-24T11:08:50.000Z",
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
          entityType: "deal" as const,
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
          id: "CALL_ACTIVITY",
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
      activityBindings: [
        {
          activityId: "CALL_ACTIVITY",
          ownerTypeId: "2",
          ownerId: "LEADGEN_DEAL"
        },
        {
          activityId: "CALL_ACTIVITY",
          ownerTypeId: "2",
          ownerId: "ATTRACTION_DEAL"
        }
      ],
      calls: [
        {
          id: "CALL",
          crmActivityId: "CALL_ACTIVITY",
          portalUserId: "2236",
          callType: "1",
          callStartDate: "2026-04-27T19:22:33.000Z",
          callDurationSeconds: 240,
          crmEntityType: "CONTACT",
          crmEntityId: "37454",
          callFailedCode: "200"
        }
      ],
      managerDirectory: [{ id: "2236", name: "Потапова Мария" }]
    } as Parameters<typeof buildCallsWorkloadReport>[0] & {
      activityBindings: Array<{
        activityId: string;
        ownerTypeId: string;
        ownerId: string;
      }>;
    };

    const result = buildCallsWorkloadReport(input);
    const potapova = result.managerRows.find((row) => row.managerId === "2236");

    expect(result.allCalls.totalCalls).toBe(1);
    expect(result.linkedDealCalls.totalCalls).toBe(1);
    expect(result.linkedDealCalls.totalDealCount).toBe(1);
    expect(potapova?.linkedDealCalls).toMatchObject({
      dealCount: 1,
      totalCalls: 1,
      connectedCalls: 1
    });
    expect(potapova?.stageBreakdown).toEqual([
      expect.objectContaining({
        stageId: "C10:PREPARATION",
        totalCalls: 1
      })
    ]);
  });

  it("keeps fallback calls for standard managers but excludes them from direct-only manager attribution", () => {
    const result = buildCallsWorkloadReport({
      range: {
        from: "2026-06-15T00:00:00.000Z",
        to: "2026-06-21T23:59:59.999Z"
      },
      deals: [
        {
          id: "STANDARD_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "2236",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-06-15T09:00:00.000Z",
          dateModify: "2026-06-15T09:00:00.000Z",
          dateClosed: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          utmContent: null,
          utmTerm: null
        },
        {
          id: "DIRECT_ONLY_DEAL",
          leadId: null,
          categoryId: "10",
          stageId: "C10:PREPARATION",
          stageSemanticId: "P",
          opportunity: 0,
          assignedById: "7538",
          sourceId: "WEB",
          qualityValue: null,
          dateCreate: "2026-06-15T09:00:00.000Z",
          dateModify: "2026-06-15T09:00:00.000Z",
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
      activities: [],
      calls: [
        {
          id: "STANDARD_FALLBACK",
          crmActivityId: null,
          portalUserId: "2236",
          callType: "1",
          callStartDate: "2026-06-16T10:00:00.000Z",
          callDurationSeconds: 90,
          crmEntityType: "DEAL",
          crmEntityId: "STANDARD_DEAL",
          callFailedCode: "200",
          linkReason: "contact_single_deal_fallback",
          linkConfidence: "medium"
        },
        {
          id: "DIRECT_ONLY_FALLBACK",
          crmActivityId: null,
          portalUserId: "7538",
          callType: "1",
          callStartDate: "2026-06-17T10:00:00.000Z",
          callDurationSeconds: 120,
          crmEntityType: "DEAL",
          crmEntityId: "DIRECT_ONLY_DEAL",
          callFailedCode: "200",
          linkReason: "contact_single_deal_fallback",
          linkConfidence: "medium"
        },
        {
          id: "DIRECT_ONLY_DIRECT",
          crmActivityId: null,
          portalUserId: "7538",
          callType: "1",
          callStartDate: "2026-06-18T10:00:00.000Z",
          callDurationSeconds: 150,
          crmEntityType: "DEAL",
          crmEntityId: "DIRECT_ONLY_DEAL",
          callFailedCode: "200",
          linkReason: "activity_owner_deal",
          linkConfidence: "high"
        }
      ],
      managerDirectory: [
        { id: "2236", name: "Потапова Мария" },
        {
          id: "7538",
          name: "Мария Саличева",
          callAttributionPolicy: "direct_only"
        }
      ]
    });

    const standard = result.managerRows.find((row) => row.managerId === "2236");
    const directOnly = result.managerRows.find((row) => row.managerId === "7538");

    expect(result.allCalls.totalCalls).toBe(3);
    expect(result.linkedDealCalls.totalCalls).toBe(2);
    expect(result.linkedDealCalls.totalDealCount).toBe(2);
    expect(result.linkedDealCalls.excludedByPolicyCalls?.totalCalls).toBe(1);
    expect(standard?.linkedDealCalls).toMatchObject({
      dealCount: 1,
      totalCalls: 1
    });
    expect(standard?.linkedDealCalls.excludedByPolicyCalls?.totalCalls ?? 0).toBe(0);
    expect(directOnly?.callAttributionPolicy).toBe("direct_only");
    expect(directOnly?.totalCalls).toBe(2);
    expect(directOnly?.linkedDealCalls).toMatchObject({
      dealCount: 1,
      totalCalls: 1,
      excludedByPolicyCalls: expect.objectContaining({
        totalCalls: 1,
        outgoingCalls: 1,
        connectedCalls: 1
      })
    });
  });

  it("separates missed incoming calls from successful incoming calls", () => {
    const result = buildCallsWorkloadReport({
      range: {
        from: "2026-05-04T00:00:00.000Z",
        to: "2026-05-05T23:59:59.999Z"
      },
      deals: [],
      stageCatalog: [],
      stageHistory: [],
      activities: [],
      calls: [
        {
          id: "INCOMING_CONNECTED",
          crmActivityId: null,
          portalUserId: "72",
          callType: "2",
          callStartDate: "2026-05-04T10:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "INCOMING_MISSED",
          crmActivityId: null,
          portalUserId: "72",
          callType: "2",
          callStartDate: "2026-05-04T11:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "304"
        }
      ],
      managerDirectory: [{ id: "72", name: "Мария Крохалева" }]
    });

    const row = result.managerRows.find((item) => item.managerId === "72");

    expect(row?.totalCalls).toBe(2);
    expect(row?.incomingCalls).toBe(1);
    expect((row as any)?.missedIncomingCalls).toBe(1);
    expect(row?.allCalls.incomingCalls).toBe(1);
    expect((row?.allCalls as any)?.missedIncomingCalls).toBe(1);
    expect(result.totalIncomingCalls).toBe(1);
    expect((result as any).totalMissedIncomingCalls).toBe(1);
  });

  it("aggregates call direction and connection semantics by manager and stage through activity linkage", () => {
    const result = buildCallsWorkloadReport({
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
          stageId: "C10:UC_9E0XYG",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-03T10:00:00.000Z"
        },
        {
          id: "T2",
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
          id: "CA1",
          ownerTypeId: "2",
          ownerId: "1",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "7",
          createdTime: "2026-04-03T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-03T12:10:00.000Z",
          completed: true,
          completedTime: "2026-04-03T12:10:00.000Z"
        },
        {
          id: "CA2",
          ownerTypeId: "2",
          ownerId: "2",
          typeId: "2",
          providerId: "VOXIMPLANT_CALL",
          responsibleId: "9",
          createdTime: "2026-04-07T14:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-07T14:02:00.000Z",
          completed: true,
          completedTime: "2026-04-07T14:02:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL1",
          crmActivityId: "CA1",
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-04-03T12:00:00.000Z",
          callDurationSeconds: 120,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: null
        },
        {
          id: "CALL2",
          crmActivityId: "CA2",
          portalUserId: "9",
          callType: "2",
          callStartDate: "2026-04-07T14:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "200"
        },
        {
          id: "CALL3",
          crmActivityId: "CA2",
          portalUserId: "9",
          callType: "2",
          callStartDate: "2026-04-07T14:05:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: "486"
        },
        {
          id: "CALL4",
          crmActivityId: null,
          portalUserId: "12",
          callType: "1",
          callStartDate: "2026-04-07T14:00:00.000Z",
          callDurationSeconds: 0,
          crmEntityType: null,
          crmEntityId: null,
          callFailedCode: null
        },
        {
          id: "CALL5",
          crmActivityId: null,
          portalUserId: "7",
          callType: "1",
          callStartDate: "2026-04-04T10:00:00.000Z",
          callDurationSeconds: 20,
          crmEntityType: "DEAL",
          crmEntityId: "1",
          callFailedCode: null
        }
      ],
      managerDirectory: [
        { id: "7", name: "Анна Куратор" },
        { id: "9", name: "Илья Менеджер" },
        { id: "99", name: "Ольга Без звонков" }
      ]
    });

      expect(result).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCalls: 5,
      totalIncomingCalls: 1,
      totalMissedIncomingCalls: 1,
      totalOutgoingCalls: 3,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 3,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 2,
      totalConnectedCallsOverThirtySeconds: 1,
      allCalls: {
        totalCalls: 5,
        incomingCalls: 1,
        missedIncomingCalls: 1,
        outgoingCalls: 3,
        otherOutgoingCalls: 1,
        connectedCalls: 3,
        failedCalls: 1,
        callsOverThirtySeconds: 2,
        connectedCallsOverThirtySeconds: 1,
        averageDurationSeconds: 40
      },
      linkedDealCalls: {
        totalDealCount: 2,
        totalCalls: 4,
        incomingCalls: 1,
        missedIncomingCalls: 1,
        outgoingCalls: 2,
        otherOutgoingCalls: 1,
        connectedCalls: 3,
        failedCalls: 0,
        callsOverThirtySeconds: 2,
        connectedCallsOverThirtySeconds: 1,
        averageDurationSeconds: 50
      },
      warnings: [],
      managerRows: [
        {
          managerId: "12",
          managerName: "12",
          dealCount: 0,
          totalCalls: 1,
          incomingCalls: 0,
          missedIncomingCalls: 0,
          outgoingCalls: 1,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 1,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 0,
          averageDurationSeconds: 0,
          allCalls: {
            totalCalls: 1,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 1,
            otherOutgoingCalls: 0,
            connectedCalls: 0,
            failedCalls: 1,
            callsOverThirtySeconds: 0,
            connectedCallsOverThirtySeconds: 0,
            averageDurationSeconds: 0
          },
          linkedDealCalls: {
            dealCount: 0,
            totalCalls: 0,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 0,
            failedCalls: 0,
            callsOverThirtySeconds: 0,
            connectedCallsOverThirtySeconds: 0,
            averageCallsPerDeal: 0,
            averageDurationSeconds: 0,
            stageBreakdown: []
          },
          callsHourlyHeatmap: expect.any(Object),
          stageBreakdown: []
        },
        {
          managerId: "7",
          managerName: "Анна Куратор",
          dealCount: 1,
          totalCalls: 2,
          incomingCalls: 0,
          missedIncomingCalls: 0,
          outgoingCalls: 2,
          otherOutgoingCalls: 1,
          connectedCalls: 2,
          failedCalls: 0,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 1,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 70,
          allCalls: {
            totalCalls: 2,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 2,
            otherOutgoingCalls: 1,
            connectedCalls: 2,
            failedCalls: 0,
            callsOverThirtySeconds: 1,
            connectedCallsOverThirtySeconds: 1,
            averageDurationSeconds: 70
          },
          linkedDealCalls: {
            dealCount: 1,
            totalCalls: 2,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 2,
            otherOutgoingCalls: 1,
            connectedCalls: 2,
            failedCalls: 0,
            callsOverThirtySeconds: 1,
            connectedCallsOverThirtySeconds: 1,
            averageCallsPerDeal: 2,
            averageDurationSeconds: 70,
            stageBreakdown: [
              {
                stageId: "C10:UC_9E0XYG",
                stageName: "Встреча-знакомство",
                dealCount: 1,
                totalCalls: 2,
                incomingCalls: 0,
                missedIncomingCalls: 0,
                outgoingCalls: 2,
                otherOutgoingCalls: 1,
                connectedCalls: 2,
                failedCalls: 0,
                callsOverThirtySeconds: 1,
                connectedCallsOverThirtySeconds: 1,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 70
              }
            ]
          },
          callsHourlyHeatmap: expect.any(Object),
          stageBreakdown: [
            {
              stageId: "C10:UC_9E0XYG",
              stageName: "Встреча-знакомство",
              dealCount: 1,
              totalCalls: 2,
              incomingCalls: 0,
              missedIncomingCalls: 0,
              outgoingCalls: 2,
              otherOutgoingCalls: 1,
              connectedCalls: 2,
              failedCalls: 0,
              callsOverThirtySeconds: 1,
              connectedCallsOverThirtySeconds: 1,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 70
            }
          ]
        },
        {
          managerId: "9",
          managerName: "Илья Менеджер",
          dealCount: 1,
          totalCalls: 2,
          incomingCalls: 1,
          missedIncomingCalls: 1,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 1,
          failedCalls: 0,
          callsOverThirtySeconds: 1,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 30,
          allCalls: {
            totalCalls: 2,
            incomingCalls: 1,
            missedIncomingCalls: 1,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 1,
            failedCalls: 0,
            callsOverThirtySeconds: 1,
            connectedCallsOverThirtySeconds: 0,
            averageDurationSeconds: 30
          },
          linkedDealCalls: {
            dealCount: 1,
            totalCalls: 2,
            incomingCalls: 1,
            missedIncomingCalls: 1,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 1,
            failedCalls: 0,
            callsOverThirtySeconds: 1,
            connectedCallsOverThirtySeconds: 0,
            averageCallsPerDeal: 2,
            averageDurationSeconds: 30,
            stageBreakdown: [
              {
                stageId: "C10:PREPARATION",
                stageName: "Звонок-знакомство",
                dealCount: 1,
                totalCalls: 2,
                incomingCalls: 1,
                missedIncomingCalls: 1,
                outgoingCalls: 0,
                otherOutgoingCalls: 0,
                connectedCalls: 1,
                failedCalls: 0,
                callsOverThirtySeconds: 1,
                connectedCallsOverThirtySeconds: 0,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 30
              }
            ]
          },
          callsHourlyHeatmap: expect.any(Object),
          stageBreakdown: [
            {
              stageId: "C10:PREPARATION",
              stageName: "Звонок-знакомство",
              dealCount: 1,
              totalCalls: 2,
              incomingCalls: 1,
              missedIncomingCalls: 1,
              outgoingCalls: 0,
              otherOutgoingCalls: 0,
              connectedCalls: 1,
              failedCalls: 0,
              callsOverThirtySeconds: 1,
              connectedCallsOverThirtySeconds: 0,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 30
            }
          ]
        },
        {
          managerId: "99",
          managerName: "Ольга Без звонков",
          dealCount: 0,
          totalCalls: 0,
          incomingCalls: 0,
          missedIncomingCalls: 0,
          outgoingCalls: 0,
          otherOutgoingCalls: 0,
          connectedCalls: 0,
          failedCalls: 0,
          callsOverThirtySeconds: 0,
          connectedCallsOverThirtySeconds: 0,
          averageCallsPerDeal: 0,
          averageDurationSeconds: 0,
          allCalls: {
            totalCalls: 0,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 0,
            failedCalls: 0,
            callsOverThirtySeconds: 0,
            connectedCallsOverThirtySeconds: 0,
            averageDurationSeconds: 0
          },
          linkedDealCalls: {
            dealCount: 0,
            totalCalls: 0,
            incomingCalls: 0,
            missedIncomingCalls: 0,
            outgoingCalls: 0,
            otherOutgoingCalls: 0,
            connectedCalls: 0,
            failedCalls: 0,
            callsOverThirtySeconds: 0,
            connectedCallsOverThirtySeconds: 0,
            averageCallsPerDeal: 0,
            averageDurationSeconds: 0,
            stageBreakdown: []
          },
          callsHourlyHeatmap: expect.any(Object),
          stageBreakdown: []
        }
      ]
    });
  });
});
