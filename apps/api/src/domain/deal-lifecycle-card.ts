import type {
  DealCallSummary,
  DealCohortContext,
  DealEventSummary,
  DealLifecycleCard,
  DealLifecycleStageTimelineEntry,
  DealLifecycleStatus,
  DealPricingRule,
  DealSaleCostRow,
  DealSaleEconomics,
  DealSnapshot,
  DealStageTimelineEntry,
  DealTaskSummary,
  DealTimelineEvent,
  DealTouchpointFactSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot,
  UnitEconomicsCostFact,
  UnitEconomicsCostRule,
  UnitEconomicsEventParticipantMode
} from "@bitrix24-reporting/contracts";

import { resolveDealEconomics } from "./deal-economics.js";
import {
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  resolveDealSource,
  resolveManagerName,
  UNASSIGNED_MANAGER_ID
} from "./report-dimensions.js";

interface BuildDealLifecycleCardInput {
  range: ReportRange;
  deal: DealSnapshot;
  status: DealLifecycleStatus;
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  touchpointFacts?: DealTouchpointFactSnapshot[];
  eventVisitFacts?: EventVisitFactSnapshot[];
  events?: EventSnapshot[];
  pricingRules?: DealPricingRule[] | undefined;
  costRules?: UnitEconomicsCostRule[];
  costFacts?: UnitEconomicsCostFact[];
  allocationDeals?: DealSnapshot[];
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>;
  eventParticipantMode?: UnitEconomicsEventParticipantMode | undefined;
  managerDirectory?: ManagerDirectoryEntry[];
  terminalAt?: string;
  cohortContext?: DealCohortContext | undefined;
  sla?: DealLifecycleCard["sla"] | undefined;
  fallbackEventSummary?: DealEventSummary | undefined;
  fallbackStageTimeline?: DealStageTimelineEntry[] | undefined;
}

type StageLookupEntry = {
  name: string;
};

type ParsedCallPayload = {
  direction: "incoming" | "outgoing" | "unknown";
  durationSeconds: number;
  connected: boolean;
  overThirtySeconds: boolean;
};

const ARTICLE_LABELS: Record<string, string> = {
  lead_purchase: "Лид",
  demo_events: "Мероприятия",
  ambassador_activities: "Мероприятия",
  ctu_certificate: "CTU сертификат",
  contractation: "Контрактация",
  sales_bonus: "Бонусы за продажу",
  community_integrators_fixed: "Комьюнити-интеграторы, постоянная часть",
  community_integrators_variable: "Комьюнити-интеграторы, переменная часть",
  assistant: "Ассистент",
  facility_aho: "Facility / АХО",
  it_service: "IT-сервис",
  ctg_technology_center: "CTG ЦТ / Центр технологизации",
  it_development_support: "IT-разработка и поддержка",
  other_expenses: "Прочие расходы",
  ctg_finance_service: "Финансово-юридический сервис",
  taxes: "Налоги",
  other_fixed_expenses: "Другие постоянные расходы"
};

const MANAGER_SPECIFIC_FIXED_ARTICLE_IDS = new Set([
  "community_integrators_fixed",
  "facility_aho",
  "it_service"
]);

const GROUPED_OTHER_FIXED_ARTICLE_IDS = new Set(["assistant"]);

const EMPTY_CALL_SUMMARY: DealCallSummary = {
  total: 0,
  incoming: 0,
  outgoing: 0,
  successful: 0,
  failed: 0,
  overThirtySeconds: 0,
  connectedOverThirtySeconds: 0
};

const EMPTY_TASK_SUMMARY: DealTaskSummary = {
  created: 0,
  closed: 0
};

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

function hoursBetween(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return 0;
  }

  return Math.max(0, Math.round((rightMs - leftMs) / 3_600_000));
}

function daysBetween(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return 0;
  }

  return round(Math.max(0, rightMs - leftMs) / 86_400_000);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  const lookup = new Map<string, StageLookupEntry>();

  for (const stage of stageCatalog.filter((entry) => entry.entityType === "deal")) {
    lookup.set(`${stage.categoryId ?? "0"}::${stage.statusId}`, {
      name: stage.name
    });
  }

  return lookup;
}

function resolveStageName(
  stageId: string,
  categoryId: string | null,
  stageLookup: Map<string, StageLookupEntry>
) {
  return stageLookup.get(`${categoryId ?? "0"}::${stageId}`)?.name ?? stageId;
}

function buildStageTimeline(input: {
  deal: DealSnapshot;
  stageHistory: StageHistorySnapshot[];
  stageCatalog: StageCatalogEntry[];
  terminalAt: string;
}): DealLifecycleStageTimelineEntry[] {
  const stageLookup = buildStageLookup(input.stageCatalog);
  const rows = input.stageHistory
    .filter((row) => row.ownerId === input.deal.id)
    .sort((left, right) => left.createdTime.localeCompare(right.createdTime));
  const sourceRows =
    rows.length > 0
      ? rows
      : [
          {
            id: `current:${input.deal.id}:${input.deal.stageId}`,
            ownerId: input.deal.id,
            categoryId: input.deal.categoryId,
            stageId: input.deal.stageId,
            stageSemanticId: input.deal.stageSemanticId,
            typeId: null,
            createdTime: input.deal.dateCreate
          } satisfies StageHistorySnapshot
        ];

  return sourceRows.map((row, index) => {
    const next = sourceRows[index + 1];
    const leftAt = next?.createdTime ?? input.terminalAt;

    return {
      stageId: row.stageId,
      stageName: resolveStageName(row.stageId, input.deal.categoryId, stageLookup),
      enteredAt: row.createdTime,
      leftAt,
      durationHours: hoursBetween(row.createdTime, leftAt),
      callSummary: { ...EMPTY_CALL_SUMMARY },
      taskSummary: { ...EMPTY_TASK_SUMMARY },
      meetingEvents: [],
      events: []
    };
  });
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

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function mapParticipationStatus(value: unknown) {
  const status = typeof value === "string" ? value : "unknown";

  if (status === "attended") {
    return "пришел";
  }

  if (status === "refused") {
    return "отказ";
  }

  if (status === "invited" || status === "confirmed") {
    return "приглашен";
  }

  if (status === "missed") {
    return "не пришел";
  }

  return "статус неизвестен";
}

function eventTitleFromPayload(
  payload: Record<string, unknown>,
  eventById: Map<string, EventSnapshot>
) {
  const payloadName = asString(payload.eventName) ?? asString(payload.title) ?? asString(payload.name);
  if (payloadName?.trim()) {
    return payloadName.trim();
  }

  const eventId = asString(payload.eventId);
  if (eventId) {
    return eventById.get(eventId)?.title ?? eventId;
  }

  return "Мероприятие без названия";
}

function parseCallPayload(payload: Record<string, unknown>): ParsedCallPayload {
  const rawDirection = asString(payload.direction);
  const direction =
    rawDirection === "incoming" || rawDirection === "outgoing" ? rawDirection : "unknown";
  const durationSeconds = asNumber(payload.durationSeconds) ?? 0;
  const connected = asBoolean(payload.connected) ?? durationSeconds > 0;
  const overThirtySeconds = asBoolean(payload.overThirtySeconds) ?? durationSeconds > 30;

  return {
    direction,
    durationSeconds,
    connected,
    overThirtySeconds
  };
}

function formatDuration(seconds: number) {
  return `${Math.max(0, Math.round(seconds))}с`;
}

function eventFromTouchpoint(
  fact: DealTouchpointFactSnapshot,
  eventById: Map<string, EventSnapshot>
): DealTimelineEvent | null {
  if (
    fact.kind === "message_count" ||
    fact.kind === "comment_quality_signal" ||
    !fact.dealId
  ) {
    return null;
  }

  const payload = parsePayloadJson(fact.payloadJson);
  const base = {
    id: fact.factId,
    occurredAt: fact.occurredAt,
    stageId: fact.stageIdAtEvent,
    stageName: fact.stageNameAtEvent,
    linkConfidence: fact.linkConfidence
  };

  if (fact.kind === "call") {
    const call = parseCallPayload(payload);
    const directionLabel =
      call.direction === "incoming"
        ? "входящий"
        : call.direction === "outgoing"
          ? "исходящий"
          : "тип неизвестен";
    const detailParts = [
      directionLabel,
      formatDuration(call.durationSeconds),
      call.overThirtySeconds ? ">30с" : null,
      call.connected ? "успешный" : "без соединения"
    ].filter((part): part is string => Boolean(part));

    return {
      ...base,
      kind: fact.kind,
      title: "Звонок",
      detail: detailParts.join(" · "),
      badgeLabel: null
    };
  }

  if (fact.kind === "task_created") {
    return {
      ...base,
      kind: fact.kind,
      title: "Дело создано",
      detail: null,
      badgeLabel: null
    };
  }

  if (fact.kind === "task_completed") {
    return {
      ...base,
      kind: fact.kind,
      title: "Дело закрыто",
      detail: null,
      badgeLabel: null
    };
  }

  if (fact.kind === "meeting") {
    const completed = asBoolean(payload.completed) ?? false;
    return {
      ...base,
      kind: fact.kind,
      title: "Встреча",
      detail: completed ? "проведена" : "запланирована",
      badgeLabel: null
    };
  }

  if (fact.kind === "meeting_date_changed") {
    const previousMeetingDate = asString(payload.previousMeetingDate);
    const nextMeetingDate = asString(payload.nextMeetingDate);
    const detail =
      previousMeetingDate || nextMeetingDate
        ? `${previousMeetingDate ?? "—"} -> ${nextMeetingDate ?? "—"}`
        : null;

    return {
      ...base,
      kind: fact.kind,
      title: "Дата встречи изменена",
      detail,
      badgeLabel: null
    };
  }

  if (fact.kind === "conversion_event_visit") {
    const eventName = eventTitleFromPayload(payload, eventById);
    const statusLabel = mapParticipationStatus(payload.status ?? payload.finalStatus);

    return {
      ...base,
      kind: fact.kind,
      title: `Мероприятие: ${eventName}`,
      detail: statusLabel,
      badgeLabel: `${eventName} · ${statusLabel}`
    };
  }

  return null;
}

function emptyCallSummary(): DealCallSummary {
  return { ...EMPTY_CALL_SUMMARY };
}

function emptyTaskSummary(): DealTaskSummary {
  return { ...EMPTY_TASK_SUMMARY };
}

function summarizeEvents(
  events: DealTimelineEvent[],
  payloadByEventId: Map<string, string | null>
): DealEventSummary {
  const callPayloads = events
    .filter((event) => event.kind === "call")
    .map((event) => parseCallPayload(parsePayloadJson(payloadByEventId.get(event.id) ?? null)));
  const total = callPayloads.length;
  const successful = callPayloads.filter((call) => call.connected).length;

  return {
    callSummary: {
      total,
      incoming: callPayloads.filter((call) => call.direction === "incoming").length,
      outgoing: callPayloads.filter((call) => call.direction !== "incoming").length,
      successful,
      failed: total - successful,
      overThirtySeconds: callPayloads.filter((call) => call.overThirtySeconds).length,
      connectedOverThirtySeconds: callPayloads.filter(
        (call) => call.connected && call.overThirtySeconds
      ).length
    },
    taskSummary: {
      created: events.filter((event) => event.kind === "task_created").length,
      closed: events.filter((event) => event.kind === "task_completed").length
    },
    meetingSummary: {
      total: events.filter((event) => event.kind === "meeting").length
    },
    conversionEventVisits: events.filter((event) => event.kind === "conversion_event_visit").length
  };
}

function isWithinStageInterval(
  value: string,
  stage: DealLifecycleStageTimelineEntry,
  index: number,
  timelineLength: number
) {
  const timestamp = toTimestamp(value);
  const stageStart = toTimestamp(stage.enteredAt);
  const stageEnd = toTimestamp(stage.leftAt);
  const isLast = index === timelineLength - 1;

  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(stageStart) &&
    Number.isFinite(stageEnd) &&
    timestamp >= stageStart &&
    (isLast ? timestamp <= stageEnd : timestamp < stageEnd)
  );
}

function findStageIndexForEvent(
  event: DealTimelineEvent,
  stageTimeline: DealLifecycleStageTimelineEntry[]
) {
  const matchingStageIndex = stageTimeline.findIndex(
    (stage, index) =>
      stage.stageId === event.stageId &&
      isWithinStageInterval(event.occurredAt, stage, index, stageTimeline.length)
  );
  if (matchingStageIndex >= 0) {
    return matchingStageIndex;
  }

  const intervalIndex = stageTimeline.findIndex((stage, index) =>
    isWithinStageInterval(event.occurredAt, stage, index, stageTimeline.length)
  );
  if (intervalIndex >= 0) {
    return intervalIndex;
  }

  const stageIdIndex = stageTimeline.findIndex((stage) => stage.stageId === event.stageId);
  if (stageIdIndex >= 0) {
    return stageIdIndex;
  }

  return Math.max(0, stageTimeline.length - 1);
}

function attachEventsToStages(
  stageTimeline: DealLifecycleStageTimelineEntry[],
  events: DealTimelineEvent[],
  payloadByEventId: Map<string, string | null>
) {
  const stages = stageTimeline.map((stage) => ({
    ...stage,
    callSummary: emptyCallSummary(),
    taskSummary: emptyTaskSummary(),
    events: [] as DealTimelineEvent[]
  }));

  for (const event of events) {
    const stageIndex = findStageIndexForEvent(event, stages);
    stages[stageIndex]?.events.push(event);
  }

  return stages.map((stage) => {
    const summary = summarizeEvents(stage.events, payloadByEventId);
    return {
      ...stage,
      callSummary: summary.callSummary,
      taskSummary: summary.taskSummary
    };
  });
}

function toLifecycleStageTimeline(
  stageTimeline: DealStageTimelineEntry[]
): DealLifecycleStageTimelineEntry[] {
  return stageTimeline.map((stage) => ({
    ...stage,
    meetingEvents: stage.meetingEvents ?? [],
    events: []
  }));
}

function buildTimelineEvents(input: {
  dealId: string;
  touchpointFacts: DealTouchpointFactSnapshot[];
  events: EventSnapshot[];
}) {
  const eventById = new Map(input.events.map((event) => [event.eventId, event]));
  const payloadByEventId = new Map<string, string | null>();

  const events = input.touchpointFacts
    .filter((fact) => fact.dealId === input.dealId)
    .flatMap((fact) => {
      payloadByEventId.set(fact.factId, fact.payloadJson);
      const event = eventFromTouchpoint(fact, eventById);
      return event ? [event] : [];
    })
    .sort((left, right) => {
      const byTime = left.occurredAt.localeCompare(right.occurredAt);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });

  return { events, payloadByEventId };
}

function isRuleEffectiveAt(rule: UnitEconomicsCostRule, occurredAt: string | null | undefined) {
  if (!rule.enabled) {
    return false;
  }

  const occurredAtMs = toTimestamp(occurredAt);
  const effectiveFromMs = toTimestamp(rule.effectiveFrom);
  const effectiveToMs = rule.effectiveTo ? toTimestamp(rule.effectiveTo) : Number.POSITIVE_INFINITY;

  return (
    Number.isFinite(occurredAtMs) &&
    Number.isFinite(effectiveFromMs) &&
    occurredAtMs >= effectiveFromMs &&
    occurredAtMs <= effectiveToMs
  );
}

function normalizeQualityForMatch(value: string | null | undefined) {
  return normalizeText(value).replace(/^\d+(\.\d+)?\s*/, "");
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

function eventNameFromFact(fact: EventVisitFactSnapshot, eventById: Map<string, EventSnapshot>) {
  const eventTitle = fact.eventId ? eventById.get(fact.eventId)?.title : null;
  if (eventTitle) {
    return eventTitle;
  }

  const payload = parsePayloadJson(fact.payloadJson);
  return eventTitleFromPayload(payload, eventById);
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
  mode: UnitEconomicsEventParticipantMode
) {
  if (mode === "attended") {
    return fact.finalStatus === "attended";
  }

  return Boolean(
    fact.eventDate ?? fact.invitedAt ?? fact.confirmedAt ?? fact.attendedAt ?? fact.refusedAt
  );
}

function articleLabel(articleId: string) {
  return ARTICLE_LABELS[articleId] ?? articleId;
}

function costRow(input: {
  id: string;
  rule: UnitEconomicsCostRule;
  amount: number;
  basis: string;
}): DealSaleCostRow {
  return {
    id: input.id,
    articleId: input.rule.articleId,
    label: articleLabel(input.rule.articleId),
    amount: round(input.amount),
    basis: input.basis,
    sourceSystem: "rule",
    confidence: "inferred"
  };
}

function isFixedPeriodCalculation(value: UnitEconomicsCostRule["calculationMethod"]) {
  return value === "manual_amount" || value === "amount_per_period";
}

function isModulePercentCalculation(value: UnitEconomicsCostRule["calculationMethod"]) {
  return value === "percent_of_module_revenue" || value === "percent_of_sale";
}

function monthKeyFromDate(value: string | null | undefined) {
  return value?.slice(0, 7) ?? null;
}

function monthBounds(monthKey: string) {
  const [rawYear, rawMonth] = monthKey.split("-");
  const yearValue = Number.parseInt(rawYear ?? "", 10);
  const monthValue = Number.parseInt(rawMonth ?? "", 10);
  if (!Number.isInteger(yearValue) || !Number.isInteger(monthValue)) {
    return null;
  }

  return {
    startMs: Date.UTC(yearValue, monthValue - 1, 1, 0, 0, 0, 0),
    endMs: Date.UTC(yearValue, monthValue, 1, 0, 0, 0, 0) - 1
  };
}

function isDateRangeOverlappingMonth(
  rangeStart: string | null | undefined,
  rangeEnd: string | null | undefined,
  monthKey: string
) {
  const bounds = monthBounds(monthKey);
  if (!bounds) {
    return false;
  }

  const startMs = toTimestamp(rangeStart);
  const endMs = rangeEnd ? toTimestamp(rangeEnd) : Number.POSITIVE_INFINITY;

  return Number.isFinite(startMs) && startMs <= bounds.endMs && endMs >= bounds.startMs;
}

function isFixedRuleAllocatableInMonth(rule: UnitEconomicsCostRule, monthKey: string) {
  return (
    rule.enabled &&
    rule.costBehavior === "fixed" &&
    isFixedPeriodCalculation(rule.calculationMethod) &&
    isDateRangeOverlappingMonth(rule.effectiveFrom, rule.effectiveTo, monthKey) &&
    (rule.amount ?? rule.unitPrice ?? 0) !== 0
  );
}

function isModulePercentRuleAllocatableInMonth(rule: UnitEconomicsCostRule, monthKey: string) {
  return (
    rule.enabled &&
    isModulePercentCalculation(rule.calculationMethod) &&
    isDateRangeOverlappingMonth(rule.effectiveFrom, rule.effectiveTo, monthKey) &&
    (rule.percent ?? 0) !== 0
  );
}

function isFixedFactAllocatableInMonth(fact: UnitEconomicsCostFact, monthKey: string) {
  return (
    fact.status === "active" &&
    fact.costBehavior === "fixed" &&
    isFixedPeriodCalculation(fact.calculationMethod) &&
    isDateRangeOverlappingMonth(fact.periodStart, fact.periodEnd, monthKey) &&
    fact.amount !== 0
  );
}

function dealWonAtForAllocation(
  deal: DealSnapshot,
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>
) {
  if (allocationWonAtByDeal) {
    return allocationWonAtByDeal.get(deal.id) ?? null;
  }

  return deal.dateClosed ?? deal.dateModify ?? null;
}

function isWonDealForAllocation(
  deal: DealSnapshot,
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>
) {
  if (allocationWonAtByDeal) {
    return Boolean(dealWonAtForAllocation(deal, allocationWonAtByDeal));
  }

  return deal.stageSemanticId === "S" && Boolean(dealWonAtForAllocation(deal, allocationWonAtByDeal));
}

function managerIdForDeal(deal: DealSnapshot) {
  return deal.assignedById?.trim() || UNASSIGNED_MANAGER_ID;
}

function wonDealPlural(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "выигранная сделка";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "выигранные сделки";
  }

  return "выигранных сделок";
}

function monthlyManagerWonDealCount(input: {
  allocationDeals: DealSnapshot[];
  currentDeal: DealSnapshot;
  managerId: string;
  monthKey: string;
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>;
}) {
  const dealIds = new Set<string>();

  for (const deal of input.allocationDeals) {
    if (
      !isWonDealForAllocation(deal, input.allocationWonAtByDeal) ||
      managerIdForDeal(deal) !== input.managerId
    ) {
      continue;
    }

    if (
      monthKeyFromDate(dealWonAtForAllocation(deal, input.allocationWonAtByDeal)) !== input.monthKey
    ) {
      continue;
    }

    dealIds.add(deal.id);
  }

  dealIds.add(input.currentDeal.id);
  return dealIds.size;
}

function monthlyModuleWonDeals(input: {
  allocationDeals: DealSnapshot[];
  currentDeal: DealSnapshot;
  monthKey: string;
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>;
}) {
  const dealsById = new Map<string, DealSnapshot>();

  for (const deal of input.allocationDeals) {
    if (!isWonDealForAllocation(deal, input.allocationWonAtByDeal)) {
      continue;
    }

    if (
      monthKeyFromDate(dealWonAtForAllocation(deal, input.allocationWonAtByDeal)) !== input.monthKey
    ) {
      continue;
    }

    dealsById.set(deal.id, deal);
  }

  dealsById.set(input.currentDeal.id, input.currentDeal);

  return Array.from(dealsById.values());
}

function allocatedFixedBasis(input: {
  monthKey: string;
  denominator: number;
  scope: "manager" | "module" | "moduleOther";
}) {
  if (input.scope === "manager") {
    return `Постоянные расходы менеджера за ${input.monthKey} / ${input.denominator} ${wonDealPlural(
      input.denominator
    )} менеджера`;
  }

  if (input.scope === "moduleOther") {
    return `Общемодульные и процентные постоянные расходы за ${input.monthKey} / ${input.denominator} ${wonDealPlural(
      input.denominator
    )} модуля`;
  }

  return `Общемодульные постоянные расходы за ${input.monthKey} / ${input.denominator} ${wonDealPlural(
    input.denominator
  )} модуля`;
}

function allocationScopeForFixedArticle(articleId: string): "manager" | "module" {
  return MANAGER_SPECIFIC_FIXED_ARTICLE_IDS.has(articleId) ? "manager" : "module";
}

function shouldGroupIntoOtherFixedExpenses(articleId: string) {
  return GROUPED_OTHER_FIXED_ARTICLE_IDS.has(articleId);
}

function resolveAllocationAttractionRevenue(input: {
  deal: DealSnapshot;
  pricingRules?: DealPricingRule[];
}) {
  const economics = resolveDealEconomics({
    deal: input.deal,
    context: "finalWon",
    ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
  });

  return economics.attractionRevenueAmount ?? 0;
}

function fixedCostRowFromFact(input: {
  fact: UnitEconomicsCostFact;
  monthKey: string;
  managerId: string;
  denominator: number;
  basis: string;
}): DealSaleCostRow {
  return {
    id: `fixed-fact:${input.monthKey}:${input.managerId}:${input.fact.id}`,
    articleId: input.fact.articleId,
    label: articleLabel(input.fact.articleId),
    amount: round(input.fact.amount / input.denominator),
    basis: input.basis,
    sourceSystem: "fact",
    confidence: input.fact.confidence
  };
}

function otherFixedCostRow(input: {
  monthKey: string;
  managerId: string;
  groupedFixedAmount: number;
  moduleRevenue: number;
  moduleWonDeals: number;
  rules: UnitEconomicsCostRule[];
  sourceSystem: DealSaleCostRow["sourceSystem"];
}): DealSaleCostRow | null {
  const percent = input.rules.reduce((total, rule) => total + (rule.percent ?? 0), 0);
  const amount = input.groupedFixedAmount + input.moduleRevenue * (percent / 100);

  if (amount === 0 || input.moduleWonDeals <= 0) {
    return null;
  }

  return {
    id: `fixed-other:${input.monthKey}:${input.managerId}:other-fixed-expenses`,
    articleId: "other_fixed_expenses",
    label: articleLabel("other_fixed_expenses"),
    amount: round(amount / input.moduleWonDeals),
    basis: allocatedFixedBasis({
      monthKey: input.monthKey,
      denominator: input.moduleWonDeals,
      scope: "moduleOther"
    }),
    sourceSystem: input.sourceSystem,
    confidence: "inferred"
  };
}

function buildAllocatedFixedCostRows(input: {
  deal: DealSnapshot;
  status: DealLifecycleStatus;
  managerId: string;
  terminalAt: string;
  costRules: UnitEconomicsCostRule[];
  costFacts: UnitEconomicsCostFact[];
  allocationDeals?: DealSnapshot[];
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>;
  pricingRules?: DealPricingRule[];
}) {
  if (input.status !== "won" || !input.allocationDeals?.length) {
    return [];
  }

  const saleMonthKey = monthKeyFromDate(input.terminalAt);
  if (!saleMonthKey) {
    return [];
  }

  const managerWonDeals = monthlyManagerWonDealCount({
    allocationDeals: input.allocationDeals,
    currentDeal: input.deal,
    managerId: input.managerId,
    monthKey: saleMonthKey,
    ...(input.allocationWonAtByDeal
      ? { allocationWonAtByDeal: input.allocationWonAtByDeal }
      : {})
  });
  const moduleWonDeals = monthlyModuleWonDeals({
    allocationDeals: input.allocationDeals,
    currentDeal: input.deal,
    monthKey: saleMonthKey,
    ...(input.allocationWonAtByDeal
      ? { allocationWonAtByDeal: input.allocationWonAtByDeal }
      : {})
  });

  if (managerWonDeals <= 0 || moduleWonDeals.length <= 0) {
    return [];
  }

  const rows: DealSaleCostRow[] = [];
  let groupedOtherFixedAmount = 0;
  let groupedOtherFixedHasRuleSource = false;

  for (const rule of input.costRules.filter((entry) =>
    isFixedRuleAllocatableInMonth(entry, saleMonthKey)
  )) {
    const scope = allocationScopeForFixedArticle(rule.articleId);
    const denominator = scope === "manager" ? managerWonDeals : moduleWonDeals.length;
    const amount = rule.amount ?? rule.unitPrice ?? 0;

    if (scope === "module" && shouldGroupIntoOtherFixedExpenses(rule.articleId)) {
      groupedOtherFixedAmount += amount;
      groupedOtherFixedHasRuleSource = true;
      continue;
    }

    rows.push(
      costRow({
        id: `fixed-rule:${saleMonthKey}:${input.managerId}:${rule.id}`,
        rule,
        amount: amount / denominator,
        basis: allocatedFixedBasis({
          monthKey: saleMonthKey,
          denominator,
          scope
        })
      })
    );
  }

  for (const fact of input.costFacts.filter((entry) =>
    isFixedFactAllocatableInMonth(entry, saleMonthKey)
  )) {
    const scope = allocationScopeForFixedArticle(fact.articleId);
    const denominator = scope === "manager" ? managerWonDeals : moduleWonDeals.length;

    if (scope === "module" && shouldGroupIntoOtherFixedExpenses(fact.articleId)) {
      groupedOtherFixedAmount += fact.amount;
      continue;
    }

    rows.push(
      fixedCostRowFromFact({
        fact,
        monthKey: saleMonthKey,
        managerId: input.managerId,
        denominator,
        basis: allocatedFixedBasis({
          monthKey: saleMonthKey,
          denominator,
          scope
        })
      })
    );
  }

  const modulePercentRules = input.costRules.filter((entry) =>
    isModulePercentRuleAllocatableInMonth(entry, saleMonthKey)
  );
  const otherFixedRow = otherFixedCostRow({
    monthKey: saleMonthKey,
    managerId: input.managerId,
    groupedFixedAmount: groupedOtherFixedAmount,
    moduleRevenue: moduleWonDeals.reduce(
      (total, deal) =>
        total +
        resolveAllocationAttractionRevenue({
          deal,
          ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
        }),
      0
    ),
    moduleWonDeals: moduleWonDeals.length,
    rules: modulePercentRules,
    sourceSystem:
      groupedOtherFixedHasRuleSource || modulePercentRules.length > 0 ? "rule" : "fact"
  });
  if (otherFixedRow) {
    rows.push(otherFixedRow);
  }

  return rows.filter((row) => row.amount !== 0);
}

function buildSaleCostRows(input: {
  deal: DealSnapshot;
  status: DealLifecycleStatus;
  source: { key: string; label: string };
  costRules: UnitEconomicsCostRule[];
  eventVisitFacts: EventVisitFactSnapshot[];
  events: EventSnapshot[];
  eventParticipantMode: UnitEconomicsEventParticipantMode;
  membershipAmount: number;
  terminalAt: string;
}) {
  const rows: DealSaleCostRow[] = [];
  const eventById = new Map(input.events.map((event) => [event.eventId, event]));

  for (const rule of input.costRules) {
    if (
      rule.articleId === "lead_purchase" &&
      rule.calculationMethod === "amount_per_lead" &&
      isRuleEffectiveAt(rule, input.deal.dateCreate) &&
      ruleMatchesDeal(rule, input.deal, input.source)
    ) {
      rows.push(
        costRow({
          id: `lead:${input.deal.id}:${rule.id}`,
          rule,
          amount: rule.unitPrice ?? 0,
          basis: "Созданная сделка источника/качества"
        })
      );
    }
  }

  if (input.status === "won") {
    for (const rule of input.costRules) {
      if (
        rule.articleId === "contractation" &&
        rule.calculationMethod === "amount_per_contract" &&
        isRuleEffectiveAt(rule, input.terminalAt) &&
        ruleMatchesDeal(rule, input.deal, input.source)
      ) {
        rows.push(
          costRow({
            id: `contract:${input.deal.id}:${rule.id}`,
            rule,
            amount: rule.unitPrice ?? 0,
            basis: "Выигранная сделка"
          })
        );
      }

      if (
        rule.articleId === "sales_bonus" &&
        rule.calculationMethod === "percent_of_club_membership" &&
        isRuleEffectiveAt(rule, input.terminalAt) &&
        ruleMatchesDeal(rule, input.deal, input.source)
      ) {
        rows.push(
          costRow({
            id: `sales-bonus:${input.deal.id}:${rule.id}`,
            rule,
            amount: input.membershipAmount * ((rule.percent ?? 0) / 100),
            basis: "Стоимость членства клуба"
          })
        );
      }
    }
  }

  const eventRules = input.costRules.filter(
    (rule) =>
      rule.calculationMethod === "amount_per_participant" &&
      (hasEventNamePattern(rule) ||
        rule.articleId === "demo_events" ||
        rule.articleId === "ambassador_activities")
  );
  const specificEventRules = eventRules.filter(hasEventNamePattern);
  const fallbackEventRules = eventRules.filter((rule) => !hasEventNamePattern(rule));

  for (const fact of input.eventVisitFacts.filter((fact) => fact.dealId === input.deal.id)) {
    if (!eventFactMatchesParticipantMode(fact, input.eventParticipantMode)) {
      continue;
    }

    const eventName = eventNameFromFact(fact, eventById);
    const occurredAt = fact.eventDate ?? fact.attendedAt ?? fact.invitedAt ?? input.terminalAt;
    const matchedSpecificRules = specificEventRules.filter(
      (rule) => isRuleEffectiveAt(rule, occurredAt) && ruleMatchesEvent(rule, eventName)
    );
    const matchedRules =
      matchedSpecificRules.length > 0
        ? matchedSpecificRules
        : fallbackEventRules.filter((rule) => isRuleEffectiveAt(rule, occurredAt));

    for (const rule of matchedRules) {
      rows.push(
        costRow({
          id: `event:${fact.visitId}:${rule.id}`,
          rule,
          amount: rule.unitPrice ?? 0,
          basis:
            input.eventParticipantMode === "attended"
              ? "Дошедший участник мероприятия"
              : "Приглашенный участник мероприятия"
        })
      );
    }
  }

  return rows.filter((row) => row.amount !== 0);
}

function resolveSaleEconomics(input: {
  deal: DealSnapshot;
  status: DealLifecycleStatus;
  managerId: string;
  pricingRules?: DealPricingRule[];
  costRules: UnitEconomicsCostRule[];
  costFacts: UnitEconomicsCostFact[];
  eventVisitFacts: EventVisitFactSnapshot[];
  events: EventSnapshot[];
  eventParticipantMode: UnitEconomicsEventParticipantMode;
  source: { key: string; label: string };
  terminalAt: string;
  allocationDeals?: DealSnapshot[];
  allocationWonAtByDeal?: ReadonlyMap<string, string | null | undefined>;
}): DealSaleEconomics {
  const revenueEconomics =
    input.status === "lost"
      ? {
          membershipAmount: input.deal.opportunity ?? 0,
          attractionRevenueAmount: 0
        }
      : resolveDealEconomics({
          deal: input.deal,
          context: input.status === "won" ? "finalWon" : "pipelinePlan",
          ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
        });
  const costRows = buildSaleCostRows({
    deal: input.deal,
    status: input.status,
    source: input.source,
    costRules: input.costRules,
    eventVisitFacts: input.eventVisitFacts,
    events: input.events,
    eventParticipantMode: input.eventParticipantMode,
    membershipAmount: revenueEconomics.membershipAmount,
    terminalAt: input.terminalAt
  });
  const saleCostAmount = round(costRows.reduce((total, row) => total + row.amount, 0));
  const allocatedFixedCostRows = buildAllocatedFixedCostRows({
    deal: input.deal,
    status: input.status,
    managerId: input.managerId,
    terminalAt: input.terminalAt,
    costRules: input.costRules,
    costFacts: input.costFacts,
    ...(input.allocationDeals ? { allocationDeals: input.allocationDeals } : {}),
    ...(input.allocationWonAtByDeal
      ? { allocationWonAtByDeal: input.allocationWonAtByDeal }
      : {}),
    ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
  });
  const allocatedFixedCostAmount = round(
    allocatedFixedCostRows.reduce((total, row) => total + row.amount, 0)
  );
  const fullyLoadedCostAmount = round(saleCostAmount + allocatedFixedCostAmount);
  const attractionRevenueAmount = revenueEconomics.attractionRevenueAmount ?? null;
  const revenueMode =
    input.status === "won" ? "actual" : input.status === "wip" ? "planned" : "none";
  const marginAmount =
    input.status === "wip"
      ? null
      : round((attractionRevenueAmount ?? 0) - saleCostAmount);
  const fullyLoadedMarginAmount =
    input.status === "wip"
      ? null
      : round((attractionRevenueAmount ?? 0) - fullyLoadedCostAmount);

  return {
    revenueMode,
    attractionRevenueAmount,
    membershipAmount: revenueEconomics.membershipAmount,
    saleCostAmount,
    marginAmount,
    allocatedFixedCostAmount,
    fullyLoadedCostAmount,
    fullyLoadedMarginAmount,
    costRows,
    allocatedFixedCostRows
  };
}

export function buildDealLifecycleCard(input: BuildDealLifecycleCardInput): DealLifecycleCard {
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const source = resolveDealSource(input.deal, sourceLabels);
  const managerId = input.deal.assignedById?.trim() || UNASSIGNED_MANAGER_ID;
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const terminalAt =
    input.terminalAt ?? input.deal.dateClosed ?? input.deal.dateModify ?? input.range.to;
  const rawStageTimeline = buildStageTimeline({
    deal: input.deal,
    stageHistory: input.stageHistory,
    stageCatalog: input.stageCatalog,
    terminalAt
  });
  const timelineEvents = buildTimelineEvents({
    dealId: input.deal.id,
    touchpointFacts: input.touchpointFacts ?? [],
    events: input.events ?? []
  });
  const hasCanonicalTimelineEvents = timelineEvents.events.length > 0;
  const stageTimeline = hasCanonicalTimelineEvents
    ? attachEventsToStages(rawStageTimeline, timelineEvents.events, timelineEvents.payloadByEventId)
    : input.fallbackStageTimeline && input.fallbackStageTimeline.length > 0
      ? toLifecycleStageTimeline(input.fallbackStageTimeline)
      : attachEventsToStages(rawStageTimeline, timelineEvents.events, timelineEvents.payloadByEventId);
  const eventSummary = hasCanonicalTimelineEvents
    ? summarizeEvents(timelineEvents.events, timelineEvents.payloadByEventId)
    : input.fallbackEventSummary ??
      summarizeEvents(timelineEvents.events, timelineEvents.payloadByEventId);
  const economics = resolveSaleEconomics({
    deal: input.deal,
    status: input.status,
    managerId,
    costRules: input.costRules ?? [],
    costFacts: input.costFacts ?? [],
    eventVisitFacts: input.eventVisitFacts ?? [],
    events: input.events ?? [],
    eventParticipantMode: input.eventParticipantMode ?? "invited",
    source,
    terminalAt,
    ...(input.allocationDeals ? { allocationDeals: input.allocationDeals } : {}),
    ...(input.allocationWonAtByDeal
      ? { allocationWonAtByDeal: input.allocationWonAtByDeal }
      : {}),
    ...(input.pricingRules ? { pricingRules: input.pricingRules } : {})
  });
  const currentStageName = resolveStageName(
    input.deal.stageId,
    input.deal.categoryId,
    buildStageLookup(input.stageCatalog)
  );

  return {
    dealId: input.deal.id,
    managerId,
    managerName: resolveManagerName(managerId, managerDirectory),
    status: input.status,
    stageId: input.deal.stageId,
    stageName: currentStageName,
    dateCreate: input.deal.dateCreate,
    dateClosed: input.deal.dateClosed,
    dateModify: input.deal.dateModify,
    cycleDays: daysBetween(input.deal.dateCreate, terminalAt),
    sourceKey: source.key,
    sourceLabel: source.label,
    qualityValue: input.deal.qualityValue,
    businessClubValue: input.deal.businessClubValue ?? null,
    targetGroupValue: input.deal.targetGroupValue ?? null,
    meetingTypeValue: input.deal.meetingTypeValue ?? null,
    meetingDateValue: input.deal.meetingDateValue ?? null,
    tariffValue: input.deal.tariffValue ?? null,
    economics,
    eventSummary,
    stageTimeline,
    ...(input.cohortContext ? { cohortContext: input.cohortContext } : {}),
    ...(input.sla ? { sla: input.sla } : {})
  };
}
