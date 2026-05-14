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
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { z } from "zod";

import type {
  AuthenticatedSession,
  AuthenticatedModule,
  ModulePermission,
  ModuleRole,
  PasswordAuthService,
  SqliteAuthStore
} from "./auth.js";
import { AuthError, hashPassword, verifyPassword } from "./auth.js";
import type {
  DashboardCommentContext,
  DashboardCommentRecord,
  PaperclipCommentStatus,
  ProtoCommentStore
} from "./sqlite-repository.js";
import type {
  PaperclipIssueClient,
  PaperclipIssueComment
} from "./paperclip-client.js";

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
  getDashboardComments(moduleId: string): Promise<{
    comments: DashboardCommentRecord[];
    updatedAt: string | null;
  }>;
  getDashboardCommentById(id: string): Promise<DashboardCommentRecord | null>;
  createDashboardComment(input: DashboardCommentRecord): Promise<DashboardCommentRecord>;
  updateDashboardComment(input: {
    id: string;
    text?: string;
    context?: DashboardCommentContext;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  archiveDashboardComment(input: {
    id: string;
    archivedAt: string;
    updatedAt: string;
  }): Promise<DashboardCommentRecord | null>;
  updateDashboardCommentPaperclip(input: {
    id: string;
    paperclipIssueId?: string | null;
    paperclipIssueIdentifier?: string | null;
    paperclipStatus: PaperclipCommentStatus;
    paperclipSyncStatus: "queued" | "syncing" | "sent" | "failed";
    paperclipError?: string | null;
    paperclipLastSyncedAt?: string | null;
    incrementRetryCount?: boolean;
  }): Promise<DashboardCommentRecord | null>;
}

interface DashboardPaperclipReadyReport {
  id: string;
  body: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

type DashboardPaperclipThreadEntryKind =
  | "development_report"
  | "dashboard_rework"
  | "board_note"
  | "system_note";

interface DashboardPaperclipThreadEntry extends DashboardPaperclipReadyReport {
  kind: DashboardPaperclipThreadEntryKind;
}

type DashboardCommentView = DashboardCommentRecord & {
  paperclipReadyReport?: DashboardPaperclipReadyReport | null;
  paperclipThread?: DashboardPaperclipThreadEntry[];
};

interface AppConfig {
  webOrigin?: string;
  apiAuthToken?: string;
  auth?: PasswordAuthService;
  authStore?: SqliteAuthStore;
  comments?: DashboardCommentsStore;
  paperclip?: PaperclipIssueClient;
  protoComments?: ProtoCommentsStore;
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

const commentContextSchema = z
  .object({
    filters: z.unknown().optional()
  })
  .catchall(z.unknown())
  .optional();

const createCommentBodySchema = z.object({
  sceneId: z.string().trim().min(1).max(200),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  text: z.string().trim().min(1).max(5000),
  anchor: protoCommentAnchorSchema.optional(),
  context: commentContextSchema
});

const updateCommentBodySchema = z.object({
  text: z.string().trim().min(1).max(5000).optional(),
  context: commentContextSchema
});

const reworkCommentBodySchema = z.object({
  text: z.string().trim().min(1).max(5000)
});

const createModuleUserBodySchema = z.object({
  login: z.string().trim().email().max(200),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  password: z.string().min(8).max(200),
  role: z.enum(["leader", "employee"]).default("employee")
});

const updateModuleUserBodySchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["leader", "employee"]).optional(),
  disabled: z.boolean().optional(),
  membershipStatus: z.enum(["active", "disabled"]).optional()
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

const updateCurrentUserBodySchema = z.object({
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional()
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(200)
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

function normalizeProfileField(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function getModuleAccess(
  session: AuthenticatedSession | undefined,
  moduleId = "attraction"
): AuthenticatedModule | null {
  return (
    session?.user.modules.find(
      (module) => module.id === moduleId || module.slug === moduleId
    ) ?? null
  );
}

function hasModulePermission(
  module: AuthenticatedModule,
  permission: ModulePermission
) {
  return module.permissions.includes(permission);
}

function requireModuleAccess(
  response: express.Response,
  permission?: ModulePermission
) {
  const session = readAuthSession(response);
  const module = getModuleAccess(session);

  if (!session || !module) {
    return null;
  }

  if (permission && !hasModulePermission(module, permission)) {
    return null;
  }

  return {
    session,
    module
  };
}

function sanitizePaperclipText(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
    .replace(/BITRIX24_WEBHOOK_TOKEN\s*[:=]\s*\S+/gi, "BITRIX24_WEBHOOK_TOKEN=[redacted]");
}

function formatJsonForPaperclip(value: unknown) {
  if (value === undefined || value === null) {
    return "null";
  }

  return sanitizePaperclipText(JSON.stringify(value, null, 2));
}

function buildPaperclipIssueDescription(input: {
  module: AuthenticatedModule;
  authorLogin: string;
  comment: DashboardCommentRecord;
}) {
  const anchor = input.comment.anchor
    ? {
        blockId: input.comment.anchor.blockId,
        blockLabel: input.comment.anchor.blockLabel,
        blockSelector: input.comment.anchor.blockSelector,
        blockRole: input.comment.anchor.blockRole,
        elementSelector: input.comment.anchor.elementSelector,
        elementLabel: input.comment.anchor.elementLabel,
        relativeX: input.comment.anchor.relativeX,
        relativeY: input.comment.anchor.relativeY
      }
    : null;

  return [
    "## Dashboard Comment",
    "",
    `Module: ${input.module.slug}`,
    `Author login: ${sanitizePaperclipText(input.authorLogin)}`,
    `Scene: ${input.comment.sceneId}`,
    "",
    "### Anchor",
    "",
    "```json",
    formatJsonForPaperclip(anchor),
    "```",
    "",
    "### Filters And Range",
    "",
    "```json",
    formatJsonForPaperclip(input.comment.context ?? null),
    "```",
    "",
    "### Comment Text",
    "",
    sanitizePaperclipText(input.comment.text),
    "",
    "### Implementation Instructions",
    "",
    "- Work in the Bitrix24 attraction dashboard repository.",
    "- Keep attraction manager scoping intact.",
    "- Do not request SSH/root access as part of normal implementation.",
    "- Do not include deal/contact names, phones, emails, raw Bitrix payloads, or secrets in follow-up comments.",
    "- Create a focused branch/PR through the normal GitHub/CI workflow."
  ].join("\n");
}

function buildPaperclipReworkComment(input: {
  module: AuthenticatedModule;
  authorLogin: string;
  comment: DashboardCommentRecord;
  text: string;
}) {
  const anchor = input.comment.anchor
    ? {
        blockId: input.comment.anchor.blockId,
        blockLabel: input.comment.anchor.blockLabel,
        blockSelector: input.comment.anchor.blockSelector,
        blockRole: input.comment.anchor.blockRole,
        elementSelector: input.comment.anchor.elementSelector,
        elementLabel: input.comment.anchor.elementLabel,
        relativeX: input.comment.anchor.relativeX,
        relativeY: input.comment.anchor.relativeY
      }
    : null;

  return [
    "@Dashboard Engineering Manager",
    "",
    "## Возврат на доработку из dashboard review",
    "",
    `Module: ${input.module.slug}`,
    "Source: dashboard-system / board-originated rework",
    `Dashboard author login: ${sanitizePaperclipText(input.authorLogin)}`,
    `Dashboard comment id: ${sanitizePaperclipText(input.comment.id)}`,
    `Paperclip issue: ${sanitizePaperclipText(input.comment.paperclipIssueIdentifier ?? input.comment.paperclipIssueId ?? "")}`,
    "",
    "### Пользовательский комментарий",
    "",
    sanitizePaperclipText(input.text),
    "",
    "### Исходный dashboard comment",
    "",
    sanitizePaperclipText(input.comment.text),
    "",
    "### Anchor",
    "",
    "```json",
    formatJsonForPaperclip(anchor),
    "```",
    "",
    "### Filters And Range",
    "",
    "```json",
    formatJsonForPaperclip(input.comment.context ?? null),
    "```",
    "",
    "### Required Handoff",
    "",
    "- Ответить в этом же issue с мини-отчетом: что сделано, root cause, как теперь работает, что проверено.",
    "- Если нужен продуктовый выбор, не угадывать поведение: предложить варианты и ждать board comment.",
    "- Не включать имена/контакты, телефоны, email, raw Bitrix payloads, cookies, tokens или secrets."
  ].join("\n");
}

function mapPaperclipIssueStatus(status: string | null | undefined): PaperclipCommentStatus {
  if (status === "in_progress" || status === "in_review") {
    return "in_work";
  }
  if (status === "blocked") {
    return "needs_input";
  }
  if (status === "done" || status === "cancelled") {
    return "done";
  }
  return "sent";
}

function isDashboardOriginatedPaperclipComment(comment: PaperclipIssueComment) {
  const body = comment.body.toLowerCase();
  return (
    body.includes("source: dashboard-system / board-originated rework") ||
    body.includes("возврат на доработку из dashboard review")
  );
}

function toPaperclipReadyReport(
  comment: PaperclipIssueComment
): DashboardPaperclipReadyReport {
  return {
    id: comment.id,
    body: sanitizePaperclipText(comment.body).trim(),
    authorAgentId: comment.authorAgentId,
    authorUserId: comment.authorUserId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function getPaperclipThreadEntryKind(
  comment: PaperclipIssueComment
): DashboardPaperclipThreadEntryKind {
  if (isDashboardOriginatedPaperclipComment(comment)) {
    return "dashboard_rework";
  }
  if (comment.authorAgentId) {
    return "development_report";
  }
  if (comment.authorUserId) {
    return "board_note";
  }
  return "system_note";
}

function toPaperclipThreadEntry(
  comment: PaperclipIssueComment
): DashboardPaperclipThreadEntry {
  return {
    ...toPaperclipReadyReport(comment),
    kind: getPaperclipThreadEntryKind(comment)
  };
}

function selectPaperclipThread(
  comments: PaperclipIssueComment[]
): DashboardPaperclipThreadEntry[] {
  return comments
    .filter((comment) => comment.body.trim().length > 0)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return (Number.isNaN(leftTime) ? 0 : leftTime) - (Number.isNaN(rightTime) ? 0 : rightTime);
    })
    .map(toPaperclipThreadEntry);
}

function selectPaperclipReadyReport(
  comments: PaperclipIssueComment[] | DashboardPaperclipThreadEntry[]
): DashboardPaperclipReadyReport | null {
  const candidates = comments
    .filter((comment) => comment.body.trim().length > 0)
    .filter((comment) => comment.authorAgentId)
    .filter((comment) =>
      "kind" in comment
        ? comment.kind === "development_report"
        : !isDashboardOriginatedPaperclipComment(comment)
    )
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      return rightTime - leftTime;
    });

  const latest = candidates[0];
  return latest ? toPaperclipReadyReport(latest) : null;
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

  app.patch("/api/auth/me", async (request, response, next) => {
    if (!auth || !config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const session = readAuthSession(response);
      if (!session) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      const payload = updateCurrentUserBodySchema.parse(request.body);
      const user = await config.authStore.updateUserProfile({
        userId: session.user.id,
        ...(payload.firstName !== undefined
          ? { firstName: normalizeProfileField(payload.firstName) ?? null }
          : {}),
        ...(payload.lastName !== undefined
          ? { lastName: normalizeProfileField(payload.lastName) ?? null }
          : {})
      });
      if (!user) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }

      response.json({
        user: {
          id: user.id,
          login: user.login,
          firstName: user.firstName,
          lastName: user.lastName,
          role: "admin",
          modules: await config.authStore.listUserModules(user.id)
        },
        csrfToken: await auth.issueCsrfToken(session)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/change-password", async (request, response, next) => {
    if (!auth || !config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    try {
      const session = readAuthSession(response);
      if (!session) {
        response.status(401).json(createErrorResponse("UNAUTHORIZED"));
        return;
      }

      const payload = changePasswordBodySchema.parse(request.body);
      const user = await config.authStore.findUserByLogin(session.user.login);
      const validCurrentPassword = user
        ? await verifyPassword(payload.currentPassword, user.passwordHash)
        : false;

      if (!user || !validCurrentPassword) {
        throw new AuthError("CURRENT_PASSWORD_INVALID", 403);
      }

      await config.authStore.resetPassword({
        login: user.login,
        passwordHash: await hashPassword(payload.newPassword)
      });
      response.status(204).end();
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

  async function deliverCommentToPaperclip(
    comment: DashboardCommentRecord,
    module: AuthenticatedModule
  ) {
    if (!config.comments) {
      return comment;
    }

    if (!config.paperclip || !module.paperclipCompanyId) {
      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "failed",
        paperclipSyncStatus: "failed",
        paperclipError: "Paperclip integration is not configured.",
        paperclipLastSyncedAt: new Date().toISOString()
      });
    }

    try {
      await config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "queued",
        paperclipSyncStatus: "syncing",
        paperclipError: null
      });
      const issue = await config.paperclip.createIssue({
        companyId: module.paperclipCompanyId,
        projectId: module.paperclipProjectId,
        goalId: module.paperclipGoalId,
        assigneeAgentId: module.paperclipTriageAgentId,
        title: `Dashboard comment: ${comment.anchor?.blockLabel ?? comment.sceneId}`,
        description: buildPaperclipIssueDescription({
          module,
          authorLogin: comment.authorLogin,
          comment
        }),
        priority: "medium"
      });

      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipIssueId: issue.id,
        paperclipIssueIdentifier: issue.identifier,
        paperclipStatus: mapPaperclipIssueStatus(issue.status),
        paperclipSyncStatus: "sent",
        paperclipError: null,
        paperclipLastSyncedAt: new Date().toISOString()
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Paperclip issue creation failed.";
      return config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipStatus: "failed",
        paperclipSyncStatus: "failed",
        paperclipError: message,
        paperclipLastSyncedAt: new Date().toISOString(),
        incrementRetryCount: true
      });
    }
  }

  async function loadPaperclipThread(
    comment: DashboardCommentRecord
  ): Promise<DashboardPaperclipThreadEntry[]> {
    if (!config.paperclip || !comment.paperclipIssueId) {
      return [];
    }

    try {
      const issueComments = await config.paperclip.listIssueComments({
        issueId: comment.paperclipIssueId
      });
      return selectPaperclipThread(issueComments);
    } catch {
      return [];
    }
  }

  async function loadPaperclipContext(
    comment: DashboardCommentRecord
  ): Promise<{
    paperclipReadyReport: DashboardPaperclipReadyReport | null;
    paperclipThread: DashboardPaperclipThreadEntry[];
  }> {
    const paperclipThread = await loadPaperclipThread(comment);

    return {
      paperclipReadyReport:
        comment.paperclipStatus === "done"
          ? selectPaperclipReadyReport(paperclipThread)
          : null,
      paperclipThread
    };
  }

  async function refreshCommentPaperclipStatus(
    comment: DashboardCommentRecord
  ): Promise<DashboardCommentView> {
    if (!config.comments || !config.paperclip || !comment.paperclipIssueId) {
      return comment;
    }

    try {
      const issue = await config.paperclip.getIssue({
        issueId: comment.paperclipIssueId
      });
      const paperclipIssueId = issue.id || comment.paperclipIssueId;
      const paperclipIssueIdentifier =
        issue.identifier ?? comment.paperclipIssueIdentifier;
      const paperclipStatus = mapPaperclipIssueStatus(issue.status);
      const hasPaperclipChange =
        paperclipIssueId !== comment.paperclipIssueId ||
        paperclipIssueIdentifier !== comment.paperclipIssueIdentifier ||
        paperclipStatus !== comment.paperclipStatus ||
        comment.paperclipSyncStatus !== "sent" ||
        comment.paperclipError !== null;

      if (!hasPaperclipChange) {
        const paperclipContext = await loadPaperclipContext(comment);
        return { ...comment, ...paperclipContext };
      }

      const updated = await config.comments.updateDashboardCommentPaperclip({
        id: comment.id,
        paperclipIssueId,
        paperclipIssueIdentifier,
        paperclipStatus,
        paperclipSyncStatus: "sent",
        paperclipError: null,
        paperclipLastSyncedAt: new Date().toISOString()
      });
      const nextComment = updated ?? comment;
      const paperclipContext = await loadPaperclipContext(nextComment);
      return { ...nextComment, ...paperclipContext };
    } catch {
      return comment;
    }
  }

  async function refreshOpenDashboardComments(
    comments: DashboardCommentRecord[]
  ): Promise<DashboardCommentView[]> {
    return Promise.all(
      comments.map((comment) =>
        (comment.status ?? "open") === "open"
          ? refreshCommentPaperclipStatus(comment)
          : comment
      )
    );
  }

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
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response);
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const store = await config.comments.getDashboardComments(access.module.id);
      response.json({
        ...store,
        comments: await refreshOpenDashboardComments(store.comments)
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments", async (request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response, "comments:create");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const payload = createCommentBodySchema.parse(request.body);
      const now = new Date().toISOString();
      const created = await config.comments.createDashboardComment({
        id: randomUUID(),
        moduleId: access.module.id,
        authorUserId: access.session.user.id,
        authorLogin: access.session.user.login,
        sceneId: payload.sceneId,
        x: payload.x,
        y: payload.y,
        text: payload.text,
        status: "open",
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        ...(payload.anchor ? { anchor: payload.anchor } : {}),
        ...(payload.context ? { context: payload.context } : {}),
        paperclipIssueId: null,
        paperclipIssueIdentifier: null,
        paperclipStatus: "queued",
        paperclipSyncStatus: "queued",
        paperclipError: null,
        paperclipLastSyncedAt: null,
        paperclipRetryCount: 0
      });
      const delivered = await deliverCommentToPaperclip(created, access.module);
      response.status(201).json({ comment: delivered ?? created });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/comments/:id", async (request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response, "comments:update");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const existing = await config.comments.getDashboardCommentById(request.params.id);
      if (!existing || existing.moduleId !== access.module.id) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      if (
        existing.authorUserId !== access.session.user.id &&
        access.module.role !== "leader"
      ) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }

      const payload = updateCommentBodySchema.parse(request.body);
      const comment = await config.comments.updateDashboardComment({
        id: existing.id,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.context ? { context: payload.context } : {}),
        updatedAt: new Date().toISOString()
      });
      response.json({ comment });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/archive", async (request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response, "comments:archive");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const existing = await config.comments.getDashboardCommentById(request.params.id);
      if (!existing || existing.moduleId !== access.module.id) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      const now = new Date().toISOString();
      const comment = await config.comments.archiveDashboardComment({
        id: existing.id,
        archivedAt: now,
        updatedAt: now
      });
      response.json({ comment });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/rework", async (request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response, "comments:update");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const existing = await config.comments.getDashboardCommentById(request.params.id);
      if (!existing || existing.moduleId !== access.module.id) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      if (
        existing.authorUserId !== access.session.user.id &&
        access.module.role !== "leader"
      ) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }
      if (!existing.paperclipIssueId) {
        response.status(409).json(createErrorResponse("PAPERCLIP_ISSUE_NOT_LINKED"));
        return;
      }
      if (!config.paperclip) {
        const failed = await config.comments.updateDashboardCommentPaperclip({
          id: existing.id,
          paperclipStatus: "failed",
          paperclipSyncStatus: "failed",
          paperclipError: "Paperclip integration is not configured.",
          paperclipLastSyncedAt: new Date().toISOString(),
          incrementRetryCount: true
        });
        response.status(503).json({
          ...createErrorResponse("PAPERCLIP_NOT_CONFIGURED"),
          comment: failed ?? existing
        });
        return;
      }

      const payload = reworkCommentBodySchema.parse(request.body);
      await config.comments.updateDashboardCommentPaperclip({
        id: existing.id,
        paperclipStatus: "in_work",
        paperclipSyncStatus: "syncing",
        paperclipError: null
      });

      try {
        await config.paperclip.addIssueComment({
          issueId: existing.paperclipIssueId,
          origin: "dashboard_rework",
          body: buildPaperclipReworkComment({
            module: access.module,
            authorLogin: access.session.user.login,
            comment: existing,
            text: payload.text
          }),
          reopen: true
        });

        const synced = await config.comments.updateDashboardCommentPaperclip({
          id: existing.id,
          paperclipStatus: "in_work",
          paperclipSyncStatus: "sent",
          paperclipError: null,
          paperclipLastSyncedAt: new Date().toISOString()
        });
        response.json({ comment: synced ?? existing });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Paperclip issue comment failed.";
        const failed = await config.comments.updateDashboardCommentPaperclip({
          id: existing.id,
          paperclipStatus: "failed",
          paperclipSyncStatus: "failed",
          paperclipError: message,
          paperclipLastSyncedAt: new Date().toISOString(),
          incrementRetryCount: true
        });
        response.status(502).json({
          ...createErrorResponse("PAPERCLIP_REWORK_FAILED"),
          comment: failed ?? existing
        });
      }
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/comments/:id/retry", async (request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response, "comments:create");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const existing = await config.comments.getDashboardCommentById(request.params.id);
      if (!existing || existing.moduleId !== access.module.id) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      if (
        existing.authorUserId !== access.session.user.id &&
        access.module.role !== "leader"
      ) {
        response.status(403).json(createErrorResponse("FORBIDDEN"));
        return;
      }
      const delivered = await deliverCommentToPaperclip(existing, access.module);
      response.json({ comment: delivered ?? existing });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/comment-notifications", async (_request, response, next) => {
    if (!config.comments) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }

    const access = requireModuleAccess(response);
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const store = await config.comments.getDashboardComments(access.module.id);
      const refreshedComments = await refreshOpenDashboardComments(store.comments);
      response.json({
        notifications: refreshedComments
          .filter((comment): comment is DashboardCommentView => Boolean(comment))
          .filter((comment) => (comment.status ?? "open") === "open")
          .map((comment) => ({
            id: comment.id,
            sceneId: comment.sceneId,
            text: comment.text,
            status: comment.paperclipStatus,
            paperclipSyncStatus: comment.paperclipSyncStatus,
            paperclipIssueIdentifier: comment.paperclipIssueIdentifier,
            paperclipError: comment.paperclipError,
            paperclipReadyReport: comment.paperclipReadyReport ?? null,
            paperclipThread: comment.paperclipThread ?? [],
            updatedAt: comment.updatedAt
          }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/module-users", async (_request, response, next) => {
    if (!config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }
    const access = requireModuleAccess(response, "module-users:manage");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      response.json({ users: await config.authStore.listModuleUsers(access.module.id) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/module-users", async (request, response, next) => {
    if (!config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }
    const access = requireModuleAccess(response, "module-users:manage");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const payload = createModuleUserBodySchema.parse(request.body);
      const user = await config.authStore.createUser({
        login: payload.login,
        firstName: normalizeProfileField(payload.firstName) ?? null,
        lastName: normalizeProfileField(payload.lastName) ?? null,
        passwordHash: await hashPassword(payload.password)
      });
      await config.authStore.setModuleMembership({
        userId: user.id,
        moduleId: access.module.id,
        role: payload.role,
        status: "active"
      });
      response.status(201).json({
        user: await config.authStore.updateModuleUser({
          userId: user.id,
          moduleId: access.module.id
        })
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/module-users/:id", async (request, response, next) => {
    if (!config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }
    const access = requireModuleAccess(response, "module-users:manage");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const userId = Number(request.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
        return;
      }
      const payload = updateModuleUserBodySchema.parse(request.body);
      const user = await config.authStore.updateModuleUser({
        userId,
        moduleId: access.module.id,
        ...(payload.firstName !== undefined
          ? { firstName: normalizeProfileField(payload.firstName) ?? null }
          : {}),
        ...(payload.lastName !== undefined
          ? { lastName: normalizeProfileField(payload.lastName) ?? null }
          : {}),
        ...(payload.password ? { passwordHash: await hashPassword(payload.password) } : {}),
        ...(payload.role ? { role: payload.role as ModuleRole } : {}),
        ...(payload.disabled !== undefined ? { disabled: payload.disabled } : {}),
        ...(payload.membershipStatus
          ? { membershipStatus: payload.membershipStatus }
          : {})
      });
      if (!user) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/module-users/:id", async (request, response, next) => {
    if (!config.authStore) {
      response.status(404).json(createErrorResponse("NOT_FOUND"));
      return;
    }
    const access = requireModuleAccess(response, "module-users:manage");
    if (!access) {
      response.status(403).json(createErrorResponse("FORBIDDEN"));
      return;
    }

    try {
      const userId = Number(request.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        response.status(400).json(createErrorResponse("VALIDATION_ERROR"));
        return;
      }
      if (userId === access.session.user.id) {
        response.status(400).json(createErrorResponse("CANNOT_DELETE_SELF"));
        return;
      }

      const user = await config.authStore.updateModuleUser({
        userId,
        moduleId: access.module.id,
        disabled: true,
        membershipStatus: "disabled"
      });
      if (!user) {
        response.status(404).json(createErrorResponse("NOT_FOUND"));
        return;
      }
      response.json({ user });
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
