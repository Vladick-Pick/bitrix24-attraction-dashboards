import type {
  DealSnapshot,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot,
  TocFlowReport,
  TocStageDistribution,
  TocFlowStageMetric
} from "@bitrix24-reporting/contracts";

import { normalizeCategoryId } from "./report-dimensions.js";

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

type StageDistributionEdgeKey = `${string}->${string}`;
type StageDistributionRouteNodeKey = `${number}->${string}`;
type StageDistributionRouteEdgeKey = `${number}->${string}->${number}->${string}`;

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

function toRoundedNumber(value: number) {
  return Number(value.toFixed(2));
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

function buildNextActiveStageMap(activeStages: StageDefinition[]) {
  return new Map(
    activeStages
      .map((stage, index) => [stage.stageId, activeStages[index + 1]?.stageId ?? null] as const)
  );
}

function buildStageDefinitionMap(stages: StageDefinition[]) {
  return new Map(stages.map((stage) => [stage.stageId, stage]));
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

function buildDistinctStagePath(
  deal: DealSnapshot,
  stageHistoryRows: StageHistorySnapshot[],
  stageDefinitionById: Map<string, StageDefinition>
) {
  const rawStageIds =
    stageHistoryRows.length > 0
      ? stageHistoryRows.map((row) => row.stageId)
      : [deal.stageId];
  const stageIds: string[] = [];

  for (const stageId of rawStageIds) {
    if (!stageDefinitionById.has(stageId)) {
      continue;
    }

    if (stageIds[stageIds.length - 1] !== stageId) {
      stageIds.push(stageId);
    }
  }

  return stageIds;
}

function edgeKey(fromStageId: string | null, toStageId: string): StageDistributionEdgeKey {
  return `${fromStageId ?? "CREATED"}->${toStageId}`;
}

function routeNodeKey(step: number, stageId: string): StageDistributionRouteNodeKey {
  return `${step}->${stageId}`;
}

function routeEdgeKey(
  fromStep: number,
  fromStageId: string,
  toStep: number,
  toStageId: string
): StageDistributionRouteEdgeKey {
  return `${fromStep}->${fromStageId}->${toStep}->${toStageId}`;
}

function buildStageDistribution(input: {
  range: ReportRange;
  deals: DealSnapshot[];
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  stages: StageDefinition[];
}): TocStageDistribution {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const stageDefinitionById = buildStageDefinitionMap(input.stages);
  const createdDeals = input.deals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const totalCreatedDeals = createdDeals.length;
  const nodeDealIds = new Map<string, Set<string>>();
  const edgeDealIds = new Map<StageDistributionEdgeKey, Set<string>>();
  const routeNodeDealIds = new Map<StageDistributionRouteNodeKey, Set<string>>();
  const routeEdgeDealIds = new Map<StageDistributionRouteEdgeKey, Set<string>>();

  const addNode = (stageId: string, dealId: string) => {
    const dealIds = nodeDealIds.get(stageId) ?? new Set<string>();
    dealIds.add(dealId);
    nodeDealIds.set(stageId, dealIds);
  };

  const addEdge = (fromStageId: string | null, toStageId: string, dealId: string) => {
    const key = edgeKey(fromStageId, toStageId);
    const dealIds = edgeDealIds.get(key) ?? new Set<string>();
    dealIds.add(dealId);
    edgeDealIds.set(key, dealIds);
  };
  const addRouteNode = (step: number, stageId: string, dealId: string) => {
    const key = routeNodeKey(step, stageId);
    const dealIds = routeNodeDealIds.get(key) ?? new Set<string>();
    dealIds.add(dealId);
    routeNodeDealIds.set(key, dealIds);
  };
  const addRouteEdge = (
    fromStep: number,
    fromStageId: string,
    toStep: number,
    toStageId: string,
    dealId: string
  ) => {
    const key = routeEdgeKey(fromStep, fromStageId, toStep, toStageId);
    const dealIds = routeEdgeDealIds.get(key) ?? new Set<string>();
    dealIds.add(dealId);
    routeEdgeDealIds.set(key, dealIds);
  };

  for (const deal of createdDeals) {
    const path = buildDistinctStagePath(
      deal,
      input.stageHistoryMap.get(deal.id) ?? [],
      stageDefinitionById
    );

    if (path.length === 0) {
      continue;
    }

    addEdge(null, path[0]!, deal.id);

    for (const stageId of path) {
      addNode(stageId, deal.id);
    }

    for (let index = 0; index < path.length - 1; index += 1) {
      addEdge(path[index]!, path[index + 1]!, deal.id);
    }

    for (let step = 0; step < path.length; step += 1) {
      addRouteNode(step, path[step]!, deal.id);

      if (step < path.length - 1) {
        addRouteEdge(step, path[step]!, step + 1, path[step + 1]!, deal.id);
      }
    }
  }

  const nodes = input.stages
    .map((stage) => {
      const dealCount = nodeDealIds.get(stage.stageId)?.size ?? 0;

      return {
        stageId: stage.stageId,
        stageName: stage.stageName,
        sortOrder: stage.sortOrder,
        dealCount,
        shareOfCreatedDeals:
          totalCreatedDeals > 0
            ? toRoundedNumber((dealCount / totalCreatedDeals) * 100)
            : 0
      };
    })
    .filter((node) => node.dealCount > 0);

  const nodeCountByStageId = new Map(nodes.map((node) => [node.stageId, node.dealCount]));
  const sortOrderByStageId = new Map(input.stages.map((stage) => [stage.stageId, stage.sortOrder]));
  const nameByStageId = new Map(input.stages.map((stage) => [stage.stageId, stage.stageName]));

  const edges = Array.from(edgeDealIds.entries())
    .map(([key, dealIds]) => {
      const [rawFromStageId, toStageId] = key.split("->");
      const fromStageId = rawFromStageId === "CREATED" ? null : rawFromStageId ?? null;
      const dealCount = dealIds.size;
      const denominator =
        fromStageId === null
          ? totalCreatedDeals
          : nodeCountByStageId.get(fromStageId) ?? 0;

      return {
        fromStageId,
        fromStageName: fromStageId ? nameByStageId.get(fromStageId) ?? fromStageId : null,
        toStageId: toStageId ?? "",
        toStageName: nameByStageId.get(toStageId ?? "") ?? toStageId ?? "",
        dealCount,
        conversionRate:
          denominator > 0 ? toRoundedNumber((dealCount / denominator) * 100) : 0
      };
    })
    .filter((edge) => edge.toStageId && edge.dealCount > 0)
    .sort((left, right) => {
      const leftFromOrder =
        left.fromStageId === null ? -1 : sortOrderByStageId.get(left.fromStageId) ?? 0;
      const rightFromOrder =
        right.fromStageId === null ? -1 : sortOrderByStageId.get(right.fromStageId) ?? 0;
      if (leftFromOrder !== rightFromOrder) {
        return leftFromOrder - rightFromOrder;
      }

      const leftToOrder = sortOrderByStageId.get(left.toStageId) ?? 0;
      const rightToOrder = sortOrderByStageId.get(right.toStageId) ?? 0;
      if (leftToOrder !== rightToOrder) {
        return leftToOrder - rightToOrder;
      }

      return left.toStageId.localeCompare(right.toStageId);
    });

  const routeNodes = Array.from(routeNodeDealIds.entries())
    .map(([key, dealIds]) => {
      const [rawStep, stageId] = key.split("->");
      const step = Number(rawStep);
      const dealCount = dealIds.size;

      return {
        step,
        stageId: stageId ?? "",
        stageName: nameByStageId.get(stageId ?? "") ?? stageId ?? "",
        sortOrder: sortOrderByStageId.get(stageId ?? "") ?? 0,
        dealCount,
        shareOfCreatedDeals:
          totalCreatedDeals > 0
            ? toRoundedNumber((dealCount / totalCreatedDeals) * 100)
            : 0
      };
    })
    .filter((node) => node.stageId && node.dealCount > 0)
    .sort((left, right) => {
      if (left.step !== right.step) {
        return left.step - right.step;
      }

      return (
        right.dealCount - left.dealCount ||
        left.sortOrder - right.sortOrder ||
        left.stageName.localeCompare(right.stageName)
      );
    });

  const routeEdges = Array.from(routeEdgeDealIds.entries())
    .map(([key, dealIds]) => {
      const [rawFromStep, fromStageId, rawToStep, toStageId] = key.split("->");
      const fromStep = Number(rawFromStep);
      const toStep = Number(rawToStep);
      const dealCount = dealIds.size;
      const denominator =
        routeNodeDealIds.get(routeNodeKey(fromStep, fromStageId ?? ""))?.size ?? 0;

      return {
        fromStep,
        fromStageId: fromStageId ?? "",
        fromStageName: nameByStageId.get(fromStageId ?? "") ?? fromStageId ?? "",
        toStep,
        toStageId: toStageId ?? "",
        toStageName: nameByStageId.get(toStageId ?? "") ?? toStageId ?? "",
        dealCount,
        conversionRate:
          denominator > 0 ? toRoundedNumber((dealCount / denominator) * 100) : 0
      };
    })
    .filter(
      (edge) =>
        Number.isFinite(edge.fromStep) &&
        Number.isFinite(edge.toStep) &&
        edge.fromStageId &&
        edge.toStageId &&
        edge.dealCount > 0
    )
    .sort((left, right) => {
      if (left.fromStep !== right.fromStep) {
        return left.fromStep - right.fromStep;
      }

      const leftFromOrder = sortOrderByStageId.get(left.fromStageId) ?? 0;
      const rightFromOrder = sortOrderByStageId.get(right.fromStageId) ?? 0;
      if (leftFromOrder !== rightFromOrder) {
        return leftFromOrder - rightFromOrder;
      }

      return (
        right.dealCount - left.dealCount ||
        (sortOrderByStageId.get(left.toStageId) ?? 0) -
          (sortOrderByStageId.get(right.toStageId) ?? 0) ||
        left.toStageName.localeCompare(right.toStageName)
      );
    });

  return {
    totalCreatedDeals,
    nodes,
    edges,
    routeNodes,
    routeEdges
  };
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
  const nextActiveStageById = buildNextActiveStageMap(activeStages);
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
      const canonicalNextStageId = nextActiveStageById.get(stay.stageId) ?? null;

      if (
        stay.leftAt &&
        isWithinRange(stay.leftAt, fromMs, toMs) &&
        canonicalNextStageId !== null &&
        nextStay?.stageId === canonicalNextStageId
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
      (row.throughputPerDay > 0 || row.queueEnd > 0)
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
    stageDistribution: buildStageDistribution({
      range: input.range,
      deals,
      stageHistoryMap,
      stages: allStages
    }),
    rows
  };
}
