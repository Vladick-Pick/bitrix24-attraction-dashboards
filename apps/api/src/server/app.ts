import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  CohortConversionReport,
  ConversionEventsReport,
  DashboardData,
  ManagerActionOutcomeReport,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  RevenueVelocityDimension,
  RevenueVelocityReport,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SnapshotStats,
  SourceCatalogEntry,
  SourceQualityConversionReport,
  StageCatalogEntry,
  SyncDealChangeBreakdown,
  SyncHealth,
  SyncProgressEvent,
  TargetGroupConversionReport,
  TocFlowReport
} from "@bitrix24-reporting/contracts";
import cors from "cors";
import express from "express";
import { z } from "zod";

interface MetaResponse {
  stageCatalog: StageCatalogEntry[];
  managerCatalog: ManagerDirectoryEntry[];
  sourceCatalog: SourceCatalogEntry[];
  wonStageIds: string[];
  defaultPeriodDays: number;
  lastSync: {
    finishedAt: string;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    dealBreakdown: SyncDealChangeBreakdown;
  } | null;
  snapshotStats: SnapshotStats;
  syncHealth: SyncHealth;
}

interface RangeRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  compareRanges?: Array<{
    from: string;
    to: string;
  }>;
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
  };
}

interface RevenueVelocityRequest extends RangeRequest {
  dimension: RevenueVelocityDimension;
  view: RevenueVelocityView;
  asOf?: string;
  filters?: RangeRequest["filters"] & {
    customerKeys?: string[];
    qualityKeys?: string[];
    tariffKeys?: string[];
  };
}

interface AppService {
  getDashboard(input: RangeRequest): Promise<DashboardData>;
  getSourceQualityConversionReport(
    input: RangeRequest
  ): Promise<SourceQualityConversionReport>;
  getActivitiesWorkloadReport(
    input: RangeRequest
  ): Promise<ActivitiesWorkloadReport>;
  getAcquisitionOutcomesReport(
    input: RangeRequest
  ): Promise<AcquisitionOutcomesReport>;
  getTargetGroupConversionReport(
    input: RangeRequest
  ): Promise<TargetGroupConversionReport>;
  getManagerActionOutcomeReport(
    input: RangeRequest
  ): Promise<ManagerActionOutcomeReport>;
  getCallsWorkloadReport(input: RangeRequest): Promise<CallsWorkloadReport>;
  getConversionEventsReport(input: RangeRequest): Promise<ConversionEventsReport>;
  getCohortConversionReport(input: RangeRequest): Promise<CohortConversionReport>;
  getTocFlowReport(input: RangeRequest): Promise<TocFlowReport>;
  getRevenueVelocityReport(
    input: RevenueVelocityRequest
  ): Promise<RevenueVelocityReport>;
  getSalesPlan(input: {
    periodStart: string;
    periodEnd: string;
  }): Promise<SalesPlanData>;
  replaceSalesPlan(input: SalesPlanInput): Promise<SalesPlanData>;
  getMeta(): Promise<MetaResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

interface AppConfig {
  webOrigin?: string;
  apiAuthToken?: string;
}

function parseCsvArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) =>
        typeof item === "string" ? item.split(",") : [String(item)]
      )
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

function isLaterThan(from: string, to: string) {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);

  return Number.isFinite(fromMs) && Number.isFinite(toMs) && fromMs > toMs;
}

const reportQuerySchema = z
  .object({
    periodDays: z.coerce.number().int().positive().max(365).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    compareFrom: z.preprocess(
      parseCsvArray,
      z.array(z.string().datetime({ offset: true })).optional()
    ),
    compareTo: z.preprocess(
      parseCsvArray,
      z.array(z.string().datetime({ offset: true })).optional()
    ),
    managerIds: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
    sourceKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional())
  })
  .superRefine((value, context) => {
    const hasFrom = Boolean(value.from);
    const hasTo = Boolean(value.to);

    if (hasFrom !== hasTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Both from and to must be provided together.",
        path: hasFrom ? ["to"] : ["from"]
      });
      return;
    }

    if (value.from && value.to && isLaterThan(value.from, value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be earlier than or equal to to.",
        path: ["from"]
      });
    }

    const compareFrom = value.compareFrom ?? [];
    const compareTo = value.compareTo ?? [];

    if (compareFrom.length !== compareTo.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "compareFrom and compareTo must have the same number of values.",
        path: ["compareFrom"]
      });
      return;
    }

    if (compareFrom.length > 5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A maximum of 5 compare ranges is supported.",
        path: ["compareFrom"]
      });
    }

    for (let index = 0; index < compareFrom.length; index += 1) {
      const from = compareFrom[index];
      const to = compareTo[index];

      if (from && to && isLaterThan(from, to)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `compareFrom[${index}] must be earlier than or equal to compareTo[${index}].`,
          path: ["compareFrom", index]
        });
      }
    }
  });

const updateWonStagesSchema = z.object({
  stageIds: z.array(z.string().min(1)).min(1)
});

const revenueVelocityExtraQuerySchema = z.object({
  dimension: z
    .enum([
      "manager",
      "source",
      "customer",
      "managerSource",
      "sourceCustomer",
      "managerCustomer"
    ])
    .optional(),
  view: z
    .enum(["systemState", "operationalPeriod", "createdCohort"])
    .optional(),
  asOf: z.string().datetime({ offset: true }).optional(),
  customerKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
  qualityKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional()),
  tariffKeys: z.preprocess(parseCsvArray, z.array(z.string()).optional())
});

const salesPlanQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true })
  })
  .superRefine((value, context) => {
    if (isLaterThan(value.from, value.to)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must be earlier than or equal to to.",
        path: ["from"]
      });
    }
  });

const salesPlanBodySchema = z
  .object({
    periodStart: z.string().datetime({ offset: true }),
    periodEnd: z.string().datetime({ offset: true }),
    rows: z.array(
      z.object({
        managerId: z.string().min(1),
        managerName: z.string().trim().min(1).nullable().optional(),
        targetGroupKey: z.string().min(1),
        targetGroupLabel: z.string().trim().min(1).nullable().optional(),
        plannedDeals: z.number().int().nonnegative(),
        plannedAmount: z.number().finite().nonnegative()
      })
    )
  })
  .superRefine((value, context) => {
    if (isLaterThan(value.periodStart, value.periodEnd)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "periodStart must be earlier than or equal to periodEnd.",
        path: ["periodStart"]
      });
    }
  });

function parseRangeRequest(query: unknown): RangeRequest {
  const parsed = reportQuerySchema.parse(query);
  const compareRanges = (parsed.compareFrom ?? []).map((from, index) => ({
    from,
    to: parsed.compareTo?.[index] ?? from
  }));
  const filters =
    parsed.managerIds?.length || parsed.sourceKeys?.length
      ? {
          ...(parsed.managerIds?.length ? { managerIds: parsed.managerIds } : {}),
          ...(parsed.sourceKeys?.length ? { sourceKeys: parsed.sourceKeys } : {})
        }
      : undefined;

  if (parsed.from && parsed.to) {
    return {
      range: {
        from: parsed.from,
        to: parsed.to
      },
      ...(compareRanges.length > 0 ? { compareRanges } : {}),
      ...(filters ? { filters } : {})
    };
  }

  if (parsed.periodDays) {
    return {
      periodDays: parsed.periodDays,
      ...(compareRanges.length > 0 ? { compareRanges } : {}),
      ...(filters ? { filters } : {})
    };
  }

  return {
    ...(compareRanges.length > 0 ? { compareRanges } : {}),
    ...(filters ? { filters } : {})
  };
}

function parseRevenueVelocityRequest(query: unknown): RevenueVelocityRequest {
  const base = parseRangeRequest(query);
  const extra = revenueVelocityExtraQuerySchema.parse(query);
  const filters =
    base.filters ||
    extra.customerKeys?.length ||
    extra.qualityKeys?.length ||
    extra.tariffKeys?.length
      ? {
          ...(base.filters ?? {}),
          ...(extra.customerKeys?.length ? { customerKeys: extra.customerKeys } : {}),
          ...(extra.qualityKeys?.length ? { qualityKeys: extra.qualityKeys } : {}),
          ...(extra.tariffKeys?.length ? { tariffKeys: extra.tariffKeys } : {})
        }
      : undefined;

  return {
    ...base,
    dimension: extra.dimension ?? "manager",
    view: extra.view ?? "systemState",
    ...(extra.asOf ? { asOf: extra.asOf } : {}),
    ...(filters ? { filters } : {})
  };
}

function createErrorResponse(code: string, details?: unknown) {
  return {
    error: code,
    code,
    ...(details === undefined ? {} : { details })
  };
}

function getErrorCauseCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";
}

function createSyncErrorResponse(error: unknown) {
  const causeCode = getErrorCauseCode(error);
  const diagnostics =
    causeCode.length > 0
      ? [`network=${causeCode}`]
      : error instanceof Error && error.name === "AbortError"
        ? ["network=ABORT_TIMEOUT"]
        : error instanceof Error && error.message.startsWith("Bitrix24 ")
          ? [`bitrix=${error.message}`]
          : ["error=SYNC_FAILED"];

  return createErrorResponse("SYNC_FAILED", { diagnostics });
}

function wantsSyncStream(request: express.Request) {
  return request.header("Accept")?.includes("text/event-stream") === true;
}

function writeSyncEvent(
  response: express.Response,
  event: "progress" | "complete" | "error",
  data: unknown
) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function readBearerToken(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match?.[1]?.trim();
}

const localWebHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

function isAllowedWebOrigin(origin: string, webOrigin: string) {
  if (origin === webOrigin) {
    return true;
  }

  try {
    const candidate = new URL(origin);
    const configured = new URL(webOrigin);

    return (
      candidate.protocol === configured.protocol &&
      candidate.port === configured.port &&
      localWebHostnames.has(candidate.hostname) &&
      localWebHostnames.has(configured.hostname)
    );
  } catch {
    return false;
  }
}

export function createApp(service: AppService, config: AppConfig = {}) {
  const app = express();
  let activeSync: Promise<ManualSyncSummary> | null = null;
  const webOrigin = config.webOrigin?.trim() || "http://localhost:5173";
  const apiAuthToken = config.apiAuthToken?.trim() || undefined;

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, false);
          return;
        }

        callback(null, isAllowedWebOrigin(origin, webOrigin) ? origin : false);
      },
      methods: ["GET", "POST", "PUT"],
      allowedHeaders: ["Content-Type", "Authorization", "X-API-Token"]
    })
  );
  app.use(express.json());
  app.use((request, response, next) => {
    if (!apiAuthToken || !request.path.startsWith("/api/")) {
      next();
      return;
    }

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      next();
      return;
    }

    if (request.path === "/api/health") {
      next();
      return;
    }

    const token =
      request.header("X-API-Token")?.trim() ??
      readBearerToken(request.header("Authorization"));

    if (token === apiAuthToken) {
      next();
      return;
    }

    response.status(401).json(createErrorResponse("UNAUTHORIZED"));
  });

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/dashboard", async (request, response, next) => {
    try {
      response.json(await service.getDashboard(parseRangeRequest(request.query)));
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/reports/source-quality-conversion",
    async (request, response, next) => {
      try {
        response.json(
          await service.getSourceQualityConversionReport(
            parseRangeRequest(request.query)
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/reports/activities-workload", async (request, response, next) => {
    try {
      response.json(
        await service.getActivitiesWorkloadReport(parseRangeRequest(request.query))
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/acquisition-outcomes", async (request, response, next) => {
    try {
      response.json(
        await service.getAcquisitionOutcomesReport(parseRangeRequest(request.query))
      );
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/reports/target-group-conversion",
    async (request, response, next) => {
      try {
        response.json(
          await service.getTargetGroupConversionReport(
            parseRangeRequest(request.query)
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/reports/manager-action-outcomes",
    async (request, response, next) => {
      try {
        response.json(
          await service.getManagerActionOutcomeReport(
            parseRangeRequest(request.query)
          )
        );
      } catch (error) {
        next(error);
      }
    }
  );

  app.get("/api/reports/calls-workload", async (request, response, next) => {
    try {
      response.json(
        await service.getCallsWorkloadReport(parseRangeRequest(request.query))
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/conversion-events", async (request, response, next) => {
    try {
      response.json(
        await service.getConversionEventsReport(parseRangeRequest(request.query))
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/cohort-conversion", async (request, response, next) => {
    try {
      response.json(
        await service.getCohortConversionReport(parseRangeRequest(request.query))
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/toc-flow", async (request, response, next) => {
    try {
      response.json(await service.getTocFlowReport(parseRangeRequest(request.query)));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/reports/revenue-velocity", async (request, response, next) => {
    try {
      response.json(
        await service.getRevenueVelocityReport(
          parseRevenueVelocityRequest(request.query)
        )
      );
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

  app.get("/api/sales-plan", async (request, response, next) => {
    try {
      const query = salesPlanQuerySchema.parse(request.query);
      response.json(
        await service.getSalesPlan({
          periodStart: query.from,
          periodEnd: query.to
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/sales-plan", async (request, response, next) => {
    try {
      const payload = salesPlanBodySchema.parse(request.body);
      response.json(await service.replaceSalesPlan(payload));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sync", async (request, response, next) => {
    if (activeSync) {
      response.status(409).json(createErrorResponse("SYNC_ALREADY_RUNNING"));
      return;
    }

    if (wantsSyncStream(request)) {
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders?.();

      try {
        activeSync = service.performSync({
          onProgress: (event) => {
            writeSyncEvent(response, "progress", event);
          }
        });
        const summary = await activeSync;
        writeSyncEvent(response, "complete", summary);
        response.end();
      } catch (error) {
        writeSyncEvent(response, "error", createSyncErrorResponse(error));
        response.end();
      } finally {
        activeSync = null;
      }
      return;
    }

    try {
      activeSync = service.performSync();
      response.json(await activeSync);
    } catch (error) {
      next(error);
    } finally {
      activeSync = null;
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
        response
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", error.flatten()));
        return;
      }

      console.error(error);

      response.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  );

  return app;
}
