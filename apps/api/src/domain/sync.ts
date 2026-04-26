import type {
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

import { ATTRACTION_MANAGER_IDS } from "./attraction-managers";

export interface DealRow {
  ID: string;
  CONTACT_ID?: string | null;
  TITLE?: string | null;
  LEAD_ID: string | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  DATE_CLOSED?: string | null;
  CATEGORY_ID: string | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  SOURCE_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
  [key: string]: unknown;
}

export interface StageHistoryRow {
  ID: string | number;
  OWNER_ID: string | number;
  CATEGORY_ID: string | number | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  TYPE_ID: number | null;
  CREATED_TIME: string;
}

export interface ActivityRow {
  ID: string | number;
  OWNER_TYPE_ID: string | number;
  OWNER_ID: string | number;
  TYPE_ID: string | number | null;
  PROVIDER_ID: string | null;
  RESPONSIBLE_ID: string | number | null;
  CREATED: string;
  DEADLINE: string | null;
  LAST_UPDATED: string;
  COMPLETED: string;
  COMPLETED_DATE?: string | null;
}

export interface CallRow {
  ID: string | number;
  CRM_ACTIVITY_ID: string | number | null;
  PORTAL_USER_ID: string | number | null;
  CALL_TYPE: string | number | null;
  CALL_START_DATE: string;
  CALL_DURATION: string | number | null;
  CRM_ENTITY_TYPE: string | null;
  CRM_ENTITY_ID: string | number | null;
  CALL_FAILED_CODE: string | number | null;
}

export interface UserRow {
  ID: string | number;
  NAME: string | null;
  LAST_NAME: string | null;
}

export interface ContactRow {
  ID: string;
  [key: string]: unknown;
}

export interface SyncClient {
  fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]>;
  fetchSourceCatalog(): Promise<StageCatalogEntry[]>;
  fetchDealQualityMap(fieldName: string): Promise<Record<string, string>>;
  fetchDealFieldValueMap?(fieldName: string): Promise<Record<string, string>>;
  fetchContactFieldValueMap?(fieldName: string): Promise<Record<string, string>>;
  listDeals(cursor: {
    modifiedAfter: string | null;
    categoryIds: string[];
    qualityFieldName?: string;
    customFieldNames?: string[];
  }): Promise<DealRow[]>;
  listContacts?(input: {
    ids: string[];
    customFieldNames?: string[];
  }): Promise<ContactRow[]>;
  listStageHistory(input: {
    ownerIds?: string[];
    categoryIds?: string[];
  }): Promise<StageHistoryRow[]>;
  listActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
    providerId?: string;
  }): Promise<ActivityRow[]>;
  listActivitiesByIds?(activityIds: string[]): Promise<ActivityRow[]>;
  listCalls(input: {
    activityIds?: string[];
    callStartDateFrom?: string;
    callStartDateTo?: string;
    portalUserIds?: string[];
  }): Promise<CallRow[]>;
  fetchUsers(input: { ids: string[] }): Promise<UserRow[]>;
}

export interface SyncRepository {
  getLatestSuccessCursor(categoryIds?: string[]): Promise<string | null>;
  runSnapshotTransaction?<T>(task: () => T): T;
  getSyncCursor?(key: string): Promise<string | null>;
  setSyncCursor?(input: {
    key: string;
    cursorValue: string;
    updatedAt: string;
  }): Promise<void>;
  hasSyncCoverage?(input: {
    scopeKey: string;
    stream: string;
    providerId: string | null;
    requiredFrom: string;
    requiredTo?: string | null;
    algorithmVersion: string;
  }): Promise<boolean>;
  upsertSyncCoverage?(input: {
    scopeKey: string;
    stream: string;
    providerId: string | null;
    coveredFrom: string;
    coveredTo: string | null;
    algorithmVersion: string;
    syncedAt: string;
  }): Promise<void>;
  getOperationalHistoryBootstrappedAt(): Promise<string | null>;
  getCallHistoryBootstrappedAt(): Promise<string | null>;
  getCallActivityHistoryBootstrappedAt?(): Promise<string | null>;
  getMeetingActivityHistoryBootstrappedAt?(): Promise<string | null>;
  getTaskActivityHistoryBootstrappedAt?(): Promise<string | null>;
  getDealCustomFieldsBootstrappedAt?(): Promise<string | null>;
  getDealMeetingDateFieldBootstrappedAt?(): Promise<string | null>;
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(categoryIds: string[]): Promise<string[]>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
  getCallActivityIdsMissingActivities?(
    limit?: number,
    callStartDateFrom?: string | null
  ): Promise<string[]>;
  getCallActivityIdsMissingCallStats?(
    limit?: number,
    activityCreatedFrom?: string | null
  ): Promise<string[]>;
  getCallActivityIdsForCallStatsRefresh?(
    limit?: number,
    activityCreatedFrom?: string | null
  ): Promise<string[]>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertDeals(rows: DealSnapshot[]): Promise<number>;
  upsertStageHistory(rows: StageHistorySnapshot[]): Promise<number>;
  upsertActivities(rows: ActivitySnapshot[]): Promise<number>;
  upsertActivityDeadlineChanges(
    rows: ActivityDeadlineChangeSnapshot[]
  ): Promise<number>;
  upsertCalls(rows: CallSnapshot[]): Promise<number>;
  upsertManagerDirectory(rows: ManagerDirectoryEntry[]): Promise<number>;
  markOperationalHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallActivityHistoryBootstrapped?(timestamp: string): Promise<void>;
  markMeetingActivityHistoryBootstrapped?(timestamp: string): Promise<void>;
  markTaskActivityHistoryBootstrapped?(timestamp: string): Promise<void>;
  markDealCustomFieldsBootstrapped?(timestamp: string): Promise<void>;
  markDealMeetingDateFieldBootstrapped?(timestamp: string): Promise<void>;
  createSyncRun(input?: {
    startedAt: string;
    mode: "full" | "delta";
    modifiedAfter: string | null;
  }): Promise<number>;
  failSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "failed";
  }): Promise<void>;
  finishSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "success";
    leadsSynced: number;
    dealsSynced: number;
    modifiedAfter: string | null;
  }): Promise<void>;
}

interface PerformManualSyncInput {
  categoryIds: string[];
  qualityFieldName: string;
  tariffFieldName?: string;
  businessClubFieldName?: string;
  targetGroupFieldName?: string;
  meetingTypeFieldName?: string;
  meetingDateFieldName?: string;
  contactTargetGroupFieldName?: string;
  legacyContactTargetGroupFieldName?: string;
  client: SyncClient;
  repository: SyncRepository;
  now: () => string;
  bootstrapLookbackDays?: number;
}

export const ATTRACTION_REFUSAL_REASON_FIELD_NAME = "UF_CRM_1647422744";
export const ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME = "UF_CRM_1647422890";
export const LEADGEN_US_CATEGORY_ID = "28";
export const LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME = "UF_CRM_1730360968";
export const LEADGEN_US_RETURN_REASON_FIELD_NAME = "UF_CRM_1758715585";
export const LEADGEN_US_BASKET_REASON_FIELD_NAME = "UF_CRM_1772109151192";
const TASK_ACTIVITY_PROVIDER_IDS = ["CRM_TODO", "CRM_TASKS_TASK"] as const;
const MISSING_CALL_ACTIVITY_BACKFILL_LIMIT = 20_000;
const MISSING_CALL_STATS_BACKFILL_LIMIT = 20_000;
const CALL_STATS_REFRESH_LIMIT = 20_000;
export const ACTIVITY_HISTORY_COVERAGE_VERSION = "activity-bindings-v2";
export const DEAL_CUSTOM_FIELDS_COVERAGE_STREAM = "deal_custom_fields";
export const DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER = "all";
export const DEAL_CUSTOM_FIELDS_COVERAGE_VERSION = "deal-custom-fields-v1";
export const DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM = "deal_meeting_date_field";
export const DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION =
  "deal-meeting-date-field-v1";
export const CALL_STATS_COVERAGE_STREAM = "call_stats";
export const CALL_STATS_COVERAGE_PROVIDER = "VOXIMPLANT_CALL";
export const CALL_STATS_COVERAGE_VERSION = "call-stats-refresh-v1";
const FULL_COVERAGE_FROM = "0000-01-01T00:00:00.000Z";
const CONTACT_TARGET_GROUP_VALUE_MAP = {
  "140488": "ClubFirst Russia",
  "140490": "ClubFirst GlobAll",
  "140492": "ClubFirst Kazakstan",
  "140494": "ClubFirst Guest",
  "140496": "ClubFirst Ladies"
} satisfies Record<string, string>;

type LinkedLeadgenLossContext = {
  basketReasonValue: string | null;
  returnReasonValue: string | null;
  refusalReasonDetail: string | null;
  updatedAt: string;
};

function normalizeMappedFieldValue(
  value: unknown,
  valueMap: Record<string, string>
): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return valueMap[String(value)] ?? String(value);
  }

  if (Array.isArray(value)) {
    const normalized: string[] = value
      .map((entry) => normalizeMappedFieldValue(entry, valueMap))
      .filter((entry): entry is string => Boolean(entry?.trim()));

    return normalized.length > 0 ? normalized.join(", ") : null;
  }

  return null;
}

function normalizeString(value: string | number | null | undefined) {
  return value === null || value === undefined ? null : String(value);
}

function isOpaqueBitrixEnumId(value: string | null) {
  return Boolean(value && /^\d+$/.test(value));
}

function sanitizeDealTargetGroupValue(value: string | null) {
  if (!value) {
    return null;
  }

  return isOpaqueBitrixEnumId(value) ? null : value;
}

function sanitizeRefusalReasonDetail(_value: string | null) {
  return null;
}

function extractLinkedDealId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const directMatch = trimmed.match(/^\d+$/);
    if (directMatch) {
      return directMatch[0];
    }

    const crmMatch = trimmed.match(/(?:^|[_:])(\d+)$/);
    if (crmMatch?.[1]) {
      return crmMatch[1];
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const linkedId = extractLinkedDealId(item);
      if (linkedId) {
        return linkedId;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      extractLinkedDealId(record.ID) ??
      extractLinkedDealId(record.id) ??
      extractLinkedDealId(record.VALUE) ??
      extractLinkedDealId(record.value)
    );
  }

  return null;
}

function resolveContactTargetGroupValue(input: {
  row: ContactRow;
  contactTargetGroupFieldName: string | undefined;
  legacyContactTargetGroupFieldName: string | undefined;
  legacyContactTargetGroupMap: Record<string, string>;
}) {
  const nextValue = input.contactTargetGroupFieldName
    ? normalizeMappedFieldValue(
        input.row[input.contactTargetGroupFieldName],
        CONTACT_TARGET_GROUP_VALUE_MAP
      )
    : null;

  const legacyValue = input.legacyContactTargetGroupFieldName
    ? normalizeMappedFieldValue(
        input.row[input.legacyContactTargetGroupFieldName],
        input.legacyContactTargetGroupMap
      )
    : null;
  const sanitizedNextValue = sanitizeDealTargetGroupValue(nextValue);

  return sanitizedNextValue ?? sanitizeDealTargetGroupValue(legacyValue);
}

function buildStageNameById(rows: StageCatalogEntry[]) {
  return new Map(
    rows
      .filter((row) => row.entityType === "deal")
      .map((row) => [row.statusId, row.name])
  );
}

function normalizeStageToken(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("ru");
}

function isReturnLossStage(stageId: string, stageName: string | undefined) {
  const normalizedStageName = normalizeStageToken(stageName);
  return (
    normalizedStageName.includes("возврат") ||
    normalizedStageName.includes("неквал") ||
    stageId.toUpperCase().includes("RETURN")
  );
}

function isBasketLossStage(stageId: string, stageName: string | undefined) {
  const normalizedStageName = normalizeStageToken(stageName);
  return (
    normalizedStageName.includes("корзин") ||
    stageId.toUpperCase().includes("LOSE")
  );
}

function buildLinkedLeadgenLossLookup(
  rows: DealRow[],
  returnReasonMap: Record<string, string>,
  basketReasonMap: Record<string, string>
) {
  const lookup = new Map<string, LinkedLeadgenLossContext>();

  for (const row of rows) {
    const attractionDealId = extractLinkedDealId(
      row[LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME]
    );
    if (!attractionDealId) {
      continue;
    }

    const candidate: LinkedLeadgenLossContext = {
      basketReasonValue: normalizeMappedFieldValue(
        row[LEADGEN_US_BASKET_REASON_FIELD_NAME],
        basketReasonMap
      ),
      returnReasonValue: normalizeMappedFieldValue(
        row[LEADGEN_US_RETURN_REASON_FIELD_NAME],
        returnReasonMap
      ),
      refusalReasonDetail: normalizeMappedFieldValue(
        row[ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME],
        {}
      ),
      updatedAt: row.DATE_MODIFY ?? row.DATE_CREATE
    };

    const current = lookup.get(attractionDealId);
    const currentTime = current ? Date.parse(current.updatedAt) : Number.NEGATIVE_INFINITY;
    const candidateTime = Date.parse(candidate.updatedAt);

    if (!current || candidateTime >= currentTime || !Number.isFinite(currentTime)) {
      lookup.set(attractionDealId, candidate);
    }
  }

  return lookup;
}

function resolveLossFields(
  row: DealRow,
  genericReasonValue: string | null,
  genericReasonDetail: string | null,
  stageNameById: Map<string, string>,
  linkedLeadgenLossLookup: Map<string, LinkedLeadgenLossContext>
) {
  if (genericReasonValue || genericReasonDetail) {
    return {
      refusalReasonValue: genericReasonValue,
      refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail)
    };
  }

  const linked = linkedLeadgenLossLookup.get(row.ID);
  if (!linked) {
    return {
      refusalReasonValue: genericReasonValue,
      refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail)
    };
  }

  const stageName = stageNameById.get(row.STAGE_ID);
  if (isReturnLossStage(row.STAGE_ID, stageName)) {
    return {
      refusalReasonValue: linked.returnReasonValue ?? genericReasonValue,
      refusalReasonDetail: sanitizeRefusalReasonDetail(
        linked.refusalReasonDetail ?? genericReasonDetail
      )
    };
  }

  if (isBasketLossStage(row.STAGE_ID, stageName)) {
    return {
      refusalReasonValue: linked.basketReasonValue ?? genericReasonValue,
      refusalReasonDetail: sanitizeRefusalReasonDetail(
        linked.refusalReasonDetail ?? genericReasonDetail
      )
    };
  }

  return {
    refusalReasonValue: genericReasonValue,
    refusalReasonDetail: sanitizeRefusalReasonDetail(genericReasonDetail)
  };
}

function mapDealRow(
  row: DealRow,
  qualityFieldName: string,
  tariffFieldName: string | undefined,
  businessClubFieldName: string | undefined,
  targetGroupFieldName: string | undefined,
  meetingTypeFieldName: string | undefined,
  meetingDateFieldName: string | undefined,
  contactTargetGroupByContactId: Map<string, string>,
  qualityMap: Record<string, string>,
  tariffMap: Record<string, string>,
  businessClubMap: Record<string, string>,
  targetGroupMap: Record<string, string>,
  meetingTypeMap: Record<string, string>,
  refusalReasonMap: Record<string, string>,
  stageNameById: Map<string, string>,
  linkedLeadgenLossLookup: Map<string, LinkedLeadgenLossContext>
): DealSnapshot {
  const normalizedQualityValue = normalizeMappedFieldValue(
    row[qualityFieldName],
    qualityMap
  );
  const normalizedTariffValue = tariffFieldName
    ? normalizeMappedFieldValue(row[tariffFieldName], tariffMap)
    : null;
  const normalizedBusinessClubValue = businessClubFieldName
    ? normalizeMappedFieldValue(row[businessClubFieldName], businessClubMap)
    : null;
  const normalizedDealTargetGroupValue = sanitizeDealTargetGroupValue(
    targetGroupFieldName
      ? normalizeMappedFieldValue(row[targetGroupFieldName], targetGroupMap)
      : null
  );
  const normalizedTargetGroupValue =
    normalizedDealTargetGroupValue ??
    (row.CONTACT_ID
      ? contactTargetGroupByContactId.get(row.CONTACT_ID) ?? null
      : null);
  const normalizedMeetingTypeValue = meetingTypeFieldName
    ? normalizeMappedFieldValue(row[meetingTypeFieldName], meetingTypeMap)
    : null;
  const normalizedMeetingDateValue = meetingDateFieldName
    ? normalizeMappedFieldValue(row[meetingDateFieldName], {})
    : null;
  const genericReasonValue = normalizeMappedFieldValue(
    row[ATTRACTION_REFUSAL_REASON_FIELD_NAME],
    refusalReasonMap
  );
  const genericReasonDetail = normalizeMappedFieldValue(
    row[ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME],
    {}
  );
  const resolvedLossFields = resolveLossFields(
    row,
    genericReasonValue,
    genericReasonDetail,
    stageNameById,
    linkedLeadgenLossLookup
  );

  return {
    id: row.ID,
    title: null,
    leadId: row.LEAD_ID,
    categoryId: row.CATEGORY_ID,
    stageId: row.STAGE_ID,
    stageSemanticId: row.STAGE_SEMANTIC_ID,
    opportunity: row.OPPORTUNITY,
    assignedById: row.ASSIGNED_BY_ID,
    sourceId: row.SOURCE_ID,
    qualityValue: normalizedQualityValue,
    businessClubValue: normalizedBusinessClubValue,
    targetGroupValue: normalizedTargetGroupValue,
    meetingTypeValue: normalizedMeetingTypeValue,
    meetingDateValue: normalizedMeetingDateValue,
    tariffValue: normalizedTariffValue,
    refusalReasonValue: resolvedLossFields.refusalReasonValue,
    refusalReasonDetail: sanitizeRefusalReasonDetail(
      resolvedLossFields.refusalReasonDetail
    ),
    dateCreate: row.DATE_CREATE,
    dateModify: row.DATE_MODIFY,
    dateClosed: row.DATE_CLOSED ?? null,
    utmSource: row.UTM_SOURCE,
    utmMedium: row.UTM_MEDIUM,
    utmCampaign: row.UTM_CAMPAIGN,
    utmContent: row.UTM_CONTENT,
    utmTerm: row.UTM_TERM
  };
}

function mapStageHistoryRow(row: StageHistoryRow): StageHistorySnapshot {
  return {
    id: String(row.ID),
    ownerId: String(row.OWNER_ID),
    categoryId:
      row.CATEGORY_ID === null || row.CATEGORY_ID === undefined
        ? null
        : String(row.CATEGORY_ID),
    stageId: row.STAGE_ID,
    stageSemanticId: row.STAGE_SEMANTIC_ID,
    typeId: row.TYPE_ID,
    createdTime: row.CREATED_TIME
  };
}

function mapActivityRow(row: ActivityRow): ActivitySnapshot {
  const completed = row.COMPLETED === "Y";

  return {
    id: String(row.ID),
    ownerTypeId: String(row.OWNER_TYPE_ID),
    ownerId: String(row.OWNER_ID),
    typeId: normalizeString(row.TYPE_ID),
    providerId: row.PROVIDER_ID,
    responsibleId: normalizeString(row.RESPONSIBLE_ID),
    createdTime: row.CREATED,
    deadline: row.DEADLINE ?? null,
    lastUpdated: row.LAST_UPDATED,
    completed,
    completedTime: completed ? row.COMPLETED_DATE ?? row.LAST_UPDATED : null
  };
}

function mapCallRow(row: CallRow): CallSnapshot {
  const duration =
    typeof row.CALL_DURATION === "number"
      ? row.CALL_DURATION
      : Number(row.CALL_DURATION ?? 0);

  return {
    id: String(row.ID),
    crmActivityId: normalizeString(row.CRM_ACTIVITY_ID),
    portalUserId: normalizeString(row.PORTAL_USER_ID),
    callType: normalizeString(row.CALL_TYPE),
    callStartDate: row.CALL_START_DATE,
    callDurationSeconds: Number.isFinite(duration) ? duration : 0,
    crmEntityType: row.CRM_ENTITY_TYPE,
    crmEntityId: normalizeString(row.CRM_ENTITY_ID),
    callFailedCode: normalizeString(row.CALL_FAILED_CODE)
  };
}

function mapUserRow(row: UserRow): ManagerDirectoryEntry {
  const fullName = [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim();

  return {
    id: String(row.ID),
    name: fullName || String(row.ID)
  };
}

async function fetchManagerDirectory(
  client: SyncClient,
  managerIds: Array<string | null | undefined>
) {
  const ids = Array.from(
    new Set(managerIds.filter((value): value is string => Boolean(value)))
  );

  if (ids.length === 0) {
    return [];
  }

  try {
    return (await client.fetchUsers({ ids })).map(mapUserRow);
  } catch (error) {
    console.warn("Skipping manager directory sync:", error);
    return [];
  }
}

function buildDeadlineChanges(
  previousActivities: ActivitySnapshot[],
  nextActivities: ActivitySnapshot[]
) {
  const previousById = new Map(
    previousActivities.map((activity) => [activity.id, activity])
  );

  return nextActivities.flatMap<ActivityDeadlineChangeSnapshot>((activity) => {
    const previous = previousById.get(activity.id);
    if (!previous || previous.deadline === activity.deadline) {
      return [];
    }

    return [
      {
        id: `${activity.id}:${activity.lastUpdated}`,
        activityId: activity.id,
        ownerId: activity.ownerId,
        responsibleId: activity.responsibleId,
        previousDeadline: previous.deadline,
        nextDeadline: activity.deadline,
        changedAt: activity.lastUpdated
      }
    ];
  });
}

function resolveBootstrapModifiedAfter(
  nowIso: string,
  lookbackDays: number | undefined
) {
  if (!lookbackDays || !Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    return null;
  }

  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) {
    return null;
  }

  const cutoff = new Date(nowMs);
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.trunc(lookbackDays));
  return cutoff.toISOString();
}

function isActivityUpdatedAfter(row: ActivityRow, modifiedAfter: string | null) {
  if (!modifiedAfter) {
    return true;
  }

  const updatedAt = Date.parse(row.LAST_UPDATED);
  const cutoff = Date.parse(modifiedAfter);

  return Number.isFinite(updatedAt) && Number.isFinite(cutoff) && updatedAt >= cutoff;
}

export function buildCategoryScopeKey(categoryIds: string[]) {
  return `category:${[...categoryIds].sort().join(",")}`;
}

function buildSyncCursorKey(scopeKey: string, stream: "deals" | "activities") {
  return stream === "deals"
    ? `${scopeKey}:deals:date_modify`
    : `${scopeKey}:activities:last_updated`;
}

async function resolveSyncCursor(
  repository: SyncRepository,
  key: string,
  fallback: string | null
) {
  return repository.getSyncCursor ? (await repository.getSyncCursor(key)) ?? fallback : fallback;
}

async function hasActivityProviderCoverage(input: {
  repository: SyncRepository;
  scopeKey: string;
  providerId: string;
  requiredFrom: string | null;
}) {
  if (!input.repository.hasSyncCoverage || !input.requiredFrom) {
    return true;
  }

  return input.repository.hasSyncCoverage({
    scopeKey: input.scopeKey,
    stream: "activity_history",
    providerId: input.providerId,
    requiredFrom: input.requiredFrom,
    algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION
  });
}

async function hasSyncCoverage(input: {
  repository: SyncRepository;
  scopeKey: string;
  stream: string;
  providerId: string;
  requiredFrom: string | null;
  algorithmVersion: string;
}) {
  if (!input.repository.hasSyncCoverage || !input.requiredFrom) {
    return true;
  }

  return input.repository.hasSyncCoverage({
    scopeKey: input.scopeKey,
    stream: input.stream,
    providerId: input.providerId,
    requiredFrom: input.requiredFrom,
    algorithmVersion: input.algorithmVersion
  });
}

function runSnapshotTransaction<T>(
  repository: SyncRepository,
  task: () => T
) {
  return repository.runSnapshotTransaction
    ? repository.runSnapshotTransaction(task)
    : task();
}

export async function performManualSync(
  input: PerformManualSyncInput
): Promise<ManualSyncSummary> {
  const [
    modifiedAfter,
    operationalHistoryBootstrappedAt,
    callHistoryBootstrappedAt,
    activitySnapshotCount
  ] = await Promise.all([
    input.repository.getLatestSuccessCursor(input.categoryIds),
    input.repository.getOperationalHistoryBootstrappedAt(),
    input.repository.getCallHistoryBootstrappedAt(),
    input.repository.getActivitySnapshotCount()
  ]);
  const scopeKey = buildCategoryScopeKey(input.categoryIds);
  const dealCursorKey = buildSyncCursorKey(scopeKey, "deals");
  const activityCursorKey = buildSyncCursorKey(scopeKey, "activities");
  const [dealCursor, activityCursor] = await Promise.all([
    resolveSyncCursor(input.repository, dealCursorKey, modifiedAfter),
    resolveSyncCursor(input.repository, activityCursorKey, modifiedAfter)
  ]);
  const callActivityHistoryBootstrappedAt =
    input.repository.getCallActivityHistoryBootstrappedAt
      ? await input.repository.getCallActivityHistoryBootstrappedAt()
      : callHistoryBootstrappedAt;
  const meetingActivityHistoryBootstrappedAt =
    input.repository.getMeetingActivityHistoryBootstrappedAt
      ? await input.repository.getMeetingActivityHistoryBootstrappedAt()
      : "__legacy__";
  const taskActivityHistoryBootstrappedAt =
    input.repository.getTaskActivityHistoryBootstrappedAt
      ? await input.repository.getTaskActivityHistoryBootstrappedAt()
      : "__legacy__";
  const dealCustomFieldsBootstrappedAt =
    input.repository.getDealCustomFieldsBootstrappedAt
      ? await input.repository.getDealCustomFieldsBootstrappedAt()
      : "__legacy__";
  const dealMeetingDateFieldBootstrappedAt =
    input.meetingDateFieldName &&
    input.repository.getDealMeetingDateFieldBootstrappedAt
      ? await input.repository.getDealMeetingDateFieldBootstrappedAt()
      : "__legacy__";
  const startedAt = input.now();
  const bootstrapModifiedAfter = resolveBootstrapModifiedAfter(
    startedAt,
    input.bootstrapLookbackDays
  );
  const [
    hasCallActivityHistoryCoverage,
    hasMeetingActivityHistoryCoverage,
    hasDealCustomFieldsCoverage,
    hasDealMeetingDateFieldCoverage,
    hasCallStatsCoverage,
    ...taskActivityHistoryCoverage
  ] = await Promise.all([
    hasActivityProviderCoverage({
      repository: input.repository,
      scopeKey,
      providerId: "VOXIMPLANT_CALL",
      requiredFrom: bootstrapModifiedAfter
    }),
    hasActivityProviderCoverage({
      repository: input.repository,
      scopeKey,
      providerId: "CRM_MEETING",
      requiredFrom: bootstrapModifiedAfter
    }),
    hasSyncCoverage({
      repository: input.repository,
      scopeKey,
      stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
      providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
      requiredFrom: bootstrapModifiedAfter,
      algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION
    }),
    input.meetingDateFieldName
      ? hasSyncCoverage({
          repository: input.repository,
          scopeKey,
          stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
          providerId: input.meetingDateFieldName,
          requiredFrom: bootstrapModifiedAfter,
          algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION
        })
      : true,
    hasSyncCoverage({
      repository: input.repository,
      scopeKey,
      stream: CALL_STATS_COVERAGE_STREAM,
      providerId: CALL_STATS_COVERAGE_PROVIDER,
      requiredFrom: bootstrapModifiedAfter,
      algorithmVersion: CALL_STATS_COVERAGE_VERSION
    }),
    ...TASK_ACTIVITY_PROVIDER_IDS.map((providerId) =>
      hasActivityProviderCoverage({
        repository: input.repository,
        scopeKey,
        providerId,
        requiredFrom: bootstrapModifiedAfter
      })
    )
  ]);
  const runModifiedAfter = dealCursor;
  const mode = runModifiedAfter === null ? "full" : "delta";
  const shouldBootstrapOperationalHistory =
    !operationalHistoryBootstrappedAt && activitySnapshotCount === 0;
  const shouldBootstrapCallActivityHistory =
    !callActivityHistoryBootstrappedAt || !hasCallActivityHistoryCoverage;
  const shouldBootstrapMeetingActivityHistory =
    !meetingActivityHistoryBootstrappedAt || !hasMeetingActivityHistoryCoverage;
  const taskActivityProvidersToBootstrap = TASK_ACTIVITY_PROVIDER_IDS.filter(
    (_providerId, index) =>
      !taskActivityHistoryBootstrappedAt || !taskActivityHistoryCoverage[index]
  );
  const shouldBootstrapTaskActivityHistory =
    taskActivityProvidersToBootstrap.length > 0;
  const shouldBootstrapDealCustomFields =
    !dealCustomFieldsBootstrappedAt || !hasDealCustomFieldsCoverage;
  const shouldBootstrapDealMeetingDateField =
    Boolean(input.meetingDateFieldName) &&
    (!dealMeetingDateFieldBootstrappedAt || !hasDealMeetingDateFieldCoverage);
  const shouldRefreshCallStatsCoverage = !hasCallStatsCoverage;
  const shouldBootstrapAnyDealFields =
    shouldBootstrapDealCustomFields || shouldBootstrapDealMeetingDateField;
  const dealModifiedAfter = shouldBootstrapAnyDealFields
    ? bootstrapModifiedAfter
    : dealCursor;
  const activityModifiedAfter = shouldBootstrapOperationalHistory
    ? bootstrapModifiedAfter
    : activityCursor;
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter: runModifiedAfter
  });

  try {
    const shouldFetchLeadgenReasons = input.categoryIds.includes("10");
    const [
      dealStages,
      sourceCatalog,
      qualityMap,
      tariffMap,
      businessClubMap,
      targetGroupMap,
      meetingTypeMap,
      legacyContactTargetGroupMap,
      refusalReasonMap,
      leadgenReturnReasonMap,
      leadgenBasketReasonMap,
      dealRows,
      leadgenReasonRows
    ] = await Promise.all([
      input.client.fetchDealStages(input.categoryIds),
      input.client.fetchSourceCatalog(),
      input.client.fetchDealQualityMap(input.qualityFieldName),
      input.tariffFieldName && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.tariffFieldName)
        : Promise.resolve({}),
      input.businessClubFieldName && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.businessClubFieldName)
        : Promise.resolve({}),
      input.targetGroupFieldName && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.targetGroupFieldName)
        : Promise.resolve({}),
      input.meetingTypeFieldName && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.meetingTypeFieldName)
        : Promise.resolve({}),
      input.legacyContactTargetGroupFieldName &&
      input.client.fetchContactFieldValueMap
        ? input.client.fetchContactFieldValueMap(
            input.legacyContactTargetGroupFieldName
          )
        : Promise.resolve({}),
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(ATTRACTION_REFUSAL_REASON_FIELD_NAME)
        : Promise.resolve({}),
      shouldFetchLeadgenReasons && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(LEADGEN_US_RETURN_REASON_FIELD_NAME)
        : Promise.resolve({}),
      shouldFetchLeadgenReasons && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(LEADGEN_US_BASKET_REASON_FIELD_NAME)
        : Promise.resolve({}),
      input.client.listDeals({
        modifiedAfter: dealModifiedAfter,
        categoryIds: input.categoryIds,
        qualityFieldName: input.qualityFieldName,
        customFieldNames: [
          input.qualityFieldName,
          ...(input.tariffFieldName ? [input.tariffFieldName] : []),
          ...(input.businessClubFieldName ? [input.businessClubFieldName] : []),
          ...(input.targetGroupFieldName ? [input.targetGroupFieldName] : []),
          ...(input.meetingTypeFieldName ? [input.meetingTypeFieldName] : []),
          ...(input.meetingDateFieldName ? [input.meetingDateFieldName] : []),
          ATTRACTION_REFUSAL_REASON_FIELD_NAME,
          ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME
        ]
      }),
      shouldFetchLeadgenReasons
        ? input.client.listDeals({
            modifiedAfter: dealModifiedAfter,
            categoryIds: [LEADGEN_US_CATEGORY_ID],
            customFieldNames: [
              LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME,
              ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
              LEADGEN_US_RETURN_REASON_FIELD_NAME,
              LEADGEN_US_BASKET_REASON_FIELD_NAME
            ]
          })
        : Promise.resolve([])
    ]);

    const contactIds = Array.from(
      new Set(
        dealRows
          .map((row) => row.CONTACT_ID)
          .filter((value): value is string => Boolean(value))
      )
    );
    const contactRows =
      contactIds.length > 0 &&
      input.contactTargetGroupFieldName &&
      input.client.listContacts
        ? await input.client.listContacts({
            ids: contactIds,
            customFieldNames: [
              input.contactTargetGroupFieldName,
              ...(input.legacyContactTargetGroupFieldName
                ? [input.legacyContactTargetGroupFieldName]
                : [])
            ]
          })
        : [];
    const contactTargetGroupByContactId = new Map(
      contactRows.flatMap((row) => {
        const targetGroupValue = resolveContactTargetGroupValue({
          row,
          contactTargetGroupFieldName: input.contactTargetGroupFieldName,
          legacyContactTargetGroupFieldName:
            input.legacyContactTargetGroupFieldName,
          legacyContactTargetGroupMap
        });

        return targetGroupValue ? [[row.ID, targetGroupValue] as const] : [];
      })
    );
    const stageNameById = buildStageNameById(dealStages);
    const linkedLeadgenLossLookup = buildLinkedLeadgenLossLookup(
      leadgenReasonRows,
      leadgenReturnReasonMap,
      leadgenBasketReasonMap
    );
    const deals = dealRows.map((row) =>
      mapDealRow(
        row,
        input.qualityFieldName,
        input.tariffFieldName,
        input.businessClubFieldName,
        input.targetGroupFieldName,
        input.meetingTypeFieldName,
        input.meetingDateFieldName,
        contactTargetGroupByContactId,
        qualityMap,
        tariffMap,
        businessClubMap,
        targetGroupMap,
        meetingTypeMap,
        refusalReasonMap,
        stageNameById,
        linkedLeadgenLossLookup
      )
    );
    const dealsSynced = deals.length;

    const ownerIds = Array.from(
      new Set([
        ...(await input.repository.getDealIdsByCategoryIds(input.categoryIds)),
        ...deals.map((deal) => deal.id)
      ])
    );

    const historicalActivityRequests: Array<{
      providerId: string;
      request: Promise<ActivityRow[]>;
    }> = [];
    if (shouldBootstrapCallActivityHistory) {
      historicalActivityRequests.push({
        providerId: "VOXIMPLANT_CALL",
        request: input.client.listActivities({
          ownerIds,
          modifiedAfter: bootstrapModifiedAfter,
          providerId: "VOXIMPLANT_CALL"
        })
      });
    }
    if (shouldBootstrapMeetingActivityHistory) {
      historicalActivityRequests.push({
        providerId: "CRM_MEETING",
        request: input.client.listActivities({
          ownerIds,
          modifiedAfter: bootstrapModifiedAfter,
          providerId: "CRM_MEETING"
        })
      });
    }
    if (shouldBootstrapTaskActivityHistory) {
      for (const providerId of taskActivityProvidersToBootstrap) {
        historicalActivityRequests.push({
          providerId,
          request: input.client.listActivities({
            ownerIds,
            modifiedAfter: bootstrapModifiedAfter,
            providerId
          })
        });
      }
    }
    const [deltaActivityRows, historicalActivityGroups] = await Promise.all([
      input.client.listActivities({
        ownerIds,
        modifiedAfter: activityModifiedAfter
      }),
      Promise.all(historicalActivityRequests.map((entry) => entry.request))
    ]);
    const historicalActivityRows = historicalActivityGroups.flat();
    const syncedActivityRows = Array.from(
      new Map(
        [
          ...historicalActivityRows.filter((row) =>
            isActivityUpdatedAfter(row, bootstrapModifiedAfter)
          ),
          ...deltaActivityRows
        ].map((row) => [String(row.ID), row])
      ).values()
    );
    const missingCallActivityIds =
      input.repository.getCallActivityIdsMissingActivities &&
      input.client.listActivitiesByIds
        ? await input.repository.getCallActivityIdsMissingActivities(
            MISSING_CALL_ACTIVITY_BACKFILL_LIMIT,
            bootstrapModifiedAfter
          )
        : [];
    const missingCallActivityRows =
      missingCallActivityIds.length > 0 && input.client.listActivitiesByIds
        ? (await input.client.listActivitiesByIds(missingCallActivityIds)).filter(
            (row) => String(row.OWNER_TYPE_ID) === "2"
          )
        : [];
    const activityRows = Array.from(
      new Map(
        [...syncedActivityRows, ...missingCallActivityRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const missingCallStatsActivityIds =
      input.repository.getCallActivityIdsMissingCallStats
        ? await input.repository.getCallActivityIdsMissingCallStats(
            MISSING_CALL_STATS_BACKFILL_LIMIT,
            bootstrapModifiedAfter
          )
        : [];
    const callStatsRefreshActivityIds =
      shouldRefreshCallStatsCoverage &&
      input.repository.getCallActivityIdsForCallStatsRefresh
        ? await input.repository.getCallActivityIdsForCallStatsRefresh(
            CALL_STATS_REFRESH_LIMIT,
            bootstrapModifiedAfter
          )
        : [];

    const activityIds = Array.from(
      new Set(activityRows.map((row) => String(row.ID)))
    );
    const previousActivities =
      activityIds.length > 0
        ? await input.repository.getActivitiesByIds(activityIds)
        : [];
    const activities = activityRows.map(mapActivityRow);
    const deadlineChanges = buildDeadlineChanges(previousActivities, activities);
    const callActivityIds = Array.from(
      new Set(
        [
          ...activityRows
            .filter((row) => row.PROVIDER_ID === "VOXIMPLANT_CALL")
            .map((row) => String(row.ID)),
          ...callStatsRefreshActivityIds,
          ...missingCallStatsActivityIds
        ]
      )
    );
    const callRowsByActivity =
      callActivityIds.length > 0
        ? await input.client.listCalls({
            activityIds: callActivityIds
          })
        : [];
    const supplementalCallRows = shouldRefreshCallStatsCoverage
      ? await input.client.listCalls({
          callStartDateFrom: bootstrapModifiedAfter ?? FULL_COVERAGE_FROM,
          callStartDateTo: startedAt,
          portalUserIds: ATTRACTION_MANAGER_IDS
        })
      : [];
    const callRows = Array.from(
      new Map(
        [...callRowsByActivity, ...supplementalCallRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const managerIds = Array.from(
      new Set(
        [
          ...dealRows.map((row) => row.ASSIGNED_BY_ID),
          ...activityRows.map((row) => row.RESPONSIBLE_ID),
          ...callRows.map((row) => row.PORTAL_USER_ID)
        ]
          .map(normalizeString)
          .filter((value): value is string => Boolean(value))
      )
    );

    const managerDirectory = await fetchManagerDirectory(input.client, managerIds);
    const stageHistoryRows = await input.client.listStageHistory({
      categoryIds: input.categoryIds
    });
    const stageHistory = stageHistoryRows.map(mapStageHistoryRow);
    const calls = callRows.map(mapCallRow);

    const finishedAt = input.now();
    const persistedAt = input.now();

    runSnapshotTransaction(input.repository, () => {
      void input.repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);
      void input.repository.upsertDeals(deals);

      if (!callHistoryBootstrappedAt) {
        void input.repository.markCallHistoryBootstrapped(persistedAt);
      }

      void input.repository.upsertActivities(activities);
      void input.repository.upsertActivityDeadlineChanges(deadlineChanges);
      void input.repository.upsertCalls(calls);
      void input.repository.upsertManagerDirectory(managerDirectory);

      if (input.repository.setSyncCursor) {
        void input.repository.setSyncCursor({
          key: dealCursorKey,
          cursorValue: startedAt,
          updatedAt: persistedAt
        });
        void input.repository.setSyncCursor({
          key: activityCursorKey,
          cursorValue: startedAt,
          updatedAt: persistedAt
        });
      }

      if (input.repository.upsertSyncCoverage && bootstrapModifiedAfter) {
        for (const entry of historicalActivityRequests) {
          void input.repository.upsertSyncCoverage({
            scopeKey,
            stream: "activity_history",
            providerId: entry.providerId,
            coveredFrom: bootstrapModifiedAfter,
            coveredTo: null,
            algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION,
            syncedAt: persistedAt
          });
        }
      }

      if (input.repository.upsertSyncCoverage && shouldBootstrapDealCustomFields) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
          providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
          coveredFrom: dealModifiedAfter ?? FULL_COVERAGE_FROM,
          coveredTo: null,
          algorithmVersion: DEAL_CUSTOM_FIELDS_COVERAGE_VERSION,
          syncedAt: persistedAt
        });
      }

      if (
        input.repository.upsertSyncCoverage &&
        input.meetingDateFieldName &&
        shouldBootstrapDealMeetingDateField
      ) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: DEAL_MEETING_DATE_FIELD_COVERAGE_STREAM,
          providerId: input.meetingDateFieldName,
          coveredFrom: dealModifiedAfter ?? FULL_COVERAGE_FROM,
          coveredTo: null,
          algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION,
          syncedAt: persistedAt
        });
      }

      if (input.repository.upsertSyncCoverage && shouldRefreshCallStatsCoverage) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: CALL_STATS_COVERAGE_STREAM,
          providerId: CALL_STATS_COVERAGE_PROVIDER,
          coveredFrom: bootstrapModifiedAfter ?? FULL_COVERAGE_FROM,
          coveredTo: null,
          algorithmVersion: CALL_STATS_COVERAGE_VERSION,
          syncedAt: persistedAt
        });
      }

      if (shouldBootstrapCallActivityHistory) {
        void input.repository.markCallActivityHistoryBootstrapped?.(persistedAt);
      }

      if (shouldBootstrapMeetingActivityHistory) {
        void input.repository.markMeetingActivityHistoryBootstrapped?.(
          persistedAt
        );
      }

      if (shouldBootstrapTaskActivityHistory) {
        void input.repository.markTaskActivityHistoryBootstrapped?.(persistedAt);
      }

      if (shouldBootstrapDealCustomFields) {
        void input.repository.markDealCustomFieldsBootstrapped?.(persistedAt);
      }

      if (shouldBootstrapDealMeetingDateField) {
        void input.repository.markDealMeetingDateFieldBootstrapped?.(persistedAt);
      }

      if (shouldBootstrapOperationalHistory) {
        void input.repository.markOperationalHistoryBootstrapped(persistedAt);
      }

      void input.repository.upsertStageHistory(stageHistory);

      void input.repository.finishSyncRun({
        syncRunId,
        finishedAt,
        status: "success",
        leadsSynced: 0,
        dealsSynced,
        modifiedAfter: runModifiedAfter
      });
    });

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt
    };
  } catch (error) {
    await input.repository.failSyncRun({
      syncRunId,
      finishedAt: input.now(),
      status: "failed"
    });
    throw error;
  }
}
