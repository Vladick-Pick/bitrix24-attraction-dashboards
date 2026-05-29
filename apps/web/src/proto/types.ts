import type { ComponentType } from 'react'
import type {
  AcquisitionOutcomesReport,
  ActivitiesWorkloadReport,
  AttractionOntologyResponse,
  CallsWorkloadReport,
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  ConversionEventsReport,
  DashboardData,
  DealPricingRuleInput,
  DealPricingSettings,
  ManagerActionOutcomeReport,
  RevenueVelocityReport,
  SalesPlanData,
  SalesPlanQuarterData,
  SalesPlanQuarterDraftRow,
  TargetGroupConversionReport,
} from '@/lib/dashboard-types'

export interface ProtoComment {
  id: string
  moduleId?: string
  authorUserId?: number | null
  authorLogin?: string | null
  sceneId: string
  x: number
  y: number
  text: string
  status?: 'open' | 'archived'
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
  anchor?: ProtoCommentAnchor
  context?: ProtoCommentContext
  paperclipIssueId?: string | null
  paperclipIssueIdentifier?: string | null
  paperclipStatus?: PaperclipCommentStatus
  paperclipSyncStatus?: PaperclipSyncStatus
  paperclipError?: string | null
  paperclipLastSyncedAt?: string | null
  paperclipRetryCount?: number
  paperclipReadyReport?: PaperclipReadyReport | null
  paperclipThread?: PaperclipThreadEntry[]
}

export interface ProtoCommentAnchor {
  blockId: string
  blockLabel: string
  blockSelector: string
  blockRole: string | null
  elementSelector: string
  elementLabel: string
  relativeX: number
  relativeY: number
}

export type PaperclipCommentStatus =
  | 'queued'
  | 'sent'
  | 'in_work'
  | 'needs_input'
  | 'done'
  | 'failed'

export type PaperclipSyncStatus = 'queued' | 'syncing' | 'sent' | 'failed'

export interface PaperclipReadyReport {
  id: string
  body: string
  authorAgentId?: string | null
  authorUserId?: string | null
  createdAt: string
  updatedAt: string
}

export type PaperclipThreadEntryKind =
  | 'development_report'
  | 'dashboard_rework'
  | 'board_note'
  | 'system_note'

export interface PaperclipThreadEntry extends PaperclipReadyReport {
  kind: PaperclipThreadEntryKind
}

export interface ProtoCommentContext {
  filters?: unknown
  [key: string]: unknown
}

export type ModuleRole = 'leader' | 'employee'

export type ModulePermission =
  | 'comments:create'
  | 'comments:update'
  | 'comments:archive'
  | 'module-users:manage'

export interface AuthModule {
  id: string
  slug: string
  name: string
  role: ModuleRole
  permissions: ModulePermission[]
  bitrixCategoryId?: string | null
  paperclipCompanyId?: string | null
  paperclipProjectId?: string | null
  paperclipGoalId?: string | null
  paperclipTriageAgentId?: string | null
}

export interface AuthUser {
  id: number
  login: string
  firstName: string | null
  lastName: string | null
  role: 'admin'
  isSuperAdmin?: boolean
  modules: AuthModule[]
}

export interface PlatformModule {
  id: string
  slug: string
  name: string
  bitrixCategoryId?: string | null
  paperclipCompanyId?: string | null
  paperclipProjectId?: string | null
  paperclipGoalId?: string | null
  paperclipTriageAgentId?: string | null
}

export interface PlatformUser {
  id: number
  login: string
  firstName: string | null
  lastName: string | null
  disabled: boolean
  isSuperAdmin: boolean
  memberships: ModuleUser[]
}

export interface PlatformAccess {
  modules: PlatformModule[]
  users: PlatformUser[]
}

export interface PlatformMembershipInput {
  moduleId: string
  role: ModuleRole
  status: 'active' | 'disabled'
}

export interface CommentNotification {
  id: string
  sceneId: string
  text: string
  status: PaperclipCommentStatus
  paperclipSyncStatus: PaperclipSyncStatus
  paperclipIssueIdentifier: string | null
  paperclipError: string | null
  paperclipReadyReport?: PaperclipReadyReport | null
  paperclipThread?: PaperclipThreadEntry[]
  updatedAt: string
}

export interface ModuleUser {
  id: number
  login: string
  firstName: string | null
  lastName: string | null
  disabled: boolean
  moduleId: string
  moduleRole: ModuleRole
  membershipStatus: 'active' | 'disabled'
  createdAt: string
  updatedAt: string
}

export interface CompareRange {
  id: string
  start: string
  end: string
}

export interface ProtoFilterState {
  rangeStart: string
  rangeEnd: string
  compareRanges: CompareRange[]
  managers: string[]
  sources: string[]
}

export interface ProtoKpi {
  label: string
  value: string
  note: string
  compare?: string
  delta?: string
  deltaTone?: 'positive' | 'negative' | 'neutral'
}

export interface ActivitySummaryRow {
  manager: string
  sortValues?: number[]
  createdTasks: string
  outgoing: string
  successfulCalls: string
  otherOutgoing: string
  missedIncoming: string
  incoming: string
  noAnswer: string
  closedTasks: string
  deltas?: string[]
  comparePoints?: Array<{
    label: string
    values: string[]
    deltas: string[]
  }>
}

export interface ActivityMatrixStageRow {
  label: string
  totalCalls: string
  callsPerDeal: string
  totalClosedTasks: string
  closedTasksAvg: string
  level: number
  callsDelta?: string
  closedTasksDelta?: string
}

export interface ActivityMatrixRow {
  manager: string
  stages: ActivityMatrixStageRow[]
  totalCalls: string
  avgCalls: string
  totalClosedTasks: string
  avgClosedTasks: string
  avgCallsDelta?: string
  avgClosedTasksDelta?: string
}

export interface ActivitiesCallsSceneData {
  kpis: ProtoKpi[]
  warnings: string[]
  managerCount: number
  stageCount: number
  summaryRows: ActivitySummaryRow[]
  matrixRows: ActivityMatrixRow[]
}

export interface HeatCell {
  value: string
  subvalue?: string
  level: number
}

export interface CohortMatrixRow {
  month: string
  createdDeals: string
  cells: HeatCell[]
  conversion: string
  cycle: string
}

export interface CohortDistributionBucket {
  label: string
  value: string
  compare?: string
  delta?: string
  width: number
}

export interface CohortDistributionRow {
  manager: string
  month1: string
  month2: string
  month3: string
  tail: string
  width?: number
}

export interface CohortSceneData {
  range?: {
    from: string
    to: string
  }
  kpis: ProtoKpi[]
  matrixRows: CohortMatrixRow[]
  distributionBuckets: CohortDistributionBucket[]
  managerDistribution: CohortDistributionRow[]
  sourceDistribution: CohortDistributionRow[]
}

export interface FlowStageMetric {
  stage: string
  entered: number
  throughputPerDay: number
  queueEnd: number
  avgCycleDays: number
  note: string
}

export interface TocFlowFocus {
  bottleneckStage: string
  compareBottleneckStage: string
  maxQueueStage: string
  throughputDropStage: string
}

export interface TocManagerStageConversion {
  stage: string
  conversion: string
  volume: string
  level: number
}

export interface TocManagerConversionRow {
  manager: string
  averageConversion: string
  stages: TocManagerStageConversion[]
}

export interface TocStableLeaderRow {
  stage: string
  manager: string
  conversion: string
  volume: string
  compareConversion: string
  compareVolume: string
  stabilityLabel: string
  stabilityTone: 'positive' | 'negative' | 'neutral'
}

export interface TocStageDistributionNode {
  stageId: string
  stage: string
  sortOrder: number
  count: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionEdge {
  id: string
  fromStageId: string | null
  fromStage: string
  toStageId: string
  toStage: string
  count: number
  conversionRate: number
}

export interface TocStageDistributionRouteNode {
  id: string
  step: number
  stageId: string
  stage: string
  sortOrder: number
  count: number
  shareOfCreatedDeals: number
}

export interface TocStageDistributionRouteEdge {
  id: string
  fromStep: number
  fromStageId: string
  fromStage: string
  toStep: number
  toStageId: string
  toStage: string
  count: number
  conversionRate: number
}

export interface TocStageDistribution {
  totalCreatedDeals: number
  nodes: TocStageDistributionNode[]
  edges: TocStageDistributionEdge[]
  routeNodes?: TocStageDistributionRouteNode[]
  routeEdges?: TocStageDistributionRouteEdge[]
}

export interface TocFlowSceneData {
  kpis: ProtoKpi[]
  warnings: string[]
  currentStages: FlowStageMetric[]
  compareStages: FlowStageMetric[]
  managerConversionRows: TocManagerConversionRow[]
  stableLeaders: TocStableLeaderRow[]
  stageDistribution: TocStageDistribution
  focus: TocFlowFocus
}

export interface PickerOption {
  id: string
  label: string
  meta: string
}

export interface SceneComponentProps {
  commentMode: boolean
  filters: ProtoFilterState
  runtimeData?: ProtoRuntimeData
  salesPlanQuarter?: { year: number; quarter: number }
  salesPlanLoading?: boolean
  salesPlanSaving?: boolean
  salesPlanSaveError?: string | null
  onSalesPlanQuarterChange?: (quarter: { year: number; quarter: number }) => void
  onSalesPlanSave?: (rows: SalesPlanQuarterDraftRow[]) => Promise<void>
  pricingSettings?: DealPricingSettings | undefined
  conversionEventTypeSettings?: ConversionEventTypeSettingsData | undefined
  pricingSettingsLoading?: boolean
  pricingSettingsSaving?: boolean
  pricingSettingsSaveError?: string | null | undefined
  onPricingSettingsSave?: (rows: DealPricingRuleInput[]) => Promise<void>
  conversionEventTypeSettingsLoading?: boolean
  conversionEventTypeSettingsSaving?: boolean
  conversionEventTypeSettingsSaveError?: string | null | undefined
  onConversionEventTypeSettingsSave?: (
    input: ConversionEventTypeSettingsInput,
  ) => Promise<void>
  onSceneNavigate?: (sceneId: string, blockId?: string) => void
}

export interface ProtoScene {
  id: string
  label: string
  description: string
  focus: string
  kpis: ProtoKpi[]
  component: ComponentType<SceneComponentProps>
}

export interface CommentStore {
  comments: ProtoComment[]
  updatedAt: string | null
}

export interface ProtoRuntimeData {
  managerOptions: PickerOption[]
  sourceOptions: PickerOption[]
  salesDashboard?: DashboardData
  salesPlan?: SalesPlanData
  salesPlanMonth?: SalesPlanData
  salesPlanMonthDashboard?: DashboardData
  salesPlanQuarter?: SalesPlanQuarterData
  salesPlanQuarterDashboard?: DashboardData
  pricingSettings?: DealPricingSettings
  conversionEventTypeSettings?: ConversionEventTypeSettingsData
  activitiesWorkload?: ActivitiesWorkloadReport
  callsWorkload?: CallsWorkloadReport
  activitiesCalls?: ActivitiesCallsSceneData
  activitySummaryCommentBlockId?: string
  activitySummaryCommentBlockLabel?: string
  acquisitionOutcomes?: AcquisitionOutcomesReport
  targetGroupConversion?: TargetGroupConversionReport
  managerActionOutcomes?: ManagerActionOutcomeReport
  conversionEvents?: ConversionEventsReport
  revenueVelocity?: RevenueVelocityReport
  attractionOntology?: AttractionOntologyResponse
  cohorts?: CohortSceneData
  tocFlow?: TocFlowSceneData
  operationalStatus: 'idle' | 'loading' | 'ready' | 'error'
  operationalError: string | null
}
