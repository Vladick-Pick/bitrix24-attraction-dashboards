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
  attractionRevenueAmount: number
  averageAttractionRevenueAmount: number
  membershipAmount: number
  averageMembershipAmount: number
  pricingWarnings: string[]
  newDealsCount: number
  conversionRate: number
  meetingsCount?: number
}

export type DealPricingStatus =
  | 'priced'
  | 'missingContractFields'
  | 'missingPricingRule'
  | 'conflict'

export interface DealPricingRule {
  id: string
  customerLabel: string
  tariffLabel: string
  attractionRevenueAmount: number
  enabled: boolean
  sortOrder: number
  updatedAt: string | null
}

export interface DealPricingRuleInput {
  id: string
  customerLabel: string
  tariffLabel: string
  attractionRevenueAmount: number
  enabled: boolean
  sortOrder?: number | null
}

export interface DealPricingSettings {
  rules: DealPricingRule[]
  updatedAt: string | null
}

export interface DealPricingSettingsInput {
  rules: DealPricingRuleInput[]
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
  attractionRevenueAmount: number | null
  membershipAmount: number
  pricingStatus: DealPricingStatus
  pricingWarnings: string[]
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
  totalAttractionRevenueAmount: number
  averageAttractionRevenueAmount: number
  totalMembershipAmount: number
  averageMembershipAmount: number
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

export interface SalesPlanRow {
  periodStart: string
  periodEnd: string
  managerId: string
  managerName: string | null
  targetGroupKey: string
  targetGroupLabel: string
  plannedDeals: number
  plannedAmount: number
  updatedAt: string
}

export interface SalesPlanDraftRow {
  managerId: string
  managerName?: string | null | undefined
  targetGroupKey: string
  targetGroupLabel?: string | null | undefined
  plannedDeals: number
  plannedAmount: number
}

export interface SalesPlanData {
  periodStart: string
  periodEnd: string
  rows: SalesPlanRow[]
  updatedAt: string | null
}

export interface SalesPlanInput {
  periodStart: string
  periodEnd: string
  rows: SalesPlanDraftRow[]
}

export interface SalesPlanQuarterMonth {
  month: string
  label: string
  periodStart: string
  periodEnd: string
}

export interface SalesPlanQuarterRowMonth {
  month: string
  periodStart: string
  periodEnd: string
  plannedDeals: number
  plannedAmount: number
  updatedAt: string | null
}

export interface SalesPlanQuarterRow {
  managerId: string
  managerName: string | null
  targetGroupKey: string
  targetGroupLabel: string
  quarterPlannedDeals: number
  quarterPlannedAmount: number
  months: SalesPlanQuarterRowMonth[]
  updatedAt: string | null
}

export interface SalesPlanQuarterData {
  year: number
  quarter: number
  periodStart: string
  periodEnd: string
  months: SalesPlanQuarterMonth[]
  rows: SalesPlanQuarterRow[]
  updatedAt: string | null
}

export interface SalesPlanQuarterDraftMonth {
  month: string
  plannedDeals: number
  plannedAmount: number
}

export interface SalesPlanQuarterDraftRow {
  managerId: string
  managerName?: string | null | undefined
  targetGroupKey: string
  targetGroupLabel?: string | null | undefined
  quarterPlannedDeals: number
  quarterPlannedAmount: number
  months: SalesPlanQuarterDraftMonth[]
}

export interface SalesPlanQuarterInput {
  year: number
  quarter: number
  rows: SalesPlanQuarterDraftRow[]
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

export interface MeetingBusinessClubBucket {
  businessClubKey: string
  businessClubLabel: string
  meetingTypeKey: string
  meetingTypeLabel: string
  count: number
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
  meetingBusinessClubBreakdown?: MeetingBusinessClubBucket[]
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
  missedIncomingCalls?: number
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
  missedIncomingCalls?: number
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
  missedIncomingCalls?: number
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
  totalMissedIncomingCalls?: number
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

export interface ConversionEventBreakdownRow {
  key: string
  label: string
  count: number
}

export interface ConversionEventRow {
  eventKey: string
  eventName: string
  eventDate: string
  invitedCount: number
  attendedCount: number
  refusedCount: number
  missedCount: number
  attendanceRate: number | null
  nextStepEligibleCount: number
  nextStepCount: number
  nextStepRate: number | null
  unlinkedCount: number
  unknownStatusCount: number
  managerBreakdown: ConversionEventBreakdownRow[]
  sourceBreakdown: ConversionEventBreakdownRow[]
  businessClubBreakdown: ConversionEventBreakdownRow[]
}

export interface ConversionEventsReportSnapshot {
  range: ReportRange
  totalInvitedCount: number
  totalAttendedCount: number
  totalRefusedCount: number
  totalMissedCount: number
  attendanceRate: number | null
  nextStepEligibleCount: number
  nextStepCount: number
  nextStepRate: number | null
  warnings: string[]
  rows: ConversionEventRow[]
}

export interface ConversionEventsReport extends ConversionEventsReportSnapshot {
  comparisons?: Array<ReportComparison<ConversionEventsReportSnapshot>>
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

export interface TocStageDistributionNode {
  stageId: string
  stageName: string
  sortOrder: number
  dealCount: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionEdge {
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string
  toStageName: string
  dealCount: number
  conversionRate: number
}

export interface TocStageDistributionRouteNode {
  step: number
  stageId: string
  stageName: string
  sortOrder: number
  dealCount: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionRouteEdge {
  fromStep: number
  fromStageId: string
  fromStageName: string
  toStep: number
  toStageId: string
  toStageName: string
  dealCount: number
  conversionRate: number
}

export interface TocStageDistribution {
  totalCreatedDeals: number
  nodes: TocStageDistributionNode[]
  edges: TocStageDistributionEdge[]
  routeNodes?: TocStageDistributionRouteNode[]
  routeEdges?: TocStageDistributionRouteEdge[]
}

export interface TocFlowReportSnapshot {
  range: ReportRange
  businessDays: number
  warnings: string[]
  estimatedGainPerDay: number | null
  rows: TocFlowStageMetric[]
  bottleneck: TocFlowBottleneck | null
  stageDistribution?: TocStageDistribution | null
}

export interface TocFlowReport extends TocFlowReportSnapshot {
  comparisons?: Array<ReportComparison<TocFlowReportSnapshot>>
}

export type RevenueVelocityDimension =
  | 'manager'
  | 'source'
  | 'customer'
  | 'managerSource'
  | 'sourceCustomer'
  | 'managerCustomer'

export type RevenueVelocityView =
  | 'systemState'
  | 'operationalPeriod'
  | 'createdCohort'

export interface RevenueVelocityActionWeights {
  connectedCallOverThirtySeconds: number
  meeting: number
  conversionEvent: number
  closedTask: number
}

export interface RevenueVelocityActionSummary {
  totalCalls: number
  connectedCallsOverThirtySeconds: number
  meetingsCount: number
  conversionEventsCount: number
  createdTasks: number
  closedTasks: number
  weightedActionPoints: number
  weightedActionPointsPerDeal: number | null
  weightedActionPointsPerWin: number | null
}

export interface RevenueVelocityMoneyPerAction {
  moneyPerMeeting: number | null
  moneyPerConnectedCallOverThirtySeconds: number | null
  moneyPerConversionEvent: number | null
  moneyPerClosedTask: number | null
  moneyPerWeightedActionPoint: number | null
  actionEfficiencyIndex: number | null
}

export type RevenueVelocityFormulaSource =
  | 'selectedCohort'
  | 'rollingQuarterCohort'

export interface RevenueVelocityFormulaBreakdown {
  source: RevenueVelocityFormulaSource
  sourceLabel: string
  averageRevenueAmount: number | null
  opportunitiesCount: number
  conversionRate: number | null
  averageCycleDays: number | null
  value: number | null
  benchmarkFrom: string | null
  benchmarkTo: string | null
  missingReason: string | null
}

export interface RevenueVelocityRow {
  dimension: RevenueVelocityDimension
  view: RevenueVelocityView
  key: string
  label: string
  managerId?: string | null
  managerName?: string | null
  sourceKey?: string | null
  sourceLabel?: string | null
  customerKey?: string | null
  customerLabel?: string | null
  createdDeals: number
  activeDeals: number
  wonDeals: number
  lostDeals: number
  wipDeals: number
  salesAmount: number
  averageCheck: number | null
  winRate: number | null
  averageCycleDays: number | null
  medianCycleDays: number | null
  revenueVelocityPerDay: number | null
  revenueVelocityFormula?: RevenueVelocityFormulaBreakdown | null
  activePipelineAmount: number
  expectedPipelineAmount: number | null
  previousExpectedPipelineAmount: number | null
  expectedPipelineDelta: number | null
  liveRevenueVelocity: number | null
  previousLiveRevenueVelocity: number | null
  velocityDelta: number | null
  velocityDeltaPercent: number | null
  averageRemainingDays: number | null
  realizedWonAmountInPeriod: number
  wonDealsInPeriod: number
  lostDealsInPeriod: number
  systemValueCreated: number | null
  actionPointsDelta: number | null
  systemValuePerActionPoint: number | null
  realizedMoneyPerActionPoint: number | null
  historicalMoneyPerActionPoint: number | null
  estimatedFutureMoneyFromPeriodActions: number | null
  actions: RevenueVelocityActionSummary
  moneyPerAction: RevenueVelocityMoneyPerAction
  bottleneckStageId: string | null
  bottleneckStageName: string | null
  warnings: string[]
}

export interface RevenueVelocityFormulaTooltip {
  key: string
  label: string
  formula: string
  description: string
  emptyState?: string
}

export interface RevenueVelocityReportSnapshot {
  range: ReportRange
  asOf: string
  previousAsOf: string | null
  dimension: RevenueVelocityDimension
  view: RevenueVelocityView
  actionWeights: RevenueVelocityActionWeights
  totals: RevenueVelocityRow
  rows: RevenueVelocityRow[]
  formulaTooltips: RevenueVelocityFormulaTooltip[]
  warnings: string[]
}

export interface RevenueVelocityReport extends RevenueVelocityReportSnapshot {
  comparisons?: Array<ReportComparison<RevenueVelocityReportSnapshot>>
}

export type RevenueVelocityQuery = DashboardQuery & {
  dimension?: RevenueVelocityDimension
  view?: RevenueVelocityView
  asOf?: string
  customerKeys?: string[]
  qualityKeys?: string[]
  tariffKeys?: string[]
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
  dealBreakdown: SyncDealChangeBreakdown
}

export interface SnapshotStats {
  deals: number
  activities: number
  calls: number
  stageHistory: number
}

export interface SyncChangeSummary {
  deals: number
  dealBreakdown: SyncDealChangeBreakdown
  activities: number
  calls: number
  stageHistory: number
  managers: number
}

export interface SyncDealChangeBreakdown {
  total: number
  created: number
  updated: number
  closed: number
  reopened: number
  unchanged: number
}

export type SyncProgressPhase =
  | 'inspect_snapshot'
  | 'fetch_catalogs'
  | 'fetch_deals'
  | 'fetch_activities'
  | 'fetch_calls'
  | 'persist_snapshot'
  | 'complete'
  | 'failed'

export interface SyncProgressEvent {
  syncRunId: number | null
  phase: SyncProgressPhase
  progress: number
  message: string
  snapshotBefore?: SnapshotStats
  snapshotAfter?: SnapshotStats
  changes?: SyncChangeSummary
  mode?: 'full' | 'delta'
  modifiedAfter?: string | null
  startedAt?: string
  finishedAt?: string
  diagnostics?: string[]
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
  snapshotStats: SnapshotStats
  syncHealth: SyncHealth
}

export interface SyncSummary {
  syncRunId: number
  leadsSynced: number
  dealsSynced: number
  mode: 'full' | 'delta'
  modifiedAfter: string | null
  finishedAt: string
  snapshotBefore: SnapshotStats
  snapshotAfter: SnapshotStats
  changes: SyncChangeSummary
  diagnostics: string[]
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
