import type {
  ConversionEventBreakdownRow,
  ConversionEventsReport,
  ConversionEventStatus,
  ConversionEventVisitSnapshot,
  DealSnapshot,
  EventSnapshot,
  EventVisitFactSnapshot,
  ManagerDirectoryEntry,
  ModuleEventTypeSetting,
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
  const match = /(^|\D)(\d{1,2})\.(\d{1,2})(?:\.(\d{4}|\d{2}))?(?:\D|$)/u.exec(
    eventName
  );
  if (!match?.[2] || !match[3]) {
    return null;
  }

  const day = Number(match[2]);
  const month = Number(match[3]);
  const year = match[4]
    ? match[4].length === 2
      ? 2000 + Number(match[4])
      : Number(match[4])
    : reportYear;
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
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
  const stageCode = label.split(":").pop() ?? label;

  if (label.includes("посетил") || label.includes("на мероприятии")) {
    return "attended";
  }

  if (stageCode === "success") {
    return "attended";
  }

  if (label.includes("пойду") || label.includes("подтверж")) {
    return "confirmed";
  }

  if (stageCode === "preparation") {
    return "confirmed";
  }

  if (label.includes("отказ")) {
    return "refused";
  }

  if (stageCode === "fail") {
    return "refused";
  }

  if (label.includes("приглаш")) {
    return "invited";
  }

  if (stageCode === "new") {
    return "invited";
  }

  return "unknown";
}

interface ConversionEventsReportInput {
  range: ReportRange;
  visits: ConversionEventVisitSnapshot[];
  eventVisitFacts?: EventVisitFactSnapshot[];
  events?: EventSnapshot[];
  eventTypeSettings?: ModuleEventTypeSetting[];
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  managerDirectory: ManagerDirectoryEntry[];
  sourceLabels: Map<string, string>;
  asOf?: string;
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
  confirmedCount: number;
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

function isInRange(value: string | null | undefined, fromMs: number, toMs: number) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) && timestamp >= fromMs && timestamp <= toMs;
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
      confirmedCount: 0,
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

function getGroupFromEvent(groups: Map<string, GroupAccumulator>, event: EventSnapshot) {
  const eventName = event.title?.trim() || event.eventId;
  const eventKey = buildEventKey(eventName, event.eventDate);
  const current =
    groups.get(eventKey) ??
    ({
      eventKey,
      eventName,
      eventDate: event.eventDate,
      invitedCount: 0,
      confirmedCount: 0,
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

function parseFactPayload(payloadJson: string | null) {
  if (!payloadJson) {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringFromPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function eventVisitFactDedupeKey(fact: EventVisitFactSnapshot) {
  if (!fact.dealId) {
    return null;
  }

  const payload = parseFactPayload(fact.payloadJson);
  const eventKey =
    fact.eventId ||
    `${stringFromPayload(payload, "eventName") ?? "Без названия"}::${
      fact.eventDate ?? ""
    }`;

  return `${eventKey}::${fact.dealId}`;
}

function eventVisitStatusRank(status: EventVisitFactSnapshot["finalStatus"]) {
  switch (status) {
    case "attended":
      return 4;
    case "confirmed":
      return 3;
    case "refused":
      return 2;
    case "invited":
      return 1;
    default:
      return 0;
  }
}

function eventVisitStatusTimestamp(fact: EventVisitFactSnapshot) {
  return (
    fact.attendedAt ??
    fact.confirmedAt ??
    fact.refusedAt ??
    fact.invitedAt ??
    fact.eventDate ??
    ""
  );
}

function shouldReplaceCanonicalFact(
  current: EventVisitFactSnapshot,
  candidate: EventVisitFactSnapshot
) {
  const currentRank = eventVisitStatusRank(current.finalStatus);
  const candidateRank = eventVisitStatusRank(candidate.finalStatus);

  if (candidateRank !== currentRank) {
    return candidateRank > currentRank;
  }

  const currentTimestamp = eventVisitStatusTimestamp(current);
  const candidateTimestamp = eventVisitStatusTimestamp(candidate);
  if (candidateTimestamp !== currentTimestamp) {
    return candidateTimestamp > currentTimestamp;
  }

  return candidate.visitId > current.visitId;
}

function dedupeEventVisitFacts(facts: EventVisitFactSnapshot[]) {
  const canonicalByKey = new Map<string, EventVisitFactSnapshot>();
  const duplicateKeys = new Set<string>();
  const passthrough: EventVisitFactSnapshot[] = [];

  for (const fact of facts) {
    const key = eventVisitFactDedupeKey(fact);
    if (!key) {
      passthrough.push(fact);
      continue;
    }

    const current = canonicalByKey.get(key);
    if (!current) {
      canonicalByKey.set(key, fact);
      continue;
    }

    duplicateKeys.add(key);
    if (shouldReplaceCanonicalFact(current, fact)) {
      canonicalByKey.set(key, fact);
    }
  }

  return {
    facts: [...canonicalByKey.values(), ...passthrough].sort((left, right) => {
      const leftDate = left.eventDate ?? "";
      const rightDate = right.eventDate ?? "";
      const byDate = leftDate.localeCompare(rightDate);
      return byDate !== 0 ? byDate : left.visitId.localeCompare(right.visitId);
    }),
    duplicatePairCount: duplicateKeys.size
  };
}

function getGroupFromFact(input: {
  groups: Map<string, GroupAccumulator>;
  fact: EventVisitFactSnapshot;
  eventById: Map<string, EventSnapshot>;
}) {
  const event = input.fact.eventId
    ? input.eventById.get(input.fact.eventId) ?? null
    : null;
  const payload = parseFactPayload(input.fact.payloadJson);
  const eventName =
    event?.title?.trim() ||
    stringFromPayload(payload, "eventName") ||
    input.fact.eventId ||
    "Без названия";
  const eventDate = event?.eventDate ?? input.fact.eventDate;
  const eventKey = buildEventKey(eventName, eventDate ?? "");
  const current =
    input.groups.get(eventKey) ??
    ({
      eventKey,
      eventName,
      eventDate: eventDate ?? "",
      invitedCount: 0,
      confirmedCount: 0,
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

  input.groups.set(eventKey, current);
  return current;
}

export function buildConversionEventsReport(
  input: ConversionEventsReportInput
): ConversionEventsReport {
  const fromMs = Date.parse(input.range.from);
  const toMs = Date.parse(input.range.to);
  const asOfMs = Date.parse(input.asOf ?? new Date().toISOString());
  const dealsById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const eventById = new Map((input.events ?? []).map((event) => [event.eventId, event]));
  const managersById = new Map(
    input.managerDirectory.map((manager) => [manager.id, manager.name])
  );
  const stageLookup = buildStageLookup(input.stageCatalog);
  const groups = new Map<string, GroupAccumulator>();
  const warnings: string[] = [];
  const enabledPlannedEventTypeIds = new Set(
    (input.eventTypeSettings ?? [])
      .filter((setting) => setting.enabled)
      .map((setting) => setting.eventTypeId)
  );

  for (const event of input.events ?? []) {
    const eventDateMs = Date.parse(event.eventDate);
    if (!Number.isFinite(eventDateMs) || eventDateMs < fromMs || eventDateMs > toMs) {
      continue;
    }

    if (!event.eventTypeId || !enabledPlannedEventTypeIds.has(event.eventTypeId)) {
      continue;
    }

    getGroupFromEvent(groups, event);
  }

  const rawFactVisits = input.eventVisitFacts ?? [];
  const dedupedFactVisits = dedupeEventVisitFacts(rawFactVisits);
  const factVisits = dedupedFactVisits.facts;
  const factVisitIds = new Set<string>();
  if (rawFactVisits.length > 0) {
    for (const fact of rawFactVisits) {
      factVisitIds.add(fact.visitId);
    }

    if (dedupedFactVisits.duplicatePairCount > 0) {
      warnings.push(
        `Duplicate conversion event visits were deduplicated for ${
          dedupedFactVisits.duplicatePairCount
        } event/deal pair${
          dedupedFactVisits.duplicatePairCount === 1 ? "" : "s"
        }.`
      );
    }

    for (const fact of factVisits) {
      const eventDateMs = Date.parse(fact.eventDate ?? "");
      if (!Number.isFinite(eventDateMs)) {
        warnings.push(`Conversion event visit ${fact.visitId} has no event date.`);
        continue;
      }

      const eventDateInRange = eventDateMs >= fromMs && eventDateMs <= toMs;
      const invitedInRange = isInRange(fact.invitedAt, fromMs, toMs);
      const confirmedInRange = isInRange(fact.confirmedAt, fromMs, toMs);
      const shouldCountInvitation = eventDateInRange || invitedInRange;
      const shouldCountConfirmation =
        confirmedInRange ||
        (eventDateInRange &&
          (Boolean(fact.confirmedAt) || fact.finalStatus === "confirmed"));
      const shouldIncludeFact =
        shouldCountInvitation || shouldCountConfirmation || eventDateInRange;

      if (!shouldIncludeFact) {
        continue;
      }

      const deal = fact.dealId ? dealsById.get(fact.dealId) ?? null : null;
      if (!deal) {
        continue;
      }

      const group = getGroupFromFact({ groups, fact, eventById });
      const managerId = fact.managerId ?? deal.assignedById ?? UNASSIGNED_MANAGER_ID;
      const sourceId = fact.sourceId ?? deal.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
      const businessClubKey = deal.businessClubValue ?? "UNASSIGNED_BUSINESS_CLUB";

      if (shouldCountInvitation) {
        group.invitedCount += 1;
      }
      if (shouldCountConfirmation) {
        group.confirmedCount += 1;
      }
      if (eventDateInRange) {
        if (fact.finalStatus === "attended") {
          group.attendedCount += 1;
        } else if (fact.finalStatus === "refused") {
          group.refusedCount += 1;
        } else if (fact.finalStatus === "unknown") {
          group.unknownStatusCount += 1;
          warnings.push(
            `Conversion event visit ${fact.visitId} has unknown status "${fact.currentStageName ?? fact.currentStageId}".`
          );
        }
      }

      if (eventDateInRange && fact.finalStatus === "attended") {
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
        deal.businessClubValue ?? "Без клуба"
      );
    }
  }

  for (const visit of input.visits) {
    if (factVisitIds.has(visit.id)) {
      continue;
    }

    const eventDateMs = Date.parse(visit.eventDate);
    if (!Number.isFinite(eventDateMs)) {
      warnings.push(`Conversion event visit ${visit.id} has no event date.`);
      continue;
    }

    if (eventDateMs < fromMs || eventDateMs > toMs) {
      continue;
    }

    if (!visit.dealId) {
      continue;
    }

    const deal = dealsById.get(visit.dealId);
    if (!deal) {
      continue;
    }

    const group = getGroup(groups, visit);
    const managerId = visit.managerId ?? deal.assignedById ?? UNASSIGNED_MANAGER_ID;
    const sourceId = visit.sourceId ?? deal.sourceId ?? UNATTRIBUTED_SOURCE_KEY;
    const businessClubKey = deal.businessClubValue ?? "UNASSIGNED_BUSINESS_CLUB";

    group.invitedCount += 1;
    if (visit.status === "confirmed") {
      group.confirmedCount += 1;
    } else if (visit.status === "attended") {
      group.attendedCount += 1;
    } else if (visit.status === "refused") {
      group.refusedCount += 1;
    } else if (visit.status === "unknown") {
      group.unknownStatusCount += 1;
      warnings.push(
        `Conversion event visit ${visit.id} has unknown status "${visit.stageName}".`
      );
    }

    if (visit.status === "attended") {
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
      deal.businessClubValue ?? "Без клуба"
    );
  }

  const rows = Array.from(groups.values())
    .map((group) => {
      const eventDateMs = Date.parse(group.eventDate);
      const eventIsPast =
        Number.isFinite(eventDateMs) && Number.isFinite(asOfMs)
          ? eventDateMs <= asOfMs
          : true;

      return {
        eventKey: group.eventKey,
        eventName: group.eventName,
        eventDate: group.eventDate,
        invitedCount: group.invitedCount,
        confirmedCount: group.confirmedCount,
        attendedCount: group.attendedCount,
        refusedCount: group.refusedCount,
        missedCount: eventIsPast ? group.invitedCount - group.attendedCount : 0,
        attendanceRate: roundPercent(group.attendedCount, group.invitedCount),
        nextStepEligibleCount: group.nextStepEligibleCount,
        nextStepCount: group.nextStepCount,
        nextStepRate: roundPercent(group.nextStepCount, group.nextStepEligibleCount),
        unlinkedCount: group.unlinkedCount,
        unknownStatusCount: group.unknownStatusCount,
        managerBreakdown: toBreakdownRows(group.managerCounts),
        sourceBreakdown: toBreakdownRows(group.sourceCounts),
        businessClubBreakdown: toBreakdownRows(group.businessClubCounts)
      };
    })
    .sort((left, right) => {
      const byDate = left.eventDate.localeCompare(right.eventDate);
      return byDate !== 0 ? byDate : left.eventName.localeCompare(right.eventName, "ru");
    });

  const totals = rows.reduce(
    (current, row) => ({
      totalInvitedCount: current.totalInvitedCount + row.invitedCount,
      totalConfirmedCount: current.totalConfirmedCount + row.confirmedCount,
      totalAttendedCount: current.totalAttendedCount + row.attendedCount,
      totalRefusedCount: current.totalRefusedCount + row.refusedCount,
      totalMissedCount: current.totalMissedCount + row.missedCount,
      nextStepEligibleCount:
        current.nextStepEligibleCount + row.nextStepEligibleCount,
      nextStepCount: current.nextStepCount + row.nextStepCount
    }),
    {
      totalInvitedCount: 0,
      totalConfirmedCount: 0,
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
