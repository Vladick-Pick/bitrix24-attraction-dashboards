import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomeBusinessClubByManagerRow,
  ActivitiesWorkloadReport,
  ActivityBindingSnapshot,
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallsWorkloadReport,
  CallSnapshot,
  CohortRelativeBucketKey,
  CohortConversionReport,
  DealCallSummary,
  DealMeetingDateChangeSnapshot,
  DealPricingRule,
  DealMeetingEvent,
  DealMeetingSummary,
  DealSnapshot,
  DealStageTimelineEntry,
  DealTaskSummary,
  LostDealDetailRow,
  ManagerActionOutcomeDealDetail,
  ManagerActionOutcomeDealSla,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeRow,
  ManagerActionOutcomeStatusRow,
  ManagerDirectoryEntry,
  ReportRange,
  SlaMetric,
  SourceQualityConversionReport,
  StageCatalogEntry,
  StageHistorySnapshot,
  StageProgressionMetric,
  StageWorkloadMetric,
  StageCallMetric,
  TargetGroupConversionReport
} from "@bitrix24-reporting/contracts";

import {
  resolveDealEconomics,
  type DealEconomicsContext
} from "./deal-economics.js";
import {
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  resolveManagerName,
  toMonthBucket
} from "./report-dimensions.js";

interface SourceQualityConversionInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
}

interface AcquisitionOutcomesInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory?: StageHistorySnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

interface ActivitiesWorkloadInput {
  range: ReportRange;
  slaAsOf?: string;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  deadlineChanges: ActivityDeadlineChangeSnapshot[];
  meetingDateChanges?: DealMeetingDateChangeSnapshot[];
  calls?: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

interface CallsWorkloadInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  activityBindings?: ActivityBindingSnapshot[];
  calls: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

interface CohortConversionInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageHistory?: StageHistorySnapshot[];
}

interface TargetGroupConversionInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory?: StageHistorySnapshot[];
  pricingRules?: DealPricingRule[];
}

interface ManagerActionOutcomeInput {
  range: ReportRange;
  slaAsOf?: string;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
  pricingRules?: DealPricingRule[];
}

function isWithinRange(value: string | null, fromMs: number, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
}

function resolveAttractionRevenueAmount(input: {
  deal: DealSnapshot;
  pricingRules: DealPricingRule[] | undefined;
  context?: DealEconomicsContext;
  warnings?: Set<string>;
}) {
  if (!input.pricingRules) {
    return input.deal.opportunity ?? 0;
  }

  const economics = resolveDealEconomics({
    deal: input.deal,
    context: input.context ?? "finalWon",
    pricingRules: input.pricingRules
  });

  for (const warning of economics.pricingWarnings) {
    input.warnings?.add(warning);
  }

  return economics.attractionRevenueAmount ?? 0;
}

function toHours(milliseconds: number) {
  return Number((milliseconds / 3_600_000).toFixed(2));
}

function toRate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toAverage(total: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Number((total / count).toFixed(2));
}

const ACTIVITIES_REPORT_WARNINGS = [
  "Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available."
];

const SLA_LABELS = {
  sla1: "Время в работу",
  sla2: "Первый контакт",
  sla3: "Обработка лида"
} as const;

const SLA_THRESHOLDS_BUSINESS_HOURS = {
  sla1: 24,
  sla2: 24,
  sla3: 72
} as const;
const SLA_SOURCE_LABEL = "лидген ус";
const SLA_READY_QUALITY_FRAGMENT = "готов ко встрече";

const UNSPECIFIED_MEETING_TYPE = "UNSPECIFIED";
const UNSPECIFIED_MEETING_TYPE_LABEL = "Без типа встречи";
const UNSPECIFIED_BUSINESS_CLUB = "UNSPECIFIED";
const UNSPECIFIED_BUSINESS_CLUB_LABEL = "Без бизнес-клуба заказчика";
const UNSPECIFIED_TARGET_GROUP = "UNSPECIFIED";
const UNSPECIFIED_TARGET_GROUP_LABEL = "Без таргет-группы";
const TASK_ACTIVITY_PROVIDER_IDS = new Set(["CRM_TODO", "CRM_TASKS_TASK"]);
const MANAGER_ACTION_MISSING_STAGE_LABEL = "Этап недоступен";
const MANAGER_ACTION_MISSING_STAGE_WARNING =
  "Некоторые исторические этапы отсутствуют в локальном справочнике стадий.";

const COHORT_RELATIVE_BUCKETS: Array<{
  key: CohortRelativeBucketKey;
  label: string;
}> = [
  {
    key: "month_1",
    label: "В 1 месяц"
  },
  {
    key: "month_2",
    label: "Во 2 месяц"
  },
  {
    key: "month_3",
    label: "В 3 месяц"
  },
  {
    key: "month_4_plus",
    label: "В 4+ месяц"
  }
];

function getAllowedCategoryIds(stageCatalog: StageCatalogEntry[]) {
  return new Set(
    stageCatalog
      .filter((entry) => entry.entityType === "deal" && entry.categoryId)
      .map((entry) => normalizeCategoryId(entry.categoryId))
  );
}

function getStageSequence(stageCatalog: StageCatalogEntry[]) {
  return stageCatalog
    .filter((entry) => entry.entityType === "deal")
    .map((entry) => ({
      stageId: entry.statusId,
      stageName: entry.name,
      sortOrder: entry.sortOrder ?? 0
    }))
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.stageId.localeCompare(right.stageId);
    });
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

function getLatestStageHistoryTime(
  stageHistoryRows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  for (let index = stageHistoryRows.length - 1; index >= 0; index -= 1) {
    const row = stageHistoryRows[index];
    if (row && matcher(row)) {
      return row.createdTime;
    }
  }

  return null;
}

function resolveWonAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  const wonAt = getLatestStageHistoryTime(
    stageHistoryMap.get(deal.id) ?? [],
    (row) => wonStageIds.has(row.stageId) || row.stageSemanticId === "S"
  );

  return wonAt ?? deal.dateClosed ?? deal.dateModify;
}

function resolveTerminalClosedAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  if (wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S") {
    return resolveWonAt(deal, stageHistoryMap, wonStageIds);
  }

  if (deal.stageSemanticId === "F") {
    const lostAt = getLatestStageHistoryTime(
      stageHistoryMap.get(deal.id) ?? [],
      (row) => row.stageSemanticId === "F"
    );

    return lostAt ?? deal.dateClosed ?? deal.dateModify;
  }

  return null;
}

function resolveLostAt(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>
) {
  const stageHistoryRows = stageHistoryMap.get(deal.id) ?? [];
  const currentLostStageAt = getLatestStageHistoryTime(
    stageHistoryRows,
    (row) => row.stageId === deal.stageId
  );
  const terminalLostAt = getLatestStageHistoryTime(
    stageHistoryRows,
    (row) => row.stageSemanticId === "F"
  );

  return currentLostStageAt ?? terminalLostAt ?? deal.dateClosed ?? deal.dateModify;
}

function resolveStageAtTime(
  deal: DealSnapshot,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>,
  timestamp: string
) {
  const targetTime = Date.parse(timestamp);
  const rows = stageHistoryMap.get(deal.id) ?? [];
  let resolvedStageId = deal.stageId;

  for (const row of rows) {
    const rowTime = Date.parse(row.createdTime);

    if (!Number.isFinite(rowTime) || rowTime > targetTime) {
      break;
    }

    resolvedStageId = row.stageId;
  }

  return resolvedStageId;
}

function resolveQualityValue(deal: DealSnapshot) {
  return deal.qualityValue ?? "UNQUALIFIED";
}

function resolveQualityLabel(value: string) {
  return value === "UNQUALIFIED" ? "Без итогового качества" : value;
}

function resolveLossReasonValue(deal: DealSnapshot) {
  const value = deal.refusalReasonValue?.trim();
  return value && value.length > 0 ? value : "UNSPECIFIED";
}

function resolveLossReasonLabel(value: string) {
  return value === "UNSPECIFIED" ? "Причина не указана" : value;
}

function resolveBusinessClubValue(deal: DealSnapshot) {
  const value = deal.businessClubValue?.trim();
  return value && value.length > 0 ? value : UNSPECIFIED_BUSINESS_CLUB;
}

function resolveBusinessClubLabel(value: string) {
  return value === UNSPECIFIED_BUSINESS_CLUB
    ? UNSPECIFIED_BUSINESS_CLUB_LABEL
    : value;
}

function resolveMeetingTypeValue(deal: DealSnapshot) {
  const value = deal.meetingTypeValue?.trim();
  return value && value.length > 0 ? value : UNSPECIFIED_MEETING_TYPE;
}

function resolveMeetingTypeLabel(value: string) {
  return value === UNSPECIFIED_MEETING_TYPE
    ? UNSPECIFIED_MEETING_TYPE_LABEL
    : value;
}

function resolveTargetGroupValue(deal: DealSnapshot) {
  const value = deal.targetGroupValue?.trim();
  if (!value || value.length === 0) {
    return UNSPECIFIED_TARGET_GROUP;
  }

  return /^\d+$/.test(value) || value === "Неизвестная таргет-группа"
    ? UNSPECIFIED_TARGET_GROUP
    : value;
}

function resolveTargetGroupLabel(value: string) {
  return value === UNSPECIFIED_TARGET_GROUP
    ? UNSPECIFIED_TARGET_GROUP_LABEL
    : value;
}

function isMeetingActivity(activity: ActivitySnapshot) {
  return activity.typeId === "1" || activity.providerId === "CRM_MEETING";
}

function isTaskActivity(activity: ActivitySnapshot) {
  return activity.providerId
    ? TASK_ACTIVITY_PROVIDER_IDS.has(activity.providerId)
    : false;
}

function isCompletedMeetingActivity(activity: ActivitySnapshot) {
  return isMeetingActivity(activity) && activity.completed;
}

function getMeetingCommunicationTime(activity: ActivitySnapshot) {
  return activity.completedTime ?? activity.lastUpdated ?? activity.createdTime;
}

function buildDealMeetingDateWorkloadEvents(input: {
  deals: DealSnapshot[];
  meetingDateChanges?: DealMeetingDateChangeSnapshot[] | undefined;
  fromMs: number;
  toMs: number;
}) {
  const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const eventsByDealId = new Map<
    string,
    {
      deal: DealSnapshot;
      managerId: string;
      meetingAt: string;
    }
  >();

  const addCandidate = (
    deal: DealSnapshot | undefined,
    meetingAt: string | null | undefined,
    managerId: string | null | undefined
  ) => {
    if (!deal || !isWithinRange(meetingAt ?? null, input.fromMs, input.toMs)) {
      return;
    }

    const current = eventsByDealId.get(deal.id);
    if (current && Date.parse(current.meetingAt) >= Date.parse(meetingAt as string)) {
      return;
    }

    eventsByDealId.set(deal.id, {
      deal,
      managerId: managerId ?? deal.assignedById ?? "UNASSIGNED",
      meetingAt: meetingAt as string
    });
  };

  for (const deal of input.deals) {
    addCandidate(deal, deal.meetingDateValue, deal.assignedById);
  }

  for (const change of input.meetingDateChanges ?? []) {
    const deal = dealById.get(change.dealId);
    addCandidate(deal, change.previousMeetingDate, change.assignedById);
    addCandidate(deal, change.nextMeetingDate, change.assignedById);
  }

  return Array.from(eventsByDealId.values());
}

function toRoundedNumber(value: number) {
  return Number(value.toFixed(2));
}

function toMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  const middle = sorted[middleIndex];

  if (middle === undefined) {
    return 0;
  }

  if (sorted.length % 2 === 1) {
    return toRoundedNumber(middle);
  }

  const previous = sorted[middleIndex - 1];
  if (previous === undefined) {
    return toRoundedNumber(middle);
  }

  return toRoundedNumber((previous + middle) / 2);
}

function toDurationHours(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }

  const durationMs = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return null;
  }

  return toRoundedNumber(durationMs / 3_600_000);
}

function isBusinessDayUtc(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function toBusinessDurationHours(start: string | null, end: string | null) {
  if (!start || !end) {
    return null;
  }

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return null;
  }

  let cursorMs = startMs;
  let businessMs = 0;

  while (cursorMs < endMs) {
    const cursor = new Date(cursorMs);
    const nextDayMs = Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth(),
      cursor.getUTCDate() + 1
    );
    const segmentEndMs = Math.min(endMs, nextDayMs);

    if (isBusinessDayUtc(cursor)) {
      businessMs += segmentEndMs - cursorMs;
    }

    cursorMs = segmentEndMs;
  }

  return toRoundedNumber(businessMs / 3_600_000);
}

function buildCallsByDeal(
  calls: CallSnapshot[],
  activities: ActivitySnapshot[],
  dealMap: Map<string, DealSnapshot>
) {
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const rows = new Map<string, CallSnapshot[]>();

  for (const call of calls) {
    const activity = call.crmActivityId ? activityById.get(call.crmActivityId) : null;
    const dealId =
      activity?.ownerId ??
      (call.crmEntityType === "DEAL" ? call.crmEntityId ?? null : null);

    if (!dealId || !dealMap.has(dealId)) {
      continue;
    }

    const current = rows.get(dealId) ?? [];
    current.push(call);
    rows.set(dealId, current);
  }

  for (const value of rows.values()) {
    value.sort((left, right) => {
      const byStart = Date.parse(left.callStartDate) - Date.parse(right.callStartDate);
      if (byStart !== 0) {
        return byStart;
      }

      return left.id.localeCompare(right.id);
    });
  }

  return rows;
}

function buildCompletedMeetingsByDeal(
  activities: ActivitySnapshot[],
  dealMap: Map<string, DealSnapshot>
) {
  const rows = new Map<string, ActivitySnapshot[]>();

  for (const activity of activities) {
    if (
      activity.ownerTypeId !== "2" ||
      !dealMap.has(activity.ownerId) ||
      !isCompletedMeetingActivity(activity)
    ) {
      continue;
    }

    const current = rows.get(activity.ownerId) ?? [];
    current.push(activity);
    rows.set(activity.ownerId, current);
  }

  for (const value of rows.values()) {
    value.sort((left, right) => {
      const byTime =
        Date.parse(getMeetingCommunicationTime(left)) -
        Date.parse(getMeetingCommunicationTime(right));
      if (byTime !== 0) {
        return byTime;
      }

      return left.id.localeCompare(right.id);
    });
  }

  return rows;
}

function findFirstMatchingStageEntry(
  rows: StageHistorySnapshot[],
  matcher: (row: StageHistorySnapshot) => boolean
) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row && matcher(row)) {
      return {
        row,
        index
      };
    }
  }

  return null;
}

function normalizeRuText(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru");
}

function normalizeStageName(name: string | undefined) {
  return normalizeRuText(name);
}

function isInboundBaseStage(stageId: string, stageName: string | undefined) {
  const normalizedStageId = stageId.toUpperCase();
  const normalizedStageName = normalizeStageName(stageName);

  return (
    normalizedStageId.endsWith(":NEW") ||
    (normalizedStageName.includes("база") &&
      normalizedStageName.includes("вход"))
  );
}

function isIntroCallStage(stageId: string, stageName: string | undefined) {
  const normalizedStageId = stageId.toUpperCase();
  const normalizedStageName = normalizeStageName(stageName);

  return (
    normalizedStageId.includes("PREPARATION") ||
    (normalizedStageName.includes("звонок") &&
      normalizedStageName.includes("знаком"))
  );
}

type SlaOutcome = "onTime" | "late" | "noTouch";

type SlaAccumulator = {
  onTimeCount: number;
  lateCount: number;
  noTouchCount: number;
  durations: number[];
};

type SlaAccumulatorSet = Record<keyof typeof SLA_LABELS, SlaAccumulator>;

function createSlaAccumulator(): SlaAccumulator {
  return {
    onTimeCount: 0,
    lateCount: 0,
    noTouchCount: 0,
    durations: []
  };
}

function createSlaAccumulatorSet(): SlaAccumulatorSet {
  return {
    sla1: createSlaAccumulator(),
    sla2: createSlaAccumulator(),
    sla3: createSlaAccumulator()
  };
}

function recordSlaOutcome(
  accumulator: SlaAccumulator,
  outcome: SlaOutcome,
  durationHours: number | null
) {
  if (outcome === "onTime") {
    accumulator.onTimeCount += 1;
  } else if (outcome === "late") {
    accumulator.lateCount += 1;
  } else {
    accumulator.noTouchCount += 1;
  }

  if (typeof durationHours === "number" && Number.isFinite(durationHours)) {
    accumulator.durations.push(durationHours);
  }
}

function recordCompletedBusinessSlaOutcome(input: {
  accumulator: SlaAccumulator;
  start: string | null;
  end: string;
  maxBusinessHours: number;
}) {
  const businessDurationHours = toBusinessDurationHours(input.start, input.end);
  const outcome =
    businessDurationHours !== null &&
    businessDurationHours <= input.maxBusinessHours
      ? "onTime"
      : "late";

  recordSlaOutcome(input.accumulator, outcome, businessDurationHours);
}

function recordPendingBusinessSlaOutcome(input: {
  accumulator: SlaAccumulator;
  start: string | null;
  maxBusinessHours: number;
  asOfMs: number;
}) {
  const asOf =
    Number.isFinite(input.asOfMs) && input.asOfMs >= 0
      ? new Date(input.asOfMs).toISOString()
      : null;
  const pendingBusinessHours = toBusinessDurationHours(input.start, asOf);
  const outcome =
    pendingBusinessHours !== null &&
    pendingBusinessHours > input.maxBusinessHours
      ? "late"
      : "noTouch";

  recordSlaOutcome(input.accumulator, outcome, null);
}

function toSlaMetrics(accumulatorSet: SlaAccumulatorSet): SlaMetric[] {
  const metrics = Object.keys(SLA_LABELS).map((key) => {
    const slaKey = key as keyof typeof SLA_LABELS;
    const accumulator = accumulatorSet[slaKey];

    return {
      slaKey,
      label: SLA_LABELS[slaKey],
      onTimeCount: accumulator.onTimeCount,
      lateCount: accumulator.lateCount,
      noTouchCount: accumulator.noTouchCount,
      medianHours: toMedian(accumulator.durations)
    };
  });

  return metrics.filter(
    (metric) =>
      metric.onTimeCount > 0 || metric.lateCount > 0 || metric.noTouchCount > 0
  );
}

function recordDealSlaOutcomes(input: {
  deal: DealSnapshot;
  accumulatorSet: SlaAccumulatorSet;
  stageLookup: Map<string, { stageName: string; sortOrder: number }>;
  stageHistoryMap: Map<string, StageHistorySnapshot[]>;
  callsByDeal: Map<string, CallSnapshot[]>;
  evaluationToMs: number;
}) {
  const historyRows = input.stageHistoryMap.get(input.deal.id) ?? [];
  const introEntry = findFirstMatchingStageEntry(historyRows, (row) =>
    isIntroCallStage(row.stageId, input.stageLookup.get(row.stageId)?.stageName)
  );
  const firstNonBaseStageEntry = findFirstMatchingStageEntry(
    historyRows,
    (row) =>
      !isInboundBaseStage(
        row.stageId,
        input.stageLookup.get(row.stageId)?.stageName
      )
  );
  const firstRelevantStageEntry = introEntry ?? firstNonBaseStageEntry;

  const baseEnteredAt =
    historyRows
      .slice(0, firstRelevantStageEntry?.index ?? 0)
      .find((row) =>
        isInboundBaseStage(row.stageId, input.stageLookup.get(row.stageId)?.stageName)
      )?.createdTime ?? input.deal.dateCreate;

  if (introEntry) {
    recordCompletedBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla1,
      start: baseEnteredAt,
      end: introEntry.row.createdTime,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla1
    });
  } else if (firstNonBaseStageEntry) {
    recordSlaOutcome(
      input.accumulatorSet.sla1,
      "late",
      toBusinessDurationHours(baseEnteredAt, firstNonBaseStageEntry.row.createdTime)
    );
  } else {
    recordPendingBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla1,
      start: baseEnteredAt,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla1,
      asOfMs: input.evaluationToMs
    });
  }

  const firstCallAt =
    (input.callsByDeal.get(input.deal.id) ?? [])
      .map((call) => call.callStartDate)
      .filter((value) => {
        const timestamp = Date.parse(value);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= Date.parse(input.deal.dateCreate) &&
          timestamp <= input.evaluationToMs
        );
      })
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;

  if (firstCallAt) {
    recordCompletedBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla2,
      start: input.deal.dateCreate,
      end: firstCallAt,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla2
    });
  } else {
    recordPendingBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla2,
      start: input.deal.dateCreate,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla2,
      asOfMs: input.evaluationToMs
    });
  }

  if (!introEntry) {
    const missingIntroFailureAt = firstNonBaseStageEntry?.row.createdTime ?? null;
    if (missingIntroFailureAt) {
      recordSlaOutcome(
        input.accumulatorSet.sla3,
        "late",
        toBusinessDurationHours(baseEnteredAt, missingIntroFailureAt)
      );
    } else {
      recordPendingBusinessSlaOutcome({
        accumulator: input.accumulatorSet.sla3,
        start: baseEnteredAt,
        maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla3,
        asOfMs: input.evaluationToMs
      });
    }

    return;
  }

  const nextStageEntry = historyRows
    .slice(introEntry.index + 1)
    .find(
      (row) =>
        !isIntroCallStage(
          row.stageId,
          input.stageLookup.get(row.stageId)?.stageName
        )
    );
  const introExitedAt =
    nextStageEntry?.createdTime ??
    (input.deal.stageId === introEntry.row.stageId
      ? null
      : input.deal.dateClosed ?? input.deal.dateModify);
  const introCalls = (input.callsByDeal.get(input.deal.id) ?? []).filter((call) => {
    const callTime = Date.parse(call.callStartDate);
    const enteredTime = Date.parse(introEntry.row.createdTime);
    const exitedTime = introExitedAt
      ? Date.parse(introExitedAt)
      : input.evaluationToMs;

    return (
      Number.isFinite(callTime) &&
      Number.isFinite(enteredTime) &&
      Number.isFinite(exitedTime) &&
      callTime >= enteredTime &&
      callTime < exitedTime &&
      callTime <= input.evaluationToMs
    );
  });
  const secondCallAt = introCalls[1]?.callStartDate ?? null;
  const completionAt =
    secondCallAt && introExitedAt
      ? [secondCallAt, introExitedAt].sort(
          (left, right) => Date.parse(right) - Date.parse(left)
        )[0] ?? null
      : null;

  if (completionAt) {
    recordCompletedBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla3,
      start: introEntry.row.createdTime,
      end: completionAt,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla3
    });
  } else {
    recordPendingBusinessSlaOutcome({
      accumulator: input.accumulatorSet.sla3,
      start: introEntry.row.createdTime,
      maxBusinessHours: SLA_THRESHOLDS_BUSINESS_HOURS.sla3,
      asOfMs: input.evaluationToMs
    });
  }
}

function isDealInSlaScope(
  deal: DealSnapshot,
  sourceLabels: Map<string, string>
) {
  const source = resolveDealSource(deal, sourceLabels);

  return (
    normalizeRuText(source.label) === SLA_SOURCE_LABEL &&
    normalizeRuText(deal.qualityValue).includes(SLA_READY_QUALITY_FRAGMENT)
  );
}

function buildSlaMetricsByManager(input: {
  range: ReportRange;
  slaAsOf?: string;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
}) {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const rawEvaluationToMs = Date.parse(input.slaAsOf ?? input.range.to);
  const evaluationToMs = Number.isFinite(rawEvaluationToMs)
    ? rawEvaluationToMs
    : toMs;
  const stageLookup = buildStageLookup(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const dealMap = new Map(input.deals.map((deal) => [deal.id, deal]));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const callsByDeal = buildCallsByDeal(input.calls, input.activities, dealMap);
  const rows = new Map<string, SlaAccumulatorSet>();

  for (const deal of input.deals) {
    if (!isWithinRange(deal.dateCreate, fromMs, toMs)) {
      continue;
    }
    if (!isDealInSlaScope(deal, sourceLabels)) {
      continue;
    }

    const managerId = deal.assignedById ?? "UNASSIGNED";
    const accumulatorSet = rows.get(managerId) ?? createSlaAccumulatorSet();
    recordDealSlaOutcomes({
      deal,
      accumulatorSet,
      stageLookup,
      stageHistoryMap,
      callsByDeal,
      evaluationToMs
    });

    rows.set(managerId, accumulatorSet);
  }

  return new Map(
    Array.from(rows.entries()).map(([managerId, accumulatorSet]) => [
      managerId,
      toSlaMetrics(accumulatorSet)
    ])
  );
}
function resolveDurationMetrics(
  dealId: string,
  stageId: string,
  stageHistoryMap: Map<string, StageHistorySnapshot[]>
) {
  const rows = stageHistoryMap.get(dealId) ?? [];
  const durations: number[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }

    if (row.stageId !== stageId) {
      continue;
    }

    const next = rows[index + 1];
    if (!next) {
      continue;
    }

    const durationMs = Date.parse(next.createdTime) - Date.parse(row.createdTime);
    if (Number.isFinite(durationMs) && durationMs >= 0) {
      durations.push(durationMs);
    }
  }

  return durations;
}

export function buildSourceQualityConversionReport(
  input: SourceQualityConversionInput
): SourceQualityConversionReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageSequence = getStageSequence(input.stageCatalog);
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => {
      const deal = input.deals.find((item) => item.id === row.ownerId);
      return Boolean(
        deal && allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
      );
    })
  );
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const deals = input.deals.filter(
    (deal) =>
      allowedCategoryIds.has(normalizeCategoryId(deal.categoryId)) &&
      isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const rows = new Map<
    string,
    {
      sourceKey: string;
      sourceLabel: string;
      qualityKey: string;
      qualityLabel: string;
      deals: DealSnapshot[];
    }
  >();

  for (const deal of deals) {
    const source = resolveDealSource(deal, sourceLabels);
    const quality = resolveQualityValue(deal);
    const key = `${source.key}::${quality}`;
    const current = rows.get(key) ?? {
      sourceKey: source.key,
      sourceLabel: source.label,
      qualityKey: quality,
      qualityLabel: quality,
      deals: []
    };

    current.deals.push(deal);
    rows.set(key, current);
  }

  const resultRows = Array.from(rows.values())
    .map((row) => {
      const stageMetrics = stageSequence.map<StageProgressionMetric>((stage) => {
        const reachedDeals = row.deals.filter((deal) => {
          const historyAsOf = (stageHistoryMap.get(deal.id) ?? []).filter((entry) => {
            const entryTime = Date.parse(entry.createdTime);
            return Number.isFinite(entryTime) && entryTime <= toMs;
          });
          const stages = new Set(
            historyAsOf.map((entry) => entry.stageId)
          );
          if (historyAsOf.length === 0) {
            stages.add(deal.stageId);
          }
          return stages.has(stage.stageId);
        });
        const durationHistoryMap = new Map(
          reachedDeals.map((deal) => [
            deal.id,
            (stageHistoryMap.get(deal.id) ?? []).filter((entry) => {
              const entryTime = Date.parse(entry.createdTime);
              return Number.isFinite(entryTime) && entryTime <= toMs;
            })
          ])
        );
        const durations = reachedDeals.flatMap((deal) =>
          resolveDurationMetrics(deal.id, stage.stageId, durationHistoryMap)
        );

        return {
          stageId: stage.stageId,
          stageName: stage.stageName,
          reachedDeals: reachedDeals.length,
          conversionRate: toRate(reachedDeals.length, row.deals.length),
          averageStageDurationHours:
            durations.length === 0
              ? 0
              : toHours(
                  durations.reduce((total, duration) => total + duration, 0) /
                    durations.length
                )
        };
      });

      return {
        sourceKey: row.sourceKey,
        sourceLabel: row.sourceLabel,
        qualityKey: row.qualityKey,
        qualityLabel: row.qualityLabel,
        createdDeals: row.deals.length,
        wonDeals: row.deals.filter(
          (deal) =>
            wonStageIds.has(deal.stageId) &&
            isWithinRange(resolveWonAt(deal, stageHistoryMap, wonStageIds), fromMs, toMs)
        ).length,
        stageMetrics
      };
    })
    .sort((left, right) => {
      if (right.createdDeals !== left.createdDeals) {
        return right.createdDeals - left.createdDeals;
      }

      return left.sourceLabel.localeCompare(right.sourceLabel);
    });

  return {
    range: input.range,
    totalCreatedDeals: deals.length,
    totalWonDeals: deals.filter(
      (deal) =>
        wonStageIds.has(deal.stageId) &&
        isWithinRange(resolveWonAt(deal, stageHistoryMap, wonStageIds), fromMs, toMs)
    ).length,
    rows: resultRows,
    stageSequence
  };
}

function sortCountRows<T extends { count: number }>(
  rows: T[],
  getLabel: (row: T) => string
) {
  return rows.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return getLabel(left).localeCompare(getLabel(right), "ru");
  });
}

export function buildAcquisitionOutcomesReport(
  input: AcquisitionOutcomesInput
): AcquisitionOutcomesReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const stageHistoryMap = buildStageHistoryMap(input.stageHistory ?? []);
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const scopedDeals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const newDeals = scopedDeals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const lostDeals = scopedDeals.filter(
    (deal) =>
      deal.stageSemanticId === "F" &&
      isWithinRange(resolveLostAt(deal, stageHistoryMap), fromMs, toMs)
  );
  const activeDeals = scopedDeals.filter((deal) => deal.stageSemanticId === "P");

  const newDealRows = new Map<
    string,
    {
      managerId: string;
      managerName: string;
      deals: DealSnapshot[];
    }
  >();
  for (const deal of newDeals) {
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const current = newDealRows.get(managerId) ?? {
      managerId,
      managerName: resolveManagerName(managerId, managerDirectory),
      deals: []
    };
    current.deals.push(deal);
    newDealRows.set(managerId, current);
  }

  const newDealsByManager = Array.from(newDealRows.values())
    .map((row) => {
      const sourceRows = new Map<
        string,
        {
          sourceKey: string;
          sourceLabel: string;
          deals: DealSnapshot[];
        }
      >();

      for (const deal of row.deals) {
        const source = resolveDealSource(deal, sourceLabels);
        const current = sourceRows.get(source.key) ?? {
          sourceKey: source.key,
          sourceLabel: source.label,
          deals: []
        };
        current.deals.push(deal);
        sourceRows.set(source.key, current);
      }

      return {
        managerId: row.managerId,
        managerName: row.managerName,
        totalNewDeals: row.deals.length,
        sources: Array.from(sourceRows.values())
          .map((sourceRow) => {
            const qualityRows = new Map<string, number>();
            for (const deal of sourceRow.deals) {
              const quality = resolveQualityValue(deal);
              qualityRows.set(quality, (qualityRows.get(quality) ?? 0) + 1);
            }

            return {
              sourceKey: sourceRow.sourceKey,
              sourceLabel: sourceRow.sourceLabel,
              totalNewDeals: sourceRow.deals.length,
              qualities: sortCountRows(
                Array.from(qualityRows.entries()).map(([quality, count]) => ({
                  qualityKey: quality,
                  qualityLabel: resolveQualityLabel(quality),
                  count
                })),
                (quality) => quality.qualityLabel
              )
            };
          })
          .sort((left, right) => left.sourceLabel.localeCompare(right.sourceLabel, "ru"))
      };
    })
    .sort((left, right) => {
      if (right.totalNewDeals !== left.totalNewDeals) {
        return right.totalNewDeals - left.totalNewDeals;
      }

      return left.managerName.localeCompare(right.managerName, "ru");
    });

  const businessClubRows = new Map<
    string,
    {
      managerId: string;
      managerName: string;
      dealIds: Set<string>;
      businessClubs: Map<string, number>;
      targetGroups: Map<string, number>;
    }
  >();
  for (const deal of activeDeals) {
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const businessClubKey = resolveBusinessClubValue(deal);
    const targetGroupKey = resolveTargetGroupValue(deal);
    const current = businessClubRows.get(managerId) ?? {
      managerId,
      managerName: resolveManagerName(managerId, managerDirectory),
      dealIds: new Set<string>(),
      businessClubs: new Map<string, number>(),
      targetGroups: new Map<string, number>()
    };

    current.dealIds.add(deal.id);
    current.businessClubs.set(
      businessClubKey,
      (current.businessClubs.get(businessClubKey) ?? 0) + 1
    );
    current.targetGroups.set(
      targetGroupKey,
      (current.targetGroups.get(targetGroupKey) ?? 0) + 1
    );
    businessClubRows.set(managerId, current);
  }

  const lostStageCounts = new Map<string, number>();
  const lostManagerRows = new Map<
    string,
    {
      managerId: string;
      managerName: string;
      stageCounts: Map<string, number>;
      totalLostDeals: number;
    }
  >();
  const reasonRows = new Map<
    string,
    {
      stageId: string;
      stageName: string;
      managerId: string;
      managerName: string;
      reasonKey: string;
      reasonLabel: string;
      count: number;
    }
  >();
  const lostDealDetails: LostDealDetailRow[] = [];

  for (const deal of lostDeals) {
    const stageId = deal.stageId;
    const stageName = stageLookup.get(stageId)?.stageName ?? stageId;
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const managerName = resolveManagerName(managerId, managerDirectory);
    const reasonKey = resolveLossReasonValue(deal);
    const reasonLabel = resolveLossReasonLabel(reasonKey);

    lostStageCounts.set(stageId, (lostStageCounts.get(stageId) ?? 0) + 1);

    const managerRow = lostManagerRows.get(managerId) ?? {
      managerId,
      managerName,
      stageCounts: new Map<string, number>(),
      totalLostDeals: 0
    };
    managerRow.totalLostDeals += 1;
    managerRow.stageCounts.set(stageId, (managerRow.stageCounts.get(stageId) ?? 0) + 1);
    lostManagerRows.set(managerId, managerRow);

    const reasonRowKey = `${stageId}::${managerId}::${reasonKey}`;
    const reasonRow = reasonRows.get(reasonRowKey) ?? {
      stageId,
      stageName,
      managerId,
      managerName,
      reasonKey,
      reasonLabel,
      count: 0
    };
    reasonRow.count += 1;
    reasonRows.set(reasonRowKey, reasonRow);

    const source = resolveDealSource(deal, sourceLabels);
    lostDealDetails.push({
      dealId: deal.id,
      managerId,
      managerName,
      sourceKey: source.key,
      sourceLabel: source.label,
      businessClubValue: deal.businessClubValue ?? null,
      stageId,
      stageName,
      reasonKey,
      reasonLabel,
      reasonDetail: deal.refusalReasonDetail ?? null
    });
  }

  const lostStages = sortStageMetrics(
    Array.from(lostStageCounts.entries()).map(([stageId, count]) => ({
      stageId,
      stageName: stageLookup.get(stageId)?.stageName ?? stageId,
      count
    })),
    stageLookup
  );

  return {
    range: input.range,
    totalNewDeals: newDeals.length,
    totalLostDeals: lostDeals.length,
    newDealsByManager,
    lostDealsByManager: Array.from(lostManagerRows.values())
      .map((row) => ({
        managerId: row.managerId,
        managerName: row.managerName,
        totalLostDeals: row.totalLostDeals,
        stages: sortStageMetrics(
          Array.from(row.stageCounts.entries()).map(([stageId, count]) => ({
            stageId,
            stageName: stageLookup.get(stageId)?.stageName ?? stageId,
            count
          })),
          stageLookup
        )
      }))
      .sort((left, right) => {
        if (right.totalLostDeals !== left.totalLostDeals) {
          return right.totalLostDeals - left.totalLostDeals;
        }

        return left.managerName.localeCompare(right.managerName, "ru");
      }),
    lostStages,
    businessClubByManager: Array.from(businessClubRows.values())
      .map<AcquisitionOutcomeBusinessClubByManagerRow>((row) => ({
        managerId: row.managerId,
        managerName: row.managerName,
        totalDeals: row.dealIds.size,
        businessClubs: sortCountRows(
          Array.from(row.businessClubs.entries()).map(([businessClubKey, count]) => ({
            businessClubKey,
            businessClubLabel: resolveBusinessClubLabel(businessClubKey),
            count
          })),
          (businessClub) => businessClub.businessClubLabel
        ),
        targetGroups: sortCountRows(
          Array.from(row.targetGroups.entries()).map(([targetGroupKey, count]) => ({
            targetGroupKey,
            targetGroupLabel: resolveTargetGroupLabel(targetGroupKey),
            count
          })),
          (targetGroup) => targetGroup.targetGroupLabel
        )
      }))
      .sort((left, right) => {
        if (right.totalDeals !== left.totalDeals) {
          return right.totalDeals - left.totalDeals;
        }

        return left.managerName.localeCompare(right.managerName, "ru");
      }),
    topLossReasons: Array.from(reasonRows.values()).sort((left, right) => {
      const stageSort =
        (stageLookup.get(left.stageId)?.sortOrder ?? 0) -
        (stageLookup.get(right.stageId)?.sortOrder ?? 0);
      if (stageSort !== 0) {
        return stageSort;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      const byManager = left.managerName.localeCompare(right.managerName, "ru");
      return byManager !== 0
        ? byManager
        : left.reasonLabel.localeCompare(right.reasonLabel, "ru");
    }),
    lostDealDetails: lostDealDetails.sort((left, right) => {
      const stageSort =
        (stageLookup.get(left.stageId)?.sortOrder ?? 0) -
        (stageLookup.get(right.stageId)?.sortOrder ?? 0);
      if (stageSort !== 0) {
        return stageSort;
      }

      const byManager = left.managerName.localeCompare(right.managerName, "ru");
      if (byManager !== 0) {
        return byManager;
      }

      const byReason = left.reasonLabel.localeCompare(right.reasonLabel, "ru");
      return byReason !== 0
        ? byReason
        : left.dealId.localeCompare(right.dealId);
    })
  };
}

function toCategoryDealStageId(categoryId: string | null, statusId: string) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedStatusId = statusId.trim();

  if (normalizedCategoryId === "0" || /^C\d+:/i.test(normalizedStatusId)) {
    return normalizedStatusId;
  }

  return `C${normalizedCategoryId}:${normalizedStatusId}`;
}

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  const lookup = new Map<string, { stageName: string; sortOrder: number }>();

  for (const entry of stageCatalog) {
    if (entry.entityType !== "deal") {
      continue;
    }

    const stage = {
      stageName: entry.name,
      sortOrder: entry.sortOrder ?? 0
    };
    lookup.set(entry.statusId, stage);
    lookup.set(toCategoryDealStageId(entry.categoryId, entry.statusId), stage);
  }

  return lookup;
}

function resolveManagerActionStageName(
  stageId: string,
  stageLookup: Map<string, { stageName: string; sortOrder: number }>,
  warnings: Set<string>
) {
  const stageName = stageLookup.get(stageId)?.stageName;
  if (stageName) {
    return stageName;
  }

  warnings.add(MANAGER_ACTION_MISSING_STAGE_WARNING);
  return MANAGER_ACTION_MISSING_STAGE_LABEL;
}

function sortStageMetrics<T extends { stageId: string }>(
  rows: T[],
  stageLookup: Map<string, { stageName: string; sortOrder: number }>
) {
  return rows.sort((left, right) => {
    const leftSort = stageLookup.get(left.stageId)?.sortOrder ?? 0;
    const rightSort = stageLookup.get(right.stageId)?.sortOrder ?? 0;

    if (leftSort !== rightSort) {
      return leftSort - rightSort;
    }

    return left.stageId.localeCompare(right.stageId);
  });
}

function buildActivitiesStageBreakdown(
  items: Array<{ dealId: string; stageId: string; metric: "created" | "rescheduled" | "closed" }>,
  stageLookup: Map<string, { stageName: string; sortOrder: number }>
) {
  const rows = new Map<
    string,
    {
      stageId: string;
      stageName: string;
      dealIds: Set<string>;
      createdCount: number;
      rescheduledCount: number;
      closedCount: number;
    }
  >();

  for (const item of items) {
    const stage = stageLookup.get(item.stageId);
    const current = rows.get(item.stageId) ?? {
      stageId: item.stageId,
      stageName: stage?.stageName ?? item.stageId,
      dealIds: new Set<string>(),
      createdCount: 0,
      rescheduledCount: 0,
      closedCount: 0
    };

    current.dealIds.add(item.dealId);
    if (item.metric === "created") {
      current.createdCount += 1;
    } else if (item.metric === "rescheduled") {
      current.rescheduledCount += 1;
    } else {
      current.closedCount += 1;
    }

    rows.set(item.stageId, current);
  }

  return sortStageMetrics(
    Array.from(rows.values())
      .map<StageWorkloadMetric>((row) => ({
        stageId: row.stageId,
        stageName: row.stageName,
        dealCount: row.dealIds.size,
        createdCount: row.createdCount,
        rescheduledCount: row.rescheduledCount,
        closedCount: row.closedCount,
        averageCreatedPerDeal: toAverage(row.createdCount, row.dealIds.size),
        averageRescheduledPerDeal: toAverage(row.rescheduledCount, row.dealIds.size),
        averageClosedPerDeal: toAverage(row.closedCount, row.dealIds.size)
      })),
    stageLookup
  );
}

export function buildActivitiesWorkloadReport(
  input: ActivitiesWorkloadInput
): ActivitiesWorkloadReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const activities = input.activities.filter(
    (activity) => activity.ownerTypeId === "2" && dealMap.has(activity.ownerId)
  );
  const taskActivities = activities.filter(isTaskActivity);
  const meetingDateEvents = buildDealMeetingDateWorkloadEvents({
    deals,
    meetingDateChanges: input.meetingDateChanges,
    fromMs,
    toMs
  });
  const slaMetricsByManager = buildSlaMetricsByManager({
    range: input.range,
    ...(input.slaAsOf !== undefined ? { slaAsOf: input.slaAsOf } : {}),
    deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities,
    calls: input.calls ?? []
  });
  type ActivitiesManagerAccumulator = {
    managerId: string;
    dealIds: Set<string>;
    createdCount: number;
    rescheduledCount: number;
    closedCount: number;
    meetingCount: number;
    meetingTypeCounts: Map<string, number>;
    meetingBusinessClubCounts: Map<
      string,
      { businessClubKey: string; meetingTypeKey: string; count: number }
    >;
    businessClubDealIds: Map<string, Set<string>>;
    stageItems: Array<{
      dealId: string;
      stageId: string;
      metric: "created" | "rescheduled" | "closed";
    }>;
  };
  const managerRows = new Map<string, ActivitiesManagerAccumulator>();

  for (const manager of input.managerDirectory ?? []) {
    managerRows.set(manager.id, {
        managerId: manager.id,
        dealIds: new Set<string>(),
        createdCount: 0,
        rescheduledCount: 0,
        closedCount: 0,
        meetingCount: 0,
        meetingTypeCounts: new Map<string, number>(),
        meetingBusinessClubCounts: new Map(),
        businessClubDealIds: new Map<string, Set<string>>(),
        stageItems: []
      });
  }

  const ensureManagerRow = (managerId: string) => {
    const current: ActivitiesManagerAccumulator = managerRows.get(managerId) ?? {
      managerId,
      dealIds: new Set<string>(),
      createdCount: 0,
      rescheduledCount: 0,
      closedCount: 0,
      meetingCount: 0,
      meetingTypeCounts: new Map<string, number>(),
      meetingBusinessClubCounts: new Map<
        string,
        { businessClubKey: string; meetingTypeKey: string; count: number }
      >(),
      businessClubDealIds: new Map<string, Set<string>>(),
      stageItems: []
    };

    managerRows.set(managerId, current);
    return current;
  };

  const registerDealForManager = (managerId: string, deal: DealSnapshot) => {
    const current = ensureManagerRow(managerId);
    current.dealIds.add(deal.id);
    const businessClubKey = resolveBusinessClubValue(deal);
    const businessClubDeals =
      current.businessClubDealIds.get(businessClubKey) ?? new Set<string>();

    businessClubDeals.add(deal.id);
    current.businessClubDealIds.set(businessClubKey, businessClubDeals);
  };

  const recordEvent = (
    managerId: string,
    dealId: string,
    stageId: string,
    metric: "created" | "rescheduled" | "closed"
  ) => {
    const current = ensureManagerRow(managerId);
    const deal = dealMap.get(dealId);

    current.dealIds.add(dealId);
    current.stageItems.push({ dealId, stageId, metric });
    if (deal) {
      registerDealForManager(managerId, deal);
    }

    if (metric === "created") {
      current.createdCount += 1;
    } else if (metric === "rescheduled") {
      current.rescheduledCount += 1;
    } else {
      current.closedCount += 1;
    }
  };

  for (const deal of deals) {
    if (isWithinRange(deal.dateCreate, fromMs, toMs)) {
      registerDealForManager(deal.assignedById ?? "UNASSIGNED", deal);
    }
  }

  for (const activity of taskActivities) {
    const deal = dealMap.get(activity.ownerId);
    if (!deal) {
      continue;
    }

    const managerId = activity.responsibleId ?? "UNASSIGNED";
    if (isWithinRange(activity.createdTime, fromMs, toMs)) {
      recordEvent(
        managerId,
        deal.id,
        resolveStageAtTime(deal, stageHistoryMap, activity.createdTime),
        "created"
      );
    }

    if (activity.completed && isWithinRange(activity.completedTime, fromMs, toMs)) {
      recordEvent(
        managerId,
        deal.id,
        resolveStageAtTime(
          deal,
          stageHistoryMap,
          activity.completedTime ?? activity.lastUpdated
        ),
        "closed"
      );
    }
  }

  for (const event of meetingDateEvents) {
    const { deal, managerId } = event;
    const current = ensureManagerRow(managerId);
    registerDealForManager(managerId, deal);
    current.meetingCount += 1;
    const meetingTypeKey = resolveMeetingTypeValue(deal);
    current.meetingTypeCounts.set(
      meetingTypeKey,
      (current.meetingTypeCounts.get(meetingTypeKey) ?? 0) + 1
    );
    const businessClubKey = resolveBusinessClubValue(deal);
    const meetingBusinessClubKey = `${businessClubKey}||${meetingTypeKey}`;
    const meetingBusinessClubBucket =
      current.meetingBusinessClubCounts.get(meetingBusinessClubKey) ?? {
        businessClubKey,
        meetingTypeKey,
        count: 0
      };

    meetingBusinessClubBucket.count += 1;
    current.meetingBusinessClubCounts.set(
      meetingBusinessClubKey,
      meetingBusinessClubBucket
    );
  }

  const managerRowsResult = Array.from(managerRows.values())
    .map((row) => ({
      managerId: row.managerId,
      managerName: resolveManagerName(row.managerId, managerDirectory),
      dealCount: row.dealIds.size,
      createdCount: row.createdCount,
      rescheduledCount: row.rescheduledCount,
      closedCount: row.closedCount,
      meetingCount: row.meetingCount,
      averageCreatedPerDeal: toAverage(row.createdCount, row.dealIds.size),
      averageRescheduledPerDeal: toAverage(row.rescheduledCount, row.dealIds.size),
      averageClosedPerDeal: toAverage(row.closedCount, row.dealIds.size),
      averageMeetingsPerDeal: toAverage(row.meetingCount, row.dealIds.size),
      meetingTypeBreakdown: sortCountRows(
        Array.from(row.meetingTypeCounts.entries()).map(([meetingTypeKey, count]) => ({
          meetingTypeKey,
          meetingTypeLabel: resolveMeetingTypeLabel(meetingTypeKey),
          count
        })),
        (meetingType) => meetingType.meetingTypeLabel
      ),
      businessClubBreakdown: sortCountRows(
        Array.from(row.businessClubDealIds.entries()).map(
          ([businessClubKey, dealIds]) => ({
            businessClubKey,
            businessClubLabel: resolveBusinessClubLabel(businessClubKey),
            dealCount: dealIds.size,
            count: dealIds.size
          })
        ),
        (businessClub) => businessClub.businessClubLabel
      ).map(({ count: _count, ...businessClub }) => businessClub),
      meetingBusinessClubBreakdown: sortCountRows(
        Array.from(row.meetingBusinessClubCounts.values()).map(
          ({ businessClubKey, meetingTypeKey, count }) => ({
            businessClubKey,
            businessClubLabel: resolveBusinessClubLabel(businessClubKey),
            meetingTypeKey,
            meetingTypeLabel: resolveMeetingTypeLabel(meetingTypeKey),
            count
          })
        ),
        (meetingBusinessClub) =>
          `${meetingBusinessClub.businessClubLabel} ${meetingBusinessClub.meetingTypeLabel}`
      ),
      slaMetrics: slaMetricsByManager.get(row.managerId) ?? [],
      stageBreakdown: buildActivitiesStageBreakdown(row.stageItems, stageLookup)
    }))
    .sort((left, right) => left.managerId.localeCompare(right.managerId));

  const totalDealIds = new Set<string>();
  for (const row of managerRows.values()) {
    for (const dealId of row.dealIds) {
      totalDealIds.add(dealId);
    }
  }

  return {
    range: input.range,
    totalDealCount: totalDealIds.size,
    totalCreatedCount: managerRowsResult.reduce(
      (total, row) => total + row.createdCount,
      0
    ),
    totalRescheduledCount: managerRowsResult.reduce(
      (total, row) => total + row.rescheduledCount,
      0
    ),
    totalClosedCount: managerRowsResult.reduce(
      (total, row) => total + row.closedCount,
      0
    ),
    totalMeetingCount: managerRowsResult.reduce(
      (total, row) => total + row.meetingCount,
      0
    ),
    warnings: [...ACTIVITIES_REPORT_WARNINGS],
    managerRows: managerRowsResult
  };
}

export function buildTargetGroupConversionReport(
  input: TargetGroupConversionInput
): TargetGroupConversionReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const pricingRules = input.pricingRules;
  const scopedDeals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const stageHistoryMap = buildStageHistoryMap(input.stageHistory ?? []);
  const rows = new Map<
    string,
    {
      targetGroupKey: string;
      targetGroupLabel: string;
      createdDeals: number;
      wonDeals: number;
      lostDeals: number;
      salesAmount: number;
      totalCycleMs: number;
      cycleCount: number;
    }
  >();

  for (const deal of scopedDeals) {
    const targetGroupKey = resolveTargetGroupValue(deal);
    const current = rows.get(targetGroupKey) ?? {
      targetGroupKey,
      targetGroupLabel: resolveTargetGroupLabel(targetGroupKey),
      createdDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      salesAmount: 0,
      totalCycleMs: 0,
      cycleCount: 0
    };

    if (isWithinRange(deal.dateCreate, fromMs, toMs)) {
      current.createdDeals += 1;
    }

    const terminalClosedAt = resolveTerminalClosedAt(deal, stageHistoryMap, wonStageIds);

    if (isWithinRange(terminalClosedAt, fromMs, toMs)) {
      if (wonStageIds.has(deal.stageId)) {
        current.wonDeals += 1;
        current.salesAmount += resolveAttractionRevenueAmount({
          deal,
          pricingRules
        });

        const closedAt = resolveWonAt(deal, stageHistoryMap, wonStageIds);
        if (closedAt) {
          const cycleMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
          if (Number.isFinite(cycleMs) && cycleMs >= 0) {
            current.totalCycleMs += cycleMs;
            current.cycleCount += 1;
          }
        }
      } else if (deal.stageSemanticId === "F") {
        current.lostDeals += 1;
      }
    }

    rows.set(targetGroupKey, current);
  }

  return {
    range: input.range,
    totalCreatedDeals: scopedDeals.filter((deal) =>
      isWithinRange(deal.dateCreate, fromMs, toMs)
    ).length,
    totalWonDeals: scopedDeals.filter(
      (deal) =>
        wonStageIds.has(deal.stageId) &&
        isWithinRange(resolveWonAt(deal, stageHistoryMap, wonStageIds), fromMs, toMs)
    ).length,
    rows: Array.from(rows.values())
      .filter((row) => row.createdDeals > 0 || row.wonDeals > 0 || row.lostDeals > 0)
      .map((row) => ({
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel,
        createdDeals: row.createdDeals,
        wonDeals: row.wonDeals,
        winRate:
          row.wonDeals + row.lostDeals === 0
            ? 0
            : Number((row.wonDeals / (row.wonDeals + row.lostDeals)).toFixed(4)),
        salesAmount: row.salesAmount,
        averageSaleAmount: toAverage(row.salesAmount, row.wonDeals),
        averageCycleDays: toAverageDays(row.totalCycleMs, row.cycleCount)
      }))
      .sort((left, right) => {
        if (right.wonDeals !== left.wonDeals) {
          return right.wonDeals - left.wonDeals;
        }

        if (right.createdDeals !== left.createdDeals) {
          return right.createdDeals - left.createdDeals;
        }

        return left.targetGroupLabel.localeCompare(right.targetGroupLabel, "ru");
      })
  };
}

const ACTION_OUTCOME_STATUS_LABELS = {
  won: "Выиграно",
  lost: "Проиграно",
  wip: "В работе сейчас"
} as const;

const ACTION_OUTCOME_STATUS_ORDER = {
  won: 0,
  lost: 1,
  wip: 2
} as const;

type ActionOutcomeStatusKey = keyof typeof ACTION_OUTCOME_STATUS_LABELS;

type ActionOutcomeStatusAccumulator = {
  managerId: string;
  cohortMonth: string | null;
  statusKey: ActionOutcomeStatusKey;
  cohortCreatedDeals: number;
  dealCount: number;
  createdTasks: number;
  closedTasks: number;
  totalCalls: number;
  successfulCallsOverThirtySeconds: number;
  meetingsCount: number;
  financialAmount: number;
  sla: SlaAccumulatorSet;
  dealDetails: ManagerActionOutcomeDealDetail[];
};

function toCohortMonth(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? value.slice(0, 7) : null;
}

function resolveActionOutcomeStatus(
  deal: DealSnapshot,
  wonStageIds: Set<string>
): ActionOutcomeStatusKey {
  if (wonStageIds.has(deal.stageId) || deal.stageSemanticId === "S") {
    return "won";
  }

  if (deal.stageSemanticId === "F") {
    return "lost";
  }

  return "wip";
}

function isLifecycleTimestamp(value: string | null, deal: DealSnapshot, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  const createdAt = Date.parse(deal.dateCreate);
  const closedAt = deal.dateClosed ? Date.parse(deal.dateClosed) : Number.POSITIVE_INFINITY;
  const upperBound = Math.min(
    toMs,
    Number.isFinite(closedAt) ? closedAt : Number.POSITIVE_INFINITY
  );

  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(createdAt) &&
    timestamp >= createdAt &&
    timestamp <= upperBound
  );
}

function buildMeetingDateFallbackEvents(
  deal: DealSnapshot,
  existingMeetings: ActivitySnapshot[],
  toMs: number
): DealMeetingEvent[] {
  if (existingMeetings.length > 0) {
    return [];
  }

  const meetingDateValue = deal.meetingDateValue?.trim();
  if (!meetingDateValue || !isLifecycleTimestamp(meetingDateValue, deal, toMs)) {
    return [];
  }

  return [
    {
      activityId: `deal-field:${deal.id}:meeting-date`,
      createdAt: meetingDateValue,
      timelineAt: meetingDateValue,
      scheduledAt: meetingDateValue,
      completed: true
    }
  ];
}

function toPerDeal(total: number, dealCount: number) {
  return dealCount === 0 ? 0 : Number((total / dealCount).toFixed(2));
}

function toSlaOnTimeRate(accumulator: SlaAccumulator) {
  const denominator =
    accumulator.onTimeCount + accumulator.lateCount + accumulator.noTouchCount;
  return denominator === 0
    ? 0
    : Number((accumulator.onTimeCount / denominator).toFixed(4));
}

function toManagerActionDealSla(accumulator: SlaAccumulator): ManagerActionOutcomeDealSla {
  const hours = accumulator.durations[0] ?? null;

  if (accumulator.onTimeCount > 0) {
    return { status: "onTime", hours };
  }

  if (accumulator.lateCount > 0) {
    return { status: "late", hours };
  }

  return { status: "noTouch", hours };
}

function buildManagerActionCallSummary(calls: CallSnapshot[]): DealCallSummary {
  const successful = calls.filter(isCallConnected);

  return {
    total: calls.length,
    incoming: calls.filter((call) => resolveCallDirection(call.callType) === "incoming").length,
    outgoing: calls.filter((call) => resolveCallDirection(call.callType) === "outgoing").length,
    successful: successful.length,
    failed: calls.length - successful.length,
    overThirtySeconds: calls.filter(isCallOverThirtySeconds).length,
    connectedOverThirtySeconds: successful.filter(isCallOverThirtySeconds).length
  };
}

function buildManagerActionStageTimeline(input: {
  deal: DealSnapshot;
  stageHistoryRows: StageHistorySnapshot[];
  stageLookup: Map<string, { stageName: string; sortOrder: number }>;
  terminalAt: string;
  meetingEvents: DealMeetingEvent[];
  warnings: Set<string>;
}): DealStageTimelineEntry[] {
  const rows =
    input.stageHistoryRows.length === 0
      ? [
          {
            stageId: input.deal.stageId,
            createdTime: input.deal.dateCreate
          }
        ]
      : input.stageHistoryRows.map((row) => ({
          stageId: row.stageId,
          createdTime: row.createdTime
        }));
  const timeline = rows.map<DealStageTimelineEntry>((row, index) => {
    const next = rows[index + 1];
    const leftAt = next?.createdTime ?? input.terminalAt;

    return {
      stageId: row.stageId,
      stageName: resolveManagerActionStageName(
        row.stageId,
        input.stageLookup,
        input.warnings
      ),
      enteredAt: row.createdTime,
      leftAt,
      durationHours: toDurationHours(row.createdTime, leftAt) ?? 0,
      callSummary: buildManagerActionCallSummary([]),
      taskSummary: {
        created: 0,
        closed: 0
      },
      meetingEvents: []
    };
  });

  for (const meeting of input.meetingEvents) {
    const meetingTime = Date.parse(meeting.timelineAt);
    const targetIndex = timeline.findIndex((stage, index) => {
      const enteredAt = Date.parse(stage.enteredAt);
      const leftAt = Date.parse(stage.leftAt);
      const isLast = index === timeline.length - 1;

      return (
        Number.isFinite(meetingTime) &&
        Number.isFinite(enteredAt) &&
        Number.isFinite(leftAt) &&
        meetingTime >= enteredAt &&
        (isLast ? meetingTime <= leftAt : meetingTime < leftAt)
      );
    });
    const safeIndex = targetIndex === -1 ? Math.max(0, timeline.length - 1) : targetIndex;
    timeline[safeIndex]?.meetingEvents?.push(meeting);
  }

  return timeline;
}

function sanitizeManagerActionTargetGroup(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || /^\d+$/.test(trimmed) || trimmed === "Неизвестная таргет-группа") {
    return null;
  }

  return trimmed;
}

function buildManagerActionDealDetail(input: {
  deal: DealSnapshot;
  amount: number;
  stageLookup: Map<string, { stageName: string; sortOrder: number }>;
  warnings: Set<string>;
  stageHistoryRows: StageHistorySnapshot[];
  sourceLabels: Map<string, string>;
  taskCreatedCount: number;
  taskClosedCount: number;
  dealCalls: CallSnapshot[];
  successfulDealCalls: CallSnapshot[];
  dealMeetings: ActivitySnapshot[];
  fallbackMeetingEvents: DealMeetingEvent[];
  sla: SlaAccumulatorSet;
  terminalAt: string;
}): ManagerActionOutcomeDealDetail {
  const source = resolveDealSource(input.deal, input.sourceLabels);
  const meetingEvents: DealMeetingEvent[] = [
    ...input.dealMeetings.map((meeting) => ({
      activityId: meeting.id,
      createdAt: meeting.createdTime,
      timelineAt: getMeetingCommunicationTime(meeting),
      scheduledAt: meeting.deadline ?? meeting.createdTime,
      completed: meeting.completed
    })),
    ...input.fallbackMeetingEvents
  ].sort((left, right) => {
    const byTime = Date.parse(left.timelineAt) - Date.parse(right.timelineAt);
    return byTime !== 0 ? byTime : left.activityId.localeCompare(right.activityId);
  });

  return {
    dealId: input.deal.id,
    stageId: input.deal.stageId,
    stageName: resolveManagerActionStageName(
      input.deal.stageId,
      input.stageLookup,
      input.warnings
    ),
    amount: input.amount,
    dateCreate: input.deal.dateCreate,
    dateClosed: input.deal.dateClosed,
    dateModify: input.deal.dateModify,
    sourceKey: source.key,
    sourceLabel: source.label,
    qualityValue: input.deal.qualityValue,
    businessClubValue: input.deal.businessClubValue ?? null,
    targetGroupValue: sanitizeManagerActionTargetGroup(input.deal.targetGroupValue),
    meetingTypeValue: input.deal.meetingTypeValue ?? null,
    meetingDateValue: input.deal.meetingDateValue ?? null,
    tariffValue: input.deal.tariffValue ?? null,
    taskSummary: {
      created: input.taskCreatedCount,
      closed: input.taskClosedCount
    } satisfies DealTaskSummary,
    callSummary: {
      ...buildManagerActionCallSummary(input.dealCalls),
      connectedOverThirtySeconds: input.successfulDealCalls.length
    },
    meetingSummary: {
      total: meetingEvents.length
    } satisfies DealMeetingSummary,
    sla: {
      sla1: toManagerActionDealSla(input.sla.sla1),
      sla2: toManagerActionDealSla(input.sla.sla2),
      sla3: toManagerActionDealSla(input.sla.sla3)
    },
    stageTimeline: buildManagerActionStageTimeline({
      deal: input.deal,
      stageHistoryRows: input.stageHistoryRows,
      stageLookup: input.stageLookup,
      terminalAt: input.terminalAt,
      meetingEvents,
      warnings: input.warnings
    })
  };
}

export function buildManagerActionOutcomeReport(
  input: ManagerActionOutcomeInput
): ManagerActionOutcomeReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const rawEvaluationToMs = Date.parse(input.slaAsOf ?? input.range.to);
  const evaluationToMs = Number.isFinite(rawEvaluationToMs)
    ? rawEvaluationToMs
    : toMs;
  const wonStageIds = new Set(input.wonStageIds);
  const pricingRules = input.pricingRules;
  const pricingWarnings = new Set<string>();
  const stageWarnings = new Set<string>();
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const managerScopeIds = new Set((input.managerDirectory ?? []).map((manager) => manager.id));
  const isScopedAggregateManager = (managerId: string) =>
    managerScopeIds.size === 0 || managerScopeIds.has(managerId);
  const activities = input.activities.filter(
    (activity) => activity.ownerTypeId === "2" && dealMap.has(activity.ownerId)
  );
  const taskActivities = activities.filter(isTaskActivity);
  const meetingActivities = activities.filter(isMeetingActivity);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const activitiesByDeal = new Map<string, ActivitySnapshot[]>();
  for (const activity of activities) {
    const current = activitiesByDeal.get(activity.ownerId) ?? [];
    current.push(activity);
    activitiesByDeal.set(activity.ownerId, current);
  }
  const stageLookup = buildStageLookup(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const completedMeetingsByDeal = buildCompletedMeetingsByDeal(activities, dealMap);
  const callsByDeal = buildCallsByDeal(input.calls, activities, dealMap);
  const slaMetricsByManager = buildSlaMetricsByManager({
    range: input.range,
    ...(input.slaAsOf !== undefined ? { slaAsOf: input.slaAsOf } : {}),
    deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities,
    calls: input.calls
  });
  const rows = new Map<
    string,
    {
      managerId: string;
      createdTasks: number;
      closedTasks: number;
      totalCalls: number;
      successfulCallsOverThirtySeconds: number;
      meetingsCount: number;
      newDealsCount: number;
      wonDealsCount: number;
      salesAmount: number;
      totalCycleMs: number;
      cycleCount: number;
    }
  >();

  const ensureRow = (managerId: string) => {
    const current = rows.get(managerId) ?? {
      managerId,
      createdTasks: 0,
      closedTasks: 0,
      totalCalls: 0,
      successfulCallsOverThirtySeconds: 0,
      meetingsCount: 0,
      newDealsCount: 0,
      wonDealsCount: 0,
      salesAmount: 0,
      totalCycleMs: 0,
      cycleCount: 0
    };

    rows.set(managerId, current);
    return current;
  };

  for (const manager of input.managerDirectory ?? []) {
    ensureRow(manager.id);
  }

  for (const activity of taskActivities) {
    const managerId = activity.responsibleId ?? "UNASSIGNED";
    if (!isScopedAggregateManager(managerId)) {
      continue;
    }

    const row = ensureRow(managerId);

    if (isWithinRange(activity.createdTime, fromMs, toMs)) {
      row.createdTasks += 1;
    }

    if (activity.completed && isWithinRange(activity.completedTime, fromMs, toMs)) {
      row.closedTasks += 1;
    }
  }

  for (const activity of meetingActivities) {
    if (!isWithinRange(activity.createdTime, fromMs, toMs)) {
      continue;
    }

    const managerId = activity.responsibleId ?? "UNASSIGNED";
    if (!isScopedAggregateManager(managerId)) {
      continue;
    }

    ensureRow(managerId).meetingsCount += 1;
  }

  for (const deal of deals) {
    const fallbackMeetingEvents = buildMeetingDateFallbackEvents(
      deal,
      completedMeetingsByDeal.get(deal.id) ?? [],
      toMs
    ).filter((event) => isWithinRange(event.timelineAt, fromMs, toMs));
    if (fallbackMeetingEvents.length === 0) {
      continue;
    }

    const managerId = deal.assignedById ?? "UNASSIGNED";
    ensureRow(managerId).meetingsCount += fallbackMeetingEvents.length;
  }

  for (const call of input.calls) {
    if (!isWithinRange(call.callStartDate, fromMs, toMs)) {
      continue;
    }

    const activityManagerId =
      call.crmActivityId ? activityById.get(call.crmActivityId)?.responsibleId : null;
    const managerId = call.portalUserId ?? activityManagerId ?? "UNASSIGNED";
    if (!isScopedAggregateManager(managerId)) {
      continue;
    }

    const row = ensureRow(managerId);

    row.totalCalls += 1;
    if (isCallConnected(call) && isCallOverThirtySeconds(call)) {
      row.successfulCallsOverThirtySeconds += 1;
    }
  }

  for (const deal of deals) {
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const row = ensureRow(managerId);

    if (isWithinRange(deal.dateCreate, fromMs, toMs)) {
      row.newDealsCount += 1;
    }

    if (
      wonStageIds.has(deal.stageId) &&
      isWithinRange(resolveWonAt(deal, stageHistoryMap, wonStageIds), fromMs, toMs)
    ) {
      row.wonDealsCount += 1;
      row.salesAmount += resolveAttractionRevenueAmount({
        deal,
        pricingRules,
        warnings: pricingWarnings
      });

      const closedAt = resolveWonAt(deal, stageHistoryMap, wonStageIds);
      if (closedAt) {
        const cycleMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
        if (Number.isFinite(cycleMs) && cycleMs >= 0) {
          row.totalCycleMs += cycleMs;
          row.cycleCount += 1;
        }
      }
    }
  }

  const cohortDeals = deals.filter(
    (deal) =>
      isWithinRange(deal.dateCreate, fromMs, toMs) &&
      toCohortMonth(deal.dateCreate) !== null
  );
  const cohortMonthCounts = new Map<string, number>();
  const cohortCreatedDealCounts = new Map<string, number>();
  const statusRows = new Map<string, ActionOutcomeStatusAccumulator>();
  const cohortCountKey = (managerId: string, cohortMonth: string | null) =>
    `${managerId}::${cohortMonth ?? "ALL"}`;
  const statusRowKey = (
    managerId: string,
    cohortMonth: string | null,
    statusKey: ActionOutcomeStatusKey
  ) => `${managerId}::${cohortMonth ?? "ALL"}::${statusKey}`;

  for (const deal of cohortDeals) {
    const cohortMonth = toCohortMonth(deal.dateCreate);
    if (!cohortMonth) {
      continue;
    }

    const managerId = deal.assignedById ?? "UNASSIGNED";
    cohortMonthCounts.set(cohortMonth, (cohortMonthCounts.get(cohortMonth) ?? 0) + 1);
    for (const monthScope of [null, cohortMonth]) {
      const key = cohortCountKey(managerId, monthScope);
      cohortCreatedDealCounts.set(key, (cohortCreatedDealCounts.get(key) ?? 0) + 1);
    }
  }

  const ensureStatusRow = (
    managerId: string,
    cohortMonth: string | null,
    statusKey: ActionOutcomeStatusKey
  ) => {
    const key = statusRowKey(managerId, cohortMonth, statusKey);
    const current = statusRows.get(key) ?? {
      managerId,
      cohortMonth,
      statusKey,
      cohortCreatedDeals: cohortCreatedDealCounts.get(
        cohortCountKey(managerId, cohortMonth)
      ) ?? 0,
      dealCount: 0,
      createdTasks: 0,
      closedTasks: 0,
      totalCalls: 0,
      successfulCallsOverThirtySeconds: 0,
      meetingsCount: 0,
      financialAmount: 0,
      sla: createSlaAccumulatorSet(),
      dealDetails: []
    };

    statusRows.set(key, current);
    return current;
  };

  for (const deal of cohortDeals) {
    const cohortMonth = toCohortMonth(deal.dateCreate);
    if (!cohortMonth) {
      continue;
    }

    const managerId = deal.assignedById ?? "UNASSIGNED";
    const statusKey = resolveActionOutcomeStatus(deal, wonStageIds);
    const dealActivities = activitiesByDeal.get(deal.id) ?? [];
    const taskCreatedCount = dealActivities.filter(
      (activity) =>
        isTaskActivity(activity) &&
        isLifecycleTimestamp(activity.createdTime, deal, toMs)
    ).length;
    const taskClosedCount = dealActivities.filter(
      (activity) =>
        isTaskActivity(activity) &&
        activity.completed &&
        isLifecycleTimestamp(activity.completedTime, deal, toMs)
    ).length;
    const dealCalls = (callsByDeal.get(deal.id) ?? []).filter((call) =>
      isLifecycleTimestamp(call.callStartDate, deal, toMs)
    );
    const successfulDealCalls = dealCalls.filter(
      (call) => isCallConnected(call) && isCallOverThirtySeconds(call)
    );
    const dealMeetings = (completedMeetingsByDeal.get(deal.id) ?? []).filter((meeting) =>
      isLifecycleTimestamp(getMeetingCommunicationTime(meeting), deal, toMs)
    );
    const fallbackMeetingEvents = buildMeetingDateFallbackEvents(
      deal,
      dealMeetings,
      toMs
    );
    const dealSla = createSlaAccumulatorSet();
    recordDealSlaOutcomes({
      deal,
      accumulatorSet: dealSla,
      stageLookup,
      stageHistoryMap,
      callsByDeal,
      evaluationToMs
    });
    const terminalAt =
      resolveTerminalClosedAt(deal, stageHistoryMap, wonStageIds) ??
      deal.dateModify ??
      input.range.to;
    const financialAmount = resolveAttractionRevenueAmount({
      deal,
      pricingRules,
      context: statusKey === "won" ? "finalWon" : "pipelinePlan",
      warnings: pricingWarnings
    });
    const dealDetail = buildManagerActionDealDetail({
      deal,
      amount: financialAmount,
      stageLookup,
      warnings: stageWarnings,
      stageHistoryRows: stageHistoryMap.get(deal.id) ?? [],
      sourceLabels,
      taskCreatedCount,
      taskClosedCount,
      dealCalls,
      successfulDealCalls,
      dealMeetings,
      fallbackMeetingEvents,
      sla: dealSla,
      terminalAt
    });

    for (const monthScope of [null, cohortMonth]) {
      const row = ensureStatusRow(managerId, monthScope, statusKey);
      row.dealCount += 1;
      row.createdTasks += taskCreatedCount;
      row.closedTasks += taskClosedCount;
      row.totalCalls += dealCalls.length;
      row.successfulCallsOverThirtySeconds += successfulDealCalls.length;
      row.meetingsCount += dealMeetings.length + fallbackMeetingEvents.length;
      row.financialAmount += financialAmount;
      row.dealDetails.push(dealDetail);
      recordDealSlaOutcomes({
        deal,
        accumulatorSet: row.sla,
        stageLookup,
        stageHistoryMap,
        callsByDeal,
        evaluationToMs
      });
    }
  }

  const managerIds = Array.from(
    new Set([
      ...rows.keys(),
      ...slaMetricsByManager.keys(),
      ...deals.map((deal) => deal.assignedById ?? "UNASSIGNED"),
      ...taskActivities
        .map((activity) => activity.responsibleId ?? "UNASSIGNED")
        .filter(isScopedAggregateManager),
      ...meetingActivities
        .map((activity) => activity.responsibleId ?? "UNASSIGNED")
        .filter(isScopedAggregateManager),
      ...input.calls
        .map((call) => {
          const activityManagerId = call.crmActivityId
            ? activityById.get(call.crmActivityId)?.responsibleId
            : null;

          return call.portalUserId ?? activityManagerId ?? "UNASSIGNED";
        })
        .filter(isScopedAggregateManager)
    ])
  );

  return {
    range: input.range,
    warnings: Array.from(new Set([...pricingWarnings, ...stageWarnings])),
    cohortMonths: Array.from(cohortMonthCounts.entries())
      .map(([cohortMonth, totalCreatedDeals]) => ({
        cohortMonth,
        cohortLabel: cohortMonth,
        totalCreatedDeals
      }))
      .sort((left, right) => right.cohortMonth.localeCompare(left.cohortMonth)),
    cohortStatusRows: Array.from(statusRows.values())
      .filter((row) => row.dealCount > 0)
      .map<ManagerActionOutcomeStatusRow>((row) => ({
        managerId: row.managerId,
        managerName: resolveManagerName(row.managerId, managerDirectory),
        cohortMonth: row.cohortMonth,
        statusKey: row.statusKey,
        statusLabel: ACTION_OUTCOME_STATUS_LABELS[row.statusKey],
        cohortCreatedDeals: row.cohortCreatedDeals,
        dealCount: row.dealCount,
        statusShare:
          row.cohortCreatedDeals === 0
            ? 0
            : Number((row.dealCount / row.cohortCreatedDeals).toFixed(4)),
        createdTasksPerDeal: toPerDeal(row.createdTasks, row.dealCount),
        closedTasksPerDeal: toPerDeal(row.closedTasks, row.dealCount),
        totalCallsPerDeal: toPerDeal(row.totalCalls, row.dealCount),
        successfulCallsOverThirtySecondsPerDeal: toPerDeal(
          row.successfulCallsOverThirtySeconds,
          row.dealCount
        ),
        meetingsPerDeal: toPerDeal(row.meetingsCount, row.dealCount),
        sla1OnTimeRate: toSlaOnTimeRate(row.sla.sla1),
        sla2OnTimeRate: toSlaOnTimeRate(row.sla.sla2),
        sla3OnTimeRate: toSlaOnTimeRate(row.sla.sla3),
        financialAmount: row.financialAmount,
        averageFinancialAmount: toAverage(row.financialAmount, row.dealCount),
        dealDetails: row.dealDetails.sort((left, right) => {
          const byCreated = right.dateCreate.localeCompare(left.dateCreate);
          return byCreated !== 0 ? byCreated : right.dealId.localeCompare(left.dealId);
        })
      }))
      .sort((left, right) => {
        const byMonth = (left.cohortMonth ?? "").localeCompare(
          right.cohortMonth ?? ""
        );
        if (byMonth !== 0) {
          return byMonth;
        }

        const byManager = left.managerName.localeCompare(right.managerName, "ru");
        if (byManager !== 0) {
          return byManager;
        }

        return (
          ACTION_OUTCOME_STATUS_ORDER[left.statusKey] -
          ACTION_OUTCOME_STATUS_ORDER[right.statusKey]
        );
      }),
    rows: managerIds
      .map<ManagerActionOutcomeRow>((managerId) => {
        const row = ensureRow(managerId);
        const slaMetrics = slaMetricsByManager.get(managerId) ?? [];
        const sla1 = slaMetrics.find((metric) => metric.slaKey === "sla1");
        const sla2 = slaMetrics.find((metric) => metric.slaKey === "sla2");
        const sla3 = slaMetrics.find((metric) => metric.slaKey === "sla3");

        return {
          managerId,
          managerName: resolveManagerName(managerId, managerDirectory),
          createdTasks: row.createdTasks,
          closedTasks: row.closedTasks,
          totalCalls: row.totalCalls,
          successfulCallsOverThirtySeconds: row.successfulCallsOverThirtySeconds,
          meetingsCount: row.meetingsCount,
          sla1OnTimeCount: sla1?.onTimeCount ?? 0,
          sla1LateCount: sla1?.lateCount ?? 0,
          sla1NoTouchCount: sla1?.noTouchCount ?? 0,
          sla1MedianHours: sla1?.medianHours ?? 0,
          sla2OnTimeCount: sla2?.onTimeCount ?? 0,
          sla2LateCount: sla2?.lateCount ?? 0,
          sla2NoTouchCount: sla2?.noTouchCount ?? 0,
          sla2MedianHours: sla2?.medianHours ?? 0,
          sla3OnTimeCount: sla3?.onTimeCount ?? 0,
          sla3LateCount: sla3?.lateCount ?? 0,
          sla3NoTouchCount: sla3?.noTouchCount ?? 0,
          sla3MedianHours: sla3?.medianHours ?? 0,
          newDealsCount: row.newDealsCount,
          wonDealsCount: row.wonDealsCount,
          winRate:
            row.newDealsCount === 0
              ? 0
              : Number((row.wonDealsCount / row.newDealsCount).toFixed(4)),
          salesAmount: row.salesAmount,
          averageSaleAmount: toAverage(row.salesAmount, row.wonDealsCount),
          averageCycleDays: toAverageDays(row.totalCycleMs, row.cycleCount)
        };
      })
      .sort((left, right) => left.managerName.localeCompare(right.managerName, "ru"))
  };
}

function buildCallsStageBreakdown(
  items: Array<{
    dealId: string;
    stageId: string;
    direction: "incoming" | "outgoing" | "unknown";
    durationSeconds: number;
    connected: boolean;
    failed: boolean;
    overThirtySeconds: boolean;
    connectedOverThirtySeconds: boolean;
  }>,
  stageLookup: Map<string, { stageName: string; sortOrder: number }>
) {
  const rows = new Map<
    string,
    {
      stageId: string;
      stageName: string;
      dealIds: Set<string>;
      totalCalls: number;
      incomingCalls: number;
      missedIncomingCalls: number;
      outgoingCalls: number;
      otherOutgoingCalls: number;
      connectedCalls: number;
      failedCalls: number;
      callsOverThirtySeconds: number;
      connectedCallsOverThirtySeconds: number;
      totalDurationSeconds: number;
    }
  >();

  for (const item of items) {
    const stage = stageLookup.get(item.stageId);
    const current = rows.get(item.stageId) ?? {
      stageId: item.stageId,
      stageName: stage?.stageName ?? item.stageId,
      dealIds: new Set<string>(),
      totalCalls: 0,
      incomingCalls: 0,
      missedIncomingCalls: 0,
      outgoingCalls: 0,
      otherOutgoingCalls: 0,
      connectedCalls: 0,
      failedCalls: 0,
      callsOverThirtySeconds: 0,
      connectedCallsOverThirtySeconds: 0,
      totalDurationSeconds: 0
    };

    current.dealIds.add(item.dealId);
    current.totalCalls += 1;
    current.totalDurationSeconds += item.durationSeconds;
    if (item.direction === "incoming" && item.connected) {
      current.incomingCalls += 1;
    } else if (item.direction === "incoming") {
      current.missedIncomingCalls += 1;
    } else if (item.direction === "outgoing") {
      current.outgoingCalls += 1;
      if (!item.failed && !(item.connectedOverThirtySeconds ?? false)) {
        current.otherOutgoingCalls += 1;
      }
    }
    if (item.connected) {
      current.connectedCalls += 1;
    }
    if (item.failed) {
      current.failedCalls += 1;
    }
    if (item.overThirtySeconds) {
      current.callsOverThirtySeconds += 1;
    }
    if (item.connectedOverThirtySeconds) {
      current.connectedCallsOverThirtySeconds += 1;
    }

    rows.set(item.stageId, current);
  }

  return sortStageMetrics(
    Array.from(rows.values())
      .map<StageCallMetric>((row) => ({
        stageId: row.stageId,
        stageName: row.stageName,
        dealCount: row.dealIds.size,
        totalCalls: row.totalCalls,
        incomingCalls: row.incomingCalls,
        missedIncomingCalls: row.missedIncomingCalls,
        outgoingCalls: row.outgoingCalls,
        otherOutgoingCalls: row.otherOutgoingCalls,
        connectedCalls: row.connectedCalls,
        failedCalls: row.failedCalls,
        callsOverThirtySeconds: row.callsOverThirtySeconds,
        connectedCallsOverThirtySeconds: row.connectedCallsOverThirtySeconds,
        averageCallsPerDeal: toAverage(row.totalCalls, row.dealIds.size),
        averageDurationSeconds: toAverage(
          row.totalDurationSeconds,
          row.totalCalls
        )
      })),
    stageLookup
  );
}

function resolveCallDirection(callType: string | null) {
  if (callType === "1") {
    return "outgoing" as const;
  }

  if (callType === "2") {
    return "incoming" as const;
  }

  return "unknown" as const;
}

function normalizeCallStatusCode(value: string | null) {
  return value?.trim() ?? "";
}

function isDealCallEntityType(value: string | null) {
  return value === "2" || value?.toUpperCase() === "DEAL";
}

function isCallSuccessful(call: CallSnapshot) {
  if (call.callDurationSeconds <= 0) {
    return false;
  }

  const statusCode = normalizeCallStatusCode(call.callFailedCode);
  return statusCode.length === 0 || statusCode === "200";
}

function isCallFailed(call: CallSnapshot) {
  return (
    resolveCallDirection(call.callType) === "outgoing" &&
    !isCallSuccessful(call)
  );
}

function isCallConnected(call: CallSnapshot) {
  return isCallSuccessful(call);
}

function isCallOverThirtySeconds(call: CallSnapshot) {
  return call.callDurationSeconds > 30;
}

export function buildCallsWorkloadReport(
  input: CallsWorkloadInput
): CallsWorkloadReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(deal.categoryId ?? "")
  );
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const activityMap = new Map(
    input.activities
      .filter(
        (activity) =>
          activity.ownerTypeId === "2" &&
          activity.providerId === "VOXIMPLANT_CALL"
      )
      .map((activity) => [activity.id, activity])
  );
  const activityBindingsByActivityId = new Map<string, ActivityBindingSnapshot[]>();
  for (const binding of input.activityBindings ?? []) {
    const bindings = activityBindingsByActivityId.get(binding.activityId) ?? [];
    bindings.push(binding);
    activityBindingsByActivityId.set(binding.activityId, bindings);
  }

  type CallAccumulator = {
    managerId: string;
    dealIds: Set<string>;
    totalCalls: number;
    incomingCalls: number;
    missedIncomingCalls: number;
    outgoingCalls: number;
    otherOutgoingCalls: number;
    connectedCalls: number;
    failedCalls: number;
    callsOverThirtySeconds: number;
    connectedCallsOverThirtySeconds: number;
    totalDurationSeconds: number;
    stageItems: Array<{
      dealId: string;
      stageId: string;
      direction: "incoming" | "outgoing" | "unknown";
      durationSeconds: number;
      connected: boolean;
      failed: boolean;
      overThirtySeconds: boolean;
      connectedOverThirtySeconds: boolean;
    }>;
  };

  const createAccumulator = (managerId: string): CallAccumulator => ({
    managerId,
    dealIds: new Set<string>(),
    totalCalls: 0,
    incomingCalls: 0,
    missedIncomingCalls: 0,
    outgoingCalls: 0,
    otherOutgoingCalls: 0,
    connectedCalls: 0,
    failedCalls: 0,
    callsOverThirtySeconds: 0,
    connectedCallsOverThirtySeconds: 0,
    totalDurationSeconds: 0,
    stageItems: []
  });

  const addCallToAccumulator = (
    accumulator: CallAccumulator,
    call: CallSnapshot,
    direction: "incoming" | "outgoing" | "unknown",
    connected: boolean,
    failed: boolean,
    overThirtySeconds: boolean
  ) => {
    accumulator.totalCalls += 1;
    accumulator.totalDurationSeconds += call.callDurationSeconds;
    if (direction === "incoming" && connected) {
      accumulator.incomingCalls += 1;
    } else if (direction === "incoming") {
      accumulator.missedIncomingCalls += 1;
    } else if (direction === "outgoing") {
      accumulator.outgoingCalls += 1;
      if (!failed && !(connected && overThirtySeconds)) {
        accumulator.otherOutgoingCalls += 1;
      }
    }
    if (connected) {
      accumulator.connectedCalls += 1;
    }
    if (failed) {
      accumulator.failedCalls += 1;
    }
    if (overThirtySeconds) {
      accumulator.callsOverThirtySeconds += 1;
    }
    if (direction === "outgoing" && connected && overThirtySeconds) {
      accumulator.connectedCallsOverThirtySeconds += 1;
    }
  };
  const toCallPopulationSummary = (accumulator: CallAccumulator) => ({
    totalCalls: accumulator.totalCalls,
    incomingCalls: accumulator.incomingCalls,
    missedIncomingCalls: accumulator.missedIncomingCalls,
    outgoingCalls: accumulator.outgoingCalls,
    otherOutgoingCalls: accumulator.otherOutgoingCalls,
    connectedCalls: accumulator.connectedCalls,
    failedCalls: accumulator.failedCalls,
    callsOverThirtySeconds: accumulator.callsOverThirtySeconds,
    connectedCallsOverThirtySeconds: accumulator.connectedCallsOverThirtySeconds,
    averageDurationSeconds: toAverage(
      accumulator.totalDurationSeconds,
      accumulator.totalCalls
    )
  });
  const toLinkedDealCallSummary = (
    accumulator: CallAccumulator,
    stageBreakdown = buildCallsStageBreakdown(accumulator.stageItems, stageLookup)
  ) => ({
    ...toCallPopulationSummary(accumulator),
    dealCount: accumulator.dealIds.size,
    averageCallsPerDeal: toAverage(accumulator.totalCalls, accumulator.dealIds.size),
    stageBreakdown
  });
  const combineAccumulators = (
    accumulators: Iterable<CallAccumulator>,
    managerId: string
  ) => {
    const combined = createAccumulator(managerId);

    for (const accumulator of accumulators) {
      for (const dealId of accumulator.dealIds) {
        combined.dealIds.add(dealId);
      }
      combined.totalCalls += accumulator.totalCalls;
      combined.incomingCalls += accumulator.incomingCalls;
      combined.missedIncomingCalls += accumulator.missedIncomingCalls;
      combined.outgoingCalls += accumulator.outgoingCalls;
      combined.otherOutgoingCalls += accumulator.otherOutgoingCalls;
      combined.connectedCalls += accumulator.connectedCalls;
      combined.failedCalls += accumulator.failedCalls;
      combined.callsOverThirtySeconds += accumulator.callsOverThirtySeconds;
      combined.connectedCallsOverThirtySeconds +=
        accumulator.connectedCallsOverThirtySeconds;
      combined.totalDurationSeconds += accumulator.totalDurationSeconds;
      combined.stageItems.push(...accumulator.stageItems);
    }

    return combined;
  };

  const summaryRows = new Map<string, CallAccumulator>();
  const linkedRows = new Map<string, CallAccumulator>();
  const resolveLinkedDeal = (
    call: CallSnapshot,
    activity: ActivitySnapshot | null
  ) => {
    const boundDealIds = call.crmActivityId
      ? (activityBindingsByActivityId.get(call.crmActivityId) ?? [])
          .filter((binding) => binding.ownerTypeId === "2")
          .map((binding) => binding.ownerId)
      : [];

    for (const dealId of boundDealIds) {
      const deal = dealMap.get(dealId);
      if (deal) {
        return deal;
      }
    }

    if (activity) {
      const deal = dealMap.get(activity.ownerId);
      if (deal) {
        return deal;
      }
    }

    if (isDealCallEntityType(call.crmEntityType) && call.crmEntityId) {
      return dealMap.get(call.crmEntityId) ?? null;
    }

    return null;
  };

  for (const call of input.calls) {
    if (!isWithinRange(call.callStartDate, fromMs, toMs)) {
      continue;
    }

    const activity = call.crmActivityId
      ? activityMap.get(call.crmActivityId) ?? null
      : null;
    const direction = resolveCallDirection(call.callType);
    const connected = isCallConnected(call);
    const failed = isCallFailed(call);
    const overThirtySeconds = isCallOverThirtySeconds(call);
    const summaryManagerId =
      call.portalUserId ?? activity?.responsibleId ?? "UNASSIGNED";
    const summaryRow =
      summaryRows.get(summaryManagerId) ?? createAccumulator(summaryManagerId);

    addCallToAccumulator(
      summaryRow,
      call,
      direction,
      connected,
      failed,
      overThirtySeconds
    );
    summaryRows.set(summaryManagerId, summaryRow);

    const deal = resolveLinkedDeal(call, activity);
    if (!deal) {
      continue;
    }

    const managerId =
      call.portalUserId ??
      activity?.responsibleId ??
      deal.assignedById ??
      "UNASSIGNED";
    const stageId = resolveStageAtTime(deal, stageHistoryMap, call.callStartDate);
    const current = linkedRows.get(managerId) ?? createAccumulator(managerId);

    current.dealIds.add(deal.id);
    addCallToAccumulator(current, call, direction, connected, failed, overThirtySeconds);
    current.stageItems.push({
      dealId: deal.id,
      stageId,
      direction,
      durationSeconds: call.callDurationSeconds,
      connected,
      failed,
      overThirtySeconds,
      connectedOverThirtySeconds:
        direction === "outgoing" && connected && overThirtySeconds
    });

    linkedRows.set(managerId, current);
  }

  const managerIds = Array.from(
    new Set([
      ...(input.managerDirectory ?? []).map((manager) => manager.id),
      ...summaryRows.keys(),
      ...linkedRows.keys()
    ])
  );
  const managerRowsResult = managerIds
    .map((managerId) => {
      const summary = summaryRows.get(managerId) ?? createAccumulator(managerId);
      const linked = linkedRows.get(managerId) ?? createAccumulator(managerId);
      const stageBreakdown = buildCallsStageBreakdown(linked.stageItems, stageLookup);
      const allCalls = toCallPopulationSummary(summary);
      const linkedDealCalls = toLinkedDealCallSummary(linked, stageBreakdown);

      return {
        managerId,
        managerName: resolveManagerName(managerId, managerDirectory),
        dealCount: linked.dealIds.size,
        totalCalls: summary.totalCalls,
        incomingCalls: summary.incomingCalls,
        missedIncomingCalls: summary.missedIncomingCalls,
        outgoingCalls: summary.outgoingCalls,
        otherOutgoingCalls: summary.otherOutgoingCalls,
        connectedCalls: summary.connectedCalls,
        failedCalls: summary.failedCalls,
        callsOverThirtySeconds: summary.callsOverThirtySeconds,
        connectedCallsOverThirtySeconds: summary.connectedCallsOverThirtySeconds,
        averageCallsPerDeal: toAverage(linked.totalCalls, linked.dealIds.size),
        averageDurationSeconds: toAverage(
          summary.totalDurationSeconds,
          summary.totalCalls
        ),
        allCalls,
        linkedDealCalls,
        stageBreakdown
      };
    })
    .sort((left, right) => left.managerId.localeCompare(right.managerId));

  const totalDealIds = new Set<string>();
  for (const row of linkedRows.values()) {
    for (const dealId of row.dealIds) {
      totalDealIds.add(dealId);
    }
  }
  const allCallsAccumulator = combineAccumulators(
    summaryRows.values(),
    "__ALL_CALLS__"
  );
  const linkedDealCallsAccumulator = combineAccumulators(
    linkedRows.values(),
    "__LINKED_DEAL_CALLS__"
  );
  const linkedDealCallsSummary = toLinkedDealCallSummary(linkedDealCallsAccumulator);

  return {
    range: input.range,
    totalDealCount: totalDealIds.size,
    totalCalls: managerRowsResult.reduce((total, row) => total + row.totalCalls, 0),
    totalIncomingCalls: managerRowsResult.reduce(
      (total, row) => total + row.incomingCalls,
      0
    ),
    totalMissedIncomingCalls: managerRowsResult.reduce(
      (total, row) => total + row.missedIncomingCalls,
      0
    ),
    totalOutgoingCalls: managerRowsResult.reduce(
      (total, row) => total + row.outgoingCalls,
      0
    ),
    totalOtherOutgoingCalls: managerRowsResult.reduce(
      (total, row) => total + row.otherOutgoingCalls,
      0
    ),
    totalConnectedCalls: managerRowsResult.reduce(
      (total, row) => total + row.connectedCalls,
      0
    ),
    totalFailedCalls: managerRowsResult.reduce(
      (total, row) => total + row.failedCalls,
      0
    ),
    totalCallsOverThirtySeconds: managerRowsResult.reduce(
      (total, row) => total + row.callsOverThirtySeconds,
      0
    ),
    totalConnectedCallsOverThirtySeconds: managerRowsResult.reduce(
      (total, row) => total + row.connectedCallsOverThirtySeconds,
      0
    ),
    allCalls: toCallPopulationSummary(allCallsAccumulator),
    linkedDealCalls: {
      totalDealCount: linkedDealCallsSummary.dealCount,
      totalCalls: linkedDealCallsSummary.totalCalls,
      incomingCalls: linkedDealCallsSummary.incomingCalls,
      missedIncomingCalls: linkedDealCallsSummary.missedIncomingCalls,
      outgoingCalls: linkedDealCallsSummary.outgoingCalls,
      otherOutgoingCalls: linkedDealCallsSummary.otherOutgoingCalls,
      connectedCalls: linkedDealCallsSummary.connectedCalls,
      failedCalls: linkedDealCallsSummary.failedCalls,
      callsOverThirtySeconds: linkedDealCallsSummary.callsOverThirtySeconds,
      connectedCallsOverThirtySeconds:
        linkedDealCallsSummary.connectedCallsOverThirtySeconds,
      averageDurationSeconds: linkedDealCallsSummary.averageDurationSeconds
    },
    warnings: [],
    managerRows: managerRowsResult
  };
}

function toAverageDays(totalMilliseconds: number, count: number) {
  if (count === 0) {
    return 0;
  }

  return Number((totalMilliseconds / count / 86_400_000).toFixed(2));
}

function resolveRelativeCohortBucket(
  createdAt: string,
  closedAt: string
): CohortRelativeBucketKey | null {
  const created = new Date(createdAt);
  const closed = new Date(closedAt);

  if (
    Number.isNaN(created.getTime()) ||
    Number.isNaN(closed.getTime()) ||
    closed.getTime() < created.getTime()
  ) {
    return null;
  }

  const monthDelta =
    (closed.getUTCFullYear() - created.getUTCFullYear()) * 12 +
    (closed.getUTCMonth() - created.getUTCMonth());

  if (monthDelta <= 0) {
    return "month_1";
  }

  if (monthDelta === 1) {
    return "month_2";
  }

  if (monthDelta === 2) {
    return "month_3";
  }

  return "month_4_plus";
}

export function buildCohortConversionReport(
  input: CohortConversionInput
): CohortConversionReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const stageHistoryByDeal = buildStageHistoryMap(input.stageHistory ?? []);
  const deals = input.deals.filter((deal) => isWithinRange(deal.dateCreate, fromMs, toMs));
  const rows = new Map<
    string,
    {
      createdMonth: string;
      createdDeals: number;
      closedDeals: number;
      wonDeals: number;
      totalCloseDurationMs: number;
      totalWinDurationMs: number;
      closeDurationCount: number;
      winDurationCount: number;
      closureBuckets: Map<
        string,
        {
          closedMonth: string;
          closedDeals: number;
          wonDeals: number;
        }
      >;
      relativeClosureBuckets: Map<
        CohortRelativeBucketKey,
        {
          bucketKey: CohortRelativeBucketKey;
          label: string;
          closedDeals: number;
          wonDeals: number;
        }
      >;
    }
  >();

  for (const deal of deals) {
    const createdMonth = toMonthBucket(deal.dateCreate);
    if (!createdMonth) {
      continue;
    }

    const current = rows.get(createdMonth) ?? {
      createdMonth,
      createdDeals: 0,
      closedDeals: 0,
      wonDeals: 0,
      totalCloseDurationMs: 0,
      totalWinDurationMs: 0,
      closeDurationCount: 0,
      winDurationCount: 0,
      closureBuckets: new Map(),
      relativeClosureBuckets: new Map(
        COHORT_RELATIVE_BUCKETS.map((bucket) => [
          bucket.key,
          {
            bucketKey: bucket.key,
            label: bucket.label,
            closedDeals: 0,
            wonDeals: 0
          }
        ])
      )
    };

    current.createdDeals += 1;
    const isWonDeal = wonStageIds.has(deal.stageId);
    const closedAt = resolveTerminalClosedAt(
      deal,
      stageHistoryByDeal,
      wonStageIds
    );

    if (closedAt && isWithinRange(closedAt, fromMs, toMs)) {
      current.closedDeals += 1;
      const closeDurationMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
      if (Number.isFinite(closeDurationMs) && closeDurationMs >= 0) {
        current.totalCloseDurationMs += closeDurationMs;
        current.closeDurationCount += 1;
      }

      const closedMonth = toMonthBucket(closedAt);
      if (closedMonth) {
        const bucket = current.closureBuckets.get(closedMonth) ?? {
          closedMonth,
          closedDeals: 0,
          wonDeals: 0
        };

        bucket.closedDeals += 1;
        if (isWonDeal) {
          bucket.wonDeals += 1;
        }
        current.closureBuckets.set(closedMonth, bucket);
      }

      const relativeBucketKey = resolveRelativeCohortBucket(
        deal.dateCreate,
        closedAt
      );
      if (relativeBucketKey) {
        const bucket = current.relativeClosureBuckets.get(relativeBucketKey);
        if (bucket) {
          bucket.closedDeals += 1;
          if (isWonDeal) {
            bucket.wonDeals += 1;
          }
          current.relativeClosureBuckets.set(relativeBucketKey, bucket);
        }
      }
    }

    if (isWonDeal && closedAt && isWithinRange(closedAt, fromMs, toMs)) {
      current.wonDeals += 1;
      const winDurationMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
      if (Number.isFinite(winDurationMs) && winDurationMs >= 0) {
        current.totalWinDurationMs += winDurationMs;
        current.winDurationCount += 1;
      }
    }

    rows.set(createdMonth, current);
  }

  const closureMonths = Array.from(
    new Set(
      Array.from(rows.values()).flatMap((row) => Array.from(row.closureBuckets.keys()))
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    range: input.range,
    totalCreatedDeals: deals.length,
    totalClosedDeals: Array.from(rows.values()).reduce(
      (total, row) => total + row.closedDeals,
      0
    ),
    totalWonDeals: Array.from(rows.values()).reduce(
      (total, row) => total + row.wonDeals,
      0
    ),
    closureMonths,
    relativeBucketKeys: COHORT_RELATIVE_BUCKETS.map((bucket) => bucket.key),
    rows: Array.from(rows.values())
      .sort((left, right) => left.createdMonth.localeCompare(right.createdMonth))
      .map((row) => ({
        createdMonth: row.createdMonth,
        createdDeals: row.createdDeals,
        closedDeals: row.closedDeals,
        wonDeals: row.wonDeals,
        closedRate: toRate(row.closedDeals, row.createdDeals),
        wonConversionRate: toRate(row.wonDeals, row.createdDeals),
        averageDaysToClose: toAverageDays(
          row.totalCloseDurationMs,
          row.closeDurationCount
        ),
        averageDaysToWin: toAverageDays(
          row.totalWinDurationMs,
          row.winDurationCount
        ),
        closureBuckets: Array.from(row.closureBuckets.values())
          .sort((left, right) => left.closedMonth.localeCompare(right.closedMonth))
          .map((bucket) => ({
            closedMonth: bucket.closedMonth,
            closedDeals: bucket.closedDeals,
            wonDeals: bucket.wonDeals,
            closedRate: toRate(bucket.closedDeals, row.createdDeals),
            wonConversionRate: toRate(bucket.wonDeals, row.createdDeals)
          })),
        relativeClosureBuckets: COHORT_RELATIVE_BUCKETS.map((bucket) => {
          const current = row.relativeClosureBuckets.get(bucket.key) ?? {
            bucketKey: bucket.key,
            label: bucket.label,
            closedDeals: 0,
            wonDeals: 0
          };

          return {
            bucketKey: current.bucketKey,
            label: current.label,
            closedDeals: current.closedDeals,
            wonDeals: current.wonDeals,
            closedRate: toRate(current.closedDeals, row.createdDeals),
            wonConversionRate: toRate(current.wonDeals, row.createdDeals)
          };
        })
      }))
  };
}
