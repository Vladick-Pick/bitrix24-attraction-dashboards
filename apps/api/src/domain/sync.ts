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

export interface DealRow {
  ID: string;
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
  ID: string;
  OWNER_TYPE_ID: string;
  OWNER_ID: string;
  TYPE_ID: string | null;
  PROVIDER_ID: string | null;
  RESPONSIBLE_ID: string | null;
  CREATED: string;
  DEADLINE: string | null;
  LAST_UPDATED: string;
  COMPLETED: string;
  COMPLETED_DATE?: string | null;
}

export interface CallRow {
  ID: string;
  CRM_ACTIVITY_ID: string | null;
  PORTAL_USER_ID: string | null;
  CALL_TYPE: string | null;
  CALL_START_DATE: string;
  CALL_DURATION: string | number | null;
  CRM_ENTITY_TYPE: string | null;
  CRM_ENTITY_ID: string | null;
  CALL_FAILED_CODE: string | null;
}

export interface UserRow {
  ID: string;
  NAME: string | null;
  LAST_NAME: string | null;
}

export interface SyncClient {
  fetchDealStages(categoryIds: string[]): Promise<StageCatalogEntry[]>;
  fetchSourceCatalog(): Promise<StageCatalogEntry[]>;
  fetchDealQualityMap(fieldName: string): Promise<Record<string, string>>;
  fetchDealFieldValueMap?(fieldName: string): Promise<Record<string, string>>;
  listDeals(cursor: {
    modifiedAfter: string | null;
    categoryIds: string[];
    qualityFieldName?: string;
    customFieldNames?: string[];
  }): Promise<DealRow[]>;
  listStageHistory(input: {
    ownerIds?: string[];
    categoryIds?: string[];
  }): Promise<StageHistoryRow[]>;
  listActivities(input: {
    ownerIds: string[];
    modifiedAfter: string | null;
    providerId?: string;
  }): Promise<ActivityRow[]>;
  listCalls(input: {
    activityIds?: string[];
  }): Promise<CallRow[]>;
  fetchUsers(input: { ids: string[] }): Promise<UserRow[]>;
}

export interface SyncRepository {
  getLatestSuccessCursor(categoryIds?: string[]): Promise<string | null>;
  getOperationalHistoryBootstrappedAt(): Promise<string | null>;
  getCallHistoryBootstrappedAt(): Promise<string | null>;
  getCallActivityHistoryBootstrappedAt?(): Promise<string | null>;
  getMeetingActivityHistoryBootstrappedAt?(): Promise<string | null>;
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(categoryIds: string[]): Promise<string[]>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
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
  client: SyncClient;
  repository: SyncRepository;
  now: () => string;
}

export const ATTRACTION_REFUSAL_REASON_FIELD_NAME = "UF_CRM_1647422744";
export const ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME = "UF_CRM_1647422890";
export const LEADGEN_US_CATEGORY_ID = "28";
export const LEADGEN_US_TO_ATTRACTION_DEAL_FIELD_NAME = "UF_CRM_1730360968";
export const LEADGEN_US_RETURN_REASON_FIELD_NAME = "UF_CRM_1758715585";
export const LEADGEN_US_BASKET_REASON_FIELD_NAME = "UF_CRM_1772109151192";

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
      refusalReasonDetail: genericReasonDetail
    };
  }

  const linked = linkedLeadgenLossLookup.get(row.ID);
  if (!linked) {
    return {
      refusalReasonValue: genericReasonValue,
      refusalReasonDetail: genericReasonDetail
    };
  }

  const stageName = stageNameById.get(row.STAGE_ID);
  if (isReturnLossStage(row.STAGE_ID, stageName)) {
    return {
      refusalReasonValue: linked.returnReasonValue ?? genericReasonValue,
      refusalReasonDetail: linked.refusalReasonDetail ?? genericReasonDetail
    };
  }

  if (isBasketLossStage(row.STAGE_ID, stageName)) {
    return {
      refusalReasonValue: linked.basketReasonValue ?? genericReasonValue,
      refusalReasonDetail: linked.refusalReasonDetail ?? genericReasonDetail
    };
  }

  return {
    refusalReasonValue: genericReasonValue,
    refusalReasonDetail: genericReasonDetail
  };
}

function mapDealRow(
  row: DealRow,
  qualityFieldName: string,
  tariffFieldName: string | undefined,
  businessClubFieldName: string | undefined,
  targetGroupFieldName: string | undefined,
  meetingTypeFieldName: string | undefined,
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
  const normalizedTargetGroupValue = targetGroupFieldName
    ? normalizeMappedFieldValue(row[targetGroupFieldName], targetGroupMap)
    : null;
  const normalizedMeetingTypeValue = meetingTypeFieldName
    ? normalizeMappedFieldValue(row[meetingTypeFieldName], meetingTypeMap)
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
    title: row.TITLE ?? null,
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
    tariffValue: normalizedTariffValue,
    refusalReasonValue: resolvedLossFields.refusalReasonValue,
    refusalReasonDetail: resolvedLossFields.refusalReasonDetail,
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
    id: row.ID,
    ownerTypeId: row.OWNER_TYPE_ID,
    ownerId: row.OWNER_ID,
    typeId: row.TYPE_ID,
    providerId: row.PROVIDER_ID,
    responsibleId: row.RESPONSIBLE_ID,
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
    id: row.ID,
    crmActivityId: row.CRM_ACTIVITY_ID,
    portalUserId: row.PORTAL_USER_ID,
    callType: row.CALL_TYPE,
    callStartDate: row.CALL_START_DATE,
    callDurationSeconds: Number.isFinite(duration) ? duration : 0,
    crmEntityType: row.CRM_ENTITY_TYPE,
    crmEntityId: row.CRM_ENTITY_ID,
    callFailedCode: row.CALL_FAILED_CODE
  };
}

function mapUserRow(row: UserRow): ManagerDirectoryEntry {
  const fullName = [row.NAME, row.LAST_NAME].filter(Boolean).join(" ").trim();

  return {
    id: row.ID,
    name: fullName || row.ID
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
  const callActivityHistoryBootstrappedAt =
    input.repository.getCallActivityHistoryBootstrappedAt
      ? await input.repository.getCallActivityHistoryBootstrappedAt()
      : callHistoryBootstrappedAt;
  const meetingActivityHistoryBootstrappedAt =
    input.repository.getMeetingActivityHistoryBootstrappedAt
      ? await input.repository.getMeetingActivityHistoryBootstrappedAt()
      : "__legacy__";
  const mode = modifiedAfter === null ? "full" : "delta";
  const shouldBootstrapOperationalHistory =
    !operationalHistoryBootstrappedAt && activitySnapshotCount === 0;
  const shouldBootstrapCallActivityHistory =
    !callActivityHistoryBootstrappedAt;
  const shouldBootstrapMeetingActivityHistory =
    !meetingActivityHistoryBootstrappedAt;
  const activityModifiedAfter = shouldBootstrapOperationalHistory
    ? null
    : modifiedAfter;
  const startedAt = input.now();
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter
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
        modifiedAfter,
        categoryIds: input.categoryIds,
        qualityFieldName: input.qualityFieldName,
        customFieldNames: [
          input.qualityFieldName,
          ...(input.tariffFieldName ? [input.tariffFieldName] : []),
          ...(input.businessClubFieldName ? [input.businessClubFieldName] : []),
          ...(input.targetGroupFieldName ? [input.targetGroupFieldName] : []),
          ...(input.meetingTypeFieldName ? [input.meetingTypeFieldName] : []),
          ATTRACTION_REFUSAL_REASON_FIELD_NAME,
          ATTRACTION_REFUSAL_REASON_DETAIL_FIELD_NAME
        ]
      }),
      shouldFetchLeadgenReasons
        ? input.client.listDeals({
            modifiedAfter,
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
    const stageNameById = buildStageNameById(dealStages);
    const linkedLeadgenLossLookup = buildLinkedLeadgenLossLookup(
      leadgenReasonRows,
      leadgenReturnReasonMap,
      leadgenBasketReasonMap
    );

    await input.repository.replaceStageCatalog([...dealStages, ...sourceCatalog]);

    const dealsSynced = await input.repository.upsertDeals(
      dealRows.map((row) =>
        mapDealRow(
          row,
          input.qualityFieldName,
          input.tariffFieldName,
          input.businessClubFieldName,
          input.targetGroupFieldName,
          input.meetingTypeFieldName,
          qualityMap,
          tariffMap,
          businessClubMap,
          targetGroupMap,
          meetingTypeMap,
          refusalReasonMap,
          stageNameById,
          linkedLeadgenLossLookup
        )
      )
    );

    const ownerIds = await input.repository.getDealIdsByCategoryIds(input.categoryIds);
    if (!callHistoryBootstrappedAt) {
      await input.repository.markCallHistoryBootstrapped(input.now());
    }

    const [
      deltaActivityRows,
      historicalCallActivityRows,
      historicalMeetingActivityRows
    ] = await Promise.all([
      input.client.listActivities({
        ownerIds,
        modifiedAfter: activityModifiedAfter
      }),
      shouldBootstrapCallActivityHistory
        ? input.client.listActivities({
            ownerIds,
            modifiedAfter: null,
            providerId: "VOXIMPLANT_CALL"
          })
        : Promise.resolve([]),
      shouldBootstrapMeetingActivityHistory
        ? input.client.listActivities({
            ownerIds,
            modifiedAfter: null,
            providerId: "CRM_MEETING"
          })
        : Promise.resolve([])
    ]);
    const activityRows = Array.from(
      new Map(
        [
          ...historicalCallActivityRows,
          ...historicalMeetingActivityRows,
          ...deltaActivityRows
        ].map((row) => [row.ID, row])
      ).values()
    );

    const activityIds = Array.from(new Set(activityRows.map((row) => row.ID)));
    const previousActivities =
      activityIds.length > 0
        ? await input.repository.getActivitiesByIds(activityIds)
        : [];
    const activities = activityRows.map(mapActivityRow);
    const deadlineChanges = buildDeadlineChanges(previousActivities, activities);
    const callActivityIds = Array.from(
      new Set(
        activityRows
          .filter((row) => row.PROVIDER_ID === "VOXIMPLANT_CALL")
          .map((row) => row.ID)
      )
    );
    const callRows = await input.client.listCalls({
      activityIds: callActivityIds
    });
    const managerIds = Array.from(
      new Set(
        [
          ...dealRows.map((row) => row.ASSIGNED_BY_ID),
          ...activityRows.map((row) => row.RESPONSIBLE_ID),
          ...callRows.map((row) => row.PORTAL_USER_ID)
        ].filter((value): value is string => Boolean(value))
      )
    );

    const managerDirectory = await fetchManagerDirectory(input.client, managerIds);

    await Promise.all([
      input.repository.upsertActivities(activities),
      input.repository.upsertActivityDeadlineChanges(deadlineChanges),
      input.repository.upsertCalls(callRows.map(mapCallRow)),
      input.repository.upsertManagerDirectory(managerDirectory)
    ]);

    if (shouldBootstrapCallActivityHistory) {
      await input.repository.markCallActivityHistoryBootstrapped?.(input.now());
    }

    if (shouldBootstrapMeetingActivityHistory) {
      await input.repository.markMeetingActivityHistoryBootstrapped?.(input.now());
    }

    if (shouldBootstrapOperationalHistory) {
      await input.repository.markOperationalHistoryBootstrapped(input.now());
    }

    const stageHistoryRows = await input.client.listStageHistory({
      categoryIds: input.categoryIds
    });
    await input.repository.upsertStageHistory(
      stageHistoryRows.map(mapStageHistoryRow)
    );

    const finishedAt = input.now();

    await input.repository.finishSyncRun({
      syncRunId,
      finishedAt,
      status: "success",
      leadsSynced: 0,
      dealsSynced,
      modifiedAfter
    });

    return {
      syncRunId,
      leadsSynced: 0,
      dealsSynced,
      mode,
      modifiedAfter,
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
