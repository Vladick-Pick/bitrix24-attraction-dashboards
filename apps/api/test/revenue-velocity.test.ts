import { describe, expect, it } from "vitest";

import { buildRevenueVelocityReport } from "../src/domain/revenue-velocity";

const range = {
  from: "2026-04-01T00:00:00.000Z",
  to: "2026-04-30T23:59:59.999Z"
};

const asOf = "2026-05-15T00:00:00.000Z";

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
    statusId: "C10:ACTIVATION",
    name: "Активация",
    semanticId: "P",
    sortOrder: 20
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:DEMO",
    name: "Демонстрация",
    semanticId: "P",
    sortOrder: 30
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:CONTRACT",
    name: "Контрактация",
    semanticId: "P",
    sortOrder: 40
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:WON",
    name: "На передаче",
    semanticId: "S",
    sortOrder: 50
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:LOSE",
    name: "Корзина",
    semanticId: "F",
    sortOrder: 60
  }
];

const managerDirectory = [
  { id: "78", name: "Егоров Андрей" },
  { id: "91", name: "Орлова Марина" }
];

const sourceCatalog = [
  { key: "WEB", label: "Сайт" },
  { key: "PARTNER", label: "Партнёры" }
];

const baseDeal = {
  title: null,
  leadId: null,
  categoryId: "10",
  sourceId: "WEB",
  qualityValue: "A",
  businessClubValue: "Club One",
  targetGroupValue: null,
  meetingTypeValue: null,
  meetingDateValue: null,
  tariffValue: "Premium",
  refusalReasonValue: null,
  refusalReasonDetail: null,
  dateModify: "2026-04-20T00:00:00.000Z",
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null
};

function createReport(overrides: Partial<Parameters<typeof buildRevenueVelocityReport>[0]> = {}) {
  return buildRevenueVelocityReport({
    range,
    asOf,
    dimension: "manager",
    wonStageIds: ["C10:WON"],
    deals: [],
    stageCatalog,
    stageHistory: [],
    activities: [],
    calls: [],
    conversionEvents: [],
    managerDirectory,
    sourceCatalog,
    ...overrides
  });
}

describe("buildRevenueVelocityReport", () => {
  it("calculates cohort revenue velocity, money per action, weighted actions and conversion-event stages", () => {
    const report = createReport({
      deals: [
        {
          ...baseDeal,
          id: "D1",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          assignedById: "78",
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-11T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D2",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 200000,
          assignedById: "78",
          dateCreate: "2026-04-02T00:00:00.000Z",
          dateClosed: "2026-04-22T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D3",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 50000,
          assignedById: "91",
          sourceId: "PARTNER",
          businessClubValue: "Club Two",
          dateCreate: "2026-04-03T00:00:00.000Z",
          dateClosed: "2026-04-18T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D4",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          opportunity: 75000,
          assignedById: "78",
          dateCreate: "2026-04-04T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "D5",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 900000,
          assignedById: "78",
          dateCreate: "2026-03-31T00:00:00.000Z",
          dateClosed: "2026-04-05T00:00:00.000Z"
        }
      ],
      stageHistory: [
        {
          id: "H1",
          ownerId: "D1",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-05T00:00:00.000Z"
        },
        {
          id: "H2",
          ownerId: "D2",
          categoryId: "10",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-10T00:00:00.000Z"
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
          createdTime: "2026-04-01T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-02T00:00:00.000Z",
          completed: true,
          completedTime: "2026-04-02T00:00:00.000Z"
        },
        {
          id: "A2",
          ownerTypeId: "2",
          ownerId: "D2",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-03T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-03T12:00:00.000Z",
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
          createdTime: "2026-04-06T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-06T13:00:00.000Z",
          completed: true,
          completedTime: "2026-04-06T13:00:00.000Z"
        },
        {
          id: "A4",
          ownerTypeId: "2",
          ownerId: "D2",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-04-11T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-11T13:00:00.000Z",
          completed: true,
          completedTime: "2026-04-11T13:00:00.000Z"
        },
        {
          id: "A5",
          ownerTypeId: "2",
          ownerId: "D3",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "91",
          createdTime: "2026-04-08T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-08T13:00:00.000Z",
          completed: true,
          completedTime: "2026-04-08T13:00:00.000Z"
        },
        {
          id: "A6",
          ownerTypeId: "2",
          ownerId: "D5",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-04-02T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-02T13:00:00.000Z",
          completed: true,
          completedTime: "2026-04-02T13:00:00.000Z"
        }
      ],
      calls: [
        {
          id: "C1",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-05T12:00:00.000Z",
          callDurationSeconds: 80,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        },
        {
          id: "C2",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-06T12:00:00.000Z",
          callDurationSeconds: 45,
          crmEntityType: "DEAL",
          crmEntityId: "D2",
          callFailedCode: null
        },
        {
          id: "C3",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-07T12:00:00.000Z",
          callDurationSeconds: 20,
          crmEntityType: "DEAL",
          crmEntityId: "D2",
          callFailedCode: "200"
        },
        {
          id: "C4",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-08T12:00:00.000Z",
          callDurationSeconds: 120,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "NO_ANSWER"
        },
        {
          id: "C5",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-02T12:00:00.000Z",
          callDurationSeconds: 100,
          crmEntityType: "DEAL",
          crmEntityId: "D5",
          callFailedCode: "200"
        }
      ],
      conversionEvents: [
        {
          id: "E1",
          dealId: "D1",
          eventTypeKey: "club_visit",
          eventTypeLabel: "Визит в клуб",
          occurredAt: "2026-04-05T12:00:00.000Z",
          managerId: "78",
          stageIdAtEvent: "C10:ACTIVATION",
          stageNameAtEvent: "Активация",
          businessClubValue: "Club One",
          sourceKey: "WEB",
          participantsCount: 1
        },
        {
          id: "E2",
          dealId: "D2",
          eventTypeKey: "demo",
          eventTypeLabel: "Демо",
          occurredAt: "2026-04-10T12:00:00.000Z",
          managerId: "78",
          stageIdAtEvent: "C10:DEMO",
          stageNameAtEvent: "Демонстрация",
          businessClubValue: "Club One",
          sourceKey: "WEB",
          participantsCount: 1
        },
        {
          id: "E3",
          dealId: "D1",
          eventTypeKey: "contract",
          eventTypeLabel: "Контракт",
          occurredAt: "2026-04-09T12:00:00.000Z",
          managerId: "78",
          stageIdAtEvent: "C10:CONTRACT",
          stageNameAtEvent: "Контрактация",
          businessClubValue: "Club One",
          sourceKey: "WEB",
          participantsCount: 1
        },
        {
          id: "E4",
          dealId: "D5",
          eventTypeKey: "club_visit",
          eventTypeLabel: "Визит в клуб",
          occurredAt: "2026-04-02T12:00:00.000Z",
          managerId: "78",
          stageIdAtEvent: "C10:ACTIVATION",
          stageNameAtEvent: "Активация",
          businessClubValue: "Club One",
          sourceKey: "WEB",
          participantsCount: 1
        }
      ]
    });

    expect(report.totals.createdDeals).toBe(4);
    expect(report.totals.wonDeals).toBe(2);
    expect(report.totals.lostDeals).toBe(1);
    expect(report.totals.wipDeals).toBe(1);
    expect(report.totals.salesAmount).toBe(300000);
    expect(report.totals.averageCheck).toBe(150000);
    expect(report.totals.winRate).toBe(0.5);
    expect(report.totals.averageCycleDays).toBe(15);
    expect(report.totals.medianCycleDays).toBe(15);
    expect(report.totals.revenueVelocityPerDay).toBe(20000);
    expect(report.totals.actions.conversionEventsCount).toBe(2);
    expect(report.totals.actions.connectedCallsOverThirtySeconds).toBe(2);
    expect(report.totals.actions.meetingsCount).toBe(2);
    expect(report.totals.actions.closedTasks).toBe(2);
    expect(report.totals.actions.weightedActionPoints).toBe(19);
    expect(report.totals.moneyPerAction.moneyPerWeightedActionPoint).toBe(15789.47);

    const managerRow = report.rows.find((row) => row.managerId === "78");
    expect(managerRow).toMatchObject({
      key: "78",
      label: "Егоров Андрей",
      managerName: "Егоров Андрей",
      createdDeals: 3,
      wonDeals: 2,
      lostDeals: 0,
      wipDeals: 1,
      salesAmount: 300000,
      averageCheck: 150000,
      winRate: 0.67,
      averageCycleDays: 15,
      medianCycleDays: 15,
      revenueVelocityPerDay: 20000
    });
    expect(managerRow?.actions).toMatchObject({
      totalCalls: 4,
      connectedCallsOverThirtySeconds: 2,
      meetingsCount: 2,
      conversionEventsCount: 2,
      createdTasks: 2,
      closedTasks: 1,
      weightedActionPoints: 18.5,
      weightedActionPointsPerDeal: 6.17,
      weightedActionPointsPerWin: 9.25
    });
    expect(managerRow?.moneyPerAction).toMatchObject({
      moneyPerMeeting: 150000,
      moneyPerConnectedCallOverThirtySeconds: 150000,
      moneyPerConversionEvent: 150000,
      moneyPerClosedTask: 300000,
      moneyPerWeightedActionPoint: 16216.22,
      actionEfficiencyIndex: 102.7
    });
  });

  it("groups by source, customer and combined dimensions", () => {
    const deals = [
      {
        ...baseDeal,
        id: "D1",
        assignedById: "78",
        sourceId: "WEB",
        businessClubValue: "Club One",
        stageId: "C10:WON",
        stageSemanticId: "S",
        opportunity: 100000,
        dateCreate: "2026-04-01T00:00:00.000Z",
        dateClosed: "2026-04-11T00:00:00.000Z"
      },
      {
        ...baseDeal,
        id: "D2",
        assignedById: "91",
        sourceId: "PARTNER",
        businessClubValue: "",
        stageId: "C10:DEMO",
        stageSemanticId: "P",
        opportunity: 50000,
        dateCreate: "2026-04-02T00:00:00.000Z",
        dateClosed: null
      }
    ];

    expect(
      createReport({ deals, dimension: "source" }).rows.map((row) => ({
        key: row.key,
        label: row.label,
        sourceLabel: row.sourceLabel
      }))
    ).toEqual([
      { key: "WEB", label: "Сайт", sourceLabel: "Сайт" },
      { key: "PARTNER", label: "Партнёры", sourceLabel: "Партнёры" }
    ]);

    expect(
      createReport({ deals, dimension: "customer" }).rows.map((row) => ({
        key: row.key,
        label: row.label,
        customerLabel: row.customerLabel
      }))
    ).toEqual([
      { key: "Club One", label: "Club One", customerLabel: "Club One" },
      {
        key: "unknown",
        label: "Без клуба / заказчика",
        customerLabel: "Без клуба / заказчика"
      }
    ]);

    expect(
      createReport({ deals, dimension: "managerSource" }).rows.map((row) => ({
        key: row.key,
        label: row.label
      }))
    ).toEqual([
      { key: "78::WEB", label: "Егоров Андрей / Сайт" },
      { key: "91::PARTNER", label: "Орлова Марина / Партнёры" }
    ]);

    expect(
      createReport({ deals, dimension: "sourceCustomer" }).rows.map((row) => ({
        key: row.key,
        label: row.label
      }))
    ).toEqual([
      { key: "WEB::Club One", label: "Сайт / Club One" },
      { key: "PARTNER::unknown", label: "Партнёры / Без клуба / заказчика" }
    ]);

    expect(
      createReport({ deals, dimension: "managerCustomer" }).rows.map((row) => ({
        key: row.key,
        label: row.label
      }))
    ).toEqual([
      { key: "78::Club One", label: "Егоров Андрей / Club One" },
      { key: "91::unknown", label: "Орлова Марина / Без клуба / заказчика" }
    ]);
  });

  it("applies filters and returns null for zero denominators instead of NaN or Infinity", () => {
    const report = createReport({
      filters: {
        managerIds: ["78"],
        sourceKeys: ["WEB"],
        customerKeys: ["unknown"],
        qualityKeys: ["B"],
        tariffKeys: ["Base"]
      },
      deals: [
        {
          ...baseDeal,
          id: "D1",
          assignedById: "78",
          sourceId: "WEB",
          qualityValue: "B",
          businessClubValue: null,
          tariffValue: "Base",
          stageId: "C10:DEMO",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "D2",
          assignedById: "91",
          sourceId: "PARTNER",
          qualityValue: "B",
          businessClubValue: null,
          tariffValue: "Base",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 200000,
          dateCreate: "2026-04-02T00:00:00.000Z",
          dateClosed: "2026-04-10T00:00:00.000Z"
        }
      ]
    });

    expect(report.totals.createdDeals).toBe(1);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.managerId).toBe("78");
    expect(report.totals.wonDeals).toBe(0);
    expect(report.totals.averageCheck).toBeNull();
    expect(report.totals.averageCycleDays).toBeNull();
    expect(report.totals.revenueVelocityPerDay).toBeNull();
    expect(report.totals.moneyPerAction.moneyPerMeeting).toBeNull();
    expect(report.totals.moneyPerAction.moneyPerConnectedCallOverThirtySeconds).toBeNull();
    expect(report.totals.moneyPerAction.moneyPerConversionEvent).toBeNull();
    expect(report.totals.moneyPerAction.moneyPerClosedTask).toBeNull();
    expect(report.totals.moneyPerAction.moneyPerWeightedActionPoint).toBeNull();
    expect(report.totals.moneyPerAction.actionEfficiencyIndex).toBeNull();
  });

  it("warns when conversion-event stage cannot be resolved", () => {
    const report = createReport({
      deals: [
        {
          ...baseDeal,
          id: "D1",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-11T00:00:00.000Z"
        }
      ],
      conversionEvents: [
        {
          id: "E1",
          dealId: "D1",
          eventTypeKey: "club_visit",
          eventTypeLabel: "Визит в клуб",
          occurredAt: "2026-04-05T12:00:00.000Z",
          managerId: "78",
          stageIdAtEvent: null,
          stageNameAtEvent: null
        }
      ]
    });

    expect(report.totals.actions.conversionEventsCount).toBe(0);
    expect(report.warnings).toContain(
      "Часть конверсионных мероприятий не учтена: не удалось определить этап сделки на момент события."
    );
  });
});
