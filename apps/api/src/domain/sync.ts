import type {
  DealSnapshot,
  LeadSnapshot,
  ManualSyncSummary,
  StageCatalogEntry
} from "@bitrix24-reporting/contracts";

export interface LeadRow {
  ID: string;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  STATUS_ID: string;
  SOURCE_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
}

export interface DealRow {
  ID: string;
  LEAD_ID: string | null;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  DATE_CLOSED?: string | null;
  CATEGORY_ID: string | null;
  STAGE_ID: string;
  STAGE_SEMANTIC_ID: string | null;
  OPPORTUNITY: number | null;
  ASSIGNED_BY_ID: string | null;
  UTM_SOURCE: string | null;
  UTM_MEDIUM: string | null;
  UTM_CAMPAIGN: string | null;
  UTM_CONTENT: string | null;
  UTM_TERM: string | null;
}

export interface SyncClient {
  fetchLeadStages(): Promise<StageCatalogEntry[]>;
  fetchDealStages(): Promise<StageCatalogEntry[]>;
  listLeads(cursor: { modifiedAfter: string | null }): Promise<LeadRow[]>;
  listDeals(cursor: { modifiedAfter: string | null }): Promise<DealRow[]>;
}

export interface SyncRepository {
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
}

interface PerformManualSyncInput {
  client: SyncClient;
  repository: SyncRepository;
  now: () => string;
}

function mapLeadRow(row: LeadRow): LeadSnapshot {
  return {
    id: row.ID,
    statusId: row.STATUS_ID,
    sourceId: row.SOURCE_ID,
    opportunity: row.OPPORTUNITY,
    assignedById: row.ASSIGNED_BY_ID,
    dateCreate: row.DATE_CREATE,
    dateModify: row.DATE_MODIFY,
    utmSource: row.UTM_SOURCE,
    utmMedium: row.UTM_MEDIUM,
    utmCampaign: row.UTM_CAMPAIGN,
    utmContent: row.UTM_CONTENT,
    utmTerm: row.UTM_TERM
  };
}

function mapDealRow(row: DealRow): DealSnapshot {
  return {
    id: row.ID,
    leadId: row.LEAD_ID,
    categoryId: row.CATEGORY_ID,
    stageId: row.STAGE_ID,
    stageSemanticId: row.STAGE_SEMANTIC_ID,
    opportunity: row.OPPORTUNITY,
    assignedById: row.ASSIGNED_BY_ID,
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

export async function performManualSync(
  input: PerformManualSyncInput
): Promise<ManualSyncSummary> {
  const modifiedAfter = await input.repository.getLatestSuccessCursor();
  const mode = modifiedAfter === null ? "full" : "delta";
  const startedAt = input.now();
  const syncRunId = await input.repository.createSyncRun({
    startedAt,
    mode,
    modifiedAfter
  });

  const [leadStages, dealStages, leadRows, dealRows] = await Promise.all([
    input.client.fetchLeadStages(),
    input.client.fetchDealStages(),
    input.client.listLeads({ modifiedAfter }),
    input.client.listDeals({ modifiedAfter })
  ]);

  await input.repository.replaceStageCatalog([...leadStages, ...dealStages]);

  const leadsSynced = await input.repository.upsertLeads(leadRows.map(mapLeadRow));
  const dealsSynced = await input.repository.upsertDeals(dealRows.map(mapDealRow));
  const finishedAt = input.now();

  await input.repository.finishSyncRun({
    syncRunId,
    finishedAt,
    status: "success",
    leadsSynced,
    dealsSynced,
    modifiedAfter
  });

  return {
    syncRunId,
    leadsSynced,
    dealsSynced,
    mode,
    modifiedAfter,
    finishedAt
  };
}
