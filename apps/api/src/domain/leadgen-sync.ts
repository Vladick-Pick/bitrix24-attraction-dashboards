import type {
  DealSnapshot,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  SnapshotStats,
  StageCatalogEntry,
  SyncChangeSummary,
  SyncDealChangeBreakdown,
  SyncProgressEvent,
  SyncProgressPhase
} from "@bitrix24-reporting/contracts";

import type { DealRow, SyncRepository, UserRow } from "./sync.js";
import {
  ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
  LEADGEN_US_BASKET_REASON_FIELD_NAME,
  LEADGEN_US_RETURN_REASON_FIELD_NAME,
  LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME
} from "./sync.js";

const LEADGEN_DEFAULT_FROM = "2026-01-01T00:00:00+03:00";
const EMPTY_SNAPSHOT_STATS: SnapshotStats = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};

export interface LeadgenSyncClient {
  fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]>;
  fetchSourceCatalog(): Promise<StageCatalogEntry[]>;
  fetchDealFieldValueMap?(fieldName: string): Promise<Record<string, string>>;
  listDeals(input: {
    modifiedAfter: string | null;
    categoryIds: string[];
    assignedByIds?: string[];
    customFieldNames?: string[];
  }): Promise<DealRow[]>;
  fetchUsers(input: { ids: string[] }): Promise<UserRow[]>;
}

export interface PerformLeadgenSyncInput {
  client: LeadgenSyncClient;
  repository: SyncRepository;
  categoryId: string;
  managerIds: string[];
  now: () => string;
  from?: string;
  onProgress?: (event: SyncProgressEvent) => void;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeMappedFieldValue(
  value: unknown,
  valueMap: Record<string, string>
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = normalizeString(
    typeof rawValue === "number" ? String(rawValue) : rawValue
  );

  if (!normalized) {
    return null;
  }

  return valueMap[normalized] ?? normalized;
}

function sanitizeRefusalReasonDetail(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map(String).map((value) => value.trim()).filter(Boolean)));
}

function buildLeadgenScopeKey(categoryId: string, managerIds: string[]) {
  return `module:leadgen:category:${categoryId}:assigned:${[...managerIds]
    .sort()
    .join(",")}`;
}

function buildSyncCursorKey(scopeKey: string) {
  return `${scopeKey}:deals:date_modify`;
}

function timestampValue(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function maxTimestamp(values: Array<string | null | undefined>) {
  let selected: string | null = null;
  let selectedTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const parsed = timestampValue(value);
    if (value && parsed > selectedTime) {
      selected = value;
      selectedTime = parsed;
    }
  }

  return selected;
}

function advanceCursor(currentCursor: string | null, rows: DealRow[]) {
  const rowCursor = maxTimestamp(rows.map((row) => row.DATE_MODIFY));
  return timestampValue(rowCursor) > timestampValue(currentCursor)
    ? rowCursor
    : currentCursor;
}

function buildProgressEvent(input: {
  syncRunId: number | null;
  phase: SyncProgressPhase;
  progress: number;
  message: string;
  snapshotBefore?: SnapshotStats;
  snapshotAfter?: SnapshotStats;
  changes?: SyncChangeSummary;
  mode?: "full" | "delta";
  modifiedAfter?: string | null;
  startedAt?: string;
  finishedAt?: string;
  diagnostics?: string[];
}): SyncProgressEvent {
  return input;
}

function emitProgress(
  input: PerformLeadgenSyncInput,
  event: SyncProgressEvent
) {
  input.onProgress?.(event);
  if (process.env.NODE_ENV !== "test") {
    console.info("sync.leadgen.progress", JSON.stringify(event));
  }
}

function emptyDealBreakdown(total: number): SyncDealChangeBreakdown {
  return {
    total,
    created: total,
    updated: 0,
    closed: 0,
    reopened: 0,
    unchanged: 0
  };
}

function mapLeadgenDealRow(
  row: DealRow,
  returnReasonMap: Record<string, string>,
  basketReasonMap: Record<string, string>
): DealSnapshot {
  const returnReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_RETURN_REASON_FIELD_NAME],
    returnReasonMap
  );
  const basketReasonValue = normalizeMappedFieldValue(
    row[LEADGEN_US_BASKET_REASON_FIELD_NAME],
    basketReasonMap
  );
  const genericReasonDetail = normalizeMappedFieldValue(
    row[ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME],
    {}
  );

  return {
    id: String(row.ID),
    title: null,
    contactId: null,
    leadId: null,
    categoryId: normalizeString(row.CATEGORY_ID),
    stageId: String(row.STAGE_ID),
    stageSemanticId: normalizeString(row.STAGE_SEMANTIC_ID),
    opportunity:
      typeof row.OPPORTUNITY === "number"
        ? row.OPPORTUNITY
        : row.OPPORTUNITY
          ? Number(row.OPPORTUNITY)
          : null,
    assignedById: normalizeString(row.ASSIGNED_BY_ID),
    sourceId: normalizeString(row.SOURCE_ID),
    qualityValue: null,
    businessClubValue: null,
    targetGroupValue: null,
    meetingTypeValue: null,
    meetingDateValue: null,
    tariffValue: null,
    conversionEventValue: null,
    refusalReasonValue: returnReasonValue ?? basketReasonValue,
    refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail),
    dateCreate: String(row.DATE_CREATE),
    dateModify: String(row.DATE_MODIFY),
    dateClosed: normalizeString(row.DATE_CLOSED),
    utmSource: normalizeString(row.UTM_SOURCE),
    utmMedium: normalizeString(row.UTM_MEDIUM),
    utmCampaign: normalizeString(row.UTM_CAMPAIGN),
    utmContent: normalizeString(row.UTM_CONTENT),
    utmTerm: normalizeString(row.UTM_TERM)
  };
}

function mapUserRow(row: UserRow): ManagerDirectoryEntry {
  const fullName = [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim();

  return {
    id: String(row.ID),
    name: fullName || String(row.ID)
  };
}

async function getSnapshotStats(
  repository: SyncRepository,
  categoryId: string,
  managerIds: string[]
) {
  return repository.getSnapshotStats
    ? repository.getSnapshotStats({
        categoryIds: [categoryId],
        assignedByIds: managerIds
      })
    : EMPTY_SNAPSHOT_STATS;
}

function runSnapshotTransaction<T>(repository: SyncRepository, task: () => T) {
  return repository.runSnapshotTransaction
    ? repository.runSnapshotTransaction(task)
    : task();
}

function buildFailureDiagnostics(error: unknown) {
  if (!(error instanceof Error)) {
    return ["SYNC_FAILED", "error=unknown"];
  }

  return ["SYNC_FAILED", `error=${error.name}`];
}

export async function performLeadgenSync(
  input: PerformLeadgenSyncInput
): Promise<ManualSyncSummary> {
  const categoryId = input.categoryId.trim();
  const managerIds = uniqueStrings(input.managerIds);
  const startedAt = input.now();
  const scopeKey = buildLeadgenScopeKey(categoryId, managerIds);
  const cursorKey = buildSyncCursorKey(scopeKey);
  const hasLeadgenScope = categoryId.length > 0 && managerIds.length > 0;
  const snapshotBefore = hasLeadgenScope
    ? await getSnapshotStats(input.repository, categoryId, managerIds)
    : EMPTY_SNAPSHOT_STATS;
  const cursorFromState =
    hasLeadgenScope && input.repository.getSyncCursor
      ? await input.repository.getSyncCursor(cursorKey)
      : null;
  const latestDealCursor = hasLeadgenScope
    ? cursorFromState ??
      (await input.repository.getLatestSuccessCursor([categoryId], managerIds))
    : null;
  const mode = latestDealCursor ? "delta" : "full";
  const runModifiedAfter = latestDealCursor;
  const queryModifiedAfter = latestDealCursor ?? input.from ?? LEADGEN_DEFAULT_FROM;
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter: runModifiedAfter,
    scopeKey
  });

  emitProgress(
    input,
    buildProgressEvent({
      syncRunId,
      phase: "inspect_snapshot",
      progress: 5,
      message: "Проверяем leadgen snapshot",
      snapshotBefore,
      mode,
      modifiedAfter: runModifiedAfter,
      startedAt
    })
  );

  if (!hasLeadgenScope) {
    const finishedAt = input.now();
    const dealBreakdown = emptyDealBreakdown(0);
    const changes: SyncChangeSummary = {
      deals: 0,
      dealBreakdown,
      activities: 0,
      calls: 0,
      stageHistory: 0,
      managers: 0
    };
    const diagnostics = [
      "leadgenSkipped=empty-scope",
      `leadgenManagers=${managerIds.length}`
    ];
    await input.repository.finishSyncRun({
      syncRunId,
      finishedAt,
      status: "success",
      leadsSynced: 0,
      dealsSynced: 0,
      dealBreakdown,
      diagnostics,
      modifiedAfter: runModifiedAfter
    });

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced: 0,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt,
      snapshotBefore,
      snapshotAfter: snapshotBefore,
      changes,
      diagnostics
    };
  }

  try {
    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_catalogs",
        progress: 20,
        message: "Загружаем справочники лидгена из Bitrix24",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const createdFrom = input.from ?? LEADGEN_DEFAULT_FROM;
    const [dealStages, sourceCatalog, dealRows, returnReasonMap, basketReasonMap] =
      await Promise.all([
        input.client.fetchDealStages([categoryId]),
        input.client.fetchSourceCatalog(),
        input.client.listDeals({
          modifiedAfter: queryModifiedAfter,
          categoryIds: [categoryId],
          assignedByIds: managerIds,
          customFieldNames: [
            LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME,
            ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
            LEADGEN_US_RETURN_REASON_FIELD_NAME,
            LEADGEN_US_BASKET_REASON_FIELD_NAME
          ]
        }),
        input.client.fetchDealFieldValueMap
          ? input.client.fetchDealFieldValueMap(LEADGEN_US_RETURN_REASON_FIELD_NAME)
          : Promise.resolve({}),
        input.client.fetchDealFieldValueMap
          ? input.client.fetchDealFieldValueMap(LEADGEN_US_BASKET_REASON_FIELD_NAME)
          : Promise.resolve({})
      ]);
    const allowedManagers = new Set(managerIds);
    const cursorRows = dealRows.filter((row) => {
      const rowCategoryId = normalizeString(row.CATEGORY_ID);
      const managerId = normalizeString(row.ASSIGNED_BY_ID);
      return (
        rowCategoryId === categoryId &&
        Boolean(managerId && allowedManagers.has(managerId))
      );
    });
    const scopedRows = cursorRows.filter(
      (row) =>
        timestampValue(normalizeString(row.DATE_CREATE)) >=
        timestampValue(createdFrom)
    );
    const deals = scopedRows.map((row) =>
      mapLeadgenDealRow(row, returnReasonMap, basketReasonMap)
    );
    const managerDirectory = (
      await input.client.fetchUsers({
        ids: uniqueStrings(
          deals
            .map((deal) => deal.assignedById)
            .filter((managerId): managerId is string => Boolean(managerId))
        )
      })
    ).map(mapUserRow);
    const dealBreakdown = emptyDealBreakdown(deals.length);
    const changes: SyncChangeSummary = {
      deals: deals.length,
      dealBreakdown,
      activities: 0,
      calls: 0,
      stageHistory: 0,
      managers: managerDirectory.length
    };

    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_deals",
        progress: 55,
        message: `Получено leadgen сделок из Bitrix: ${deals.length}`,
        snapshotBefore,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const finishedAt = input.now();
    const nextCursor = advanceCursor(runModifiedAfter, cursorRows);
    const diagnostics = [
      `dealCursor=${nextCursor ?? "not-updated"}`,
      `leadgenDeals=${deals.length}`,
      `leadgenManagers=${managerIds.length}`
    ];

    runSnapshotTransaction(input.repository, () => {
      void input.repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);
      void input.repository.upsertDeals(deals);
      void input.repository.upsertManagerDirectory(managerDirectory);
      if (input.repository.setSyncCursor && nextCursor) {
        void input.repository.setSyncCursor({
          key: cursorKey,
          cursorValue: nextCursor,
          updatedAt: finishedAt
        });
      }
    });

    await input.repository.finishSyncRun({
      syncRunId,
      finishedAt,
      status: "success",
      leadsSynced: 0,
      dealsSynced: deals.length,
      dealBreakdown,
      diagnostics,
      modifiedAfter: runModifiedAfter
    });

    const snapshotAfter = await getSnapshotStats(input.repository, categoryId, managerIds);

    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "complete",
        progress: 100,
        message: "Синхронизация лидгена завершена",
        snapshotBefore,
        snapshotAfter,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced: deals.length,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt,
      snapshotBefore,
      snapshotAfter,
      changes,
      diagnostics
    };
  } catch (error) {
    const finishedAt = input.now();
    const diagnostics = buildFailureDiagnostics(error);
    await input.repository.failSyncRun({
      syncRunId,
      finishedAt,
      status: "failed",
      diagnostics
    });
    emitProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "failed",
        progress: 100,
        message: "Синхронизация лидгена завершилась ошибкой",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );
    throw error;
  }
}
