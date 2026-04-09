import type { DashboardData, StageCatalogEntry } from "@bitrix24-reporting/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/server/app";

describe("createApp", () => {
  it("returns dashboard data, settings and sync status from the local API", async () => {
    const dashboard: DashboardData = {
      salesOverview: {
        salesCount: 3,
        salesAmount: 45000,
        averageSaleAmount: 15000,
        newDealsCount: 7,
        conversionRate: 42.86,
        salesTimeline: [
          {
            date: "2026-04-08",
            salesCount: 3,
            salesAmount: 45000
          }
        ]
      },
      funnelSnapshot: [],
      sourceBreakdown: []
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
    const service = {
      getDashboard: async () => dashboard,
      getMeta: async () => ({
        stageCatalog,
        wonStageIds: ["C1:WON"],
        defaultPeriodDays: 30,
        lastSync: {
          finishedAt: "2026-04-08T12:00:00.000Z",
          leadsSynced: 8,
          dealsSynced: 5,
          mode: "delta" as const
        }
      }),
      performSync: async () => ({
        syncRunId: 18,
        leadsSynced: 8,
        dealsSynced: 5,
        mode: "delta" as const,
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
      .query({ periodDays: "30" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.salesOverview.salesCount).toBe(3);
      });

    await request(app)
      .get("/api/meta")
      .expect(200)
      .expect(({ body }) => {
        expect(body.wonStageIds).toEqual(["C1:WON"]);
        expect(body.stageCatalog).toEqual(stageCatalog);
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
});
