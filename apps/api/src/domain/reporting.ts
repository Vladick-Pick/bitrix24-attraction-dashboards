import type {
  DashboardData,
  DashboardInput,
  DealSnapshot,
  LeadSnapshot,
  SourceBreakdownEntry
} from "@bitrix24-reporting/contracts";

function isWithinRange(value: string | null, fromMs: number, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function toNumber(value: number | null) {
  return value ?? 0;
}

function toBucketDate(value: string) {
  return value.slice(0, 10);
}

function resolveSourceKey(
  deal: DealSnapshot,
  leadsById: Map<string, LeadSnapshot>
) {
  if (deal.utmSource) {
    return deal.utmSource;
  }

  if (deal.leadId) {
    const lead = leadsById.get(deal.leadId);
    if (lead?.utmSource) {
      return lead.utmSource;
    }

    if (lead?.sourceId) {
      return lead.sourceId;
    }
  }

  return "UNATTRIBUTED";
}

export function buildDashboard(input: DashboardInput): DashboardData {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const leadsById = new Map(input.leads.map((lead) => [lead.id, lead]));
  const wonStageIds = new Set(input.wonStageIds);
  const dealStageNames = new Map(
    input.stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [entry.statusId, entry.name])
  );

  const periodDeals = input.deals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const periodLeads = input.leads.filter((lead) =>
    isWithinRange(lead.dateCreate, fromMs, toMs)
  );
  const wonDeals = periodDeals.filter(
    (deal) =>
      wonStageIds.has(deal.stageId) &&
      isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
  );

  const salesTimeline = Array.from(
    wonDeals.reduce<Map<string, { salesCount: number; salesAmount: number }>>(
      (accumulator, deal) => {
        const key = toBucketDate(deal.dateClosed ?? deal.dateModify);
        const current = accumulator.get(key) ?? { salesCount: 0, salesAmount: 0 };
        current.salesCount += 1;
        current.salesAmount += toNumber(deal.opportunity);
        accumulator.set(key, current);
        return accumulator;
      },
      new Map()
    )
  )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, summary]) => ({
      date,
      salesCount: summary.salesCount,
      salesAmount: summary.salesAmount
    }));

  const salesCount = wonDeals.length;
  const salesAmount = wonDeals.reduce(
    (total, deal) => total + toNumber(deal.opportunity),
    0
  );
  const newDealsCount = periodDeals.length;

  const funnelSnapshot = Array.from(
    periodDeals.reduce<Map<string, { count: number; amount: number }>>(
      (accumulator, deal) => {
        const current = accumulator.get(deal.stageId) ?? { count: 0, amount: 0 };
        current.count += 1;
        current.amount += toNumber(deal.opportunity);
        accumulator.set(deal.stageId, current);
        return accumulator;
      },
      new Map()
    )
  ).map(([stageId, summary]) => ({
    stageId,
    stageName: dealStageNames.get(stageId) ?? stageId,
    count: summary.count,
    amount: summary.amount
  }));

  const sourceBreakdownMap = new Map<string, SourceBreakdownEntry>();

  for (const lead of periodLeads) {
    const sourceKey = lead.utmSource ?? lead.sourceId ?? "UNATTRIBUTED";
    const existing = sourceBreakdownMap.get(sourceKey) ?? {
      sourceKey,
      sourceLabel: sourceKey,
      salesCount: 0,
      salesAmount: 0,
      newDealsCount: 0,
      newLeadsCount: 0
    };
    existing.newLeadsCount += 1;
    sourceBreakdownMap.set(sourceKey, existing);
  }

  for (const deal of periodDeals) {
    const sourceKey = resolveSourceKey(deal, leadsById);
    const existing = sourceBreakdownMap.get(sourceKey) ?? {
      sourceKey,
      sourceLabel: sourceKey,
      salesCount: 0,
      salesAmount: 0,
      newDealsCount: 0,
      newLeadsCount: 0
    };
    existing.newDealsCount += 1;

    if (
      wonStageIds.has(deal.stageId) &&
      isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
    ) {
      existing.salesCount += 1;
      existing.salesAmount += toNumber(deal.opportunity);
    }

    sourceBreakdownMap.set(sourceKey, existing);
  }

  const sourceBreakdown = Array.from(sourceBreakdownMap.values()).sort((left, right) => {
    if (right.salesAmount !== left.salesAmount) {
      return right.salesAmount - left.salesAmount;
    }

    return left.sourceKey.localeCompare(right.sourceKey);
  });

  return {
    salesOverview: {
      salesCount,
      salesAmount,
      averageSaleAmount: salesCount === 0 ? 0 : salesAmount / salesCount,
      newDealsCount,
      conversionRate: newDealsCount === 0 ? 0 : (salesCount / newDealsCount) * 100,
      salesTimeline
    },
    funnelSnapshot,
    sourceBreakdown
  };
}
