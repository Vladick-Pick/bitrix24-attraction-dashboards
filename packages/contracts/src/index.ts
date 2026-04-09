export interface LeadSnapshot {
  id: string;
  statusId: string;
  sourceId: string | null;
  opportunity: number | null;
  assignedById: string | null;
  dateCreate: string;
  dateModify: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface DealSnapshot {
  id: string;
  leadId: string | null;
  categoryId: string | null;
  stageId: string;
  stageSemanticId: string | null;
  opportunity: number | null;
  assignedById: string | null;
  dateCreate: string;
  dateModify: string;
  dateClosed: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface StageCatalogEntry {
  entityType: "deal" | "lead" | "source";
  categoryId: string | null;
  statusId: string;
  name: string;
  semanticId: string | null;
}

export interface ReportRange {
  from: string;
  to: string;
}

export interface SalesTimelinePoint {
  date: string;
  salesCount: number;
  salesAmount: number;
}

export interface SalesOverview {
  salesCount: number;
  salesAmount: number;
  averageSaleAmount: number;
  newDealsCount: number;
  conversionRate: number;
  salesTimeline: SalesTimelinePoint[];
}

export interface FunnelSnapshotEntry {
  stageId: string;
  stageName: string;
  count: number;
  amount: number;
}

export interface SourceBreakdownEntry {
  sourceKey: string;
  sourceLabel: string;
  salesCount: number;
  salesAmount: number;
  newDealsCount: number;
  newLeadsCount: number;
}

export interface DashboardData {
  salesOverview: SalesOverview;
  funnelSnapshot: FunnelSnapshotEntry[];
  sourceBreakdown: SourceBreakdownEntry[];
}

export interface DashboardInput {
  range: ReportRange;
  wonStageIds: string[];
  deals: DealSnapshot[];
  leads: LeadSnapshot[];
  stageCatalog: StageCatalogEntry[];
}

export interface ManualSyncSummary {
  syncRunId: number;
  leadsSynced: number;
  dealsSynced: number;
  mode: "full" | "delta";
  modifiedAfter: string | null;
  finishedAt: string;
}
