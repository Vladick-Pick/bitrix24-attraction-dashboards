import type {
  DealSnapshot,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot,
  TocFlowReport,
  TocFlowStageMetric
} from "@bitrix24-reporting/contracts";

import { normalizeCategoryId } from "./report-dimensions";

interface TocFlowInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
}

interface StageDefinition {
  stageId: string;
  stageName: string;
  stageSemanticId: string | null;
  sortOrder: number;
}

interface StageStay {
  stageId: string;
  stageSemanticId: string | null;
  enteredAt: string;
  leftAt: string | null;
}

function isWithinRange(value: string | null, fromMs: number, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function toAverage(total: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Number((total / count).toFixed(2));
}

function getAllowedCategoryIds(stageCatalog: StageCatalogEntry[]) {
  return new Set(
    stageCatalog
      .filter((entry) => entry.entityType === "deal" && entry.categoryId)
      .map((entry) => normalizeCategoryId(entry.categoryId))
  );
}

function getAllStageDefinitions(stageCatalog: StageCatalogEntry[]) {
  return stageCatalog
    .filter((entry) => entry.entityType === "deal")
    .map<StageDefinition>((entry) => ({
      stageId: entry.statusId,
      stageName: entry.name,
      stageSemanticId: entry.semanticId ?? null,
      sortOrder: entry.sortOrder ?? 0
    }))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.stageId.localeCompare(right.stageId);
    });
}

function getActiveStageDefinitions(stageCatalog: StageCatalogEntry[]) {
  return getAllStageDefinitions(stageCatalog).filter(
    (stage) => stage.stageSemanticId !== "S" && stage.stageSemanticId !== "F"
  );
}

function buildStageHistoryMap(stageHistory: StageHistorySnapshot[]) {
  const map = new Map<string, StageHistorySnapshot[]>();

  for (const row of stageHistory) {
    const current = map.get(row.ownerId) ?? [];
    current.push(row);
    map.set(row.ownerId, current);
  }

  for (const rows of map.values()) {
    rows.sort((left, right) => {
      const leftTime = Date.parse(left.createdTime);
      const rightTime = Date.parse(right.createdTime);

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.id.localeCompare(right.id);
    });
  }

  return map;
}

function buildStageStays(
  deal: DealSnapshot,
  stageHistoryRows: StageHistorySnapshot[]
): StageStay[] {
  if (stageHistoryRows.length === 0) {
    return [
      {
        stageId: deal.stageId,
        stageSemanticId: deal.stageSemanticId ?? null,
        enteredAt: deal.dateCreate,
        leftAt: null
      }
    ];
  }

  return stageHistoryRows.map((row, index) => ({
    stageId: row.stageId,
    stageSemanticId: row.stageSemanticId ?? null,
    enteredAt: row.createdTime,
    leftAt: stageHistoryRows[index + 1]?.createdTime ?? null
  }));
}

function countBusinessDays(range: ReportRange) {
  const from = new Date(range.from);
  const to = new Date(range.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return 0;
  }

  const current = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  let count = 0;

  while (current <= end) {
    const day = current.getUTCDay();
    if (day >= 1 && day <= 5) {
      count += 1;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return count;
}

function resolveQueueBufferDays(queueEnd: number, rawThroughput: number) {
  if (queueEnd === 0) {
    return 0;
  }

  if (rawThroughput <= 0) {
    return null;
  }

  return Number((queueEnd / rawThroughput).toFixed(2));
}

export function buildTocFlowReport(input: TocFlowInput): TocFlowReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const allStages = getAllStageDefinitions(input.stageCatalog);
  const activeStages = getActiveStageDefinitions(input.stageCatalog);
  const activeStageIds = new Set(activeStages.map((stage) => stage.stageId));
  const stageSortOrder = new Map(allStages.map((stage) => [stage.stageId, stage.sortOrder]));
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) =>
      deals.some((deal) => deal.id === row.ownerId)
    )
  );
  const businessDays = countBusinessDays(input.range);
  const throughputDenominator = Math.max(1, businessDays);
  const stageStats = new Map<
    string,
    {
      enteredDeals: number;
      movedNextDeals: number;
      queueEnd: number;
      durationMsTotal: number;
      durationCount: number;
    }
  >(
    activeStages.map((stage) => [
      stage.stageId,
      {
        enteredDeals: 0,
        movedNextDeals: 0,
        queueEnd: 0,
        durationMsTotal: 0,
        durationCount: 0
      }
    ])
  );

  for (const deal of deals) {
    const stays = buildStageStays(deal, stageHistoryMap.get(deal.id) ?? []);

    for (let index = 0; index < stays.length; index += 1) {
      const stay = stays[index];
      if (!stay || !activeStageIds.has(stay.stageId)) {
        continue;
      }

      const current = stageStats.get(stay.stageId);
      if (!current) {
        continue;
      }

      if (isWithinRange(stay.enteredAt, fromMs, toMs)) {
        current.enteredDeals += 1;
      }

      const nextStay = stays[index + 1];
      const nextSortOrder = nextStay ? stageSortOrder.get(nextStay.stageId) ?? null : null;
      const currentSortOrder = stageSortOrder.get(stay.stageId) ?? null;

      if (
        stay.leftAt &&
        isWithinRange(stay.leftAt, fromMs, toMs) &&
        currentSortOrder !== null &&
        nextSortOrder !== null &&
        nextSortOrder > currentSortOrder
      ) {
        current.movedNextDeals += 1;
        const durationMs = Date.parse(stay.leftAt) - Date.parse(stay.enteredAt);
        if (Number.isFinite(durationMs) && durationMs >= 0) {
          current.durationMsTotal += durationMs;
          current.durationCount += 1;
        }
      }

      const enteredAtMs = Date.parse(stay.enteredAt);
      const leftAtMs = stay.leftAt ? Date.parse(stay.leftAt) : null;
      const isStageAtRangeEnd =
        Number.isFinite(enteredAtMs) &&
        enteredAtMs <= toMs &&
        (leftAtMs === null || !Number.isFinite(leftAtMs) || leftAtMs > toMs);

      if (isStageAtRangeEnd) {
        current.queueEnd += 1;
      }

      stageStats.set(stay.stageId, current);
    }
  }

  const rows = activeStages.map<TocFlowStageMetric>((stage) => {
    const stats = stageStats.get(stage.stageId) ?? {
      enteredDeals: 0,
      movedNextDeals: 0,
      queueEnd: 0,
      durationMsTotal: 0,
      durationCount: 0
    };
    const rawThroughput = stats.movedNextDeals / throughputDenominator;

    return {
      stageId: stage.stageId,
      stageName: stage.stageName,
      stageSemanticId: stage.stageSemanticId,
      sortOrder: stage.sortOrder,
      enteredDeals: stats.enteredDeals,
      movedNextDeals: stats.movedNextDeals,
      throughputPerDay: Number(rawThroughput.toFixed(2)),
      queueEnd: stats.queueEnd,
      queueBufferDays: resolveQueueBufferDays(stats.queueEnd, rawThroughput),
      averageStageDurationDays: toAverage(
        stats.durationMsTotal / 86_400_000,
        stats.durationCount
      )
    };
  });

  const bottleneckCandidates = rows.filter(
    (row) =>
      (row.enteredDeals > 0 || row.movedNextDeals > 0 || row.queueEnd > 0) &&
      row.throughputPerDay > 0
  );
  const bottleneck =
    bottleneckCandidates.length === 0
      ? null
      : bottleneckCandidates.reduce((current, candidate) =>
          candidate.throughputPerDay < current.throughputPerDay
            ? candidate
            : current
        );

  return {
    range: input.range,
    businessDays,
    warnings: [],
    estimatedGainPerDay: null,
    bottleneck: bottleneck
      ? {
          stageId: bottleneck.stageId,
          stageName: bottleneck.stageName,
          throughputPerDay: bottleneck.throughputPerDay,
          queueEnd: bottleneck.queueEnd,
          queueBufferDays: bottleneck.queueBufferDays
        }
      : null,
    rows
  };
}
