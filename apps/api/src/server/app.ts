import { randomUUID } from "node:crypto";

import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  CohortConversionReport,
  ConversionEventsReport,
  DashboardData,
  DealPricingSettings,
  DealPricingSettingsInput,
  ManagerActionOutcomeReport,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  RevenueVelocityDimension,
  RevenueVelocityReport,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
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

import type {
  AuthenticatedSession,
  AuthModule,
  ModulePermission,
  ModuleRole,
  PasswordAuthService
} from "./auth.js";
import { AuthError } from "./auth.js";
import type { PaperclipIssueCreator } from "./paperclip-client.js";
import type {
  DashboardCommentContext,
  DashboardCommentRecord,
  ProtoCommentAnchor,
  ProtoCommentStore
} from "./sqlite-repository.js";

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
  getSalesPlanQuarter(input: {
    year: number;
    quarter: number;
  }): Promise<SalesPlanQuarterData>;
  replaceSalesPlanQuarter(input: SalesPlanQuarterInput): Promise<SalesPlanQuarterData>;
  getEffectiveSalesPlan(input: {
    periodStart: string;
    periodEnd: string;
  }): Promise<SalesPlanData>;
  getPricingSettings(): Promise<DealPricingSettings>;
  replacePricingSettings(input: DealPricingSettingsInput): Promise<DealPricingSettings>;
  getMeta(): Promise<MetaResponse>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

interface ProtoCommentsStore {
  getProtoComments(): Promise<ProtoCommentStore>;
  replaceProtoComments(input: ProtoCommentStore): Promise<ProtoCommentStore>;
}

interface DashboardCommentsStore {
  createComment(input: {
    id: string;
    moduleKey: string;
    authorUserId: number;
    authorLogin: string;
    sceneId: string;
    x: number;
    y: number;
    text: string;
    createdAt: string;
    updatedAt: string;
    context?: DashboardCommentContext | null;
    anchor?: ProtoCommentAnchor;
  }): Promise<DashboardCommentRecord>;
  getComments(input: {
    moduleKey: string;
    status?: "open" | "archived";
  }): Promise<DashboardCommentRecord[]>;
  getCommentById(id: string): Promise<DashboardCommentRecord | null>;
  updateComment(input: {
    id: string;
    text: string;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  archiveComment(input: {
    id: string;
    archivedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  updateCommentPaperclip(input: {
    id: string;
    paperclipStatus: "queued" | "sent" | "in_work" | "needs_input" | "done" | "failed";
    paperclipIssueId?: string | null;
    paperclipIssueIdentifier?: string | null;
    paperclipError?: string | null;
    paperclipSyncedAt?: string | null;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  getCommentNotifications(input: {
    moduleKey: string;
  }): Promise<DashboardCommentRecord[]>;
}

interface AppConfig {
  webOrigin?: string;
  apiAuthToken?: string;
  auth?: PasswordAuthService;
  protoComments?: ProtoCommentsStore;
  comments?: DashboardCommentsStore;
  paperclip?: PaperclipIssueCreator;
  jsonBodyLimit?: string;
  trustProxy?: string | boolean | number;
  webStaticDir?: string;
  syncStreamHeartbeatMs?: number;
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

const protoCommentAnchorSchema = z.object({
  blockId: z.string().trim().min(1).max(500),
  blockLabel: z.string().trim().min(1).max(500),
  blockSelector: z.string().trim().min(1).max(1000),
  blockRole: z.string().trim().min(1).max(100).nullable(),
  elementSelector: z.string().trim().min(1).max(1000),
  elementLabel: z.string().trim().max(500),
  relativeX: z.number().finite().min(0).max(1),
  relativeY: z.number().finite().min(0).max(1)
});

const protoCommentSchema = z.object({
  id: z.string().trim().min(1).max(200),
  sceneId: z.string().trim().min(1).max(200),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  text: z.string().trim().min(1).max(5000),
  status: z.enum(["open", "archived"]).default("open"),
  archivedAt: z.string().datetime({ offset: true }).nullable().optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  anchor: protoCommentAnchorSchema.optional()
});

const protoCommentsBodySchema = z.object({
  comments: z.array(protoCommentSchema).max(500)
});

const commentContextSchema = z.object({
  range: z
    .object({
      from: z.string().datetime({ offset: true }),
      to: z.string().datetime({ offset: true })
    })
    .optional(),
  filters: z
    .object({
      managerIds: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
      sourceKeys: z.array(z.string().trim().min(1).max(100)).max(100).optional()
    })
    .optional()
});

const createCommentBodySchema = z.object({
  sceneId: z.string().trim().min(1).max(200),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  text: z.string().trim().min(1).max(5000),
  context: commentContextSchema.optional(),
  anchor: protoCommentAnchorSchema.optional()
});

const updateCommentBodySchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(["open", "archived"]).optional()
});

const moduleUserRoleSchema = z.enum(["leader", "employee"]);

const createModuleUserBodySchema = z.object({
  login: z.string().trim().min(1).max(128),
  password: z.string().min(8).max(1024),
  role: moduleUserRoleSchema
});

const updateModuleUserBodySchema = z
  .object({
    disabled: z.boolean().optional(),
    role: moduleUserRoleSchema.optional()
  })
  .refine((value) => value.disabled !== undefined || value.role !== undefined, {
    message: "At least one field must be provided."
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

function expectedQuarterMonths(year: number, quarter: number) {
  const firstMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map(
    (offset) => `${year}-${String(firstMonth + offset).padStart(2, "0")}`
  );
}

const salesPlanQuarterQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4)
});

const salesPlanQuarterBodySchema = z
  .object({
    year: z.number().int().min(2000).max(2100),
    quarter: z.number().int().min(1).max(4),
    rows: z.array(
      z.object({
        managerId: z.string().min(1),
        managerName: z.string().trim().min(1).nullable().optional(),
        targetGroupKey: z.string().min(1),
        targetGroupLabel: z.string().trim().min(1).nullable().optional(),
        quarterPlannedDeals: z.number().int().nonnegative(),
        quarterPlannedAmount: z.number().int().nonnegative(),
        months: z.array(
          z.object({
            month: z.string().regex(/^\d{4}-\d{2}$/),
            plannedDeals: z.number().int().nonnegative(),
            plannedAmount: z.number().int().nonnegative()
          })
        )
      })
    )
  })
  .superRefine((value, context) => {
    const expectedMonths = expectedQuarterMonths(value.year, value.quarter);

    value.rows.forEach((row, rowIndex) => {
      const monthKeys = row.months.map((month) => month.month);
      const hasExpectedMonths =
        row.months.length === expectedMonths.length &&
        expectedMonths.every((month) => monthKeys.includes(month));

      if (!hasExpectedMonths) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter months must match the selected quarter.",
          path: ["rows", rowIndex, "months"]
        });
      }

      const plannedDeals = row.months.reduce(
        (total, month) => total + month.plannedDeals,
        0
      );
      const plannedAmount = row.months.reduce(
        (total, month) => total + month.plannedAmount,
        0
      );

      if (plannedDeals !== row.quarterPlannedDeals) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter planned deals must equal the sum of month planned deals.",
          path: ["rows", rowIndex, "quarterPlannedDeals"]
        });
      }

      if (plannedAmount !== row.quarterPlannedAmount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "quarter planned amount must equal the sum of month planned amounts.",
          path: ["rows", rowIndex, "quarterPlannedAmount"]
        });
      }
    });
  });

const pricingSettingsBodySchema = z.object({
  rules: z.array(
    z.object({
      id: z.string().trim().min(1),
      customerLabel: z.string().trim().min(1),
      tariffLabel: z.string().trim().min(1),
      attractionRevenueAmount: z.number().finite().nonnegative(),
      enabled: z.boolean(),
      sortOrder: z.number().int().nonnegative().nullable().optional()
    })
  )
});

const loginBodySchema = z.object({
  login: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(1024)
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

const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isMutatingMethod(method: string) {
  return mutatingMethods.has(method.toUpperCase());
}

function parseCookieHeader(value: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of value?.split(";") ?? []) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const cookieValue = part.slice(separatorIndex + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(cookieValue));
    } catch {
      // Ignore malformed cookie values and let auth fail normally.
    }
  }

  return cookies;
}

function readSessionCookie(request: express.Request, cookieName: string) {
  return parseCookieHeader(request.header("Cookie")).get(cookieName);
}

function readAuthSession(response: express.Response) {
  return response.locals.authSession as AuthenticatedSession | undefined;
}

function requireAuthSession(response: express.Response) {
  const session = readAuthSession(response);
  if (!session) {
    response.status(401).json(createErrorResponse("UNAUTHORIZED"));
    return null;
  }
  return session;
}

function requireModule(
  response: express.Response,
  permission?: ModulePermission,
  moduleKey = "attraction"
): AuthModule | null {
  const session = requireAuthSession(response);
  if (!session) {
    return null;
  }

  const module = session.user.modules.find((item) => item.key === moduleKey);
  if (!module) {
    response.status(403).json(createErrorResponse("MODULE_ACCESS_DENIED"));
    return null;
  }

  if (permission && !module.permissions.includes(permission)) {
    response.status(403).json(createErrorResponse("PERMISSION_DENIED"));
    return null;
  }

  return module;
}

function sanitizePaperclipText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted]")
    .replace(/(token|webhook|cookie|authorization)\s*[:=]\s*\S+/gi, "[redacted]")
    .replace(/\b(email|phone|token|webhook|cookie)\b/gi, "[redacted]");
}

function summarizeCommentContext(context: DashboardCommentContext | null) {
  if (!context) {
    return "context: none";
  }

  return [
    context.range
      ? `range: ${context.range.from} - ${context.range.to}`
      : "range: none",
    `managerIds: ${(context.filters?.managerIds ?? []).join(",") || "none"}`,
    `sourceKeys: ${(context.filters?.sourceKeys ?? []).join(",") || "none"}`
  ].join("\n");
}

function buildPaperclipIssue(input: {
  comment: DashboardCommentRecord;
  companyId: string;
  projectId: string;
  goalId: string;
  assigneeAgentId: string;
}) {
  const anchor = input.comment.anchor;
  const titleAnchor = sanitizePaperclipText(
    anchor?.blockLabel || input.comment.sceneId
  ).slice(0, 120);
  const description = [
    "Dashboard comment intake",
    "",
    `module: ${input.comment.moduleKey}`,
    `authorLogin: ${sanitizePaperclipText(input.comment.authorLogin)}`,
    `sceneId: ${sanitizePaperclipText(input.comment.sceneId)}`,
    anchor
      ? [
          `blockId: ${sanitizePaperclipText(anchor.blockId)}`,
          `blockLabel: ${sanitizePaperclipText(anchor.blockLabel)}`,
          `blockSelector: ${sanitizePaperclipText(anchor.blockSelector)}`,
          `elementSelector: ${sanitizePaperclipText(anchor.elementSelector)}`,
          `relative: ${anchor.relativeX},${anchor.relativeY}`
        ].join("\n")
      : "anchor: none",
    summarizeCommentContext(input.comment.context),
    "",
    "Comment text:",
    sanitizePaperclipText(input.comment.text),
    "",
    "Implementation instructions:",
    "- Work through GitHub/CI; do not use SSH/root access as part of the normal dashboard workflow.",
    "- Do not request or persist personal contact fields, raw upstream payloads, session credentials, or integration secrets.",
    "- Preserve attraction manager report scoping unless the linked task explicitly changes it."
  ].join("\n");

  return {
    companyId: input.companyId,
    projectId: input.projectId,
    goalId: input.goalId,
    assigneeAgentId: input.assigneeAgentId,
    title: `Комментарий из дашборда: ${titleAnchor}`,
    description,
    priority: "medium" as const
  };
}

function mapPaperclipIssueStatus(
  status: string | null | undefined
): DashboardCommentRecord["paperclipStatus"] {
  switch (status) {
    case "in_progress":
    case "in_review":
      return "in_work";
    case "blocked":
      return "needs_input";
    case "done":
      return "done";
    case "cancelled":
      return "failed";
    case "backlog":
    case "todo":
    default:
      return "sent";
  }
}

async function deliverCommentToPaperclip(input: {
  comments: DashboardCommentsStore;
  paperclip: PaperclipIssueCreator | undefined;
  comment: DashboardCommentRecord;
  moduleConfig: {
    paperclipCompanyId: string | null;
    paperclipProjectId: string | null;
    paperclipGoalId: string | null;
    paperclipTriageAgentId: string | null;
  } | null;
}) {
  const queuedAt = new Date().toISOString();
  let comment =
    input.comment.paperclipStatus === "queued"
      ? input.comment
      : ((await input.comments.updateCommentPaperclip({
          id: input.comment.id,
          paperclipStatus: "queued",
          paperclipError: null,
          paperclipSyncedAt: null,
          updatedAt: queuedAt
        })) ?? input.comment);

  try {
    if (
      !input.paperclip ||
      !input.moduleConfig?.paperclipCompanyId ||
      !input.moduleConfig.paperclipProjectId ||
      !input.moduleConfig.paperclipGoalId ||
      !input.moduleConfig.paperclipTriageAgentId
    ) {
      throw new Error("Paperclip integration is not configured.");
    }

    const issue = await input.paperclip.createIssue(
      buildPaperclipIssue({
        comment,
        companyId: input.moduleConfig.paperclipCompanyId,
        projectId: input.moduleConfig.paperclipProjectId,
        goalId: input.moduleConfig.paperclipGoalId,
        assigneeAgentId: input.moduleConfig.paperclipTriageAgentId
      })
    );

    comment =
      (await input.comments.updateCommentPaperclip({
        id: comment.id,
        paperclipStatus: mapPaperclipIssueStatus(issue.status),
        paperclipIssueId: issue.id,
        paperclipIssueIdentifier: issue.identifier ?? null,
        paperclipError: null,
        paperclipSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) ?? comment;
  } catch (error) {
    comment =
      (await input.comments.updateCommentPaperclip({
        id: comment.id,
        paperclipStatus: "failed",
        paperclipError: sanitizePaperclipText(
          error instanceof Error ? error.message : String(error)
        ),
        paperclipSyncedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })) ?? comment;
  }

  return comment;
}

async function refreshPaperclipCommentStatuses(input: {
  comments: DashboardCommentsStore;
  paperclip: PaperclipIssueCreator | undefined;
  records: DashboardCommentRecord[];
}) {
  if (!input.paperclip?.getIssue) {
    return input.records;
  }

  const refreshed: DashboardCommentRecord[] = [];
  for (const comment of input.records) {
    if (!comment.paperclipIssueId) {
      refreshed.push(comment);
      continue;
    }

    try {
      const issue = await input.paperclip.getIssue(comment.paperclipIssueId);
      const paperclipStatus = mapPaperclipIssueStatus(issue.status);
      const nextComment =
        (await input.comments.updateCommentPaperclip({
          id: comment.id,
          paperclipStatus,
          paperclipIssueId: issue.id,
          paperclipIssueIdentifier: issue.identifier ?? comment.paperclipIssueIdentifier,
          paperclipError: null,
          paperclipSyncedAt: new Date().toISOString(),
          updatedAt: comment.updatedAt
        })) ?? comment;
      refreshed.push(nextComment);
    } catch {
      refreshed.push(comment);
    }
  }

  return refreshed;
}

function writeSessionCookie(
  response: express.Response,
  auth: PasswordAuthService,
  sessionToken: string,
  expiresAt: string
) {
  response.cookie(auth.cookieName, sessionToken, {
    httpOnly: true,
    secure: auth.secureCookie,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    maxAge: auth.ttlMs
  });
}

function clearSessionCookie(response: express.Response, auth: PasswordAuthService) {
  response.clearCookie(auth.cookieName, {
    httpOnly: true,
    secure: auth.secureCookie,
    sameSite: "lax",
    path: "/"
  });
}

function createSecurityHeadersMiddleware() {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");

  return (
    _request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()"
    );
    response.setHeader("Content-Security-Policy", contentSecurityPolicy);
    next();
  };
}

function isDeniedWebPath(pathname: string) {
  let decodedPathname = pathname;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return true;
  }

  const lowerPathname = decodedPathname.toLowerCase();
  const segments = lowerPathname.split("/").filter(Boolean);

  return (
    segments.some((segment) => segment.startsWith(".")) ||
    lowerPathname === "/.env" ||
    lowerPathname.startsWith("/.env.") ||
    lowerPathname.startsWith("/.codex") ||
    lowerPathname.startsWith("/apps/api/data") ||
    lowerPathname.startsWith("/backups")
  );
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

function logInternalError(error: unknown) {
  const payload = {
    errorName: error instanceof Error ? error.name : typeof error,
    causeCode: getErrorCauseCode(error) || undefined
  };

  console.error("api.internal_error", JSON.stringify(payload));
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

function writeSyncKeepalive(response: express.Response) {
  if (response.destroyed || response.writableEnded) {
    return;
  }

  response.write(": keepalive\n\n");
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

export function createApp(
  service: AppService,
  config: AppConfig = {}
): express.Express {
  const app = express();
  let activeSync: Promise<ManualSyncSummary> | null = null;
  const webOrigin = config.webOrigin?.trim() || "http://localhost:5173";
  const apiAuthToken = config.apiAuthToken?.trim() || undefined;
  const auth = config.auth;
  const comments = config.comments;
  const paperclip = config.paperclip;

  app.disable("x-powered-by");

  if (config.trustProxy !== undefined) {
    app.set("trust proxy", config.trustProxy);
  }

  app.use(createSecurityHeadersMiddleware());

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin) {
          callback(null, false);
          return;
        }

        callback(null, isAllowedWebOrigin(origin, webOrigin) ? origin : false);
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Token",
        "X-CSRF-Token"
      ]
    })
  );
  app.use(express.json({ limit: config.jsonBodyLimit ?? "256kb" }));

  app.post("/api/auth/login", async (request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const payload = loginBodySchema.parse(request.body);
      const rateLimitKey = request.ip ?? request.socket.remoteAddress ?? "unknown";
      const loginResult = await auth.login({
        login: payload.login,
        password: payload.password,
        rateLimitKey,
        metadata: {
          ip: rateLimitKey,
          userAgent: request.header("User-Agent") ?? null
        }
      });

      writeSessionCookie(
        response,
        auth,
        loginResult.sessionToken,
        loginResult.expiresAt
      );
      response.json({
        user: loginResult.user,
        csrfToken: loginResult.csrfToken
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(async (request, response, next) => {
    if (!auth || !request.path.startsWith("/api/")) {
      next();
      return;
    }

    if (request.path === "/api/health" || request.path === "/api/auth/login") {
      next();
      return;
    }

    const sessionToken = readSessionCookie(request, auth.cookieName);

    if (!sessionToken) {
      response.status(401).json(createErrorResponse("UNAUTHORIZED"));
      return;
    }

    const session = await auth.getSession(sessionToken);
    if (!session) {
      clearSessionCookie(response, auth);
      response.status(401).json(createErrorResponse("SESSION_EXPIRED"));
      return;
    }

    response.locals.authSession = session;

    if (isMutatingMethod(request.method)) {
      const csrfToken = request.header("X-CSRF-Token")?.trim();
      if (!csrfToken || !auth.verifyCsrfToken(session, csrfToken)) {
        response.status(403).json(createErrorResponse("CSRF_TOKEN_INVALID"));
        return;
      }
    }

    next();
  });

  app.use((request, response, next) => {
    if (auth || !apiAuthToken || !request.path.startsWith("/api/")) {
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

  app.get("/api/auth/me", async (_request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const session = readAuthSession(response);
      if (!session) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      response.json({
        user: session.user,
        csrfToken: await auth.issueCsrfToken(session)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", async (_request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const session = readAuthSession(response);
      if (session) {
        await auth.logout(session.sessionToken);
      }
      clearSessionCookie(response, auth);
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/proto-comments", async (_request, response, next) => {
    if (!config.protoComments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      response.json(await config.protoComments.getProtoComments());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/proto-comments", async (request, response, next) => {
    if (!config.protoComments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const payload = protoCommentsBodySchema.parse(request.body);
      response.json(
        await config.protoComments.replaceProtoComments({
          comments: payload.comments.map((comment) => ({
            id: comment.id,
            sceneId: comment.sceneId,
            x: comment.x,
            y: comment.y,
            text: comment.text,
            status: comment.status,
            archivedAt: comment.archivedAt ?? null,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            ...(comment.anchor ? { anchor: comment.anchor } : {})
          })),
          updatedAt: new Date().toISOString()
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/comments", async (_request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response);
      if (!module) {
        return;
      }

      response.json({
        comments: await comments.getComments({ moduleKey: module.key })
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments", async (request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response, "comments:create");
      const session = readAuthSession(response);
      if (!module || !session || !auth) {
        return;
      }

      const payload = createCommentBodySchema.parse(request.body);
      const context: DashboardCommentContext | undefined = payload.context
        ? {
            ...(payload.context.range ? { range: payload.context.range } : {}),
            ...(payload.context.filters
              ? {
                  filters: {
                    ...(payload.context.filters.managerIds
                      ? { managerIds: payload.context.filters.managerIds }
                      : {}),
                    ...(payload.context.filters.sourceKeys
                      ? { sourceKeys: payload.context.filters.sourceKeys }
                      : {})
                  }
                }
              : {})
          }
        : undefined;
      const now = new Date().toISOString();
      let comment = await comments.createComment({
        id: randomUUID(),
        moduleKey: module.key,
        authorUserId: session.user.id,
        authorLogin: session.user.login,
        sceneId: payload.sceneId,
        x: payload.x,
        y: payload.y,
        text: payload.text,
        createdAt: now,
        updatedAt: now,
        ...(context ? { context } : {}),
        ...(payload.anchor ? { anchor: payload.anchor } : {})
      });

      const moduleConfig = await auth.getModuleConfig(module.key);
      comment = await deliverCommentToPaperclip({
        comments,
        paperclip,
        comment,
        moduleConfig
      });

      response.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/comments/:id", async (request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response);
      const session = readAuthSession(response);
      if (!module || !session) {
        return;
      }

      const payload = updateCommentBodySchema.parse(request.body);
      const existing = await comments.getCommentById(request.params.id);
      if (!existing || existing.moduleKey !== module.key) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const canManage = module.permissions.includes("comments:archive");
      if (payload.status === "archived") {
        if (!canManage) {
          response.status(403).json(createErrorResponse("PERMISSION_DENIED"));
          return;
        }
        response.json(
          await comments.archiveComment({
            id: existing.id,
            archivedAt: new Date().toISOString()
          })
        );
        return;
      }

      if (payload.text) {
        if (existing.authorUserId !== session.user.id) {
          response.status(403).json(createErrorResponse("PERMISSION_DENIED"));
          return;
        }

        response.json(
          await comments.updateComment({
            id: existing.id,
            text: payload.text,
            updatedAt: new Date().toISOString()
          })
        );
        return;
      }

      response.json(existing);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/retry", async (request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response);
      const session = readAuthSession(response);
      if (!module || !session || !auth) {
        return;
      }

      const existing = await comments.getCommentById(request.params.id);
      if (!existing || existing.moduleKey !== module.key) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      const canManage = module.permissions.includes("comments:archive");
      if (existing.authorUserId !== session.user.id && !canManage) {
        response.status(403).json(createErrorResponse("PERMISSION_DENIED"));
        return;
      }

      if (
        existing.paperclipStatus !== "failed" &&
        existing.paperclipStatus !== "queued"
      ) {
        response.json(existing);
        return;
      }

      response.json(
        await deliverCommentToPaperclip({
          comments,
          paperclip,
          comment: existing,
          moduleConfig: await auth.getModuleConfig(module.key)
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/archive", async (request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response, "comments:archive");
      if (!module) {
        return;
      }

      const existing = await comments.getCommentById(request.params.id);
      if (!existing || existing.moduleKey !== module.key) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      response.json(
        await comments.archiveComment({
          id: existing.id,
          archivedAt: new Date().toISOString()
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/comment-notifications", async (_request, response, next) => {
    if (!comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response);
      if (!module) {
        return;
      }

      const notifications = await comments.getCommentNotifications({
        moduleKey: module.key
      });

      response.json({
        notifications: await refreshPaperclipCommentStatuses({
          comments,
          paperclip,
          records: notifications
        })
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/module-users", async (_request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response, "module-users:manage");
      if (!module) {
        return;
      }

      response.json({
        users: await auth.listModuleUsers(module.key)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/module-users", async (request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response, "module-users:manage");
      if (!module) {
        return;
      }

      const payload = createModuleUserBodySchema.parse(request.body);
      response.status(201).json(
        await auth.createModuleUser({
          login: payload.login,
          password: payload.password,
          moduleKey: module.key,
          role: payload.role as ModuleRole
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/module-users/:id", async (request, response, next) => {
    if (!auth) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const module = requireModule(response, "module-users:manage");
      if (!module) {
        return;
      }

      const userId = Number(request.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
        return;
      }

      const payload = updateModuleUserBodySchema.parse(request.body);
      const user = await auth.updateModuleUser({
        userId,
        moduleKey: module.key,
        ...(payload.role ? { role: payload.role as ModuleRole } : {}),
        ...(payload.disabled !== undefined ? { disabled: payload.disabled } : {})
      });
      if (!user) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      response.json(user);
    } catch (error) {
      next(error);
    }
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

  app.get("/api/sales-plan/quarter", async (request, response, next) => {
    try {
      const query = salesPlanQuarterQuerySchema.parse(request.query);
      response.json(
        await service.getSalesPlanQuarter({
          year: query.year,
          quarter: query.quarter
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/sales-plan/quarter", async (request, response, next) => {
    try {
      const payload = salesPlanQuarterBodySchema.parse(request.body);
      response.json(await service.replaceSalesPlanQuarter(payload));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sales-plan/effective", async (request, response, next) => {
    try {
      const query = salesPlanQuerySchema.parse(request.query);
      response.json(
        await service.getEffectiveSalesPlan({
          periodStart: query.from,
          periodEnd: query.to
        })
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/settings/pricing", async (_request, response, next) => {
    try {
      response.json(await service.getPricingSettings());
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/settings/pricing", async (request, response, next) => {
    try {
      const payload = pricingSettingsBodySchema.parse(request.body);
      response.json(
        await service.replacePricingSettings({
          rules: payload.rules.map((rule, index) => ({
            id: rule.id,
            customerLabel: rule.customerLabel,
            tariffLabel: rule.tariffLabel,
            attractionRevenueAmount: rule.attractionRevenueAmount,
            enabled: rule.enabled,
            sortOrder: rule.sortOrder ?? index * 10
          }))
        })
      );
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

      const heartbeat = setInterval(
        () => writeSyncKeepalive(response),
        config.syncStreamHeartbeatMs ?? 15_000
      );

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
        clearInterval(heartbeat);
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

  if (config.webStaticDir) {
    app.use((request, response, next) => {
      if (
        !request.path.startsWith("/api/") &&
        isDeniedWebPath(request.path)
      ) {
        response.status(404).end();
        return;
      }

      next();
    });
    app.use(
      express.static(config.webStaticDir, {
        dotfiles: "deny",
        index: false
      })
    );
    app.use((request, response, next) => {
      if (
        request.path.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method)
      ) {
        next();
        return;
      }

      response.sendFile(
        "index.html",
        {
          root: config.webStaticDir,
          dotfiles: "deny"
        },
        (error) => {
          if (error) {
            next(error);
          }
        }
      );
    });
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof AuthError) {
        response.status(error.status).json(createErrorResponse(error.code));
        return;
      }

      if (error instanceof z.ZodError) {
        response
          .status(400)
          .json(createErrorResponse("VALIDATION_ERROR", error.flatten()));
        return;
      }

      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error as { type?: unknown }).type === "entity.too.large"
      ) {
        response.status(413).json(createErrorResponse("PAYLOAD_TOO_LARGE"));
        return;
      }

      logInternalError(error);

      response.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  );

  return app;
}
