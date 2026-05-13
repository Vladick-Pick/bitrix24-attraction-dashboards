import type {
  ActivitySnapshot,
  CallSnapshot,
  DashboardData,
  DashboardInput,
  DealPricingRule,
  DealCallSummary,
  DealMeetingEvent,
  DealSnapshot,
  DealStageTimelineEntry,
  DealTaskSummary,
  ManagerDirectoryEntry,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  resolveDealEconomics
} from "./deal-economics.js";
import { buildSourceLabelMap, resolveDealSource } from "./report-dimensions.js";

const UNKNOWN_MANAGER_ID = "unassigned";
const UNKNOWN_MANAGER_NAME = "Без ответственного";
const MISSING_STAGE_LABEL = "Этап недоступен";

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

function toAmount(value: number | null) {
  return value ?? 0;
}

function resolveDashboardDealEconomics(
  deal: DealSnapshot,
  pricingRules: DealPricingRule[] | undefined
) {
  if (!pricingRules) {
    const membershipAmount = toNumber(deal.opportunity);
    return {
      membershipAmount,
      attractionRevenueAmount: membershipAmount,
      pricingStatus: "priced" as const,
      pricingWarnings: []
    };
  }

  return resolveDealEconomics({
    deal,
    context: "finalWon",
    pricingRules
  });
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function hoursBetween(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return 0;
  }

  return Math.max(0, Math.round((rightMs - leftMs) / 3_600_000));
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

function daysBetween(left: string, right: string) {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) {
    return 0;
  }

  return round(Math.max(0, rightMs - leftMs) / 86_400_000);
}

function sanitizeTargetGroupValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return /^\d+$/.test(trimmed) || trimmed === "Неизвестная таргет-группа"
    ? null
    : trimmed;
}

function getClosedAt(deal: DealSnapshot) {
  return deal.dateClosed ?? deal.dateModify;
}

function groupStageHistoryByDeal(stageHistory: StageHistorySnapshot[]) {
  const rows = new Map<string, StageHistorySnapshot[]>();

  for (const entry of stageHistory) {
    const current = rows.get(entry.ownerId) ?? [];
    current.push(entry);
    rows.set(entry.ownerId, current);
  }

  for (const [ownerId, ownerRows] of rows) {
    rows.set(
      ownerId,
      ownerRows.sort((left, right) => left.createdTime.localeCompare(right.createdTime))
    );
  }

  return rows;
}

function resolveWonAt(input: {
  deal: DealSnapshot;
  stageHistoryRows: StageHistorySnapshot[];
  wonStageIds: Set<string>;
}) {
  const { deal, stageHistoryRows, wonStageIds } = input;
  const wonHistoryRows = stageHistoryRows.filter((row) => wonStageIds.has(row.stageId));
  const latestWonRow = wonHistoryRows.at(-1);

  return latestWonRow?.createdTime ?? getClosedAt(deal);
}

function resolveManager(
  deal: DealSnapshot,
  managerDirectory: Map<string, ManagerDirectoryEntry>
) {
  const managerId = deal.assignedById ?? UNKNOWN_MANAGER_ID;
  return {
    managerId,
    managerName:
      managerDirectory.get(managerId)?.name ??
      (managerId === UNKNOWN_MANAGER_ID ? UNKNOWN_MANAGER_NAME : managerId)
  };
}

function buildStageNameMap(stageCatalog: StageCatalogEntry[]) {
  return new Map(
    stageCatalog
      .filter((entry) => entry.entityType === "deal")
      .map((entry) => [entry.statusId, entry.name])
  );
}

function buildCohortLookup(deals: DealSnapshot[], wonStageIds: Set<string>) {
  const cohorts = new Map<
    string,
    { cohortCreatedDeals: number; cohortWonDeals: number }
  >();

  for (const deal of deals) {
    const key = monthKey(deal.dateCreate);
    const current = cohorts.get(key) ?? {
      cohortCreatedDeals: 0,
      cohortWonDeals: 0
    };

    current.cohortCreatedDeals += 1;
    if (wonStageIds.has(deal.stageId)) {
      current.cohortWonDeals += 1;
    }

    cohorts.set(key, current);
  }

  return cohorts;
}

function isCallActivity(activity: ActivitySnapshot) {
  return activity.typeId === "2" || activity.providerId === "VOXIMPLANT_CALL";
}

function isMeetingActivity(activity: ActivitySnapshot) {
  return activity.typeId === "1" || activity.providerId === "CRM_MEETING";
}

function buildTaskSummary(activities: ActivitySnapshot[]): DealTaskSummary {
  const dealTasks = activities.filter(
    (activity) => !isCallActivity(activity) && !isMeetingActivity(activity)
  );

  return {
    created: dealTasks.length,
    closed: dealTasks.filter((activity) => activity.completed).length
  };
}

function buildMeetingSummary(activities: ActivitySnapshot[]) {
  const meetings = activities.filter(isMeetingActivity);

  return {
    total: meetings.length
  };
}

function buildMeetingEvents(activities: ActivitySnapshot[]): DealMeetingEvent[] {
  return activities
    .filter(isMeetingActivity)
    .map((activity) => ({
      activityId: activity.id,
      createdAt: activity.createdTime,
      timelineAt:
        activity.completedTime ?? activity.lastUpdated ?? activity.createdTime,
      scheduledAt: activity.deadline ?? activity.createdTime,
      completed: activity.completed
    }))
    .sort((left, right) => left.timelineAt.localeCompare(right.timelineAt));
}

function isIncomingCall(call: CallSnapshot) {
  return call.callType === "2";
}

function isSuccessfulCall(call: CallSnapshot) {
  return (
    call.callDurationSeconds > 0 &&
    (call.callFailedCode === null ||
      call.callFailedCode.trim() === "" ||
      call.callFailedCode === "200")
  );
}

function buildCallSummary(calls: CallSnapshot[]): DealCallSummary {
  const successful = calls.filter(isSuccessfulCall);

  return {
    total: calls.length,
    incoming: calls.filter(isIncomingCall).length,
    outgoing: calls.filter((call) => !isIncomingCall(call)).length,
    successful: successful.length,
    failed: calls.length - successful.length,
    overThirtySeconds: calls.filter((call) => call.callDurationSeconds > 30).length,
    connectedOverThirtySeconds: successful.filter(
      (call) => call.callDurationSeconds > 30
    ).length
  };
}

function emptyCallSummary(): DealCallSummary {
  return buildCallSummary([]);
}

function emptyTaskSummary(): DealTaskSummary {
  return {
    created: 0,
    closed: 0
  };
}

function resolveStageName(stageId: string, stageNames: Map<string, string>) {
  const stageName = stageNames.get(stageId);
  return stageName && stageName.trim().length > 0 ? stageName : MISSING_STAGE_LABEL;
}

function isWithinStageInterval(
  value: string | null | undefined,
  stage: DealStageTimelineEntry,
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

function buildStageTimeline(input: {
  deal: DealSnapshot;
  stageHistoryRows: StageHistorySnapshot[];
  stageNames: Map<string, string>;
  terminalAt: string;
}): DealStageTimelineEntry[] {
  const { deal, stageNames, terminalAt } = input;
  const rows = input.stageHistoryRows;

  if (rows.length === 0) {
    return [
      {
        stageId: deal.stageId,
        stageName: resolveStageName(deal.stageId, stageNames),
        enteredAt: deal.dateCreate,
        leftAt: terminalAt,
        durationHours: hoursBetween(deal.dateCreate, terminalAt),
        callSummary: emptyCallSummary(),
        taskSummary: emptyTaskSummary()
      }
    ];
  }

  return rows.map((row, index) => {
    const next = rows[index + 1];
    const leftAt = next?.createdTime ?? terminalAt;

    return {
      stageId: row.stageId,
      stageName: resolveStageName(row.stageId, stageNames),
      enteredAt: row.createdTime,
      leftAt,
      durationHours: hoursBetween(row.createdTime, leftAt),
      callSummary: emptyCallSummary(),
      taskSummary: emptyTaskSummary()
    };
  });
}

function attachInteractionSummariesToStageTimeline(input: {
  stageTimeline: DealStageTimelineEntry[];
  calls: CallSnapshot[];
  activities: ActivitySnapshot[];
}) {
  const dealTasks = input.activities.filter(
    (activity) => !isCallActivity(activity) && !isMeetingActivity(activity)
  );

  return input.stageTimeline.map((stage, index) => ({
    ...stage,
    callSummary: buildCallSummary(
      input.calls.filter((call) =>
        isWithinStageInterval(call.callStartDate, stage, index, input.stageTimeline.length)
      )
    ),
    taskSummary: {
      created: dealTasks.filter((activity) =>
        isWithinStageInterval(
          activity.createdTime,
          stage,
          index,
          input.stageTimeline.length
        )
      ).length,
      closed: dealTasks.filter(
        (activity) =>
          activity.completed &&
          isWithinStageInterval(
            activity.completedTime,
            stage,
            index,
            input.stageTimeline.length
          )
      ).length
    }
  }));
}

function attachMeetingEventsToStageTimeline(
  stageTimeline: DealStageTimelineEntry[],
  meetingEvents: DealMeetingEvent[]
) {
  if (stageTimeline.length === 0) {
    return stageTimeline;
  }

  const nextTimeline = stageTimeline.map((stage) => ({
    ...stage,
    meetingEvents: [] as DealMeetingEvent[]
  }));

  for (const meetingEvent of meetingEvents) {
    const eventTime = toTimestamp(meetingEvent.timelineAt);
    let matchedIndex = -1;

    for (let index = 0; index < nextTimeline.length; index += 1) {
      const stage = nextTimeline[index];
      if (!stage) {
        continue;
      }
      const stageStart = toTimestamp(stage.enteredAt);
      const stageEnd = toTimestamp(stage.leftAt);
      const isLast = index === nextTimeline.length - 1;

      if (
        Number.isFinite(eventTime) &&
        Number.isFinite(stageStart) &&
        Number.isFinite(stageEnd) &&
        eventTime >= stageStart &&
        (isLast ? eventTime <= stageEnd : eventTime < stageEnd)
      ) {
        matchedIndex = index;
        break;
      }
    }

    if (matchedIndex === -1 && Number.isFinite(eventTime)) {
      for (let index = nextTimeline.length - 1; index >= 0; index -= 1) {
        if (eventTime >= toTimestamp(nextTimeline[index]?.enteredAt)) {
          matchedIndex = index;
          break;
        }
      }
    }

    const safeIndex = matchedIndex === -1 ? 0 : matchedIndex;
    nextTimeline[safeIndex]?.meetingEvents?.push(meetingEvent);
  }

  return nextTimeline;
}

function groupActivitiesByDeal(activities: ActivitySnapshot[]) {
  const rows = new Map<string, ActivitySnapshot[]>();

  for (const activity of activities) {
    const current = rows.get(activity.ownerId) ?? [];
    current.push(activity);
    rows.set(activity.ownerId, current);
  }

  return rows;
}

function groupCallsByDeal(input: {
  calls: CallSnapshot[];
  activitiesById: Map<string, ActivitySnapshot>;
}) {
  const rows = new Map<string, CallSnapshot[]>();

  for (const call of input.calls) {
    const activity = call.crmActivityId
      ? input.activitiesById.get(call.crmActivityId)
      : null;
    const dealId =
      activity?.ownerId ??
      (call.crmEntityType === "DEAL" ? call.crmEntityId ?? null : null);

    if (!dealId) {
      continue;
    }

    const current = rows.get(dealId) ?? [];
    current.push(call);
    rows.set(dealId, current);
  }

  return rows;
}

export function buildDashboard(input: DashboardInput): DashboardData {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const wonStageIds = new Set(input.wonStageIds);
  const stageNames = buildStageNameMap(input.stageCatalog);
  const sourceLabels = buildSourceLabelMap(input.stageCatalog);
  const stageHistoryByDeal = groupStageHistoryByDeal(input.stageHistory);
  const managerDirectory = new Map(input.managerDirectory.map((row) => [row.id, row]));
  const activitiesByDeal = groupActivitiesByDeal(input.activities);
  const activitiesById = new Map(input.activities.map((activity) => [activity.id, activity]));
  const callsByDeal = groupCallsByDeal({
    calls: input.calls,
    activitiesById
  });
  const cohorts = buildCohortLookup(input.deals, wonStageIds);
  const wonAtByDeal = new Map(
    input.deals.map((deal) => [
      deal.id,
      resolveWonAt({
        deal,
        stageHistoryRows: stageHistoryByDeal.get(deal.id) ?? [],
        wonStageIds
      })
    ])
  );
  const pricingRules = input.pricingRules;

  const wonDeals = input.deals
    .filter(
      (deal) =>
        wonStageIds.has(deal.stageId) &&
        isWithinRange(wonAtByDeal.get(deal.id) ?? null, fromMs, toMs)
    )
    .sort((left, right) => {
      const byClosedAt = (wonAtByDeal.get(right.id) ?? getClosedAt(right)).localeCompare(
        wonAtByDeal.get(left.id) ?? getClosedAt(left)
      );
      if (byClosedAt !== 0) {
        return byClosedAt;
      }

      return toNumber(right.opportunity) - toNumber(left.opportunity);
    });

  const periodCreatedDeals = input.deals.filter((deal) =>
    isWithinRange(deal.dateCreate, fromMs, toMs)
  );
  const periodCreatedWonDeals = periodCreatedDeals.filter((deal) =>
    wonStageIds.has(deal.stageId)
  );
  const dealEconomics = new Map(
    wonDeals.map((deal) => [
      deal.id,
      resolveDashboardDealEconomics(deal, pricingRules)
    ])
  );
  const salesAmount = wonDeals.reduce((total, deal) => {
    const economics = dealEconomics.get(deal.id);
    return total + toAmount(economics?.attractionRevenueAmount ?? null);
  }, 0);
  const membershipAmount = wonDeals.reduce((total, deal) => {
    const economics = dealEconomics.get(deal.id);
    return total + (economics?.membershipAmount ?? toNumber(deal.opportunity));
  }, 0);
  const pricingWarnings = wonDeals.flatMap(
    (deal) => dealEconomics.get(deal.id)?.pricingWarnings ?? []
  );
  const meetingsCount = wonDeals.reduce((total, deal) => {
    const activities = activitiesByDeal.get(deal.id) ?? [];
    return total + buildMeetingSummary(activities).total;
  }, 0);

  const groups = new Map<
    string,
    {
      managerId: string;
      managerName: string;
      totalWonDeals: number;
      totalSalesAmount: number;
      totalAttractionRevenueAmount: number;
      totalMembershipAmount: number;
      deals: DashboardData["managerGroups"][number]["deals"];
    }
  >();

  for (const deal of wonDeals) {
    const { managerId, managerName } = resolveManager(deal, managerDirectory);
    const createdMonth = monthKey(deal.dateCreate);
    const cohort = cohorts.get(createdMonth) ?? {
      cohortCreatedDeals: 0,
      cohortWonDeals: 0
    };
    const group = groups.get(managerId) ?? {
      managerId,
      managerName,
      totalWonDeals: 0,
      totalSalesAmount: 0,
      totalAttractionRevenueAmount: 0,
      totalMembershipAmount: 0,
      deals: []
    };
    const economics =
      dealEconomics.get(deal.id) ??
      resolveDashboardDealEconomics(deal, pricingRules);
    const amount = toAmount(economics.attractionRevenueAmount);
    const wonAt = wonAtByDeal.get(deal.id) ?? getClosedAt(deal);
    const stageHistoryRows = stageHistoryByDeal.get(deal.id) ?? [];
    const source = resolveDealSource(deal, sourceLabels);
    const activities = activitiesByDeal.get(deal.id) ?? [];
    const calls = callsByDeal.get(deal.id) ?? [];
    const meetingEvents = buildMeetingEvents(activities);
    const stageTimeline = attachMeetingEventsToStageTimeline(
      attachInteractionSummariesToStageTimeline({
        stageTimeline: buildStageTimeline({
          deal,
          stageHistoryRows,
          stageNames,
          terminalAt: wonAt
        }),
        calls,
        activities
      }),
      meetingEvents
    );

    group.totalWonDeals += 1;
    group.totalSalesAmount += amount;
    group.totalAttractionRevenueAmount += amount;
    group.totalMembershipAmount += economics.membershipAmount;
    group.deals.push({
      dealId: deal.id,
      dealTitle: deal.id,
      managerId,
      managerName,
      amount,
      attractionRevenueAmount: economics.attractionRevenueAmount,
      membershipAmount: economics.membershipAmount,
      pricingStatus: economics.pricingStatus,
      pricingWarnings: economics.pricingWarnings,
      dateCreate: deal.dateCreate,
      dateClosed: wonAt,
      cycleDays: daysBetween(deal.dateCreate, wonAt),
      sourceKey: source.key,
      sourceLabel: source.label,
      qualityValue: deal.qualityValue,
      businessClubValue: deal.businessClubValue ?? null,
      targetGroupValue: sanitizeTargetGroupValue(deal.targetGroupValue),
      meetingTypeValue: deal.meetingTypeValue ?? null,
      meetingDateValue: deal.meetingDateValue ?? null,
      tariffValue: deal.tariffValue ?? null,
      cohortContext: {
        createdMonth,
        cohortCreatedDeals: cohort.cohortCreatedDeals,
        cohortWonDeals: cohort.cohortWonDeals,
        cohortWonConversionRate:
          cohort.cohortCreatedDeals === 0
            ? 0
            : round((cohort.cohortWonDeals / cohort.cohortCreatedDeals) * 100)
      },
      callSummary: buildCallSummary(calls),
      taskSummary: buildTaskSummary(activities),
      meetingSummary: buildMeetingSummary(activities),
      stageTimeline
    });

    groups.set(managerId, group);
  }

  return {
    salesSummary: {
      salesCount: wonDeals.length,
      salesAmount,
      averageSaleAmount: wonDeals.length === 0 ? 0 : salesAmount / wonDeals.length,
      attractionRevenueAmount: salesAmount,
      averageAttractionRevenueAmount:
        wonDeals.length === 0 ? 0 : salesAmount / wonDeals.length,
      membershipAmount,
      averageMembershipAmount:
        wonDeals.length === 0 ? 0 : membershipAmount / wonDeals.length,
      pricingWarnings,
      newDealsCount: periodCreatedDeals.length,
      conversionRate:
        periodCreatedDeals.length === 0
          ? 0
          : round((periodCreatedWonDeals.length / periodCreatedDeals.length) * 100),
      meetingsCount
    },
    managerGroups: Array.from(groups.values())
      .map((group) => ({
        ...group,
        averageAttractionRevenueAmount:
          group.totalWonDeals === 0
            ? 0
            : group.totalAttractionRevenueAmount / group.totalWonDeals,
        averageMembershipAmount:
          group.totalWonDeals === 0
            ? 0
            : group.totalMembershipAmount / group.totalWonDeals
      }))
      .sort((left, right) => {
        if (right.totalSalesAmount !== left.totalSalesAmount) {
          return right.totalSalesAmount - left.totalSalesAmount;
        }

        return left.managerName.localeCompare(right.managerName, "ru");
      })
  };
}
