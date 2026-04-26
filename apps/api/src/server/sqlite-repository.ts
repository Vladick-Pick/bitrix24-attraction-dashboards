import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import type {
  ActivityDeadlineChangeSnapshot,
  ActivitySnapshot,
  CallSnapshot,
  DealSnapshot,
  LeadSnapshot,
  ManagerDirectoryEntry,
  StageCatalogEntry,
  StageHistorySnapshot
} from "@bitrix24-reporting/contracts";

export interface LastSyncSummary {
  finishedAt: string;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
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
  algorithmVersion: string;
}

export interface SqliteRepository {
  getLatestSuccessCursor(categoryIds?: string[]): Promise<string | null>;
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
  getActivitySnapshotCount(): Promise<number>;
  getDealIdsByCategoryIds(categoryIds: string[]): Promise<string[]>;
  getActivitiesByIds(activityIds: string[]): Promise<ActivitySnapshot[]>;
  getCallActivityIdsMissingActivities(
    limit?: number,
    callStartDateFrom?: string | null
  ): Promise<string[]>;
  getCallActivityIdsMissingCallStats(
    limit?: number,
    activityCreatedFrom?: string | null
  ): Promise<string[]>;
  getCallActivityIdsForCallStatsRefresh(
    limit?: number,
    activityCreatedFrom?: string | null
  ): Promise<string[]>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertLeads(rows: LeadSnapshot[]): Promise<number>;
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
  markCallActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markMeetingActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markTaskActivityHistoryBootstrapped(timestamp: string): Promise<void>;
  markDealCustomFieldsBootstrapped(timestamp: string): Promise<void>;
  markDealMeetingDateFieldBootstrapped(timestamp: string): Promise<void>;
  createSyncRun(input?: {
    startedAt: string;
    mode: "full" | "delta";
    modifiedAfter: string | null;
  }): Promise<number>;
  recoverStaleSyncRuns(input: { staleBefore: string; failedAt?: string }): Promise<number>;
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
  getAllLeads(): Promise<LeadSnapshot[]>;
  getAllDeals(): Promise<DealSnapshot[]>;
  getAllStageHistory(): Promise<StageHistorySnapshot[]>;
  getAllActivities(): Promise<ActivitySnapshot[]>;
  getAllActivityDeadlineChanges(): Promise<ActivityDeadlineChangeSnapshot[]>;
  getAllCalls(): Promise<CallSnapshot[]>;
  getManagerDirectory(): Promise<ManagerDirectoryEntry[]>;
  getStageCatalog(): Promise<StageCatalogEntry[]>;
  getWonStageIds(): Promise<string[]>;
  setWonStageIds(stageIds: string[]): Promise<void>;
  getLastSyncSummary(): Promise<LastSyncSummary | null>;
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

function buildCategoryWhereClause(categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return {
      clause: "1 = 1",
      values: [] as string[]
    };
  }

  const placeholders = categoryIds.map(() => "?").join(", ");
  return {
    clause: `category_id IN (${placeholders})`,
    values: categoryIds
  };
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
      leads_synced INTEGER DEFAULT 0,
      deals_synced INTEGER DEFAULT 0
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

    CREATE INDEX IF NOT EXISTS idx_deal_snapshots_category_id
      ON deal_snapshots (category_id);
    CREATE INDEX IF NOT EXISTS idx_stage_history_owner_id
      ON stage_history_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_owner_id
      ON activity_snapshots (owner_id);
    CREATE INDEX IF NOT EXISTS idx_activity_provider_created
      ON activity_snapshots (provider_id, created_time);
    CREATE INDEX IF NOT EXISTS idx_call_crm_activity_id
      ON call_snapshots (crm_activity_id);
  `);

  ensureColumn(database, "deal_snapshots", "source_id", "TEXT");
  ensureColumn(database, "deal_snapshots", "title", "TEXT");
  ensureColumn(database, "deal_snapshots", "quality_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "business_club_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "target_group_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_type_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "meeting_date_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "tariff_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_value", "TEXT");
  ensureColumn(database, "deal_snapshots", "refusal_reason_detail", "TEXT");
  ensureColumn(database, "stage_catalog", "sort_order", "INTEGER");

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
      id, title, lead_id, category_id, stage_id, stage_semantic_id, opportunity, assigned_by_id,
      source_id, quality_value, business_club_value, target_group_value, meeting_type_value, meeting_date_value, tariff_value, refusal_reason_value, refusal_reason_detail, date_create,
      date_modify, date_closed, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    ) VALUES (
      @id, @title, @leadId, @categoryId, @stageId, @stageSemanticId, @opportunity, @assignedById,
      @sourceId, @qualityValue, @businessClubValue, @targetGroupValue, @meetingTypeValue, @meetingDateValue, @tariffValue, @refusalReasonValue, @refusalReasonDetail, @dateCreate,
      @dateModify, @dateClosed, @utmSource, @utmMedium, @utmCampaign, @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
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
  const snapshotTransaction = database.transaction((task: () => unknown) =>
    task()
  );

  return {
    runSnapshotTransaction<T>(task: () => T) {
      return snapshotTransaction(task) as T;
    },

    async getLatestSuccessCursor(categoryIds = []) {
      const where = buildCategoryWhereClause(categoryIds);
      const row = database
        .prepare(
          `SELECT MAX(date_modify) AS value FROM deal_snapshots WHERE ${where.clause}`
        )
        .get(...where.values) as { value: string | null };

      return row.value ?? null;
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
            AND (? IS NULL OR covered_to IS NULL OR covered_to >= ?)`
        )
        .get(...values, inputRow.requiredFrom, requiredTo, requiredTo) as {
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

    async getActivitySnapshotCount() {
      const row = database
        .prepare("SELECT COUNT(*) AS count FROM activity_snapshots")
        .get() as { count: number };

      return row.count;
    },

    async getDealIdsByCategoryIds(categoryIds) {
      const where = buildCategoryWhereClause(categoryIds);
      const rows = database
        .prepare(
          `SELECT id FROM deal_snapshots WHERE ${where.clause} ORDER BY id ASC`
        )
        .all(...where.values) as Array<{ id: string }>;

      return rows.map((row) => row.id);
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

    async getCallActivityIdsMissingActivities(limit = 20_000, callStartDateFrom = null) {
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

      const rows = database
        .prepare(
          `SELECT DISTINCT c.crm_activity_id AS activityId
          FROM call_snapshots c
          LEFT JOIN activity_snapshots a ON a.id = c.crm_activity_id
          WHERE ${filters.join(" AND ")}
          ORDER BY c.crm_activity_id ASC
          LIMIT ?`
        )
        .all(...values, safeLimit) as Array<{ activityId: string }>;

      return rows.map((row) => row.activityId);
    },

    async getCallActivityIdsMissingCallStats(limit = 20_000, activityCreatedFrom = null) {
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

      const rows = database
        .prepare(
          `SELECT DISTINCT a.id AS activityId
          FROM activity_snapshots a
          LEFT JOIN call_snapshots c ON c.crm_activity_id = a.id
          WHERE ${filters.join(" AND ")}
          ORDER BY a.id ASC
          LIMIT ?`
        )
        .all(...values, safeLimit) as Array<{ activityId: string }>;

      return rows.map((row) => row.activityId);
    },

    async getCallActivityIdsForCallStatsRefresh(
      limit = 20_000,
      activityCreatedFrom = null
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

      const rows = database
        .prepare(
          `SELECT DISTINCT id AS activityId
          FROM activity_snapshots
          WHERE ${filters.join(" AND ")}
          ORDER BY id ASC
          LIMIT ?`
        )
        .all(...values, safeLimit) as Array<{ activityId: string }>;

      return rows.map((row) => row.activityId);
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
            businessClubValue: row.businessClubValue ?? null,
            targetGroupValue: row.targetGroupValue ?? null,
            meetingTypeValue: row.meetingTypeValue ?? null,
            meetingDateValue: row.meetingDateValue ?? null,
            tariffValue: row.tariffValue ?? null,
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
      const result = database
        .prepare(`
          INSERT INTO sync_runs (started_at, status, mode, modified_after)
          VALUES (?, 'running', ?, ?)
        `)
        .run(startedAt, mode, modifiedAfter);
      return Number(result.lastInsertRowid);
    },

    async recoverStaleSyncRuns(inputRow) {
      const failedAt = inputRow.failedAt ?? new Date().toISOString();
      const result = database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?, status = 'failed'
          WHERE status = 'running' AND started_at < ?
        `)
        .run(failedAt, inputRow.staleBefore);
      return result.changes;
    },

    finishSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?, status = ?, leads_synced = ?, deals_synced = ?, modified_after = ?
          WHERE id = ?
        `)
        .run(
          inputRow.finishedAt,
          inputRow.status,
          inputRow.leadsSynced,
          inputRow.dealsSynced,
          inputRow.modifiedAfter,
          inputRow.syncRunId
        );
      return Promise.resolve();
    },

    failSyncRun(inputRow) {
      database
        .prepare(`
          UPDATE sync_runs
          SET finished_at = ?, status = ?
          WHERE id = ?
        `)
        .run(inputRow.finishedAt, inputRow.status, inputRow.syncRunId);
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

    async getLastSyncSummary() {
      const row = database
        .prepare(`
          SELECT finished_at AS finishedAt, leads_synced AS leadsSynced, deals_synced AS dealsSynced, mode
          FROM sync_runs
          WHERE status = 'success' AND finished_at IS NOT NULL
          ORDER BY finished_at DESC
          LIMIT 1
        `)
        .get() as LastSyncSummary | undefined;

      return row ?? null;
    },

    close() {
      database.close();
    }
  };
}
