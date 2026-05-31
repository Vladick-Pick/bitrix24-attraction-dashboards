import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  AttractionOntologyResponse,
  CallsWorkloadReport,
  CohortConversionReport,
  ConversionEventsReport,
  DashboardData,
  ManagerActionOutcomeReport,
  RevenueVelocityReport,
  SalesPlanData,
  SalesPlanQuarterData,
  SourceQualityConversionReport,
  StageCatalogEntry,
  TargetGroupConversionReport,
  TocFlowReport
} from "@bitrix24-reporting/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/server/app";

const emptyCallPopulation = {
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
};

const emptyLinkedDealCalls = {
  ...emptyCallPopulation,
  totalDealCount: 0
};

const emptySnapshotStats = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};

const emptyDealBreakdown = {
  total: 0,
  created: 0,
  updated: 0,
  closed: 0,
  reopened: 0,
  unchanged: 0
};

const emptySyncChanges = {
  deals: 0,
  dealBreakdown: emptyDealBreakdown,
  activities: 0,
  calls: 0,
  stageHistory: 0,
  managers: 0
};

const emptyAttractionOntology: AttractionOntologyResponse = {
  moduleKey: "attraction",
  title: "Онтология Привлечения",
  governance: {
    decisionRole: "Технолог бизнес-процессов",
    decisionUnit: "Центр Технологизации"
  },
  lastReviewedAt: "2026-05-29",
  sources: [],
  concepts: [],
  transitions: [],
  reportBindings: [],
  drift: []
};

const emptyAttractionOntologySourceDocument = {
  moduleKey: "attraction" as const,
  source: {
    id: "module_ontology",
    label: "MODULE_ONTOLOGY.md",
    kind: "markdown" as const,
    href: "docs/modules/attraction/MODULE_ONTOLOGY.md",
    canonicality: "canonical" as const
  },
  content: "# Онтология модуля «Привлечение»"
};

function createEmptyRevenueVelocityReport(): RevenueVelocityReport {
  return {
    range: {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-30T23:59:59.999Z"
    },
    asOf: "2026-04-30T23:59:59.999Z",
    previousAsOf: null,
    dimension: "manager",
    view: "systemState",
    actionWeights: {
      connectedCallOverThirtySeconds: 1,
      meeting: 3,
      conversionEvent: 5,
      closedTask: 0.5
    },
    totals: {
      dimension: "manager",
      view: "systemState",
      key: "total",
      label: "Итого",
      managerId: null,
      managerName: null,
      sourceKey: null,
      sourceLabel: null,
      customerKey: null,
      customerLabel: null,
      createdDeals: 0,
      activeDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      wipDeals: 0,
      salesAmount: 0,
      averageCheck: null,
      winRate: null,
      averageCycleDays: null,
      medianCycleDays: null,
      revenueVelocityPerDay: null,
      activePipelineAmount: 0,
      expectedPipelineAmount: 0,
      previousExpectedPipelineAmount: null,
      expectedPipelineDelta: null,
      liveRevenueVelocity: null,
      previousLiveRevenueVelocity: null,
      velocityDelta: null,
      velocityDeltaPercent: null,
      averageRemainingDays: null,
      realizedWonAmountInPeriod: 0,
      wonDealsInPeriod: 0,
      lostDealsInPeriod: 0,
      systemValueCreated: null,
      actionPointsDelta: null,
      systemValuePerActionPoint: null,
      realizedMoneyPerActionPoint: null,
      historicalMoneyPerActionPoint: null,
      estimatedFutureMoneyFromPeriodActions: null,
      actions: {
        totalCalls: 0,
        connectedCallsOverThirtySeconds: 0,
        meetingsCount: 0,
        conversionEventsCount: 0,
        createdTasks: 0,
        closedTasks: 0,
        weightedActionPoints: 0,
        weightedActionPointsPerDeal: null,
        weightedActionPointsPerWin: null
      },
      moneyPerAction: {
        moneyPerMeeting: null,
        moneyPerConnectedCallOverThirtySeconds: null,
        moneyPerConversionEvent: null,
        moneyPerClosedTask: null,
        moneyPerWeightedActionPoint: null,
        actionEfficiencyIndex: null
      },
      bottleneckStageId: null,
      bottleneckStageName: null,
      warnings: []
    },
    rows: [],
    formulaTooltips: [],
    warnings: []
  };
}

function createSyncSummary(
  overrides: Partial<{
    syncRunId: number;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    modifiedAfter: string | null;
    finishedAt: string;
  }> = {}
) {
  return {
    syncRunId: 1,
    leadsSynced: 0,
    dealsSynced: 0,
    mode: "delta" as const,
    modifiedAfter: null,
    finishedAt: "2026-04-09T00:00:00.000Z",
    snapshotBefore: emptySnapshotStats,
    snapshotAfter: emptySnapshotStats,
    changes: emptySyncChanges,
    diagnostics: [],
    ...overrides
  };
}

function createEmptySalesPlanQuarter(input: { year: number; quarter: number }) {
  return {
    year: input.year,
    quarter: input.quarter,
    periodStart: "2026-04-01T00:00:00.000+03:00",
    periodEnd: "2026-06-30T23:59:59.999+03:00",
    months: [
      {
        month: "2026-04",
        label: "Апрель",
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00"
      },
      {
        month: "2026-05",
        label: "Май",
        periodStart: "2026-05-01T00:00:00.000+03:00",
        periodEnd: "2026-05-31T23:59:59.999+03:00"
      },
      {
        month: "2026-06",
        label: "Июнь",
        periodStart: "2026-06-01T00:00:00.000+03:00",
        periodEnd: "2026-06-30T23:59:59.999+03:00"
      }
    ],
    rows: [],
    updatedAt: null
  };
}

function createTestApp(
  serviceOverrides: Partial<Parameters<typeof createApp>[0]> = {},
  config?: {
    webOrigin?: string;
    apiAuthToken?: string;
    syncStreamHeartbeatMs?: number;
    modules?: Record<string, Partial<Parameters<typeof createApp>[0]>>;
    protoComments?: {
      getProtoComments(): Promise<{
        comments: unknown[];
        updatedAt: string | null;
      }>;
      replaceProtoComments(input: {
        comments: unknown[];
        updatedAt: string;
      }): Promise<{
        comments: unknown[];
        updatedAt: string | null;
      }>;
    };
  }
) {
  const service: Parameters<typeof createApp>[0] = {
    getDashboard: async () => ({
      salesSummary: {
        salesCount: 0,
        salesAmount: 0,
        averageSaleAmount: 0,
        attractionRevenueAmount: 0,
        averageAttractionRevenueAmount: 0,
        membershipAmount: 0,
        averageMembershipAmount: 0,
        pricingWarnings: [],
        newDealsCount: 0,
        conversionRate: 0
      },
      managerGroups: []
    }),
    getSalesPlan: async () => ({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      rows: [],
      updatedAt: null
    }),
    replaceSalesPlan: async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: input.rows.map((row) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        plannedDeals: row.plannedDeals,
        plannedAmount: row.plannedAmount,
        updatedAt: "2026-04-10T12:00:00.000Z"
      })),
      updatedAt: "2026-04-10T12:00:00.000Z"
    }),
    getSalesPlanQuarter: async (input) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: [],
      updatedAt: null
    }),
    replaceSalesPlanQuarter: async (input) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: input.rows.map((row) => ({
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        quarterPlannedDeals: row.quarterPlannedDeals,
        quarterPlannedAmount: row.quarterPlannedAmount,
        months: row.months.map((month) => ({
          month: month.month,
          periodStart: `${month.month}-01T00:00:00.000+03:00`,
          periodEnd: `${month.month}-30T23:59:59.999+03:00`,
          plannedDeals: month.plannedDeals,
          plannedAmount: month.plannedAmount,
          updatedAt: "2026-04-10T12:00:00.000Z"
        })),
        updatedAt: "2026-04-10T12:00:00.000Z"
      })),
      updatedAt: "2026-04-10T12:00:00.000Z"
    }),
    getEffectiveSalesPlan: async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: [],
      updatedAt: null
    }),
    getSourceQualityConversionReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: [],
      stageSequence: []
    }),
    getActivitiesWorkloadReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: []
    }),
    getConversionEventsReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalInvitedCount: 0,
      totalConfirmedCount: 0,
      totalAttendedCount: 0,
      totalRefusedCount: 0,
      totalMissedCount: 0,
      attendanceRate: null,
      nextStepEligibleCount: 0,
      nextStepCount: 0,
      nextStepRate: null,
      warnings: [],
      rows: [],
      comparisons: []
    }),
    getCallsWorkloadReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 0,
      totalCalls: 0,
      totalIncomingCalls: 0,
      totalMissedIncomingCalls: 0,
      totalOutgoingCalls: 0,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 0,
      totalFailedCalls: 0,
      totalCallsOverThirtySeconds: 0,
      totalConnectedCallsOverThirtySeconds: 0,
      allCalls: emptyCallPopulation,
      linkedDealCalls: emptyLinkedDealCalls,
      warnings: [],
      managerRows: [],
      comparisons: []
    }),
    getCohortConversionReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 0,
      totalClosedDeals: 0,
      totalWonDeals: 0,
      closureMonths: [],
      relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
      rows: [],
      comparisons: []
    }),
    getTocFlowReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      businessDays: 0,
      warnings: [],
      estimatedGainPerDay: null,
      bottleneck: null,
      rows: [],
      comparisons: []
    }),
    getAcquisitionOutcomesReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalNewDeals: 0,
      totalLostDeals: 0,
      newDealsByManager: [],
      lostDealsByManager: [],
      lostStages: [],
      businessClubByManager: [],
      lostDealDetails: [],
      topLossReasons: []
    }),
    getTargetGroupConversionReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: []
    }),
    getManagerActionOutcomeReport: async () => ({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      warnings: [],
      rows: [],
      cohortMonths: [],
      cohortStatusRows: []
    }),
    getRevenueVelocityReport: async () => createEmptyRevenueVelocityReport(),
    getPricingSettings: async () => ({
      rules: [
        {
          id: "clubfirst-federal",
          customerLabel: "ClubFirst Russia / One",
          tariffLabel: "Федеральный",
          attractionRevenueAmount: 300000,
          enabled: true,
          sortOrder: 10,
          updatedAt: null
        }
      ],
      updatedAt: null
    }),
    replacePricingSettings: async (input) => ({
      rules: input.rules.map((rule, index) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder ?? index * 10,
        updatedAt: "2026-04-29T10:00:00.000Z"
      })),
      updatedAt: "2026-04-29T10:00:00.000Z"
    }),
    getAttractionOntology: async () => emptyAttractionOntology,
    getAttractionOntologySourceDocument: async () =>
      emptyAttractionOntologySourceDocument,
    getConversionEventTypeSettings: async () => ({
      options: [
        {
          id: "128",
          title: "Гостевая встреча",
          categoryId: null,
          stageId: null,
          selectedForPlannedInventory: true
        }
      ],
      settings: [
        {
          moduleKey: "attraction",
          eventTypeId: "128",
          eventTypeLabel: "Гостевая встреча",
          enabled: true,
          updatedAt: "2026-04-29T10:00:00.000Z"
        }
      ]
    }),
    replaceConversionEventTypeSettings: async (input) => ({
      options: input.eventTypeIds.map((id) => ({
        id,
        title: id,
        categoryId: null,
        stageId: null,
        selectedForPlannedInventory: true
      })),
      settings: input.eventTypeIds.map((id) => ({
        moduleKey: "attraction",
        eventTypeId: id,
        eventTypeLabel: id,
        enabled: true,
        updatedAt: "2026-04-29T10:00:00.000Z"
      }))
    }),
    getMeta: async () => ({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      wonStageIds: [],
      defaultPeriodDays: 30,
      lastSync: null,
      snapshotStats: emptySnapshotStats,
      syncHealth: {
        status: "ready" as const,
        blocking: false,
        checkedAt: "2026-04-09T00:00:00.000Z",
        lastSuccessfulSync: null,
        issues: [],
        warnings: []
      }
    }),
    performSync: async () => createSyncSummary(),
    updateWonStages: async (stageIds: string[]) => ({
      wonStageIds: stageIds
    }),
    ...serviceOverrides
  };

  return (
    createApp as unknown as (
      service: Parameters<typeof createApp>[0],
      config?: {
        webOrigin?: string;
        apiAuthToken?: string;
        syncStreamHeartbeatMs?: number;
        modules?: Record<string, Partial<Parameters<typeof createApp>[0]>>;
        protoComments?: {
          getProtoComments(): Promise<{
            comments: unknown[];
            updatedAt: string | null;
          }>;
          replaceProtoComments(input: {
            comments: unknown[];
            updatedAt: string;
          }): Promise<{
            comments: unknown[];
            updatedAt: string | null;
          }>;
        };
      }
    ) => ReturnType<typeof createApp>
  )(service, config);
}

describe("createApp", () => {
  it("reads and saves prototype comments with block anchors", async () => {
    let savedInput: { comments: unknown[]; updatedAt: string } | null = null;
    const app = createTestApp(undefined, {
      protoComments: {
        getProtoComments: async () => ({
          updatedAt: "2026-05-02T07:50:00.000Z",
          comments: [
            {
              id: "existing-comment",
              sceneId: "sales-report",
              x: 0.1,
              y: 0.2,
              text: "Старая заметка",
              status: "open",
              archivedAt: null,
              createdAt: "2026-05-02T07:40:00.000Z",
              updatedAt: "2026-05-02T07:50:00.000Z",
              anchor: {
                blockId: "sales-summary-card",
                blockLabel: "Выиграно",
                blockSelector: '[data-comment-block-id="sales-summary-card"]',
                blockRole: "section",
                elementSelector: "section:nth-of-type(2)",
                elementLabel: "Выиграно 1",
                relativeX: 0.1,
                relativeY: 0.2
              }
            }
          ]
        }),
        replaceProtoComments: async (input) => {
          savedInput = input;
          return {
            comments: input.comments,
            updatedAt: input.updatedAt
          };
        }
      }
    });

    await request(app)
      .get("/api/proto-comments")
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments[0].anchor.blockId).toBe("sales-summary-card");
      });

    await request(app)
      .post("/api/proto-comments")
      .send({
        comments: [
          {
            id: "new-comment",
            sceneId: "sales-report",
            x: 0.25,
            y: 0.5,
            text: "Проверить карточку продаж",
            status: "open",
            archivedAt: null,
            createdAt: "2026-05-02T08:00:00.000Z",
            updatedAt: "2026-05-02T08:00:00.000Z",
            anchor: {
              blockId: "sales-summary-card",
              blockLabel: "Выиграно",
              blockSelector: '[data-comment-block-id="sales-summary-card"]',
              blockRole: "section",
              elementSelector: "section:nth-of-type(2) > div:nth-of-type(1)",
              elementLabel: "Выиграно 1",
              relativeX: 0.1,
              relativeY: 0.2
            }
          }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.comments[0].anchor.blockLabel).toBe("Выиграно");
      });

    expect(savedInput).toEqual(
      expect.objectContaining({
        updatedAt: expect.stringMatching(/^20/),
        comments: [
          expect.objectContaining({
            id: "new-comment",
            anchor: expect.objectContaining({
              blockId: "sales-summary-card"
            })
          })
        ]
      })
    );
  });

  it("returns conversion events report", async () => {
    const app = createTestApp({
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 5,
        totalConfirmedCount: 0,
        totalAttendedCount: 2,
        totalRefusedCount: 1,
        totalMissedCount: 3,
        attendanceRate: 40,
        nextStepEligibleCount: 2,
        nextStepCount: 1,
        nextStepRate: 50,
        warnings: [],
        rows: [
          {
            eventKey: "Знакомство с клубом 29.04.|2026-04-29T00:00:00.000Z",
            eventName: "Знакомство с клубом 29.04.",
            eventDate: "2026-04-29T00:00:00.000Z",
            invitedCount: 5,
            confirmedCount: 0,
            attendedCount: 2,
            refusedCount: 1,
            missedCount: 3,
            attendanceRate: 40,
            nextStepEligibleCount: 2,
            nextStepCount: 1,
            nextStepRate: 50,
            unlinkedCount: 0,
            unknownStatusCount: 0,
            managerBreakdown: [],
            sourceBreakdown: [],
            businessClubBreakdown: []
          }
        ],
        comparisons: []
      })
    });

    await expect(
      request(app)
        .get(
          "/api/reports/conversion-events?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z"
        )
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        totalInvitedCount: 5,
        totalConfirmedCount: 0,
        rows: [
          {
            eventName: "Знакомство с клубом 29.04.",
            attendanceRate: 40,
            nextStepRate: 50
          }
        ]
      }
    });
  });

  it("reads and saves pricing settings", async () => {
    const app = createTestApp();

    await expect(
      request(app).get("/api/settings/pricing").expect(200)
    ).resolves.toMatchObject({
      body: {
        rules: [
          {
            id: "clubfirst-federal",
            attractionRevenueAmount: 300000
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/pricing")
        .send({
          rules: [
            {
              id: "clubfirst-federal",
              customerLabel: "ClubFirst Russia / One",
              tariffLabel: "Федеральный",
              attractionRevenueAmount: 310000,
              enabled: true,
              sortOrder: 10
            }
          ]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        rules: [
          {
            id: "clubfirst-federal",
            attractionRevenueAmount: 310000,
            updatedAt: "2026-04-29T10:00:00.000Z"
          }
        ],
        updatedAt: "2026-04-29T10:00:00.000Z"
      }
    });
  });

  it("reads and saves conversion event type settings", async () => {
    const app = createTestApp();

    await expect(
      request(app).get("/api/settings/conversion-event-types").expect(200)
    ).resolves.toMatchObject({
      body: {
        options: [
          {
            id: "128",
            title: "Гостевая встреча",
            selectedForPlannedInventory: true
          }
        ],
        settings: [
          {
            moduleKey: "attraction",
            eventTypeId: "128",
            enabled: true
          }
        ]
      }
    });

    await expect(
      request(app)
        .put("/api/settings/conversion-event-types")
        .send({
          eventTypeIds: ["128", "256"]
        })
        .expect(200)
    ).resolves.toMatchObject({
      body: {
        options: [
          {
            id: "128",
            selectedForPlannedInventory: true
          },
          {
            id: "256",
            selectedForPlannedInventory: true
          }
        ],
        settings: [
          {
            eventTypeId: "128",
            enabled: true
          },
          {
            eventTypeId: "256",
            enabled: true
          }
        ]
      }
    });
  });

  it("returns dashboard data, settings and sync status from the local API", async () => {
    let receivedActivitiesInput: unknown = null;
    let receivedRevenueVelocityInput: unknown = null;
    let receivedLeadgenFunnelInput: unknown = null;
    let receivedLeadgenActivitiesInput: unknown = null;
    let receivedLeadgenCallsInput: unknown = null;
    const dashboard: DashboardData = {
      salesSummary: {
        salesCount: 3,
        salesAmount: 45000,
        averageSaleAmount: 15000,
        attractionRevenueAmount: 45000,
        averageAttractionRevenueAmount: 15000,
        membershipAmount: 45000,
        averageMembershipAmount: 15000,
        pricingWarnings: [],
        newDealsCount: 7,
        conversionRate: 42.86
      },
      managerGroups: []
    };
    const stageCatalog: StageCatalogEntry[] = [
      {
        entityType: "deal",
        categoryId: "1",
        statusId: "C1:WON",
        name: "Won",
        semanticId: "S"
      }
    ];
    const sourceQualityReport: SourceQualityConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 4,
      totalWonDeals: 1,
      rows: [],
      stageSequence: []
    };
    const activitiesReport: ActivitiesWorkloadReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCreatedCount: 5,
      totalRescheduledCount: 0,
      totalClosedCount: 2,
      totalMeetingCount: 0,
      warnings: [],
      conversionEventRows: [],
      managerRows: [],
      comparisons: [
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
            totalCreatedCount: 2,
            totalRescheduledCount: 0,
            totalClosedCount: 1,
            totalMeetingCount: 0,
            warnings: [],
            conversionEventRows: [],
            managerRows: []
          }
        }
      ]
    };
    const callsReport: CallsWorkloadReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalDealCount: 2,
      totalCalls: 7,
      totalIncomingCalls: 3,
      totalMissedIncomingCalls: 0,
      totalOutgoingCalls: 4,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 6,
      totalFailedCalls: 1,
      totalCallsOverThirtySeconds: 4,
      totalConnectedCallsOverThirtySeconds: 4,
      allCalls: {
        ...emptyCallPopulation,
        totalCalls: 7,
        incomingCalls: 3,
        missedIncomingCalls: 0,
        outgoingCalls: 4,
        otherOutgoingCalls: 1,
        connectedCalls: 6,
        failedCalls: 1,
        callsOverThirtySeconds: 4,
        connectedCallsOverThirtySeconds: 4
      },
      linkedDealCalls: {
        ...emptyLinkedDealCalls,
        totalDealCount: 2,
        totalCalls: 7,
        incomingCalls: 3,
        missedIncomingCalls: 0,
        outgoingCalls: 4,
        otherOutgoingCalls: 1,
        connectedCalls: 6,
        failedCalls: 1,
        callsOverThirtySeconds: 4,
        connectedCallsOverThirtySeconds: 4
      },
      warnings: [],
      managerRows: []
    };
    const cohortReport: CohortConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 4,
      totalClosedDeals: 2,
      totalWonDeals: 1,
      closureMonths: ["2026-04"],
      relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
      rows: []
    };
    const tocReport: TocFlowReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      businessDays: 22,
      warnings: [],
      estimatedGainPerDay: null,
      bottleneck: null,
      rows: []
    };
    const acquisitionOutcomesReport: AcquisitionOutcomesReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalNewDeals: 3,
      totalLostDeals: 1,
      newDealsByManager: [],
      lostDealsByManager: [],
      lostStages: [],
      businessClubByManager: [],
      lostDealDetails: [],
      topLossReasons: []
    };
    const targetGroupConversionReport: TargetGroupConversionReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: []
    };
    const managerActionOutcomeReport: ManagerActionOutcomeReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      warnings: [],
      rows: [],
      cohortMonths: [],
      cohortStatusRows: []
    };
    const leadgenFunnelReport = {
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      totalDeals: 4,
      createdDeals: 3,
      activeDeals: 2,
      closedDeals: 1,
      stageRows: [],
      sourceRows: [],
      utmRows: [],
      managerRows: [],
      reasonRows: [],
      warnings: []
    };
    const revenueVelocityReport: RevenueVelocityReport = {
      ...createEmptyRevenueVelocityReport(),
      dimension: "source",
      view: "createdCohort",
      totals: {
        ...createEmptyRevenueVelocityReport().totals,
        dimension: "source",
        view: "createdCohort",
        createdDeals: 4,
        wonDeals: 1,
        salesAmount: 125000,
        averageCheck: 125000,
        winRate: 0.25,
        averageCycleDays: 10,
        medianCycleDays: 10,
        revenueVelocityPerDay: 12500
      },
      rows: [
        {
          ...createEmptyRevenueVelocityReport().totals,
          dimension: "source",
          view: "createdCohort",
          key: "WEB",
          label: "Сайт",
          sourceKey: "WEB",
          sourceLabel: "Сайт",
          createdDeals: 4,
          wonDeals: 1,
          salesAmount: 125000,
          averageCheck: 125000,
          winRate: 0.25,
          averageCycleDays: 10,
          medianCycleDays: 10,
          revenueVelocityPerDay: 12500
        }
      ]
    };
    const service: Parameters<typeof createApp>[0] = {
      getDashboard: async () => dashboard,
      getSourceQualityConversionReport: async () => sourceQualityReport,
      getActivitiesWorkloadReport: async (input: unknown) => {
        receivedActivitiesInput = input;
        return activitiesReport;
      },
      getCallsWorkloadReport: async () => callsReport,
      getCohortConversionReport: async () => cohortReport,
      getTocFlowReport: async () => tocReport,
      getAcquisitionOutcomesReport: async () => acquisitionOutcomesReport,
      getTargetGroupConversionReport: async () => targetGroupConversionReport,
      getManagerActionOutcomeReport: async () => managerActionOutcomeReport,
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 0,
        totalConfirmedCount: 0,
        totalAttendedCount: 0,
        totalRefusedCount: 0,
        totalMissedCount: 0,
        attendanceRate: null,
        nextStepEligibleCount: 0,
        nextStepCount: 0,
        nextStepRate: null,
        warnings: [],
        rows: []
      }),
      getRevenueVelocityReport: async (input: unknown) => {
        receivedRevenueVelocityInput = input;
        return revenueVelocityReport;
      },
      getLeadgenFunnelReport: async (input: unknown) => {
        receivedLeadgenFunnelInput = input;
        return leadgenFunnelReport;
      },
      getSalesPlan: async () => ({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        rows: [],
        updatedAt: null
      }),
      replaceSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: null
      }),
      getPricingSettings: async () => ({
        rules: [],
        updatedAt: null
      }),
      replacePricingSettings: async () => ({
        rules: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getAttractionOntology: async () => emptyAttractionOntology,
      getAttractionOntologySourceDocument: async () =>
        emptyAttractionOntologySourceDocument,
      getMeta: async () => ({
        stageCatalog,
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: ["C1:WON"],
        defaultPeriodDays: 30,
        lastSync: {
          finishedAt: "2026-04-08T12:00:00.000Z",
          leadsSynced: 8,
          dealsSynced: 5,
          mode: "delta" as const,
          dealBreakdown: {
            total: 5,
            created: 1,
            updated: 4,
            closed: 0,
            reopened: 0,
            unchanged: 0
          }
        },
        snapshotStats: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18
        },
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-08T12:00:00.000Z",
          lastSuccessfulSync: "2026-04-08T12:00:00.000Z",
          issues: [],
          warnings: []
        }
      }),
      performSync: async () =>
        createSyncSummary({
          syncRunId: 18,
          leadsSynced: 8,
          dealsSynced: 5,
          mode: "delta",
          modifiedAfter: "2026-04-08T00:00:00.000Z",
          finishedAt: "2026-04-08T12:00:00.000Z"
        }),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    };

    const app = createApp(service, {
      modules: {
        leadgen: {
          getLeadgenFunnelReport: async (input: unknown) => {
            receivedLeadgenFunnelInput = input;
            return leadgenFunnelReport;
          },
          getActivitiesWorkloadReport: async (input: unknown) => {
            receivedLeadgenActivitiesInput = input;
            return {
              ...activitiesReport,
              totalDealCount: 2,
              totalCreatedCount: 3
            };
          },
          getCallsWorkloadReport: async (input: unknown) => {
            receivedLeadgenCallsInput = input;
            return {
              ...callsReport,
              totalDealCount: 2,
              totalCalls: 4
            };
          },
          getMeta: async () => ({
            stageCatalog: [
              {
                entityType: "deal" as const,
                categoryId: "28",
                statusId: "C28:NEW",
                name: "Новый лид",
                semanticId: "P"
              }
            ],
            managerCatalog: [{ id: "501", name: "Лидген менеджер" }],
            sourceCatalog: [{ key: "WEB", label: "Сайт" }],
            wonStageIds: [],
            defaultPeriodDays: 30,
            lastSync: {
              finishedAt: "2026-05-14T12:00:00.000Z",
              leadsSynced: 0,
              dealsSynced: 333,
              mode: "delta" as const,
              dealBreakdown: {
                total: 333,
                created: 300,
                updated: 30,
                closed: 3,
                reopened: 0,
                unchanged: 0
              }
            },
            snapshotStats: {
              deals: 4140,
              activities: 306,
              calls: 119,
              stageHistory: 13166
            },
            syncHealth: {
              status: "ready" as const,
              blocking: false,
              checkedAt: "2026-05-14T12:00:00.000Z",
              lastSuccessfulSync: "2026-05-14T12:00:00.000Z",
              issues: [],
              warnings: []
            }
          }),
          performSync: async () => createSyncSummary({ syncRunId: 28 })
        }
      }
    });

    await request(app)
      .get("/api/dashboard")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.salesSummary.salesCount).toBe(3);
      });

    await request(app)
      .get("/api/reports/source-quality-conversion")
      .query({
        periodDays: 30
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCreatedDeals).toBe(4);
      });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        periodDays: 30,
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: ["2026-03-31T23:59:59.999Z"]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCreatedCount).toBe(5);
        expect(body.comparisons).toHaveLength(1);
      });

    expect(receivedActivitiesInput).toEqual({
      periodDays: 30,
      compareRanges: [
        {
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.999Z"
        }
      ]
    });

    await request(app)
      .get("/api/reports/calls-workload")
      .query({
        periodDays: 30
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalCalls).toBe(7);
      });

    await request(app)
      .get("/api/reports/cohort-conversion")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        managerIds: "7,9",
        sourceKeys: "WEB,REFERRAL"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalClosedDeals).toBe(2);
      });

    await request(app)
      .get("/api/reports/toc-flow")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.businessDays).toBe(22);
      });

    await request(app)
      .get("/api/reports/revenue-velocity")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z",
        dimension: "source",
        view: "createdCohort",
        asOf: "2026-05-15T00:00:00.000Z",
        managerIds: "7,9",
        sourceKeys: "WEB",
        customerKeys: "Club One,unknown",
        qualityKeys: "A",
        tariffKeys: "Premium"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.dimension).toBe("source");
        expect(body.totals.revenueVelocityPerDay).toBe(12500);
        expect(body.rows[0].sourceLabel).toBe("Сайт");
      });

    expect(receivedRevenueVelocityInput).toEqual({
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      filters: {
        managerIds: ["7", "9"],
        sourceKeys: ["WEB"],
        customerKeys: ["Club One", "unknown"],
        qualityKeys: ["A"],
        tariffKeys: ["Premium"]
      },
      dimension: "source",
      view: "createdCohort",
      asOf: "2026-05-15T00:00:00.000Z"
    });

    await request(app)
      .get("/api/reports/acquisition-outcomes")
      .query({
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalNewDeals).toBe(3);
        expect(body.totalLostDeals).toBe(1);
      });

    await request(app)
      .get("/api/meta")
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON"]);
        expect(body.stageCatalog).toEqual(stageCatalog);
        expect(body.managerCatalog).toEqual([]);
        expect(body.sourceCatalog).toEqual([]);
        expect(body.snapshotStats).toEqual({
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18
        });
      });

    await request(app)
      .get("/api/ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.title).toBe("Онтология Привлечения");
      });

    await request(app)
      .get("/api/modules/attraction/ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
      });

    await request(app)
      .get("/api/ontology/sources/module_ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.source.id).toBe("module_ontology");
        expect(body.content).toContain("Онтология модуля");
      });

    await request(app)
      .get("/api/modules/attraction/ontology/sources/module_ontology")
      .expect(200)
      .expect(({ body }) => {
        expect(body.moduleKey).toBe("attraction");
        expect(body.source.href).toBe(
          "docs/modules/attraction/MODULE_ONTOLOGY.md"
        );
      });

    await request(app)
      .get("/api/modules/leadgen/ontology")
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    await request(app)
      .get("/api/modules/leadgen/ontology/sources/module_ontology")
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe("NOT_FOUND");
      });

    await request(app)
      .get("/api/modules/leadgen/meta")
      .expect(200)
      .expect(({ body }) => {
        expect(body.lastSync.finishedAt).toBe("2026-05-14T12:00:00.000Z");
        expect(body.lastSync.dealsSynced).toBe(333);
        expect(body.snapshotStats).toEqual({
          deals: 4140,
          activities: 306,
          calls: 119,
          stageHistory: 13166
        });
      });

    await request(app)
      .get("/api/modules/leadgen/reports/funnel")
      .query({
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z",
        managerIds: "501",
        sourceKeys: "WEB"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDeals).toBe(4);
      });

    expect(receivedLeadgenFunnelInput).toEqual({
      range: {
        from: "2026-05-01T00:00:00.000Z",
        to: "2026-05-31T23:59:59.999Z"
      },
      filters: {
        managerIds: ["501"],
        sourceKeys: ["WEB"]
      }
    });

    await request(app)
      .get("/api/modules/leadgen/reports/activities-workload")
      .query({
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDealCount).toBe(2);
        expect(body.totalCreatedCount).toBe(3);
      });

    await request(app)
      .get("/api/modules/leadgen/reports/calls-workload")
      .query({
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalDealCount).toBe(2);
        expect(body.totalCalls).toBe(4);
      });

    expect(receivedLeadgenActivitiesInput).toEqual({
      range: {
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      }
    });
    expect(receivedLeadgenCallsInput).toEqual({
      range: {
        from: "2026-05-11T00:00:00.000Z",
        to: "2026-05-17T23:59:59.999Z"
      }
    });

    await request(app)
      .post("/api/sync")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(18);
      });

    await request(app)
      .put("/api/settings/won-stages")
      .send({ stageIds: ["C1:WON", "C1:PAID"] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON", "C1:PAID"]);
      });
  });

  it("returns conversion events report", async () => {
    const report: ConversionEventsReport = {
      range: {
        from: "2026-04-01T00:00:00.000Z",
        to: "2026-04-30T23:59:59.999Z"
      },
      totalInvitedCount: 5,
      totalConfirmedCount: 0,
      totalAttendedCount: 2,
      totalRefusedCount: 1,
      totalMissedCount: 3,
      attendanceRate: 40,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      warnings: [],
      rows: [
        {
          eventKey: "2026-04-29::Знакомство с клубом 29.04.",
          eventName: "Знакомство с клубом 29.04.",
          eventDate: "2026-04-29T00:00:00.000Z",
          invitedCount: 5,
          confirmedCount: 0,
          attendedCount: 2,
          refusedCount: 1,
          missedCount: 3,
          attendanceRate: 40,
          nextStepEligibleCount: 2,
          nextStepCount: 1,
          nextStepRate: 50,
          unlinkedCount: 0,
          unknownStatusCount: 0,
          managerBreakdown: [{ key: "78", label: "Егоров Андрей", count: 5 }],
          sourceBreakdown: [{ key: "WEB", label: "Веб", count: 5 }],
          businessClubBreakdown: [
            { key: "ClubFirst One", label: "ClubFirst One", count: 5 }
          ]
        }
      ],
      comparisons: []
    };
    const app = createTestApp({
      getConversionEventsReport: async (input) => ({
        ...report,
        range: input.range ?? report.range
      })
    });

    await request(app)
      .get(
        "/api/reports/conversion-events?from=2026-04-01T00:00:00.000Z&to=2026-04-30T23:59:59.999Z"
      )
      .expect(200)
      .expect({
        ...report,
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        }
      });
  });

  it("reads and replaces the saved sales plan for a report period", async () => {
    let receivedReplacement: unknown = null;
    const plan: SalesPlanData = {
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
      rows: [
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
        }
      ],
      updatedAt: "2026-04-10T12:00:00.000Z"
    };
    const app = createTestApp({
      getSalesPlan: async (input) => ({
        ...plan,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd
      }),
      replaceSalesPlan: async (input) => {
        receivedReplacement = input;
        return {
          ...plan,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          rows: input.rows.map((row) => ({
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            managerId: row.managerId,
            managerName: row.managerName ?? null,
            targetGroupKey: row.targetGroupKey,
            targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
            plannedDeals: row.plannedDeals,
            plannedAmount: row.plannedAmount,
            updatedAt: "2026-04-10T12:00:00.000Z"
          }))
        };
      }
    });

    await request(app)
      .get("/api/sales-plan")
      .query({
        from: "2026-04-01T00:00:00.000+03:00",
        to: "2026-04-30T23:59:59.999+03:00"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          targetGroupKey: "ClubFirst Russia",
          plannedDeals: 3,
          plannedAmount: 2500000
        });
      });

    await request(app)
      .put("/api/sales-plan")
      .send({
        periodStart: "2026-04-01T00:00:00.000+03:00",
        periodEnd: "2026-04-30T23:59:59.999+03:00",
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
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.updatedAt).toBe("2026-04-10T12:00:00.000Z");
        expect(body.rows[0].plannedDeals).toBe(4);
      });

    expect(receivedReplacement).toEqual({
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-04-30T23:59:59.999+03:00",
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
  });

  it("reads and replaces a quarterly sales plan", async () => {
    let receivedReplacement: unknown = null;
    const quarterPlan: SalesPlanQuarterData = {
      year: 2026,
      quarter: 2,
      periodStart: "2026-04-01T00:00:00.000+03:00",
      periodEnd: "2026-06-30T23:59:59.999+03:00",
      months: [
        {
          month: "2026-04",
          label: "Апрель",
          periodStart: "2026-04-01T00:00:00.000+03:00",
          periodEnd: "2026-04-30T23:59:59.999+03:00"
        },
        {
          month: "2026-05",
          label: "Май",
          periodStart: "2026-05-01T00:00:00.000+03:00",
          periodEnd: "2026-05-31T23:59:59.999+03:00"
        },
        {
          month: "2026-06",
          label: "Июнь",
          periodStart: "2026-06-01T00:00:00.000+03:00",
          periodEnd: "2026-06-30T23:59:59.999+03:00"
        }
      ],
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            {
              month: "2026-04",
              periodStart: "2026-04-01T00:00:00.000+03:00",
              periodEnd: "2026-04-30T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            },
            {
              month: "2026-05",
              periodStart: "2026-05-01T00:00:00.000+03:00",
              periodEnd: "2026-05-31T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            },
            {
              month: "2026-06",
              periodStart: "2026-06-01T00:00:00.000+03:00",
              periodEnd: "2026-06-30T23:59:59.999+03:00",
              plannedDeals: 3,
              plannedAmount: 3000000,
              updatedAt: "2026-04-10T12:00:00.000Z"
            }
          ],
          updatedAt: "2026-04-10T12:00:00.000Z"
        }
      ],
      updatedAt: "2026-04-10T12:00:00.000Z"
    };
    const app = createTestApp({
      getSalesPlanQuarter: async (input) => ({
        ...quarterPlan,
        year: input.year,
        quarter: input.quarter
      }),
      replaceSalesPlanQuarter: async (input) => {
        receivedReplacement = input;
        return {
          ...quarterPlan,
          year: input.year,
          quarter: input.quarter
        };
      }
    });

    await request(app)
      .get("/api/sales-plan/quarter")
      .query({ year: "2026", quarter: "2" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.months.map((month: { month: string }) => month.month)).toEqual([
          "2026-04",
          "2026-05",
          "2026-06"
        ]);
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          targetGroupKey: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000
        });
      });

    await request(app)
      .put("/api/sales-plan/quarter")
      .send({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: "78",
            managerName: "Егоров Андрей",
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9000000,
            months: [
              { month: "2026-04", plannedDeals: 3, plannedAmount: 3000000 },
              { month: "2026-05", plannedDeals: 3, plannedAmount: 3000000 },
              { month: "2026-06", plannedDeals: 3, plannedAmount: 3000000 }
            ]
          }
        ]
      })
      .expect(200);

    expect(receivedReplacement).toEqual({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: "78",
          managerName: "Егоров Андрей",
          targetGroupKey: "ClubFirst Russia",
          targetGroupLabel: "ClubFirst Russia",
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            { month: "2026-04", plannedDeals: 3, plannedAmount: 3000000 },
            { month: "2026-05", plannedDeals: 3, plannedAmount: 3000000 },
            { month: "2026-06", plannedDeals: 3, plannedAmount: 3000000 }
          ]
        }
      ]
    });
  });

  it("rejects quarterly sales plans whose months do not match the quarter total", async () => {
    const app = createTestApp();

    await request(app)
      .put("/api/sales-plan/quarter")
      .send({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: "78",
            targetGroupKey: "ClubFirst Russia",
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9000000,
            months: [
              { month: "2026-04", plannedDeals: 5, plannedAmount: 3000000 },
              { month: "2026-05", plannedDeals: 5, plannedAmount: 3000000 },
              { month: "2026-06", plannedDeals: 5, plannedAmount: 3000000 }
            ]
          }
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(JSON.stringify(body.details.fieldErrors)).toContain("quarter");
      });
  });

  it("reads an effective sales plan prorated for the report range", async () => {
    const app = createTestApp({
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [
          {
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            managerId: "78",
            managerName: "Егоров Андрей",
            targetGroupKey: "ClubFirst Russia",
            targetGroupLabel: "ClubFirst Russia",
            plannedDeals: 2,
            plannedAmount: 1166667,
            updatedAt: "2026-04-10T12:00:00.000Z"
          }
        ],
        updatedAt: "2026-04-10T12:00:00.000Z"
      })
    });

    await request(app)
      .get("/api/sales-plan/effective")
      .query({
        from: "2026-04-01T00:00:00.000+03:00",
        to: "2026-04-07T23:59:59.999+03:00"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.rows[0]).toMatchObject({
          managerId: "78",
          plannedDeals: 2,
          plannedAmount: 1166667
        });
      });
  });

  it("rejects concurrent sync requests while one refresh is already running", async () => {
    let resolveSync!: (value: ReturnType<typeof createSyncSummary>) => void;

    const app = createApp({
      getDashboard: async () => ({
        salesSummary: {
          salesCount: 0,
          salesAmount: 0,
          averageSaleAmount: 0,
          attractionRevenueAmount: 0,
          averageAttractionRevenueAmount: 0,
          membershipAmount: 0,
          averageMembershipAmount: 0,
          pricingWarnings: [],
          newDealsCount: 0,
          conversionRate: 0
        },
        managerGroups: []
      }),
      getSourceQualityConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: [],
        stageSequence: []
      }),
      getActivitiesWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCreatedCount: 0,
        totalRescheduledCount: 0,
        totalClosedCount: 0,
        totalMeetingCount: 0,
        warnings: [],
        conversionEventRows: [],
        managerRows: [],
        comparisons: []
      }),
      getCallsWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCalls: 0,
        totalIncomingCalls: 0,
        totalMissedIncomingCalls: 0,
        totalOutgoingCalls: 0,
        totalOtherOutgoingCalls: 0,
        totalConnectedCalls: 0,
        totalFailedCalls: 0,
        totalCallsOverThirtySeconds: 0,
        totalConnectedCallsOverThirtySeconds: 0,
        allCalls: emptyCallPopulation,
        linkedDealCalls: emptyLinkedDealCalls,
        warnings: [],
        managerRows: [],
        comparisons: []
      }),
      getCohortConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalClosedDeals: 0,
        totalWonDeals: 0,
        closureMonths: [],
        relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
        rows: [],
        comparisons: []
      }),
      getTocFlowReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        businessDays: 0,
        warnings: [],
        estimatedGainPerDay: null,
        bottleneck: null,
        rows: [],
        comparisons: []
      }),
      getAcquisitionOutcomesReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalNewDeals: 0,
        totalLostDeals: 0,
        newDealsByManager: [],
        lostDealsByManager: [],
        lostStages: [],
        businessClubByManager: [],
        lostDealDetails: [],
        topLossReasons: []
      }),
      getTargetGroupConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: []
      }),
      getManagerActionOutcomeReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        warnings: [],
        rows: [],
        cohortMonths: [],
        cohortStatusRows: []
      }),
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 0,
        totalConfirmedCount: 0,
        totalAttendedCount: 0,
        totalRefusedCount: 0,
        totalMissedCount: 0,
        attendanceRate: null,
        nextStepEligibleCount: 0,
        nextStepCount: 0,
        nextStepRate: null,
        warnings: [],
        rows: [],
        comparisons: []
      }),
      getRevenueVelocityReport: async () => createEmptyRevenueVelocityReport(),
      getSalesPlan: async () => ({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        rows: [],
        updatedAt: null
      }),
      replaceSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: null
      }),
      getPricingSettings: async () => ({
        rules: [],
        updatedAt: null
      }),
      replacePricingSettings: async () => ({
        rules: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getMeta: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: emptySnapshotStats,
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-09T00:00:00.000Z",
          lastSuccessfulSync: null,
          issues: [],
          warnings: []
        }
      }),
      performSync: () =>
        new Promise<ReturnType<typeof createSyncSummary>>((resolve) => {
          resolveSync = resolve;
        }),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    });

    const firstRequest = request(app)
      .post("/api/sync")
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 0));

    await request(app)
      .post("/api/sync")
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toBe("SYNC_ALREADY_RUNNING");
      });

    resolveSync(createSyncSummary({
      syncRunId: 91,
      leadsSynced: 0,
      dealsSynced: 0,
      mode: "full",
      modifiedAfter: null,
      finishedAt: "2026-04-09T00:00:00.000Z"
    }));

    await expect(firstRequest).resolves.toMatchObject({
      status: 200
    });
  });

  it("routes module sync requests to the requested module service", async () => {
    const calls: string[] = [];
    const app = createTestApp(
      {
        performSync: async () => {
          calls.push("attraction");
          return createSyncSummary({ syncRunId: 10, dealsSynced: 10 });
        }
      },
      {
        modules: {
          leadgen: {
            performSync: async () => {
              calls.push("leadgen");
              return createSyncSummary({ syncRunId: 28, dealsSynced: 3 });
            }
          }
        }
      }
    );

    await request(app)
      .post("/api/modules/leadgen/sync")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(28);
        expect(body.dealsSynced).toBe(3);
      });

    expect(calls).toEqual(["leadgen"]);
  });

  it("streams sync progress events when requested by the web client", async () => {
    const app = createTestApp({
      performSync: async (input) => {
        input?.onProgress?.({
          syncRunId: 18,
          phase: "fetch_deals",
          progress: 35,
          message: "Получено обновлений сделок: 5"
        });

        return createSyncSummary({
          syncRunId: 18,
          dealsSynced: 5,
          finishedAt: "2026-04-09T12:00:00.000Z"
        });
      }
    });

    await request(app)
      .post("/api/sync")
      .set("Accept", "text/event-stream")
      .expect(200)
      .expect("Content-Type", /text\/event-stream/)
      .expect(({ text }) => {
        expect(text).toContain("event: progress");
        expect(text).toContain("\"phase\":\"fetch_deals\"");
        expect(text).toContain("event: complete");
        expect(text).toContain("\"syncRunId\":18");
      });
  });

  it("keeps the sync stream alive while Bitrix requests are still running", async () => {
    const app = createTestApp({
      performSync: async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return createSyncSummary({
          syncRunId: 19,
          dealsSynced: 5,
          finishedAt: "2026-04-09T12:00:00.000Z"
        });
      }
    }, {
      syncStreamHeartbeatMs: 10
    });

    await request(app)
      .post("/api/sync")
      .set("Accept", "text/event-stream")
      .expect(200)
      .expect(({ text }) => {
        expect(text).toContain(": keepalive");
        expect(text).toContain("event: complete");
      });
  });

  it("validates compare range query shape", async () => {
    const app = createApp({
      getDashboard: async () => ({
        salesSummary: {
          salesCount: 0,
          salesAmount: 0,
          averageSaleAmount: 0,
          attractionRevenueAmount: 0,
          averageAttractionRevenueAmount: 0,
          membershipAmount: 0,
          averageMembershipAmount: 0,
          pricingWarnings: [],
          newDealsCount: 0,
          conversionRate: 0
        },
        managerGroups: []
      }),
      getSourceQualityConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: [],
        stageSequence: []
      }),
      getActivitiesWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCreatedCount: 0,
        totalRescheduledCount: 0,
        totalClosedCount: 0,
        totalMeetingCount: 0,
        warnings: [],
        conversionEventRows: [],
        managerRows: []
      }),
      getCallsWorkloadReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalDealCount: 0,
        totalCalls: 0,
        totalIncomingCalls: 0,
        totalMissedIncomingCalls: 0,
        totalOutgoingCalls: 0,
        totalOtherOutgoingCalls: 0,
        totalConnectedCalls: 0,
        totalFailedCalls: 0,
        totalCallsOverThirtySeconds: 0,
        totalConnectedCallsOverThirtySeconds: 0,
        allCalls: emptyCallPopulation,
        linkedDealCalls: emptyLinkedDealCalls,
        warnings: [],
        managerRows: []
      }),
      getCohortConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalClosedDeals: 0,
        totalWonDeals: 0,
        closureMonths: [],
        relativeBucketKeys: ["month_1", "month_2", "month_3", "month_4_plus"],
        rows: []
      }),
      getTocFlowReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        businessDays: 0,
        warnings: [],
        estimatedGainPerDay: null,
        bottleneck: null,
        rows: []
      }),
      getAcquisitionOutcomesReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalNewDeals: 0,
        totalLostDeals: 0,
        newDealsByManager: [],
        lostDealsByManager: [],
        lostStages: [],
        businessClubByManager: [],
        lostDealDetails: [],
        topLossReasons: []
      }),
      getTargetGroupConversionReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalCreatedDeals: 0,
        totalWonDeals: 0,
        rows: []
      }),
      getManagerActionOutcomeReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        warnings: [],
        rows: [],
        cohortMonths: [],
        cohortStatusRows: []
      }),
      getConversionEventsReport: async () => ({
        range: {
          from: "2026-04-01T00:00:00.000Z",
          to: "2026-04-30T23:59:59.999Z"
        },
        totalInvitedCount: 0,
        totalConfirmedCount: 0,
        totalAttendedCount: 0,
        totalRefusedCount: 0,
        totalMissedCount: 0,
        attendanceRate: null,
        nextStepEligibleCount: 0,
        nextStepCount: 0,
        nextStepRate: null,
        warnings: [],
        rows: []
      }),
      getRevenueVelocityReport: async () => createEmptyRevenueVelocityReport(),
      getSalesPlan: async () => ({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.999Z",
        rows: [],
        updatedAt: null
      }),
      replaceSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      replaceSalesPlanQuarter: async (input) => createEmptySalesPlanQuarter(input),
      getEffectiveSalesPlan: async (input) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        rows: [],
        updatedAt: null
      }),
      getPricingSettings: async () => ({
        rules: [],
        updatedAt: null
      }),
      replacePricingSettings: async () => ({
        rules: [],
        updatedAt: "2026-04-10T12:00:00.000Z"
      }),
      getMeta: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: emptySnapshotStats,
        syncHealth: {
          status: "ready" as const,
          blocking: false,
          checkedAt: "2026-04-09T00:00:00.000Z",
          lastSuccessfulSync: null,
          issues: [],
          warnings: []
        }
      }),
      performSync: async () => createSyncSummary(),
      updateWonStages: async (stageIds: string[]) => ({
        wonStageIds: stageIds
      })
    });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: [
          "2026-03-01T00:00:00.000Z",
          "2026-02-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
          "2025-12-01T00:00:00.000Z",
          "2025-11-01T00:00:00.000Z",
          "2025-10-01T00:00:00.000Z"
        ],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z",
          "2026-01-31T23:59:59.999Z",
          "2025-12-31T23:59:59.999Z",
          "2025-11-30T23:59:59.999Z",
          "2025-10-31T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(body.details.fieldErrors.compareFrom).toContain(
          "A maximum of 5 compare ranges is supported."
        );
      });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("VALIDATION_ERROR");
        expect(body.details.fieldErrors.compareFrom).toContain(
          "compareFrom and compareTo must have the same number of values."
        );
      });
  });

  it("rejects unauthorized mutating requests when an API token is configured", async () => {
    const app = createTestApp(undefined, {
      apiAuthToken: "top-secret-token"
    });

    await request(app)
      .post("/api/sync")
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "UNAUTHORIZED",
          code: "UNAUTHORIZED"
        });
      });

    await request(app)
      .put("/api/settings/won-stages")
      .send({ stageIds: ["C1:WON"] })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "UNAUTHORIZED",
          code: "UNAUTHORIZED"
        });
      });
  });

  it("accepts configured API token via X-API-Token or Authorization Bearer", async () => {
    const app = createTestApp(undefined, {
      apiAuthToken: "top-secret-token"
    });

    await request(app)
      .post("/api/sync")
      .set("X-API-Token", "top-secret-token")
      .expect(200)
      .expect(({ body }) => {
        expect(body.syncRunId).toBe(1);
      });

    await request(app)
      .put("/api/settings/won-stages")
      .set("Authorization", "Bearer top-secret-token")
      .send({ stageIds: ["C1:WON", "C1:PAID"] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON", "C1:PAID"]);
      });
  });

  it("returns validation errors in a stable error contract", async () => {
    const app = createTestApp();

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        compareFrom: ["2026-03-01T00:00:00.000Z"],
        compareTo: [
          "2026-03-31T23:59:59.999Z",
          "2026-02-28T23:59:59.999Z"
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: "VALIDATION_ERROR",
          code: "VALIDATION_ERROR"
        });
        expect(body.details.fieldErrors.compareFrom).toContain(
          "compareFrom and compareTo must have the same number of values."
        );
      });
  });

  it("does not leak raw error messages in generic 500 responses", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const app = createTestApp({
      performSync: async () => {
        throw new Error("database password leaked");
      }
    });

    await request(app)
      .post("/api/sync")
      .expect(500)
      .expect(({ body }) => {
        expect(body).toEqual({
          error: "INTERNAL_SERVER_ERROR",
          code: "INTERNAL_SERVER_ERROR"
        });
        expect(body).not.toHaveProperty("message");
      });
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (entry) =>
            entry instanceof Error ||
            String(entry).includes("database password leaked")
        )
      )
    ).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it("compares range timestamps using Date.parse instead of lexicographic ISO strings", async () => {
    let receivedInput: unknown = null;
    const app = createTestApp({
      getActivitiesWorkloadReport: async (input: unknown) => {
        receivedInput = input;
        return {
          range: {
            from: "2026-03-31T21:30:00.000Z",
            to: "2026-03-31T23:00:00.000Z"
          },
          totalDealCount: 0,
          totalCreatedCount: 0,
          totalRescheduledCount: 0,
          totalClosedCount: 0,
          totalMeetingCount: 0,
          warnings: [],
          conversionEventRows: [],
          managerRows: [],
          comparisons: []
        };
      }
    });

    await request(app)
      .get("/api/reports/activities-workload")
      .query({
        from: "2026-04-01T00:30:00+03:00",
        to: "2026-03-31T23:00:00Z",
        compareFrom: ["2026-04-02T00:30:00+03:00"],
        compareTo: ["2026-04-01T22:00:00Z"]
      })
      .expect(200);

    expect(receivedInput).toEqual({
      range: {
        from: "2026-04-01T00:30:00+03:00",
        to: "2026-03-31T23:00:00Z"
      },
      compareRanges: [
        {
          from: "2026-04-02T00:30:00+03:00",
          to: "2026-04-01T22:00:00Z"
        }
      ]
    });
  });
});
