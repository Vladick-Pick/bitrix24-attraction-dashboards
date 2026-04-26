import { pathToFileURL } from "node:url";

import type {
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot
} from "@bitrix24-reporting/contracts";

import { BitrixClient, type ActivityRow, type CallRow } from "../bitrix/client";
import { readEnv } from "../config/env";
import { ATTRACTION_MANAGER_IDS } from "../domain/attraction-managers";
import { createSqliteRepository } from "../server/sqlite-repository";

const DEFAULT_CATEGORY_ID = "10";
const AUDIT_PROVIDERS = [
  "VOXIMPLANT_CALL",
  "CRM_TODO",
  "CRM_TASKS_TASK",
  "CRM_MEETING"
] as const;

type AuditProviderId = (typeof AUDIT_PROVIDERS)[number];

export type AuditMissingReason =
  | "missing_local_deal"
  | "call_count_mismatch"
  | "meeting_count_mismatch"
  | "task_count_mismatch";

export interface AttractionScopeDealFilterInput {
  categoryId: string;
  managerIds: string[];
  from: string;
  to: string;
}

export interface BitrixAuditDealRow {
  ID: string | number;
  ASSIGNED_BY_ID?: string | number | null;
  DATE_CREATE?: string | null;
  CATEGORY_ID?: string | number | null;
}

export interface BitrixAuditActivityRow {
  ID: string | number;
  OWNER_ID: string | number;
  PROVIDER_ID?: string | null;
}

export interface BitrixAuditCallRow {
  ID: string | number;
  CRM_ACTIVITY_ID?: string | number | null;
  CRM_ENTITY_TYPE?: string | null;
  CRM_ENTITY_ID?: string | number | null;
}

export interface AuditAttractionScopeInput {
  categoryId?: string;
  managerIds?: string[];
  from: string;
  to: string;
}

export interface AuditAttractionScopeDependencies {
  fetchScopeDeals(input: {
    filter: ReturnType<typeof buildAttractionScopeDealFilter>;
    categoryId: string;
    managerIds: string[];
    from: string;
    to: string;
  }): Promise<BitrixAuditDealRow[]>;
  listActivitiesByProvider(input: {
    dealIds: string[];
    providerId: AuditProviderId;
  }): Promise<BitrixAuditActivityRow[]>;
  listCallsByActivityIds(input: {
    activityIds: string[];
  }): Promise<BitrixAuditCallRow[]>;
  loadLocalSnapshots(): Promise<{
    deals: DealSnapshot[];
    activities: ActivitySnapshot[];
    calls: CallSnapshot[];
  }>;
}

export interface AuditAttractionScopeRow {
  dealId: string;
  managerId: string | null;
  bitrixCallCount: number;
  bitrixMeetingCount: number;
  bitrixTaskCount: number;
  localCallCount: number;
  localMeetingCount: number;
  localTaskCount: number;
  missingReasons: AuditMissingReason[];
}

export interface AuditAttractionScopeSummary {
  dealsAudited: number;
  mismatchedDeals: number;
  dealsMissingLocally: number;
  bitrixCallCount: number;
  bitrixMeetingCount: number;
  bitrixTaskCount: number;
  localCallCount: number;
  localMeetingCount: number;
  localTaskCount: number;
}

export interface AuditAttractionScopeResult {
  filter: ReturnType<typeof buildAttractionScopeDealFilter>;
  summary: AuditAttractionScopeSummary;
  rows: AuditAttractionScopeRow[];
}

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function addMissingReason(
  reasons: AuditMissingReason[],
  condition: boolean,
  reason: AuditMissingReason
) {
  if (condition) {
    reasons.push(reason);
  }
}

function isTaskProvider(providerId: string | null | undefined) {
  return providerId === "CRM_TODO" || providerId === "CRM_TASKS_TASK";
}

function isCallProvider(providerId: string | null | undefined) {
  return providerId === "VOXIMPLANT_CALL";
}

function isMeetingProvider(providerId: string | null | undefined) {
  return providerId === "CRM_MEETING";
}

export function buildAttractionScopeDealFilter(
  input: AttractionScopeDealFilterInput
) {
  return {
    CATEGORY_ID: input.categoryId,
    "@ASSIGNED_BY_ID": input.managerIds,
    ">=DATE_CREATE": input.from,
    "<=DATE_CREATE": input.to
  };
}

export function summarizeAuditRows(
  rows: AuditAttractionScopeRow[]
): AuditAttractionScopeSummary {
  return rows.reduce<AuditAttractionScopeSummary>(
    (summary, row) => {
      summary.dealsAudited += 1;
      summary.mismatchedDeals += row.missingReasons.length > 0 ? 1 : 0;
      summary.dealsMissingLocally += row.missingReasons.includes("missing_local_deal")
        ? 1
        : 0;
      summary.bitrixCallCount += row.bitrixCallCount;
      summary.bitrixMeetingCount += row.bitrixMeetingCount;
      summary.bitrixTaskCount += row.bitrixTaskCount;
      summary.localCallCount += row.localCallCount;
      summary.localMeetingCount += row.localMeetingCount;
      summary.localTaskCount += row.localTaskCount;

      return summary;
    },
    {
      dealsAudited: 0,
      mismatchedDeals: 0,
      dealsMissingLocally: 0,
      bitrixCallCount: 0,
      bitrixMeetingCount: 0,
      bitrixTaskCount: 0,
      localCallCount: 0,
      localMeetingCount: 0,
      localTaskCount: 0
    }
  );
}

export async function auditAttractionScope(
  input: AuditAttractionScopeInput,
  dependencies: AuditAttractionScopeDependencies
): Promise<AuditAttractionScopeResult> {
  const categoryId = input.categoryId ?? DEFAULT_CATEGORY_ID;
  const managerIds = input.managerIds ?? ATTRACTION_MANAGER_IDS;
  const filter = buildAttractionScopeDealFilter({
    categoryId,
    managerIds,
    from: input.from,
    to: input.to
  });

  const bitrixDeals = await dependencies.fetchScopeDeals({
    filter,
    categoryId,
    managerIds,
    from: input.from,
    to: input.to
  });
  const dealIds = bitrixDeals.map((deal) => String(deal.ID));
  const activityRows = (
    await Promise.all(
      AUDIT_PROVIDERS.map((providerId) =>
        dependencies.listActivitiesByProvider({ dealIds, providerId })
      )
    )
  ).flat();
  const callActivityRows = activityRows.filter((activity) =>
    isCallProvider(activity.PROVIDER_ID)
  );
  const bitrixCalls = await dependencies.listCallsByActivityIds({
    activityIds: callActivityRows.map((activity) => String(activity.ID))
  });
  const localSnapshots = await dependencies.loadLocalSnapshots();

  const bitrixCallActivityOwnerById = new Map(
    callActivityRows.map((activity) => [
      String(activity.ID),
      String(activity.OWNER_ID)
    ])
  );
  const bitrixCallCountsByDeal = new Map<string, number>();
  const bitrixMeetingCountsByDeal = new Map<string, number>();
  const bitrixTaskCountsByDeal = new Map<string, number>();

  for (const activity of activityRows) {
    const dealId = String(activity.OWNER_ID);

    if (isTaskProvider(activity.PROVIDER_ID)) {
      increment(bitrixTaskCountsByDeal, dealId);
    } else if (isMeetingProvider(activity.PROVIDER_ID)) {
      increment(bitrixMeetingCountsByDeal, dealId);
    }
  }

  for (const call of bitrixCalls) {
    const dealId =
      (call.CRM_ACTIVITY_ID
        ? bitrixCallActivityOwnerById.get(String(call.CRM_ACTIVITY_ID))
        : null) ??
      (call.CRM_ENTITY_TYPE === "DEAL" && call.CRM_ENTITY_ID
        ? String(call.CRM_ENTITY_ID)
        : null);

    if (dealId) {
      increment(bitrixCallCountsByDeal, dealId);
    }
  }

  const localDealsById = new Map(
    localSnapshots.deals.map((deal) => [deal.id, deal])
  );
  const localActivityById = new Map(
    localSnapshots.activities.map((activity) => [activity.id, activity])
  );
  const localTaskCountsByDeal = new Map<string, number>();
  const localMeetingCountsByDeal = new Map<string, number>();

  for (const activity of localSnapshots.activities) {
    if (isTaskProvider(activity.providerId)) {
      increment(localTaskCountsByDeal, activity.ownerId);
    } else if (isMeetingProvider(activity.providerId)) {
      increment(localMeetingCountsByDeal, activity.ownerId);
    }
  }

  const localCallCountsByDeal = new Map<string, number>();
  for (const call of localSnapshots.calls) {
    const activity = call.crmActivityId
      ? localActivityById.get(call.crmActivityId)
      : null;
    const dealId =
      activity?.ownerId ??
      (call.crmEntityType === "DEAL" ? call.crmEntityId ?? null : null);

    if (dealId) {
      increment(localCallCountsByDeal, dealId);
    }
  }

  const rows = bitrixDeals
    .map<AuditAttractionScopeRow>((deal) => {
      const dealId = String(deal.ID);
      const managerId =
        deal.ASSIGNED_BY_ID === undefined || deal.ASSIGNED_BY_ID === null
          ? null
          : String(deal.ASSIGNED_BY_ID);
      const bitrixCallCount = bitrixCallCountsByDeal.get(dealId) ?? 0;
      const bitrixMeetingCount = bitrixMeetingCountsByDeal.get(dealId) ?? 0;
      const bitrixTaskCount = bitrixTaskCountsByDeal.get(dealId) ?? 0;
      const localCallCount = localCallCountsByDeal.get(dealId) ?? 0;
      const localMeetingCount = localMeetingCountsByDeal.get(dealId) ?? 0;
      const localTaskCount = localTaskCountsByDeal.get(dealId) ?? 0;
      const missingReasons: AuditMissingReason[] = [];

      addMissingReason(
        missingReasons,
        bitrixCallCount !== localCallCount,
        "call_count_mismatch"
      );
      addMissingReason(
        missingReasons,
        !localDealsById.has(dealId),
        "missing_local_deal"
      );
      addMissingReason(
        missingReasons,
        bitrixMeetingCount !== localMeetingCount,
        "meeting_count_mismatch"
      );
      addMissingReason(
        missingReasons,
        bitrixTaskCount !== localTaskCount,
        "task_count_mismatch"
      );

      return {
        dealId,
        managerId,
        bitrixCallCount,
        bitrixMeetingCount,
        bitrixTaskCount,
        localCallCount,
        localMeetingCount,
        localTaskCount,
        missingReasons
      };
    })
    .sort((left, right) => Number(left.dealId) - Number(right.dealId));

  return {
    filter,
    summary: summarizeAuditRows(rows),
    rows
  };
}

function parseArgs(argv: string[]) {
  const result: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value) {
      continue;
    }

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      result[key] = "true";
      continue;
    }

    result[key] = nextValue;
    index += 1;
  }

  return result;
}

function assertDateArg(args: Record<string, string>, key: "from" | "to") {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required --${key} argument.`);
  }

  return value;
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const env = readEnv();
  const client = new BitrixClient({
    dealCategoryIds: env.bitrixDealCategoryIds,
    qualityFieldName: env.BITRIX24_DEAL_QUALITY_FIELD,
    timeoutMs: env.BITRIX24_TIMEOUT_MS,
    requestIntervalMs: env.BITRIX24_REQUEST_INTERVAL_MS,
    ...(env.BITRIX24_PORTAL_HOST ? { portalHost: env.BITRIX24_PORTAL_HOST } : {}),
    ...(env.BITRIX24_WEBHOOK_USER_ID
      ? { userId: env.BITRIX24_WEBHOOK_USER_ID }
      : {}),
    ...(env.BITRIX24_WEBHOOK_TOKEN
      ? { webhookToken: env.BITRIX24_WEBHOOK_TOKEN }
      : {})
  });
  const repository = createSqliteRepository({
    databaseUrl: env.DATABASE_URL,
    defaultWonStageIds: env.reportWonStageIds
  });

  try {
    const result = await auditAttractionScope(
      {
        categoryId: args.categoryId ?? DEFAULT_CATEGORY_ID,
        managerIds: args.managerIds
          ? args.managerIds.split(",").map((value) => value.trim()).filter(Boolean)
          : ATTRACTION_MANAGER_IDS,
        from: assertDateArg(args, "from"),
        to: assertDateArg(args, "to")
      },
      {
        fetchScopeDeals: async ({ filter }) => client.listDealsForAudit({ filter }),
        listActivitiesByProvider: async ({ dealIds, providerId }) =>
          client.listActivities({
            ownerIds: dealIds,
            modifiedAfter: null,
            providerId
          }) as Promise<ActivityRow[]>,
        listCallsByActivityIds: async ({ activityIds }) =>
          client.listCalls({ activityIds }) as Promise<CallRow[]>,
        loadLocalSnapshots: async () => ({
          deals: await repository.getAllDeals(),
          activities: await repository.getAllActivities(),
          calls: await repository.getAllCalls()
        })
      }
    );

    const mismatches = result.rows.filter((row) => row.missingReasons.length > 0);
    console.log(
      JSON.stringify(
        {
          filter: result.filter,
          summary: result.summary,
          mismatches
        },
        null,
        2
      )
    );
  } finally {
    repository.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
