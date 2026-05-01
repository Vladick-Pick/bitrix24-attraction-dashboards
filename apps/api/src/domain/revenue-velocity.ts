import type {
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventSnapshot,
  DealPricingRule,
  DealSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  RevenueVelocityActionSummary,
  RevenueVelocityActionWeights,
  RevenueVelocityDimension,
  RevenueVelocityFormulaBreakdown,
  RevenueVelocityFormulaTooltip,
  RevenueVelocityMoneyPerAction,
  RevenueVelocityReportSnapshot,
  RevenueVelocityRow,
  RevenueVelocityView,
  SourceCatalogEntry,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  resolveDealEconomics,
  type DealEconomicsContext
} from "./deal-economics.js";
import {
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME,
  UNATTRIBUTED_SOURCE_KEY,
  UNATTRIBUTED_SOURCE_LABEL,
  normalizeCategoryId
} from "./report-dimensions.js";

export interface RevenueVelocityReportInput {
  range: ReportRange;
  asOf: string;
  dimension: RevenueVelocityDimension;
  view?: RevenueVelocityView;
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
  pricingRules?: DealPricingRule[];
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
const INSUFFICIENT_PIPELINE_PROBABILITY_WARNING =
  "Недостаточно данных для вероятностной оценки воронки.";
const MIN_STAGE_BENCHMARK_SAMPLE_SIZE = 2;
const DAY_MS = 86_400_000;
const ROLLING_QUARTER_DAYS = 90;
const ACTIVE_BUSINESS_STAGE_NAMES = new Set([
  "база входящая",
  "звонок-знакомство",
  "встреча-знакомство",
  "активация",
  "проблематизация",
  "демонстрация",
  "адмиссия",
  "контрактация",
  "на передаче"
]);
const TERMINAL_OR_BACKFLOW_STAGE_NAMES = new Set([
  "корзина",
  "возврат в лидген",
  "неквал",
  "проиграно",
  "отказ",
  "передано в клуб",
  "won",
  "handoff"
]);

export const REVENUE_VELOCITY_FORMULA_TOOLTIPS: RevenueVelocityFormulaTooltip[] = [
  {
    key: "realizedWonAmountInPeriod",
    label: "Факт денег периода",
    formula: "Сумма дохода Привлечения по сделкам, выигранным в периоде по истории стадий или дате закрытия",
    description:
      "Показывает фактически выигранные деньги окна наблюдения, независимо от даты создания сделки."
  },
  {
    key: "activePipelineAmount",
    label: "Активная воронка",
    formula: "Сумма дохода Привлечения активных сделок на asOf",
    description:
      "Показывает полный денежный объём активной базы, которая была создана до asOf и не была выиграна или проиграна до asOf."
  },
  {
    key: "expectedPipelineAmount",
    label: "Ожидаемые деньги воронки",
    formula: "Σ доход Привлечения × stageWinProbability по активным сделкам",
    description:
      "Ожидаемая денежная стоимость активной воронки на конец периода. Показывается только при достаточной исторической базе по стадиям."
  },
  {
    key: "expectedPipelineDelta",
    label: "Изменение ожидаемых денег",
    formula: "Ожидаемые деньги воронки сейчас - ожидаемые деньги воронки прошлого периода",
    description:
      "Показывает, стала ли активная база денежно богаче или беднее относительно прошлого периода."
  },
  {
    key: "liveRevenueVelocity",
    label: "Денежная скорость",
    formula:
      "Средний доход × активные возможности × когортная конверсия за последние 90 дней / средний цикл сделки",
    description:
      "Текущая денежная скорость активной базы. Конверсия, средний доход и цикл берутся по сделкам, созданным за последние 90 дней до asOf в том же срезе."
  },
  {
    key: "velocityDelta",
    label: "Изменение скорости",
    formula: "Денежная скорость сейчас - денежная скорость прошлого периода",
    description:
      "Показывает, ускорилась или замедлилась денежная система."
  },
  {
    key: "systemValueCreated",
    label: "Системный прирост",
    formula: "Факт денег периода + ожидаемые деньги воронки сейчас - ожидаемые деньги воронки прошлого периода",
    description:
      "Учитывает закрытые деньги и изменение ожидаемой стоимости активной воронки."
  },
  {
    key: "systemValuePerActionPoint",
    label: "₽ системного прироста / балл",
    formula: "Системный прирост / Взвешенные баллы действий периода",
    description:
      "Показывает, сколько денежного прироста системы пришлось на один балл действий.",
    emptyState: "Если действий нет, метрика не считается."
  },
  {
    key: "realizedMoneyPerActionPoint",
    label: "Реализованные ₽ / балл",
    formula: "Факт денег периода / Взвешенные баллы действий периода",
    description:
      "Оперативная метрика факта периода. Она не доказывает причинно-следственную связь действий и закрытий."
  },
  {
    key: "historicalMoneyPerActionPoint",
    label: "Исторический ₽ / балл",
    formula: "Won amount созревших сделок / Баллы действий по этим сделкам",
    description:
      "Историческая калибровка: сколько денег приносил один балл действий на закрытых сделках."
  },
  {
    key: "estimatedFutureMoneyFromPeriodActions",
    label: "Оценка будущих денег от действий",
    formula: "Взвешенные баллы действий периода × Исторический ₽ / балл",
    description:
      "Оценивает будущий денежный вклад действий периода через историческую калибровку."
  },
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
    label: "Сделки в работе",
    formula: "Возможности - Выиграно - Проиграно",
    description:
      "Сделки из когорты, которые ещё не выиграны и не проиграны. Это активная незавершённая база."
  },
  {
    key: "salesAmount",
    label: "Доход Привлечения",
    formula: "Сумма дохода Привлечения по выигранным сделкам",
    description:
      "Управленческая сумма по выигранным сделкам из выбранной когорты, рассчитанная по настройкам цен."
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
    label: "Денежная скорость",
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

function getDealActionWindowEndMs(deal: DealSnapshot, asOfMs: number) {
  const closedMs = toTimestamp(deal.dateClosed);
  return Number.isFinite(closedMs) && closedMs < asOfMs ? closedMs : asOfMs;
}

function resolveAttractionRevenueAmount(input: {
  deal: DealSnapshot;
  context: DealEconomicsContext;
  pricingRules: DealPricingRule[] | undefined;
  warnings: Set<string>;
}) {
  if (!input.pricingRules) {
    return input.deal.opportunity ?? 0;
  }

  const economics = resolveDealEconomics({
    deal: input.deal,
    context: input.context,
    pricingRules: input.pricingRules
  });

  for (const warning of economics.pricingWarnings) {
    input.warnings.add(warning);
  }

  return economics.attractionRevenueAmount ?? 0;
}

function isLifecycleTimestamp(value: string | null | undefined, deal: DealSnapshot, asOfMs: number) {
  return isWithinRange(value, Date.parse(deal.dateCreate), getDealActionWindowEndMs(deal, asOfMs));
}

function isDealActionInPeriod(
  value: string | null | undefined,
  deal: DealSnapshot,
  fromMs: number,
  toMs: number
) {
  const timestamp = toTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const startMs = Math.max(Date.parse(deal.dateCreate), fromMs);
  const endMs = Math.min(getDealActionWindowEndMs(deal, toMs), toMs);
  return timestamp >= startMs && timestamp <= endMs;
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

function createVelocityFormulaStats(): VelocityFormulaStats {
  return {
    createdDeals: 0,
    wonDeals: 0,
    wonAmount: 0,
    cycleDays: []
  };
}

function getRollingQuarterRange(toMs: number): VelocityFormulaRange {
  return {
    fromMs: toMs - ROLLING_QUARTER_DAYS * DAY_MS,
    toMs
  };
}

function isTimestampWithinRange(value: string | null | undefined, range: VelocityFormulaRange) {
  const timestamp = toTimestamp(value);
  return Number.isFinite(timestamp) && timestamp >= range.fromMs && timestamp <= range.toMs;
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

function isActiveBusinessStage(stage: {
  stageName: string;
  semanticId: string | null;
} | undefined) {
  if (!stage || stage.semanticId === "S" || stage.semanticId === "F") {
    return false;
  }

  const normalized = normalizeStageName(stage.stageName);
  return (
    ACTIVE_BUSINESS_STAGE_NAMES.has(normalized) &&
    !TERMINAL_OR_BACKFLOW_STAGE_NAMES.has(normalized)
  );
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

function resolveWonAtInRange(input: {
  deal: DealSnapshot;
  fromMs: number;
  toMs: number;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { semanticId: string | null }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  const wonTransitionMs = (input.stageHistoryMap.get(input.deal.id) ?? [])
    .map((row) => {
      const stage = input.stageLookup.get(row.stageId);
      const isWonStage =
        input.wonStageIds.has(row.stageId) || stage?.semanticId === "S";
      const transitionMs = Date.parse(row.createdTime);

      return isWonStage && Number.isFinite(transitionMs) ? transitionMs : null;
    })
    .filter((value): value is number => value !== null)
    .filter((value) => value >= input.fromMs && value <= input.toMs)
    .sort((left, right) => left - right)[0];

  if (wonTransitionMs !== undefined) {
    return wonTransitionMs;
  }

  const closedMs = Date.parse(input.deal.dateClosed ?? "");
  if (
    Number.isFinite(closedMs) &&
    closedMs >= input.fromMs &&
    closedMs <= input.toMs &&
    isWonDeal(input.deal, input.wonStageIds)
  ) {
    return closedMs;
  }

  return null;
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
      if (!isActiveBusinessStage(stage)) {
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
  view: RevenueVelocityView;
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
  const formulaStats: VelocityFormulaStats = {
    createdDeals: accumulator.createdDeals,
    wonDeals: accumulator.wonDeals,
    wonAmount: accumulator.salesAmount,
    cycleDays: accumulator.cycleDays
  };
  const revenueVelocityFormula = buildRevenueVelocityFormulaBreakdown({
    stats: formulaStats,
    opportunitiesCount: accumulator.createdDeals,
    source: "selectedCohort",
    sourceLabel: "Выбранная когорта",
    range: null
  });
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
    view: input.view,
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
    revenueVelocityFormula,
    activePipelineAmount: 0,
    expectedPipelineAmount: 0,
    previousExpectedPipelineAmount: null,
    expectedPipelineDelta: null,
    liveRevenueVelocity: null,
    previousLiveRevenueVelocity: null,
    velocityDelta: null,
    velocityDeltaPercent: null,
    averageRemainingDays: null,
    realizedWonAmountInPeriod: 0,
    wonDealsInPeriod: 0,
    lostDealsInPeriod: 0,
    systemValueCreated: null,
    actionPointsDelta: null,
    systemValuePerActionPoint: null,
    realizedMoneyPerActionPoint: null,
    historicalMoneyPerActionPoint: null,
    estimatedFutureMoneyFromPeriodActions: null,
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

function buildCreatedCohortReport(
  input: RevenueVelocityReportInput
): RevenueVelocityReportSnapshot {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const asOfMs = Date.parse(input.asOf);
  const effectiveAsOfMs = Number.isFinite(asOfMs) ? asOfMs : toMs;
  const actionWeights = input.actionWeights ?? DEFAULT_REVENUE_VELOCITY_ACTION_WEIGHTS;
  const pricingRules = input.pricingRules;
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
        accumulator.salesAmount += resolveAttractionRevenueAmount({
          deal,
          context: "finalWon",
          pricingRules,
          warnings: reportWarnings
        });
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
        view: "createdCohort",
        weights: actionWeights,
        teamMoneyPerWeightedActionPoint,
        stageHistoryMap,
        stageLookup
      })
    )
    .sort(rowSort);
  const totals = finalizeRow({
    accumulator: totalsAccumulator,
    view: "createdCohort",
    weights: actionWeights,
    teamMoneyPerWeightedActionPoint,
    stageHistoryMap,
    stageLookup
  });
  const warnings = Array.from(new Set([...reportWarnings, ...totals.warnings]));

  return {
    range: input.range,
    asOf: new Date(effectiveAsOfMs).toISOString(),
    previousAsOf: null,
    dimension: input.dimension,
    view: "createdCohort",
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

interface StageBenchmark {
  probability: number | null;
  remainingDays: number | null;
  sampleSize: number;
}

interface ActiveDealState {
  deal: DealSnapshot;
  stageId: string;
  stageName: string;
  amount: number;
  expectedAmount: number | null;
  velocityPerDay: number | null;
  remainingDays: number | null;
}

interface VelocityFormulaStats {
  createdDeals: number;
  wonDeals: number;
  wonAmount: number;
  cycleDays: number[];
}

interface VelocityFormulaRange {
  fromMs: number;
  toMs: number;
}

interface SystemAccumulator {
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
  activeDeals: number;
  wonDealsInPeriod: number;
  lostDealsInPeriod: number;
  activePipelineAmount: number;
  expectedPipelineAmount: number;
  calibratedExpectedPipelineDeals: number;
  uncalibratedExpectedPipelineDeals: number;
  previousActiveDeals: number;
  previousExpectedPipelineAmount: number;
  previousCalibratedExpectedPipelineDeals: number;
  previousUncalibratedExpectedPipelineDeals: number;
  liveRevenueVelocity: number;
  previousLiveRevenueVelocity: number;
  remainingDays: number[];
  velocityFormulaStats: VelocityFormulaStats;
  previousVelocityFormulaStats: VelocityFormulaStats;
  realizedWonAmountInPeriod: number;
  actions: RevenueVelocityActionSummary;
  previousActions: RevenueVelocityActionSummary;
  historicalWonAmount: number;
  historicalActionPoints: number;
  warnings: Set<string>;
}

function previousRangeFor(range: ReportRange) {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);
  const previousToMs = fromMs - 1;
  const previousFromMs = previousToMs - (toMs - fromMs);

  return {
    range: {
      from: new Date(previousFromMs).toISOString(),
      to: new Date(previousToMs).toISOString()
    },
    fromMs: previousFromMs,
    toMs: previousToMs
  };
}

function resolveStageIdAtAsOf(
  deal: DealSnapshot,
  asOfMs: number,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>
) {
  let stageId: string | null = null;
  for (const row of stageHistoryMap.get(deal.id) ?? []) {
    const rowMs = Date.parse(row.createdTime);
    if (!Number.isFinite(rowMs) || rowMs > asOfMs) {
      break;
    }

    stageId = row.stageId;
  }

  return stageId ?? deal.stageId;
}

function resolveStageSemanticAtAsOf(
  deal: DealSnapshot,
  stageId: string,
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>
) {
  return stageLookup.get(stageId)?.semanticId ?? (stageId === deal.stageId ? deal.stageSemanticId : null);
}

function isDealWonAtAsOf(
  deal: DealSnapshot,
  asOfMs: number,
  wonStageIds: Set<string>,
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>
) {
  const stageId = resolveStageIdAtAsOf(deal, asOfMs, stageHistoryMap);
  const semanticId = resolveStageSemanticAtAsOf(deal, stageId, stageLookup);
  const closedMs = Date.parse(deal.dateClosed ?? "");

  if (Number.isFinite(closedMs)) {
    if (closedMs > asOfMs) {
      return false;
    }

    return isWonDeal(deal, wonStageIds) || wonStageIds.has(stageId) || semanticId === "S";
  }

  return (
    wonStageIds.has(stageId) ||
    semanticId === "S"
  );
}

function isDealLostAtAsOf(
  deal: DealSnapshot,
  asOfMs: number,
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>
) {
  const stageId = resolveStageIdAtAsOf(deal, asOfMs, stageHistoryMap);
  const semanticId = resolveStageSemanticAtAsOf(deal, stageId, stageLookup);
  const closedMs = Date.parse(deal.dateClosed ?? "");

  if (Number.isFinite(closedMs)) {
    if (closedMs > asOfMs) {
      return false;
    }

    return isLostDeal(deal, stageLookup) || semanticId === "F";
  }

  return semanticId === "F";
}

function isActiveDealAtAsOf(input: {
  deal: DealSnapshot;
  asOfMs: number;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  if (Date.parse(input.deal.dateCreate) > input.asOfMs) {
    return false;
  }

  const stageId = resolveStageIdAtAsOf(
    input.deal,
    input.asOfMs,
    input.stageHistoryMap
  );
  const stage = input.stageLookup.get(stageId);

  return (
    isActiveBusinessStage(stage) &&
    !isDealWonAtAsOf(
      input.deal,
      input.asOfMs,
      input.wonStageIds,
      input.stageLookup,
      input.stageHistoryMap
    ) &&
    !isDealLostAtAsOf(
      input.deal,
      input.asOfMs,
      input.stageLookup,
      input.stageHistoryMap
    )
  );
}

function resolveTerminalStateAtOrBefore(input: {
  deal: DealSnapshot;
  asOfMs: number;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  for (const row of input.stageHistoryMap.get(input.deal.id) ?? []) {
    const rowMs = Date.parse(row.createdTime);
    if (!Number.isFinite(rowMs) || rowMs > input.asOfMs) {
      continue;
    }

    const stage = input.stageLookup.get(row.stageId);
    const isWon =
      input.wonStageIds.has(row.stageId) ||
      stage?.semanticId === "S" ||
      row.stageSemanticId === "S";
    const isLost = stage?.semanticId === "F" || row.stageSemanticId === "F";
    if (isWon || isLost) {
      return {
        closedMs: rowMs,
        isWon,
        isLost
      };
    }
  }

  const closedMs = Date.parse(input.deal.dateClosed ?? "");
  if (!Number.isFinite(closedMs) || closedMs > input.asOfMs) {
    return null;
  }

  const stageId = resolveStageIdAtAsOf(
    input.deal,
    closedMs,
    input.stageHistoryMap
  );
  const semanticId = resolveStageSemanticAtAsOf(
    input.deal,
    stageId,
    input.stageLookup
  );
  const isWon =
    isWonDeal(input.deal, input.wonStageIds) ||
    input.wonStageIds.has(stageId) ||
    semanticId === "S";
  const isLost = isLostDeal(input.deal, input.stageLookup) || semanticId === "F";

  return isWon || isLost
    ? {
        closedMs,
        isWon,
        isLost
      }
    : null;
}

function addDealToVelocityFormulaStats(input: {
  stats: VelocityFormulaStats;
  deal: DealSnapshot;
  range: VelocityFormulaRange;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  pricingRules: DealPricingRule[] | undefined;
  warnings: Set<string>;
}) {
  if (!isTimestampWithinRange(input.deal.dateCreate, input.range)) {
    return;
  }

  input.stats.createdDeals += 1;

  const terminal = resolveTerminalStateAtOrBefore({
    deal: input.deal,
    asOfMs: input.range.toMs,
    wonStageIds: input.wonStageIds,
    stageLookup: input.stageLookup,
    stageHistoryMap: input.stageHistoryMap
  });
  if (!terminal?.isWon) {
    return;
  }

  input.stats.wonDeals += 1;
  input.stats.wonAmount += resolveAttractionRevenueAmount({
    deal: input.deal,
    context: "finalWon",
    pricingRules: input.pricingRules,
    warnings: input.warnings
  });

  const createdMs = Date.parse(input.deal.dateCreate);
  const cycleMs = terminal.closedMs - createdMs;
  if (Number.isFinite(cycleMs) && cycleMs >= 0) {
    input.stats.cycleDays.push(round(cycleMs / DAY_MS));
  } else {
    input.warnings.add(
      "Часть выигранных сделок не учтена в цикле: дата закрытия раньше даты создания."
    );
  }
}

function buildRevenueVelocityFormulaBreakdown(input: {
  stats: VelocityFormulaStats;
  opportunitiesCount: number;
  source: RevenueVelocityFormulaBreakdown["source"];
  sourceLabel: string;
  range: VelocityFormulaRange | null;
}): RevenueVelocityFormulaBreakdown {
  const averageRevenueAmount = safeDivide(input.stats.wonAmount, input.stats.wonDeals);
  const conversionRate = safeDivide(input.stats.wonDeals, input.stats.createdDeals);
  const averageCycleDays = average(input.stats.cycleDays);
  let missingReason: string | null = null;
  let value: number | null = null;

  if (input.opportunitiesCount === 0) {
    value = 0;
  } else if (input.stats.createdDeals === 0) {
    missingReason = "Нет созданных сделок в бенчмарк-когорте.";
  } else if (input.stats.wonDeals === 0) {
    missingReason = "Нет выигранных сделок в бенчмарк-когорте.";
  } else if (averageRevenueAmount === null) {
    missingReason = "Не считается средний доход бенчмарк-когорты.";
  } else if (conversionRate === null) {
    missingReason = "Не считается конверсия бенчмарк-когорты.";
  } else if (averageCycleDays === null || averageCycleDays <= 0) {
    missingReason = "Не считается средний цикл бенчмарк-когорты.";
  } else {
    value = round(
      (averageRevenueAmount * input.opportunitiesCount * conversionRate) /
        averageCycleDays
    );
  }

  return {
    source: input.source,
    sourceLabel: input.sourceLabel,
    averageRevenueAmount,
    opportunitiesCount: input.opportunitiesCount,
    conversionRate,
    averageCycleDays,
    value,
    benchmarkFrom: input.range ? new Date(input.range.fromMs).toISOString() : null,
    benchmarkTo: input.range ? new Date(input.range.toMs).toISOString() : null,
    missingReason
  };
}

function buildStageBenchmarks(input: {
  deals: DealSnapshot[];
  asOfMs: number;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
}) {
  const stageStats = new Map<
    string,
    {
      reached: number;
      won: number;
      remainingDays: number[];
    }
  >();
  const wonCycles: number[] = [];

  for (const deal of input.deals) {
    const terminal = resolveTerminalStateAtOrBefore({
      deal,
      asOfMs: input.asOfMs,
      wonStageIds: input.wonStageIds,
      stageLookup: input.stageLookup,
      stageHistoryMap: input.stageHistoryMap
    });
    if (!terminal) {
      continue;
    }

    const { closedMs } = terminal;
    const won = terminal.isWon;
    const lost = terminal.isLost;
    if (!won && !lost) {
      continue;
    }

    if (won) {
      const cycleMs = closedMs - Date.parse(deal.dateCreate);
      if (Number.isFinite(cycleMs) && cycleMs >= 0) {
        wonCycles.push(cycleMs / 86_400_000);
      }
    }

    const rows = input.stageHistoryMap.get(deal.id) ?? [];
    const path = buildStagePath({
      deal,
      stageHistoryRows: rows,
      stageLookup: input.stageLookup
    });

    for (const stageId of path) {
      const stage = input.stageLookup.get(stageId);
      if (!isActiveBusinessStage(stage)) {
        continue;
      }

      const stats = stageStats.get(stageId) ?? {
        reached: 0,
        won: 0,
        remainingDays: []
      };
      stats.reached += 1;
      if (won) {
        stats.won += 1;
        const stageRow = rows.find((row) => row.stageId === stageId);
        const enteredMs = Date.parse(stageRow?.createdTime ?? deal.dateCreate);
        if (Number.isFinite(enteredMs) && closedMs >= enteredMs) {
          stats.remainingDays.push((closedMs - enteredMs) / 86_400_000);
        }
      }
      stageStats.set(stageId, stats);
    }
  }

  const globalRemainingDays = average(wonCycles) ?? 30;

  return {
    get(stageId: string): StageBenchmark {
      const stats = stageStats.get(stageId);
      if (!stats || stats.reached < MIN_STAGE_BENCHMARK_SAMPLE_SIZE) {
        return {
          probability: null,
          remainingDays: null,
          sampleSize: stats?.reached ?? 0
        };
      }

      return {
        probability: stats.won / stats.reached,
        remainingDays: average(stats.remainingDays) ?? globalRemainingDays,
        sampleSize: stats.reached
      };
    }
  };
}

function buildActiveDealState(input: {
  deal: DealSnapshot;
  asOfMs: number;
  wonStageIds: Set<string>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  benchmarks: ReturnType<typeof buildStageBenchmarks>;
  pricingRules: DealPricingRule[] | undefined;
  warnings: Set<string>;
}): ActiveDealState | null {
  if (
    !isActiveDealAtAsOf({
      deal: input.deal,
      asOfMs: input.asOfMs,
      wonStageIds: input.wonStageIds,
      stageLookup: input.stageLookup,
      stageHistoryMap: input.stageHistoryMap
    })
  ) {
    return null;
  }

  const stageId = resolveStageIdAtAsOf(input.deal, input.asOfMs, input.stageHistoryMap);
  const stage = input.stageLookup.get(stageId);
  const benchmark = input.benchmarks.get(stageId);
  const amount = resolveAttractionRevenueAmount({
    deal: input.deal,
    context: "pipelinePlan",
    pricingRules: input.pricingRules,
    warnings: input.warnings
  });
  const expectedAmount =
    benchmark.probability === null ? null : round(amount * benchmark.probability);
  const remainingDays =
    benchmark.remainingDays !== null && benchmark.remainingDays > 0
      ? benchmark.remainingDays
      : null;

  return {
    deal: input.deal,
    stageId,
    stageName: stage?.stageName ?? stageId,
    amount,
    expectedAmount,
    velocityPerDay:
      expectedAmount !== null && remainingDays !== null
        ? round(expectedAmount / remainingDays)
        : null,
    remainingDays
  };
}

function createSystemAccumulator(
  dimension: RevenueVelocityDimension,
  key: string,
  label: string,
  dealDimension?: DealDimension
): SystemAccumulator {
  const base = createAccumulator(dimension, key, label, dealDimension);

  return {
    dimension,
    key,
    label,
    managerId: base.managerId,
    managerName: base.managerName,
    sourceKey: base.sourceKey,
    sourceLabel: base.sourceLabel,
    customerKey: base.customerKey,
    customerLabel: base.customerLabel,
    deals: [],
    createdDeals: 0,
    activeDeals: 0,
    wonDealsInPeriod: 0,
    lostDealsInPeriod: 0,
    activePipelineAmount: 0,
    expectedPipelineAmount: 0,
    calibratedExpectedPipelineDeals: 0,
    uncalibratedExpectedPipelineDeals: 0,
    previousActiveDeals: 0,
    previousExpectedPipelineAmount: 0,
    previousCalibratedExpectedPipelineDeals: 0,
    previousUncalibratedExpectedPipelineDeals: 0,
    liveRevenueVelocity: 0,
    previousLiveRevenueVelocity: 0,
    remainingDays: [],
    velocityFormulaStats: createVelocityFormulaStats(),
    previousVelocityFormulaStats: createVelocityFormulaStats(),
    realizedWonAmountInPeriod: 0,
    actions: createEmptyActionSummary(),
    previousActions: createEmptyActionSummary(),
    historicalWonAmount: 0,
    historicalActionPoints: 0,
    warnings: new Set()
  };
}

function addActiveState(accumulator: SystemAccumulator, state: ActiveDealState, previous = false) {
  if (previous) {
    accumulator.previousActiveDeals += 1;
    if (state.expectedAmount === null || state.velocityPerDay === null) {
      accumulator.previousUncalibratedExpectedPipelineDeals += 1;
      return;
    }

    accumulator.previousCalibratedExpectedPipelineDeals += 1;
    accumulator.previousExpectedPipelineAmount += state.expectedAmount;
    accumulator.previousLiveRevenueVelocity += state.velocityPerDay;
    return;
  }

  accumulator.deals.push(state.deal);
  accumulator.activeDeals += 1;
  accumulator.activePipelineAmount += state.amount;
  if (state.expectedAmount === null || state.velocityPerDay === null) {
    accumulator.uncalibratedExpectedPipelineDeals += 1;
    return;
  }

  accumulator.calibratedExpectedPipelineDeals += 1;
  accumulator.expectedPipelineAmount += state.expectedAmount;
  accumulator.liveRevenueVelocity += state.velocityPerDay;
  if (state.remainingDays !== null) {
    accumulator.remainingDays.push(state.remainingDays);
  }
}

function buildPeriodActionSummary(input: {
  deal: DealSnapshot;
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  conversionEventsCount: number;
  fromMs: number;
  toMs: number;
}) {
  const actions = createEmptyActionSummary();
  const periodActivities = input.activities.filter((activity) =>
    isDealActionInPeriod(activity.createdTime, input.deal, input.fromMs, input.toMs)
  );
  const taskActivities = input.activities.filter(isTaskActivity);
  const meetingActivities = periodActivities.filter(isMeetingActivity);
  const periodCalls = input.calls.filter((call) =>
    isDealActionInPeriod(call.callStartDate, input.deal, input.fromMs, input.toMs)
  );

  actions.totalCalls = periodCalls.length;
  actions.connectedCallsOverThirtySeconds = periodCalls.filter(
    (call) => call.callDurationSeconds > 30 && isCallSuccessful(call)
  ).length;
  actions.meetingsCount = meetingActivities.length;
  actions.conversionEventsCount = input.conversionEventsCount;
  actions.createdTasks = periodActivities.filter(isTaskActivity).length;
  actions.closedTasks = taskActivities.filter((activity) => {
    if (!activity.completed) {
      return false;
    }

    return activity.completedTime
      ? isDealActionInPeriod(activity.completedTime, input.deal, input.fromMs, input.toMs)
      : false;
  }).length;

  return actions;
}

function countPeriodConversionEvents(input: {
  deal: DealSnapshot;
  conversionEvents: ConversionEventSnapshot[];
  fromMs: number;
  toMs: number;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  warnings: Set<string>;
}) {
  let count = 0;
  let unresolved = 0;

  for (const event of input.conversionEvents) {
    if (event.dealId !== input.deal.id) {
      continue;
    }

    if (!isDealActionInPeriod(event.occurredAt, input.deal, input.fromMs, input.toMs)) {
      continue;
    }

    const stageName = resolveConversionEventStage({
      event,
      stageLookup: input.stageLookup,
      stageHistoryMap: input.stageHistoryMap
    });

    if (!stageName) {
      unresolved += 1;
      continue;
    }

    if (isConversionEventStage(stageName)) {
      count += 1;
    }
  }

  if (unresolved > 0) {
    input.warnings.add(UNRESOLVED_CONVERSION_EVENT_STAGE_WARNING);
  }

  return count;
}

function finalizeSystemRow(input: {
  accumulator: SystemAccumulator;
  view: RevenueVelocityView;
  weights: RevenueVelocityActionWeights;
  teamMoneyPerWeightedActionPoint: number | null;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  stageLookup: Map<string, { stageName: string; semanticId: string | null; sortOrder: number }>;
  currentFormulaRange: VelocityFormulaRange;
  previousFormulaRange: VelocityFormulaRange;
}): RevenueVelocityRow {
  const { accumulator } = input;
  const actions: RevenueVelocityActionSummary = {
    ...accumulator.actions,
    weightedActionPoints: calculateWeightedActionPoints(
      accumulator.actions,
      input.weights
    ),
    weightedActionPointsPerDeal: safeDivide(
      calculateWeightedActionPoints(accumulator.actions, input.weights),
      accumulator.createdDeals
    ),
    weightedActionPointsPerWin: safeDivide(
      calculateWeightedActionPoints(accumulator.actions, input.weights),
      accumulator.wonDealsInPeriod
    )
  };
  const previousActionPoints = calculateWeightedActionPoints(
    accumulator.previousActions,
    input.weights
  );
  const expectedPipelineAmount =
    accumulator.activeDeals > 0 && accumulator.calibratedExpectedPipelineDeals === 0
      ? null
      : round(accumulator.expectedPipelineAmount);
  const previousExpectedPipelineAmount =
    accumulator.previousActiveDeals > 0 &&
    accumulator.previousCalibratedExpectedPipelineDeals === 0
      ? null
      : round(accumulator.previousExpectedPipelineAmount);
  const expectedPipelineDelta =
    expectedPipelineAmount !== null && previousExpectedPipelineAmount !== null
      ? round(expectedPipelineAmount - previousExpectedPipelineAmount)
      : null;
  const revenueVelocityFormula = buildRevenueVelocityFormulaBreakdown({
    stats: accumulator.velocityFormulaStats,
    opportunitiesCount: accumulator.activeDeals,
    source: "rollingQuarterCohort",
    sourceLabel: "Когорта за последние 90 дней",
    range: input.currentFormulaRange
  });
  const previousRevenueVelocityFormula = buildRevenueVelocityFormulaBreakdown({
    stats: accumulator.previousVelocityFormulaStats,
    opportunitiesCount: accumulator.previousActiveDeals,
    source: "rollingQuarterCohort",
    sourceLabel: "Когорта за последние 90 дней",
    range: input.previousFormulaRange
  });
  const liveRevenueVelocity = revenueVelocityFormula.value;
  const previousLiveRevenueVelocity = previousRevenueVelocityFormula.value;
  const velocityDelta =
    liveRevenueVelocity !== null && previousLiveRevenueVelocity !== null
      ? round(liveRevenueVelocity - previousLiveRevenueVelocity)
      : null;
  const systemValueCreated =
    expectedPipelineDelta !== null
      ? round(accumulator.realizedWonAmountInPeriod + expectedPipelineDelta)
      : null;
  const historicalMoneyPerActionPoint = safeDivide(
    accumulator.historicalWonAmount,
    accumulator.historicalActionPoints
  );
  const warnings = new Set(accumulator.warnings);
  if (
    accumulator.uncalibratedExpectedPipelineDeals > 0 ||
    accumulator.previousUncalibratedExpectedPipelineDeals > 0
  ) {
    warnings.add(INSUFFICIENT_PIPELINE_PROBABILITY_WARNING);
  }
  const bottleneck = resolveBottleneckStage({
    deals: accumulator.deals,
    stageHistoryMap: input.stageHistoryMap,
    stageLookup: input.stageLookup
  });

  return {
    dimension: accumulator.dimension,
    view: input.view,
    key: accumulator.key,
    label: accumulator.label,
    managerId: accumulator.managerId,
    managerName: accumulator.managerName,
    sourceKey: accumulator.sourceKey,
    sourceLabel: accumulator.sourceLabel,
    customerKey: accumulator.customerKey,
    customerLabel: accumulator.customerLabel,
    createdDeals: accumulator.createdDeals,
    activeDeals: accumulator.activeDeals,
    wonDeals: accumulator.wonDealsInPeriod,
    lostDeals: accumulator.lostDealsInPeriod,
    wipDeals: accumulator.activeDeals,
    salesAmount: round(accumulator.realizedWonAmountInPeriod),
    averageCheck: revenueVelocityFormula.averageRevenueAmount,
    winRate: revenueVelocityFormula.conversionRate,
    averageCycleDays: revenueVelocityFormula.averageCycleDays,
    medianCycleDays: null,
    revenueVelocityPerDay: liveRevenueVelocity,
    revenueVelocityFormula,
    activePipelineAmount: round(accumulator.activePipelineAmount),
    expectedPipelineAmount,
    previousExpectedPipelineAmount,
    expectedPipelineDelta,
    liveRevenueVelocity,
    previousLiveRevenueVelocity,
    velocityDelta,
    velocityDeltaPercent:
      velocityDelta !== null && previousLiveRevenueVelocity !== null
        ? safeDivide(velocityDelta, previousLiveRevenueVelocity)
        : null,
    averageRemainingDays: average(accumulator.remainingDays),
    realizedWonAmountInPeriod: round(accumulator.realizedWonAmountInPeriod),
    wonDealsInPeriod: accumulator.wonDealsInPeriod,
    lostDealsInPeriod: accumulator.lostDealsInPeriod,
    systemValueCreated,
    actionPointsDelta: round(actions.weightedActionPoints - previousActionPoints),
    systemValuePerActionPoint:
      systemValueCreated !== null
        ? safeDivide(systemValueCreated, actions.weightedActionPoints)
        : null,
    realizedMoneyPerActionPoint: safeDivide(
      accumulator.realizedWonAmountInPeriod,
      actions.weightedActionPoints
    ),
    historicalMoneyPerActionPoint,
    estimatedFutureMoneyFromPeriodActions:
      historicalMoneyPerActionPoint !== null
        ? round(actions.weightedActionPoints * historicalMoneyPerActionPoint)
        : null,
    actions,
    moneyPerAction: buildMoneyPerAction(
      accumulator.realizedWonAmountInPeriod,
      actions,
      input.teamMoneyPerWeightedActionPoint
    ),
    bottleneckStageId: bottleneck.bottleneckStageId,
    bottleneckStageName: bottleneck.bottleneckStageName,
    warnings: Array.from(warnings)
  };
}

function buildSystemStateReport(
  input: RevenueVelocityReportInput,
  view: RevenueVelocityView
): RevenueVelocityReportSnapshot {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const asOfMs = Number.isFinite(Date.parse(input.asOf)) ? Date.parse(input.asOf) : toMs;
  const previous = previousRangeFor(input.range);
  const currentFormulaRange = getRollingQuarterRange(asOfMs);
  const previousFormulaRange = getRollingQuarterRange(previous.toMs);
  const actionWeights = input.actionWeights ?? DEFAULT_REVENUE_VELOCITY_ACTION_WEIGHTS;
  const pricingRules = input.pricingRules;
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
  const scopedDeals = input.deals.filter((deal) => {
    if (
      allowedCategoryIds.size > 0 &&
      !allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
    ) {
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
  const scopedDealIds = new Set(scopedDeals.map((deal) => deal.id));
  const activitiesByDeal = groupActivitiesByDeal(input.activities, scopedDealIds);
  const activityById = new Map(input.activities.map((activity) => [activity.id, activity]));
  const callsByDeal = groupCallsByDeal({
    calls: input.calls,
    dealIds: scopedDealIds,
    activitiesById: activityById
  });
  const eventsByDeal = new Map<string, ConversionEventSnapshot[]>();
  for (const event of input.conversionEvents) {
    if (event.dealId && scopedDealIds.has(event.dealId)) {
      const current = eventsByDeal.get(event.dealId) ?? [];
      current.push(event);
      eventsByDeal.set(event.dealId, current);
    }
  }
  const benchmarks = buildStageBenchmarks({
    deals: scopedDeals,
    asOfMs,
    wonStageIds,
    stageLookup,
    stageHistoryMap
  });
  const accumulators = new Map<string, SystemAccumulator>();
  const totalsAccumulator = createSystemAccumulator(input.dimension, "total", "Итого");
  const ensureAccumulator = (deal: DealSnapshot) => {
    const dealDimension =
      dimensionsByDeal.get(deal.id) ?? resolveDealDimension(deal, managerNames, sourceLabels);
    const dimensionKey = getDimensionKey(input.dimension, dealDimension);
    const current =
      accumulators.get(dimensionKey.key) ??
      createSystemAccumulator(
        input.dimension,
        dimensionKey.key,
        dimensionKey.label,
        dealDimension
      );
    accumulators.set(dimensionKey.key, current);
    return current;
  };
  const addToRowAndTotals = (
    deal: DealSnapshot,
    callback: (accumulator: SystemAccumulator) => void
  ) => {
    callback(ensureAccumulator(deal));
    callback(totalsAccumulator);
  };

  for (const deal of scopedDeals) {
    if (isWithinRange(deal.dateCreate, fromMs, toMs)) {
      addToRowAndTotals(deal, (accumulator) => {
        accumulator.createdDeals += 1;
      });
    }

    if (isTimestampWithinRange(deal.dateCreate, currentFormulaRange)) {
      addToRowAndTotals(deal, (accumulator) => {
        addDealToVelocityFormulaStats({
          stats: accumulator.velocityFormulaStats,
          deal,
          range: currentFormulaRange,
          wonStageIds,
          stageLookup,
          stageHistoryMap,
          pricingRules,
          warnings: reportWarnings
        });
      });
    }

    if (isTimestampWithinRange(deal.dateCreate, previousFormulaRange)) {
      addToRowAndTotals(deal, (accumulator) => {
        addDealToVelocityFormulaStats({
          stats: accumulator.previousVelocityFormulaStats,
          deal,
          range: previousFormulaRange,
          wonStageIds,
          stageLookup,
          stageHistoryMap,
          pricingRules,
          warnings: reportWarnings
        });
      });
    }

    const currentState = buildActiveDealState({
      deal,
      asOfMs,
      wonStageIds,
      stageLookup,
      stageHistoryMap,
      benchmarks,
      pricingRules,
      warnings: reportWarnings
    });
    if (currentState) {
      addToRowAndTotals(deal, (accumulator) => addActiveState(accumulator, currentState));
    }

    const previousState = buildActiveDealState({
      deal,
      asOfMs: previous.toMs,
      wonStageIds,
      stageLookup,
      stageHistoryMap,
      benchmarks,
      pricingRules,
      warnings: reportWarnings
    });
    if (previousState) {
      addToRowAndTotals(deal, (accumulator) => addActiveState(accumulator, previousState, true));
    }

    const wonAtMs = resolveWonAtInRange({
      deal,
      fromMs,
      toMs,
      wonStageIds,
      stageLookup,
      stageHistoryMap
    });
    if (wonAtMs !== null) {
      addToRowAndTotals(deal, (accumulator) => {
        accumulator.wonDealsInPeriod += 1;
        accumulator.realizedWonAmountInPeriod += resolveAttractionRevenueAmount({
          deal,
          context: "finalWon",
          pricingRules,
          warnings: reportWarnings
        });
      });
    } else if (deal.dateClosed && isWithinRange(deal.dateClosed, fromMs, toMs)) {
      if (isLostDeal(deal, stageLookup)) {
        addToRowAndTotals(deal, (accumulator) => {
          accumulator.lostDealsInPeriod += 1;
        });
      }
    }

    const conversionEvents = eventsByDeal.get(deal.id) ?? [];
    const actions = buildPeriodActionSummary({
      deal,
      activities: activitiesByDeal.get(deal.id) ?? [],
      calls: callsByDeal.get(deal.id) ?? [],
      conversionEventsCount: countPeriodConversionEvents({
        deal,
        conversionEvents,
        fromMs,
        toMs,
        stageLookup,
        stageHistoryMap,
        warnings: reportWarnings
      }),
      fromMs,
      toMs
    });
    const previousActions = buildPeriodActionSummary({
      deal,
      activities: activitiesByDeal.get(deal.id) ?? [],
      calls: callsByDeal.get(deal.id) ?? [],
      conversionEventsCount: countPeriodConversionEvents({
        deal,
        conversionEvents,
        fromMs: previous.fromMs,
        toMs: previous.toMs,
        stageLookup,
        stageHistoryMap,
        warnings: reportWarnings
      }),
      fromMs: previous.fromMs,
      toMs: previous.toMs
    });

    if (
      actions.totalCalls > 0 ||
      actions.meetingsCount > 0 ||
      actions.createdTasks > 0 ||
      actions.closedTasks > 0 ||
      actions.conversionEventsCount > 0
    ) {
      addToRowAndTotals(deal, (accumulator) => addActions(accumulator.actions, actions));
    }
    if (
      previousActions.totalCalls > 0 ||
      previousActions.meetingsCount > 0 ||
      previousActions.createdTasks > 0 ||
      previousActions.closedTasks > 0 ||
      previousActions.conversionEventsCount > 0
    ) {
      addToRowAndTotals(deal, (accumulator) =>
        addActions(accumulator.previousActions, previousActions)
      );
    }

    const closedMs = Date.parse(deal.dateClosed ?? "");
    const benchmarkWindowStart = asOfMs - 180 * 86_400_000;
    if (
      isWonDeal(deal, wonStageIds) &&
      Number.isFinite(closedMs) &&
      closedMs <= asOfMs &&
      closedMs >= benchmarkWindowStart
    ) {
      const dealActions = buildDealActionSummary({
        deal,
        activities: activitiesByDeal.get(deal.id) ?? [],
        calls: callsByDeal.get(deal.id) ?? [],
        conversionEventsCount: countPeriodConversionEvents({
          deal,
          conversionEvents,
          fromMs: Date.parse(deal.dateCreate),
          toMs: Math.min(closedMs, asOfMs),
          stageLookup,
          stageHistoryMap,
          warnings: reportWarnings
        }),
        asOfMs
      });
      const actionPoints = calculateWeightedActionPoints(dealActions, actionWeights);
      addToRowAndTotals(deal, (accumulator) => {
        accumulator.historicalWonAmount += resolveAttractionRevenueAmount({
          deal,
          context: "finalWon",
          pricingRules,
          warnings: reportWarnings
        });
        accumulator.historicalActionPoints += actionPoints;
      });
    }
  }

  const totalsActions = {
    ...totalsAccumulator.actions,
    weightedActionPoints: calculateWeightedActionPoints(
      totalsAccumulator.actions,
      actionWeights
    ),
    weightedActionPointsPerDeal: null,
    weightedActionPointsPerWin: null
  };
  const teamMoneyPerWeightedActionPoint = safeDivide(
    totalsAccumulator.realizedWonAmountInPeriod,
    totalsActions.weightedActionPoints
  );
  const rows = Array.from(accumulators.values())
    .map((accumulator) =>
      finalizeSystemRow({
        accumulator,
        view,
        weights: actionWeights,
        teamMoneyPerWeightedActionPoint,
        stageHistoryMap,
        stageLookup,
        currentFormulaRange,
        previousFormulaRange
      })
    )
    .sort(rowSort);
  const totals = finalizeSystemRow({
    accumulator: totalsAccumulator,
    view,
    weights: actionWeights,
    teamMoneyPerWeightedActionPoint,
    stageHistoryMap,
    stageLookup,
    currentFormulaRange,
    previousFormulaRange
  });
  const warnings = Array.from(new Set([...reportWarnings, ...totals.warnings]));

  return {
    range: input.range,
    asOf: new Date(asOfMs).toISOString(),
    previousAsOf: new Date(previous.toMs).toISOString(),
    dimension: input.dimension,
    view,
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

export function buildRevenueVelocityReport(
  input: RevenueVelocityReportInput
): RevenueVelocityReportSnapshot {
  const view = input.view ?? "systemState";
  return view === "createdCohort"
    ? buildCreatedCohortReport(input)
    : buildSystemStateReport(input, view);
}
