import type { DashboardData, ManualSyncSummary, StageCatalogEntry } from "@bitrix24-reporting/contracts";
import cors from "cors";
import express from "express";
import { z } from "zod";

interface MetaResponse {
  stageCatalog: StageCatalogEntry[];
  wonStageIds: string[];
  defaultPeriodDays: number;
  lastSync: {
    finishedAt: string;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
  } | null;
}

interface AppService {
  getDashboard(input: { periodDays: number }): Promise<DashboardData>;
  getMeta(): Promise<MetaResponse>;
  performSync(): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

const periodQuerySchema = z.object({
  periodDays: z.coerce.number().int().positive().max(365).default(30)
});

const updateWonStagesSchema = z.object({
  stageIds: z.array(z.string().min(1)).min(1)
});

export function createApp(service: AppService) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/dashboard", async (request, response, next) => {
    try {
      const query = periodQuerySchema.parse(request.query);
      const dashboard = await service.getDashboard({
        periodDays: query.periodDays
      });
      response.json(dashboard);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/meta", async (_request, response, next) => {
    try {
      response.json(await service.getMeta());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sync", async (_request, response, next) => {
    try {
      response.json(await service.performSync());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/settings/won-stages", async (request, response, next) => {
    try {
      const payload = updateWonStagesSchema.parse(request.body);
      response.json(await service.updateWonStages(payload.stageIds));
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof z.ZodError) {
        response.status(400).json({
          error: "VALIDATION_ERROR",
          details: error.flatten()
        });
        return;
      }

      response.status(500).json({
        error: "INTERNAL_SERVER_ERROR"
      });
    }
  );

  return app;
}
