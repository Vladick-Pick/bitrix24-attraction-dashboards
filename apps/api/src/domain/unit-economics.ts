import type {
  DealPricingRule,
  DealSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot,
  UnitEconomicsCalculationMethod,
  UnitEconomicsCostArticle,
  UnitEconomicsCostBehavior,
  UnitEconomicsCostConfidence,
  UnitEconomicsCostFact,
  UnitEconomicsCostRow,
  UnitEconomicsCostRule,
  UnitEconomicsEventParticipantMode,
  UnitEconomicsManagerCostDetailRow,
  UnitEconomicsManagerRevenueRow,
  UnitEconomicsManagerRow,
  UnitEconomicsPnlLevel,
  UnitEconomicsReport,
  UnitEconomicsSourceQualityRow,
  UnitEconomicsSummary
} from "@bitrix24-reporting/contracts";

import { resolveDealEconomics } from "./deal-economics.js";
import {
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  resolveDealSource,
  resolveManagerName,
  UNASSIGNED_MANAGER_ID
} from "./report-dimensions.js";

export interface UnitEconomicsReportInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  eventVisitFacts?: EventVisitFactSnapshot[];
  events?: EventSnapshot[];
  pricingRules?: DealPricingRule[];
  costRules?: UnitEconomicsCostRule[];
  costFacts?: UnitEconomicsCostFact[];
  eventParticipantMode?: UnitEconomicsEventParticipantMode;
  managerDirectory?: ManagerDirectoryEntry[];
  wonStageIds?: string[];
}

interface MutableSummary {
  createdDeals: number;
  wonDeals: number;
  purchasedLeads: number;
  attractionRevenue: number;
  clubRevenue: number;
  leadPurchaseCost: number;
  eventCost: number;
  ambassadorActivityCost: number;
  ctuCertificateCost: number;
  contractationCost: number;
  otherVariableCost: number;
  variableCosts: number;
  contributionResult: number;
  aboveEbitdaCosts: number;
  ebitda: number;
  belowEbitdaCosts: number;
  netProfit: number;
}

interface MutableSourceQualityRow {
  sourceKey: string;
  sourceLabel: string;
  qualityValue: string | null;
  createdDeals: number;
  wonDeals: number;
  purchasedLeads: number;
  attractionRevenue: number;
  clubRevenue: number;
  leadPurchaseCost: number;
  contractationCost: number;
  variableCosts: number;
  warnings: string[];
}

interface MutableManagerRow {
  managerId: string;
  managerName: string;
  createdDeals: number;
  wonDeals: number;
  purchasedLeads: number;
  attractionRevenue: number;
  clubRevenue: number;
  leadPurchaseCost: number;
  eventCost: number;
  ambassadorActivityCost: number;
  ctuCertificateCost: number;
  contractationCost: number;
  variableCosts: number;
  warnings: string[];
  revenueRows: Map<string, UnitEconomicsManagerRevenueRow>;
  productionCostRows: UnitEconomicsManagerCostDetailRow[];
  directCostRows: UnitEconomicsManagerCostDetailRow[];
  taxAndFinanceRows: UnitEconomicsManagerCostDetailRow[];
}

interface RuleCostAccumulator {
  rule: UnitEconomicsCostRule;
  amount: number;
  quantity: number;
}

const ZERO_SUMMARY: MutableSummary = {
  createdDeals: 0,
  wonDeals: 0,
  purchasedLeads: 0,
  attractionRevenue: 0,
  clubRevenue: 0,
  leadPurchaseCost: 0,
  eventCost: 0,
  ambassadorActivityCost: 0,
  ctuCertificateCost: 0,
  contractationCost: 0,
  otherVariableCost: 0,
  variableCosts: 0,
  contributionResult: 0,
  aboveEbitdaCosts: 0,
  ebitda: 0,
  belowEbitdaCosts: 0,
  netProfit: 0
};

export const DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM = "2025-07-01";

const ARTICLE_LABELS = {
  lead_purchase: "Закупка лидов",
  demo_events: "Демо-мероприятия",
  ambassador_activities: "Амбассадорские активности",
  ctu_certificate: "CTU сертификат",
  contractation: "Контрактация",
  sales_bonus: "Бонусы за продажу",
  community_integrators_fixed: "Комьюнити-интеграторы, постоянная часть",
  community_integrators_variable: "Комьюнити-интеграторы, переменная часть",
  ctg_technology_center: "CTG ЦТ / Центр технологизации",
  assistant: "Ассистент",
  e_managers_variable: "E-управляющие, переменная часть",
  e_managers_fixed: "E-управляющие, постоянная часть",
  facility_aho: "Facility / АХО",
  it_service: "IT-сервис",
  it_development_support: "IT-разработка и поддержка",
  operator_ctg: "Оператор CTG",
  other_expenses: "Прочие расходы",
  ctg_finance_service: "Финансово-юридический сервис",
  taxes: "Налоги"
} as const satisfies Record<string, string>;

export const DEFAULT_UNIT_ECONOMICS_COST_ARTICLES: UnitEconomicsCostArticle[] = [
  {
    id: "lead_purchase",
    name: ARTICLE_LABELS.lead_purchase,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_lead",
    enabled: true,
    sortOrder: 10,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "demo_events",
    name: ARTICLE_LABELS.demo_events,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    enabled: true,
    sortOrder: 20,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "ambassador_activities",
    name: ARTICLE_LABELS.ambassador_activities,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    enabled: true,
    sortOrder: 30,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "ctu_certificate",
    name: ARTICLE_LABELS.ctu_certificate,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    enabled: true,
    sortOrder: 40,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "contractation",
    name: ARTICLE_LABELS.contractation,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_contract",
    enabled: true,
    sortOrder: 50,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "sales_bonus",
    name: ARTICLE_LABELS.sales_bonus,
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "percent_of_club_membership",
    enabled: true,
    sortOrder: 60,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "community_integrators_fixed",
    name: ARTICLE_LABELS.community_integrators_fixed,
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "manual_amount",
    enabled: true,
    sortOrder: 110,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "community_integrators_variable",
    name: ARTICLE_LABELS.community_integrators_variable,
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_sale",
    enabled: true,
    sortOrder: 120,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "ctg_technology_center",
    name: ARTICLE_LABELS.ctg_technology_center,
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 130,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "assistant",
    name: ARTICLE_LABELS.assistant,
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "manual_amount",
    enabled: true,
    sortOrder: 140,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "e_managers_variable",
    name: ARTICLE_LABELS.e_managers_variable,
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 150,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "e_managers_fixed",
    name: ARTICLE_LABELS.e_managers_fixed,
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "manual_amount",
    enabled: true,
    sortOrder: 160,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "facility_aho",
    name: ARTICLE_LABELS.facility_aho,
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "manual_amount",
    enabled: true,
    sortOrder: 170,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "it_service",
    name: ARTICLE_LABELS.it_service,
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "manual_amount",
    enabled: true,
    sortOrder: 180,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "it_development_support",
    name: ARTICLE_LABELS.it_development_support,
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 190,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "operator_ctg",
    name: ARTICLE_LABELS.operator_ctg,
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 200,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "other_expenses",
    name: ARTICLE_LABELS.other_expenses,
    pnlLevel: "above_ebitda",
    costBehavior: "mixed",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 210,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "ctg_finance_service",
    name: ARTICLE_LABELS.ctg_finance_service,
    pnlLevel: "below_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 310,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  },
  {
    id: "taxes",
    name: ARTICLE_LABELS.taxes,
    pnlLevel: "below_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    enabled: true,
    sortOrder: 320,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    updatedAt: null
  }
];

export const DEFAULT_UNIT_ECONOMICS_COST_RULES: UnitEconomicsCostRule[] = [
  {
    id: "leadgen-us-ready-to-meet-default",
    articleId: "lead_purchase",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_lead",
    unitPrice: 20_000,
    percent: null,
    amount: null,
    sourceKey: "Лидген УС",
    qualityValue: "Готов к встрече",
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 5
  },
  {
    id: "contractation-per-won-default",
    articleId: "contractation",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_contract",
    unitPrice: 5_000,
    percent: null,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 10
  },
  {
    id: "leadgen-us-attended-meeting-default",
    articleId: "lead_purchase",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_lead",
    unitPrice: 40_000,
    percent: null,
    amount: null,
    sourceKey: "Лидген УС",
    qualityValue: "Пришёл на встречу",
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 12
  },
  {
    id: "guest-meeting-participant-default",
    articleId: "demo_events",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    unitPrice: 5_000,
    percent: null,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: "Гостевая встреча",
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 15
  },
  {
    id: "other-conversion-event-participant-default",
    articleId: "demo_events",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "amount_per_participant",
    unitPrice: 15_000,
    percent: null,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 16
  },
  {
    id: "sales-bonus-default",
    articleId: "sales_bonus",
    pnlLevel: "variable_contribution",
    costBehavior: "variable",
    calculationMethod: "percent_of_club_membership",
    unitPrice: null,
    percent: 4,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 25
  },
  {
    id: "community-integrators-fixed-default",
    articleId: "community_integrators_fixed",
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "amount_per_period",
    unitPrice: null,
    percent: null,
    amount: 168_000,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 110
  },
  {
    id: "ctg-technology-center-default",
    articleId: "ctg_technology_center",
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    unitPrice: null,
    percent: 6,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 120
  },
  {
    id: "assistant-fixed-default",
    articleId: "assistant",
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "amount_per_period",
    unitPrice: null,
    percent: null,
    amount: 140_000,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 140
  },
  {
    id: "facility-aho-default",
    articleId: "facility_aho",
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "amount_per_period",
    unitPrice: null,
    percent: null,
    amount: 31_500,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 170
  },
  {
    id: "it-service-default",
    articleId: "it_service",
    pnlLevel: "above_ebitda",
    costBehavior: "fixed",
    calculationMethod: "amount_per_period",
    unitPrice: null,
    percent: null,
    amount: 10_000,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 180
  },
  {
    id: "it-development-support-default",
    articleId: "it_development_support",
    pnlLevel: "above_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    unitPrice: null,
    percent: 4,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 190
  },
  {
    id: "other-expenses-default",
    articleId: "other_expenses",
    pnlLevel: "above_ebitda",
    costBehavior: "mixed",
    calculationMethod: "percent_of_module_revenue",
    unitPrice: null,
    percent: 5,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 210
  },
  {
    id: "finance-service-default",
    articleId: "ctg_finance_service",
    pnlLevel: "below_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    unitPrice: null,
    percent: 2,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 310
  },
  {
    id: "taxes-default",
    articleId: "taxes",
    pnlLevel: "below_ebitda",
    costBehavior: "variable",
    calculationMethod: "percent_of_module_revenue",
    unitPrice: null,
    percent: 3,
    amount: null,
    sourceKey: null,
    qualityValue: null,
    eventNamePattern: null,
    enabled: true,
    effectiveFrom: DEFAULT_UNIT_ECONOMICS_EFFECTIVE_FROM,
    effectiveTo: null,
    sortOrder: 320
  }
];

function toTimestamp(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinRange(value: string | null | undefined, fromMs: number, toMs: number) {
  const timestamp = toTimestamp(value);
  return timestamp !== null && timestamp >= fromMs && timestamp <= toMs;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function safeDivide(numerator: number, denominator: number, digits = 4) {
  if (denominator === 0) {
    return null;
  }

  return round(numerator / denominator, digits);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function normalizeQualityForMatch(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/^\d+(?:\.\d+)?\s+/, "")
    .replace(/готов ко встрече/g, "готов к встрече");
}

function buildStageHistoryMap(stageHistory: StageHistorySnapshot[]) {
  const rows = new Map<string, StageHistorySnapshot[]>();

  for (const row of stageHistory) {
    const current = rows.get(row.ownerId) ?? [];
    current.push(row);
    rows.set(row.ownerId, current);
  }

  for (const current of rows.values()) {
    current.sort((left, right) => left.createdTime.localeCompare(right.createdTime));
  }

  return rows;
}

function isWonDeal(deal: DealSnapshot, wonStageIds: Set<string>) {
  return wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S";
}

function resolveWonAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  const historyWonAt = (stageHistoryMap.get(deal.id) ?? [])
    .filter((row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S")
    .map((row) => row.createdTime)
    .sort()[0];

  return historyWonAt ?? deal.dateClosed ?? null;
}

function isRuleActive(rule: UnitEconomicsCostRule, range: ReportRange) {
  if (!rule.enabled) {
    return false;
  }

  const rangeFromMs = Date.parse(range.from);
  const rangeToMs = Date.parse(range.to);
  const effectiveFromMs = Date.parse(rule.effectiveFrom);
  const effectiveToMs = rule.effectiveTo ? Date.parse(rule.effectiveTo) : Number.POSITIVE_INFINITY;

  return effectiveFromMs <= rangeToMs && effectiveToMs >= rangeFromMs;
}

function isFactActive(fact: UnitEconomicsCostFact, range: ReportRange) {
  if (fact.status !== "active") {
    return false;
  }

  const rangeFromMs = Date.parse(range.from);
  const rangeToMs = Date.parse(range.to);
  const factFromMs = Date.parse(fact.periodStart);
  const factToMs = Date.parse(fact.periodEnd);

  return factFromMs <= rangeToMs && factToMs >= rangeFromMs;
}

function ruleMatchesDeal(
  rule: UnitEconomicsCostRule,
  deal: DealSnapshot,
  source: { key: string; label: string }
) {
  const sourceMatches =
    !rule.sourceKey ||
    rule.sourceKey === source.key ||
    normalizeText(rule.sourceKey) === normalizeText(source.label) ||
    rule.sourceKey === deal.sourceId;
  const ruleQuality = normalizeQualityForMatch(rule.qualityValue);
  const dealQuality = normalizeQualityForMatch(deal.qualityValue);
  const qualityMatches =
    !rule.qualityValue ||
    ruleQuality === dealQuality ||
    (ruleQuality.length > 0 && dealQuality.includes(ruleQuality));

  return sourceMatches && qualityMatches;
}

function sourceQualityKey(sourceKey: string, qualityValue: string | null) {
  return `${sourceKey}::${qualityValue ?? "unknown"}`;
}

function getOrCreateRow(
  rows: Map<string, MutableSourceQualityRow>,
  input: {
    sourceKey: string;
    sourceLabel: string;
    qualityValue: string | null;
  }
) {
  const key = sourceQualityKey(input.sourceKey, input.qualityValue);
  const existing = rows.get(key);
  if (existing) {
    return existing;
  }

  const row: MutableSourceQualityRow = {
    sourceKey: input.sourceKey,
    sourceLabel: input.sourceLabel,
    qualityValue: input.qualityValue,
    createdDeals: 0,
    wonDeals: 0,
    purchasedLeads: 0,
    attractionRevenue: 0,
    clubRevenue: 0,
    leadPurchaseCost: 0,
    contractationCost: 0,
    variableCosts: 0,
    warnings: []
  };
  rows.set(key, row);
  return row;
}

function resolveDealManagerId(deal: DealSnapshot) {
  return deal.assignedById?.trim() || UNASSIGNED_MANAGER_ID;
}

function getOrCreateManagerRow(
  rows: Map<string, MutableManagerRow>,
  managerId: string,
  managerDirectory: Map<string, string>
) {
  const existing = rows.get(managerId);
  if (existing) {
    return existing;
  }

  const row: MutableManagerRow = {
    managerId,
    managerName: resolveManagerName(managerId, managerDirectory),
    createdDeals: 0,
    wonDeals: 0,
    purchasedLeads: 0,
    attractionRevenue: 0,
    clubRevenue: 0,
    leadPurchaseCost: 0,
    eventCost: 0,
    ambassadorActivityCost: 0,
    ctuCertificateCost: 0,
    contractationCost: 0,
    variableCosts: 0,
    warnings: [],
    revenueRows: new Map(),
    productionCostRows: [],
    directCostRows: [],
    taxAndFinanceRows: []
  };
  rows.set(managerId, row);
  return row;
}

function addRuleCost(
  costAccumulators: Map<string, RuleCostAccumulator>,
  rule: UnitEconomicsCostRule,
  amount: number
) {
  const existing = costAccumulators.get(rule.id);
  if (existing) {
    existing.amount += amount;
    existing.quantity += 1;
    return;
  }

  costAccumulators.set(rule.id, {
    rule,
    amount,
    quantity: 1
  });
}

function articleLabel(articleId: string) {
  const labels: Record<string, string> = ARTICLE_LABELS;
  return labels[articleId] ?? articleId;
}

function revenueKey(clubLabel: string | null, tariffLabel: string | null) {
  return `${clubLabel ?? "unknown"}::${tariffLabel ?? "unknown"}`;
}

function addManagerRevenueRow(
  row: MutableManagerRow,
  input: UnitEconomicsManagerRevenueRow
) {
  const key = revenueKey(input.clubLabel, input.tariffLabel);
  const existing = row.revenueRows.get(key);

  if (existing) {
    existing.wonDeals += input.wonDeals;
    existing.attractionRevenue += input.attractionRevenue;
    existing.clubRevenue += input.clubRevenue;
    return;
  }

  row.revenueRows.set(key, { ...input });
}

function costDetailKey(row: UnitEconomicsManagerCostDetailRow) {
  return [
    row.articleId,
    row.productLabel,
    row.unitLabel ?? "unitless",
    row.unitPrice ?? "no-price",
    row.percent ?? "no-percent",
    row.basis
  ].join("::");
}

function addManagerCostDetailRow(
  rows: UnitEconomicsManagerCostDetailRow[],
  input: UnitEconomicsManagerCostDetailRow
) {
  const key = costDetailKey(input);
  const existing = rows.find((row) => costDetailKey(row) === key);

  if (existing) {
    existing.quantity =
      existing.quantity === null || input.quantity === null
        ? existing.quantity ?? input.quantity
        : existing.quantity + input.quantity;
    existing.amount = round(existing.amount + input.amount);
    existing.warnings = [...new Set([...existing.warnings, ...input.warnings])];
    return;
  }

  rows.push({
    ...input,
    amount: round(input.amount),
    warnings: [...new Set(input.warnings)]
  });
}

function articleSortOrder(articleId: string) {
  const article = DEFAULT_UNIT_ECONOMICS_COST_ARTICLES.find((item) => item.id === articleId);
  return article?.sortOrder ?? 9999;
}

function sortCostDetailRows(rows: UnitEconomicsManagerCostDetailRow[]) {
  return [...rows]
    .map((row) => ({ ...row, amount: round(row.amount) }))
    .sort((left, right) => {
      const sortDelta = articleSortOrder(left.articleId) - articleSortOrder(right.articleId);
      if (sortDelta !== 0) {
        return sortDelta;
      }

      return left.productLabel.localeCompare(right.productLabel, "ru");
    });
}

function sumCostDetailRows(rows: UnitEconomicsManagerCostDetailRow[]) {
  return rows.reduce((total, row) => total + row.amount, 0);
}

function addProductionCostDetail(
  row: MutableManagerRow,
  input: Omit<UnitEconomicsManagerCostDetailRow, "articleLabel">
) {
  addManagerCostDetailRow(row.productionCostRows, {
    ...input,
    articleLabel: articleLabel(input.articleId)
  });
}

function addCostDetailByPnl(
  row: MutableManagerRow,
  rule: UnitEconomicsCostRule,
  input: Omit<UnitEconomicsManagerCostDetailRow, "articleLabel">
) {
  const detail: UnitEconomicsManagerCostDetailRow = {
    ...input,
    articleLabel: articleLabel(input.articleId)
  };

  if (rule.pnlLevel === "below_ebitda") {
    addManagerCostDetailRow(row.taxAndFinanceRows, detail);
  } else if (rule.pnlLevel === "above_ebitda") {
    addManagerCostDetailRow(row.directCostRows, detail);
  } else {
    addManagerCostDetailRow(row.productionCostRows, detail);
  }
}

function addDirectOrTaxCostDetail(
  managerRows: Map<string, MutableManagerRow>,
  rule: UnitEconomicsCostRule,
  amount: number,
  quantity: number | null
) {
  const shouldAllocateAcrossManagers = isSharedManagerCostRule(rule) && managerRows.size > 0;
  const allocatedAmount =
    shouldAllocateAcrossManagers
      ? amount / managerRows.size
      : amount;
  const detail: UnitEconomicsManagerCostDetailRow = {
    articleId: rule.articleId,
    articleLabel: articleLabel(rule.articleId),
    productLabel: productLabelForRule(rule),
    quantity,
    unitLabel: unitLabelForRule(rule),
    unitPrice: rule.unitPrice,
    percent: rule.percent,
    amount: allocatedAmount,
    basis: shouldAllocateAcrossManagers
      ? sharedManagerCostBasisLabel(rule, managerRows.size)
      : basisLabelForRule(rule),
    warnings: []
  };

  for (const row of managerRows.values()) {
    if (rule.pnlLevel === "below_ebitda") {
      addManagerCostDetailRow(row.taxAndFinanceRows, detail);
    } else {
      addManagerCostDetailRow(row.directCostRows, detail);
    }
  }
}

function isSharedPercentRule(rule: UnitEconomicsCostRule) {
  return (
    rule.calculationMethod === "percent_of_module_revenue" ||
    rule.calculationMethod === "percent_of_sale"
  );
}

function isSharedManagerCostRule(rule: UnitEconomicsCostRule) {
  return (
    isSharedPercentRule(rule) ||
    (rule.articleId === "assistant" && rule.calculationMethod === "amount_per_period")
  );
}

function sharedManagerCostBasisLabel(rule: UnitEconomicsCostRule, managerCount: number) {
  if (isSharedPercentRule(rule)) {
    return `${basisLabelForRule(rule)} / ${formatManagerCount(managerCount)}`;
  }

  return `Общие расходы / ${formatManagerCount(managerCount)}`;
}

function formatManagerCount(managerCount: number) {
  const lastTwoDigits = managerCount % 100;
  const lastDigit = managerCount % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${managerCount} менеджеров`;
  }

  if (lastDigit === 1) {
    return `${managerCount} менеджер`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${managerCount} менеджера`;
  }

  return `${managerCount} менеджеров`;
}

function productLabelForRule(rule: UnitEconomicsCostRule) {
  if (rule.articleId === "community_integrators_fixed") {
    return "120 000 оклад + 40% налог";
  }

  if (rule.articleId === "assistant") {
    return "100 000 оклад + 40% налог";
  }

  if (rule.articleId === "facility_aho") {
    return "31 500 на одного КИ";
  }

  if (rule.articleId === "it_service") {
    return "10 000 на одного КИ";
  }

  if (rule.percent !== null && rule.percent !== undefined) {
    return `${formatRuleNumber(rule.percent)}% от общего дохода`;
  }

  return articleLabel(rule.articleId);
}

function basisLabelForRule(rule: UnitEconomicsCostRule) {
  if (
    rule.calculationMethod === "percent_of_module_revenue" ||
    rule.calculationMethod === "percent_of_sale"
  ) {
    return "Общий доход всех";
  }

  if (rule.calculationMethod === "percent_of_club_membership") {
    return "Стоимость членства клуба";
  }

  return "Правило периода";
}

function unitLabelForRule(rule: UnitEconomicsCostRule) {
  if (rule.calculationMethod === "amount_per_period") {
    return "период";
  }

  if (rule.calculationMethod === "amount_per_contract") {
    return "won";
  }

  if (rule.calculationMethod === "amount_per_lead") {
    return "лид";
  }

  if (rule.calculationMethod === "amount_per_participant") {
    return "участник";
  }

  return null;
}

function formatRuleNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(round(value, 2));
}

function parsePayloadJson(payloadJson: string | null | undefined) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function eventNameFromFact(
  fact: EventVisitFactSnapshot,
  eventById: Map<string, EventSnapshot>
) {
  const eventTitle = fact.eventId ? eventById.get(fact.eventId)?.title : null;
  if (eventTitle) {
    return eventTitle;
  }

  const payload = parsePayloadJson(fact.payloadJson);
  const payloadName = payload.eventName ?? payload.title ?? payload.name;
  return typeof payloadName === "string" && payloadName.trim()
    ? payloadName
    : fact.eventId ?? "Событие без названия";
}

function ruleMatchesEvent(rule: UnitEconomicsCostRule, eventName: string) {
  const pattern = normalizeText(rule.eventNamePattern);
  return pattern.length > 0 && normalizeText(eventName).includes(pattern);
}

function hasEventNamePattern(rule: UnitEconomicsCostRule) {
  return normalizeText(rule.eventNamePattern).length > 0;
}

function eventFactMatchesParticipantMode(
  fact: EventVisitFactSnapshot,
  mode: UnitEconomicsEventParticipantMode,
  fromMs: number,
  toMs: number
) {
  const eventDateMs = Date.parse(fact.eventDate ?? "");
  const eventDateInRange =
    Number.isFinite(eventDateMs) && eventDateMs >= fromMs && eventDateMs <= toMs;

  if (mode === "attended") {
    return (
      fact.finalStatus === "attended" &&
      isWithinRange(fact.eventDate ?? fact.attendedAt, fromMs, toMs)
    );
  }

  return eventDateInRange || isWithinRange(fact.invitedAt, fromMs, toMs);
}

function shouldHandleRuleInDealLoop(rule: UnitEconomicsCostRule) {
  return (
    rule.articleId === "lead_purchase" ||
    rule.articleId === "contractation" ||
    rule.articleId === "sales_bonus"
  );
}

function shouldHandleRuleInEventLoop(rule: UnitEconomicsCostRule) {
  return (
    rule.calculationMethod === "amount_per_participant" &&
    (hasEventNamePattern(rule) ||
      rule.articleId === "demo_events" ||
      rule.articleId === "ambassador_activities")
  );
}

function emptyCostRow(input: {
  articleId: string;
  pnlLevel: UnitEconomicsPnlLevel;
  costBehavior: UnitEconomicsCostBehavior;
  calculationMethod: UnitEconomicsCalculationMethod;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  percent: number | null;
  sourceKey: string | null;
  qualityValue: string | null;
  confidence: UnitEconomicsCostConfidence;
  sourceSystem: string;
  warnings?: string[];
}): UnitEconomicsCostRow {
  return {
    articleId: input.articleId,
    label: articleLabel(input.articleId),
    pnlLevel: input.pnlLevel,
    costBehavior: input.costBehavior,
    calculationMethod: input.calculationMethod,
    amount: round(input.amount),
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    percent: input.percent,
    sourceKey: input.sourceKey,
    qualityValue: input.qualityValue,
    confidence: input.confidence,
    sourceSystem: input.sourceSystem,
    warnings: input.warnings ?? []
  };
}

function addCostToSummary(
  summary: MutableSummary,
  pnlLevel: UnitEconomicsPnlLevel,
  articleId: string,
  amount: number
) {
  if (articleId === "lead_purchase") {
    summary.leadPurchaseCost += amount;
  } else if (articleId === "contractation") {
    summary.contractationCost += amount;
  } else if (articleId === "demo_events") {
    summary.eventCost += amount;
  } else if (articleId === "ambassador_activities") {
    summary.ambassadorActivityCost += amount;
  } else if (articleId === "ctu_certificate") {
    summary.ctuCertificateCost += amount;
  }

  if (pnlLevel === "variable_contribution") {
    summary.variableCosts += amount;
    if (
      articleId !== "lead_purchase" &&
      articleId !== "contractation" &&
      articleId !== "demo_events" &&
      articleId !== "ambassador_activities" &&
      articleId !== "ctu_certificate"
    ) {
      summary.otherVariableCost += amount;
    }
  } else if (pnlLevel === "above_ebitda") {
    summary.aboveEbitdaCosts += amount;
  } else {
    summary.belowEbitdaCosts += amount;
  }
}

function finalizeSummary(summary: MutableSummary, warnings: string[]): UnitEconomicsSummary {
  summary.contributionResult = summary.attractionRevenue - summary.variableCosts;
  summary.ebitda = summary.contributionResult - summary.aboveEbitdaCosts;
  summary.netProfit = summary.ebitda - summary.belowEbitdaCosts;

  if (summary.attractionRevenue === 0) {
    warnings.push(
      "Доход Привлечения равен 0: процентные показатели маржинальности не рассчитываются."
    );
  }

  return {
    createdDeals: summary.createdDeals,
    wonDeals: summary.wonDeals,
    purchasedLeads: summary.purchasedLeads,
    attractionRevenue: round(summary.attractionRevenue),
    clubRevenue: round(summary.clubRevenue),
    leadPurchaseCost: round(summary.leadPurchaseCost),
    eventCost: round(summary.eventCost),
    ambassadorActivityCost: round(summary.ambassadorActivityCost),
    ctuCertificateCost: round(summary.ctuCertificateCost),
    contractationCost: round(summary.contractationCost),
    otherVariableCost: round(summary.otherVariableCost),
    variableCosts: round(summary.variableCosts),
    contributionResult: round(summary.contributionResult),
    contributionMargin: safeDivide(summary.contributionResult, summary.attractionRevenue),
    aboveEbitdaCosts: round(summary.aboveEbitdaCosts),
    ebitda: round(summary.ebitda),
    ebitdaMargin: safeDivide(summary.ebitda, summary.attractionRevenue),
    belowEbitdaCosts: round(summary.belowEbitdaCosts),
    netProfit: round(summary.netProfit),
    netProfitMargin: safeDivide(summary.netProfit, summary.attractionRevenue),
    attractionAverageCheck: safeDivide(summary.attractionRevenue, summary.wonDeals, 2),
    clubAverageCheck: safeDivide(summary.clubRevenue, summary.wonDeals, 2),
    costPerWonDeal: safeDivide(summary.variableCosts + summary.aboveEbitdaCosts, summary.wonDeals, 2),
    costPerCreatedDeal: safeDivide(summary.variableCosts + summary.aboveEbitdaCosts, summary.createdDeals, 2)
  };
}

export function buildUnitEconomicsReport(
  input: UnitEconomicsReportInput
): UnitEconomicsReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const stageHistoryMap = buildStageHistoryMap(input.stageHistory);
  const wonStageIds = new Set(input.wonStageIds ?? []);
  const activeRules = (input.costRules ?? [])
    .filter((rule) => isRuleActive(rule, input.range))
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const activeFacts = (input.costFacts ?? []).filter((fact) =>
    isFactActive(fact, input.range)
  );
  const warnings: string[] = [];
  const summary: MutableSummary = { ...ZERO_SUMMARY };
  const rows = new Map<string, MutableSourceQualityRow>();
  const managerRows = new Map<string, MutableManagerRow>();
  const costRows: UnitEconomicsCostRow[] = [];
  const ruleCostAccumulators = new Map<string, RuleCostAccumulator>();
  const eventById = new Map((input.events ?? []).map((event) => [event.eventId, event]));
  const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));

  const createdDeals = input.deals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );

  for (const deal of createdDeals) {
    const source = resolveDealSource(deal, sourceLabels);
    const row = getOrCreateRow(rows, {
      sourceKey: source.key,
      sourceLabel: source.label,
      qualityValue: deal.qualityValue ?? null
    });
    const managerRow = getOrCreateManagerRow(
      managerRows,
      resolveDealManagerId(deal),
      managerDirectory
    );

    summary.createdDeals += 1;
    row.createdDeals += 1;
    managerRow.createdDeals += 1;

    const leadRule = activeRules.find(
      (rule) =>
        rule.articleId === "lead_purchase" &&
        rule.calculationMethod === "amount_per_lead" &&
        ruleMatchesDeal(rule, deal, source)
    );

    if (leadRule) {
      const amount = leadRule.unitPrice ?? 0;
      summary.purchasedLeads += 1;
      row.purchasedLeads += 1;
      summary.leadPurchaseCost += amount;
      summary.variableCosts += amount;
      row.leadPurchaseCost += amount;
      row.variableCosts += amount;
      managerRow.purchasedLeads += 1;
      managerRow.leadPurchaseCost += amount;
      managerRow.variableCosts += amount;
      addProductionCostDetail(managerRow, {
        articleId: leadRule.articleId,
        productLabel: `${source.label} · ${deal.qualityValue ?? "Без качества"}`,
        quantity: 1,
        unitLabel: "лид",
        unitPrice: leadRule.unitPrice,
        percent: leadRule.percent,
        amount,
        basis: "Созданные сделки периода",
        warnings: []
      });
      addRuleCost(ruleCostAccumulators, leadRule, amount);
    }
  }

  for (const deal of input.deals) {
    if (!isWonDeal(deal, wonStageIds)) {
      continue;
    }

    const wonAt = resolveWonAt(deal, stageHistoryMap, wonStageIds);
    if (!isWithinRange(wonAt, fromMs, toMs)) {
      continue;
    }

    const economics = resolveDealEconomics({
      deal,
      context: "finalWon",
      ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
    });
    const source = resolveDealSource(deal, sourceLabels);
    const row = getOrCreateRow(rows, {
      sourceKey: source.key,
      sourceLabel: source.label,
      qualityValue: deal.qualityValue ?? null
    });
    const managerRow = getOrCreateManagerRow(
      managerRows,
      resolveDealManagerId(deal),
      managerDirectory
    );
    const attractionRevenue = economics.attractionRevenueAmount ?? 0;

    summary.wonDeals += 1;
    summary.attractionRevenue += attractionRevenue;
    summary.clubRevenue += economics.membershipAmount;
    row.wonDeals += 1;
    row.attractionRevenue += attractionRevenue;
    row.clubRevenue += economics.membershipAmount;
    managerRow.wonDeals += 1;
    managerRow.attractionRevenue += attractionRevenue;
    managerRow.clubRevenue += economics.membershipAmount;
    addManagerRevenueRow(managerRow, {
      clubLabel: deal.businessClubValue ?? null,
      tariffLabel: deal.tariffValue ?? null,
      wonDeals: 1,
      attractionRevenue,
      clubRevenue: economics.membershipAmount
    });

    if (economics.pricingWarnings.length > 0) {
      row.warnings.push(...economics.pricingWarnings);
      managerRow.warnings.push(...economics.pricingWarnings);
      warnings.push(...economics.pricingWarnings);
    }

    for (const contractRule of activeRules.filter(
      (rule) =>
        rule.articleId === "contractation" &&
        rule.calculationMethod === "amount_per_contract" &&
        ruleMatchesDeal(rule, deal, source)
    )) {
      const amount = contractRule.unitPrice ?? 0;
      summary.contractationCost += amount;
      summary.variableCosts += amount;
      row.contractationCost += amount;
      row.variableCosts += amount;
      managerRow.contractationCost += amount;
      managerRow.variableCosts += amount;
      addProductionCostDetail(managerRow, {
        articleId: contractRule.articleId,
        productLabel: "Won-сделки",
        quantity: 1,
        unitLabel: "won",
        unitPrice: contractRule.unitPrice,
        percent: contractRule.percent,
        amount,
        basis: "Выигранные сделки периода",
        warnings: []
      });
      addRuleCost(ruleCostAccumulators, contractRule, amount);
    }

    for (const salesBonusRule of activeRules.filter(
      (rule) =>
        rule.articleId === "sales_bonus" &&
        rule.calculationMethod === "percent_of_club_membership" &&
        ruleMatchesDeal(rule, deal, source)
    )) {
      const amount = economics.membershipAmount * ((salesBonusRule.percent ?? 0) / 100);
      addCostToSummary(summary, salesBonusRule.pnlLevel, salesBonusRule.articleId, amount);
      managerRow.variableCosts += amount;
      addProductionCostDetail(managerRow, {
        articleId: salesBonusRule.articleId,
        productLabel: "Бонусы за продажу",
        quantity: 1,
        unitLabel: "won",
        unitPrice: null,
        percent: salesBonusRule.percent,
        amount,
        basis: "Стоимость членства клуба",
        warnings: []
      });
      addRuleCost(ruleCostAccumulators, salesBonusRule, amount);
    }
  }

  const activeEventRules = activeRules.filter(shouldHandleRuleInEventLoop);
  const specificEventRules = activeEventRules.filter(hasEventNamePattern);
  const fallbackEventRules = activeEventRules.filter((rule) => !hasEventNamePattern(rule));
  const eventParticipantMode = input.eventParticipantMode ?? "invited";
  for (const fact of input.eventVisitFacts ?? []) {
    if (!eventFactMatchesParticipantMode(fact, eventParticipantMode, fromMs, toMs)) {
      continue;
    }

    const eventName = eventNameFromFact(fact, eventById);
    const matchedSpecificRules = specificEventRules.filter((rule) =>
      ruleMatchesEvent(rule, eventName)
    );
    const matchedRules =
      matchedSpecificRules.length > 0 ? matchedSpecificRules : fallbackEventRules;
    if (matchedRules.length === 0) {
      continue;
    }

    const linkedDeal = fact.dealId ? dealById.get(fact.dealId) : undefined;
    const managerId =
      linkedDeal?.assignedById?.trim() ||
      fact.managerId?.trim() ||
      UNASSIGNED_MANAGER_ID;
    const managerRow = getOrCreateManagerRow(managerRows, managerId, managerDirectory);

    for (const eventRule of matchedRules) {
      const amount = eventRule.unitPrice ?? 0;
      addCostToSummary(summary, eventRule.pnlLevel, eventRule.articleId, amount);
      if (eventRule.articleId === "demo_events") {
        managerRow.eventCost += amount;
      } else if (eventRule.articleId === "ambassador_activities") {
        managerRow.ambassadorActivityCost += amount;
      } else if (eventRule.articleId === "ctu_certificate") {
        managerRow.ctuCertificateCost += amount;
      }
      if (eventRule.pnlLevel === "variable_contribution") {
        managerRow.variableCosts += amount;
      }
      addCostDetailByPnl(managerRow, eventRule, {
        articleId: eventRule.articleId,
        productLabel: eventName,
        quantity: 1,
        unitLabel: "участник",
        unitPrice: eventRule.unitPrice,
        percent: eventRule.percent,
        amount,
        basis:
          eventParticipantMode === "attended"
            ? "Дошедшие участники периода"
            : "Приглашенные участники периода",
        warnings: []
      });
      addRuleCost(ruleCostAccumulators, eventRule, amount);
    }
  }

  for (const { rule, amount, quantity } of ruleCostAccumulators.values()) {
    if (amount === 0) {
      continue;
    }

    costRows.push(
      emptyCostRow({
        articleId: rule.articleId,
        pnlLevel: rule.pnlLevel,
        costBehavior: rule.costBehavior,
        calculationMethod: rule.calculationMethod,
        amount,
        quantity,
        unitPrice: rule.unitPrice,
        percent: rule.percent,
        sourceKey: rule.sourceKey,
        qualityValue: rule.qualityValue,
        confidence: "inferred",
        sourceSystem: "rule"
      })
    );
  }

  for (const fact of activeFacts) {
    addCostToSummary(summary, fact.pnlLevel, fact.articleId, fact.amount);
    costRows.push(
      emptyCostRow({
        articleId: fact.articleId,
        pnlLevel: fact.pnlLevel,
        costBehavior: fact.costBehavior,
        calculationMethod: fact.calculationMethod,
        amount: fact.amount,
        quantity: fact.quantity,
        unitPrice: null,
        percent: null,
        sourceKey: null,
        qualityValue: null,
        confidence: fact.confidence,
        sourceSystem: fact.sourceSystem
      })
    );
  }

  for (const rule of activeRules) {
    if (shouldHandleRuleInDealLoop(rule) || shouldHandleRuleInEventLoop(rule)) {
      continue;
    }

    let amount = 0;
    let quantity: number | null = null;

    if (
      rule.calculationMethod === "percent_of_module_revenue" ||
      rule.calculationMethod === "percent_of_sale"
    ) {
      amount = summary.attractionRevenue * ((rule.percent ?? 0) / 100);
    } else if (rule.calculationMethod === "percent_of_club_membership") {
      amount = summary.clubRevenue * ((rule.percent ?? 0) / 100);
    } else if (
      rule.calculationMethod === "manual_amount" ||
      rule.calculationMethod === "amount_per_period"
    ) {
      amount = rule.amount ?? rule.unitPrice ?? 0;
      quantity = 1;
    } else if (rule.calculationMethod === "amount_per_contract") {
      quantity = summary.wonDeals;
      amount = (rule.unitPrice ?? 0) * quantity;
    } else if (rule.calculationMethod === "amount_per_lead") {
      quantity = summary.purchasedLeads;
      amount = (rule.unitPrice ?? 0) * quantity;
    }

    if (amount === 0) {
      continue;
    }

    addCostToSummary(summary, rule.pnlLevel, rule.articleId, amount);
    addDirectOrTaxCostDetail(managerRows, rule, amount, quantity);
    costRows.push(
      emptyCostRow({
        articleId: rule.articleId,
        pnlLevel: rule.pnlLevel,
        costBehavior: rule.costBehavior,
        calculationMethod: rule.calculationMethod,
        amount,
        quantity,
        unitPrice: rule.unitPrice,
        percent: rule.percent,
        sourceKey: rule.sourceKey,
        qualityValue: rule.qualityValue,
        confidence: "inferred",
        sourceSystem: "rule"
      })
    );
  }

  const summarySnapshot = finalizeSummary(summary, warnings);
  for (const row of managerRows.values()) {
    if (
      row.wonDeals > 0 &&
      !row.productionCostRows.some((detail) => detail.articleId === "ctu_certificate")
    ) {
      addProductionCostDetail(row, {
        articleId: "ctu_certificate",
        productLabel: "CTU сертификат",
        quantity: null,
        unitLabel: null,
        unitPrice: 50_000,
        percent: null,
        amount: 0,
        basis: "Нет факта применения",
        warnings: ["Нет признака применения CTU сертификата в текущих фактах."]
      });
    }
  }
  const sourceQualityRows: UnitEconomicsSourceQualityRow[] = [...rows.values()]
    .map((row) => {
      const financialResult = row.attractionRevenue - row.variableCosts;
      return {
        sourceKey: row.sourceKey,
        sourceLabel: row.sourceLabel,
        qualityValue: row.qualityValue,
        createdDeals: row.createdDeals,
        wonDeals: row.wonDeals,
        purchasedLeads: row.purchasedLeads,
        attractionRevenue: round(row.attractionRevenue),
        clubRevenue: round(row.clubRevenue),
        leadPurchaseCost: round(row.leadPurchaseCost),
        contractationCost: round(row.contractationCost),
        variableCosts: round(row.variableCosts),
        financialResult: round(financialResult),
        margin: safeDivide(financialResult, row.attractionRevenue),
        warnings: [...new Set(row.warnings)]
      };
    })
    .sort((left, right) => {
      if (right.attractionRevenue !== left.attractionRevenue) {
        return right.attractionRevenue - left.attractionRevenue;
      }

      if (right.createdDeals !== left.createdDeals) {
        return right.createdDeals - left.createdDeals;
      }

      return left.sourceLabel.localeCompare(right.sourceLabel, "ru");
    });
  const finalizedManagerRows: UnitEconomicsManagerRow[] = [...managerRows.values()]
    .map((row) => {
      const revenueRows = row.revenueRows ?? new Map<string, UnitEconomicsManagerRevenueRow>();
      const productionCostRows = row.productionCostRows ?? [];
      const directCostRows = row.directCostRows ?? [];
      const taxAndFinanceRows = row.taxAndFinanceRows ?? [];
      const directCosts = sumCostDetailRows(directCostRows);
      const taxAndFinanceCosts = sumCostDetailRows(taxAndFinanceRows);
      const financialResult = row.attractionRevenue - row.variableCosts - directCosts - taxAndFinanceCosts;
      return {
        managerId: row.managerId,
        managerName: row.managerName,
        createdDeals: row.createdDeals,
        wonDeals: row.wonDeals,
        purchasedLeads: row.purchasedLeads,
        attractionRevenue: round(row.attractionRevenue),
        clubRevenue: round(row.clubRevenue),
        leadPurchaseCost: round(row.leadPurchaseCost),
        eventCost: round(row.eventCost),
        ambassadorActivityCost: round(row.ambassadorActivityCost),
        ctuCertificateCost: round(row.ctuCertificateCost),
        contractationCost: round(row.contractationCost),
        variableCosts: round(row.variableCosts),
        financialResult: round(financialResult),
        margin: safeDivide(financialResult, row.attractionRevenue),
        warnings: [...new Set(row.warnings)],
        revenueRows: [...revenueRows.values()]
          .map((revenueRow) => ({
            ...revenueRow,
            attractionRevenue: round(revenueRow.attractionRevenue),
            clubRevenue: round(revenueRow.clubRevenue)
          }))
          .sort((left, right) => {
            if (right.attractionRevenue !== left.attractionRevenue) {
              return right.attractionRevenue - left.attractionRevenue;
            }

            return `${left.clubLabel ?? ""} ${left.tariffLabel ?? ""}`.localeCompare(
              `${right.clubLabel ?? ""} ${right.tariffLabel ?? ""}`,
              "ru"
            );
          }),
        productionCostRows: sortCostDetailRows(productionCostRows),
        directCostRows: sortCostDetailRows(directCostRows),
        taxAndFinanceRows: sortCostDetailRows(taxAndFinanceRows)
      };
    })
    .sort((left, right) => {
      if (right.financialResult !== left.financialResult) {
        return right.financialResult - left.financialResult;
      }

      if (right.attractionRevenue !== left.attractionRevenue) {
        return right.attractionRevenue - left.attractionRevenue;
      }

      if (right.createdDeals !== left.createdDeals) {
        return right.createdDeals - left.createdDeals;
      }

      return left.managerName.localeCompare(right.managerName, "ru");
    });

  return {
    range: input.range,
    summary: summarySnapshot,
    sourceQualityRows,
    managerRows: finalizedManagerRows,
    costRows,
    warnings: [...new Set(warnings)]
  };
}
