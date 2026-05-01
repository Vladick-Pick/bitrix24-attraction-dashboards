import type {
  ConversionEventBreakdownRow,
  ConversionEventsReport,
  ConversionEventStatus,
  ConversionEventVisitSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  UNASSIGNED_MANAGER_ID,
  UNASSIGNED_MANAGER_NAME,
  UNATTRIBUTED_SOURCE_KEY,
  UNATTRIBUTED_SOURCE_LABEL
} from "./report-dimensions.js";

export function resolveConversionEventName(
  explicitName: string | null | undefined,
  rawTitle: string | null | undefined
) {
  const explicit = explicitName?.trim();
  if (explicit) {
    return explicit;
  }

  const title = rawTitle?.trim() ?? "";
  const titleMatch = /^Посещение\s+.+?\s+в\s+(.+)$/iu.exec(title);
  return titleMatch?.[1]?.trim() || title || "Без названия";
}

export function parseConversionEventDate(
  eventName: string,
  reportYear: number
) {
  const match = /(^|\D)(\d{1,2})\.(\d{1,2})(?:\.|\D|$)/u.exec(eventName);
  if (!match?.[2] || !match[3]) {
    return null;
  }

  const day = Number(match[2]);
  const month = Number(match[3]);
  if (!Number.isInteger(day) || !Number.isInteger(month)) {
    return null;
  }

  const date = new Date(Date.UTC(reportYear, month - 1, day));
  if (
    date.getUTCFullYear() !== reportYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е");
}

export function resolveConversionEventStatus(
  stageName: string | null | undefined
): ConversionEventStatus {
  const label = normalizeLabel(stageName);

  if (label.includes("посетил") || label.includes("на мероприятии")) {
    return "attended";
  }

  if (label.includes("отказ")) {
    return "refused";
  }

  if (label.includes("приглаш")) {
    return "invited";
  }

  return "unknown";
}

interface ConversionEventsReportInput {
  range: ReportRange;
  visits: ConversionEventVisitSnapshot[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  managerDirectory: ManagerDirectoryEntry[];
  sourceLabels: Map<string, string>;
}

interface StageContext {
  stageName: string;
  semanticId: string | null;
  sortOrder: number | null;
}

interface GroupAccumulator {
  eventKey: string;
  eventName: string;
  eventDate: string;
  invitedCount: number;
  attendedCount: number;
  refusedCount: number;
  nextStepEligibleCount: number;
  nextStepCount: number;
  unlinkedCount: number;
  unknownStatusCount: number;
  managerCounts: Map<string, { label: string; count: number }>;
  sourceCounts: Map<string, { label: string; count: number }>;
  businessClubCounts: Map<string, { label: string; count: number }>;
}

function roundPercent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null;
}

function buildEventKey(eventName: string, eventDate: string) {
  return `${eventDate.slice(0, 10)}::${eventName}`;
}

function incrementBreakdown(
  rows: Map<string, { label: string; count: number }>,
  key: string,
  label: string
) {
  const current = rows.get(key) ?? { label, count: 0 };
  current.count += 1;
  rows.set(key, current);
}

function toBreakdownRows(
  rows: Map<string, { label: string; count: number }>
): ConversionEventBreakdownRow[] {
  return Array.from(rows.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "ru");
    });
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
          sortOrder: stage.sortOrder ?? null
        } satisfies StageContext
      ])
  );
}

function normalizeEventMatchValue(value: string | null | undefined) {
  return normalizeLabel(value).replace(/\s+/g, " ");
}

function buildDealsByContactId(deals: DealSnapshot[]) {
  const dealsByContactId = new Map<string, DealSnapshot[]>();
  for (const deal of deals) {
    if (!deal.contactId) {
      continue;
    }

    const current = dealsByContactId.get(deal.contactId) ?? [];
    current.push(deal);
    dealsByContactId.set(deal.contactId, current);
  }

  return dealsByContactId;
}

function latestDateBeforeEventMs(deal: DealSnapshot, eventDateMs: number) {
  const modifiedAt = Date.parse(deal.dateModify);
  if (Number.isFinite(modifiedAt) && modifiedAt <= eventDateMs) {
    return modifiedAt;
  }

  const createdAt = Date.parse(deal.dateCreate);
  if (Number.isFinite(createdAt) && createdAt <= eventDateMs) {
    return createdAt;
  }

  return Number.NEGATIVE_INFINITY;
}

function resolveDealByContact(input: {
  visit: ConversionEventVisitSnapshot;
  eventDateMs: number;
  dealsByContactId: Map<string, DealSnapshot[]>;
}) {
  if (!input.visit.contactId) {
    return undefined;
  }

  const candidates = input.dealsByContactId.get(input.visit.contactId) ?? [];
  if (candidates.length === 0) {
    return undefined;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  const eventName = normalizeEventMatchValue(input.visit.eventName);
  const matchingDeals = candidates.filter(
    (deal) => normalizeEventMatchValue(deal.conversionEventValue) === eventName
  );
  if (matchingDeals.length === 1) {
    return matchingDeals[0];
  }

  const actualCandidates = candidates
    .filter((deal) => {
      const createdAt = Date.parse(deal.dateCreate);
      if (Number.isFinite(createdAt) && createdAt > input.eventDateMs) {
        return false;
      }

      const closedAt = deal.dateClosed ? Date.parse(deal.dateClosed) : null;
      return (
        deal.stageSemanticId === "P" ||
        !closedAt ||
        !Number.isFinite(closedAt) ||
        closedAt >= input.eventDateMs
      );
    })
    .sort((left, right) => {
      const byDate =
        latestDateBeforeEventMs(right, input.eventDateMs) -
        latestDateBeforeEventMs(left, input.eventDateMs);
      return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
    });

  return actualCandidates[0];
}

function isCleanForwardStage(stage: StageContext | undefined) {
  const label = normalizeLabel(stage?.stageName);
  return !(
    stage?.semanticId === "F" ||
    label.includes("корзин") ||
    label.includes("возврат") ||
    label.includes("return") ||
    label.includes("basket") ||
    label.includes("loss")
  );
}

function hasNextStepAfterEvent(input: {
  deal: DealSnapshot;
  eventDateMs: number;
  stageLookup: Map<string, StageContext>;
  stageHistory: StageHistorySnapshot[];
}) {
  const history = input.stageHistory
    .filter((entry) => entry.ownerId === input.deal.id)
    .sort((left, right) => {
      const byTime = Date.parse(left.createdTime) - Date.parse(right.createdTime);
      return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
    });
  const currentAtEvent =
    history
      .filter((entry) => Date.parse(entry.createdTime) <= input.eventDateMs)
      .at(-1)?.stageId ?? input.deal.stageId;
  const currentSort = input.stageLookup.get(currentAtEvent)?.sortOrder ?? null;

  for (const entry of history) {
    const enteredAt = Date.parse(entry.createdTime);
    if (!Number.isFinite(enteredAt) || enteredAt <= input.eventDateMs) {
      continue;
    }

    const stage = input.stageLookup.get(entry.stageId);
    const isWon = entry.stageSemanticId === "S" || stage?.semanticId === "S";
    if (isWon) {
      return true;
    }

    if (!isCleanForwardStage(stage)) {
      continue;
    }

    if (
      currentSort !== null &&
      stage?.sortOrder !== null &&
      stage?.sortOrder !== undefined &&
      stage.sortOrder > currentSort
    ) {
      return true;
    }
  }

  return false;
}

function getGroup(
  groups: Map<string, GroupAccumulator>,
  visit: ConversionEventVisitSnapshot
) {
  const eventKey = buildEventKey(visit.eventName, visit.eventDate);
  const current =
    groups.get(eventKey) ??
    ({
      eventKey,
      eventName: visit.eventName,
      eventDate: visit.eventDate,
      invitedCount: 0,
      attendedCount: 0,
      refusedCount: 0,
      nextStepEligibleCount: 0,
      nextStepCount: 0,
      unlinkedCount: 0,
      unknownStatusCount: 0,
      managerCounts: new Map(),
      sourceCounts: new Map(),
      businessClubCounts: new Map()
    } satisfies GroupAccumulator);

  groups.set(eventKey, current);
  return current;
}

export function buildConversionEventsReport(
  input: ConversionEventsReportInput
): ConversionEventsReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const dealsById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const dealsByContactId = buildDealsByContactId(input.deals);
  const managersById = new Map(
    input.managerDirectory.map((manager) => [manager.id, manager.name])
  );
  const stageLookup = buildStageLookup(input.stageCatalog);
  const groups = new Map<string, GroupAccumulator>();
  const warnings: string[] = [];

  for (const visit of input.visits) {
    const eventDateMs = Date.parse(visit.eventDate);
    if (!Number.isFinite(eventDateMs)) {
      warnings.push(`Conversion event visit ${visit.id} has no event date.`);
      continue;
    }

    if (eventDateMs < fromMs || eventDateMs > toMs) {
      continue;
    }

    const group = getGroup(groups, visit);
    const deal =
      (visit.dealId ? dealsById.get(visit.dealId) : undefined) ??
      resolveDealByContact({
        visit,
        eventDateMs,
        dealsByContactId
      });
    const managerId =
      visit.managerId ?? deal?.assignedById ?? UNASSIGNED_MANAGER_ID;
    const sourceId = visit.sourceId ?? deal?.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
    const businessClubKey = deal?.businessClubValue ?? "UNASSIGNED_BUSINESS_CLUB";

    group.invitedCount += 1;
    if (visit.status === "attended") {
      group.attendedCount += 1;
    } else if (visit.status === "refused") {
      group.refusedCount += 1;
    } else if (visit.status === "unknown") {
      group.unknownStatusCount += 1;
      warnings.push(
        `Conversion event visit ${visit.id} has unknown status "${visit.stageName}".`
      );
    }

    if (!deal) {
      group.unlinkedCount += 1;
      warnings.push(
        `Conversion event visit ${visit.id} is not linked to an attraction deal.`
      );
    }

    if (visit.status === "attended" && deal) {
      group.nextStepEligibleCount += 1;
      if (
        hasNextStepAfterEvent({
          deal,
          eventDateMs,
          stageLookup,
          stageHistory: input.stageHistory
        })
      ) {
        group.nextStepCount += 1;
      }
    }

    incrementBreakdown(
      group.managerCounts,
      managerId,
      managersById.get(managerId) ??
        (managerId === UNASSIGNED_MANAGER_ID ? UNASSIGNED_MANAGER_NAME : managerId)
    );
    incrementBreakdown(
      group.sourceCounts,
      sourceId,
      input.sourceLabels.get(sourceId) ??
        (sourceId === UNATTRIBUTED_SOURCE_KEY ? UNATTRIBUTED_SOURCE_LABEL : sourceId)
    );
    incrementBreakdown(
      group.businessClubCounts,
      businessClubKey,
      deal?.businessClubValue ?? "Без клуба"
    );
  }

  const rows = Array.from(groups.values())
    .map((group) => ({
      eventKey: group.eventKey,
      eventName: group.eventName,
      eventDate: group.eventDate,
      invitedCount: group.invitedCount,
      attendedCount: group.attendedCount,
      refusedCount: group.refusedCount,
      missedCount: group.invitedCount - group.attendedCount,
      attendanceRate: roundPercent(group.attendedCount, group.invitedCount),
      nextStepEligibleCount: group.nextStepEligibleCount,
      nextStepCount: group.nextStepCount,
      nextStepRate: roundPercent(group.nextStepCount, group.nextStepEligibleCount),
      unlinkedCount: group.unlinkedCount,
      unknownStatusCount: group.unknownStatusCount,
      managerBreakdown: toBreakdownRows(group.managerCounts),
      sourceBreakdown: toBreakdownRows(group.sourceCounts),
      businessClubBreakdown: toBreakdownRows(group.businessClubCounts)
    }))
    .sort((left, right) => {
      const byDate = left.eventDate.localeCompare(right.eventDate);
      return byDate !== 0 ? byDate : left.eventName.localeCompare(right.eventName, "ru");
    });

  const totals = rows.reduce(
    (current, row) => ({
      totalInvitedCount: current.totalInvitedCount + row.invitedCount,
      totalAttendedCount: current.totalAttendedCount + row.attendedCount,
      totalRefusedCount: current.totalRefusedCount + row.refusedCount,
      totalMissedCount: current.totalMissedCount + row.missedCount,
      nextStepEligibleCount:
        current.nextStepEligibleCount + row.nextStepEligibleCount,
      nextStepCount: current.nextStepCount + row.nextStepCount
    }),
    {
      totalInvitedCount: 0,
      totalAttendedCount: 0,
      totalRefusedCount: 0,
      totalMissedCount: 0,
      nextStepEligibleCount: 0,
      nextStepCount: 0
    }
  );

  return {
    range: input.range,
    ...totals,
    attendanceRate: roundPercent(
      totals.totalAttendedCount,
      totals.totalInvitedCount
    ),
    nextStepRate: roundPercent(
      totals.nextStepCount,
      totals.nextStepEligibleCount
    ),
    warnings: Array.from(new Set(warnings)),
    rows
  };
}
