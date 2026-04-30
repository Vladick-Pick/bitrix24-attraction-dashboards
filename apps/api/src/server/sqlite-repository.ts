import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import type {
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  ConversionEventVisitSnapshot,
  DealMeetingDateChangeSnapshot,
  DealSnapshot,
  LeadSnapshot,
  ManagerDirectoryEntry,
  SalesPlanDraftRow,
  SalesPlanRow,
  SnapshotStats,
  StageCatalogEntry,
  StageHistorySnapshot,
  SyncDealChangeBreakdown
} from "@bitrix24-reporting/contracts";

export interface LastSyncSummary {
  finishedAt: string;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
  dealBreakdown: SyncDealChangeBreakdown;
}

export interface SyncCursorInput {
  key: string;
  cursorValue: string;
  updatedAt: string;
}

export interface SyncCoverageInput {
  scopeKey: string;
  stream: string;
  providerId: string | null;
  coveredFrom: string;
  coveredTo: string | null;
  algorithmVersion: string;
  syncedAt: string;
}

export interface SyncCoverageQuery {
  scopeKey: string;
  stream: string;
  providerId: string | null;
  requiredFrom: string;
  requiredTo?: string | null;
  requiredSyncedAt?: string | null;
  algorithmVersion: string;
}

export interface SnapshotStatsScope {
  categoryIds?: string[];
  assignedByIds?: string[];
}

export interface SuccessfulSyncScope {
  scopeKey: string;
  categoryIds: string[];
  assignedByIds: string[];
}

export interface ReplaceSalesPlanRowsInput {
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  rows: SalesPlanDraftRow[];
}

export interface SqliteRepository {
  getLatestSuccessCursor(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<string | null>;
  getLatestSuccessfulScope(
    categoryIds?: string[],
    assignedByIds?: string[]
  ): Promise<SuccessfulSyncScope | null>;
  runSnapshotTransaction<T>(task: () => T): T;
  getSyncCursor(key: string): Promise<string | null>;
  setSyncCursor(input: SyncCursorInput): Promise<void>;
  hasSyncCoverage(input: SyncCoverageQuery): Promise<boolean>;
  upsertSyncCoverage(input: SyncCoverageInput): Promise<void>;
  getOperationalHistoryBootstrappedAt(): Promise<string | null>;
  getCallHistoryBootstrappedAt(): Promise<string | null>;
  getCallActivityHistoryBootstrappedAt(): Promise<string | null>;
  getMeetingActivityHistoryBootstrappedAt(): Promise<string | null>;
  getTaskActivityHistoryBootstrappedAt(): Promise<string | null>;
  getDealCustomFieldsBootstrappedAt(): Promise<string | null>;
  getDealMeetingDateFieldBootstrappedAt(): Promise<string | null>;
  getSnapshotStats(scope?: SnapshotStatsScope): Promise<SnapshotStats>;
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getOpenDealIdsByCategoryIds(
    categoryIds: string[],
    assignedByIds?: string[]
  ): Promise<string[]>;
  getDealsByIds(dealIds: string[]): Promise<DealSnapshot[]>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
  getCallActivityIdsMissingActivities(
    limit?: number,
    callStartDateFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsMissingCallStats(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  getCallActivityIdsForCallStatsRefresh(
    limit?: number,
    activityCreatedFrom?: string | null,
    ownerIds?: string[]
  ): Promise<string[]>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertLeads(rows: LeadSnapshot[]): Promise<number>;
  upsertDeals(rows: DealSnapshot[]): Promise<number>;
  upsertStageHistory(rows: StageHistorySnapshot[]): Promise<number>;
  upsertActivities(rows: ActivitySnapshot[]): Promise<number>;
  upsertActivityDeadlineChanges(
    rows: ActivityDeadlineChangeSnapshot[]
  ): Promise<number>;
  upsertDealMeetingDateChanges(
    rows: DealMeetingDateChangeSnapshot[]
  ): Promise<number>;
  upsertConversionEventVisits(
    rows: ConversionEventVisitSnapshot[]
  ): Promise<number>;
  upsertCalls(rows: CallSnapshot[]): Promise<number>;
  upsertManagerDirectory(rows: ManagerDirectoryEntry[]): Promise<number>;
  markOperationalHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallHistoryBootstrapped(timestamp: string): Promise<void>;
  markCallActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markMeetingActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markTaskActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markDealCustomFieldsBootstrapped(timestamp: string): Promise<void>;
  markDealMeetingDateFieldBootstrapped(timestamp: string): Promise<void>;
  createSyncRun(input?: {
    startedAt: string;
    mode: "full" | "delta";
    modifiedAfter: string | null;
    scopeKey: string;
  }): Promise<number>;
  recoverStaleSyncRuns(input: {
    staleBefore: string;
    failedAt?: string;
    diagnostics?: string[];
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
    dealBreakdown?: SyncDealChangeBreakdown;
    diagnostics?: string[];
    modifiedAfter: string | null;
  }): Promise<void>;
  getAllLeads(): Promise<LeadSnapshot[]>;
  getAllDeals(): Promise<DealSnapshot[]>;
  getAllStageHistory(): Promise<StageHistorySnapshot[]>;
  getAllActivities(): Promise<ActivitySnapshot[]>;
  getAllActivityDeadlineChanges(): Promise<ActivityDeadlineChangeSnapshot[]>;
  getAllDealMeetingDateChanges(): Promise<DealMeetingDateChangeSnapshot[]>;
  getAllConversionEventVisits(): Promise<ConversionEventVisitSnapshot[]>;
  getAllCalls(): Promise<CallSnapshot[]>;
  getManagerDirectory(): Promise<ManagerDirectoryEntry[]>;
  getStageCatalog(): Promise<StageCatalogEntry[]>;
  getSalesPlanRows(periodStart: string, periodEnd: string): Promise<SalesPlanRow[]>;
  replaceSalesPlanRows(input: ReplaceSalesPlanRowsInput): Promise<SalesPlanRow[]>;
  getWonStageIds(): Promise<string[]>;
  setWonStageIds(stageIds: string[]): Promise<void>;
  getLastSyncSummary(scopeKey?: string): Promise<LastSyncSummary | null>;
  close(): void;
}

interface CreateSqliteRepositoryInput {
  databaseUrl: string;
  defaultWonStageIds: string[];
}

function resolveDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Unsupported DATABASE_URL: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

function buildDealScopeWhereClause(scope: SnapshotStatsScope | undefined) {
  const clauses: string[] = [];
  const values: string[] = [];
  const categoryIds = scope?.categoryIds ?? [];
  const assignedByIds = scope?.assignedByIds ?? [];

  if (categoryIds.length > 0) {
    const placeholders = categoryIds.map(() => "?").join(", ");
    clauses.push(`category_id IN (${placeholders})`);
    values.push(...categoryIds);
  }

  if (assignedByIds.length > 0) {
    const placeholders = assignedByIds.map(() => "?").join(", ");
    clauses.push(`assigned_by_id IN (${placeholders})`);
    values.push(...assignedByIds);
  }

  return {
    clause: clauses.length > 0 ? clauses.join(" AND ") : "1 = 1",
    hasScope: clauses.length > 0,
    values
  };
}

function buildCategoryScopeKey(categoryIds: string[], assignedByIds: string[] = []) {
  const categoryScope = `category:${[...categoryIds].sort().join(",")}`;

  if (assignedByIds.length === 0) {
    return categoryScope;
  }

  return `${categoryScope}:assigned:${[...assignedByIds].sort().join(",")}`;
}

function parseCategoryScopeKey(scopeKey: string): SuccessfulSyncScope | null {
  const match = /^category:([^:]*)(?::assigned:(.*))?$/.exec(scopeKey);
  if (!match) {
    return null;
  }

  return {
    scopeKey,
    categoryIds: (match[1] ?? "").split(",").filter(Boolean),
    assignedByIds: (match[2] ?? "").split(",").filter(Boolean)
  };
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right.map(String));
  return left.every((value) => rightSet.has(String(value)));
}

function isSubset(values: string[], requestedValues: string[]) {
  const requestedSet = new Set(requestedValues.map(String));
  return values.every((value) => requestedSet.has(String(value)));
}

function chunkValues<T>(values: T[], chunkSize = 500) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function mapActivityRows(
  rows: Array<
    Omit<ActivitySnapshot, "completed"> & {
      completed: number;
    }
  >
) {
  return rows.map((row) => ({
    ...row,
    completed: Boolean(row.completed)
  }));
}

function ensureColumn(
  database: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  const columns = database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    );
  }
}

function buildLegacyDealBreakdown(total: number): SyncDealChangeBreakdown {
  return {
    total,
    created: 0,
    updated: total,
    closed: 0,
    reopened: 0,
    unchanged: 0
  };
}

function parseDealBreakdown(
  value: string | null | undefined,
  fallbackTotal: number
): SyncDealChangeBreakdown {
  if (!value) {
    return buildLegacyDealBreakdown(fallbackTotal);
  }

  try {
    const parsed = JSON.parse(value) as Partial<SyncDealChangeBreakdown>;
    return {
      total: Number(parsed.total ?? fallbackTotal),
      created: Number(parsed.created ?? 0),
      updated: Number(parsed.updated ?? fallbackTotal),
      closed: Number(parsed.closed ?? 0),
      reopened: Number(parsed.reopened ?? 0),
      unchanged: Number(parsed.unchanged ?? 0)
    };
  } catch {
    return buildLegacyDealBreakdown(fallbackTotal);
  }
}

export function createSqliteRepository(
  input: CreateSqliteRepositoryInput
): SqliteRepository {
  const databasePath = resolveDatabasePath(input.databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.pragma("synchronous = NORMAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      modified_after TEXT,
      scope_key TEXT,
      leads_synced INTEGER DEFAULT 0,
      deals_synced INTEGER DEFAULT 0,
      deal_breakdown_json TEXT,
      diagnostics_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_cursors (
      key TEXT PRIMARY KEY,
      cursor_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_coverage (
      scope_key TEXT NOT NULL,
      stream TEXT NOT NULL,
      provider_id TEXT,
      covered_from TEXT NOT NULL,
      covered_to TEXT,
      algorithm_version TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (scope_key, stream, provider_id, algorithm_version)
    );

    CREATE TABLE IF NOT EXISTS lead_snapshots (
      id TEXT PRIMARY KEY,
      status_id TEXT NOT NULL,
      source_id TEXT,
      opportunity REAL,
      assigned_by_id TEXT,
      date_create TEXT NOT NULL,
      date_modify TEXT NOT NULL,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT
    );

    CREATE TABLE IF NOT EXISTS deal_snapshots (
      id TEXT PRIMARY KEY,
      title TEXT,
      contact_id TEXT,
      lead_id TEXT,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_semantic_id TEXT,
      opportunity REAL,
      assigned_by_id TEXT,
      source_id TEXT,
      quality_value TEXT,
      business_club_value TEXT,
      target_group_value TEXT,
      meeting_type_value TEXT,
      meeting_date_value TEXT,
      tariff_value TEXT,
      conversion_event_value TEXT,
      refusal_reason_value TEXT,
      refusal_reason_detail TEXT,
      date_create TEXT NOT NULL,
      date_modify TEXT NOT NULL,
      date_closed TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT
    );

    CREATE TABLE IF NOT EXISTS stage_catalog (
      entity_type TEXT NOT NULL,
      category_id TEXT,
      status_id TEXT NOT NULL,
      name TEXT NOT NULL,
      semantic_id TEXT,
      sort_order INTEGER,
      PRIMARY KEY (entity_type, category_id, status_id)
    );

    CREATE TABLE IF NOT EXISTS stage_history_snapshots (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_semantic_id TEXT,
      type_id INTEGER,
      created_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_snapshots (
      id TEXT PRIMARY KEY,
      owner_type_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      type_id TEXT,
      provider_id TEXT,
      responsible_id TEXT,
      created_time TEXT NOT NULL,
      deadline TEXT,
      last_updated TEXT NOT NULL,
      completed INTEGER NOT NULL,
      completed_time TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_deadline_changes (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      responsible_id TEXT,
      previous_deadline TEXT,
      next_deadline TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deal_meeting_date_changes (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      assigned_by_id TEXT,
      previous_meeting_date TEXT,
      next_meeting_date TEXT,
      changed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversion_event_visit_snapshots (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      status TEXT NOT NULL,
      stage_id TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      deal_id TEXT,
      contact_id TEXT,
      manager_id TEXT,
      source_id TEXT,
      created_time TEXT NOT NULL,
      updated_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_snapshots (
      id TEXT PRIMARY KEY,
      crm_activity_id TEXT,
      portal_user_id TEXT,
      call_type TEXT,
      call_start_date TEXT NOT NULL,
      call_duration_seconds INTEGER NOT NULL,
      crm_entity_type TEXT,
      crm_entity_id TEXT,
      call_failed_code TEXT
    );

    CREATE TABLE IF NOT EXISTS manager_directory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS won_stage_config (
      stage_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_plan_rows (
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      manager_name TEXT,
      target_group_key TEXT NOT NULL,
      target_group_label TEXT NOT NULL,
      planned_deals INTEGER NOT NULL,
      planned_amount REAL NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (period_start, period_end, manager_id, target_group_key)
    );

    CREATE INDEX IF NOT EXISTS idx_deal_snapshots_category_id
      ON deal_snapshots (category_id);
    CREATE INDEX IF NOT EXISTS idx_stage_history_owner_id
      ON stage_history_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_owner_id
      ON activity_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_provider_created
      ON activity_snapshots (provider_id, created_time);
    CREATE INDEX IF NOT EXISTS idx_deal_meeting_date_changes_deal_id
      ON deal_meeting_date_changes (deal_id);
    CREATE INDEX IF NOT EXISTS idx_deal_meeting_date_changes_changed_at
      ON deal_meeting_date_changes (changed_at);
    CREATE INDEX IF NOT EXISTS idx_conversion_event_visits_event_date
      ON conversion_event_visit_snapshots (event_date);
    CREATE INDEX IF NOT EXISTS idx_conversion_event_visits_deal_id
      ON conversion_event_visit_snapshots (deal_id);
    CREATE INDEX IF NOT EXISTS idx_call_crm_activity_id
      ON call_snapshots (crm_activity_id);
  `);

  ensureColumn(database, "deal_snapshots", "source_id", "TEXT");
  ensureColumn(database, "deal_snapshots", "title", "TEXT");
  ensureColumn(database, "deal_snapshots", "contact_id", "TEXT");
  ensureColumn(database, "deal_snapshots", "quality_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "business_club_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "target_group_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_type_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_date_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "tariff_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "conversion_event_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_detail", "TEXT");
  ensureColumn(database, "stage_catalog", "sort_order", "INTEGER");
  ensureColumn(database, "sync_runs", "scope_key", "TEXT");
  ensureColumn(database, "sync_runs", "deal_breakdown_json", "TEXT");
  ensureColumn(database, "sync_runs", "diagnostics_json", "TEXT");

  const existingWonStages = database
    .prepare("SELECT COUNT(*) AS count FROM won_stage_config")
    .get() as { count: number };

  if (existingWonStages.count === 0 && input.defaultWonStageIds.length > 0) {
    const insertWonStage = database.prepare(`
      INSERT OR REPLACE INTO won_stage_config (stage_id, enabled)
      VALUES (?, 1)
    `);
    const seedTransaction = database.transaction((stageIds: string[]) => {
      for (const stageId of stageIds) {
        insertWonStage.run(stageId);
      }
    });
    seedTransaction(input.defaultWonStageIds);
  }

  const replaceStageCatalogStatement = database.prepare(`
    INSERT INTO stage_catalog (
      entity_type,
      category_id,
      status_id,
      name,
      semantic_id,
      sort_order
    )
    VALUES (@entityType, @categoryId, @statusId, @name, @semanticId, @sortOrder)
  `);

  const upsertLeadStatement = database.prepare(`
    INSERT INTO lead_snapshots (
      id, status_id, source_id, opportunity, assigned_by_id, date_create, date_modify,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
      @id, @statusId, @sourceId, @opportunity, @assignedById, @dateCreate, @dateModify,
      @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      status_id = excluded.status_id,
      source_id = excluded.source_id,
      opportunity = excluded.opportunity,
      assigned_by_id = excluded.assigned_by_id,
      date_create = excluded.date_create,
      date_modify = excluded.date_modify,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term
  `);

  const upsertDealStatement = database.prepare(`
    INSERT INTO deal_snapshots (
      id, title, contact_id, lead_id, category_id, stage_id, stage_semantic_id, opportunity, assigned_by_id,
      source_id, quality_value, business_club_value, target_group_value, meeting_type_value, meeting_date_value, tariff_value, conversion_event_value, refusal_reason_value, refusal_reason_detail, date_create,
      date_modify, date_closed, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
      @id, @title, @contactId, @leadId, @categoryId, @stageId, @stageSemanticId, @opportunity, @assignedById,
      @sourceId, @qualityValue, @businessClubValue, @targetGroupValue, @meetingTypeValue, @meetingDateValue, @tariffValue, @conversionEventValue, @refusalReasonValue, @refusalReasonDetail, @dateCreate,
      @dateModify, @dateClosed, @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      contact_id = excluded.contact_id,
      lead_id = excluded.lead_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_semantic_id = excluded.stage_semantic_id,
      opportunity = excluded.opportunity,
      assigned_by_id = excluded.assigned_by_id,
      source_id = excluded.source_id,
      quality_value = excluded.quality_value,
      business_club_value = excluded.business_club_value,
      target_group_value = excluded.target_group_value,
      meeting_type_value = excluded.meeting_type_value,
      meeting_date_value = excluded.meeting_date_value,
      tariff_value = excluded.tariff_value,
      conversion_event_value = excluded.conversion_event_value,
      refusal_reason_value = excluded.refusal_reason_value,
      refusal_reason_detail = excluded.refusal_reason_detail,
      date_create = excluded.date_create,
      date_modify = excluded.date_modify,
      date_closed = excluded.date_closed,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term
  `);

  const upsertStageHistoryStatement = database.prepare(`
    INSERT INTO stage_history_snapshots (
      id,
      owner_id,
      category_id,
      stage_id,
      stage_semantic_id,
      type_id,
      created_time
    ) VALUES (
      @id,
      @ownerId,
      @categoryId,
      @stageId,
      @stageSemanticId,
      @typeId,
      @createdTime
    )
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_semantic_id = excluded.stage_semantic_id,
      type_id = excluded.type_id,
      created_time = excluded.created_time
  `);

  const upsertActivityStatement = database.prepare(`
    INSERT INTO activity_snapshots (
      id,
      owner_type_id,
      owner_id,
      type_id,
      provider_id,
      responsible_id,
      created_time,
      deadline,
      last_updated,
      completed,
      completed_time
    ) VALUES (
      @id,
      @ownerTypeId,
      @ownerId,
      @typeId,
      @providerId,
      @responsibleId,
      @createdTime,
      @deadline,
      @lastUpdated,
      @completed,
      @completedTime
    )
    ON CONFLICT(id) DO UPDATE SET
      owner_type_id = excluded.owner_type_id,
      owner_id = excluded.owner_id,
      type_id = excluded.type_id,
      provider_id = excluded.provider_id,
      responsible_id = excluded.responsible_id,
      created_time = excluded.created_time,
      deadline = excluded.deadline,
      last_updated = excluded.last_updated,
      completed = excluded.completed,
      completed_time = excluded.completed_time
  `);

  const upsertDeadlineChangeStatement = database.prepare(`
    INSERT INTO activity_deadline_changes (
      id,
      activity_id,
      owner_id,
      responsible_id,
      previous_deadline,
      next_deadline,
      changed_at
    ) VALUES (
      @id,
      @activityId,
      @ownerId,
      @responsibleId,
      @previousDeadline,
      @nextDeadline,
      @changedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      activity_id = excluded.activity_id,
      owner_id = excluded.owner_id,
      responsible_id = excluded.responsible_id,
      previous_deadline = excluded.previous_deadline,
      next_deadline = excluded.next_deadline,
      changed_at = excluded.changed_at
  `);

  const upsertDealMeetingDateChangeStatement = database.prepare(`
    INSERT INTO deal_meeting_date_changes (
      id,
      deal_id,
      assigned_by_id,
      previous_meeting_date,
      next_meeting_date,
      changed_at
    ) VALUES (
      @id,
      @dealId,
      @assignedById,
      @previousMeetingDate,
      @nextMeetingDate,
      @changedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      deal_id = excluded.deal_id,
      assigned_by_id = excluded.assigned_by_id,
      previous_meeting_date = excluded.previous_meeting_date,
      next_meeting_date = excluded.next_meeting_date,
      changed_at = excluded.changed_at
  `);

  const upsertConversionEventVisitStatement = database.prepare(`
    INSERT INTO conversion_event_visit_snapshots (
      id,
      event_name,
      event_date,
      status,
      stage_id,
      stage_name,
      deal_id,
      contact_id,
      manager_id,
      source_id,
      created_time,
      updated_time
    ) VALUES (
      @id,
      @eventName,
      @eventDate,
      @status,
      @stageId,
      @stageName,
      @dealId,
      @contactId,
      @managerId,
      @sourceId,
      @createdTime,
      @updatedTime
    )
    ON CONFLICT(id) DO UPDATE SET
      event_name = excluded.event_name,
      event_date = excluded.event_date,
      status = excluded.status,
      stage_id = excluded.stage_id,
      stage_name = excluded.stage_name,
      deal_id = excluded.deal_id,
      contact_id = excluded.contact_id,
      manager_id = excluded.manager_id,
      source_id = excluded.source_id,
      created_time = excluded.created_time,
      updated_time = excluded.updated_time
  `);

  const upsertCallStatement = database.prepare(`
    INSERT INTO call_snapshots (
      id,
      crm_activity_id,
      portal_user_id,
      call_type,
      call_start_date,
      call_duration_seconds,
      crm_entity_type,
      crm_entity_id,
      call_failed_code
    ) VALUES (
      @id,
      @crmActivityId,
      @portalUserId,
      @callType,
      @callStartDate,
      @callDurationSeconds,
      @crmEntityType,
      @crmEntityId,
      @callFailedCode
    )
    ON CONFLICT(id) DO UPDATE SET
      crm_activity_id = excluded.crm_activity_id,
      portal_user_id = excluded.portal_user_id,
      call_type = excluded.call_type,
      call_start_date = excluded.call_start_date,
      call_duration_seconds = excluded.call_duration_seconds,
      crm_entity_type = excluded.crm_entity_type,
      crm_entity_id = excluded.crm_entity_id,
      call_failed_code = excluded.call_failed_code
  `);

  const upsertManagerDirectoryStatement = database.prepare(`
    INSERT INTO manager_directory (
      id,
      name
    ) VALUES (
      @id,
      @name
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name
  `);

  const upsertSyncStateStatement = database.prepare(`
    INSERT INTO sync_state (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value
  `);
  const upsertSyncCursorStatement = database.prepare(`
    INSERT INTO sync_cursors (key, cursor_value, updated_at)
    VALUES (@key, @cursorValue, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET
      cursor_value = excluded.cursor_value,
      updated_at = excluded.updated_at
  `);
  const upsertSyncCoverageStatement = database.prepare(`
    INSERT INTO sync_coverage (
      scope_key,
      stream,
      provider_id,
      covered_from,
      covered_to,
      algorithm_version,
      synced_at
    ) VALUES (
      @scopeKey,
      @stream,
      @providerId,
      @coveredFrom,
      @coveredTo,
      @algorithmVersion,
      @syncedAt
    )
    ON CONFLICT(scope_key, stream, provider_id, algorithm_version) DO UPDATE SET
      covered_from = CASE
        WHEN excluded.covered_from < sync_coverage.covered_from
          THEN excluded.covered_from
        ELSE sync_coverage.covered_from
      END,
      covered_to = excluded.covered_to,
      synced_at = excluded.synced_at
  `);
  const insertSalesPlanRowStatement = database.prepare(`
    INSERT INTO sales_plan_rows (
      period_start,
      period_end,
      manager_id,
      manager_name,
      target_group_key,
      target_group_label,
      planned_deals,
      planned_amount,
      updated_at
    ) VALUES (
      @periodStart,
      @periodEnd,
      @managerId,
      @managerName,
      @targetGroupKey,
      @targetGroupLabel,
      @plannedDeals,
      @plannedAmount,
      @updatedAt
    )
  `);
  const replaceSalesPlanRowsTransaction = database.transaction(
    (input: ReplaceSalesPlanRowsInput) => {
      database
        .prepare(
          "DELETE FROM sales_plan_rows WHERE period_start = ? AND period_end = ?"
        )
        .run(input.periodStart, input.periodEnd);

      for (const row of input.rows) {
        insertSalesPlanRowStatement.run({
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          managerId: row.managerId,
          managerName: row.managerName ?? null,
          targetGroupKey: row.targetGroupKey,
          targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
          plannedDeals: row.plannedDeals,
          plannedAmount: row.plannedAmount,
          updatedAt: input.updatedAt
        });
      }
    }
  );
  const snapshotTransaction = database.transaction((task: () => unknown) =>
    task()
  );

  return {
    runSnapshotTransaction<T>(task: () => T) {
      return snapshotTransaction(task) as T;
    },

    async getLatestSuccessCursor(categoryIds = [], assignedByIds = []) {
      if (categoryIds.length > 0 || assignedByIds.length > 0) {
        const scopeKey = buildCategoryScopeKey(categoryIds, assignedByIds);
        const syncRun = database
          .prepare(
            `SELECT 1 AS value
            FROM sync_runs
            WHERE status = 'success' AND scope_key = ?
            LIMIT 1`
          )
          .get(scopeKey) as { value: number } | undefined;

        if (!syncRun) {
          return null;
        }
      }

      const where = buildDealScopeWhereClause({ categoryIds, assignedByIds });
      const row = database
        .prepare(
          `SELECT MAX(date_modify) AS value FROM deal_snapshots WHERE ${where.clause}`
        )
        .get(...where.values) as { value: string | null };

      return row.value ?? null;
    },

    async getLatestSuccessfulScope(categoryIds = [], assignedByIds = []) {
      const requestedCategoryIds = categoryIds.map(String);
      const requestedAssignedByIds = assignedByIds.map(String);
      if (requestedCategoryIds.length === 0) {
        return null;
      }

      const rows = database
        .prepare(
          `SELECT id, scope_key AS scopeKey
          FROM sync_runs
          WHERE status = 'success' AND scope_key IS NOT NULL
          ORDER BY id DESC`
        )
        .all() as Array<{ id: number; scopeKey: string | null }>;
      const candidates = rows.flatMap((row) => {
        if (!row.scopeKey) {
          return [];
        }

        const parsed = parseCategoryScopeKey(row.scopeKey);
        if (!parsed) {
          return [];
        }

        if (!sameStringSet(parsed.categoryIds, requestedCategoryIds)) {
          return [];
        }

        if (requestedAssignedByIds.length > 0) {
          if (parsed.assignedByIds.length === 0) {
            return [];
          }

          if (!isSubset(parsed.assignedByIds, requestedAssignedByIds)) {
            return [];
          }
        } else if (parsed.assignedByIds.length > 0) {
          return [];
        }

        return [{ ...parsed, id: row.id }];
      });

      candidates.sort((left, right) => {
        if (right.assignedByIds.length !== left.assignedByIds.length) {
          return right.assignedByIds.length - left.assignedByIds.length;
        }

        return right.id - left.id;
      });

      const candidate = candidates[0];
      if (!candidate) {
        return null;
      }

      return {
        scopeKey: candidate.scopeKey,
        categoryIds: candidate.categoryIds,
        assignedByIds: candidate.assignedByIds
      };
    },

    async getSyncCursor(key) {
      const row = database
        .prepare("SELECT cursor_value AS value FROM sync_cursors WHERE key = ?")
        .get(key) as { value: string } | undefined;

      return row?.value ?? null;
    },

    setSyncCursor(inputRow) {
      upsertSyncCursorStatement.run(inputRow);
      return Promise.resolve();
    },

    async hasSyncCoverage(inputRow) {
      const providerClause =
        inputRow.providerId === null ? "provider_id IS NULL" : "provider_id = ?";
      const values: string[] =
        inputRow.providerId === null
          ? [inputRow.scopeKey, inputRow.stream, inputRow.algorithmVersion]
          : [
              inputRow.scopeKey,
              inputRow.stream,
              inputRow.providerId,
              inputRow.algorithmVersion
            ];
      const requiredTo = inputRow.requiredTo ?? null;
      const row = database
        .prepare(
          `SELECT COUNT(*) AS count
          FROM sync_coverage
          WHERE scope_key = ?
            AND stream = ?
            AND ${providerClause}
            AND algorithm_version = ?
            AND covered_from <= ?
            AND (? IS NULL OR covered_to IS NULL OR covered_to >= ?)
            AND (? IS NULL OR synced_at >= ?)`
        )
        .get(
          ...values,
          inputRow.requiredFrom,
          requiredTo,
          requiredTo,
          inputRow.requiredSyncedAt ?? null,
          inputRow.requiredSyncedAt ?? null
        ) as {
        count: number;
      };

      return row.count > 0;
    },

    upsertSyncCoverage(inputRow) {
      upsertSyncCoverageStatement.run(inputRow);
      return Promise.resolve();
    },

    async getOperationalHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'operational_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getCallHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'call_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getCallActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'call_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getMeetingActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'meeting_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getTaskActivityHistoryBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'task_activity_history_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getDealCustomFieldsBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'deal_custom_fields_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getDealMeetingDateFieldBootstrappedAt() {
      const row = database
        .prepare(
          "SELECT value FROM sync_state WHERE key = 'deal_meeting_date_field_bootstrapped_at'"
        )
        .get() as { value: string } | undefined;

      return row?.value ?? null;
    },

    async getSnapshotStats(scope) {
      const where = buildDealScopeWhereClause(scope);

      if (where.hasScope) {
        const scopedDealSql = `SELECT id FROM deal_snapshots WHERE ${where.clause}`;
        const deals = database
          .prepare(`SELECT COUNT(*) AS count FROM deal_snapshots WHERE ${where.clause}`)
          .get(...where.values) as { count: number };
        const activities = database
          .prepare(
            `SELECT COUNT(*) AS count FROM activity_snapshots WHERE owner_id IN (${scopedDealSql})`
          )
          .get(...where.values) as { count: number };
        const calls = database
          .prepare(
            `SELECT COUNT(*) AS count
             FROM call_snapshots
             WHERE (
               crm_entity_type = 'DEAL'
               AND crm_entity_id IN (${scopedDealSql})
             )
             OR crm_activity_id IN (
               SELECT id
               FROM activity_snapshots
               WHERE owner_id IN (${scopedDealSql})
             )`
          )
          .get(...where.values, ...where.values) as { count: number };
        const stageHistory = database
          .prepare(
            `SELECT COUNT(*) AS count FROM stage_history_snapshots WHERE owner_id IN (${scopedDealSql})`
          )
          .get(...where.values) as { count: number };

        return {
          deals: deals.count,
          activities: activities.count,
          calls: calls.count,
          stageHistory: stageHistory.count
        };
      }

      const deals = database
        .prepare("SELECT COUNT(*) AS count FROM deal_snapshots")
        .get() as { count: number };
      const activities = database
        .prepare("SELECT COUNT(*) AS count FROM activity_snapshots")
        .get() as { count: number };
      const calls = database
        .prepare("SELECT COUNT(*) AS count FROM call_snapshots")
        .get() as { count: number };
      const stageHistory = database
        .prepare("SELECT COUNT(*) AS count FROM stage_history_snapshots")
        .get() as { count: number };

      return {
        deals: deals.count,
        activities: activities.count,
        calls: calls.count,
        stageHistory: stageHistory.count
      };
    },

    async getActivitySnapshotCount() {
      const row = database
        .prepare("SELECT COUNT(*) AS count FROM activity_snapshots")
        .get() as { count: number };

      return row.count;
    },

    async getDealIdsByCategoryIds(categoryIds, assignedByIds) {
      const where = buildDealScopeWhereClause({
        categoryIds,
        ...(assignedByIds ? { assignedByIds } : {})
      });
      const rows = database
        .prepare(
          `SELECT id FROM deal_snapshots WHERE ${where.clause} ORDER BY id ASC`
        )
        .all(...where.values) as Array<{ id: string }>;

      return rows.map((row) => row.id);
    },

    async getOpenDealIdsByCategoryIds(categoryIds, assignedByIds) {
      const where = buildDealScopeWhereClause({
        categoryIds,
        ...(assignedByIds ? { assignedByIds } : {})
      });
      const rows = database
        .prepare(
          `SELECT id
          FROM deal_snapshots
          WHERE ${where.clause} AND stage_semantic_id = 'P'
          ORDER BY id ASC`
        )
        .all(...where.values) as Array<{ id: string }>;

      return rows.map((row) => row.id);
    },

    async getDealsByIds(dealIds) {
      if (dealIds.length === 0) {
        return [];
      }

      return chunkValues(Array.from(new Set(dealIds))).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              id,
              title,
              contact_id AS contactId,
              lead_id AS leadId,
              category_id AS categoryId,
              stage_id AS stageId,
              stage_semantic_id AS stageSemanticId,
              opportunity,
              assigned_by_id AS assignedById,
              source_id AS sourceId,
              quality_value AS qualityValue,
              business_club_value AS businessClubValue,
              target_group_value AS targetGroupValue,
              meeting_type_value AS meetingTypeValue,
              meeting_date_value AS meetingDateValue,
              tariff_value AS tariffValue,
              conversion_event_value AS conversionEventValue,
              refusal_reason_value AS refusalReasonValue,
              refusal_reason_detail AS refusalReasonDetail,
              date_create AS dateCreate,
              date_modify AS dateModify,
              date_closed AS dateClosed,
              utm_source AS utmSource,
              utm_medium AS utmMedium,
              utm_campaign AS utmCampaign,
              utm_content AS utmContent,
              utm_term AS utmTerm
            FROM deal_snapshots
            WHERE id IN (${placeholders})
            ORDER BY id ASC`
          )
          .all(...chunk) as DealSnapshot[];
      });
    },

    async getActivitiesByIds(activityIds) {
      if (activityIds.length === 0) {
        return [];
      }

      const rows = chunkValues(activityIds).flatMap((chunk) => {
        const placeholders = chunk.map(() => "?").join(", ");
        return database
          .prepare(
            `SELECT
              id,
              owner_type_id AS ownerTypeId,
              owner_id AS ownerId,
              type_id AS typeId,
              provider_id AS providerId,
              responsible_id AS responsibleId,
              created_time AS createdTime,
              deadline,
              last_updated AS lastUpdated,
              completed,
              completed_time AS completedTime
            FROM activity_snapshots
            WHERE id IN (${placeholders})
            ORDER BY id ASC`
          )
          .all(...chunk) as Array<
          Omit<ActivitySnapshot, "completed"> & {
            completed: number;
          }
        >;
      });

      return mapActivityRows(rows);
    },

    async getCallActivityIdsMissingActivities(
      limit = 20_000,
      callStartDateFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "c.crm_activity_id IS NOT NULL",
        "TRIM(c.crm_activity_id) <> ''",
        "c.crm_activity_id <> '0'",
        "a.id IS NULL"
      ];
      const values: Array<string | number> = [];

      if (callStartDateFrom) {
        filters.push("c.call_start_date >= ?");
        values.push(callStartDateFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push("c.crm_entity_type = 'DEAL'");
          ownerFilters.push(`c.crm_entity_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT c.crm_activity_id AS activityId
            FROM call_snapshots c
            LEFT JOIN activity_snapshots a ON a.id = c.crm_activity_id
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY c.crm_activity_id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    async getCallActivityIdsMissingCallStats(
      limit = 20_000,
      activityCreatedFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "a.owner_type_id = '2'",
        "a.provider_id = 'VOXIMPLANT_CALL'",
        "c.id IS NULL"
      ];
      const values: Array<string | number> = [];

      if (activityCreatedFrom) {
        filters.push("a.created_time >= ?");
        values.push(activityCreatedFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push(`a.owner_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT a.id AS activityId
            FROM activity_snapshots a
            LEFT JOIN call_snapshots c ON c.crm_activity_id = a.id
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY a.id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    async getCallActivityIdsForCallStatsRefresh(
      limit = 20_000,
      activityCreatedFrom = null,
      ownerIds = []
    ) {
      const safeLimit = Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 20_000;
      const filters = [
        "owner_type_id = '2'",
        "provider_id = 'VOXIMPLANT_CALL'"
      ];
      const values: Array<string | number> = [];

      if (activityCreatedFrom) {
        filters.push("created_time >= ?");
        values.push(activityCreatedFrom);
      }

      const queryRows = (scopedOwnerIds: string[]) => {
        const ownerFilters = [...filters];
        const ownerValues: Array<string | number> = [...values];

        if (scopedOwnerIds.length > 0) {
          const placeholders = scopedOwnerIds.map(() => "?").join(", ");
          ownerFilters.push(`owner_id IN (${placeholders})`);
          ownerValues.push(...scopedOwnerIds);
        }

        return database
          .prepare(
            `SELECT DISTINCT id AS activityId
            FROM activity_snapshots
            WHERE ${ownerFilters.join(" AND ")}
            ORDER BY id ASC
            LIMIT ?`
          )
          .all(...ownerValues, safeLimit) as Array<{ activityId: string }>;
      };

      const rows =
        ownerIds.length > 0
          ? chunkValues(ownerIds).flatMap((chunk) => queryRows(chunk))
          : queryRows([]);

      return Array.from(new Set(rows.map((row) => row.activityId))).slice(
        0,
        safeLimit
      );
    },

    replaceStageCatalog(rows) {
      const transaction = database.transaction((nextRows: StageCatalogEntry[]) => {
        database.exec("DELETE FROM stage_catalog");
        for (const row of nextRows) {
          replaceStageCatalogStatement.run({
            ...row,
            sortOrder: row.sortOrder ?? null
          });
        }
      });
      transaction(rows);
      return Promise.resolve();
    },

    upsertLeads(rows) {
      const transaction = database.transaction((nextRows: LeadSnapshot[]) => {
        for (const row of nextRows) {
          upsertLeadStatement.run(row);
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDeals(rows) {
      const transaction = database.transaction((nextRows: DealSnapshot[]) => {
        for (const row of nextRows) {
          upsertDealStatement.run({
            ...row,
            title: row.title ?? null,
            contactId: row.contactId ?? null,
            businessClubValue: row.businessClubValue ?? null,
            targetGroupValue: row.targetGroupValue ?? null,
            meetingTypeValue: row.meetingTypeValue ?? null,
            meetingDateValue: row.meetingDateValue ?? null,
            tariffValue: row.tariffValue ?? null,
            conversionEventValue: row.conversionEventValue ?? null,
            refusalReasonValue: row.refusalReasonValue ?? null,
            refusalReasonDetail: null
          });
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertStageHistory(rows) {
      const transaction = database.transaction(
        (nextRows: StageHistorySnapshot[]) => {
          for (const row of nextRows) {
            upsertStageHistoryStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertActivities(rows) {
      const transaction = database.transaction((nextRows: ActivitySnapshot[]) => {
        for (const row of nextRows) {
          upsertActivityStatement.run({
            ...row,
            completed: row.completed ? 1 : 0
          });
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertActivityDeadlineChanges(rows) {
      const transaction = database.transaction(
        (nextRows: ActivityDeadlineChangeSnapshot[]) => {
          for (const row of nextRows) {
            upsertDeadlineChangeStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertDealMeetingDateChanges(rows) {
      const transaction = database.transaction(
        (nextRows: DealMeetingDateChangeSnapshot[]) => {
          for (const row of nextRows) {
            upsertDealMeetingDateChangeStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertConversionEventVisits(rows) {
      const transaction = database.transaction(
        (nextRows: ConversionEventVisitSnapshot[]) => {
          for (const row of nextRows) {
            upsertConversionEventVisitStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertCalls(rows) {
      const transaction = database.transaction((nextRows: CallSnapshot[]) => {
        for (const row of nextRows) {
          upsertCallStatement.run(row);
        }
      });
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    upsertManagerDirectory(rows) {
      const transaction = database.transaction(
        (nextRows: ManagerDirectoryEntry[]) => {
          for (const row of nextRows) {
            upsertManagerDirectoryStatement.run(row);
          }
        }
      );
      transaction(rows);
      return Promise.resolve(rows.length);
    },

    markOperationalHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "operational_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markCallHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run("call_history_bootstrapped_at", timestamp);
      return Promise.resolve();
    },

    markCallActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "call_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markMeetingActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "meeting_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markTaskActivityHistoryBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "task_activity_history_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markDealCustomFieldsBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "deal_custom_fields_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    markDealMeetingDateFieldBootstrapped(timestamp) {
      upsertSyncStateStatement.run(
        "deal_meeting_date_field_bootstrapped_at",
        timestamp
      );
      return Promise.resolve();
    },

    async createSyncRun(inputRow) {
      const startedAt = inputRow?.startedAt ?? new Date().toISOString();
      const mode = inputRow?.mode ?? "full";
      const modifiedAfter = inputRow?.modifiedAfter ?? null;
      const scopeKey = inputRow?.scopeKey ?? null;
      const result = database
        .prepare(`
          INSERT INTO sync_runs (started_at, status, mode, modified_after, scope_key)
          VALUES (?, 'running', ?, ?, ?)
        `)
        .run(startedAt, mode, modifiedAfter, scopeKey);
      return Number(result.lastInsertRowid);
    },

    async recoverStaleSyncRuns(inputRow) {
      const failedAt = inputRow.failedAt ?? new Date().toISOString();
      const result = database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?,
              status = 'failed',
              diagnostics_json = ?
          WHERE status = 'running' AND started_at < ?
        `)
        .run(
          failedAt,
          JSON.stringify(inputRow.diagnostics ?? ["SYNC_FAILED", "error=STALE_RUNNING_SYNC"]),
          inputRow.staleBefore
        );
      return result.changes;
    },

    finishSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?,
              status = ?,
              leads_synced = ?,
              deals_synced = ?,
              deal_breakdown_json = ?,
              diagnostics_json = ?,
              modified_after = ?
          WHERE id = ?
        `)
        .run(
          inputRow.finishedAt,
          inputRow.status,
          inputRow.leadsSynced,
          inputRow.dealsSynced,
          JSON.stringify(
            inputRow.dealBreakdown ??
              buildLegacyDealBreakdown(inputRow.dealsSynced)
          ),
          JSON.stringify(inputRow.diagnostics ?? []),
          inputRow.modifiedAfter,
          inputRow.syncRunId
        );
      return Promise.resolve();
    },

    failSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?, status = ?, diagnostics_json = ?
          WHERE id = ?
        `)
        .run(
          inputRow.finishedAt,
          inputRow.status,
          JSON.stringify(inputRow.diagnostics ?? []),
          inputRow.syncRunId
        );
      return Promise.resolve();
    },

    async getAllLeads() {
      return database
        .prepare(
          `SELECT
            id,
            status_id AS statusId,
            source_id AS sourceId,
            opportunity,
            assigned_by_id AS assignedById,
            date_create AS dateCreate,
            date_modify AS dateModify,
            utm_source AS utmSource,
            utm_medium AS utmMedium,
            utm_campaign AS utmCampaign,
            utm_content AS utmContent,
            utm_term AS utmTerm
          FROM lead_snapshots
          ORDER BY id ASC`
        )
        .all() as LeadSnapshot[];
    },

    async getAllDeals() {
      return database
        .prepare(
          `SELECT
            id,
            title,
            contact_id AS contactId,
            lead_id AS leadId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_semantic_id AS stageSemanticId,
            opportunity,
            assigned_by_id AS assignedById,
            source_id AS sourceId,
            quality_value AS qualityValue,
            business_club_value AS businessClubValue,
            target_group_value AS targetGroupValue,
            meeting_type_value AS meetingTypeValue,
            meeting_date_value AS meetingDateValue,
            tariff_value AS tariffValue,
            conversion_event_value AS conversionEventValue,
            refusal_reason_value AS refusalReasonValue,
            refusal_reason_detail AS refusalReasonDetail,
            date_create AS dateCreate,
            date_modify AS dateModify,
            date_closed AS dateClosed,
            utm_source AS utmSource,
            utm_medium AS utmMedium,
            utm_campaign AS utmCampaign,
            utm_content AS utmContent,
            utm_term AS utmTerm
          FROM deal_snapshots
          ORDER BY id ASC`
        )
        .all() as DealSnapshot[];
    },

    async getAllStageHistory() {
      return database
        .prepare(
          `SELECT
            id,
            owner_id AS ownerId,
            category_id AS categoryId,
            stage_id AS stageId,
            stage_semantic_id AS stageSemanticId,
            type_id AS typeId,
            created_time AS createdTime
          FROM stage_history_snapshots
          ORDER BY created_time ASC, id ASC`
        )
        .all() as StageHistorySnapshot[];
    },

    async getAllActivities() {
      const rows = database
        .prepare(
          `SELECT
            id,
            owner_type_id AS ownerTypeId,
            owner_id AS ownerId,
            type_id AS typeId,
            provider_id AS providerId,
            responsible_id AS responsibleId,
            created_time AS createdTime,
            deadline,
            last_updated AS lastUpdated,
            completed,
            completed_time AS completedTime
          FROM activity_snapshots
          ORDER BY id ASC`
        )
        .all() as Array<
        Omit<ActivitySnapshot, "completed"> & {
          completed: number;
        }
      >;

      return mapActivityRows(rows);
    },

    async getAllActivityDeadlineChanges() {
      return database
        .prepare(
          `SELECT
            id,
            activity_id AS activityId,
            owner_id AS ownerId,
            responsible_id AS responsibleId,
            previous_deadline AS previousDeadline,
            next_deadline AS nextDeadline,
            changed_at AS changedAt
          FROM activity_deadline_changes
          ORDER BY changed_at ASC, id ASC`
        )
        .all() as ActivityDeadlineChangeSnapshot[];
    },

    async getAllDealMeetingDateChanges() {
      return database
        .prepare(
          `SELECT
            id,
            deal_id AS dealId,
            assigned_by_id AS assignedById,
            previous_meeting_date AS previousMeetingDate,
            next_meeting_date AS nextMeetingDate,
            changed_at AS changedAt
          FROM deal_meeting_date_changes
          ORDER BY changed_at ASC, id ASC`
        )
        .all() as DealMeetingDateChangeSnapshot[];
    },

    async getAllConversionEventVisits() {
      return database
        .prepare(
          `SELECT
            id,
            event_name AS eventName,
            event_date AS eventDate,
            status,
            stage_id AS stageId,
            stage_name AS stageName,
            deal_id AS dealId,
            contact_id AS contactId,
            manager_id AS managerId,
            source_id AS sourceId,
            created_time AS createdTime,
            updated_time AS updatedTime
          FROM conversion_event_visit_snapshots
          ORDER BY event_date ASC, id ASC`
        )
        .all() as ConversionEventVisitSnapshot[];
    },

    async getAllCalls() {
      return database
        .prepare(
          `SELECT
            id,
            crm_activity_id AS crmActivityId,
            portal_user_id AS portalUserId,
            call_type AS callType,
            call_start_date AS callStartDate,
            call_duration_seconds AS callDurationSeconds,
            crm_entity_type AS crmEntityType,
            crm_entity_id AS crmEntityId,
            call_failed_code AS callFailedCode
          FROM call_snapshots
          ORDER BY call_start_date ASC, id ASC`
        )
        .all() as CallSnapshot[];
    },

    async getManagerDirectory() {
      return database
        .prepare(
          `SELECT
            id,
            name
          FROM manager_directory
          ORDER BY name ASC, id ASC`
        )
        .all() as ManagerDirectoryEntry[];
    },

    async getStageCatalog() {
      return database
        .prepare(
          `SELECT
            entity_type AS entityType,
            category_id AS categoryId,
            status_id AS statusId,
            name,
            semantic_id AS semanticId,
            sort_order AS sortOrder
          FROM stage_catalog
          ORDER BY entity_type ASC, category_id ASC, sort_order ASC, status_id ASC`
        )
        .all() as StageCatalogEntry[];
    },

    async getSalesPlanRows(periodStart, periodEnd) {
      return database
        .prepare(
          `SELECT
            period_start AS periodStart,
            period_end AS periodEnd,
            manager_id AS managerId,
            manager_name AS managerName,
            target_group_key AS targetGroupKey,
            target_group_label AS targetGroupLabel,
            planned_deals AS plannedDeals,
            planned_amount AS plannedAmount,
            updated_at AS updatedAt
          FROM sales_plan_rows
          WHERE period_start = ? AND period_end = ?
          ORDER BY manager_id ASC, target_group_label ASC, target_group_key ASC`
        )
        .all(periodStart, periodEnd) as SalesPlanRow[];
    },

    async replaceSalesPlanRows(input) {
      replaceSalesPlanRowsTransaction(input);
      return this.getSalesPlanRows(input.periodStart, input.periodEnd);
    },

    async getWonStageIds() {
      const rows = database
        .prepare(
          "SELECT stage_id AS stageId FROM won_stage_config WHERE enabled = 1 ORDER BY stage_id"
        )
        .all() as Array<{ stageId: string }>;
      return rows.map((row) => row.stageId);
    },

    async setWonStageIds(stageIds) {
      const transaction = database.transaction((nextStageIds: string[]) => {
        database.exec("DELETE FROM won_stage_config");
        const insertStatement = database.prepare(`
          INSERT INTO won_stage_config (stage_id, enabled)
          VALUES (?, 1)
        `);
        for (const stageId of nextStageIds) {
          insertStatement.run(stageId);
        }
      });
      transaction(stageIds);
    },

    async getLastSyncSummary(scopeKey) {
      const scopeClause = scopeKey ? "AND scope_key = ?" : "";
      const values = scopeKey ? [scopeKey] : [];
      const row = database
        .prepare(`
          SELECT
            finished_at AS finishedAt,
            leads_synced AS leadsSynced,
            deals_synced AS dealsSynced,
            deal_breakdown_json AS dealBreakdownJson,
            mode
          FROM sync_runs
          WHERE status = 'success' AND finished_at IS NOT NULL
          ${scopeClause}
          ORDER BY finished_at DESC
          LIMIT 1
        `)
        .get(...values) as
        | (Omit<LastSyncSummary, "dealBreakdown"> & {
            dealBreakdownJson?: string | null;
          })
        | undefined;

      return row
        ? {
            finishedAt: row.finishedAt,
            leadsSynced: row.leadsSynced,
            dealsSynced: row.dealsSynced,
            mode: row.mode,
            dealBreakdown: parseDealBreakdown(
              row.dealBreakdownJson,
              row.dealsSynced
            )
          }
        : null;
    },

    close() {
      database.close();
    }
  };
}
