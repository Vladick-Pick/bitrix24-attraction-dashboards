export const PERIOD_OPTIONS = [7, 30, 90, 180] as const

export type PeriodDays = (typeof PERIOD_OPTIONS)[number]
export type ReportPreset = PeriodDays | 'custom'
export type TimelineGranularity = 'daily' | 'weekly'
export interface ReportRange {
  from: string
  to: string
}

export interface ReportComparison<TSnapshot> {
  compareIndex: number
  range: ReportRange
  snapshot: TSnapshot
}

export interface ReportFilters {
  managerIds?: string[]
  sourceKeys?: string[]
}

export type DashboardQuery = (
  | {
      preset: PeriodDays
    }
  | {
      preset: 'custom'
      from: string
      to: string
    }
) &
  ReportFilters & {
    compareRanges?: ReportRange[]
  }

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

export interface SalesSummary {
  salesCount: number
  salesAmount: number
  averageSaleAmount: number
  newDealsCount: number
  conversionRate: number
  meetingsCount?: number
}

export interface DealCohortContext {
  createdMonth: string
  cohortCreatedDeals: number
  cohortWonDeals: number
  cohortWonConversionRate: number
}

export interface DealCallSummary {
  total: number
  incoming: number
  outgoing: number
  successful: number
  failed: number
  overThirtySeconds: number
  connectedOverThirtySeconds: number
}

export interface DealTaskSummary {
  created: number
  closed: number
}

export interface DealMeetingSummary {
  total: number
}

export interface DealMeetingEvent {
  activityId: string
  createdAt: string
  timelineAt: string
  scheduledAt: string
  completed: boolean
}

export interface DealStageTimelineEntry {
  stageId: string
  stageName: string
  enteredAt: string
  leftAt: string
  durationHours: number
  meetingEvents?: DealMeetingEvent[]
}

export interface SalesDealRow {
  dealId: string
  dealTitle: string
  managerId: string
  managerName: string
  amount: number
  dateCreate: string
  dateClosed: string
  cycleDays: number
  sourceKey?: string
  sourceLabel?: string
  qualityValue?: string | null
  businessClubValue?: string | null
  targetGroupValue?: string | null
  meetingTypeValue?: string | null
  meetingDateValue?: string | null
  tariffValue?: string | null
  cohortContext: DealCohortContext
  callSummary: DealCallSummary
  taskSummary: DealTaskSummary
  meetingSummary?: DealMeetingSummary
  stageTimeline: DealStageTimelineEntry[]
}

export interface SalesManagerGroup {
  managerId: string
  managerName: string
  totalWonDeals: number
  totalSalesAmount: number
  deals: SalesDealRow[]
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

export interface DashboardDataSnapshot {
  salesSummary: SalesSummary
  managerGroups: SalesManagerGroup[]
}

export interface DashboardData extends DashboardDataSnapshot {
  comparisons?: Array<ReportComparison<DashboardDataSnapshot>>
}

export interface StageSequenceEntry {
  stageId: string
  stageName: string
  sortOrder: number
}

export interface StageProgressionMetric {
  stageId: string
  stageName: string
  reachedDeals: number
  conversionRate: number
  averageStageDurationHours: number
}

export interface SourceQualityConversionRow {
  sourceKey: string
  sourceLabel: string
  qualityKey: string
  qualityLabel: string
  createdDeals: number
  wonDeals: number
  stageMetrics: StageProgressionMetric[]
}

export interface SourceQualityConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalWonDeals: number
  rows: SourceQualityConversionRow[]
  stageSequence: StageSequenceEntry[]
}

export interface SourceQualityConversionReport
  extends SourceQualityConversionReportSnapshot {
  comparisons?: Array<ReportComparison<SourceQualityConversionReportSnapshot>>
}

export interface StageWorkloadMetric {
  stageId: string
  stageName: string
  dealCount: number
  createdCount: number
  rescheduledCount: number
  closedCount: number
  averageCreatedPerDeal: number
  averageRescheduledPerDeal: number
  averageClosedPerDeal: number
}

export interface MeetingTypeBucket {
  meetingTypeKey: string
  meetingTypeLabel: string
  count: number
}

export interface BusinessClubDealBucket {
  businessClubKey: string
  businessClubLabel: string
  dealCount: number
}

export interface SlaMetric {
  slaKey: 'sla1' | 'sla2' | 'sla3'
  label: string
  onTimeCount: number
  lateCount: number
  noTouchCount: number
  medianHours: number
}

export interface ManagerActivitiesWorkloadRow {
  managerId: string
  managerName: string
  dealCount: number
  createdCount: number
  rescheduledCount: number
  closedCount: number
  meetingCount: number
  averageCreatedPerDeal: number
  averageRescheduledPerDeal: number
  averageClosedPerDeal: number
  averageMeetingsPerDeal: number
  meetingTypeBreakdown: MeetingTypeBucket[]
  businessClubBreakdown: BusinessClubDealBucket[]
  slaMetrics: SlaMetric[]
  stageBreakdown: StageWorkloadMetric[]
}

export interface ActivitiesWorkloadReportSnapshot {
  range: ReportRange
  totalDealCount: number
  totalCreatedCount: number
  totalRescheduledCount: number
  totalClosedCount: number
  totalMeetingCount: number
  warnings: string[]
  managerRows: ManagerActivitiesWorkloadRow[]
}

export interface ActivitiesWorkloadReport extends ActivitiesWorkloadReportSnapshot {
  comparisons?: Array<ReportComparison<ActivitiesWorkloadReportSnapshot>>
}

export interface StageCallMetric {
  stageId: string
  stageName: string
  dealCount: number
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageCallsPerDeal: number
  averageDurationSeconds: number
}

export interface CallPopulationSummary {
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageDurationSeconds: number
}

export interface LinkedDealCallPopulationSummary extends CallPopulationSummary {
  dealCount: number
  averageCallsPerDeal: number
  stageBreakdown: StageCallMetric[]
}

export interface LinkedDealCallReportSummary extends CallPopulationSummary {
  totalDealCount: number
}

export interface ManagerCallsWorkloadRow {
  managerId: string
  managerName: string
  dealCount: number
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  otherOutgoingCalls: number
  connectedCalls: number
  failedCalls: number
  callsOverThirtySeconds: number
  connectedCallsOverThirtySeconds: number
  averageCallsPerDeal: number
  averageDurationSeconds: number
  allCalls?: CallPopulationSummary
  linkedDealCalls?: LinkedDealCallPopulationSummary
  stageBreakdown: StageCallMetric[]
}

export interface CallsWorkloadReportSnapshot {
  range: ReportRange
  totalDealCount: number
  totalCalls: number
  totalIncomingCalls: number
  totalOutgoingCalls: number
  totalOtherOutgoingCalls: number
  totalConnectedCalls: number
  totalFailedCalls: number
  totalCallsOverThirtySeconds: number
  totalConnectedCallsOverThirtySeconds: number
  allCalls?: CallPopulationSummary
  linkedDealCalls?: LinkedDealCallReportSummary
  warnings: string[]
  managerRows: ManagerCallsWorkloadRow[]
}

export interface CallsWorkloadReport extends CallsWorkloadReportSnapshot {
  comparisons?: Array<ReportComparison<CallsWorkloadReportSnapshot>>
}

export interface AcquisitionOutcomeQualityBucket {
  qualityKey: string
  qualityLabel: string
  count: number
}

export interface AcquisitionOutcomeSourceBucket {
  sourceKey: string
  sourceLabel: string
  totalNewDeals: number
  qualities: AcquisitionOutcomeQualityBucket[]
}

export interface AcquisitionOutcomeNewDealsByManagerRow {
  managerId: string
  managerName: string
  totalNewDeals: number
  sources: AcquisitionOutcomeSourceBucket[]
}

export interface AcquisitionOutcomeStageBucket {
  stageId: string
  stageName: string
  count: number
}

export interface AcquisitionOutcomeLostDealsByManagerRow {
  managerId: string
  managerName: string
  totalLostDeals: number
  stages: AcquisitionOutcomeStageBucket[]
}

export interface AcquisitionOutcomeReasonRow {
  stageId: string
  stageName: string
  managerId: string
  managerName: string
  reasonKey: string
  reasonLabel: string
  count: number
}

export interface AcquisitionOutcomeBusinessClubBucket {
  businessClubKey: string
  businessClubLabel: string
  count: number
}

export interface AcquisitionOutcomeTargetGroupBucket {
  targetGroupKey: string
  targetGroupLabel: string
  count: number
}

export interface AcquisitionOutcomeBusinessClubByManagerRow {
  managerId: string
  managerName: string
  totalDeals: number
  businessClubs: AcquisitionOutcomeBusinessClubBucket[]
  targetGroups: AcquisitionOutcomeTargetGroupBucket[]
}

export interface LostDealDetailRow {
  dealId: string
  managerId: string
  managerName: string
  sourceKey: string
  sourceLabel: string
  businessClubValue: string | null
  stageId: string
  stageName: string
  reasonKey: string
  reasonLabel: string
  reasonDetail: string | null
}

export interface AcquisitionOutcomesReportSnapshot {
  range: ReportRange
  totalNewDeals: number
  totalLostDeals: number
  newDealsByManager: AcquisitionOutcomeNewDealsByManagerRow[]
  lostDealsByManager: AcquisitionOutcomeLostDealsByManagerRow[]
  lostStages: AcquisitionOutcomeStageBucket[]
  businessClubByManager: AcquisitionOutcomeBusinessClubByManagerRow[]
  topLossReasons: AcquisitionOutcomeReasonRow[]
  lostDealDetails: LostDealDetailRow[]
}

export interface AcquisitionOutcomesReport
  extends AcquisitionOutcomesReportSnapshot {
  comparisons?: Array<ReportComparison<AcquisitionOutcomesReportSnapshot>>
}

export interface TargetGroupConversionRow {
  targetGroupKey: string
  targetGroupLabel: string
  createdDeals: number
  wonDeals: number
  winRate: number
  salesAmount: number
  averageSaleAmount: number
  averageCycleDays: number
}

export interface TargetGroupConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalWonDeals: number
  rows: TargetGroupConversionRow[]
}

export interface TargetGroupConversionReport
  extends TargetGroupConversionReportSnapshot {
  comparisons?: Array<ReportComparison<TargetGroupConversionReportSnapshot>>
}

export interface ManagerActionOutcomeRow {
  managerId: string
  managerName: string
  createdTasks: number
  closedTasks: number
  totalCalls: number
  successfulCallsOverThirtySeconds: number
  meetingsCount: number
  sla1OnTimeCount: number
  sla1LateCount: number
  sla1NoTouchCount: number
  sla1MedianHours: number
  sla2OnTimeCount: number
  sla2LateCount: number
  sla2NoTouchCount: number
  sla2MedianHours: number
  sla3OnTimeCount: number
  sla3LateCount: number
  sla3NoTouchCount: number
  sla3MedianHours: number
  newDealsCount: number
  wonDealsCount: number
  winRate: number
  salesAmount: number
  averageSaleAmount: number
  averageCycleDays: number
}

export type ManagerActionOutcomeStatus = 'won' | 'lost' | 'wip'

export interface ManagerActionOutcomeCohortOption {
  cohortMonth: string
  cohortLabel: string
  totalCreatedDeals: number
}

export type ManagerActionOutcomeDealSlaStatus = 'onTime' | 'late' | 'noTouch'

export interface ManagerActionOutcomeDealSla {
  status: ManagerActionOutcomeDealSlaStatus
  hours: number | null
}

export interface ManagerActionOutcomeDealDetail {
  dealId: string
  stageId: string
  stageName: string
  amount: number
  dateCreate: string
  dateClosed: string | null
  dateModify: string
  sourceKey?: string
  sourceLabel?: string
  qualityValue?: string | null
  businessClubValue?: string | null
  targetGroupValue?: string | null
  meetingTypeValue?: string | null
  meetingDateValue?: string | null
  tariffValue?: string | null
  taskSummary: DealTaskSummary
  callSummary: DealCallSummary
  meetingSummary: DealMeetingSummary
  sla: {
    sla1: ManagerActionOutcomeDealSla
    sla2: ManagerActionOutcomeDealSla
    sla3: ManagerActionOutcomeDealSla
  }
  stageTimeline: DealStageTimelineEntry[]
}

export interface ManagerActionOutcomeStatusRow {
  managerId: string
  managerName: string
  cohortMonth: string | null
  statusKey: ManagerActionOutcomeStatus
  statusLabel: string
  cohortCreatedDeals: number
  dealCount: number
  statusShare: number
  createdTasksPerDeal: number
  closedTasksPerDeal: number
  totalCallsPerDeal: number
  successfulCallsOverThirtySecondsPerDeal: number
  meetingsPerDeal: number
  sla1OnTimeRate: number
  sla2OnTimeRate: number
  sla3OnTimeRate: number
  financialAmount: number
  averageFinancialAmount: number
  dealDetails: ManagerActionOutcomeDealDetail[]
}

export interface ManagerActionOutcomeReportSnapshot {
  range: ReportRange
  warnings: string[]
  rows: ManagerActionOutcomeRow[]
  cohortMonths: ManagerActionOutcomeCohortOption[]
  cohortStatusRows: ManagerActionOutcomeStatusRow[]
}

export interface ManagerActionOutcomeReport
  extends ManagerActionOutcomeReportSnapshot {
  comparisons?: Array<ReportComparison<ManagerActionOutcomeReportSnapshot>>
}

export type CohortRelativeBucketKey =
  | 'month_1'
  | 'month_2'
  | 'month_3'
  | 'month_4_plus'

export interface CohortClosureBucket {
  closedMonth: string
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
}

export interface CohortRelativeClosureBucket {
  bucketKey: CohortRelativeBucketKey
  label: string
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
}

export interface CohortConversionRow {
  createdMonth: string
  createdDeals: number
  closedDeals: number
  wonDeals: number
  closedRate: number
  wonConversionRate: number
  averageDaysToClose: number
  averageDaysToWin: number
  closureBuckets: CohortClosureBucket[]
  relativeClosureBuckets: CohortRelativeClosureBucket[]
}

export interface CohortConversionReportSnapshot {
  range: ReportRange
  totalCreatedDeals: number
  totalClosedDeals: number
  totalWonDeals: number
  closureMonths: string[]
  relativeBucketKeys: CohortRelativeBucketKey[]
  rows: CohortConversionRow[]
}

export interface CohortConversionReport extends CohortConversionReportSnapshot {
  comparisons?: Array<ReportComparison<CohortConversionReportSnapshot>>
}

export interface TocFlowStageMetric {
  stageId: string
  stageName: string
  stageSemanticId: string | null
  sortOrder: number
  enteredDeals: number
  movedNextDeals: number
  throughputPerDay: number
  queueEnd: number
  queueBufferDays: number | null
  averageStageDurationDays: number
}

export interface TocFlowBottleneck {
  stageId: string
  stageName: string
  throughputPerDay: number
  queueEnd: number
  queueBufferDays: number | null
}

export interface TocFlowReportSnapshot {
  range: ReportRange
  businessDays: number
  warnings: string[]
  estimatedGainPerDay: number | null
  rows: TocFlowStageMetric[]
  bottleneck: TocFlowBottleneck | null
}

export interface TocFlowReport extends TocFlowReportSnapshot {
  comparisons?: Array<ReportComparison<TocFlowReportSnapshot>>
}

export interface ManagerDirectoryEntry {
  id: string
  name: string
}

export interface SourceCatalogEntry {
  key: string
  label: string
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

export type SyncHealthStatus = 'ready' | 'warning' | 'blocked'
export type SyncHealthIssueSeverity = 'warning' | 'blocking'

export interface SyncHealthIssue {
  code:
    | 'NO_SUCCESSFUL_SYNC'
    | 'STALE_SUCCESSFUL_SYNC'
    | 'STALE_RUNNING_SYNC'
    | 'MISSING_COVERAGE'
  severity: SyncHealthIssueSeverity
  message: string
}

export interface SyncHealth {
  status: SyncHealthStatus
  blocking: boolean
  checkedAt: string
  lastSuccessfulSync: string | null
  issues: SyncHealthIssue[]
  warnings: string[]
}

export interface MetaResponse {
  stageCatalog: StageCatalogEntry[]
  managerCatalog: ManagerDirectoryEntry[]
  sourceCatalog: SourceCatalogEntry[]
  wonStageIds: string[]
  defaultPeriodDays: number
  lastSync: LastSyncSummary | null
  syncHealth: SyncHealth
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
