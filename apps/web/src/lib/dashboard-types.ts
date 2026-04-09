export const PERIOD_OPTIONS = [7, 30, 90, 180] as const

export type PeriodDays = (typeof PERIOD_OPTIONS)[number]
export type TimelineGranularity = 'daily' | 'weekly'

export interface SalesTimelinePoint {
  date: string
  salesCount: number
  salesAmount: number
}

export interface SalesOverview {
  salesCount: number
  salesAmount: number
  averageSaleAmount: number
  newDealsCount: number
  conversionRate: number
  salesTimeline: SalesTimelinePoint[]
}

export interface FunnelSnapshotEntry {
  stageId: string
  stageName: string
  count: number
  amount: number
}

export interface SourceBreakdownEntry {
  sourceKey: string
  sourceLabel: string
  salesCount: number
  salesAmount: number
  newDealsCount: number
  newLeadsCount: number
}

export interface DashboardData {
  salesOverview: SalesOverview
  funnelSnapshot: FunnelSnapshotEntry[]
  sourceBreakdown: SourceBreakdownEntry[]
}

export interface StageCatalogEntry {
  entityType: 'deal' | 'lead' | 'source'
  categoryId: string | null
  statusId: string
  name: string
  semanticId: string | null
}

export interface LastSyncSummary {
  finishedAt: string
  leadsSynced: number
  dealsSynced: number
  mode: 'full' | 'delta'
}

export interface MetaResponse {
  stageCatalog: StageCatalogEntry[]
  wonStageIds: string[]
  defaultPeriodDays: number
  lastSync: LastSyncSummary | null
}

export interface SyncSummary {
  syncRunId: number
  leadsSynced: number
  dealsSynced: number
  mode: 'full' | 'delta'
  modifiedAfter: string | null
  finishedAt: string
}

export interface TimelineBucket {
  bucket: string
  label: string
  salesCount: number
  salesAmount: number
}

export interface DashboardSnapshot {
  dashboard: DashboardData
  meta: MetaResponse
}
