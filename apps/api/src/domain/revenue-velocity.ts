import type {
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  RevenueVelocityActionSummary,
  RevenueVelocityActionWeights,
  RevenueVelocityDimension,
  RevenueVelocityFormulaTooltip,
  RevenueVelocityMoneyPerAction,
  RevenueVelocityReportSnapshot,
  RevenueVelocityRow,
  SourceCatalogEntry,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME,
  UNATTRIBUTED_SOURCE_KEY,
  UNATTRIBUTED_SOURCE_LABEL,
  normalizeCategoryId
} from "./report-dimensions";

export interface RevenueVelocityReportInput {
  range: ReportRange;
  asOf: string;
  dimension: RevenueVelocityDimension;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  conversionEvents: ConversionEventSnapshot[];
  managerDirectory: ManagerDirectoryEntry[];
  sourceCatalog: SourceCatalogEntry[];
  filters?: {
    managerIds?: string[];
    sourceKeys?: string[];
    customerKeys?: string[];
    qualityKeys?: string[];
    tariffKeys?: string[];
  };
  actionWeights?: RevenueVelocityActionWeights;
}

export const DEFAULT_REVENUE_VELOCITY_ACTION_WEIGHTS: RevenueVelocityActionWeights = {
  connectedCallOverThirtySeconds: 1,
  meeting: 3,
  conversionEvent: 5,
  closedTask: 0.5
};

const CONVERSION_EVENT_STAGE_NAMES = ["Активация", "Демонстрация"];
const UNKNOWN_CUSTOMER_KEY = "unknown";
const UNKNOWN_CUSTOMER_LABEL = "Без клуба / заказчика";
const UNRESOLVED_CONVERSION_EVENT_STAGE_WARNING =
  "Часть конверсионных мероприятий не учтена: не удалось определить этап сделки на момент события.";
const EMPTY_CONVERSION_EVENTS_WARNING =
  "Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные на этапах Активация и Демонстрация.";

export const REVENUE_VELOCITY_FORMULA_TOOLTIPS: RevenueVelocityFormulaTooltip[] = [
  {
    key: "createdDeals",
    label: "Возможности",
    formula: "Количество сделок, созданных в выбранном периоде",
    description:
      "Сколько возможностей попало в выбранную когорту. Берём сделки, у которых дата создания находится внутри выбранного периода."
  },
  {
    key: "wonDeals",
    label: "Выиграно",
    formula: "Количество сделок в выигранных стадиях",
    description:
      "Сколько сделок из выбранной когорты дошло до успешного результата. Успех определяется через текущие настройки won stages."
  },
  {
    key: "wipDeals",
    label: "WIP",
    formula: "Возможности - Выиграно - Проиграно",
    description:
      "Сделки из когорты, которые ещё не выиграны и не проиграны. Это активная незавершённая база."
  },
  {
    key: "salesAmount",
    label: "Сумма продаж",
    formula: "Сумма opportunity по выигранным сделкам",
    description:
      "Сумма денег по выигранным сделкам из выбранной когорты. В phase 1 это CRM-сумма сделки без учёта расходов."
  },
  {
    key: "averageCheck",
    label: "Средний чек",
    formula: "Сумма выигранных сделок / Количество выигранных сделок",
    description:
      "Средний размер выигранной сделки. Считаем сумму выигранных сделок и делим на количество выигранных сделок.",
    emptyState: "Если выигранных сделок нет, средний чек не считается."
  },
  {
    key: "winRate",
    label: "Конверсия",
    formula: "Выигранные сделки / Созданные возможности",
    description:
      "Доля возможностей, которые дошли до успешного результата. Считаем выигранные сделки и делим на все сделки выбранной когорты."
  },
  {
    key: "averageCycleDays",
    label: "Средний цикл сделки",
    formula: "Среднее dateClosed - dateCreate по выигранным сделкам",
    description:
      "Сколько дней в среднем проходит от создания сделки до успешного закрытия. Считается только по выигранным сделкам.",
    emptyState:
      "Если выигранных сделок нет или нет даты закрытия, цикл не считается."
  },
  {
    key: "revenueVelocityPerDay",
    label: "Revenue Velocity",
    formula:
      "Средний чек × Количество возможностей × Конверсия / Средний цикл сделки",
    description:
      "Показывает, с какой денежной скоростью эта группа превращает возможности в выигранные сделки.",
    emptyState:
      "Если нет выигранных сделок или средний цикл равен 0, денежная скорость не считается."
  },
  {
    key: "moneyPerMeeting",
    label: "₽ / встречу",
    formula: "Сумма выигранных сделок / Количество встреч",
    description:
      "Сколько денег приходится на одну встречу по сделкам выбранной когорты.",
    emptyState: "Если встреч нет, метрика не считается."
  },
  {
    key: "moneyPerConnectedCallOverThirtySeconds",
    label: "₽ / звонок >30 сек",
    formula: "Сумма выигранных сделок / Количество звонков >30 секунд",
    description:
      "Сколько денег приходится на один содержательный звонок. Содержательным считаем связанный со сделкой звонок длительностью больше 30 секунд.",
    emptyState: "Если успешных звонков больше 30 секунд нет, метрика не считается."
  },
  {
    key: "moneyPerConversionEvent",
    label: "₽ / конв. мероприятие",
    formula: "Сумма выигранных сделок / Количество конверсионных мероприятий",
    description:
      "Сколько денег приходится на одно конверсионное мероприятие. Учитываются только мероприятия по сделкам выбранной когорты на этапах Активация и Демонстрация.",
    emptyState:
      "Если мероприятий нет или они ещё не подключены, метрика не считается."
  },
  {
    key: "moneyPerClosedTask",
    label: "₽ / закрытую задачу",
    formula: "Сумма выигранных сделок / Количество закрытых задач",
    description:
      "Сколько денег приходится на одну закрытую задачу/дело по сделкам выбранной когорты."
  },
  {
    key: "weightedActionPoints",
    label: "Взвешенные баллы",
    formula:
      "Звонки >30 сек × 1 + Встречи × 3 + Конв. мероприятия × 5 + Закрытые задачи × 0.5",
    description:
      "Разные действия имеют разную управленческую ценность. Сумма показывает общий объём полезных действий в условных баллах."
  },
  {
    key: "moneyPerWeightedActionPoint",
    label: "₽ / балл действий",
    formula: "Сумма выигранных сделок / Взвешенные баллы действий",
    description:
      "Показывает, сколько денег приносит один условный балл действий. Чем выше значение, тем эффективнее группа монетизирует свои действия.",
    emptyState: "Если действий нет, метрика не считается."
  },
  {
    key: "weightedActionPointsPerWin",
    label: "Балл действий / выигрыш",
    formula: "Взвешенные баллы действий / Выигранные сделки",
    description:
      "Сколько условных баллов действий в среднем требуется, чтобы получить одну выигранную сделку."
  },
  {
    key: "actionEfficiencyIndex",
    label: "Индекс эффективности действий",
    formula:
      "₽ / балл действий строки / Средний ₽ / балл действий по команде × 100",
    description:
      "100 — средний уровень команды. Выше 100 — действия монетизируются лучше среднего. Ниже 100 — хуже среднего."
  }
];

interface DealDimension {
  managerId: string;
  managerName: string;
  sourceKey: string;
  sourceLabel: string;
  customerKey: string;
  customerLabel: string;
}

interface Accumulator {
  dimension: RevenueVelocityDimension;
  key: string;
  label: string;
  managerId: string | null;
  managerName: string | null;
  sourceKey: string | null;
  sourceLabel: string | null;
  customerKey: string | null;
  customerLabel: string | null;
  deals: DealSnapshot[];
  createdDeals: number;
  wonDeals: number;
  lostDeals: number;
  salesAmount: number;
  cycleDays: number[];
  actions: RevenueVelocityActionSummary;
  warnings: Set<string>;
}

function toTimestamp(value: string | null | undefined) {
  return value ? Date.parse(value) : Number.NaN;
}

function isWithinRange(value: string | null | undefined, fromMs: number, toMs: number) {
  const timestamp = toTimestamp(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function isLifecycleTimestamp(value: string | null | undefined, deal: DealSnapshot, asOfMs: number) {
  return isWithinRange(value, Date.parse(deal.dateCreate), asOfMs);
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function safeDivide(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return round(numerator / denominator);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return round(values.reduce((total, value) => total + value, 0) / values.length);
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  const middle = sorted[middleIndex];

  if (middle === undefined) {
    return null;
  }

  if (sorted.length % 2 === 1) {
    return round(middle);
  }

  const previous = sorted[middleIndex - 1];
  return previous === undefined ? round(middle) : round((previous + middle) / 2);
}

function createEmptyActionSummary(): RevenueVelocityActionSummary {
  return {
    totalCalls: 0,
    connectedCallsOverThirtySeconds: 0,
    meetingsCount: 0,
    conversionEventsCount: 0,
    createdTasks: 0,
    closedTasks: 0,
    weightedActionPoints: 0,
    weightedActionPointsPerDeal: null,
    weightedActionPointsPerWin: null
  };
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
      const byTime = Date.parse(left.createdTime) - Date.parse(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
  }

  return map;
}

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  return new Map(
    stageCatalog
      .filter((stage) => stage.entityType === "deal")
      .map((stage) => [
        stage.statusId,
        {
          stageName: stage.name,
          semanticId: stage.semanticId,
          sortOrder: stage.sortOrder ?? 0
        }
      ])
  );
}

function resolveStageAtTime(input: {
  dealId: string;
  timestamp: string;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  const timestamp = Date.parse(input.timestamp);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  let stageId: string | null = null;
  for (const row of input.stageHistoryMap.get(input.dealId) ?? []) {
    const rowTime = Date.parse(row.createdTime);
    if (!Number.isFinite(rowTime) || rowTime > timestamp) {
      break;
    }

    stageId = row.stageId;
  }

  return stageId;
}

function normalizeStageName(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru");
}

function isConversionEventStage(stageName: string | null | undefined) {
  const normalized = normalizeStageName(stageName);
  return CONVERSION_EVENT_STAGE_NAMES.some(
    (allowed) => normalizeStageName(allowed) === normalized
  );
}

function resolveCustomer(deal: DealSnapshot) {
  const value = deal.businessClubValue?.trim();

  return value
    ? {
        key: value,
        label: value
      }
    : {
        key: UNKNOWN_CUSTOMER_KEY,
        label: UNKNOWN_CUSTOMER_LABEL
      };
}

function resolveSource(
  deal: DealSnapshot,
  sourceLabels: Map<string, string>
) {
  const sourceKey = deal.sourceId?.trim() || deal.utmSource?.trim();
  if (!sourceKey) {
    return {
      key: UNATTRIBUTED_SOURCE_KEY,
      label: UNATTRIBUTED_SOURCE_LABEL
    };
  }

  return {
    key: sourceKey,
    label: sourceLabels.get(sourceKey) ?? sourceKey
  };
}

function resolveDealDimension(
  deal: DealSnapshot,
  managerNames: Map<string, string>,
  sourceLabels: Map<string, string>
): DealDimension {
  const managerId = deal.assignedById ?? UNASSIGNED_MANAGER_ID;
  const source = resolveSource(deal, sourceLabels);
  const customer = resolveCustomer(deal);

  return {
    managerId,
    managerName:
      managerNames.get(managerId) ??
      (managerId === UNASSIGNED_MANAGER_ID ? UNASSIGNED_MANAGER_NAME : managerId),
    sourceKey: source.key,
    sourceLabel: source.label,
    customerKey: customer.key,
    customerLabel: customer.label
  };
}

function getDimensionKey(
  dimension: RevenueVelocityDimension,
  dealDimension: DealDimension
) {
  if (dimension === "manager") {
    return {
      key: dealDimension.managerId,
      label: dealDimension.managerName
    };
  }

  if (dimension === "source") {
    return {
      key: dealDimension.sourceKey,
      label: dealDimension.sourceLabel
    };
  }

  if (dimension === "customer") {
    return {
      key: dealDimension.customerKey,
      label: dealDimension.customerLabel
    };
  }

  if (dimension === "managerSource") {
    return {
      key: `${dealDimension.managerId}::${dealDimension.sourceKey}`,
      label: `${dealDimension.managerName} / ${dealDimension.sourceLabel}`
    };
  }

  if (dimension === "sourceCustomer") {
    return {
      key: `${dealDimension.sourceKey}::${dealDimension.customerKey}`,
      label: `${dealDimension.sourceLabel} / ${dealDimension.customerLabel}`
    };
  }

  return {
    key: `${dealDimension.managerId}::${dealDimension.customerKey}`,
    label: `${dealDimension.managerName} / ${dealDimension.customerLabel}`
  };
}

function isWonDeal(deal: DealSnapshot, wonStageIds: Set<string>) {
  return wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S";
}

function isLostDeal(deal: DealSnapshot, stageLookup: Map<string, { semanticId: string | null }>) {
  return deal.stageSemanticId === "F" || stageLookup.get(deal.stageId)?.semanticId === "F";
}

function isMeetingActivity(activity: ActivitySnapshot) {
  return activity.typeId === "1" || activity.providerId === "CRM_MEETING";
}

function isCallActivity(activity: ActivitySnapshot) {
  return activity.typeId === "2" || activity.providerId === "VOXIMPLANT_CALL";
}

function isTaskActivity(activity: ActivitySnapshot) {
  return !isMeetingActivity(activity) && !isCallActivity(activity);
}

function isDealOwnerType(ownerTypeId: string) {
  return ownerTypeId === "2" || ownerTypeId.toUpperCase() === "DEAL";
}

function normalizeCallStatusCode(value: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function isCallSuccessful(call: CallSnapshot) {
  const statusCode = normalizeCallStatusCode(call.callFailedCode);
  return (
    call.callDurationSeconds > 0 &&
    (statusCode.length === 0 || statusCode === "200")
  );
}

function resolveCallDealId(call: CallSnapshot, activitiesById: Map<string, ActivitySnapshot>) {
  if (
    call.crmEntityId &&
    (call.crmEntityType?.toUpperCase() === "DEAL" || call.crmEntityType === "2")
  ) {
    return call.crmEntityId;
  }

  if (!call.crmActivityId) {
    return null;
  }

  const activity = activitiesById.get(call.crmActivityId);
  return activity && isDealOwnerType(activity.ownerTypeId) ? activity.ownerId : null;
}

function groupActivitiesByDeal(activities: ActivitySnapshot[], dealIds: Set<string>) {
  const map = new Map<string, ActivitySnapshot[]>();

  for (const activity of activities) {
    if (
      !isDealOwnerType(activity.ownerTypeId) || !dealIds.has(activity.ownerId)
    ) {
      continue;
    }

    const current = map.get(activity.ownerId) ?? [];
    current.push(activity);
    map.set(activity.ownerId, current);
  }

  return map;
}

function groupCallsByDeal(input: {
  calls: CallSnapshot[];
  dealIds: Set<string>;
  activitiesById: Map<string, ActivitySnapshot>;
}) {
  const map = new Map<string, CallSnapshot[]>();

  for (const call of input.calls) {
    const dealId = resolveCallDealId(call, input.activitiesById);
    if (!dealId || !input.dealIds.has(dealId)) {
      continue;
    }

    const current = map.get(dealId) ?? [];
    current.push(call);
    map.set(dealId, current);
  }

  return map;
}

function createAccumulator(
  dimension: RevenueVelocityDimension,
  key: string,
  label: string,
  dealDimension?: DealDimension
): Accumulator {
  return {
    dimension,
    key,
    label,
    managerId:
      dimension === "manager" || dimension === "managerSource" || dimension === "managerCustomer"
        ? dealDimension?.managerId ?? null
        : null,
    managerName:
      dimension === "manager" || dimension === "managerSource" || dimension === "managerCustomer"
        ? dealDimension?.managerName ?? null
        : null,
    sourceKey:
      dimension === "source" || dimension === "managerSource" || dimension === "sourceCustomer"
        ? dealDimension?.sourceKey ?? null
        : null,
    sourceLabel:
      dimension === "source" || dimension === "managerSource" || dimension === "sourceCustomer"
        ? dealDimension?.sourceLabel ?? null
        : null,
    customerKey:
      dimension === "customer" || dimension === "sourceCustomer" || dimension === "managerCustomer"
        ? dealDimension?.customerKey ?? null
        : null,
    customerLabel:
      dimension === "customer" || dimension === "sourceCustomer" || dimension === "managerCustomer"
        ? dealDimension?.customerLabel ?? null
        : null,
    deals: [],
    createdDeals: 0,
    wonDeals: 0,
    lostDeals: 0,
    salesAmount: 0,
    cycleDays: [],
    actions: createEmptyActionSummary(),
    warnings: new Set()
  };
}

function addActions(
  target: RevenueVelocityActionSummary,
  source: RevenueVelocityActionSummary
) {
  target.totalCalls += source.totalCalls;
  target.connectedCallsOverThirtySeconds += source.connectedCallsOverThirtySeconds;
  target.meetingsCount += source.meetingsCount;
  target.conversionEventsCount += source.conversionEventsCount;
  target.createdTasks += source.createdTasks;
  target.closedTasks += source.closedTasks;
}

function calculateWeightedActionPoints(
  actions: RevenueVelocityActionSummary,
  weights: RevenueVelocityActionWeights
) {
  return round(
    actions.connectedCallsOverThirtySeconds * weights.connectedCallOverThirtySeconds +
      actions.meetingsCount * weights.meeting +
      actions.conversionEventsCount * weights.conversionEvent +
      actions.closedTasks * weights.closedTask
  );
}

function buildMoneyPerAction(
  salesAmount: number,
  actions: RevenueVelocityActionSummary,
  teamMoneyPerWeightedActionPoint: number | null
): RevenueVelocityMoneyPerAction {
  const moneyPerWeightedActionPoint = safeDivide(
    salesAmount,
    actions.weightedActionPoints
  );

  return {
    moneyPerMeeting: safeDivide(salesAmount, actions.meetingsCount),
    moneyPerConnectedCallOverThirtySeconds: safeDivide(
      salesAmount,
      actions.connectedCallsOverThirtySeconds
    ),
    moneyPerConversionEvent: safeDivide(salesAmount, actions.conversionEventsCount),
    moneyPerClosedTask: safeDivide(salesAmount, actions.closedTasks),
    moneyPerWeightedActionPoint,
    actionEfficiencyIndex:
      moneyPerWeightedActionPoint !== null && teamMoneyPerWeightedActionPoint !== null
        ? round((moneyPerWeightedActionPoint / teamMoneyPerWeightedActionPoint) * 100)
        : null
  };
}

function buildDealActionSummary(input: {
  deal: DealSnapshot;
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  conversionEventsCount: number;
  asOfMs: number;
}) {
  const actions = createEmptyActionSummary();
  const lifecycleActivities = input.activities.filter((activity) =>
    isLifecycleTimestamp(activity.createdTime, input.deal, input.asOfMs)
  );
  const taskActivities = lifecycleActivities.filter(isTaskActivity);
  const meetingActivities = lifecycleActivities.filter(isMeetingActivity);
  const lifecycleCalls = input.calls.filter((call) =>
    isLifecycleTimestamp(call.callStartDate, input.deal, input.asOfMs)
  );

  actions.totalCalls = lifecycleCalls.length;
  actions.connectedCallsOverThirtySeconds = lifecycleCalls.filter(
    (call) => call.callDurationSeconds > 30 && isCallSuccessful(call)
  ).length;
  actions.meetingsCount = meetingActivities.length;
  actions.conversionEventsCount = input.conversionEventsCount;
  actions.createdTasks = taskActivities.length;
  actions.closedTasks = taskActivities.filter((activity) => {
    if (!activity.completed) {
      return false;
    }

    return activity.completedTime
      ? isLifecycleTimestamp(activity.completedTime, input.deal, input.asOfMs)
      : true;
  }).length;

  return actions;
}

function resolveConversionEventStage(input: {
  event: ConversionEventSnapshot;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  if (input.event.stageNameAtEvent?.trim()) {
    return input.event.stageNameAtEvent;
  }

  if (input.event.stageIdAtEvent) {
    return input.stageLookup.get(input.event.stageIdAtEvent)?.stageName ?? null;
  }

  if (!input.event.dealId) {
    return null;
  }

  const stageId = resolveStageAtTime({
    dealId: input.event.dealId,
    timestamp: input.event.occurredAt,
    stageHistoryMap: input.stageHistoryMap
  });

  return stageId ? input.stageLookup.get(stageId)?.stageName ?? null : null;
}

function buildConversionEventsByDeal(input: {
  conversionEvents: ConversionEventSnapshot[];
  cohortDeals: Map<string, DealSnapshot>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  asOfMs: number;
  warnings: Set<string>;
}) {
  const map = new Map<string, number>();
  let unresolvedStageCount = 0;

  for (const event of input.conversionEvents) {
    if (!event.dealId) {
      continue;
    }

    const deal = input.cohortDeals.get(event.dealId);
    if (!deal || !isLifecycleTimestamp(event.occurredAt, deal, input.asOfMs)) {
      continue;
    }

    const stageName = resolveConversionEventStage({
      event,
      stageLookup: input.stageLookup,
      stageHistoryMap: input.stageHistoryMap
    });

    if (!stageName) {
      unresolvedStageCount += 1;
      continue;
    }

    if (!isConversionEventStage(stageName)) {
      continue;
    }

    map.set(event.dealId, (map.get(event.dealId) ?? 0) + 1);
  }

  if (unresolvedStageCount > 0) {
    input.warnings.add(UNRESOLVED_CONVERSION_EVENT_STAGE_WARNING);
  }

  return map;
}

function calculateCycleDays(
  deal: DealSnapshot,
  warnings: Set<string>
) {
  if (!deal.dateClosed) {
    return null;
  }

  const cycleMs = Date.parse(deal.dateClosed) - Date.parse(deal.dateCreate);
  if (!Number.isFinite(cycleMs) || cycleMs < 0) {
    warnings.add(
      "Часть выигранных сделок не учтена в цикле: дата закрытия раньше даты создания."
    );
    return null;
  }

  return round(cycleMs / 86_400_000);
}

function buildStagePath(input: {
  deal: DealSnapshot;
  stageHistoryRows: StageHistorySnapshot[];
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
}) {
  const rawStageIds =
    input.stageHistoryRows.length > 0
      ? input.stageHistoryRows.map((row) => row.stageId)
      : [input.deal.stageId];
  const stageIds: string[] = [];

  for (const stageId of rawStageIds) {
    if (!input.stageLookup.has(stageId) || stageIds[stageIds.length - 1] === stageId) {
      continue;
    }

    stageIds.push(stageId);
  }

  return stageIds;
}

function resolveBottleneckStage(input: {
  deals: DealSnapshot[];
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
}) {
  const stageStats = new Map<
    string,
    {
      stageId: string;
      reached: Set<string>;
      movedNext: Set<string>;
      durations: number[];
    }
  >();

  const ensureStage = (stageId: string) => {
    const current = stageStats.get(stageId) ?? {
      stageId,
      reached: new Set<string>(),
      movedNext: new Set<string>(),
      durations: []
    };
    stageStats.set(stageId, current);
    return current;
  };

  for (const deal of input.deals) {
    const historyRows = input.stageHistoryMap.get(deal.id) ?? [];
    const path = buildStagePath({
      deal,
      stageHistoryRows: historyRows,
      stageLookup: input.stageLookup
    });

    for (let index = 0; index < path.length; index += 1) {
      const stageId = path[index];
      if (!stageId) {
        continue;
      }

      const stage = input.stageLookup.get(stageId);
      if (!stage || stage.semanticId === "S" || stage.semanticId === "F") {
        continue;
      }

      const stats = ensureStage(stageId);
      stats.reached.add(deal.id);

      if (path[index + 1]) {
        stats.movedNext.add(deal.id);
      }

      const currentRow = historyRows.find((row) => row.stageId === stageId);
      const nextRow = currentRow
        ? historyRows[historyRows.indexOf(currentRow) + 1]
        : null;
      const enteredAt = currentRow?.createdTime ?? deal.dateCreate;
      const leftAt = nextRow?.createdTime ?? deal.dateClosed ?? deal.dateModify;
      const durationMs = Date.parse(leftAt) - Date.parse(enteredAt);
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        stats.durations.push(durationMs / 86_400_000);
      }
    }
  }

  const candidates = Array.from(stageStats.values()).filter(
    (stage) => stage.reached.size >= 2
  );
  if (candidates.length === 0) {
    return {
      bottleneckStageId: null,
      bottleneckStageName: null
    };
  }

  const maxAverageDuration = Math.max(
    ...candidates.map((stage) => average(stage.durations) ?? 0),
    1
  );
  const ranked = candidates
    .map((stage) => {
      const averageDuration = average(stage.durations) ?? 0;
      const stageConversion =
        stage.reached.size > 0 ? stage.movedNext.size / stage.reached.size : 0;

      return {
        stageId: stage.stageId,
        score:
          (1 - stageConversion) * 0.6 +
          (averageDuration / maxAverageDuration) * 0.4
      };
    })
    .sort((left, right) => right.score - left.score);
  const bottleneck = ranked[0];

  return {
    bottleneckStageId: bottleneck?.stageId ?? null,
    bottleneckStageName: bottleneck
      ? input.stageLookup.get(bottleneck.stageId)?.stageName ?? bottleneck.stageId
      : null
  };
}

function finalizeRow(input: {
  accumulator: Accumulator;
  weights: RevenueVelocityActionWeights;
  teamMoneyPerWeightedActionPoint: number | null;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
}): RevenueVelocityRow {
  const { accumulator } = input;
  const activeDeals = accumulator.createdDeals - accumulator.lostDeals;
  const wipDeals = accumulator.createdDeals - accumulator.wonDeals - accumulator.lostDeals;
  const averageCheck = safeDivide(accumulator.salesAmount, accumulator.wonDeals);
  const winRate = safeDivide(accumulator.wonDeals, accumulator.createdDeals);
  const averageCycleDays = average(accumulator.cycleDays);
  const medianCycleDays = median(accumulator.cycleDays);
  const revenueVelocityPerDay =
    averageCheck !== null && winRate !== null && averageCycleDays !== null && averageCycleDays > 0
      ? round(accumulator.salesAmount / averageCycleDays)
      : null;
  const actions: RevenueVelocityActionSummary = {
    ...accumulator.actions,
    weightedActionPoints: calculateWeightedActionPoints(
      accumulator.actions,
      input.weights
    ),
    weightedActionPointsPerDeal: null,
    weightedActionPointsPerWin: null
  };
  actions.weightedActionPointsPerDeal = safeDivide(
    actions.weightedActionPoints,
    accumulator.createdDeals
  );
  actions.weightedActionPointsPerWin = safeDivide(
    actions.weightedActionPoints,
    accumulator.wonDeals
  );
  const bottleneck = resolveBottleneckStage({
    deals: accumulator.deals,
    stageHistoryMap: input.stageHistoryMap,
    stageLookup: input.stageLookup
  });

  return {
    dimension: accumulator.dimension,
    key: accumulator.key,
    label: accumulator.label,
    managerId: accumulator.managerId,
    managerName: accumulator.managerName,
    sourceKey: accumulator.sourceKey,
    sourceLabel: accumulator.sourceLabel,
    customerKey: accumulator.customerKey,
    customerLabel: accumulator.customerLabel,
    createdDeals: accumulator.createdDeals,
    activeDeals,
    wonDeals: accumulator.wonDeals,
    lostDeals: accumulator.lostDeals,
    wipDeals,
    salesAmount: round(accumulator.salesAmount),
    averageCheck,
    winRate,
    averageCycleDays,
    medianCycleDays,
    revenueVelocityPerDay,
    actions,
    moneyPerAction: buildMoneyPerAction(
      accumulator.salesAmount,
      actions,
      input.teamMoneyPerWeightedActionPoint
    ),
    bottleneckStageId: bottleneck.bottleneckStageId,
    bottleneckStageName: bottleneck.bottleneckStageName,
    warnings: Array.from(accumulator.warnings)
  };
}

function rowSort(left: RevenueVelocityRow, right: RevenueVelocityRow) {
  const leftVelocity = left.revenueVelocityPerDay ?? -1;
  const rightVelocity = right.revenueVelocityPerDay ?? -1;
  if (leftVelocity !== rightVelocity) {
    return rightVelocity - leftVelocity;
  }

  if (left.createdDeals !== right.createdDeals) {
    return right.createdDeals - left.createdDeals;
  }

  return left.label.localeCompare(right.label, "ru");
}

export function buildRevenueVelocityReport(
  input: RevenueVelocityReportInput
): RevenueVelocityReportSnapshot {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const asOfMs = Date.parse(input.asOf);
  const effectiveAsOfMs = Number.isFinite(asOfMs) ? asOfMs : toMs;
  const actionWeights = input.actionWeights ?? DEFAULT_REVENUE_VELOCITY_ACTION_WEIGHTS;
  const wonStageIds = new Set(input.wonStageIds);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const stageHistoryMap = buildStageHistoryMap(input.stageHistory);
  const sourceLabels = new Map(input.sourceCatalog.map((source) => [source.key, source.label]));
  const managerNames = new Map(input.managerDirectory.map((manager) => [manager.id, manager.name]));
  const allowedCategoryIds = new Set(
    input.stageCatalog
      .filter((stage) => stage.entityType === "deal" && stage.categoryId)
      .map((stage) => normalizeCategoryId(stage.categoryId))
  );
  const reportWarnings = new Set<string>();

  if (input.conversionEvents.length === 0) {
    reportWarnings.add(EMPTY_CONVERSION_EVENTS_WARNING);
  }

  const managerFilter = new Set(input.filters?.managerIds ?? []);
  const sourceFilter = new Set(input.filters?.sourceKeys ?? []);
  const customerFilter = new Set(input.filters?.customerKeys ?? []);
  const qualityFilter = new Set(input.filters?.qualityKeys ?? []);
  const tariffFilter = new Set(input.filters?.tariffKeys ?? []);
  const dimensionsByDeal = new Map<string, DealDimension>();

  const cohortDeals = input.deals.filter((deal) => {
    if (
      allowedCategoryIds.size > 0 &&
      !allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
    ) {
      return false;
    }

    if (!isWithinRange(deal.dateCreate, fromMs, toMs)) {
      return false;
    }

    const dealDimension = resolveDealDimension(deal, managerNames, sourceLabels);
    dimensionsByDeal.set(deal.id, dealDimension);

    if (managerFilter.size > 0 && !managerFilter.has(dealDimension.managerId)) {
      return false;
    }

    if (sourceFilter.size > 0 && !sourceFilter.has(dealDimension.sourceKey)) {
      return false;
    }

    if (customerFilter.size > 0 && !customerFilter.has(dealDimension.customerKey)) {
      return false;
    }

    if (qualityFilter.size > 0 && !qualityFilter.has(deal.qualityValue ?? "")) {
      return false;
    }

    if (tariffFilter.size > 0 && !tariffFilter.has(deal.tariffValue ?? "")) {
      return false;
    }

    return true;
  });
  const cohortDealIds = new Set(cohortDeals.map((deal) => deal.id));
  const cohortDealMap = new Map(cohortDeals.map((deal) => [deal.id, deal]));
  const activitiesByDeal = groupActivitiesByDeal(input.activities, cohortDealIds);
  const activityById = new Map(input.activities.map((activity) => [activity.id, activity]));
  const callsByDeal = groupCallsByDeal({
    calls: input.calls,
    dealIds: cohortDealIds,
    activitiesById: activityById
  });
  const conversionEventsByDeal = buildConversionEventsByDeal({
    conversionEvents: input.conversionEvents,
    cohortDeals: cohortDealMap,
    stageLookup,
    stageHistoryMap,
    asOfMs: effectiveAsOfMs,
    warnings: reportWarnings
  });
  const totalsAccumulator = createAccumulator(
    input.dimension,
    "total",
    "Итого"
  );
  const accumulators = new Map<string, Accumulator>();

  for (const deal of cohortDeals) {
    const dealDimension =
      dimensionsByDeal.get(deal.id) ?? resolveDealDimension(deal, managerNames, sourceLabels);
    const dimensionKey = getDimensionKey(input.dimension, dealDimension);
    const rowAccumulator =
      accumulators.get(dimensionKey.key) ??
      createAccumulator(
        input.dimension,
        dimensionKey.key,
        dimensionKey.label,
        dealDimension
      );
    accumulators.set(dimensionKey.key, rowAccumulator);

    for (const accumulator of [rowAccumulator, totalsAccumulator]) {
      accumulator.deals.push(deal);
      accumulator.createdDeals += 1;

      if (isWonDeal(deal, wonStageIds)) {
        accumulator.wonDeals += 1;
        accumulator.salesAmount += deal.opportunity ?? 0;
        const cycleDays = calculateCycleDays(deal, reportWarnings);
        if (cycleDays !== null) {
          accumulator.cycleDays.push(cycleDays);
        }
      } else if (isLostDeal(deal, stageLookup)) {
        accumulator.lostDeals += 1;
      }
    }

    const dealActions = buildDealActionSummary({
      deal,
      activities: activitiesByDeal.get(deal.id) ?? [],
      calls: callsByDeal.get(deal.id) ?? [],
      conversionEventsCount: conversionEventsByDeal.get(deal.id) ?? 0,
      asOfMs: effectiveAsOfMs
    });

    addActions(rowAccumulator.actions, dealActions);
    addActions(totalsAccumulator.actions, dealActions);
  }

  const totalsActions: RevenueVelocityActionSummary = {
    ...totalsAccumulator.actions,
    weightedActionPoints: calculateWeightedActionPoints(
      totalsAccumulator.actions,
      actionWeights
    ),
    weightedActionPointsPerDeal: null,
    weightedActionPointsPerWin: null
  };
  totalsActions.weightedActionPointsPerDeal = safeDivide(
    totalsActions.weightedActionPoints,
    totalsAccumulator.createdDeals
  );
  totalsActions.weightedActionPointsPerWin = safeDivide(
    totalsActions.weightedActionPoints,
    totalsAccumulator.wonDeals
  );
  const teamMoneyPerWeightedActionPoint = safeDivide(
    totalsAccumulator.salesAmount,
    totalsActions.weightedActionPoints
  );
  totalsAccumulator.actions = totalsActions;

  const rows = Array.from(accumulators.values())
    .map((accumulator) =>
      finalizeRow({
        accumulator,
        weights: actionWeights,
        teamMoneyPerWeightedActionPoint,
        stageHistoryMap,
        stageLookup
      })
    )
    .sort(rowSort);
  const totals = finalizeRow({
    accumulator: totalsAccumulator,
    weights: actionWeights,
    teamMoneyPerWeightedActionPoint,
    stageHistoryMap,
    stageLookup
  });
  const warnings = Array.from(reportWarnings);

  return {
    range: input.range,
    asOf: new Date(effectiveAsOfMs).toISOString(),
    dimension: input.dimension,
    actionWeights,
    totals: {
      ...totals,
      warnings
    },
    rows,
    formulaTooltips: REVENUE_VELOCITY_FORMULA_TOOLTIPS,
    warnings
  };
}
