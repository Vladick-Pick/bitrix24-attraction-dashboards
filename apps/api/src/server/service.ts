import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomesReportSnapshot,
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  DashboardData,
  DashboardSnapshot,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeReportSnapshot,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  ReportRange,
  ReportFilters,
  RevenueVelocityDimension,
  RevenueVelocityReport,
  RevenueVelocityReportSnapshot,
  SalesPlanData,
  SalesPlanInput,
  SourceCatalogEntry,
  SourceQualityConversionReport,
  SourceQualityConversionReportSnapshot,
  SnapshotStats,
  StageCatalogEntry,
  SyncHealth,
  SyncHealthIssue,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  TargetGroupConversionReport,
  TargetGroupConversionReportSnapshot,
  TocFlowReport,
  TocFlowReportSnapshot
} from "@bitrix24-reporting/contracts";

import {
  buildActivitiesWorkloadReport,
  buildAcquisitionOutcomesReport,
  buildCohortConversionReport,
  buildCallsWorkloadReport,
  buildManagerActionOutcomeReport,
  buildSourceQualityConversionReport,
  buildTargetGroupConversionReport
} from "../domain/operational-reports";
import {
  ATTRACTION_MANAGER_CATALOG,
  ATTRACTION_MANAGER_IDS,
  normalizeAttractionManagerFilters,
  sortAttractionManagers
} from "../domain/attraction-managers";
import { buildTocFlowReport } from "../domain/toc-report";
import { buildRevenueVelocityReport } from "../domain/revenue-velocity";
import {
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME
} from "../domain/report-dimensions";
import { buildDashboard } from "../domain/reporting";
import {
  ACTIVITY_HISTORY_COVERAGE_VERSION,
  CALL_STATS_COVERAGE_PROVIDER,
  CALL_STATS_COVERAGE_STREAM,
  CALL_STATS_COVERAGE_VERSION,
  buildCategoryScopeKey,
  DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
  DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
  DEAL_CUSTOM_FIELDS_COVERAGE_VERSION,
  DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
  DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION,
  performManualSync
} from "../domain/sync";
import type { SyncClient } from "../domain/sync";
import type { SqliteRepository } from "./sqlite-repository";

interface CreateReportingServiceInput {
  dealCategoryIds: string[];
  qualityFieldName: string;
  tariffFieldName?: string;
  businessClubFieldName?: string;
  targetGroupFieldName?: string;
  meetingTypeFieldName?: string;
  meetingDateFieldName?: string;
  contactTargetGroupFieldName?: string;
  legacyContactTargetGroupFieldName?: string;
  repository: SqliteRepository;
  client: SyncClient;
  defaultPeriodDays: number;
  bootstrapLookbackDays?: number;
  now?: () => Date;
}

export interface ReportingService {
  getDashboard(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<DashboardData>;
  getSourceQualityConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<SourceQualityConversionReport>;
  getActivitiesWorkloadReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<ActivitiesWorkloadReport>;
  getAcquisitionOutcomesReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<AcquisitionOutcomesReport>;
  getTargetGroupConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<TargetGroupConversionReport>;
  getManagerActionOutcomeReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<ManagerActionOutcomeReport>;
  getCallsWorkloadReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<CallsWorkloadReport>;
  getCohortConversionReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<CohortConversionReport>;
  getTocFlowReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters;
  }): Promise<TocFlowReport>;
  getRevenueVelocityReport(input: {
    periodDays?: number;
    range?: ReportRange;
    compareRanges?: ReportRange[];
    filters?: ReportFilters & {
      customerKeys?: string[];
      qualityKeys?: string[];
      tariffKeys?: string[];
    };
    dimension?: RevenueVelocityDimension;
    asOf?: string;
  }): Promise<RevenueVelocityReport>;
  getSalesPlan(input: {
    periodStart: string;
    periodEnd: string;
  }): Promise<SalesPlanData>;
  replaceSalesPlan(input: SalesPlanInput): Promise<SalesPlanData>;
  getMeta(): Promise<{
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
  }>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
  updateWonStages(stageIds: string[]): Promise<{ wonStageIds: string[] }>;
}

function createRange(periodDays: number, now: Date) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (periodDays - 1));
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

function resolveRange(
  periodDays: number | undefined,
  range: ReportRange | undefined,
  defaultPeriodDays: number,
  now: Date
) {
  if (range) {
    return range;
  }

  const safePeriod =
    Number.isFinite(periodDays) && (periodDays ?? 0) > 0
      ? (periodDays as number)
      : defaultPeriodDays;

  return createRange(safePeriod, now);
}

function resolveLatestTwelveMonthCohortRange(now: Date): ReportRange {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString(),
    to: to.toISOString()
  };
}

const MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING =
  "Данные по делам/звонкам неполные: требуется историческая синхронизация за выбранный период.";
const MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS = [
  "CRM_TODO",
  "CRM_TASKS_TASK",
  "VOXIMPLANT_CALL",
  "CRM_MEETING"
];
const SYNC_HEALTH_STALE_RUN_HOURS = 2;
const SYNC_HEALTH_STALE_SUCCESS_HOURS = 24;
const EMPTY_SNAPSHOT_STATS = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};

function addHours(date: Date, hours: number) {
  const copy = new Date(date);
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function buildSyncHealth(input: {
  repository: SqliteRepository;
  categoryIds: string[];
  assignedByIds: string[];
  lastSync: {
    finishedAt: string;
    leadsSynced: number;
    dealsSynced: number;
    mode: "full" | "delta";
    dealBreakdown: SyncDealChangeBreakdown;
  } | null;
  now: Date;
  bootstrapLookbackDays: number;
  meetingDateFieldName?: string;
}): Promise<SyncHealth> {
  const checkedAt = input.now.toISOString();
  const issues: SyncHealthIssue[] = [];
  const staleBefore = addHours(
    input.now,
    -SYNC_HEALTH_STALE_RUN_HOURS
  ).toISOString();
  const recoveredStaleRuns =
    typeof input.repository.recoverStaleSyncRuns === "function"
      ? await input.repository.recoverStaleSyncRuns({
          staleBefore,
          failedAt: checkedAt
        })
      : 0;

  if (recoveredStaleRuns > 0) {
    issues.push({
      code: "STALE_RUNNING_SYNC",
      severity: "blocking",
      message:
        "Есть зависшие sync runs; они помечены как failed, нужен новый успешный sync."
    });
  }

  if (!input.lastSync) {
    issues.push({
      code: "NO_SUCCESSFUL_SYNC",
      severity: "blocking",
      message: "Нет успешной синхронизации локального snapshot."
    });
  } else {
    const staleSuccessBefore = addHours(
      input.now,
      -SYNC_HEALTH_STALE_SUCCESS_HOURS
    ).getTime();
    const lastSuccessTime = Date.parse(input.lastSync.finishedAt);
    if (!Number.isFinite(lastSuccessTime) || lastSuccessTime < staleSuccessBefore) {
      issues.push({
        code: "STALE_SUCCESSFUL_SYNC",
        severity: "blocking",
        message: "Последняя успешная синхронизация устарела."
      });
    }
  }

  const requiredFrom = addDays(
    input.now,
    -input.bootstrapLookbackDays
  ).toISOString();
  const scopeKey = buildCategoryScopeKey(input.categoryIds, input.assignedByIds);
  const coverageChecks = [
    ...MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS.map((providerId) => ({
      stream: "activity_history",
      providerId,
      algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
    })),
    {
      stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
      providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
      algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
    },
    {
      stream: CALL_STATS_COVERAGE_STREAM,
      providerId: CALL_STATS_COVERAGE_PROVIDER,
      algorithmVersion: CALL_STATS_COVERAGE_VERSION
    },
    ...(input.meetingDateFieldName
      ? [
          {
            stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
            providerId: input.meetingDateFieldName,
            algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
          }
        ]
      : [])
  ];

  const repositoryWithCoverage = input.repository as Partial<SqliteRepository>;
  const coverageResults =
    typeof repositoryWithCoverage.hasSyncCoverage === "function"
      ? await Promise.all(
          coverageChecks.map((check) =>
            repositoryWithCoverage.hasSyncCoverage?.({
              scopeKey,
              stream: check.stream,
              providerId: check.providerId,
              requiredFrom,
              requiredTo: checkedAt,
              algorithmVersion: check.algorithmVersion
            })
          )
        )
      : [false];

  if (coverageResults.some((covered) => covered !== true)) {
    issues.push({
      code: "MISSING_COVERAGE",
      severity: "blocking",
      message: "Нет подтвержденного покрытия локального snapshot."
    });
  }

  const blocking = issues.some((issue) => issue.severity === "blocking");

  return {
    status: blocking ? "blocked" : issues.length > 0 ? "warning" : "ready",
    blocking,
    checkedAt,
    lastSuccessfulSync: input.lastSync?.finishedAt ?? null,
    issues,
    warnings: issues.map((issue) => issue.message)
  };
}

async function buildManagerActionOutcomeWarnings(input: {
  repository: SqliteRepository;
  categoryIds: string[];
  assignedByIds: string[];
  range: ReportRange;
  meetingDateFieldName?: string;
}) {
  const warnings = new Set<string>();
  const repositoryWithCoverage = input.repository as Partial<SqliteRepository>;
  let meetingDateFieldCoverageConfirmed = false;

  if (typeof repositoryWithCoverage.hasSyncCoverage === "function") {
    const scopeKey = buildCategoryScopeKey(input.categoryIds, input.assignedByIds);
    const coverageResults = await Promise.all(
      MANAGER_ACTION_REQUIRED_ACTIVITY_PROVIDERS.map((providerId) =>
        repositoryWithCoverage.hasSyncCoverage?.({
          scopeKey,
          stream: "activity_history",
          providerId,
          requiredFrom: input.range.from,
          requiredTo: input.range.to,
          algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
        })
      )
    );

    if (coverageResults.some((covered) => covered !== true)) {
      warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
    }

    const dealCustomFieldCoverage = repositoryWithCoverage.hasSyncCoverage({
        scopeKey,
        stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
        providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
        requiredFrom: input.range.from,
        requiredTo: input.range.to,
        algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
    });
    const meetingDateFieldCoverage = input.meetingDateFieldName
      ? repositoryWithCoverage.hasSyncCoverage({
          scopeKey,
          stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
          providerId: input.meetingDateFieldName,
          requiredFrom: input.range.from,
          requiredTo: input.range.to,
          algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
        })
      : Promise.resolve(true);
    const callStatsCoverage = repositoryWithCoverage.hasSyncCoverage({
        scopeKey,
        stream: CALL_STATS_COVERAGE_STREAM,
        providerId: CALL_STATS_COVERAGE_PROVIDER,
        requiredFrom: input.range.from,
        requiredTo: input.range.to,
        algorithmVersion: CALL_STATS_COVERAGE_VERSION
    });
    const fieldCoverageResults = await Promise.all([
      dealCustomFieldCoverage,
      meetingDateFieldCoverage,
      callStatsCoverage
    ]);
    meetingDateFieldCoverageConfirmed = fieldCoverageResults[1] === true;

    if (fieldCoverageResults.some((covered) => covered !== true)) {
      warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
    }
  }

  if (
    typeof repositoryWithCoverage.getDealMeetingDateFieldBootstrappedAt ===
    "function"
  ) {
    const bootstrappedAt =
      await repositoryWithCoverage.getDealMeetingDateFieldBootstrappedAt();
    if (
      input.meetingDateFieldName &&
      !bootstrappedAt &&
      !meetingDateFieldCoverageConfirmed
    ) {
      warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
    }
  }

  if (typeof repositoryWithCoverage.getCallActivityIdsMissingCallStats === "function") {
    const ownerIds =
      typeof input.repository.getDealIdsByCategoryIds === "function"
        ? await input.repository.getDealIdsByCategoryIds(
            input.categoryIds,
            input.assignedByIds
          )
        : [];
    const missingCallStatActivityIds =
      ownerIds.length > 0
        ? await repositoryWithCoverage.getCallActivityIdsMissingCallStats(
            1,
            input.range.from,
            ownerIds
          )
        : [];
    if (missingCallStatActivityIds.length > 0) {
      warnings.add(MANAGER_ACTION_OUTCOME_INCOMPLETE_WARNING);
    }
  }

  return Array.from(warnings);
}

function attachComparisons<TReport extends object, TSnapshot extends object>(
  report: TReport,
  compareRanges: ReportRange[] | undefined,
  buildSnapshot: (range: ReportRange) => TSnapshot
) {
  if (!compareRanges || compareRanges.length === 0) {
    return report;
  }

  return {
    ...report,
    comparisons: compareRanges.map((range, index) => ({
      compareIndex: index + 1,
      range,
      snapshot: buildSnapshot(range)
    }))
  };
}

function filterStageCatalog(
  stageCatalog: StageCatalogEntry[],
  allowedCategoryIds: Set<string>,
  options?: {
    includeSources?: boolean;
  }
) {
  return stageCatalog.filter((entry) => {
    if (entry.entityType === "source") {
      return options?.includeSources ?? false;
    }

    if (entry.entityType !== "deal") {
      return false;
    }

    return allowedCategoryIds.has(normalizeCategoryId(entry.categoryId));
  });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function sortManagers(rows: ManagerDirectoryEntry[]) {
  return [...rows].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, "ru");
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });
}

function sortSources(rows: SourceCatalogEntry[]) {
  return [...rows].sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label, "ru");
    return byLabel !== 0 ? byLabel : left.key.localeCompare(right.key);
  });
}

function isManagerInScope(
  managerIds: Set<string>,
  managerId: string | null | undefined
) {
  return (
    managerIds.size === 0 ||
    managerIds.has(managerId ?? UNASSIGNED_MANAGER_ID)
  );
}

export function createReportingService(
  input: CreateReportingServiceInput
): ReportingService {
  const nowFactory = input.now ?? (() => new Date());
  const allowedCategoryIds = new Set(input.dealCategoryIds);
  const getScopedStageCatalog = async (includeSources = false) =>
    filterStageCatalog(
      await input.repository.getStageCatalog(),
      allowedCategoryIds,
      includeSources ? { includeSources: true } : undefined
    );

  const filterDealsByFilters = (
    deals: Awaited<ReturnType<SqliteRepository["getAllDeals"]>>,
    stageCatalog: StageCatalogEntry[],
    filters: ReportFilters | undefined,
    options?: {
      includeManagerFilter?: boolean;
    }
  ) => {
    const sourceLabels = buildSourceLabelMap(stageCatalog);
    const managerIds = new Set(filters?.managerIds ?? []);
    const sourceKeys = new Set(filters?.sourceKeys ?? []);

    return deals.filter((deal) => {
      if (!allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))) {
        return false;
      }

      if ((options?.includeManagerFilter ?? true) && managerIds.size > 0) {
        const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
        if (!managerIds.has(managerId)) {
          return false;
        }
      }

      if (sourceKeys.size > 0) {
        const source = resolveDealSource(deal, sourceLabels);
        if (!sourceKeys.has(source.key)) {
          return false;
        }
      }

      return true;
    });
  };

  const isDealOwnerType = (ownerTypeId: string) =>
    ownerTypeId === "2" || ownerTypeId.toUpperCase() === "DEAL";

  const isDealCallEntity = (crmEntityType: string | null) =>
    crmEntityType === "2" || crmEntityType?.toUpperCase() === "DEAL";

  const ensureManagerDirectory = async (managerIds: string[]) => {
    const requestedIds = uniqueStrings(managerIds);
    const needsUnassigned = requestedIds.includes(UNASSIGNED_MANAGER_ID);
    const lookupIds = requestedIds.filter((id) => id !== UNASSIGNED_MANAGER_ID);
    const existing = await input.repository.getManagerDirectory();
    const existingById = new Map(existing.map((row) => [row.id, row]));
    for (const manager of ATTRACTION_MANAGER_CATALOG) {
      existingById.set(manager.id, manager);
    }
    const missing = lookupIds.filter((id) => !existingById.has(id));

    if (missing.length > 0) {
      try {
        const fetched = (await input.client.fetchUsers({ ids: missing })).map((row) => {
          const id = String(row.ID);
          return {
            id,
            name: [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim() || id
          };
        });

        if (fetched.length > 0) {
          await input.repository.upsertManagerDirectory(fetched);
          for (const row of fetched) {
            existingById.set(row.id, row);
          }
        }
      } catch (error) {
        console.warn("Skipping manager directory refresh:", error);
      }
    }

    const rows = lookupIds
      .map((id) => existingById.get(id))
      .filter((row): row is ManagerDirectoryEntry => Boolean(row));

    if (needsUnassigned) {
      rows.push({
        id: UNASSIGNED_MANAGER_ID,
        name: UNASSIGNED_MANAGER_NAME
      });
    }

    return sortAttractionManagers(sortManagers(rows));
  };

  const buildSourceCatalog = (
    deals: Awaited<ReturnType<SqliteRepository["getAllDeals"]>>,
    stageCatalog: StageCatalogEntry[]
  ) => {
    const sourceLabels = buildSourceLabelMap(stageCatalog);
    const rows = new Map<string, SourceCatalogEntry>();

    for (const deal of deals) {
      const source = resolveDealSource(deal, sourceLabels);
      rows.set(source.key, {
        key: source.key,
        label: source.label
      });
    }

    return sortSources(Array.from(rows.values()));
  };

  return {
    async getSalesPlan({ periodStart, periodEnd }) {
      const rows = await input.repository.getSalesPlanRows(periodStart, periodEnd);
      const updatedAt = rows.reduce<string | null>(
        (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
        null
      );

      return {
        periodStart,
        periodEnd,
        rows,
        updatedAt
      };
    },

    async replaceSalesPlan(planInput) {
      const updatedAt = nowFactory().toISOString();
      const rows = await input.repository.replaceSalesPlanRows({
        ...planInput,
        updatedAt
      });

      return {
        periodStart: planInput.periodStart,
        periodEnd: planInput.periodEnd,
        rows,
        updatedAt
      };
    },

    async getDashboard({ periodDays, range, compareRanges, filters }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, wonStageIds, stageHistory, activities, calls] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getWonStageIds(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const scopedActivities = activities.filter(
        (activity) =>
          isDealOwnerType(activity.ownerTypeId) && scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = calls.filter((call) => {
        if (
          isDealCallEntity(call.crmEntityType) &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(
          call.crmActivityId && activityById.has(call.crmActivityId)
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const buildSnapshot = (targetRange: ReportRange): DashboardSnapshot =>
        buildDashboard({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          leads: [],
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          calls: scopedCalls,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as DashboardData;
    },

    async getSourceQualityConversionReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, stageHistory, wonStageIds] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true),
        input.repository.getAllStageHistory(),
        input.repository.getWonStageIds()
      ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): SourceQualityConversionReportSnapshot =>
        buildSourceQualityConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as SourceQualityConversionReport;
    },

    async getActivitiesWorkloadReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [
        deals,
        stageCatalog,
        stageHistory,
        activities,
        deadlineChanges,
        meetingDateChanges,
        calls
      ] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllActivityDeadlineChanges(),
          input.repository.getAllDealMeetingDateChanges
            ? input.repository.getAllDealMeetingDateChanges()
            : Promise.resolve([]),
          input.repository.getAllCalls()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const scopedActivities = activities.filter(
        (activity) =>
          scopedDealIds.has(activity.ownerId) &&
          isManagerInScope(managerIds, activity.responsibleId)
      );
      const scopedDeadlineChanges = deadlineChanges.filter(
        (change) =>
          scopedDealIds.has(change.ownerId) &&
          isManagerInScope(managerIds, change.responsibleId)
      );
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...Array.from(managerIds),
          ...scopedDeals.map((deal) => deal.assignedById),
          ...scopedActivities.map((row) => row.responsibleId),
          ...scopedDeadlineChanges.map((row) => row.responsibleId),
          managerIds.has(UNASSIGNED_MANAGER_ID) ? UNASSIGNED_MANAGER_ID : null
        ])
      );
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = calls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;
        if (
          call.crmEntityType === "DEAL" &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return isManagerInScope(
            managerIds,
            call.portalUserId ?? activity?.responsibleId
          );
        }

        return Boolean(
          activity &&
            isManagerInScope(
              managerIds,
              call.portalUserId ?? activity.responsibleId
            )
        );
      });
      const buildSnapshot = (
        targetRange: ReportRange
      ): ActivitiesWorkloadReportSnapshot =>
        buildActivitiesWorkloadReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          deadlineChanges: scopedDeadlineChanges,
          meetingDateChanges,
          calls: scopedCalls,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as ActivitiesWorkloadReport;
    },

    async getAcquisitionOutcomesReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(true)
      ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): AcquisitionOutcomesReportSnapshot =>
        buildAcquisitionOutcomesReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as AcquisitionOutcomesReport;
    },

    async getTargetGroupConversionReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, wonStageIds, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(),
        input.repository.getWonStageIds(),
        input.repository.getAllStageHistory()
      ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): TargetGroupConversionReportSnapshot =>
        buildTargetGroupConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as TargetGroupConversionReport;
    },

    async getManagerActionOutcomeReport({ filters }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, stageHistory, activities, calls, wonStageIds] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          input.repository.getWonStageIds()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const dealScopedActivities = activities.filter((activity) =>
        scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        dealScopedActivities.map((activity) => [activity.id, activity])
      );
      const dealScopedCalls = calls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;
        if (
          call.crmEntityType === "DEAL" &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(activity);
      });
      const managerScopedActivities = dealScopedActivities.filter((activity) =>
        isManagerInScope(managerIds, activity.responsibleId)
      );
      const managerScopedCalls = dealScopedCalls.filter((call) => {
        const activity = call.crmActivityId
          ? activityById.get(call.crmActivityId)
          : null;

        return isManagerInScope(
          managerIds,
          call.portalUserId ?? activity?.responsibleId
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById),
          ...managerScopedActivities.map((activity) => activity.responsibleId),
          ...managerScopedCalls.map((call) => call.portalUserId)
        ])
      );
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): ManagerActionOutcomeReportSnapshot =>
        buildManagerActionOutcomeReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: dealScopedActivities,
          calls: dealScopedCalls,
          managerDirectory
        });
      const reportRange = resolveLatestTwelveMonthCohortRange(nowFactory());
      const warnings = await buildManagerActionOutcomeWarnings({
        repository: input.repository,
        categoryIds: input.dealCategoryIds,
        assignedByIds: ATTRACTION_MANAGER_IDS,
        range: reportRange,
        ...(input.meetingDateFieldName
          ? { meetingDateFieldName: input.meetingDateFieldName }
          : {})
      });

      return {
        ...buildSnapshot(reportRange),
        warnings
      };
    },

    async getCallsWorkloadReport({ periodDays, range, compareRanges, filters }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, stageHistory, activities, calls] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters, {
        includeManagerFilter: false
      });
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedActivities = activities.filter((activity) => scopedDealIds.has(activity.ownerId));
      const activityById = new Map(scopedActivities.map((activity) => [activity.id, activity]));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const scopedCalls = calls.filter((call) => {
        const activity = call.crmActivityId ? activityById.get(call.crmActivityId) : null;
        const hasScopedDealLink =
          Boolean(activity) ||
          (call.crmEntityType === "DEAL" &&
            Boolean(call.crmEntityId) &&
            scopedDealIds.has(call.crmEntityId ?? ""));

        const managerId =
          call.portalUserId ?? activity?.responsibleId ?? UNASSIGNED_MANAGER_ID;

        if (managerIds.size > 0 && !managerIds.has(managerId)) {
          return false;
        }

        if (!hasScopedDealLink) {
          return false;
        }

        return true;
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...Array.from(managerIds),
          ...scopedCalls.map((row) => row.portalUserId),
          ...scopedCalls.map((row) =>
            row.crmActivityId
              ? activityById.get(row.crmActivityId)?.responsibleId ?? null
              : null
          ),
          managerIds.has(UNASSIGNED_MANAGER_ID) ? UNASSIGNED_MANAGER_ID : null
        ])
      );
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (targetRange: ReportRange): CallsWorkloadReportSnapshot =>
        buildCallsWorkloadReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          calls: scopedCalls,
          managerDirectory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as CallsWorkloadReport;
    },

    async getCohortConversionReport({
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, wonStageIds, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        input.repository.getWonStageIds(),
        input.repository.getAllStageHistory()
      ]);
      const stageCatalog = await getScopedStageCatalog(true);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (
        targetRange: ReportRange
      ): CohortConversionReportSnapshot =>
        buildCohortConversionReport({
          range: targetRange,
          wonStageIds,
          deals: scopedDeals,
          stageHistory: scopedStageHistory
        });

      return buildSnapshot(resolveLatestTwelveMonthCohortRange(nowFactory()));
    },

    async getTocFlowReport({ periodDays, range, compareRanges, filters }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, stageHistory] = await Promise.all([
        input.repository.getAllDeals(),
        getScopedStageCatalog(),
        input.repository.getAllStageHistory()
      ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const buildSnapshot = (targetRange: ReportRange): TocFlowReportSnapshot =>
        buildTocFlowReport({
          range: targetRange,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as TocFlowReport;
    },

    async getRevenueVelocityReport({
      periodDays,
      range,
      compareRanges,
      filters,
      dimension = "manager",
      asOf
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters) as ReportFilters & {
        customerKeys?: string[];
        qualityKeys?: string[];
        tariffKeys?: string[];
      };
      const [deals, stageCatalog, stageHistory, activities, calls, wonStageIds] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          input.repository.getWonStageIds()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const scopedStageHistory = stageHistory.filter((row) =>
        scopedDealIds.has(row.ownerId)
      );
      const scopedActivities = activities.filter((activity) =>
        scopedDealIds.has(activity.ownerId)
      );
      const activityById = new Map(
        scopedActivities.map((activity) => [activity.id, activity])
      );
      const scopedCalls = calls.filter((call) => {
        if (
          call.crmEntityType === "DEAL" &&
          call.crmEntityId &&
          scopedDealIds.has(call.crmEntityId)
        ) {
          return true;
        }

        return Boolean(
          call.crmActivityId && activityById.has(call.crmActivityId)
        );
      });
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings(scopedDeals.map((deal) => deal.assignedById))
      );
      const sourceCatalog = buildSourceCatalog(scopedDeals, stageCatalog);
      const resolvedAsOf = asOf ?? nowFactory().toISOString();
      const buildSnapshot = (
        targetRange: ReportRange
      ): RevenueVelocityReportSnapshot =>
        buildRevenueVelocityReport({
          range: targetRange,
          asOf: resolvedAsOf,
          dimension,
          wonStageIds,
          deals: scopedDeals,
          stageCatalog,
          stageHistory: scopedStageHistory,
          activities: scopedActivities,
          calls: scopedCalls,
          conversionEvents: [],
          managerDirectory,
          sourceCatalog,
          filters: scopedFilters
        });
      const resolvedRange = resolveRange(
        periodDays,
        range,
        input.defaultPeriodDays,
        nowFactory()
      );

      return attachComparisons(
        buildSnapshot(resolvedRange),
        compareRanges,
        buildSnapshot
      ) as RevenueVelocityReport;
    },

    async getMeta() {
      const repositoryWithStats = input.repository as Partial<SqliteRepository>;
      const scopeKey = buildCategoryScopeKey(
        input.dealCategoryIds,
        ATTRACTION_MANAGER_IDS
      );
      const [deals, stageCatalog, wonStageIds, lastSync, snapshotStats] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getWonStageIds(),
          input.repository.getLastSyncSummary(scopeKey),
          typeof repositoryWithStats.getSnapshotStats === "function"
            ? repositoryWithStats.getSnapshotStats({
                categoryIds: input.dealCategoryIds,
                assignedByIds: ATTRACTION_MANAGER_IDS
              })
            : Promise.resolve(EMPTY_SNAPSHOT_STATS)
        ]);
      const scopedDeals = filterDealsByFilters(
        deals,
        stageCatalog,
        normalizeAttractionManagerFilters(undefined)
      );
      const managerCatalog = await ensureManagerDirectory(ATTRACTION_MANAGER_IDS);
      const syncHealth = await buildSyncHealth({
        repository: input.repository,
        categoryIds: input.dealCategoryIds,
        assignedByIds: ATTRACTION_MANAGER_IDS,
        lastSync,
        now: nowFactory(),
        bootstrapLookbackDays: input.bootstrapLookbackDays ?? 365,
        ...(input.meetingDateFieldName
          ? { meetingDateFieldName: input.meetingDateFieldName }
          : {})
      });

      return {
        stageCatalog,
        managerCatalog,
        sourceCatalog: buildSourceCatalog(scopedDeals, stageCatalog),
        wonStageIds,
        defaultPeriodDays: input.defaultPeriodDays,
        lastSync,
        snapshotStats,
        syncHealth
      };
    },

    async performSync(syncInput) {
      return performManualSync({
        categoryIds: input.dealCategoryIds,
        qualityFieldName: input.qualityFieldName,
        client: input.client,
        repository: input.repository,
        now: () => nowFactory().toISOString(),
        ...(syncInput?.onProgress ? { onProgress: syncInput.onProgress } : {}),
        ...(input.bootstrapLookbackDays
          ? { bootstrapLookbackDays: input.bootstrapLookbackDays }
          : {}),
        ...(input.tariffFieldName
          ? { tariffFieldName: input.tariffFieldName }
          : {}),
        ...(input.businessClubFieldName
          ? { businessClubFieldName: input.businessClubFieldName }
          : {}),
        ...(input.targetGroupFieldName
          ? { targetGroupFieldName: input.targetGroupFieldName }
          : {}),
        ...(input.meetingTypeFieldName
          ? { meetingTypeFieldName: input.meetingTypeFieldName }
          : {}),
        ...(input.meetingDateFieldName
          ? { meetingDateFieldName: input.meetingDateFieldName }
          : {}),
        ...(input.contactTargetGroupFieldName
          ? { contactTargetGroupFieldName: input.contactTargetGroupFieldName }
          : {}),
        ...(input.legacyContactTargetGroupFieldName
          ? {
              legacyContactTargetGroupFieldName:
                input.legacyContactTargetGroupFieldName
            }
          : {})
      });
    },

    async updateWonStages(stageIds) {
      await input.repository.setWonStageIds(stageIds);
      return {
        wonStageIds: await input.repository.getWonStageIds()
      };
    }
  };
}
