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
    statusId: "C10:RETURN",
    name: "Возврат в лидген",
    semanticId: "P",
    sortOrder: 45
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
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:NONQUAL",
    name: "Неквал",
    semanticId: "F",
    sortOrder: 70
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:REFUSAL",
    name: "Отказ",
    semanticId: "F",
    sortOrder: 80
  },
  {
    entityType: "deal" as const,
    categoryId: "10",
    statusId: "C10:HANDOFF",
    name: "Передано в клуб",
    semanticId: "S",
    sortOrder: 90
  }
];

const managerDirectory = [
  { id: "78", name: "Егоров Андрей" },
  { id: "91", name: "Орлова Марина" },
  { id: "107", name: "Потапова Анна" }
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
    view: "createdCohort",
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
  it("counts period sales by won stage transition for Potapova even when the deal was created earlier", () => {
    const report = createReport({
      view: "systemState",
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      asOf: "2026-04-26T23:59:59.999Z",
      deals: [
        {
          ...baseDeal,
          id: "POTAPOVA_OLD_WIN",
          assignedById: "107",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 420000,
          dateCreate: "2026-03-18T00:00:00.000Z",
          dateClosed: null
        }
      ],
      stageHistory: [
        {
          id: "H_POTAPOVA_ACT",
          ownerId: "POTAPOVA_OLD_WIN",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-10T00:00:00.000Z"
        },
        {
          id: "H_POTAPOVA_WON",
          ownerId: "POTAPOVA_OLD_WIN",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-22T12:00:00.000Z"
        }
      ]
    });

    const potapova = report.rows.find((row) => row.managerId === "107");

    expect(report.totals.wonDealsInPeriod).toBe(1);
    expect(report.totals.realizedWonAmountInPeriod).toBe(420000);
    expect(potapova?.label).toBe("Потапова Анна");
    expect(potapova?.wonDealsInPeriod).toBe(1);
    expect(potapova?.realizedWonAmountInPeriod).toBe(420000);
  });

  it("uses clean active stages for active and WIP pipeline", () => {
    const report = createReport({
      view: "systemState",
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      asOf: "2026-04-26T23:59:59.999Z",
      deals: [
        {
          ...baseDeal,
          id: "ACTIVE",
          assignedById: "78",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "RETURN",
          assignedById: "78",
          stageId: "C10:RETURN",
          stageSemanticId: "P",
          opportunity: 200000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "BASKET",
          assignedById: "78",
          stageId: "C10:LOSE",
          stageSemanticId: "F",
          opportunity: 300000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "NONQUAL",
          assignedById: "78",
          stageId: "C10:NONQUAL",
          stageSemanticId: "F",
          opportunity: 400000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "REFUSAL",
          assignedById: "78",
          stageId: "C10:REFUSAL",
          stageSemanticId: "F",
          opportunity: 500000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "HANDOFF",
          assignedById: "78",
          stageId: "C10:HANDOFF",
          stageSemanticId: "S",
          opportunity: 600000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        }
      ]
    });

    expect(report.totals.activeDeals).toBe(1);
    expect(report.totals.wipDeals).toBe(1);
    expect(report.totals.activePipelineAmount).toBe(100000);
  });

  it("does not default expected pipeline and live velocity to 50 percent when probability is not calibrated", () => {
    const report = createReport({
      view: "systemState",
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      asOf: "2026-04-26T23:59:59.999Z",
      deals: [
        {
          ...baseDeal,
          id: "ACTIVE_UNCALIBRATED",
          assignedById: "78",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          opportunity: 200000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        }
      ],
      stageHistory: []
    });

    expect(report.totals.activePipelineAmount).toBe(200000);
    expect(report.totals.expectedPipelineAmount).toBeNull();
    expect(report.totals.liveRevenueVelocity).toBeNull();
    expect(report.warnings).toContain("Недостаточно данных для вероятностной оценки воронки.");
  });

  it("never returns basket or leadgen return stages as bottlenecks", () => {
    const report = createReport({
      view: "createdCohort",
      deals: [
        {
          ...baseDeal,
          id: "RETURN_1",
          assignedById: "78",
          stageId: "C10:RETURN",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: null
        },
        {
          ...baseDeal,
          id: "RETURN_2",
          assignedById: "78",
          stageId: "C10:RETURN",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-02T00:00:00.000Z",
          dateClosed: null
        }
      ],
      stageHistory: [
        {
          id: "H_RETURN_1_ACT",
          ownerId: "RETURN_1",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "H_RETURN_1_RETURN",
          ownerId: "RETURN_1",
          categoryId: "10",
          stageId: "C10:RETURN",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-08T00:00:00.000Z"
        },
        {
          id: "H_RETURN_2_ACT",
          ownerId: "RETURN_2",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-02T00:00:00.000Z"
        },
        {
          id: "H_RETURN_2_RETURN",
          ownerId: "RETURN_2",
          categoryId: "10",
          stageId: "C10:RETURN",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-09T00:00:00.000Z"
        }
      ]
    });

    expect(report.totals.bottleneckStageName).not.toBe("Возврат в лидген");
    expect(report.totals.bottleneckStageName).not.toBe("Корзина");
  });

  it("builds system state from active pipeline even when the week has no new deals or wins", () => {
    const report = createReport({
      view: "systemState",
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      asOf: "2026-04-26T23:59:59.999Z",
      deals: [
        {
          ...baseDeal,
          id: "BENCH",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-11T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "ACTIVE",
          assignedById: "78",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          opportunity: 250000,
          dateCreate: "2026-03-15T00:00:00.000Z",
          dateClosed: null
        }
      ],
      stageHistory: [
        {
          id: "H_BENCH_ACT",
          ownerId: "BENCH",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "H_BENCH_WON",
          ownerId: "BENCH",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-11T00:00:00.000Z"
        },
        {
          id: "H_ACTIVE_ACT",
          ownerId: "ACTIVE",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-15T00:00:00.000Z"
        }
      ]
    });

    expect(report.view).toBe("systemState");
    expect(report.previousAsOf).toBe("2026-04-19T23:59:59.999Z");
    expect(report.totals.createdDeals).toBe(0);
    expect(report.totals.wonDealsInPeriod).toBe(0);
    expect(report.totals.realizedWonAmountInPeriod).toBe(0);
    expect(report.totals.activeDeals).toBe(1);
    expect(report.totals.activePipelineAmount).toBe(250000);
    expect(report.totals.expectedPipelineAmount).toBeNull();
    expect(report.totals.liveRevenueVelocity).toBeNull();
  });

  it("calculates system value, velocity delta and period actions for old wins and current pipeline", () => {
    const weeklyRange = {
      from: "2026-04-20T00:00:00.000Z",
      to: "2026-04-26T23:59:59.999Z"
    };
    const report = createReport({
      view: "systemState",
      range: weeklyRange,
      asOf: weeklyRange.to,
      deals: [
        {
          ...baseDeal,
          id: "BENCH",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-11T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "OLD_WIN",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 300000,
          dateCreate: "2026-03-20T00:00:00.000Z",
          dateClosed: "2026-04-22T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "CURRENT_ONLY",
          assignedById: "78",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          opportunity: 100000,
          dateCreate: "2026-04-23T00:00:00.000Z",
          dateClosed: null
        }
      ],
      stageHistory: [
        {
          id: "H_BENCH_ACT",
          ownerId: "BENCH",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "H_BENCH_WON",
          ownerId: "BENCH",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-11T00:00:00.000Z"
        },
        {
          id: "H_OLD_ACT",
          ownerId: "OLD_WIN",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "H_OLD_WON",
          ownerId: "OLD_WIN",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-22T00:00:00.000Z"
        },
        {
          id: "H_CURRENT_ACT",
          ownerId: "CURRENT_ONLY",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-23T00:00:00.000Z"
        }
      ],
      activities: [
        {
          id: "M_CURRENT",
          ownerTypeId: "2",
          ownerId: "CURRENT_ONLY",
          typeId: "1",
          providerId: "CRM_MEETING",
          responsibleId: "78",
          createdTime: "2026-04-24T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-24T12:30:00.000Z",
          completed: true,
          completedTime: "2026-04-24T12:30:00.000Z"
        },
        {
          id: "T_CURRENT",
          ownerTypeId: "2",
          ownerId: "CURRENT_ONLY",
          typeId: "6",
          providerId: "CRM_TODO",
          responsibleId: "78",
          createdTime: "2026-04-24T12:00:00.000Z",
          deadline: null,
          lastUpdated: "2026-04-25T12:00:00.000Z",
          completed: true,
          completedTime: "2026-04-25T12:00:00.000Z"
        }
      ],
      calls: [
        {
          id: "CALL_PREVIOUS",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-15T12:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "OLD_WIN",
          callFailedCode: "200"
        },
        {
          id: "CALL_CURRENT",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-24T12:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "CURRENT_ONLY",
          callFailedCode: "200"
        }
      ]
    });

    expect(report.totals.realizedWonAmountInPeriod).toBe(300000);
    expect(report.totals.wonDealsInPeriod).toBe(1);
    expect(report.totals.activePipelineAmount).toBe(100000);
    expect(report.totals.expectedPipelineAmount).toBe(100000);
    expect(report.totals.previousExpectedPipelineAmount).toBe(300000);
    expect(report.totals.expectedPipelineDelta).toBe(-200000);
    expect(report.totals.systemValueCreated).toBe(100000);
    expect(report.totals.velocityDelta).toBe(
      Number(((report.totals.liveRevenueVelocity ?? 0) - (report.totals.previousLiveRevenueVelocity ?? 0)).toFixed(2))
    );
    expect(report.totals.actions.connectedCallsOverThirtySeconds).toBe(1);
    expect(report.totals.actions.meetingsCount).toBe(1);
    expect(report.totals.actions.closedTasks).toBe(1);
    expect(report.totals.actions.weightedActionPoints).toBe(4.5);
    expect(report.totals.actionPointsDelta).toBe(3.5);
    expect(report.totals.systemValuePerActionPoint).toBe(22222.22);
    expect(report.totals.realizedMoneyPerActionPoint).toBe(66666.67);
  });

  it("treats deals closed after previous as-of as previous active pipeline from stage history", () => {
    const report = createReport({
      view: "systemState",
      range: {
        from: "2026-04-20T00:00:00.000Z",
        to: "2026-04-26T23:59:59.999Z"
      },
      asOf: "2026-04-26T23:59:59.999Z",
      stageHistory: [
        {
          id: "H_OLD_WIN_NO_HISTORY_ACT",
          ownerId: "OLD_WIN_NO_HISTORY",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-03-20T00:00:00.000Z"
        },
        {
          id: "H_OLD_WIN_NO_HISTORY_WON",
          ownerId: "OLD_WIN_NO_HISTORY",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-22T00:00:00.000Z"
        },
        {
          id: "H_BENCH_ACT",
          ownerId: "BENCH_FOR_PREVIOUS",
          categoryId: "10",
          stageId: "C10:ACTIVATION",
          stageSemanticId: "P",
          typeId: null,
          createdTime: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "H_BENCH_WON",
          ownerId: "BENCH_FOR_PREVIOUS",
          categoryId: "10",
          stageId: "C10:WON",
          stageSemanticId: "S",
          typeId: null,
          createdTime: "2026-04-10T00:00:00.000Z"
        }
      ],
      deals: [
        {
          ...baseDeal,
          id: "OLD_WIN_NO_HISTORY",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 300000,
          dateCreate: "2026-03-20T00:00:00.000Z",
          dateClosed: "2026-04-22T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "BENCH_FOR_PREVIOUS",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-10T00:00:00.000Z"
        }
      ]
    });

    expect(report.totals.realizedWonAmountInPeriod).toBe(300000);
    expect(report.totals.previousExpectedPipelineAmount).toBe(300000);
    expect(report.totals.expectedPipelineDelta).toBe(-300000);
    expect(report.totals.systemValueCreated).toBe(0);
  });

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

  it("keeps createdCohort on dateCreate and ignores post-close lifetime actions", () => {
    const report = createReport({
      view: "createdCohort",
      deals: [
        {
          ...baseDeal,
          id: "D1",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 100000,
          dateCreate: "2026-04-01T00:00:00.000Z",
          dateClosed: "2026-04-10T00:00:00.000Z"
        },
        {
          ...baseDeal,
          id: "D2",
          assignedById: "78",
          stageId: "C10:WON",
          stageSemanticId: "S",
          opportunity: 500000,
          dateCreate: "2026-03-01T00:00:00.000Z",
          dateClosed: "2026-04-05T00:00:00.000Z"
        }
      ],
      calls: [
        {
          id: "PRE_CLOSE",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-09T12:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        },
        {
          id: "POST_CLOSE",
          crmActivityId: null,
          portalUserId: "78",
          callType: "1",
          callStartDate: "2026-04-11T12:00:00.000Z",
          callDurationSeconds: 60,
          crmEntityType: "DEAL",
          crmEntityId: "D1",
          callFailedCode: "200"
        }
      ]
    });

    expect(report.view).toBe("createdCohort");
    expect(report.totals.createdDeals).toBe(1);
    expect(report.totals.salesAmount).toBe(100000);
    expect(report.totals.actions.totalCalls).toBe(1);
    expect(report.totals.actions.connectedCallsOverThirtySeconds).toBe(1);
  });
});
