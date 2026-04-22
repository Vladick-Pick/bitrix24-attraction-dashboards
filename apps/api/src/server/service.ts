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
  SourceCatalogEntry,
  SourceQualityConversionReport,
  SourceQualityConversionReportSnapshot,
  StageCatalogEntry,
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
import {
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME
} from "../domain/report-dimensions";
import { buildDashboard } from "../domain/reporting";
import { performManualSync } from "../domain/sync";
import type { SyncClient } from "../domain/sync";
import type { SqliteRepository } from "./sqlite-repository";

interface CreateReportingServiceInput {
  dealCategoryIds: string[];
  qualityFieldName: string;
  tariffFieldName?: string;
  businessClubFieldName?: string;
  targetGroupFieldName?: string;
  meetingTypeFieldName?: string;
  repository: SqliteRepository;
  client: SyncClient;
  defaultPeriodDays: number;
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
    } | null;
  }>;
  performSync(): Promise<ManualSyncSummary>;
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
        const fetched = (await input.client.fetchUsers({ ids: missing })).map((row) => ({
          id: row.ID,
          name: [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim() || row.ID
        }));

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
      const [deals, stageCatalog, stageHistory, activities, deadlineChanges, calls] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllActivityDeadlineChanges(),
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

    async getManagerActionOutcomeReport({
      periodDays,
      range,
      compareRanges,
      filters
    }) {
      const scopedFilters = normalizeAttractionManagerFilters(filters);
      const [deals, stageCatalog, stageHistory, activities, calls, wonStageIds] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(),
          input.repository.getAllStageHistory(),
          input.repository.getAllActivities(),
          input.repository.getAllCalls(),
          input.repository.getWonStageIds()
        ]);
      const scopedDeals = filterDealsByFilters(deals, stageCatalog, scopedFilters);
      const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
      const managerIds = new Set(scopedFilters.managerIds ?? []);
      const scopedActivities = activities.filter(
        (activity) =>
          scopedDealIds.has(activity.ownerId) &&
          isManagerInScope(managerIds, activity.responsibleId)
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
      const managerDirectory = await ensureManagerDirectory(
        uniqueStrings([
          ...scopedDeals.map((deal) => deal.assignedById),
          ...scopedActivities.map((activity) => activity.responsibleId),
          ...scopedCalls.map((call) => call.portalUserId)
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
      ) as ManagerActionOutcomeReport;
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
      const sourceKeys = new Set(scopedFilters.sourceKeys ?? []);
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

        if (sourceKeys.size > 0 && !hasScopedDealLink) {
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

    async getMeta() {
      const [deals, stageCatalog, wonStageIds, lastSync] =
        await Promise.all([
          input.repository.getAllDeals(),
          getScopedStageCatalog(true),
          input.repository.getWonStageIds(),
          input.repository.getLastSyncSummary()
        ]);
      const scopedDeals = filterDealsByFilters(
        deals,
        stageCatalog,
        normalizeAttractionManagerFilters(undefined)
      );
      const managerCatalog = await ensureManagerDirectory(ATTRACTION_MANAGER_IDS);

      return {
        stageCatalog,
        managerCatalog,
        sourceCatalog: buildSourceCatalog(scopedDeals, stageCatalog),
        wonStageIds,
        defaultPeriodDays: input.defaultPeriodDays,
        lastSync
      };
    },

    async performSync() {
      return performManualSync({
        categoryIds: input.dealCategoryIds,
        qualityFieldName: input.qualityFieldName,
        client: input.client,
        repository: input.repository,
        now: () => nowFactory().toISOString(),
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
