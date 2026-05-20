import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  LeadgenFunnelReport,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  SnapshotStats,
  SourceCatalogEntry,
  StageCatalogEntry,
  SyncDealChangeBreakdown,
  SyncHealth,
  SyncHealthIssue,
  SyncProgressEvent
} from "@bitrix24-reporting/contracts";

import {
  buildLeadgenScopeKey,
  performLeadgenSync,
  type LeadgenSyncClient
} from "../domain/leadgen-sync.js";
import {
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource
} from "../domain/report-dimensions.js";
import { createReportingService } from "./service.js";
import type { SqliteRepository } from "./sqlite-repository.js";

interface LeadgenRangeRequest {
  periodDays?: number;
  range?: {
    from: string;
    to: string;
  };
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
  };
}

interface CreateLeadgenServiceInput {
  categoryId: string;
  managerIds: string[];
  qualityFieldName: string;
  client: LeadgenSyncClient;
  repository: SqliteRepository;
  defaultPeriodDays: number;
  now?: () => Date;
}

export interface LeadgenService {
  getLeadgenFunnelReport(input: LeadgenRangeRequest): Promise<LeadgenFunnelReport>;
  getMeta(): Promise<LeadgenMetaResponse>;
  getActivitiesWorkloadReport(
    input: LeadgenRangeRequest
  ): Promise<ActivitiesWorkloadReport>;
  getCallsWorkloadReport(input: LeadgenRangeRequest): Promise<CallsWorkloadReport>;
  performSync(input?: {
    onProgress?: (event: SyncProgressEvent) => void;
  }): Promise<ManualSyncSummary>;
}

interface LeadgenLastSyncSummary {
  finishedAt: string;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
  dealBreakdown: SyncDealChangeBreakdown;
}

interface LeadgenMetaResponse {
  stageCatalog: StageCatalogEntry[];
  managerCatalog: ManagerDirectoryEntry[];
  sourceCatalog: SourceCatalogEntry[];
  wonStageIds: string[];
  defaultPeriodDays: number;
  lastSync: LeadgenLastSyncSummary | null;
  snapshotStats: SnapshotStats;
  syncHealth: SyncHealth;
}

const SYNC_HEALTH_STALE_SUCCESS_HOURS = 24;
const EMPTY_SNAPSHOT_STATS: SnapshotStats = {
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

function buildLeadgenSyncHealth(input: {
  lastSync: LeadgenLastSyncSummary | null;
  now: Date;
}): SyncHealth {
  const checkedAt = input.now.toISOString();
  const issues: SyncHealthIssue[] = [];

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

function filterLeadgenStageCatalog(
  stageCatalog: StageCatalogEntry[],
  categoryId: string
) {
  return stageCatalog.filter(
    (entry) =>
      entry.entityType === "source" ||
      (entry.entityType === "deal" &&
        normalizeCategoryId(entry.categoryId) === categoryId)
  );
}

function buildLeadgenManagerCatalog(
  managerDirectory: ManagerDirectoryEntry[],
  managerIds: string[]
) {
  const managerById = new Map(managerDirectory.map((row) => [row.id, row.name]));

  return managerIds.map((id) => ({
    id,
    name: managerById.get(id) ?? id
  }));
}

function buildLeadgenSourceCatalog(input: {
  deals: Awaited<ReturnType<SqliteRepository["getAllDeals"]>>;
  stageCatalog: StageCatalogEntry[];
  categoryId: string;
  managerIds: string[];
}) {
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const allowedManagers = new Set(input.managerIds);
  const rows = new Map<string, SourceCatalogEntry>();

  for (const deal of input.deals) {
    if (normalizeCategoryId(deal.categoryId) !== input.categoryId) {
      continue;
    }

    if (!deal.assignedById || !allowedManagers.has(deal.assignedById)) {
      continue;
    }

    const source = resolveDealSource(deal, sourceLabels);
    rows.set(source.key, {
      key: source.key,
      label: source.label
    });
  }

  return Array.from(rows.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "ru")
  );
}

export function createLeadgenService(input: CreateLeadgenServiceInput): LeadgenService {
  const nowFactory = input.now ?? (() => new Date());
  const categoryId = input.categoryId.trim();
  const managerIds = input.managerIds.map(String).map((id) => id.trim()).filter(Boolean);
  const scopeKey = buildLeadgenScopeKey(categoryId, managerIds);
  const reporting = createReportingService({
    dealCategoryIds: [categoryId],
    leadgenCategoryId: categoryId,
    leadgenManagerIds: managerIds,
    workloadScope: "leadgen",
    qualityFieldName: input.qualityFieldName,
    client: input.client as never,
    repository: input.repository,
    defaultPeriodDays: input.defaultPeriodDays,
    now: nowFactory
  });

  return {
    getLeadgenFunnelReport(inputRange) {
      return reporting.getLeadgenFunnelReport(inputRange);
    },

    async getMeta() {
      const repositoryWithStats = input.repository as Partial<SqliteRepository>;
      const [deals, rawStageCatalog, managerDirectory, wonStageIds, lastSync, snapshotStats] =
        await Promise.all([
          input.repository.getAllDeals(),
          input.repository.getStageCatalog(),
          input.repository.getManagerDirectory(),
          input.repository.getWonStageIds(),
          input.repository.getLastSyncSummary(scopeKey),
          typeof repositoryWithStats.getSnapshotStats === "function"
            ? repositoryWithStats.getSnapshotStats({
                categoryIds: [categoryId],
                assignedByIds: managerIds
              })
            : Promise.resolve(EMPTY_SNAPSHOT_STATS)
        ]);
      const stageCatalog = filterLeadgenStageCatalog(rawStageCatalog, categoryId);

      return {
        stageCatalog,
        managerCatalog: buildLeadgenManagerCatalog(managerDirectory, managerIds),
        sourceCatalog: buildLeadgenSourceCatalog({
          deals,
          stageCatalog,
          categoryId,
          managerIds
        }),
        wonStageIds,
        defaultPeriodDays: input.defaultPeriodDays,
        lastSync,
        snapshotStats,
        syncHealth: buildLeadgenSyncHealth({
          lastSync,
          now: nowFactory()
        })
      };
    },

    getActivitiesWorkloadReport(inputRange) {
      return reporting.getActivitiesWorkloadReport(inputRange);
    },

    getCallsWorkloadReport(inputRange) {
      return reporting.getCallsWorkloadReport(inputRange);
    },

    performSync(syncInput) {
      return performLeadgenSync({
        client: input.client,
        repository: input.repository,
        categoryId,
        managerIds,
        now: () => nowFactory().toISOString(),
        ...(syncInput?.onProgress ? { onProgress: syncInput.onProgress } : {})
      });
    }
  };
}
