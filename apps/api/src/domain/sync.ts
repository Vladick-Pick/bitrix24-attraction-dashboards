import type {
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  ManagerDirectoryEntry,
  ManualSyncSummary,
  SnapshotStats,
  StageCatalogEntry,
  StageHistorySnapshot,
  SyncChangeSummary,
  SyncProgressEvent,
  SyncProgressPhase
} from "@bitrix24-reporting/contracts";

import { ATTRACTION_MANAGER_IDS } from "./attraction-managers.js";

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
    assignedByIds?: string[];
    qualityFieldName?: string;
    customFieldNames?: string[];
  }): Promise<DealRow[]>;
  fetchConversionEventDealFieldName?(): Promise<string | null>;
  listConversionEventVisits?(input: {
    modifiedAfter: string | null;
    reportYear: number;
  }): Promise<ConversionEventVisitSnapshot[]>;
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

export interface SuccessfulSyncScope {
  scopeKey: string;
  categoryIds: string[];
  assignedByIds: string[];
}

export interface SyncRepository {
  getLatestSuccessCursor(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<string | null>;
  getLatestSuccessfulScope?(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<SuccessfulSyncScope | null>;
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
    requiredSyncedAt?: string | null;
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
  getSnapshotStats?(scope?: SnapshotStatsScope): Promise<SnapshotStats>;
  getStageCatalog?(): Promise<StageCatalogEntry[]>;
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getOpenDealIdsByCategoryIds?(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getDealsByIds?(dealIds: string[]): Promise<DealSnapshot[]>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
  getCallActivityIdsMissingActivities?(
    limit?: number,
    callStartDateFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsMissingCallStats?(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsForCallStatsRefresh?(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertDeals(rows: DealSnapshot[]): Promise<number>;
  upsertStageHistory(rows: StageHistorySnapshot[]): Promise<number>;
  upsertActivities(rows: ActivitySnapshot[]): Promise<number>;
  upsertActivityDeadlineChanges(
    rows: ActivityDeadlineChangeSnapshot[]
  ): Promise<number>;
  upsertDealMeetingDateChanges?(
    rows: DealMeetingDateChangeSnapshot[]
  ): Promise<number>;
  upsertConversionEventVisits?(
    rows: ConversionEventVisitSnapshot[]
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
    scopeKey: string;
  }): Promise<number>;
  failSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "failed";
    diagnostics?: string[];
  }): Promise<void>;
  finishSyncRun(input: {
    syncRunId: number;
    finishedAt: string;
    status: "success";
    leadsSynced: number;
    dealsSynced: number;
    dealBreakdown?: SyncChangeSummary["dealBreakdown"];
    diagnostics?: string[];
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
  onProgress?: (event: SyncProgressEvent) => void;
}

export interface SnapshotStatsScope {
  categoryIds?: string[];
  assignedByIds?: string[];
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
export const CALL_STATS_COVERAGE_VERSION = "call-stats-refresh-v3";
export const CONVERSION_EVENT_VISITS_COVERAGE_STREAM =
  "conversion_event_visits";
export const CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER = "smart_process";
export const CONVERSION_EVENT_VISITS_COVERAGE_VERSION =
  "conversion-event-visits-v1";
export const FULL_COVERAGE_FROM = "0000-01-01T00:00:00.000Z";
const EMPTY_SNAPSHOT_STATS: SnapshotStats = {
  deals: 0,
  activities: 0,
  calls: 0,
  stageHistory: 0
};
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
  conversionEventFieldName: string | undefined,
  contactTargetGroupByContactId: Map<string, string>,
  qualityMap: Record<string, string>,
  tariffMap: Record<string, string>,
  businessClubMap: Record<string, string>,
  targetGroupMap: Record<string, string>,
  meetingTypeMap: Record<string, string>,
  conversionEventMap: Record<string, string>,
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
  const normalizedConversionEventValue = conversionEventFieldName
    ? normalizeMappedFieldValue(row[conversionEventFieldName], conversionEventMap)
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
    contactId: row.CONTACT_ID ?? null,
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
    conversionEventValue: normalizedConversionEventValue,
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

function isOpenDealSnapshot(deal: DealSnapshot) {
  return deal.stageSemanticId === "P";
}

const DEAL_SNAPSHOT_CHANGE_FIELDS: Array<keyof DealSnapshot> = [
  "leadId",
  "contactId",
  "categoryId",
  "stageId",
  "stageSemanticId",
  "opportunity",
  "assignedById",
  "sourceId",
  "qualityValue",
  "businessClubValue",
  "targetGroupValue",
  "meetingTypeValue",
  "meetingDateValue",
  "tariffValue",
  "conversionEventValue",
  "refusalReasonValue",
  "refusalReasonDetail",
  "dateCreate",
  "dateModify",
  "dateClosed",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm"
];

function hasDealSnapshotChanged(previous: DealSnapshot, next: DealSnapshot) {
  return DEAL_SNAPSHOT_CHANGE_FIELDS.some(
    (field) => (previous[field] ?? null) !== (next[field] ?? null)
  );
}

function buildDealChangeBreakdown(input: {
  deals: DealSnapshot[];
  previousDeals: DealSnapshot[];
}): SyncChangeSummary["dealBreakdown"] {
  const previousById = new Map(input.previousDeals.map((deal) => [deal.id, deal]));
  const breakdown: SyncChangeSummary["dealBreakdown"] = {
    total: input.deals.length,
    created: 0,
    updated: 0,
    closed: 0,
    reopened: 0,
    unchanged: 0
  };

  for (const deal of input.deals) {
    const previous = previousById.get(deal.id);
    if (!previous) {
      breakdown.created += 1;
      continue;
    }

    const wasOpen = isOpenDealSnapshot(previous);
    const isOpen = isOpenDealSnapshot(deal);
    if (wasOpen && !isOpen) {
      breakdown.closed += 1;
    } else if (!wasOpen && isOpen) {
      breakdown.reopened += 1;
    } else if (hasDealSnapshotChanged(previous, deal)) {
      breakdown.updated += 1;
    } else {
      breakdown.unchanged += 1;
    }
  }

  return breakdown;
}

function buildDealMeetingDateChanges(input: {
  deals: DealSnapshot[];
  previousDeals: DealSnapshot[];
}) {
  const previousById = new Map(input.previousDeals.map((deal) => [deal.id, deal]));

  return input.deals.flatMap<DealMeetingDateChangeSnapshot>((deal) => {
    const previous = previousById.get(deal.id);
    if (
      !previous ||
      (previous.meetingDateValue ?? null) === (deal.meetingDateValue ?? null)
    ) {
      return [];
    }

    return [
      {
        id: `${deal.id}:${deal.dateModify}:meeting-date`,
        dealId: deal.id,
        assignedById: deal.assignedById,
        previousMeetingDate: previous.meetingDateValue ?? null,
        nextMeetingDate: deal.meetingDateValue ?? null,
        changedAt: deal.dateModify
      }
    ];
  });
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

export function buildCategoryScopeKey(
  categoryIds: string[],
  assignedByIds: string[] = []
) {
  const categoryScope = `category:${[...categoryIds].sort().join(",")}`;

  if (assignedByIds.length === 0) {
    return categoryScope;
  }

  return `${categoryScope}:assigned:${[...assignedByIds].sort().join(",")}`;
}

function differenceStringValues(values: string[], coveredValues: string[]) {
  const covered = new Set(coveredValues.map(String));
  return values.filter((value) => !covered.has(String(value)));
}

function buildSyncCursorKey(
  scopeKey: string,
  stream: "deals" | "activities" | "call_stats"
) {
  if (stream === "deals") {
    return `${scopeKey}:deals:date_modify`;
  }

  if (stream === "activities") {
    return `${scopeKey}:activities:last_updated`;
  }

  return `${scopeKey}:call_stats:call_start_date`;
}

async function getSnapshotStats(
  repository: SyncRepository,
  scope?: SnapshotStatsScope
) {
  return repository.getSnapshotStats
    ? repository.getSnapshotStats(scope)
    : EMPTY_SNAPSHOT_STATS;
}

function timestampValue(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function maxTimestamp(values: Array<string | null | undefined>) {
  let selected: string | null = null;
  let selectedTime = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    const parsed = timestampValue(value);
    if (parsed > selectedTime && value) {
      selected = value;
      selectedTime = parsed;
    }
  }

  return selected;
}

function advanceCursorFromRows(
  currentCursor: string | null,
  rowTimestamps: Array<string | null | undefined>
) {
  const rowMax = maxTimestamp(rowTimestamps);
  if (!rowMax) {
    return currentCursor;
  }

  return timestampValue(rowMax) > timestampValue(currentCursor)
    ? rowMax
    : currentCursor;
}

function advanceCursorThroughWindow(
  currentCursor: string | null,
  rowTimestamps: Array<string | null | undefined>,
  completedThrough: string
) {
  const rowCursor = advanceCursorFromRows(currentCursor, rowTimestamps);

  return timestampValue(completedThrough) > timestampValue(rowCursor)
    ? completedThrough
    : rowCursor;
}

function buildProgressEvent(input: {
  syncRunId: number | null;
  phase: SyncProgressPhase;
  progress: number;
  message: string;
  snapshotBefore?: SnapshotStats;
  snapshotAfter?: SnapshotStats;
  changes?: SyncChangeSummary;
  mode?: "full" | "delta";
  modifiedAfter?: string | null;
  startedAt?: string;
  finishedAt?: string;
  diagnostics?: string[];
}): SyncProgressEvent {
  return input;
}

function emitSyncProgress(
  input: PerformManualSyncInput,
  event: SyncProgressEvent
) {
  input.onProgress?.(event);
  if (process.env.NODE_ENV !== "test") {
    console.info("sync.progress", JSON.stringify(event));
  }
}

function getErrorCauseCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "";
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  return cause && typeof cause === "object" && "code" in cause
    ? String((cause as { code?: unknown }).code)
    : "";
}

function describeSyncError(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const causeCode = getErrorCauseCode(error);
  return causeCode ? `${error.name}:${causeCode}` : error.name;
}

function buildSyncFailureDiagnostics(error: unknown) {
  if (!(error instanceof Error)) {
    return ["SYNC_FAILED", "error=unknown"];
  }

  const causeCode = getErrorCauseCode(error);
  if (causeCode) {
    return ["SYNC_FAILED", `network=${causeCode}`];
  }

  if (error.name === "AbortError") {
    return ["SYNC_FAILED", "network=ABORT_TIMEOUT"];
  }

  if (error.message.startsWith("Bitrix24 ")) {
    return ["SYNC_FAILED", `bitrix=${error.message}`];
  }

  return ["SYNC_FAILED", `error=${error.name}`];
}

function logSyncFailure(input: {
  syncRunId: number;
  scopeKey: string;
  diagnostics: string[];
}) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  console.error("sync.failed", JSON.stringify(input));
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
  const assignedByIds = ATTRACTION_MANAGER_IDS;
  const snapshotScope = {
    categoryIds: input.categoryIds,
    assignedByIds
  };
  const [
    exactModifiedAfter,
    operationalHistoryBootstrappedAt,
    callHistoryBootstrappedAt,
    activitySnapshotCount,
    snapshotBefore
  ] = await Promise.all([
    input.repository.getLatestSuccessCursor(input.categoryIds, assignedByIds),
    input.repository.getOperationalHistoryBootstrappedAt(),
    input.repository.getCallHistoryBootstrappedAt(),
    input.repository.getActivitySnapshotCount(),
    getSnapshotStats(input.repository, snapshotScope)
  ]);
  const scopeKey = buildCategoryScopeKey(input.categoryIds, assignedByIds);
  const compatibleScope =
    exactModifiedAfter === null && input.repository.getLatestSuccessfulScope
      ? await input.repository.getLatestSuccessfulScope(
          input.categoryIds,
          assignedByIds
        )
      : null;
  const compatibleModifiedAfter = compatibleScope
    ? await input.repository.getLatestSuccessCursor(
        compatibleScope.categoryIds,
        compatibleScope.assignedByIds
      )
    : null;
  const modifiedAfter = exactModifiedAfter ?? compatibleModifiedAfter;
  const scopeExpansionAssignedByIds =
    exactModifiedAfter === null && compatibleScope && compatibleModifiedAfter
      ? differenceStringValues(assignedByIds, compatibleScope.assignedByIds)
      : [];
  const dealCursorKey = buildSyncCursorKey(scopeKey, "deals");
  const activityCursorKey = buildSyncCursorKey(scopeKey, "activities");
  const callStatsCursorKey = buildSyncCursorKey(scopeKey, "call_stats");
  const compatibleDealCursor =
    compatibleScope && compatibleModifiedAfter
      ? await resolveSyncCursor(
          input.repository,
          buildSyncCursorKey(compatibleScope.scopeKey, "deals"),
          compatibleModifiedAfter
        )
      : null;
  const compatibleActivityCursor =
    compatibleScope && compatibleModifiedAfter
      ? await resolveSyncCursor(
          input.repository,
          buildSyncCursorKey(compatibleScope.scopeKey, "activities"),
          compatibleModifiedAfter
        )
      : null;
  const compatibleCallStatsCursor =
    compatibleScope && compatibleModifiedAfter
      ? await resolveSyncCursor(
          input.repository,
          buildSyncCursorKey(compatibleScope.scopeKey, "call_stats"),
          compatibleModifiedAfter
        )
      : null;
  const [dealCursor, activityCursor] = await Promise.all([
    resolveSyncCursor(
      input.repository,
      dealCursorKey,
      compatibleDealCursor ?? modifiedAfter
    ),
    resolveSyncCursor(
      input.repository,
      activityCursorKey,
      compatibleActivityCursor ?? modifiedAfter
    )
  ]);
  const callActivityHistoryBootstrappedAt =
    (input.repository.getCallActivityHistoryBootstrappedAt
      ? await input.repository.getCallActivityHistoryBootstrappedAt()
      : null) ?? callHistoryBootstrappedAt;
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
  const storedCallStatsCursor = input.repository.getSyncCursor
    ? await resolveSyncCursor(
        input.repository,
        callStatsCursorKey,
        compatibleCallStatsCursor
      )
    : null;
  const [
    hasCallActivityHistoryCoverage,
    hasMeetingActivityHistoryCoverage,
    hasDealCustomFieldsCoverage,
    hasDealMeetingDateFieldCoverage,
    hasCallStatsCoverage,
    hasConversionEventVisitsCoverage,
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
    hasSyncCoverage({
      repository: input.repository,
      scopeKey,
      stream: CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
      providerId: CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
      requiredFrom: FULL_COVERAGE_FROM,
      algorithmVersion: CONVERSION_EVENT_VISITS_COVERAGE_VERSION
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
  const hasCoverageTracking = Boolean(input.repository.hasSyncCoverage);
  const shouldBootstrapOperationalHistory =
    !operationalHistoryBootstrappedAt && activitySnapshotCount === 0;
  const shouldBootstrapCallActivityHistory =
    !hasCallActivityHistoryCoverage ||
    (!hasCoverageTracking && !callActivityHistoryBootstrappedAt);
  const shouldBootstrapMeetingActivityHistory =
    !hasMeetingActivityHistoryCoverage ||
    (!hasCoverageTracking && !meetingActivityHistoryBootstrappedAt);
  const taskActivityProvidersToBootstrap = TASK_ACTIVITY_PROVIDER_IDS.filter(
    (_providerId, index) =>
      !taskActivityHistoryCoverage[index] ||
      (!hasCoverageTracking && !taskActivityHistoryBootstrappedAt)
  );
  const shouldBootstrapTaskActivityHistory =
    taskActivityProvidersToBootstrap.length > 0;
  const shouldBootstrapDealCustomFields =
    !hasDealCustomFieldsCoverage ||
    (!hasCoverageTracking && !dealCustomFieldsBootstrappedAt);
  const shouldBootstrapDealMeetingDateField =
    Boolean(input.meetingDateFieldName) &&
    (!hasDealMeetingDateFieldCoverage ||
      (!hasCoverageTracking && !dealMeetingDateFieldBootstrappedAt));
  const shouldRefreshCallStatsCoverage = !hasCallStatsCoverage;
  const callStatsDeltaCursor = storedCallStatsCursor ?? activityCursor ?? dealCursor;
  const callStatsCursor = input.repository.getSyncCursor
    ? shouldRefreshCallStatsCoverage
      ? bootstrapModifiedAfter ?? FULL_COVERAGE_FROM
      : callStatsDeltaCursor
    : shouldRefreshCallStatsCoverage
      ? bootstrapModifiedAfter ?? FULL_COVERAGE_FROM
      : null;
  const shouldBootstrapAnyDealFields =
    shouldBootstrapDealCustomFields || shouldBootstrapDealMeetingDateField;
  const dealModifiedAfter = shouldBootstrapAnyDealFields
    ? bootstrapModifiedAfter
    : dealCursor;
  const activityModifiedAfter = shouldBootstrapOperationalHistory
    ? bootstrapModifiedAfter
    : activityCursor;
  const shouldBootstrapConversionEventVisits =
    Boolean(input.client.listConversionEventVisits) &&
    !hasConversionEventVisitsCoverage;
  const conversionEventModifiedAfter = shouldBootstrapConversionEventVisits
    ? null
    : dealModifiedAfter;
  const conversionEventDiagnostics: string[] = [];
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter: runModifiedAfter,
    scopeKey
  });
  emitSyncProgress(
    input,
    buildProgressEvent({
      syncRunId,
      phase: "inspect_snapshot",
      progress: 5,
      message: "Проверяем локальный snapshot",
      snapshotBefore,
      mode,
      modifiedAfter: runModifiedAfter,
      startedAt
    })
  );

  try {
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_catalogs",
        progress: 15,
        message: "Загружаем справочники и сделки из Bitrix24",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );
    const shouldFetchLeadgenReasons = input.categoryIds.includes(
      LEADGEN_US_CATEGORY_ID
    );
    const getCachedCatalog = async (entityType: StageCatalogEntry["entityType"]) =>
      input.repository.getStageCatalog
        ? (await input.repository.getStageCatalog()).filter((entry) =>
            entityType === "deal"
              ? entry.entityType === "deal" &&
                Boolean(
                  entry.categoryId && input.categoryIds.includes(entry.categoryId)
                )
              : entry.entityType === entityType
          )
        : [];
    const fetchDealStages = input.client
      .fetchDealStages(input.categoryIds)
      .catch(async (error: unknown) => {
        const cachedStages = await getCachedCatalog("deal");
        if (cachedStages.length === 0) {
          throw error;
        }

        if (process.env.NODE_ENV !== "test") {
          console.warn(
            "sync.catalog_fallback",
            JSON.stringify({
              catalog: "deal_stages",
              rows: cachedStages.length,
              reason: describeSyncError(error)
            })
          );
        }

        return cachedStages;
      });
    const fetchSourceCatalog = input.client
      .fetchSourceCatalog()
      .catch(async (error: unknown) => {
        const cachedSources = await getCachedCatalog("source");
        if (cachedSources.length === 0) {
          throw error;
        }

        if (process.env.NODE_ENV !== "test") {
          console.warn(
            "sync.catalog_fallback",
            JSON.stringify({
              catalog: "source",
              rows: cachedSources.length,
              reason: describeSyncError(error)
            })
          );
        }

        return cachedSources;
      });
    const conversionEventDealFieldName =
      input.client.fetchConversionEventDealFieldName
        ? (await input.client.fetchConversionEventDealFieldName()) ?? undefined
        : undefined;
    const dealCustomFieldNames = [
      input.qualityFieldName,
      ...(input.tariffFieldName ? [input.tariffFieldName] : []),
      ...(input.businessClubFieldName ? [input.businessClubFieldName] : []),
      ...(input.targetGroupFieldName ? [input.targetGroupFieldName] : []),
      ...(input.meetingTypeFieldName ? [input.meetingTypeFieldName] : []),
      ...(input.meetingDateFieldName ? [input.meetingDateFieldName] : []),
      ...(conversionEventDealFieldName ? [conversionEventDealFieldName] : []),
      ATTRACTION_REFUSAL_REASON_FIELD_NAME,
      ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME
    ];
    const [
      dealStages,
      sourceCatalog,
      deltaDealRows,
      scopeExpansionDealRows,
      leadgenReasonRows,
      conversionEventVisits
    ] = await Promise.all([
      fetchDealStages,
      fetchSourceCatalog,
      input.client.listDeals({
        modifiedAfter: dealModifiedAfter,
        categoryIds: input.categoryIds,
        assignedByIds,
        qualityFieldName: input.qualityFieldName,
        customFieldNames: dealCustomFieldNames
      }),
      scopeExpansionAssignedByIds.length > 0
        ? input.client.listDeals({
            modifiedAfter: bootstrapModifiedAfter,
            categoryIds: input.categoryIds,
            assignedByIds: scopeExpansionAssignedByIds,
            qualityFieldName: input.qualityFieldName,
            customFieldNames: dealCustomFieldNames
          })
        : Promise.resolve([]),
      shouldFetchLeadgenReasons
        ? input.client.listDeals({
            modifiedAfter: dealModifiedAfter,
            categoryIds: [LEADGEN_US_CATEGORY_ID],
            assignedByIds,
            customFieldNames: [
              LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME,
              ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME,
              LEADGEN_US_RETURN_REASON_FIELD_NAME,
              LEADGEN_US_BASKET_REASON_FIELD_NAME
            ]
          })
        : Promise.resolve([]),
      input.client.listConversionEventVisits
        ? input.client.listConversionEventVisits({
            modifiedAfter: conversionEventModifiedAfter,
            reportYear: new Date(Date.parse(startedAt)).getUTCFullYear()
          }).catch((error: unknown) => {
            conversionEventDiagnostics.push(
              `conversionEventVisitsError=${describeSyncError(error)}`
            );
            return [];
          })
        : Promise.resolve([])
    ]);
    const rawDealRows = Array.from(
      new Map(
        [...deltaDealRows, ...scopeExpansionDealRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const assignedByIdSet = new Set(assignedByIds);
    const dealRows = rawDealRows.filter((row) => {
      const assignedById = normalizeString(row.ASSIGNED_BY_ID);
      return Boolean(assignedById && assignedByIdSet.has(assignedById));
    });
    const shouldMapDealRows = dealRows.length > 0;
    const shouldMapLeadgenRows = leadgenReasonRows.length > 0;
    const [
      qualityMap,
      tariffMap,
      businessClubMap,
      targetGroupMap,
      meetingTypeMap,
      conversionEventMap,
      legacyContactTargetGroupMap,
      refusalReasonMap,
      leadgenReturnReasonMap,
      leadgenBasketReasonMap
    ] = await Promise.all([
      shouldMapDealRows
        ? input.client.fetchDealQualityMap(input.qualityFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      input.tariffFieldName &&
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.tariffFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      input.businessClubFieldName &&
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.businessClubFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      input.targetGroupFieldName &&
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.targetGroupFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      input.meetingTypeFieldName &&
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(input.meetingTypeFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      conversionEventDealFieldName &&
      input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(conversionEventDealFieldName)
        : Promise.resolve({}),
      shouldMapDealRows &&
      input.legacyContactTargetGroupFieldName &&
      input.client.fetchContactFieldValueMap
        ? input.client.fetchContactFieldValueMap(
            input.legacyContactTargetGroupFieldName
          )
        : Promise.resolve({}),
      shouldMapDealRows && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(ATTRACTION_REFUSAL_REASON_FIELD_NAME)
        : Promise.resolve({}),
      shouldMapLeadgenRows && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(LEADGEN_US_RETURN_REASON_FIELD_NAME)
        : Promise.resolve({}),
      shouldMapLeadgenRows && input.client.fetchDealFieldValueMap
        ? input.client.fetchDealFieldValueMap(LEADGEN_US_BASKET_REASON_FIELD_NAME)
        : Promise.resolve({})
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
        conversionEventDealFieldName,
        contactTargetGroupByContactId,
        qualityMap,
        tariffMap,
        businessClubMap,
        targetGroupMap,
        meetingTypeMap,
        conversionEventMap,
        refusalReasonMap,
        stageNameById,
        linkedLeadgenLossLookup
      )
    );
    const scopeExpansionAssignedByIdSet = new Set(scopeExpansionAssignedByIds);
    const scopeExpansionDealIds = deals
      .filter(
        (deal) =>
          deal.assignedById !== null &&
          scopeExpansionAssignedByIdSet.has(deal.assignedById)
      )
      .map((deal) => deal.id);
    const dealsSynced = deals.length;
    const previousDeals =
      deals.length > 0 && input.repository.getDealsByIds
        ? await input.repository.getDealsByIds(deals.map((deal) => deal.id))
        : [];
    const dealBreakdown = buildDealChangeBreakdown({ deals, previousDeals });
    const dealMeetingDateChanges = input.meetingDateFieldName
      ? buildDealMeetingDateChanges({ deals, previousDeals })
      : [];
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_deals",
        progress: 35,
        message: `Получено строк сделок из Bitrix: ${dealsSynced} (новых: ${dealBreakdown.created}, обновлено: ${dealBreakdown.updated}, закрыто: ${dealBreakdown.closed}, переоткрыто: ${dealBreakdown.reopened}, без изменений: ${dealBreakdown.unchanged})${
          scopeExpansionAssignedByIds.length > 0
            ? `; backfill новых менеджеров: ${scopeExpansionDealRows.length}`
            : ""
        }`,
        snapshotBefore,
        changes: {
          deals: dealsSynced,
          dealBreakdown,
          activities: 0,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const allExistingScopedOwnerIds = await input.repository.getDealIdsByCategoryIds(
      input.categoryIds,
      assignedByIds
    );
    const existingOpenOwnerIds = input.repository.getOpenDealIdsByCategoryIds
      ? await input.repository.getOpenDealIdsByCategoryIds(
          input.categoryIds,
          assignedByIds
        )
      : allExistingScopedOwnerIds;
    const closedDeltaDealIds = new Set(
      deals.filter((deal) => !isOpenDealSnapshot(deal)).map((deal) => deal.id)
    );
    const refreshOwnerIds = Array.from(
      new Set([
        ...existingOpenOwnerIds.filter((id) => !closedDeltaDealIds.has(id)),
        ...deals.filter(isOpenDealSnapshot).map((deal) => deal.id)
      ])
    );
    const deltaOwnerIds = Array.from(
      new Set([...existingOpenOwnerIds, ...deals.map((deal) => deal.id)])
    );
    const callStatsOwnerIds = Array.from(
      new Set([...allExistingScopedOwnerIds, ...deals.map((deal) => deal.id)])
    );
    const historicalActivityOwnerIds = callStatsOwnerIds;
    const callStatsOwnerIdSet = new Set(callStatsOwnerIds);
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_activities",
        progress: 40,
        message: `Проверяем активности: ${deltaOwnerIds.length} сделок в delta, ${refreshOwnerIds.length} открытых в refresh, ${callStatsOwnerIds.length} сделок для звонков`,
        snapshotBefore,
        changes: {
          deals: dealsSynced,
          dealBreakdown,
          activities: 0,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const historicalActivityRequests: Array<{
      providerId: string;
      request: Promise<ActivityRow[]>;
    }> = [];
    if (shouldBootstrapCallActivityHistory) {
      historicalActivityRequests.push({
        providerId: "VOXIMPLANT_CALL",
        request: input.client.listActivities({
          ownerIds: historicalActivityOwnerIds,
          modifiedAfter: bootstrapModifiedAfter,
          providerId: "VOXIMPLANT_CALL"
        })
      });
    }
    if (shouldBootstrapMeetingActivityHistory) {
      historicalActivityRequests.push({
        providerId: "CRM_MEETING",
        request: input.client.listActivities({
          ownerIds: historicalActivityOwnerIds,
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
            ownerIds: historicalActivityOwnerIds,
            modifiedAfter: bootstrapModifiedAfter,
            providerId
          })
        });
      }
    }
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_activities",
        progress: 45,
        message: `Загружаем активности: delta ${deltaOwnerIds.length}, backfill новых менеджеров ${scopeExpansionDealIds.length}, исторических потоков ${historicalActivityRequests.length}`,
        snapshotBefore,
        changes: {
          deals: dealsSynced,
          dealBreakdown,
          activities: 0,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );
    const [
      deltaActivityRows,
      historicalActivityGroups,
      scopeExpansionActivityRows
    ] = await Promise.all([
      input.client.listActivities({
        ownerIds: deltaOwnerIds,
        modifiedAfter: activityModifiedAfter
      }),
      Promise.all(historicalActivityRequests.map((entry) => entry.request)),
      scopeExpansionDealIds.length > 0
        ? input.client.listActivities({
            ownerIds: scopeExpansionDealIds,
            modifiedAfter: bootstrapModifiedAfter
          })
        : Promise.resolve([])
    ]);
    const historicalActivityRows = historicalActivityGroups.flat();
    const syncedActivityRows = Array.from(
      new Map(
        [
          ...historicalActivityRows.filter((row) =>
            isActivityUpdatedAfter(row, bootstrapModifiedAfter)
          ),
          ...scopeExpansionActivityRows,
          ...deltaActivityRows
        ].map((row) => [String(row.ID), row])
      ).values()
    );
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_activities",
        progress: 50,
        message: `Активности из Bitrix: delta ${deltaActivityRows.length}, backfill новых менеджеров ${scopeExpansionActivityRows.length}, история ${historicalActivityRows.length}`,
        snapshotBefore,
        changes: {
          deals: dealsSynced,
          dealBreakdown,
          activities: syncedActivityRows.length,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );
    const missingCallActivityIds =
      input.repository.getCallActivityIdsMissingActivities &&
      input.client.listActivitiesByIds &&
      callStatsOwnerIds.length > 0
        ? await input.repository.getCallActivityIdsMissingActivities(
            MISSING_CALL_ACTIVITY_BACKFILL_LIMIT,
            bootstrapModifiedAfter,
            callStatsOwnerIds
          )
        : [];
    const missingCallActivityRows =
      missingCallActivityIds.length > 0 && input.client.listActivitiesByIds
        ? (await input.client.listActivitiesByIds(missingCallActivityIds)).filter(
            (row) =>
              String(row.OWNER_TYPE_ID) === "2" &&
              callStatsOwnerIdSet.has(String(row.OWNER_ID))
          )
        : [];
    const initialActivityRows = Array.from(
      new Map(
        [...syncedActivityRows, ...missingCallActivityRows].map((row) => [
          String(row.ID),
          row
        ])
      ).values()
    );
    const missingCallStatsActivityIds =
      input.repository.getCallActivityIdsMissingCallStats &&
      callStatsOwnerIds.length > 0
        ? await input.repository.getCallActivityIdsMissingCallStats(
            MISSING_CALL_STATS_BACKFILL_LIMIT,
            bootstrapModifiedAfter,
            callStatsOwnerIds
          )
        : [];
    const callStatsRefreshActivityIds =
      shouldRefreshCallStatsCoverage &&
      input.repository.getCallActivityIdsForCallStatsRefresh &&
      callStatsOwnerIds.length > 0
        ? await input.repository.getCallActivityIdsForCallStatsRefresh(
            CALL_STATS_REFRESH_LIMIT,
            bootstrapModifiedAfter,
            callStatsOwnerIds
          )
        : [];

    const initialCallActivityIds = Array.from(
      new Set(
        [
          ...initialActivityRows
            .filter((row) => row.PROVIDER_ID === "VOXIMPLANT_CALL")
            .map((row) => String(row.ID)),
          ...callStatsRefreshActivityIds,
          ...missingCallStatsActivityIds
        ]
      )
    );
    const callRowsByActivity =
      initialCallActivityIds.length > 0
        ? await input.client.listCalls({
            activityIds: initialCallActivityIds
          })
        : [];
    const deltaSupplementalCallRows = callStatsCursor
      ? await input.client.listCalls({
          callStartDateFrom: callStatsCursor,
          callStartDateTo: startedAt,
          portalUserIds: ATTRACTION_MANAGER_IDS
        })
      : [];
    const scopeExpansionSupplementalCallRows =
      scopeExpansionAssignedByIds.length > 0
        ? await input.client.listCalls({
            callStartDateFrom: bootstrapModifiedAfter ?? FULL_COVERAGE_FROM,
            callStartDateTo: startedAt,
            portalUserIds: scopeExpansionAssignedByIds
          })
        : [];
    const supplementalCallRows = Array.from(
      new Map(
        [
          ...deltaSupplementalCallRows,
          ...scopeExpansionSupplementalCallRows
        ].map((row) => [String(row.ID), row])
      ).values()
    );
    const initialActivityIdSet = new Set(
      initialActivityRows.map((row) => String(row.ID))
    );
    const supplementalActivityIds = Array.from(
      new Set(
        supplementalCallRows
          .map((row) => normalizeString(row.CRM_ACTIVITY_ID))
          .filter((activityId): activityId is string => {
            if (!activityId) {
              return false;
            }

            return !initialActivityIdSet.has(activityId);
          })
      )
    );
    const storedSupplementalActivities =
      supplementalActivityIds.length > 0
        ? await input.repository.getActivitiesByIds(supplementalActivityIds)
        : [];
    const storedSupplementalActivityIdSet = new Set(
      storedSupplementalActivities.map((activity) => activity.id)
    );
    const missingSupplementalActivityIds = supplementalActivityIds.filter(
      (activityId) => !storedSupplementalActivityIdSet.has(activityId)
    );
    const fetchedSupplementalActivityRows =
      input.client.listActivitiesByIds &&
      missingSupplementalActivityIds.length > 0
        ? (
            await input.client.listActivitiesByIds(missingSupplementalActivityIds)
          ).filter(
            (row) =>
              String(row.OWNER_TYPE_ID) === "2" &&
              callStatsOwnerIdSet.has(String(row.OWNER_ID))
          )
        : [];
    const scopedSupplementalActivities = storedSupplementalActivities.filter(
      (activity) =>
        activity.ownerTypeId === "2" && callStatsOwnerIdSet.has(activity.ownerId)
    );
    const fetchedSupplementalActivities =
      fetchedSupplementalActivityRows.map(mapActivityRow);
    const activities = Array.from(
      new Map(
        [
          ...initialActivityRows.map(mapActivityRow),
          ...scopedSupplementalActivities,
          ...fetchedSupplementalActivities
        ].map((activity) => [activity.id, activity])
      ).values()
    );
    const activityIds = activities.map((activity) => activity.id);
    const previousActivities =
      activityIds.length > 0
        ? await input.repository.getActivitiesByIds(activityIds)
        : [];
    const deadlineChanges = buildDeadlineChanges(previousActivities, activities);
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_activities",
        progress: 55,
        message: `Получено активностей: ${activities.length}`,
        snapshotBefore,
        changes: {
          deals: dealsSynced,
          dealBreakdown,
          activities: activities.length,
          calls: 0,
          stageHistory: 0,
          managers: 0
        },
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );
    const scopedActivityIds = new Set([
      ...initialCallActivityIds,
      ...scopedSupplementalActivities.map((activity) => activity.id),
      ...fetchedSupplementalActivities.map((activity) => activity.id)
    ]);
    const callRows = Array.from(
      new Map(
        [...callRowsByActivity, ...supplementalCallRows]
          .filter((row) => {
            const activityId = normalizeString(row.CRM_ACTIVITY_ID);
            const crmEntityType = normalizeString(row.CRM_ENTITY_TYPE);
            const crmEntityId = normalizeString(row.CRM_ENTITY_ID);

            return (
              Boolean(activityId && scopedActivityIds.has(activityId)) ||
              (crmEntityType === "DEAL" &&
                Boolean(crmEntityId && callStatsOwnerIdSet.has(crmEntityId)))
            );
          })
          .map((row) => [String(row.ID), row])
      ).values()
    );
    const managerIds = Array.from(
      new Set(
        [
          ...dealRows.map((row) => row.ASSIGNED_BY_ID),
          ...activities.map((row) => row.responsibleId),
          ...callRows.map((row) => row.PORTAL_USER_ID)
        ]
          .map(normalizeString)
          .filter((value): value is string => Boolean(value))
      )
    );

    const managerDirectory = await fetchManagerDirectory(input.client, managerIds);
    const stageHistoryOwnerIds =
      runModifiedAfter !== null && snapshotBefore.stageHistory > 0
        ? deals.map((deal) => deal.id)
        : refreshOwnerIds;
    const stageHistoryRows =
      stageHistoryOwnerIds.length > 0
        ? await input.client.listStageHistory({
            ownerIds: stageHistoryOwnerIds
          })
        : [];
    const stageHistory = stageHistoryRows.map(mapStageHistoryRow);
    const calls = callRows.map(mapCallRow);
    const changes: SyncChangeSummary = {
      deals: deals.length,
      dealBreakdown,
      activities: activities.length,
      calls: calls.length,
      stageHistory: stageHistory.length,
      managers: managerDirectory.length
    };
    const nextDealCursor = advanceCursorThroughWindow(
      dealCursor,
      dealRows.map((row) => row.DATE_MODIFY),
      startedAt
    );
    const nextActivityCursor = advanceCursorThroughWindow(
      activityCursor,
      deltaActivityRows.map((row) => row.LAST_UPDATED),
      startedAt
    );
    const nextCallStatsCursor = advanceCursorThroughWindow(
      callStatsCursor,
      supplementalCallRows.map((row) => row.CALL_START_DATE),
      startedAt
    );
    const diagnostics = [
      `dealCursor=${nextDealCursor ?? "not-updated"}`,
      `activityCursor=${nextActivityCursor ?? "not-updated"}`,
      `callStatsCursor=${nextCallStatsCursor ?? "not-updated"}`,
      `callStatsOwners=${callStatsOwnerIds.length}`,
      `scopeExpansionManagers=${scopeExpansionAssignedByIds.length}`,
      `scopeExpansionDeals=${scopeExpansionDealIds.length}`,
      `conversionEventVisits=${conversionEventVisits.length}`,
      `conversionEventVisitsCoverage=${
        shouldBootstrapConversionEventVisits ? "backfill" : "delta"
      }`,
      `supplementalCallsSeen=${supplementalCallRows.length}`,
      `callsPersisted=${calls.length}`,
      ...conversionEventDiagnostics
    ];

    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "fetch_calls",
        progress: 70,
        message: `Получено звонков: ${calls.length}`,
        snapshotBefore,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    const finishedAt = input.now();
    const persistedAt = input.now();

    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "persist_snapshot",
        progress: 90,
        message: "Сохраняем snapshot в SQLite",
        snapshotBefore,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt
      })
    );

    runSnapshotTransaction(input.repository, () => {
      void input.repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);
      void input.repository.upsertDeals(deals);

      if (!callHistoryBootstrappedAt) {
        void input.repository.markCallHistoryBootstrapped(persistedAt);
      }

      void input.repository.upsertActivities(activities);
      void input.repository.upsertActivityDeadlineChanges(deadlineChanges);
      if (input.repository.upsertDealMeetingDateChanges) {
        void input.repository.upsertDealMeetingDateChanges(dealMeetingDateChanges);
      }
      if (input.repository.upsertConversionEventVisits) {
        void input.repository.upsertConversionEventVisits(conversionEventVisits);
      }
      void input.repository.upsertCalls(calls);
      void input.repository.upsertManagerDirectory(managerDirectory);

      if (input.repository.setSyncCursor) {
        if (nextDealCursor) {
          void input.repository.setSyncCursor({
            key: dealCursorKey,
            cursorValue: nextDealCursor,
            updatedAt: persistedAt
          });
        }
        if (nextActivityCursor) {
          void input.repository.setSyncCursor({
            key: activityCursorKey,
            cursorValue: nextActivityCursor,
            updatedAt: persistedAt
          });
        }
        if (nextCallStatsCursor) {
          void input.repository.setSyncCursor({
            key: callStatsCursorKey,
            cursorValue: nextCallStatsCursor,
            updatedAt: persistedAt
          });
        }
      }

      if (input.repository.upsertSyncCoverage && bootstrapModifiedAfter) {
        for (const providerId of [
          ...(shouldBootstrapCallActivityHistory ? ["VOXIMPLANT_CALL"] : []),
          ...(shouldBootstrapMeetingActivityHistory ? ["CRM_MEETING"] : []),
          ...taskActivityProvidersToBootstrap
        ]) {
          void input.repository.upsertSyncCoverage({
            scopeKey,
            stream: "activity_history",
            providerId,
            coveredFrom: bootstrapModifiedAfter,
            coveredTo: null,
            algorithmVersion: ACTIVITY_HISTORY_COVERAGE_VERSION,
            syncedAt: persistedAt
          });
        }
      }

      if (
        input.repository.upsertSyncCoverage &&
        shouldBootstrapDealCustomFields
      ) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: DEAL_CUSTOM_FIELDS_COVERAGE_STREAM,
          providerId: DEAL_CUSTOM_FIELDS_COVERAGE_PROVIDER,
          coveredFrom: bootstrapModifiedAfter ?? dealModifiedAfter ?? FULL_COVERAGE_FROM,
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
          coveredFrom: bootstrapModifiedAfter ?? dealModifiedAfter ?? FULL_COVERAGE_FROM,
          coveredTo: null,
          algorithmVersion: DEAL_MEETING_DATE_FIELD_COVERAGE_VERSION,
          syncedAt: persistedAt
        });
      }

      if (
        input.repository.upsertSyncCoverage &&
        bootstrapModifiedAfter &&
        shouldRefreshCallStatsCoverage
      ) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: CALL_STATS_COVERAGE_STREAM,
          providerId: CALL_STATS_COVERAGE_PROVIDER,
          coveredFrom: bootstrapModifiedAfter,
          coveredTo: null,
          algorithmVersion: CALL_STATS_COVERAGE_VERSION,
          syncedAt: persistedAt
        });
      }

      if (
        input.repository.upsertSyncCoverage &&
        shouldBootstrapConversionEventVisits &&
        conversionEventDiagnostics.length === 0
      ) {
        void input.repository.upsertSyncCoverage({
          scopeKey,
          stream: CONVERSION_EVENT_VISITS_COVERAGE_STREAM,
          providerId: CONVERSION_EVENT_VISITS_COVERAGE_PROVIDER,
          coveredFrom: FULL_COVERAGE_FROM,
          coveredTo: null,
          algorithmVersion: CONVERSION_EVENT_VISITS_COVERAGE_VERSION,
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
        dealBreakdown,
        diagnostics,
        modifiedAfter: runModifiedAfter
      });
    });

    const snapshotAfter = await getSnapshotStats(input.repository, snapshotScope);

    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "complete",
        progress: 100,
        message: "Синхронизация завершена",
        snapshotBefore,
        snapshotAfter,
        changes,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced,
      mode,
      modifiedAfter: runModifiedAfter,
      finishedAt,
      snapshotBefore,
      snapshotAfter,
      changes,
      diagnostics
    };
  } catch (error) {
    const finishedAt = input.now();
    const diagnostics = buildSyncFailureDiagnostics(error);
    logSyncFailure({
      syncRunId,
      scopeKey,
      diagnostics
    });
    emitSyncProgress(
      input,
      buildProgressEvent({
        syncRunId,
        phase: "failed",
        progress: 100,
        message: "Синхронизация завершилась ошибкой",
        snapshotBefore,
        mode,
        modifiedAfter: runModifiedAfter,
        startedAt,
        finishedAt,
        diagnostics
      })
    );
    await input.repository.failSyncRun({
      syncRunId,
      finishedAt,
      status: "failed",
      diagnostics
    });
    throw error;
  }
}
