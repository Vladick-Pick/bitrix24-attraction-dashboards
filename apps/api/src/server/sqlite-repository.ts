import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

import Database from "better-sqlite3";
import type {
  DealSnapshot,
  LeadSnapshot,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

export interface LastSyncSummary {
  finishedAt: string;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
}

export interface SqliteRepository {
  getLatestSuccessCursor(): Promise<string | null>;
  replaceStageCatalog(rows: StageCatalogEntry[]): Promise<void>;
  upsertLeads(rows: LeadSnapshot[]): Promise<number>;
  upsertDeals(rows: DealSnapshot[]): Promise<number>;
  createSyncRun(input?: {
    startedAt: string;
    mode: "full" | "delta";
    modifiedAfter: string | null;
  }): Promise<number>;
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
      lead_id TEXT,
      category_id TEXT,
      stage_id TEXT NOT NULL,
      stage_semantic_id TEXT,
      opportunity REAL,
      assigned_by_id TEXT,
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
      PRIMARY KEY (entity_type, category_id, status_id)
    );

    CREATE TABLE IF NOT EXISTS won_stage_config (
      stage_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL
    );
  `);

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
    INSERT INTO stage_catalog (entity_type, category_id, status_id, name, semantic_id)
    VALUES (@entityType, @categoryId, @statusId, @name, @semanticId)
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
      id, lead_id, category_id, stage_id, stage_semantic_id, opportunity, assigned_by_id,
      date_create, date_modify, date_closed, utm_source, utm_medium, utm_campaign,
      utm_content, utm_term
    ) VALUES (
      @id, @leadId, @categoryId, @stageId, @stageSemanticId, @opportunity, @assignedById,
      @dateCreate, @dateModify, @dateClosed, @utmSource, @utmMedium, @utmCampaign,
      @utmContent, @utmTerm
    )
    ON CONFLICT(id) DO UPDATE SET
      lead_id = excluded.lead_id,
      category_id = excluded.category_id,
      stage_id = excluded.stage_id,
      stage_semantic_id = excluded.stage_semantic_id,
      opportunity = excluded.opportunity,
      assigned_by_id = excluded.assigned_by_id,
      date_create = excluded.date_create,
      date_modify = excluded.date_modify,
      date_closed = excluded.date_closed,
      utm_source = excluded.utm_source,
      utm_medium = excluded.utm_medium,
      utm_campaign = excluded.utm_campaign,
      utm_content = excluded.utm_content,
      utm_term = excluded.utm_term
  `);

  return {
    async getLatestSuccessCursor() {
      const leadCursor = database
        .prepare("SELECT MAX(date_modify) AS value FROM lead_snapshots")
        .get() as { value: string | null };
      const dealCursor = database
        .prepare("SELECT MAX(date_modify) AS value FROM deal_snapshots")
        .get() as { value: string | null };

      return [leadCursor.value, dealCursor.value]
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1) ?? null;
    },

    async replaceStageCatalog(rows) {
      const transaction = database.transaction((nextRows: StageCatalogEntry[]) => {
        database.exec("DELETE FROM stage_catalog");
        for (const row of nextRows) {
          replaceStageCatalogStatement.run(row);
        }
      });
      transaction(rows);
    },

    async upsertLeads(rows) {
      const transaction = database.transaction((nextRows: LeadSnapshot[]) => {
        for (const row of nextRows) {
          upsertLeadStatement.run(row);
        }
      });
      transaction(rows);
      return rows.length;
    },

    async upsertDeals(rows) {
      const transaction = database.transaction((nextRows: DealSnapshot[]) => {
        for (const row of nextRows) {
          upsertDealStatement.run(row);
        }
      });
      transaction(rows);
      return rows.length;
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

    async finishSyncRun(inputRow) {
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
    },

    async getAllLeads() {
      return database.prepare("SELECT * FROM lead_snapshots").all() as LeadSnapshot[];
    },

    async getAllDeals() {
      return database.prepare("SELECT * FROM deal_snapshots").all() as DealSnapshot[];
    },

    async getStageCatalog() {
      return database
        .prepare(
          "SELECT entity_type AS entityType, category_id AS categoryId, status_id AS statusId, name, semantic_id AS semanticId FROM stage_catalog"
        )
        .all() as StageCatalogEntry[];
    },

    async getWonStageIds() {
      const rows = database
        .prepare("SELECT stage_id AS stageId FROM won_stage_config WHERE enabled = 1 ORDER BY stage_id")
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
