import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  CohortConversionReport,
  DashboardData,
  ManagerActionOutcomeReport,
  SourceQualityConversionReport,
  StageCatalogEntry,
  TargetGroupConversionReport,
  TocFlowReport
} from "@bitrix24-reporting/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/server/app";

const emptyCallPopulation = {
  totalCalls: 0,
  incomingCalls: 0,
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

function createTestApp(
  serviceOverrides: Partial<Parameters<typeof createApp>[0]> = {},
  config?: {
    webOrigin?: string;
    apiAuthToken?: string;
  }
) {
  const service: Parameters<typeof createApp>[0] = {
    getDashboard: async () => ({
      salesSummary: {
        salesCount: 0,
        salesAmount: 0,
        averageSaleAmount: 0,
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
      }
    ) => ReturnType<typeof createApp>
  )(service, config);
}

describe("createApp", () => {
  it("returns dashboard data, settings and sync status from the local API", async () => {
    let receivedActivitiesInput: unknown = null;
    const dashboard: DashboardData = {
      salesSummary: {
        salesCount: 3,
        salesAmount: 45000,
        averageSaleAmount: 15000,
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
    const service = {
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

    const app = createApp(service);

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

  it("rejects concurrent sync requests while one refresh is already running", async () => {
    let resolveSync!: (value: ReturnType<typeof createSyncSummary>) => void;

    const app = createApp({
      getDashboard: async () => ({
        salesSummary: {
          salesCount: 0,
          salesAmount: 0,
          averageSaleAmount: 0,
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

  it("validates compare range query shape", async () => {
    const app = createApp({
      getDashboard: async () => ({
        salesSummary: {
          salesCount: 0,
          salesAmount: 0,
          averageSaleAmount: 0,
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
