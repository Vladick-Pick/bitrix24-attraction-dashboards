import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomeBusinessClubByManagerRow,
  ActivitiesWorkloadReport,
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallsWorkloadReport,
  CallSnapshot,
  CohortRelativeBucketKey,
  CohortConversionReport,
  DealSnapshot,
  LostDealDetailRow,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeRow,
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
  buildManagerDirectoryMap,
  buildSourceLabelMap,
  normalizeCategoryId,
  resolveDealSource,
  resolveManagerName,
  toMonthBucket
} from "./report-dimensions";

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
  managerDirectory?: ManagerDirectoryEntry[];
}

interface ActivitiesWorkloadInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  deadlineChanges: ActivityDeadlineChangeSnapshot[];
  calls?: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

interface CallsWorkloadInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
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
}

interface ManagerActionOutcomeInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

interface StageDefinition {
  stageId: string;
  stageName: string;
  sortOrder: number;
}

function isWithinRange(value: string | null, fromMs: number, toMs: number) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
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

const SLA_THRESHOLDS_HOURS = {
  sla1: 2,
  sla2: 48,
  sla3: 24
} as const;

const UNSPECIFIED_MEETING_TYPE = "UNSPECIFIED";
const UNSPECIFIED_MEETING_TYPE_LABEL = "Без типа встречи";
const UNSPECIFIED_BUSINESS_CLUB = "UNSPECIFIED";
const UNSPECIFIED_BUSINESS_CLUB_LABEL = "Без business club";
const UNSPECIFIED_TARGET_GROUP = "UNSPECIFIED";
const UNSPECIFIED_TARGET_GROUP_LABEL = "Без таргет-группы";

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
  return value && value.length > 0 ? value : UNSPECIFIED_TARGET_GROUP;
}

function resolveTargetGroupLabel(value: string) {
  return value === UNSPECIFIED_TARGET_GROUP
    ? UNSPECIFIED_TARGET_GROUP_LABEL
    : value;
}

function isCallActivity(activity: ActivitySnapshot) {
  return activity.typeId === "2" || activity.providerId === "VOXIMPLANT_CALL";
}

function isMeetingActivity(activity: ActivitySnapshot) {
  return activity.typeId === "1" || activity.providerId === "CRM_MEETING";
}

function isTaskActivity(activity: ActivitySnapshot) {
  return !isCallActivity(activity) && !isMeetingActivity(activity);
}

function isCompletedMeetingActivity(activity: ActivitySnapshot) {
  return isMeetingActivity(activity) && activity.completed;
}

function getMeetingCommunicationTime(activity: ActivitySnapshot) {
  return activity.completedTime ?? activity.lastUpdated ?? activity.createdTime;
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

function normalizeStageName(name: string | undefined) {
  return (name ?? "").trim().toLocaleLowerCase("ru");
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

function evaluateTimedSla(
  durationHours: number | null,
  maxHours: number
): SlaOutcome {
  if (durationHours === null) {
    return "noTouch";
  }

  return durationHours <= maxHours ? "onTime" : "late";
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

function buildSlaMetricsByManager(input: {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  calls: CallSnapshot[];
}) {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const stageLookup = buildStageLookup(input.stageCatalog);
  const dealMap = new Map(input.deals.map((deal) => [deal.id, deal]));
  const stageHistoryMap = buildStageHistoryMap(
    input.stageHistory.filter((row) => dealMap.has(row.ownerId))
  );
  const meetingsByDeal = buildCompletedMeetingsByDeal(input.activities, dealMap);
  const callsByDeal = buildCallsByDeal(input.calls, input.activities, dealMap);
  const rows = new Map<string, SlaAccumulatorSet>();

  for (const deal of input.deals) {
    if (!isWithinRange(deal.dateCreate, fromMs, toMs)) {
      continue;
    }

    const managerId = deal.assignedById ?? "UNASSIGNED";
    const accumulatorSet = rows.get(managerId) ?? createSlaAccumulatorSet();
    const historyRows = stageHistoryMap.get(deal.id) ?? [];
    const introEntry = findFirstMatchingStageEntry(historyRows, (row) =>
      isIntroCallStage(row.stageId, stageLookup.get(row.stageId)?.stageName)
    );

    const introEnteredAt = introEntry?.row.createdTime ?? null;
    const baseEnteredAt =
      historyRows
        .slice(0, introEntry?.index ?? 0)
        .find((row) =>
          isInboundBaseStage(row.stageId, stageLookup.get(row.stageId)?.stageName)
        )?.createdTime ?? deal.dateCreate;
    const sla1Duration = toDurationHours(baseEnteredAt, introEnteredAt);
    recordSlaOutcome(
      accumulatorSet.sla1,
      evaluateTimedSla(sla1Duration, SLA_THRESHOLDS_HOURS.sla1),
      sla1Duration
    );

    const firstCommunicationAt = [
      ...(callsByDeal.get(deal.id) ?? []).map((call) => call.callStartDate),
      ...(meetingsByDeal.get(deal.id) ?? []).map((meeting) =>
        getMeetingCommunicationTime(meeting)
      )
    ]
      .filter((value) => {
        const timestamp = Date.parse(value);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= Date.parse(deal.dateCreate) &&
          timestamp <= toMs
        );
      })
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null;
    const sla2Duration = toDurationHours(deal.dateCreate, firstCommunicationAt);
    recordSlaOutcome(
      accumulatorSet.sla2,
      evaluateTimedSla(sla2Duration, SLA_THRESHOLDS_HOURS.sla2),
      sla2Duration
    );

    if (introEntry) {
      const nextStageEntry = historyRows[introEntry.index + 1];
      const introExitedAt =
        nextStageEntry?.createdTime ??
        (deal.stageId === introEntry.row.stageId ? null : deal.dateClosed ?? deal.dateModify);
      const introCalls = (callsByDeal.get(deal.id) ?? []).filter((call) => {
        const callTime = Date.parse(call.callStartDate);
        const enteredTime = Date.parse(introEntry.row.createdTime);
        const exitedTime = introExitedAt ? Date.parse(introExitedAt) : Number.POSITIVE_INFINITY;

        return (
          Number.isFinite(callTime) &&
          Number.isFinite(enteredTime) &&
          callTime >= enteredTime &&
          callTime < exitedTime
        );
      });
      const secondCallAt = introCalls[1]?.callStartDate ?? null;
      const sla3Duration = toDurationHours(introEntry.row.createdTime, secondCallAt);
      const sla3Outcome =
        secondCallAt !== null
          ? evaluateTimedSla(sla3Duration, SLA_THRESHOLDS_HOURS.sla3)
          : introExitedAt
            ? "late"
            : "noTouch";

      recordSlaOutcome(accumulatorSet.sla3, sla3Outcome, sla3Duration);
    }

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
          const stages = new Set(
            (stageHistoryMap.get(deal.id) ?? []).map((entry) => entry.stageId)
          );
          stages.add(deal.stageId);
          return stages.has(stage.stageId);
        });
        const durations = reachedDeals.flatMap((deal) =>
          resolveDurationMetrics(deal.id, stage.stageId, stageHistoryMap)
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
            isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
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
        isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
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
      isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
  );

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
    }
  >();
  for (const deal of new Map(
    [...newDeals, ...lostDeals].map((deal) => [deal.id, deal])
  ).values()) {
    const managerId = deal.assignedById ?? "UNASSIGNED";
    const businessClubKey = resolveBusinessClubValue(deal);
    const current = businessClubRows.get(managerId) ?? {
      managerId,
      managerName: resolveManagerName(managerId, managerDirectory),
      dealIds: new Set<string>(),
      businessClubs: new Map<string, number>()
    };

    current.dealIds.add(deal.id);
    current.businessClubs.set(
      businessClubKey,
      (current.businessClubs.get(businessClubKey) ?? 0) + 1
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

function buildStageLookup(stageCatalog: StageCatalogEntry[]) {
  return new Map(
    stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [
        entry.statusId,
        {
          stageName: entry.name,
          sortOrder: entry.sortOrder ?? 0
        }
      ])
  );
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
  const meetingActivities = activities.filter(isMeetingActivity);
  const slaMetricsByManager = buildSlaMetricsByManager({
    range: input.range,
    deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities,
    calls: input.calls ?? []
  });
  const managerRows = new Map<
    string,
    {
      managerId: string;
      dealIds: Set<string>;
      createdCount: number;
      rescheduledCount: number;
      closedCount: number;
      meetingCount: number;
      meetingTypeCounts: Map<string, number>;
      businessClubDealIds: Map<string, Set<string>>;
      stageItems: Array<{
        dealId: string;
        stageId: string;
        metric: "created" | "rescheduled" | "closed";
      }>;
    }
  >();

  for (const manager of input.managerDirectory ?? []) {
    managerRows.set(manager.id, {
        managerId: manager.id,
        dealIds: new Set<string>(),
        createdCount: 0,
        rescheduledCount: 0,
        closedCount: 0,
        meetingCount: 0,
        meetingTypeCounts: new Map<string, number>(),
        businessClubDealIds: new Map<string, Set<string>>(),
        stageItems: []
      });
  }

  const ensureManagerRow = (managerId: string) => {
    const current = managerRows.get(managerId) ?? {
      managerId,
      dealIds: new Set<string>(),
      createdCount: 0,
      rescheduledCount: 0,
      closedCount: 0,
      meetingCount: 0,
      meetingTypeCounts: new Map<string, number>(),
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

  for (const activity of meetingActivities) {
    if (!isWithinRange(activity.createdTime, fromMs, toMs)) {
      continue;
    }

    const deal = dealMap.get(activity.ownerId);
    if (!deal) {
      continue;
    }

    const managerId = activity.responsibleId ?? "UNASSIGNED";
    const current = ensureManagerRow(managerId);
    registerDealForManager(managerId, deal);
    current.meetingCount += 1;
    const meetingTypeKey = resolveMeetingTypeValue(deal);
    current.meetingTypeCounts.set(
      meetingTypeKey,
      (current.meetingTypeCounts.get(meetingTypeKey) ?? 0) + 1
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
  const scopedDeals = input.deals.filter(
    (deal) =>
      allowedCategoryIds.has(normalizeCategoryId(deal.categoryId)) &&
      isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const rows = new Map<
    string,
    {
      targetGroupKey: string;
      targetGroupLabel: string;
      createdDeals: number;
      wonDeals: number;
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
      salesAmount: 0,
      totalCycleMs: 0,
      cycleCount: 0
    };

    current.createdDeals += 1;

    if (
      wonStageIds.has(deal.stageId) &&
      isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
    ) {
      current.wonDeals += 1;
      current.salesAmount += deal.opportunity ?? 0;

      const closedAt = deal.dateClosed ?? deal.dateModify;
      const cycleMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
      if (Number.isFinite(cycleMs) && cycleMs >= 0) {
        current.totalCycleMs += cycleMs;
        current.cycleCount += 1;
      }
    }

    rows.set(targetGroupKey, current);
  }

  return {
    range: input.range,
    totalCreatedDeals: scopedDeals.length,
    totalWonDeals: scopedDeals.filter(
      (deal) =>
        wonStageIds.has(deal.stageId) &&
        isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
    ).length,
    rows: Array.from(rows.values())
      .map((row) => ({
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel,
        createdDeals: row.createdDeals,
        wonDeals: row.wonDeals,
        winRate:
          row.createdDeals === 0 ? 0 : Number((row.wonDeals / row.createdDeals).toFixed(4)),
        salesAmount: row.salesAmount,
        averageSaleAmount: toAverage(row.salesAmount, row.wonDeals),
        averageCycleDays: toAverageDays(row.totalCycleMs, row.cycleCount)
      }))
      .sort((left, right) => {
        if (right.createdDeals !== left.createdDeals) {
          return right.createdDeals - left.createdDeals;
        }

        return left.targetGroupLabel.localeCompare(right.targetGroupLabel, "ru");
      })
  };
}

export function buildManagerActionOutcomeReport(
  input: ManagerActionOutcomeInput
): ManagerActionOutcomeReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const allowedCategoryIds = getAllowedCategoryIds(input.stageCatalog);
  const deals = input.deals.filter((deal) =>
    allowedCategoryIds.has(normalizeCategoryId(deal.categoryId))
  );
  const dealMap = new Map(deals.map((deal) => [deal.id, deal]));
  const managerDirectory = buildManagerDirectoryMap(input.managerDirectory ?? []);
  const activities = input.activities.filter(
    (activity) => activity.ownerTypeId === "2" && dealMap.has(activity.ownerId)
  );
  const taskActivities = activities.filter(isTaskActivity);
  const meetingActivities = activities.filter(isMeetingActivity);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const slaMetricsByManager = buildSlaMetricsByManager({
    range: input.range,
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
    ensureRow(managerId).meetingsCount += 1;
  }

  for (const call of input.calls) {
    if (!isWithinRange(call.callStartDate, fromMs, toMs)) {
      continue;
    }

    const activityManagerId =
      call.crmActivityId ? activityById.get(call.crmActivityId)?.responsibleId : null;
    const managerId = call.portalUserId ?? activityManagerId ?? "UNASSIGNED";
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
      isWithinRange(deal.dateClosed ?? deal.dateModify, fromMs, toMs)
    ) {
      row.wonDealsCount += 1;
      row.salesAmount += deal.opportunity ?? 0;

      const closedAt = deal.dateClosed ?? deal.dateModify;
      const cycleMs = Date.parse(closedAt) - Date.parse(deal.dateCreate);
      if (Number.isFinite(cycleMs) && cycleMs >= 0) {
        row.totalCycleMs += cycleMs;
        row.cycleCount += 1;
      }
    }
  }

  const managerIds = Array.from(
    new Set([
      ...rows.keys(),
      ...slaMetricsByManager.keys(),
      ...deals.map((deal) => deal.assignedById ?? "UNASSIGNED"),
      ...taskActivities.map((activity) => activity.responsibleId ?? "UNASSIGNED"),
      ...meetingActivities.map((activity) => activity.responsibleId ?? "UNASSIGNED"),
      ...input.calls.map((call) => call.portalUserId ?? "UNASSIGNED")
    ])
  );

  return {
    range: input.range,
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
    if (item.direction === "incoming") {
      current.incomingCalls += 1;
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
          activity.providerId === "VOXIMPLANT_CALL" &&
          dealMap.has(activity.ownerId)
      )
      .map((activity) => [activity.id, activity])
  );

  type CallAccumulator = {
    managerId: string;
    dealIds: Set<string>;
    totalCalls: number;
    incomingCalls: number;
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
    if (direction === "incoming") {
      accumulator.incomingCalls += 1;
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

  const summaryRows = new Map<string, CallAccumulator>();
  const linkedRows = new Map<string, CallAccumulator>();

  for (const call of input.calls) {
    if (!isWithinRange(call.callStartDate, fromMs, toMs)) {
      continue;
    }

    const activity = call.crmActivityId ? activityMap.get(call.crmActivityId) : null;
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

    const dealId =
      activity?.ownerId ??
      (call.crmEntityType === "DEAL" && call.crmEntityId
        ? call.crmEntityId
        : null);
    if (!dealId) {
      continue;
    }

    const deal = dealMap.get(dealId);
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

      return {
        managerId,
        managerName: resolveManagerName(managerId, managerDirectory),
        dealCount: linked.dealIds.size,
        totalCalls: summary.totalCalls,
        incomingCalls: summary.incomingCalls,
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
        stageBreakdown: buildCallsStageBreakdown(linked.stageItems, stageLookup)
      };
    })
    .sort((left, right) => left.managerId.localeCompare(right.managerId));

  const totalDealIds = new Set<string>();
  for (const row of linkedRows.values()) {
    for (const dealId of row.dealIds) {
      totalDealIds.add(dealId);
    }
  }

  return {
    range: input.range,
    totalDealCount: totalDealIds.size,
    totalCalls: managerRowsResult.reduce((total, row) => total + row.totalCalls, 0),
    totalIncomingCalls: managerRowsResult.reduce(
      (total, row) => total + row.incomingCalls,
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

function resolveCohortClosedAt(
  deal: DealSnapshot,
  stageHistoryByDeal: Map<string, StageHistorySnapshot[]>,
  wonStageIds: Set<string>
) {
  if (!wonStageIds.has(deal.stageId)) {
    return deal.dateClosed;
  }

  const wonRows = (stageHistoryByDeal.get(deal.id) ?? []).filter((row) =>
    wonStageIds.has(row.stageId)
  );

  return wonRows.at(-1)?.createdTime ?? deal.dateClosed;
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
    const closedAt = resolveCohortClosedAt(
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
