import type {
  ActivityBindingSnapshot,
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  DealStageFactSnapshot,
  DealTouchpointFactSnapshot,
  ManagerDirectoryEntry,
  ReportRange,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import {
  buildActivitiesWorkloadReport,
  buildCallsWorkloadReport
} from "./operational-reports.js";
import {
  stageFactsToStageHistory,
  touchpointFactsToActivities,
  touchpointFactsToCalls,
  touchpointFactsToMeetingDateChanges
} from "./fact-report-adapters.js";

export interface FactParityDiff {
  path: string;
  oldValue: number | string | null;
  newValue: number | string | null;
  reason: string;
}

export interface FactParityReport {
  activityDiffs: FactParityDiff[];
  callDiffs: FactParityDiff[];
  linkReasonBreakdown: Array<{
    kind: string;
    linkReason: string;
    count: number;
  }>;
}

interface FactParityInput {
  range: ReportRange;
  deals: DealSnapshot[];
  stageCatalog: StageCatalogEntry[];
  stageHistory: StageHistorySnapshot[];
  activities: ActivitySnapshot[];
  activityBindings?: ActivityBindingSnapshot[];
  deadlineChanges?: ActivityDeadlineChangeSnapshot[];
  meetingDateChanges?: DealMeetingDateChangeSnapshot[];
  calls: CallSnapshot[];
  dealStageFacts: DealStageFactSnapshot[];
  dealTouchpointFacts: DealTouchpointFactSnapshot[];
  managerDirectory?: ManagerDirectoryEntry[];
}

function addNumberDiff(input: {
  diffs: FactParityDiff[];
  path: string;
  oldValue: number;
  newValue: number;
  reason: string;
}) {
  if (input.oldValue === input.newValue) {
    return;
  }

  input.diffs.push({
    path: input.path,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason
  });
}

function compareManagerMetric(input: {
  diffs: FactParityDiff[];
  pathPrefix: string;
  metric: string;
  oldRows: Array<{ managerId: string }>;
  newRows: Array<{ managerId: string }>;
}) {
  const oldByManager = new Map(input.oldRows.map((row) => [row.managerId, row]));
  const newByManager = new Map(input.newRows.map((row) => [row.managerId, row]));
  const managerIds = new Set([...oldByManager.keys(), ...newByManager.keys()]);

  for (const managerId of managerIds) {
    const oldValue = Number(
      (oldByManager.get(managerId) as unknown as Record<string, unknown> | undefined)?.[
        input.metric
      ] ?? 0
    );
    const newValue = Number(
      (newByManager.get(managerId) as unknown as Record<string, unknown> | undefined)?.[
        input.metric
      ] ?? 0
    );
    addNumberDiff({
      diffs: input.diffs,
      path: `${input.pathPrefix}.manager.${managerId}.${input.metric}`,
      oldValue,
      newValue,
      reason: "manager_metric_mismatch"
    });
  }
}

function buildLinkReasonBreakdown(facts: DealTouchpointFactSnapshot[]) {
  const rows = new Map<string, { kind: string; linkReason: string; count: number }>();

  for (const fact of facts) {
    const key = `${fact.kind}::${fact.linkReason}`;
    const current = rows.get(key) ?? {
      kind: fact.kind,
      linkReason: fact.linkReason,
      count: 0
    };
    current.count += 1;
    rows.set(key, current);
  }

  return Array.from(rows.values()).sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }

    return left.linkReason.localeCompare(right.linkReason);
  });
}

export function buildFactParityReport(input: FactParityInput): FactParityReport {
  const factStageHistory = stageFactsToStageHistory(input.dealStageFacts);
  const factActivities = touchpointFactsToActivities(input.dealTouchpointFacts);
  const factCalls = touchpointFactsToCalls(input.dealTouchpointFacts);
  const factMeetingDateChanges = touchpointFactsToMeetingDateChanges(
    input.dealTouchpointFacts
  );
  const oldActivities = buildActivitiesWorkloadReport({
    range: input.range,
    deals: input.deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities: input.activities,
    deadlineChanges: input.deadlineChanges ?? [],
    meetingDateChanges: input.meetingDateChanges ?? [],
    calls: input.calls,
    managerDirectory: input.managerDirectory ?? []
  });
  const newActivities = buildActivitiesWorkloadReport({
    range: input.range,
    deals: input.deals,
    stageCatalog: input.stageCatalog,
    stageHistory: factStageHistory,
    activities: factActivities,
    deadlineChanges: input.deadlineChanges ?? [],
    meetingDateChanges: factMeetingDateChanges,
    calls: factCalls,
    managerDirectory: input.managerDirectory ?? []
  });
  const oldCalls = buildCallsWorkloadReport({
    range: input.range,
    deals: input.deals,
    stageCatalog: input.stageCatalog,
    stageHistory: input.stageHistory,
    activities: input.activities,
    activityBindings: input.activityBindings ?? [],
    calls: input.calls,
    managerDirectory: input.managerDirectory ?? []
  });
  const newCalls = buildCallsWorkloadReport({
    range: input.range,
    deals: input.deals,
    stageCatalog: input.stageCatalog,
    stageHistory: factStageHistory,
    activities: factActivities,
    activityBindings: [],
    calls: factCalls,
    managerDirectory: input.managerDirectory ?? []
  });
  const activityDiffs: FactParityDiff[] = [];
  const callDiffs: FactParityDiff[] = [];

  for (const metric of [
    "totalDealCount",
    "totalCreatedCount",
    "totalClosedCount",
    "totalMeetingCount"
  ] as const) {
    addNumberDiff({
      diffs: activityDiffs,
      path: `activities.${metric}`,
      oldValue: oldActivities[metric],
      newValue: newActivities[metric],
      reason: "activities_total_mismatch"
    });
  }

  for (const metric of [
    "createdCount",
    "closedCount",
    "meetingCount"
  ] as const) {
    compareManagerMetric({
      diffs: activityDiffs,
      pathPrefix: "activities",
      metric,
      oldRows: oldActivities.managerRows,
      newRows: newActivities.managerRows
    });
  }

  for (const metric of [
    "totalDealCount",
    "totalCalls",
    "totalConnectedCalls",
    "totalCallsOverThirtySeconds",
    "totalConnectedCallsOverThirtySeconds"
  ] as const) {
    addNumberDiff({
      diffs: callDiffs,
      path: `calls.${metric}`,
      oldValue: oldCalls[metric],
      newValue: newCalls[metric],
      reason: "calls_total_mismatch"
    });
  }

  for (const metric of [
    "totalCalls",
    "connectedCalls",
    "callsOverThirtySeconds",
    "connectedCallsOverThirtySeconds"
  ] as const) {
    compareManagerMetric({
      diffs: callDiffs,
      pathPrefix: "calls",
      metric,
      oldRows: oldCalls.managerRows,
      newRows: newCalls.managerRows
    });
  }

  return {
    activityDiffs,
    callDiffs,
    linkReasonBreakdown: buildLinkReasonBreakdown(input.dealTouchpointFacts)
  };
}
