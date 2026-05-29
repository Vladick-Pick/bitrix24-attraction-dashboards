import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomesReportSnapshot,
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  AttractionOntologyResponse,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  ConversionEventsReport,
  ConversionEventsReportSnapshot,
  DashboardQuery,
  DashboardData,
  DashboardDataSnapshot,
  DealPricingSettings,
  DealPricingSettingsInput,
  LeadgenFunnelReport,
  ManagerActionOutcomeDealSlaStatus,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeReportSnapshot,
  MetaResponse,
  OntologyConcept,
  OntologyDriftItem,
  OntologyReportBinding,
  OntologySourceRef,
  OntologySourceDocumentResponse,
  OntologyStatus,
  OntologyTransition,
  ReportComparison,
  ReportRange,
  RevenueVelocityActionSummary,
  RevenueVelocityDimension,
  RevenueVelocityFormulaBreakdown,
  RevenueVelocityMoneyPerAction,
  RevenueVelocityQuery,
  RevenueVelocityReport,
  RevenueVelocityReportSnapshot,
  RevenueVelocityView,
  SalesPlanData,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
  SourceQualityConversionReport,
  SourceQualityConversionReportSnapshot,
  SnapshotStats,
  SyncChangeSummary,
  SyncProgressEvent,
  SyncSummary,
  TargetGroupConversionReport,
  TargetGroupConversionReportSnapshot,
  TocFlowReport,
  TocFlowReportSnapshot,
  TocStageDistribution,
} from '@/lib/dashboard-types'
import type {
  AuthModule,
  AuthUser,
  CommentNotification,
  CommentStore,
  ModulePermission,
  ModuleRole,
  ModuleUser,
  PaperclipCommentStatus,
  PaperclipSyncStatus,
  PaperclipThreadEntryKind,
  PlatformAccess,
  PlatformMembershipInput,
  PlatformModule,
  PlatformUser,
  ProtoComment,
  ProtoCommentAnchor,
  ProtoCommentContext,
} from '@/proto/types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

class ApiClientError extends Error {
  readonly status: number | undefined
  readonly payload: unknown

  constructor(message: string, status?: number, payload?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.payload = payload
  }
}

interface AuthResponse {
  user: AuthUser
  csrfToken: string
}

let csrfToken: string | null = null
const unauthorizedListeners = new Set<() => void>()

function buildUrl(
  pathname: string,
  params?: Record<string, string | number | string[] | undefined>,
) {
  const url = new URL(`${API_BASE_URL}${pathname}`, window.location.origin)

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) {
      continue
    }

    url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`
}

function buildModulePath(moduleId: string | undefined, legacyPath: string) {
  const normalizedModuleId = moduleId?.trim() || 'attraction'
  if (normalizedModuleId === 'attraction') {
    return legacyPath
  }

  return `/api/modules/${encodeURIComponent(normalizedModuleId)}${legacyPath.replace(
    /^\/api/,
    '',
  )}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function asArray<T>(value: unknown, mapper: (input: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapper) : []
}

function normalizeDealCallSummary(value: unknown) {
  const calls = isRecord(value) ? value : {}
  return {
    total: asNumber(calls.total),
    incoming: asNumber(calls.incoming),
    outgoing: asNumber(calls.outgoing),
    successful: asNumber(calls.successful),
    failed: asNumber(calls.failed),
    overThirtySeconds: asNumber(calls.overThirtySeconds),
    connectedOverThirtySeconds: asNumber(calls.connectedOverThirtySeconds),
  }
}

function normalizeDealTaskSummary(value: unknown) {
  const tasks = isRecord(value) ? value : {}
  return {
    created: asNumber(tasks.created),
    closed: asNumber(tasks.closed),
  }
}

function normalizeDealMeetingSummary(value: unknown) {
  const meetings = isRecord(value) ? value : {}
  return {
    total: asNumber(meetings.total),
  }
}

function normalizeDealMeetingEvents(value: unknown) {
  return asArray(value, (event) => {
    const eventRow = isRecord(event) ? event : {}
    return {
      activityId: asString(eventRow.activityId),
      createdAt: asString(eventRow.createdAt),
      timelineAt: asString(eventRow.timelineAt, asString(eventRow.createdAt)),
      scheduledAt: asString(eventRow.scheduledAt),
      completed: Boolean(eventRow.completed),
    }
  })
}

function normalizeDealStageTimeline(value: unknown) {
  return asArray(value, (stage) => {
    const stageRow = isRecord(stage) ? stage : {}
    return {
      stageId: asString(stageRow.stageId),
      stageName: asString(stageRow.stageName, asString(stageRow.stageId)),
      enteredAt: asString(stageRow.enteredAt),
      leftAt: asString(stageRow.leftAt),
      durationHours: asNumber(stageRow.durationHours),
      callSummary: normalizeDealCallSummary(stageRow.callSummary),
      taskSummary: normalizeDealTaskSummary(stageRow.taskSummary),
      meetingEvents: normalizeDealMeetingEvents(stageRow.meetingEvents),
    }
  })
}

function isMutatingMethod(method: string | undefined) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
    (method ?? 'GET').toUpperCase(),
  )
}

function normalizeAuthResponse(value: unknown): AuthResponse {
  const data = isRecord(value) ? value : {}
  const user = isRecord(data.user) ? data.user : {}

  return {
    user: {
      id: asNumber(user.id),
      login: asString(user.login),
      firstName: asNullableString(user.firstName),
      lastName: asNullableString(user.lastName),
      role: 'admin',
      isSuperAdmin: asBoolean(user.isSuperAdmin),
      modules: asArray(user.modules, normalizeAuthModule).filter(
        (module) => module.id && module.slug,
      ),
    },
    csrfToken: asString(data.csrfToken),
  }
}

function normalizeModuleRole(value: unknown): ModuleRole {
  return value === 'leader' ? 'leader' : 'employee'
}

function normalizeModulePermission(value: unknown): ModulePermission | null {
  return value === 'comments:create' ||
    value === 'comments:update' ||
    value === 'comments:archive' ||
    value === 'module-users:manage'
    ? value
    : null
}

function normalizeAuthModule(value: unknown): AuthModule {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    slug: asString(data.slug),
    name: asString(data.name),
    role: normalizeModuleRole(data.role),
    permissions: asArray(data.permissions, normalizeModulePermission).filter(
      (permission): permission is ModulePermission => Boolean(permission),
    ),
    bitrixCategoryId: asNullableString(data.bitrixCategoryId),
    paperclipCompanyId: asNullableString(data.paperclipCompanyId),
    paperclipProjectId: asNullableString(data.paperclipProjectId),
    paperclipGoalId: asNullableString(data.paperclipGoalId),
    paperclipTriageAgentId: asNullableString(data.paperclipTriageAgentId),
  }
}

function normalizePaperclipCommentStatus(value: unknown): PaperclipCommentStatus {
  return value === 'sent' ||
    value === 'in_work' ||
    value === 'needs_input' ||
    value === 'done' ||
    value === 'failed'
    ? value
    : 'queued'
}

function normalizePaperclipSyncStatus(value: unknown): PaperclipSyncStatus {
  return value === 'syncing' || value === 'sent' || value === 'failed'
    ? value
    : 'queued'
}

function normalizeProtoCommentContext(value: unknown): ProtoCommentContext | undefined {
  return isRecord(value) ? value : undefined
}

function normalizeProtoCommentAnchor(value: unknown): ProtoCommentAnchor | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const blockId = asString(value.blockId)
  const blockLabel = asString(value.blockLabel)
  const blockSelector = asString(value.blockSelector)
  const elementSelector = asString(value.elementSelector)

  if (!blockId || !blockLabel || !blockSelector || !elementSelector) {
    return undefined
  }

  return {
    blockId,
    blockLabel,
    blockSelector,
    blockRole: asNullableString(value.blockRole),
    elementSelector,
    elementLabel: asString(value.elementLabel),
    relativeX: asNumber(value.relativeX),
    relativeY: asNumber(value.relativeY),
  }
}

function normalizePaperclipReadyReport(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const body = asString(value.body)
  const createdAt = asString(value.createdAt)
  if (!id || !body || !createdAt) {
    return null
  }

  return {
    id,
    body,
    authorAgentId: asNullableString(value.authorAgentId),
    authorUserId: asNullableString(value.authorUserId),
    createdAt,
    updatedAt: asString(value.updatedAt) || createdAt,
  }
}

function normalizePaperclipThreadEntryKind(value: unknown): PaperclipThreadEntryKind {
  return value === 'dashboard_rework' ||
    value === 'board_note' ||
    value === 'system_note' ||
    value === 'development_report'
    ? value
    : 'system_note'
}

function normalizePaperclipThreadEntry(value: unknown) {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  const body = asString(value.body)
  const createdAt = asString(value.createdAt)
  if (!id || !body || !createdAt) {
    return null
  }

  return {
    id,
    kind: normalizePaperclipThreadEntryKind(value.kind),
    body,
    authorAgentId: asNullableString(value.authorAgentId),
    authorUserId: asNullableString(value.authorUserId),
    createdAt,
    updatedAt: asString(value.updatedAt) || createdAt,
  }
}

function normalizePaperclipThread(value: unknown) {
  return asArray(value, normalizePaperclipThreadEntry).filter((entry) => entry !== null)
}

function normalizeProtoComment(value: unknown): ProtoComment {
  const data = isRecord(value) ? value : {}
  const anchor = normalizeProtoCommentAnchor(data.anchor)

  const comment: ProtoComment = {
    id: asString(data.id),
    moduleId: asString(data.moduleId),
    authorUserId: asNullableNumber(data.authorUserId),
    authorLogin: asNullableString(data.authorLogin),
    sceneId: asString(data.sceneId),
    x: asNumber(data.x),
    y: asNumber(data.y),
    text: asString(data.text),
    status: data.status === 'archived' ? 'archived' : 'open',
    archivedAt: asNullableString(data.archivedAt),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
    paperclipIssueId: asNullableString(data.paperclipIssueId),
    paperclipIssueIdentifier: asNullableString(data.paperclipIssueIdentifier),
    paperclipStatus: normalizePaperclipCommentStatus(data.paperclipStatus),
    paperclipSyncStatus: normalizePaperclipSyncStatus(data.paperclipSyncStatus),
    paperclipError: asNullableString(data.paperclipError),
    paperclipLastSyncedAt: asNullableString(data.paperclipLastSyncedAt),
    paperclipRetryCount: asNumber(data.paperclipRetryCount),
    paperclipReadyReport: normalizePaperclipReadyReport(data.paperclipReadyReport),
    paperclipThread: normalizePaperclipThread(data.paperclipThread),
  }

  const context = normalizeProtoCommentContext(data.context)

  return {
    ...comment,
    ...(anchor ? { anchor } : {}),
    ...(context ? { context } : {}),
  }
}

function normalizeCommentStore(value: unknown): CommentStore {
  const data = isRecord(value) ? value : {}

  return {
    comments: asArray(data.comments, normalizeProtoComment).filter(
      (comment) => comment.id && comment.sceneId,
    ),
    updatedAt: asNullableString(data.updatedAt),
  }
}

function normalizeCommentResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    comment: normalizeProtoComment(data.comment),
  }
}

function normalizeCommentNotification(value: unknown): CommentNotification {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    sceneId: asString(data.sceneId),
    text: asString(data.text),
    status: normalizePaperclipCommentStatus(data.status),
    paperclipSyncStatus: normalizePaperclipSyncStatus(data.paperclipSyncStatus),
    paperclipIssueIdentifier: asNullableString(data.paperclipIssueIdentifier),
    paperclipError: asNullableString(data.paperclipError),
    paperclipReadyReport: normalizePaperclipReadyReport(data.paperclipReadyReport),
    paperclipThread: normalizePaperclipThread(data.paperclipThread),
    updatedAt: asString(data.updatedAt),
  }
}

function normalizeCommentNotificationsResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    notifications: asArray(data.notifications, normalizeCommentNotification).filter(
      (notification) => notification.id,
    ),
  }
}

function normalizeModuleUser(value: unknown): ModuleUser {
  const data = isRecord(value) ? value : {}
  return {
    id: asNumber(data.id),
    login: asString(data.login),
    firstName: asNullableString(data.firstName),
    lastName: asNullableString(data.lastName),
    disabled: asBoolean(data.disabled),
    moduleId: asString(data.moduleId),
    moduleRole: normalizeModuleRole(data.moduleRole),
    membershipStatus: data.membershipStatus === 'disabled' ? 'disabled' : 'active',
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
  }
}

function normalizeModuleUsersResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    users: asArray(data.users, normalizeModuleUser).filter((user) => user.id > 0),
  }
}

function normalizeModuleUserResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    user: normalizeModuleUser(data.user),
  }
}

function normalizePlatformModule(value: unknown): PlatformModule {
  const data = isRecord(value) ? value : {}
  return {
    id: asString(data.id),
    slug: asString(data.slug),
    name: asString(data.name),
    bitrixCategoryId: asNullableString(data.bitrixCategoryId),
    paperclipCompanyId: asNullableString(data.paperclipCompanyId),
    paperclipProjectId: asNullableString(data.paperclipProjectId),
    paperclipGoalId: asNullableString(data.paperclipGoalId),
    paperclipTriageAgentId: asNullableString(data.paperclipTriageAgentId),
  }
}

function normalizePlatformUser(value: unknown): PlatformUser {
  const data = isRecord(value) ? value : {}
  return {
    id: asNumber(data.id),
    login: asString(data.login),
    firstName: asNullableString(data.firstName),
    lastName: asNullableString(data.lastName),
    disabled: asBoolean(data.disabled),
    isSuperAdmin: asBoolean(data.isSuperAdmin),
    memberships: asArray(data.memberships, normalizeModuleUser).filter(
      (membership) => membership.id > 0 && membership.moduleId,
    ),
  }
}

function normalizePlatformAccessResponse(value: unknown): PlatformAccess {
  const data = isRecord(value) ? value : {}
  return {
    modules: asArray(data.modules, normalizePlatformModule).filter(
      (module) => module.id && module.slug,
    ),
    users: asArray(data.users, normalizePlatformUser).filter((user) => user.id > 0),
  }
}

function normalizePlatformUserResponse(value: unknown) {
  const data = isRecord(value) ? value : {}
  return {
    user: normalizePlatformUser(data.user),
  }
}

function setCsrfTokenFromResponse(response: AuthResponse) {
  csrfToken = response.csrfToken || null
  return response
}

function notifyUnauthorized() {
  csrfToken = null
  for (const listener of unauthorizedListeners) {
    listener()
  }
}

async function readErrorResponse(response: Response) {
  let message = 'Local API request failed'
  let payload: unknown = null

  try {
    payload = (await response.json()) as unknown
    if (isRecord(payload)) {
      message = asString(payload.code, asString(payload.error, message))
    }
  } catch {
    // Keep the stable fallback when the server did not return JSON.
  }

  return { message, payload }
}

function buildRequestInit(init: RequestInit) {
  const method = init.method ?? 'GET'
  const headers = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutatingMethod(method) && csrfToken
      ? { 'X-CSRF-Token': csrfToken }
      : {}),
    ...(init.headers ?? {}),
  }

  return {
    ...init,
    credentials: 'include' as const,
    headers,
  }
}

function normalizePricingStatus(value: unknown) {
  return value === 'missingContractFields' ||
    value === 'missingPricingRule' ||
    value === 'conflict'
    ? value
    : 'priced'
}

function normalizeRange(value: unknown): ReportRange {
  const data = isRecord(value) ? value : {}

  return {
    from: asString(data.from),
    to: asString(data.to),
  }
}

function normalizeComparisons<TSnapshot>(
  value: unknown,
  normalizeSnapshot: (input: unknown) => TSnapshot,
): Array<ReportComparison<TSnapshot>> {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => {
    const item = isRecord(entry) ? entry : {}

    return {
      compareIndex: asNumber(item.compareIndex),
      range: normalizeRange(item.range),
      snapshot: normalizeSnapshot(item.snapshot),
    }
  })
}

function normalizeDashboardSnapshot(value: unknown): DashboardDataSnapshot {
  const data = isRecord(value) ? value : {}
  const salesSummary = isRecord(data.salesSummary) ? data.salesSummary : {}

  return {
    salesSummary: {
      salesCount: asNumber(salesSummary.salesCount),
      salesAmount: asNumber(salesSummary.salesAmount),
      averageSaleAmount: asNumber(salesSummary.averageSaleAmount),
      attractionRevenueAmount: asNumber(
        salesSummary.attractionRevenueAmount,
        asNumber(salesSummary.salesAmount),
      ),
      averageAttractionRevenueAmount: asNumber(
        salesSummary.averageAttractionRevenueAmount,
        asNumber(salesSummary.averageSaleAmount),
      ),
      membershipAmount: asNumber(
        salesSummary.membershipAmount,
        asNumber(salesSummary.salesAmount),
      ),
      averageMembershipAmount: asNumber(
        salesSummary.averageMembershipAmount,
        asNumber(salesSummary.averageSaleAmount),
      ),
      pricingWarnings: asArray(salesSummary.pricingWarnings, (warning) =>
        asString(warning),
      ),
      newDealsCount: asNumber(salesSummary.newDealsCount),
      conversionRate: asNumber(salesSummary.conversionRate),
      meetingsCount: asNumber(salesSummary.meetingsCount),
    },
    managerGroups: asArray(data.managerGroups, (group) => {
      const item = isRecord(group) ? group : {}
      const totalWonDeals = asNumber(item.totalWonDeals)
      const totalSalesAmount = asNumber(item.totalSalesAmount)
      const totalAttractionRevenueAmount = asNumber(
        item.totalAttractionRevenueAmount,
        totalSalesAmount,
      )
      const totalMembershipAmount = asNumber(
        item.totalMembershipAmount,
        totalSalesAmount,
      )

      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalWonDeals,
        totalSalesAmount,
        totalAttractionRevenueAmount,
        averageAttractionRevenueAmount: asNumber(
          item.averageAttractionRevenueAmount,
          totalWonDeals === 0 ? 0 : totalAttractionRevenueAmount / totalWonDeals,
        ),
        totalMembershipAmount,
        averageMembershipAmount: asNumber(
          item.averageMembershipAmount,
          totalWonDeals === 0 ? 0 : totalMembershipAmount / totalWonDeals,
        ),
        deals: asArray(item.deals, (deal) => {
          const row = isRecord(deal) ? deal : {}
          const cohort = isRecord(row.cohortContext) ? row.cohortContext : {}
          return {
            dealId: asString(row.dealId),
            dealTitle: asString(row.dealTitle, asString(row.dealId)),
            managerId: asString(row.managerId, asString(item.managerId)),
            managerName: asString(
              row.managerName,
              asString(item.managerName, asString(item.managerId)),
            ),
            amount: asNumber(row.amount),
            attractionRevenueAmount: asNullableNumber(
              row.attractionRevenueAmount,
            ),
            membershipAmount: asNumber(row.membershipAmount, asNumber(row.amount)),
            pricingStatus: normalizePricingStatus(row.pricingStatus),
            pricingWarnings: asArray(row.pricingWarnings, (warning) =>
              asString(warning),
            ),
            dateCreate: asString(row.dateCreate),
            dateClosed: asString(row.dateClosed),
            cycleDays: asNumber(row.cycleDays),
            sourceKey: asString(row.sourceKey, asString(row.sourceId)),
            sourceLabel: asString(
              row.sourceLabel,
              asString(row.sourceKey, asString(row.sourceId)),
            ),
            qualityValue: asNullableString(row.qualityValue),
            businessClubValue: asNullableString(row.businessClubValue),
            targetGroupValue: asNullableString(row.targetGroupValue),
            meetingTypeValue: asNullableString(row.meetingTypeValue),
            meetingDateValue: asNullableString(row.meetingDateValue),
            tariffValue: asNullableString(row.tariffValue),
            cohortContext: {
              createdMonth: asString(cohort.createdMonth),
              cohortCreatedDeals: asNumber(cohort.cohortCreatedDeals),
              cohortWonDeals: asNumber(cohort.cohortWonDeals),
              cohortWonConversionRate: asNumber(cohort.cohortWonConversionRate),
            },
            callSummary: normalizeDealCallSummary(row.callSummary),
            taskSummary: normalizeDealTaskSummary(row.taskSummary),
            meetingSummary: normalizeDealMeetingSummary(row.meetingSummary),
            stageTimeline: normalizeDealStageTimeline(row.stageTimeline),
          }
        }),
      }
    }),
  }
}

function normalizeDashboard(value: unknown): DashboardData {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeDashboardSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeDashboardSnapshot),
  }
}

function normalizeSalesPlan(value: unknown): SalesPlanData {
  const data = isRecord(value) ? value : {}
  const periodStart = asString(data.periodStart)
  const periodEnd = asString(data.periodEnd)

  return {
    periodStart,
    periodEnd,
    updatedAt: asNullableString(data.updatedAt),
    rows: asArray(data.rows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      const targetGroupKey = asString(row.targetGroupKey)

      return {
        periodStart: asString(row.periodStart, periodStart),
        periodEnd: asString(row.periodEnd, periodEnd),
        managerId: asString(row.managerId),
        managerName: asNullableString(row.managerName),
        targetGroupKey,
        targetGroupLabel: asString(row.targetGroupLabel, targetGroupKey),
        plannedDeals: asNumber(row.plannedDeals),
        plannedAmount: asNumber(row.plannedAmount),
        updatedAt: asString(row.updatedAt, asString(data.updatedAt)),
      }
    }),
  }
}

function normalizeSalesPlanQuarter(value: unknown): SalesPlanQuarterData {
  const data = isRecord(value) ? value : {}
  const updatedAt = asNullableString(data.updatedAt)
  const months = asArray(data.months, (entry) => {
    const month = isRecord(entry) ? entry : {}
    return {
      month: asString(month.month),
      label: asString(month.label, asString(month.month)),
      periodStart: asString(month.periodStart),
      periodEnd: asString(month.periodEnd),
    }
  })

  return {
    year: asNumber(data.year),
    quarter: asNumber(data.quarter),
    periodStart: asString(data.periodStart),
    periodEnd: asString(data.periodEnd),
    months,
    rows: asArray(data.rows, (entry) => {
      const row = isRecord(entry) ? entry : {}
      const targetGroupKey = asString(row.targetGroupKey)
      const rowUpdatedAt = asNullableString(row.updatedAt)
      return {
        managerId: asString(row.managerId),
        managerName: asNullableString(row.managerName),
        targetGroupKey,
        targetGroupLabel: asString(row.targetGroupLabel, targetGroupKey),
        quarterPlannedDeals: asNumber(row.quarterPlannedDeals),
        quarterPlannedAmount: asNumber(row.quarterPlannedAmount),
        months: asArray(row.months, (monthEntry) => {
          const month = isRecord(monthEntry) ? monthEntry : {}
          return {
            month: asString(month.month),
            periodStart: asString(month.periodStart),
            periodEnd: asString(month.periodEnd),
            plannedDeals: asNumber(month.plannedDeals),
            plannedAmount: asNumber(month.plannedAmount),
            updatedAt: asNullableString(month.updatedAt),
          }
        }),
        updatedAt: rowUpdatedAt ?? updatedAt,
      }
    }),
    updatedAt,
  }
}

function normalizePricingSettings(value: unknown): DealPricingSettings {
  const data = isRecord(value) ? value : {}

  return {
    updatedAt: asNullableString(data.updatedAt),
    rules: asArray(data.rules, (entry) => {
      const rule = isRecord(entry) ? entry : {}

      return {
        id: asString(rule.id),
        customerLabel: asString(rule.customerLabel),
        tariffLabel: asString(rule.tariffLabel),
        attractionRevenueAmount: asNumber(rule.attractionRevenueAmount),
        enabled: rule.enabled !== false,
        sortOrder: asNumber(rule.sortOrder),
        updatedAt: asNullableString(rule.updatedAt),
      }
    }),
  }
}

function normalizeConversionEventTypeSettings(
  value: unknown,
): ConversionEventTypeSettingsData {
  const data = isRecord(value) ? value : {}

  return {
    options: asArray(data.options, (entry) => {
      const option = isRecord(entry) ? entry : {}

      return {
        id: asString(option.id),
        title: asString(option.title, asString(option.id)),
        categoryId: asNullableNumber(option.categoryId),
        stageId: asNullableString(option.stageId),
        selectedForPlannedInventory: option.selectedForPlannedInventory === true,
      }
    }),
    settings: asArray(data.settings, (entry) => {
      const setting = isRecord(entry) ? entry : {}

      return {
        moduleKey: asString(setting.moduleKey, 'attraction'),
        eventTypeId: asString(setting.eventTypeId),
        eventTypeLabel: asString(setting.eventTypeLabel, asString(setting.eventTypeId)),
        enabled: setting.enabled !== false,
        updatedAt: asString(setting.updatedAt),
      }
    }),
  }
}

function normalizeSyncHealth(value: unknown): MetaResponse['syncHealth'] {
  const data = isRecord(value) ? value : {}
  const issues: MetaResponse['syncHealth']['issues'] = asArray(data.issues, (entry) => {
    const issue = isRecord(entry) ? entry : {}
    const code = asString(issue.code)
    const normalizedCode: MetaResponse['syncHealth']['issues'][number]['code'] =
      code === 'NO_SUCCESSFUL_SYNC' ||
      code === 'STALE_SUCCESSFUL_SYNC' ||
      code === 'STALE_RUNNING_SYNC' ||
      code === 'MISSING_COVERAGE'
        ? code
        : 'MISSING_COVERAGE'

    return {
      code: normalizedCode,
      severity: issue.severity === 'warning' ? ('warning' as const) : ('blocking' as const),
      message: asString(issue.message, 'Нет подтвержденного покрытия локального snapshot.'),
    }
  })
  const blocking =
    typeof data.blocking === 'boolean'
      ? data.blocking
      : issues.some((issue) => issue.severity === 'blocking')
  const status =
    data.status === 'ready' || data.status === 'warning' || data.status === 'blocked'
      ? data.status
      : blocking
        ? 'blocked'
        : 'ready'

  return {
    status,
    blocking,
    checkedAt: asString(data.checkedAt),
    lastSuccessfulSync: asNullableString(data.lastSuccessfulSync),
    issues,
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSnapshotStats(value: unknown): SnapshotStats {
  const data = isRecord(value) ? value : {}

  return {
    deals: asNumber(data.deals),
    activities: asNumber(data.activities),
    calls: asNumber(data.calls),
    stageHistory: asNumber(data.stageHistory),
  }
}

function normalizeSyncChanges(value: unknown): SyncChangeSummary {
  const data = isRecord(value) ? value : {}
  const breakdown = isRecord(data.dealBreakdown) ? data.dealBreakdown : {}

  return {
    deals: asNumber(data.deals),
    dealBreakdown: {
      total: asNumber(breakdown.total, asNumber(data.deals)),
      created: asNumber(breakdown.created),
      updated: asNumber(breakdown.updated, asNumber(data.deals)),
      closed: asNumber(breakdown.closed),
      reopened: asNumber(breakdown.reopened),
      unchanged: asNumber(breakdown.unchanged),
    },
    activities: asNumber(data.activities),
    calls: asNumber(data.calls),
    stageHistory: asNumber(data.stageHistory),
    managers: asNumber(data.managers),
  }
}

function normalizeMeta(value: unknown): MetaResponse {
  const data = isRecord(value) ? value : {}
  const lastSync = isRecord(data.lastSync) ? data.lastSync : null

  return {
    stageCatalog: asArray(data.stageCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        entityType:
          item.entityType === 'lead' || item.entityType === 'source'
            ? item.entityType
            : 'deal',
        categoryId: asNullableString(item.categoryId),
        statusId: asString(item.statusId),
        name: asString(item.name, asString(item.statusId)),
        semanticId: asNullableString(item.semanticId),
      }
    }),
    wonStageIds: asArray(data.wonStageIds, (entry) => asString(entry)).filter(Boolean),
    managerCatalog: asArray(data.managerCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        id: asString(item.id),
        name: asString(item.name, asString(item.id)),
      }
    }),
    sourceCatalog: asArray(data.sourceCatalog, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        key: asString(item.key),
        label: asString(item.label, asString(item.key)),
      }
    }),
    defaultPeriodDays: asNumber(data.defaultPeriodDays, 30),
    lastSync: lastSync
        ? {
            finishedAt: asString(lastSync.finishedAt),
            leadsSynced: asNumber(lastSync.leadsSynced),
            dealsSynced: asNumber(lastSync.dealsSynced),
            mode: lastSync.mode === 'full' ? 'full' : 'delta',
            dealBreakdown: normalizeSyncChanges({
              deals: lastSync.dealsSynced,
              dealBreakdown: isRecord(lastSync.dealBreakdown)
                ? lastSync.dealBreakdown
                : undefined,
            }).dealBreakdown,
          }
        : null,
    snapshotStats: normalizeSnapshotStats(data.snapshotStats),
    syncHealth: normalizeSyncHealth(data.syncHealth),
  }
}

function normalizeOntologyStatus(value: unknown): OntologyStatus {
  return value === 'needs-sync' ||
    value === 'draft' ||
    value === 'deprecated' ||
    value === 'unclassified'
    ? value
    : 'confirmed'
}

function normalizeOntologySource(value: unknown): OntologySourceRef {
  const data = isRecord(value) ? value : {}
  const kind: OntologySourceRef['kind'] =
    data.kind === 'google-doc' ||
    data.kind === 'google-sheet' ||
    data.kind === 'markdown' ||
    data.kind === 'bitrix' ||
    data.kind === 'dashboard' ||
    data.kind === 'decision'
      ? data.kind
      : 'decision'
  const canonicality: OntologySourceRef['canonicality'] =
    data.canonicality === 'canonical' ||
    data.canonicality === 'supporting' ||
    data.canonicality === 'implementation' ||
    data.canonicality === 'decision'
      ? data.canonicality
      : 'supporting'

  return {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    kind,
    href: asString(data.href),
    canonicality,
  }
}

function normalizeOntologyConcept(value: unknown): OntologyConcept {
  const data = isRecord(value) ? value : {}
  const bitrix = isRecord(data.bitrix) ? data.bitrix : null
  const type: OntologyConcept['type'] =
    data.type === 'transition' ||
    data.type === 'outcome' ||
    data.type === 'delivery_quality' ||
    data.type === 'format' ||
    data.type === 'source'
      ? data.type
      : 'stage'

  const concept: OntologyConcept = {
    id: asString(data.id),
    type,
    label: asString(data.label, asString(data.id)),
    status: normalizeOntologyStatus(data.status),
    definition: asString(data.definition),
    not: asArray(data.not, (entry) => asString(entry)).filter(Boolean),
    sourceIds: asArray(data.sourceIds, (entry) => asString(entry)).filter(Boolean),
    reportBindingIds: asArray(data.reportBindingIds, (entry) =>
      asString(entry),
    ).filter(Boolean),
  }

  if (bitrix) {
    const normalizedBitrix: NonNullable<OntologyConcept['bitrix']> = {
      categoryId: asString(bitrix.categoryId),
    }
    const stageId = asString(bitrix.stageId)
    const fieldCode = asString(bitrix.fieldCode)
    const enumValue = asString(bitrix.enumValue)

    if (stageId) {
      normalizedBitrix.stageId = stageId
    }
    if (fieldCode) {
      normalizedBitrix.fieldCode = fieldCode
    }
    if (enumValue) {
      normalizedBitrix.enumValue = enumValue
    }

    concept.bitrix = normalizedBitrix
  }

  return concept
}

function normalizeOntologyTransition(value: unknown): OntologyTransition {
  const data = isRecord(value) ? value : {}

  const transition: OntologyTransition = {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    status: normalizeOntologyStatus(data.status),
    fromConceptId: asString(data.fromConceptId),
    toConceptId: asString(data.toConceptId),
    definition: asString(data.definition),
    sourceIds: asArray(data.sourceIds, (entry) => asString(entry)).filter(Boolean),
    reportBindingIds: asArray(data.reportBindingIds, (entry) =>
      asString(entry),
    ).filter(Boolean),
  }

  const trigger = asString(data.trigger)
  if (trigger) {
    transition.trigger = trigger
  }

  return transition
}

function normalizeOntologyReportBinding(value: unknown): OntologyReportBinding {
  const data = isRecord(value) ? value : {}

  return {
    id: asString(data.id),
    label: asString(data.label, asString(data.id)),
    sceneId: asString(data.sceneId),
    blockId: asString(data.blockId),
    href: asString(data.href),
  }
}

function normalizeOntologyDriftItem(value: unknown): OntologyDriftItem {
  const data = isRecord(value) ? value : {}
  const kind: OntologyDriftItem['kind'] =
    data.kind === 'source' ||
    data.kind === 'reason' ||
    data.kind === 'report_binding'
      ? data.kind
      : 'stage'
  const severity: OntologyDriftItem['severity'] =
    data.severity === 'blocking' || data.severity === 'warning'
      ? data.severity
      : 'info'

  return {
    kind,
    severity,
    label: asString(data.label),
    message: asString(data.message),
  }
}

function normalizeAttractionOntology(value: unknown): AttractionOntologyResponse {
  const data = isRecord(value) ? value : {}
  const governance = isRecord(data.governance) ? data.governance : {}

  return {
    moduleKey: 'attraction',
    title: asString(data.title, 'Онтология Привлечения'),
    governance: {
      decisionRole: asString(governance.decisionRole),
      decisionUnit: asString(governance.decisionUnit),
    },
    lastReviewedAt: asString(data.lastReviewedAt),
    sources: asArray(data.sources, normalizeOntologySource).filter(
      (source) => source.id,
    ),
    concepts: asArray(data.concepts, normalizeOntologyConcept).filter(
      (concept) => concept.id,
    ),
    transitions: asArray(data.transitions, normalizeOntologyTransition).filter(
      (transition) => transition.id,
    ),
    reportBindings: asArray(
      data.reportBindings,
      normalizeOntologyReportBinding,
    ).filter((binding) => binding.id),
    drift: asArray(data.drift, normalizeOntologyDriftItem).filter(
      (item) => item.message,
    ),
  }
}

function normalizeOntologySourceDocument(
  value: unknown,
): OntologySourceDocumentResponse {
  const data = isRecord(value) ? value : {}

  return {
    moduleKey: 'attraction',
    source: normalizeOntologySource(data.source),
    content: asString(data.content),
  }
}

function normalizeSyncSummary(value: unknown): SyncSummary {
  const data = isRecord(value) ? value : {}

  return {
    syncRunId: asNumber(data.syncRunId),
    leadsSynced: asNumber(data.leadsSynced),
    dealsSynced: asNumber(data.dealsSynced),
    mode: data.mode === 'full' ? 'full' : 'delta',
    modifiedAfter: asNullableString(data.modifiedAfter),
    finishedAt: asString(data.finishedAt),
    snapshotBefore: normalizeSnapshotStats(data.snapshotBefore),
    snapshotAfter: normalizeSnapshotStats(data.snapshotAfter),
    changes: normalizeSyncChanges(data.changes),
    diagnostics: asArray(data.diagnostics, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeLeadgenFunnelReport(value: unknown): LeadgenFunnelReport {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalDeals: asNumber(data.totalDeals),
    createdDeals: asNumber(data.createdDeals),
    activeDeals: asNumber(data.activeDeals),
    closedDeals: asNumber(data.closedDeals),
    stageRows: asArray(data.stageRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        activeDeals: asNumber(item.activeDeals),
        createdDeals: asNumber(item.createdDeals),
        closedDeals: asNumber(item.closedDeals),
      }
    }),
    sourceRows: asArray(data.sourceRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        sourceKey: asString(item.sourceKey),
        sourceLabel: asString(item.sourceLabel, asString(item.sourceKey)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    utmRows: asArray(data.utmRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        utmSource: asNullableString(item.utmSource),
        utmMedium: asNullableString(item.utmMedium),
        utmCampaign: asNullableString(item.utmCampaign),
        dealCount: asNumber(item.dealCount),
      }
    }),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    reasonRows: asArray(data.reasonRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        reasonKey: asString(item.reasonKey),
        reasonLabel: asString(item.reasonLabel, asString(item.reasonKey)),
        dealCount: asNumber(item.dealCount),
      }
    }),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSyncProgressEvent(value: unknown): SyncProgressEvent {
  const data = isRecord(value) ? value : {}
  const phase = asString(data.phase)

  return {
    syncRunId: typeof data.syncRunId === 'number' ? data.syncRunId : null,
    phase:
      phase === 'inspect_snapshot' ||
      phase === 'fetch_catalogs' ||
      phase === 'fetch_deals' ||
      phase === 'fetch_activities' ||
      phase === 'fetch_calls' ||
      phase === 'persist_snapshot' ||
      phase === 'complete' ||
      phase === 'failed'
        ? phase
        : 'inspect_snapshot',
    progress: Math.min(100, Math.max(0, asNumber(data.progress))),
    message: asString(data.message),
    ...(isRecord(data.snapshotBefore)
      ? { snapshotBefore: normalizeSnapshotStats(data.snapshotBefore) }
      : {}),
    ...(isRecord(data.snapshotAfter)
      ? { snapshotAfter: normalizeSnapshotStats(data.snapshotAfter) }
      : {}),
    ...(isRecord(data.changes) ? { changes: normalizeSyncChanges(data.changes) } : {}),
    ...(data.mode === 'full' || data.mode === 'delta' ? { mode: data.mode } : {}),
    ...(typeof data.modifiedAfter === 'string' || data.modifiedAfter === null
      ? { modifiedAfter: data.modifiedAfter }
      : {}),
    ...(typeof data.startedAt === 'string' ? { startedAt: data.startedAt } : {}),
    ...(typeof data.finishedAt === 'string' ? { finishedAt: data.finishedAt } : {}),
    diagnostics: asArray(data.diagnostics, (entry) => asString(entry)).filter(Boolean),
  }
}

function normalizeSourceQualityConversionSnapshot(
  value: unknown,
): SourceQualityConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    stageSequence: asArray(data.stageSequence, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
      }
    }),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        sourceKey: asString(item.sourceKey),
        sourceLabel: asString(item.sourceLabel, asString(item.sourceKey)),
        qualityKey: asString(item.qualityKey),
        qualityLabel: asString(item.qualityLabel, asString(item.qualityKey)),
        createdDeals: asNumber(item.createdDeals),
        wonDeals: asNumber(item.wonDeals),
        stageMetrics: asArray(item.stageMetrics, (metric) => {
          const row = isRecord(metric) ? metric : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            reachedDeals: asNumber(row.reachedDeals),
            conversionRate: asNumber(row.conversionRate),
            averageStageDurationHours: asNumber(row.averageStageDurationHours),
          }
        }),
      }
    }),
  }
}

function normalizeSourceQualityConversionReport(
  value: unknown,
): SourceQualityConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeSourceQualityConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeSourceQualityConversionSnapshot,
    ),
  }
}

function normalizeActivitiesWorkloadSnapshot(
  value: unknown,
): ActivitiesWorkloadReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalDealCount: asNumber(data.totalDealCount),
    totalCreatedCount: asNumber(data.totalCreatedCount),
    totalRescheduledCount: asNumber(data.totalRescheduledCount),
    totalClosedCount: asNumber(data.totalClosedCount),
    totalMeetingCount: asNumber(data.totalMeetingCount),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
        createdCount: asNumber(item.createdCount),
        rescheduledCount: asNumber(item.rescheduledCount),
        closedCount: asNumber(item.closedCount),
        meetingCount: asNumber(item.meetingCount),
        averageCreatedPerDeal: asNumber(item.averageCreatedPerDeal),
        averageRescheduledPerDeal: asNumber(item.averageRescheduledPerDeal),
        averageClosedPerDeal: asNumber(item.averageClosedPerDeal),
        averageMeetingsPerDeal: asNumber(item.averageMeetingsPerDeal),
        meetingTypeBreakdown: asArray(item.meetingTypeBreakdown, (meetingType) => {
          const row = isRecord(meetingType) ? meetingType : {}
          return {
            meetingTypeKey: asString(row.meetingTypeKey),
            meetingTypeLabel: asString(
              row.meetingTypeLabel,
              asString(row.meetingTypeKey),
            ),
            count: asNumber(row.count),
          }
        }),
        businessClubBreakdown: asArray(item.businessClubBreakdown, (businessClub) => {
          const row = isRecord(businessClub) ? businessClub : {}
          return {
            businessClubKey: asString(row.businessClubKey),
            businessClubLabel: asString(
              row.businessClubLabel,
              asString(row.businessClubKey),
            ),
            dealCount: asNumber(row.dealCount),
          }
        }),
        meetingBusinessClubBreakdown: asArray(
          item.meetingBusinessClubBreakdown,
          (meetingBusinessClub) => {
            const row = isRecord(meetingBusinessClub) ? meetingBusinessClub : {}
            return {
              businessClubKey: asString(row.businessClubKey),
              businessClubLabel: asString(
                row.businessClubLabel,
                asString(row.businessClubKey),
              ),
              meetingTypeKey: asString(row.meetingTypeKey),
              meetingTypeLabel: asString(
                row.meetingTypeLabel,
                asString(row.meetingTypeKey),
              ),
              count: asNumber(row.count),
            }
          },
        ),
        slaMetrics: asArray(item.slaMetrics, (metric) => {
          const row = isRecord(metric) ? metric : {}
          return {
            slaKey:
              row.slaKey === 'sla2' || row.slaKey === 'sla3'
                ? row.slaKey
                : 'sla1',
            label: asString(row.label, asString(row.slaKey)),
            onTimeCount: asNumber(row.onTimeCount),
            lateCount: asNumber(row.lateCount),
            noTouchCount: asNumber(row.noTouchCount),
            medianHours: asNumber(row.medianHours),
          }
        }),
        stageBreakdown: asArray(item.stageBreakdown, (stage) => {
          const row = isRecord(stage) ? stage : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            dealCount: asNumber(row.dealCount),
            createdCount: asNumber(row.createdCount),
            rescheduledCount: asNumber(row.rescheduledCount),
            closedCount: asNumber(row.closedCount),
            averageCreatedPerDeal: asNumber(row.averageCreatedPerDeal),
            averageRescheduledPerDeal: asNumber(row.averageRescheduledPerDeal),
            averageClosedPerDeal: asNumber(row.averageClosedPerDeal),
          }
        }),
      }
    }),
  }
}

function normalizeActivitiesWorkloadReport(value: unknown): ActivitiesWorkloadReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeActivitiesWorkloadSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeActivitiesWorkloadSnapshot,
    ),
  }
}

function normalizeCallsWorkloadSnapshot(value: unknown): CallsWorkloadReportSnapshot {
  const data = isRecord(value) ? value : {}
  const normalizeCallPopulation = (value: unknown) => {
    const item = isRecord(value) ? value : {}

    return {
      totalCalls: asNumber(item.totalCalls),
      incomingCalls: asNumber(item.incomingCalls),
      missedIncomingCalls: asNumber(item.missedIncomingCalls),
      outgoingCalls: asNumber(item.outgoingCalls),
      otherOutgoingCalls: asNumber(item.otherOutgoingCalls),
      connectedCalls: asNumber(item.connectedCalls),
      failedCalls: asNumber(item.failedCalls),
      callsOverThirtySeconds: asNumber(item.callsOverThirtySeconds),
      connectedCallsOverThirtySeconds: asNumber(item.connectedCallsOverThirtySeconds),
      averageDurationSeconds: asNumber(item.averageDurationSeconds),
    }
  }
  const normalizeStageCallMetric = (value: unknown) => {
    const row = isRecord(value) ? value : {}

    return {
      stageId: asString(row.stageId),
      stageName: asString(row.stageName, asString(row.stageId)),
      dealCount: asNumber(row.dealCount),
      totalCalls: asNumber(row.totalCalls),
      incomingCalls: asNumber(row.incomingCalls),
      missedIncomingCalls: asNumber(row.missedIncomingCalls),
      outgoingCalls: asNumber(row.outgoingCalls),
      otherOutgoingCalls: asNumber(row.otherOutgoingCalls),
      connectedCalls: asNumber(row.connectedCalls),
      failedCalls: asNumber(row.failedCalls),
      callsOverThirtySeconds: asNumber(row.callsOverThirtySeconds),
      connectedCallsOverThirtySeconds: asNumber(row.connectedCallsOverThirtySeconds),
      averageCallsPerDeal: asNumber(row.averageCallsPerDeal),
      averageDurationSeconds: asNumber(row.averageDurationSeconds),
    }
  }
  const linkedDealCalls = isRecord(data.linkedDealCalls) ? data.linkedDealCalls : {}

  return {
    range: normalizeRange(data.range),
    totalDealCount: asNumber(data.totalDealCount),
    totalCalls: asNumber(data.totalCalls),
    totalIncomingCalls: asNumber(data.totalIncomingCalls),
    totalMissedIncomingCalls: asNumber(data.totalMissedIncomingCalls),
    totalOutgoingCalls: asNumber(data.totalOutgoingCalls),
    totalOtherOutgoingCalls: asNumber(data.totalOtherOutgoingCalls),
    totalConnectedCalls: asNumber(data.totalConnectedCalls),
    totalFailedCalls: asNumber(data.totalFailedCalls),
    totalCallsOverThirtySeconds: asNumber(data.totalCallsOverThirtySeconds),
    totalConnectedCallsOverThirtySeconds: asNumber(
      data.totalConnectedCallsOverThirtySeconds,
    ),
    allCalls: normalizeCallPopulation(data.allCalls),
    linkedDealCalls: {
      ...normalizeCallPopulation(linkedDealCalls),
      totalDealCount: asNumber(linkedDealCalls.totalDealCount),
    },
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    managerRows: asArray(data.managerRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const linked = isRecord(item.linkedDealCalls) ? item.linkedDealCalls : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        dealCount: asNumber(item.dealCount),
        totalCalls: asNumber(item.totalCalls),
        incomingCalls: asNumber(item.incomingCalls),
        missedIncomingCalls: asNumber(item.missedIncomingCalls),
        outgoingCalls: asNumber(item.outgoingCalls),
        otherOutgoingCalls: asNumber(item.otherOutgoingCalls),
        connectedCalls: asNumber(item.connectedCalls),
        failedCalls: asNumber(item.failedCalls),
        callsOverThirtySeconds: asNumber(item.callsOverThirtySeconds),
        connectedCallsOverThirtySeconds: asNumber(
          item.connectedCallsOverThirtySeconds,
        ),
        averageCallsPerDeal: asNumber(item.averageCallsPerDeal),
        averageDurationSeconds: asNumber(item.averageDurationSeconds),
        allCalls: normalizeCallPopulation(item.allCalls),
        linkedDealCalls: {
          ...normalizeCallPopulation(linked),
          dealCount: asNumber(linked.dealCount),
          averageCallsPerDeal: asNumber(linked.averageCallsPerDeal),
          stageBreakdown: asArray(linked.stageBreakdown, normalizeStageCallMetric),
        },
        stageBreakdown: asArray(item.stageBreakdown, normalizeStageCallMetric),
      }
    }),
  }
}

function normalizeCallsWorkloadReport(value: unknown): CallsWorkloadReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeCallsWorkloadSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeCallsWorkloadSnapshot),
  }
}

function normalizeAcquisitionOutcomesSnapshot(
  value: unknown,
): AcquisitionOutcomesReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalNewDeals: asNumber(data.totalNewDeals),
    totalLostDeals: asNumber(data.totalLostDeals),
    newDealsByManager: asArray(data.newDealsByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalNewDeals: asNumber(item.totalNewDeals),
        sources: asArray(item.sources, (source) => {
          const row = isRecord(source) ? source : {}
          return {
            sourceKey: asString(row.sourceKey),
            sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
            totalNewDeals: asNumber(row.totalNewDeals),
            qualities: asArray(row.qualities, (quality) => {
              const bucket = isRecord(quality) ? quality : {}
              return {
                qualityKey: asString(bucket.qualityKey),
                qualityLabel: asString(bucket.qualityLabel, asString(bucket.qualityKey)),
                count: asNumber(bucket.count),
              }
            }),
          }
        }),
      }
    }),
    lostDealsByManager: asArray(data.lostDealsByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalLostDeals: asNumber(item.totalLostDeals),
        stages: asArray(item.stages, (stage) => {
          const row = isRecord(stage) ? stage : {}
          return {
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            count: asNumber(row.count),
          }
        }),
      }
    }),
    lostStages: asArray(data.lostStages, (stage) => {
      const row = isRecord(stage) ? stage : {}
      return {
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        count: asNumber(row.count),
      }
    }),
    businessClubByManager: asArray(data.businessClubByManager, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalDeals: asNumber(item.totalDeals),
        businessClubs: asArray(item.businessClubs, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            businessClubKey: asString(row.businessClubKey),
            businessClubLabel: asString(
              row.businessClubLabel,
              asString(row.businessClubKey),
            ),
            count: asNumber(row.count),
          }
        }),
        targetGroups: asArray(item.targetGroups, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            targetGroupKey: asString(row.targetGroupKey),
            targetGroupLabel: asString(
              row.targetGroupLabel,
              asString(row.targetGroupKey),
            ),
            count: asNumber(row.count),
          }
        }),
      }
    }),
    topLossReasons: asArray(data.topLossReasons, (reason) => {
      const row = isRecord(reason) ? reason : {}
      return {
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        managerId: asString(row.managerId),
        managerName: asString(row.managerName, asString(row.managerId)),
        reasonKey: asString(row.reasonKey),
        reasonLabel: asString(row.reasonLabel, asString(row.reasonKey)),
        count: asNumber(row.count),
      }
    }),
    lostDealDetails: asArray(data.lostDealDetails, (detail) => {
      const row = isRecord(detail) ? detail : {}
      return {
        dealId: asString(row.dealId),
        managerId: asString(row.managerId),
        managerName: asString(row.managerName, asString(row.managerId)),
        sourceKey: asString(row.sourceKey),
        sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
        businessClubValue: asNullableString(row.businessClubValue),
        stageId: asString(row.stageId),
        stageName: asString(row.stageName, asString(row.stageId)),
        reasonKey: asString(row.reasonKey),
        reasonLabel: asString(row.reasonLabel, asString(row.reasonKey)),
        reasonDetail: asNullableString(row.reasonDetail),
      }
    }),
  }
}

function normalizeAcquisitionOutcomesReport(
  value: unknown,
): AcquisitionOutcomesReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeAcquisitionOutcomesSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeAcquisitionOutcomesSnapshot,
    ),
  }
}

function normalizeCohortConversionSnapshot(
  value: unknown,
): CohortConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalClosedDeals: asNumber(data.totalClosedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    closureMonths: asArray(data.closureMonths, (entry) => asString(entry)).filter(Boolean),
    relativeBucketKeys: asArray(data.relativeBucketKeys, (entry) =>
      asString(entry),
    ).filter(Boolean) as CohortConversionReportSnapshot['relativeBucketKeys'],
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        createdMonth: asString(item.createdMonth),
        createdDeals: asNumber(item.createdDeals),
        closedDeals: asNumber(item.closedDeals),
        wonDeals: asNumber(item.wonDeals),
        closedRate: asNumber(item.closedRate),
        wonConversionRate: asNumber(item.wonConversionRate),
        averageDaysToClose: asNumber(item.averageDaysToClose),
        averageDaysToWin: asNumber(item.averageDaysToWin),
        closureBuckets: asArray(item.closureBuckets, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            closedMonth: asString(row.closedMonth),
            closedDeals: asNumber(row.closedDeals),
            wonDeals: asNumber(row.wonDeals),
            closedRate: asNumber(row.closedRate),
            wonConversionRate: asNumber(row.wonConversionRate),
          }
        }),
        relativeClosureBuckets: asArray(item.relativeClosureBuckets, (bucket) => {
          const row = isRecord(bucket) ? bucket : {}
          return {
            bucketKey: asString(
              row.bucketKey,
            ) as CohortConversionReportSnapshot['relativeBucketKeys'][number],
            label: asString(row.label),
            closedDeals: asNumber(row.closedDeals),
            wonDeals: asNumber(row.wonDeals),
            closedRate: asNumber(row.closedRate),
            wonConversionRate: asNumber(row.wonConversionRate),
          }
        }),
      }
    }),
  }
}

function normalizeCohortConversionReport(value: unknown): CohortConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeCohortConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeCohortConversionSnapshot,
    ),
  }
}

function normalizeTargetGroupConversionSnapshot(
  value: unknown,
): TargetGroupConversionReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalCreatedDeals: asNumber(data.totalCreatedDeals),
    totalWonDeals: asNumber(data.totalWonDeals),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        targetGroupKey: asString(item.targetGroupKey),
        targetGroupLabel: asString(
          item.targetGroupLabel,
          asString(item.targetGroupKey),
        ),
        createdDeals: asNumber(item.createdDeals),
        wonDeals: asNumber(item.wonDeals),
        winRate: asNumber(item.winRate),
        salesAmount: asNumber(item.salesAmount),
        averageSaleAmount: asNumber(item.averageSaleAmount),
        averageCycleDays: asNumber(item.averageCycleDays),
      }
    }),
  }
}

function normalizeTargetGroupConversionReport(
  value: unknown,
): TargetGroupConversionReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeTargetGroupConversionSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeTargetGroupConversionSnapshot,
    ),
  }
}

function normalizeConversionEventBreakdown(value: unknown) {
  return asArray(value, (entry) => {
    const item = isRecord(entry) ? entry : {}
    return {
      key: asString(item.key),
      label: asString(item.label, asString(item.key)),
      count: asNumber(item.count),
    }
  })
}

function normalizeConversionEventsSnapshot(
  value: unknown,
): ConversionEventsReportSnapshot {
  const data = isRecord(value) ? value : {}

  return {
    range: normalizeRange(data.range),
    totalInvitedCount: asNumber(data.totalInvitedCount),
    totalConfirmedCount: asNumber(data.totalConfirmedCount),
    totalAttendedCount: asNumber(data.totalAttendedCount),
    totalRefusedCount: asNumber(data.totalRefusedCount),
    totalMissedCount: asNumber(data.totalMissedCount),
    attendanceRate:
      typeof data.attendanceRate === 'number' ? data.attendanceRate : null,
    nextStepEligibleCount: asNumber(data.nextStepEligibleCount),
    nextStepCount: asNumber(data.nextStepCount),
    nextStepRate:
      typeof data.nextStepRate === 'number' ? data.nextStepRate : null,
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        eventKey: asString(item.eventKey),
        eventName: asString(item.eventName),
        eventDate: asString(item.eventDate),
        invitedCount: asNumber(item.invitedCount),
        confirmedCount: asNumber(item.confirmedCount),
        attendedCount: asNumber(item.attendedCount),
        refusedCount: asNumber(item.refusedCount),
        missedCount: asNumber(item.missedCount),
        attendanceRate:
          typeof item.attendanceRate === 'number' ? item.attendanceRate : null,
        nextStepEligibleCount: asNumber(item.nextStepEligibleCount),
        nextStepCount: asNumber(item.nextStepCount),
        nextStepRate:
          typeof item.nextStepRate === 'number' ? item.nextStepRate : null,
        unlinkedCount: asNumber(item.unlinkedCount),
        unknownStatusCount: asNumber(item.unknownStatusCount),
        managerBreakdown: normalizeConversionEventBreakdown(item.managerBreakdown),
        sourceBreakdown: normalizeConversionEventBreakdown(item.sourceBreakdown),
        businessClubBreakdown: normalizeConversionEventBreakdown(
          item.businessClubBreakdown,
        ),
      }
    }),
  }
}

function normalizeConversionEventsReport(value: unknown): ConversionEventsReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeConversionEventsSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeConversionEventsSnapshot,
    ),
  }
}

function normalizeManagerActionOutcomeSnapshot(
  value: unknown,
): ManagerActionOutcomeReportSnapshot {
  const data = isRecord(value) ? value : {}
  const normalizeStatusKey = (value: unknown) =>
    value === 'won' || value === 'lost' || value === 'wip' ? value : 'wip'
  const normalizeDealSlaStatus = (value: unknown): ManagerActionOutcomeDealSlaStatus =>
    value === 'onTime' || value === 'late' || value === 'noTouch' ? value : 'noTouch'
  const normalizeDealSla = (value: unknown) => {
    const sla = isRecord(value) ? value : {}
    const normalizeOne = (entry: unknown) => {
      const item = isRecord(entry) ? entry : {}
      return {
        status: normalizeDealSlaStatus(item.status),
        hours: typeof item.hours === 'number' && Number.isFinite(item.hours) ? item.hours : null,
      }
    }
    return {
      sla1: normalizeOne(sla.sla1),
      sla2: normalizeOne(sla.sla2),
      sla3: normalizeOne(sla.sla3),
    }
  }

  return {
    range: normalizeRange(data.range),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        createdTasks: asNumber(item.createdTasks),
        closedTasks: asNumber(item.closedTasks),
        totalCalls: asNumber(item.totalCalls),
        successfulCallsOverThirtySeconds: asNumber(
          item.successfulCallsOverThirtySeconds,
        ),
        meetingsCount: asNumber(item.meetingsCount),
        sla1OnTimeCount: asNumber(item.sla1OnTimeCount),
        sla1LateCount: asNumber(item.sla1LateCount),
        sla1NoTouchCount: asNumber(item.sla1NoTouchCount),
        sla1MedianHours: asNumber(item.sla1MedianHours),
        sla2OnTimeCount: asNumber(item.sla2OnTimeCount),
        sla2LateCount: asNumber(item.sla2LateCount),
        sla2NoTouchCount: asNumber(item.sla2NoTouchCount),
        sla2MedianHours: asNumber(item.sla2MedianHours),
        sla3OnTimeCount: asNumber(item.sla3OnTimeCount),
        sla3LateCount: asNumber(item.sla3LateCount),
        sla3NoTouchCount: asNumber(item.sla3NoTouchCount),
        sla3MedianHours: asNumber(item.sla3MedianHours),
        newDealsCount: asNumber(item.newDealsCount),
        wonDealsCount: asNumber(item.wonDealsCount),
        winRate: asNumber(item.winRate),
        salesAmount: asNumber(item.salesAmount),
        averageSaleAmount: asNumber(item.averageSaleAmount),
        averageCycleDays: asNumber(item.averageCycleDays),
      }
    }),
    cohortMonths: asArray(data.cohortMonths, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        cohortMonth: asString(item.cohortMonth),
        cohortLabel: asString(item.cohortLabel, asString(item.cohortMonth)),
        totalCreatedDeals: asNumber(item.totalCreatedDeals),
      }
    }),
    cohortStatusRows: asArray(data.cohortStatusRows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        cohortMonth: typeof item.cohortMonth === 'string' ? item.cohortMonth : null,
        statusKey: normalizeStatusKey(item.statusKey),
        statusLabel: asString(item.statusLabel),
        cohortCreatedDeals: asNumber(item.cohortCreatedDeals),
        dealCount: asNumber(item.dealCount),
        statusShare: asNumber(item.statusShare),
        createdTasksPerDeal: asNumber(item.createdTasksPerDeal),
        closedTasksPerDeal: asNumber(item.closedTasksPerDeal),
        totalCallsPerDeal: asNumber(item.totalCallsPerDeal),
        successfulCallsOverThirtySecondsPerDeal: asNumber(
          item.successfulCallsOverThirtySecondsPerDeal,
        ),
        meetingsPerDeal: asNumber(item.meetingsPerDeal),
        sla1OnTimeRate: asNumber(item.sla1OnTimeRate),
        sla2OnTimeRate: asNumber(item.sla2OnTimeRate),
        sla3OnTimeRate: asNumber(item.sla3OnTimeRate),
        financialAmount: asNumber(item.financialAmount),
        averageFinancialAmount: asNumber(item.averageFinancialAmount),
        dealDetails: asArray(item.dealDetails, (deal) => {
          const row = isRecord(deal) ? deal : {}
          return {
            dealId: asString(row.dealId),
            stageId: asString(row.stageId),
            stageName: asString(row.stageName, asString(row.stageId)),
            amount: asNumber(row.amount),
            dateCreate: asString(row.dateCreate),
            dateClosed: asNullableString(row.dateClosed),
            dateModify: asString(row.dateModify),
            sourceKey: asString(row.sourceKey),
            sourceLabel: asString(row.sourceLabel, asString(row.sourceKey)),
            qualityValue: asNullableString(row.qualityValue),
            businessClubValue: asNullableString(row.businessClubValue),
            targetGroupValue: asNullableString(row.targetGroupValue),
            meetingTypeValue: asNullableString(row.meetingTypeValue),
            meetingDateValue: asNullableString(row.meetingDateValue),
            tariffValue: asNullableString(row.tariffValue),
            taskSummary: normalizeDealTaskSummary(row.taskSummary),
            callSummary: normalizeDealCallSummary(row.callSummary),
            meetingSummary: normalizeDealMeetingSummary(row.meetingSummary),
            sla: normalizeDealSla(row.sla),
            stageTimeline: normalizeDealStageTimeline(row.stageTimeline),
          }
        }),
      }
    }),
  }
}

function normalizeManagerActionOutcomeReport(
  value: unknown,
): ManagerActionOutcomeReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeManagerActionOutcomeSnapshot(data),
    comparisons: normalizeComparisons(
      data.comparisons,
      normalizeManagerActionOutcomeSnapshot,
    ),
  }
}

function normalizeTocFlowSnapshot(value: unknown): TocFlowReportSnapshot {
  const data = isRecord(value) ? value : {}
  const bottleneck = isRecord(data.bottleneck) ? data.bottleneck : null

  return {
    range: normalizeRange(data.range),
    businessDays: asNumber(data.businessDays),
    warnings: asArray(data.warnings, (entry) => asString(entry)).filter(Boolean),
    estimatedGainPerDay:
      typeof data.estimatedGainPerDay === 'number' &&
      Number.isFinite(data.estimatedGainPerDay)
        ? data.estimatedGainPerDay
        : null,
    rows: asArray(data.rows, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        stageSemanticId: asNullableString(item.stageSemanticId),
        sortOrder: asNumber(item.sortOrder),
        enteredDeals: asNumber(item.enteredDeals),
        movedNextDeals: asNumber(item.movedNextDeals),
        throughputPerDay: asNumber(item.throughputPerDay),
        queueEnd: asNumber(item.queueEnd),
        queueBufferDays:
          typeof item.queueBufferDays === 'number' &&
          Number.isFinite(item.queueBufferDays)
            ? item.queueBufferDays
            : null,
        averageStageDurationDays: asNumber(item.averageStageDurationDays),
      }
    }),
    bottleneck: bottleneck
      ? {
          stageId: asString(bottleneck.stageId),
          stageName: asString(bottleneck.stageName, asString(bottleneck.stageId)),
          throughputPerDay: asNumber(bottleneck.throughputPerDay),
          queueEnd: asNumber(bottleneck.queueEnd),
          queueBufferDays:
            typeof bottleneck.queueBufferDays === 'number' &&
            Number.isFinite(bottleneck.queueBufferDays)
              ? bottleneck.queueBufferDays
              : null,
        }
      : null,
    stageDistribution: normalizeTocStageDistribution(data.stageDistribution),
  }
}

function normalizeTocStageDistribution(value: unknown): TocStageDistribution | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    totalCreatedDeals: asNumber(value.totalCreatedDeals),
    nodes: asArray(value.nodes, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        dealCount: asNumber(item.dealCount),
        shareOfCreatedDeals: asNumber(item.shareOfCreatedDeals),
      }
    }).filter((node) => node.stageId || node.stageName),
    edges: asArray(value.edges, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const fromStageId = asNullableString(item.fromStageId ?? item.sourceStageId)
      const fromStageName = asNullableString(item.fromStageName ?? item.sourceStageName)
      const toStageId = asString(item.toStageId ?? item.targetStageId)
      const toStageName = asString(
        item.toStageName ?? item.targetStageName,
        toStageId,
      )

      return {
        fromStageId,
        fromStageName,
        toStageId,
        toStageName,
        dealCount: asNumber(item.dealCount),
        conversionRate: asNumber(item.conversionRate),
      }
    }).filter((edge) => edge.toStageId || edge.toStageName),
    routeNodes: asArray(value.routeNodes, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        step: asNumber(item.step),
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        sortOrder: asNumber(item.sortOrder),
        dealCount: asNumber(item.dealCount),
        shareOfCreatedDeals: asNumber(item.shareOfCreatedDeals),
      }
    }).filter((node) => node.stageId || node.stageName),
    routeEdges: asArray(value.routeEdges, (entry) => {
      const item = isRecord(entry) ? entry : {}

      return {
        fromStep: asNumber(item.fromStep),
        fromStageId: asString(item.fromStageId),
        fromStageName: asString(item.fromStageName, asString(item.fromStageId)),
        toStep: asNumber(item.toStep),
        toStageId: asString(item.toStageId),
        toStageName: asString(item.toStageName, asString(item.toStageId)),
        dealCount: asNumber(item.dealCount),
        conversionRate: asNumber(item.conversionRate),
      }
    }).filter((edge) => edge.fromStageId && edge.toStageId),
  }
}

function normalizeTocFlowReport(value: unknown): TocFlowReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeTocFlowSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeTocFlowSnapshot),
  }
}

function normalizeRevenueVelocityDimension(value: unknown): RevenueVelocityDimension {
  return value === 'source' ||
    value === 'customer' ||
    value === 'managerSource' ||
    value === 'sourceCustomer' ||
    value === 'managerCustomer'
    ? value
    : 'manager'
}

function normalizeRevenueVelocityView(value: unknown): RevenueVelocityView {
  return value === 'operationalPeriod' || value === 'createdCohort'
    ? value
    : 'systemState'
}

function normalizeRevenueVelocityActionSummary(
  value: unknown,
): RevenueVelocityActionSummary {
  const data = isRecord(value) ? value : {}

  return {
    totalCalls: asNumber(data.totalCalls),
    connectedCallsOverThirtySeconds: asNumber(data.connectedCallsOverThirtySeconds),
    meetingsCount: asNumber(data.meetingsCount),
    conversionEventsCount: asNumber(data.conversionEventsCount),
    createdTasks: asNumber(data.createdTasks),
    closedTasks: asNumber(data.closedTasks),
    weightedActionPoints: asNumber(data.weightedActionPoints),
    weightedActionPointsPerDeal: asNullableNumber(data.weightedActionPointsPerDeal),
    weightedActionPointsPerWin: asNullableNumber(data.weightedActionPointsPerWin),
  }
}

function normalizeRevenueVelocityMoneyPerAction(
  value: unknown,
): RevenueVelocityMoneyPerAction {
  const data = isRecord(value) ? value : {}

  return {
    moneyPerMeeting: asNullableNumber(data.moneyPerMeeting),
    moneyPerConnectedCallOverThirtySeconds: asNullableNumber(
      data.moneyPerConnectedCallOverThirtySeconds,
    ),
    moneyPerConversionEvent: asNullableNumber(data.moneyPerConversionEvent),
    moneyPerClosedTask: asNullableNumber(data.moneyPerClosedTask),
    moneyPerWeightedActionPoint: asNullableNumber(data.moneyPerWeightedActionPoint),
    actionEfficiencyIndex: asNullableNumber(data.actionEfficiencyIndex),
  }
}

function normalizeRevenueVelocityFormulaBreakdown(
  value: unknown,
): RevenueVelocityFormulaBreakdown | null {
  if (!isRecord(value)) {
    return null
  }

  return {
    source:
      value.source === 'selectedCohort' || value.source === 'rollingQuarterCohort'
        ? value.source
        : 'selectedCohort',
    sourceLabel: asString(value.sourceLabel),
    averageRevenueAmount: asNullableNumber(value.averageRevenueAmount),
    opportunitiesCount: asNumber(value.opportunitiesCount),
    conversionRate: asNullableNumber(value.conversionRate),
    averageCycleDays: asNullableNumber(value.averageCycleDays),
    value: asNullableNumber(value.value),
    benchmarkFrom: asNullableString(value.benchmarkFrom),
    benchmarkTo: asNullableString(value.benchmarkTo),
    missingReason: asNullableString(value.missingReason),
  }
}

function normalizeRevenueVelocitySnapshot(
  value: unknown,
): RevenueVelocityReportSnapshot {
  const data = isRecord(value) ? value : {}
  const dimension = normalizeRevenueVelocityDimension(data.dimension)
  const view = normalizeRevenueVelocityView(data.view)
  const normalizeRow = (entry: unknown) => {
    const row = isRecord(entry) ? entry : {}

    return {
      dimension: normalizeRevenueVelocityDimension(row.dimension ?? dimension),
      view: normalizeRevenueVelocityView(row.view ?? view),
      key: asString(row.key),
      label: asString(row.label, asString(row.key)),
      managerId: asNullableString(row.managerId),
      managerName: asNullableString(row.managerName),
      sourceKey: asNullableString(row.sourceKey),
      sourceLabel: asNullableString(row.sourceLabel),
      customerKey: asNullableString(row.customerKey),
      customerLabel: asNullableString(row.customerLabel),
      createdDeals: asNumber(row.createdDeals),
      activeDeals: asNumber(row.activeDeals),
      wonDeals: asNumber(row.wonDeals),
      lostDeals: asNumber(row.lostDeals),
      wipDeals: asNumber(row.wipDeals),
      salesAmount: asNumber(row.salesAmount),
      averageCheck: asNullableNumber(row.averageCheck),
      winRate: asNullableNumber(row.winRate),
      averageCycleDays: asNullableNumber(row.averageCycleDays),
      medianCycleDays: asNullableNumber(row.medianCycleDays),
      revenueVelocityPerDay: asNullableNumber(row.revenueVelocityPerDay),
      revenueVelocityFormula: normalizeRevenueVelocityFormulaBreakdown(
        row.revenueVelocityFormula,
      ),
      activePipelineAmount: asNumber(row.activePipelineAmount),
      expectedPipelineAmount: asNullableNumber(row.expectedPipelineAmount),
      previousExpectedPipelineAmount: asNullableNumber(row.previousExpectedPipelineAmount),
      expectedPipelineDelta: asNullableNumber(row.expectedPipelineDelta),
      liveRevenueVelocity: asNullableNumber(row.liveRevenueVelocity),
      previousLiveRevenueVelocity: asNullableNumber(row.previousLiveRevenueVelocity),
      velocityDelta: asNullableNumber(row.velocityDelta),
      velocityDeltaPercent: asNullableNumber(row.velocityDeltaPercent),
      averageRemainingDays: asNullableNumber(row.averageRemainingDays),
      realizedWonAmountInPeriod: asNumber(row.realizedWonAmountInPeriod),
      wonDealsInPeriod: asNumber(row.wonDealsInPeriod),
      lostDealsInPeriod: asNumber(row.lostDealsInPeriod),
      systemValueCreated: asNullableNumber(row.systemValueCreated),
      actionPointsDelta: asNullableNumber(row.actionPointsDelta),
      systemValuePerActionPoint: asNullableNumber(row.systemValuePerActionPoint),
      realizedMoneyPerActionPoint: asNullableNumber(row.realizedMoneyPerActionPoint),
      historicalMoneyPerActionPoint: asNullableNumber(row.historicalMoneyPerActionPoint),
      estimatedFutureMoneyFromPeriodActions: asNullableNumber(
        row.estimatedFutureMoneyFromPeriodActions,
      ),
      actions: normalizeRevenueVelocityActionSummary(row.actions),
      moneyPerAction: normalizeRevenueVelocityMoneyPerAction(row.moneyPerAction),
      bottleneckStageId: asNullableString(row.bottleneckStageId),
      bottleneckStageName: asNullableString(row.bottleneckStageName),
      warnings: asArray(row.warnings, (warning) => asString(warning)).filter(Boolean),
    }
  }
  const weights = isRecord(data.actionWeights) ? data.actionWeights : {}

  return {
    range: normalizeRange(data.range),
    asOf: asString(data.asOf),
    previousAsOf: asNullableString(data.previousAsOf),
    dimension,
    view,
    actionWeights: {
      connectedCallOverThirtySeconds: asNumber(
        weights.connectedCallOverThirtySeconds,
        1,
      ),
      meeting: asNumber(weights.meeting, 3),
      conversionEvent: asNumber(weights.conversionEvent, 5),
      closedTask: asNumber(weights.closedTask, 0.5),
    },
    totals: normalizeRow(data.totals),
    rows: asArray(data.rows, normalizeRow),
    formulaTooltips: asArray(data.formulaTooltips, (entry) => {
      const item = isRecord(entry) ? entry : {}
      const emptyState = asNullableString(item.emptyState)
      return {
        key: asString(item.key),
        label: asString(item.label, asString(item.key)),
        formula: asString(item.formula),
        description: asString(item.description),
        ...(emptyState ? { emptyState } : {}),
      }
    }),
    warnings: asArray(data.warnings, (warning) => asString(warning)).filter(Boolean),
  }
}

function normalizeRevenueVelocityReport(value: unknown): RevenueVelocityReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeRevenueVelocitySnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeRevenueVelocitySnapshot),
  }
}

function buildQueryParams(query: DashboardQuery) {
  const compareFrom = query.compareRanges?.map((range) => range.from)
  const compareTo = query.compareRanges?.map((range) => range.to)
  const compareParams =
    compareFrom?.length && compareTo?.length
      ? {
          compareFrom,
          compareTo,
        }
      : {}
  const sharedParams = {
    managerIds: query.managerIds,
    sourceKeys: query.sourceKeys,
    ...compareParams,
  }

  return query.preset === 'custom'
    ? {
        from: query.from,
        to: query.to,
        ...sharedParams,
      }
    : {
        periodDays: query.preset,
        ...sharedParams,
      }
}

function buildRevenueVelocityQueryParams(query: RevenueVelocityQuery) {
  return {
    ...buildQueryParams(query),
    dimension: query.dimension,
    view: query.view,
    asOf: query.asOf,
    customerKeys: query.customerKeys,
    qualityKeys: query.qualityKeys,
    tariffKeys: query.tariffKeys,
  }
}

async function requestJson<T>(
  pathname: string,
  init: RequestInit,
  normalize: (value: unknown) => T,
) {
  const response = await fetch(pathname, buildRequestInit(init))

  if (!response.ok) {
    const { message, payload } = await readErrorResponse(response)
    if (response.status === 401 && !String(pathname).includes('/api/auth/login')) {
      notifyUnauthorized()
    }
    throw new ApiClientError(message, response.status, payload)
  }

  const data = (await response.json()) as unknown
  return normalize(data)
}

async function requestVoid(pathname: string, init: RequestInit) {
  const response = await fetch(pathname, buildRequestInit(init))

  if (!response.ok) {
    const { message, payload } = await readErrorResponse(response)
    if (response.status === 401) {
      notifyUnauthorized()
    }
    throw new ApiClientError(message, response.status, payload)
  }
}

function parseSyncStreamBlock(block: string) {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event,
    data: JSON.parse(dataLines.join('\n')) as unknown,
  }
}

async function requestSyncStream(
  moduleId: string,
  onProgress: (event: SyncProgressEvent) => void,
) {
  const syncPath = buildModulePath(moduleId, '/api/sync')
  const response = await fetch(buildUrl(syncPath), {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    },
    credentials: 'include',
  })

  if (!response.ok || !response.body) {
    if (!response.ok) {
      const { message, payload } = await readErrorResponse(response)
      if (response.status === 401) {
        notifyUnauthorized()
      }
      throw new ApiClientError(message, response.status, payload)
    }

    return requestJson(buildUrl(syncPath), { method: 'POST' }, normalizeSyncSummary)
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let summary: SyncSummary | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const parsed = parseSyncStreamBlock(block.trim())
        if (!parsed) {
          continue
        }

        if (parsed.event === 'progress') {
          onProgress(normalizeSyncProgressEvent(parsed.data))
        } else if (parsed.event === 'complete') {
          summary = normalizeSyncSummary(parsed.data)
        } else if (parsed.event === 'error') {
          const errorData = isRecord(parsed.data) ? parsed.data : {}
          const details = isRecord(errorData.details) ? errorData.details : {}
          const diagnostics = asArray(details.diagnostics, (entry) => asString(entry)).filter(
            Boolean,
          )
          const code = asString(errorData.code, 'SYNC_FAILED')
          throw new ApiClientError(
            [code, ...diagnostics].filter(Boolean).join(': '),
            response.status,
          )
        }
      }
    }

    if (done) {
      break
    }
  }

  if (summary) {
    return summary
  }

  throw new ApiClientError('SYNC_STREAM_INCOMPLETE', response.status)
}

export const apiClient = {
  onUnauthorized(listener: () => void) {
    unauthorizedListeners.add(listener)
    return () => {
      unauthorizedListeners.delete(listener)
    }
  },
  async login(input: { login: string; password: string }) {
    const response = await requestJson(
      buildUrl('/api/auth/login'),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async getCurrentUser() {
    const response = await requestJson(
      buildUrl('/api/auth/me'),
      { method: 'GET' },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async logout() {
    await requestVoid(buildUrl('/api/auth/logout'), { method: 'POST' })
    csrfToken = null
  },
  async updateCurrentUser(input: { firstName?: string | null; lastName?: string | null }) {
    const response = await requestJson(
      buildUrl('/api/auth/me'),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeAuthResponse,
    )
    return setCsrfTokenFromResponse(response)
  },
  async changeCurrentPassword(input: { currentPassword: string; newPassword: string }) {
    await requestVoid(buildUrl('/api/auth/change-password'), {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async getProtoComments() {
    return requestJson(
      buildUrl('/api/proto-comments'),
      { method: 'GET' },
      normalizeCommentStore,
    )
  },
  async saveProtoComments(comments: ProtoComment[]) {
    return requestJson(
      buildUrl('/api/proto-comments'),
      {
        method: 'POST',
        body: JSON.stringify({ comments }),
      },
      normalizeCommentStore,
    )
  },
  async getComments(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comments')),
      { method: 'GET' },
      normalizeCommentStore,
    )
  },
  async createComment(
    input: {
      sceneId: string
      x: number
      y: number
      text: string
      anchor?: ProtoCommentAnchor
      context?: ProtoCommentContext
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comments')),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async updateComment(
    id: string,
    input: {
      text?: string
      context?: ProtoCommentContext
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}`)),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async archiveComment(id: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/archive`),
      ),
      { method: 'POST' },
      normalizeCommentResponse,
    )
  },
  async retryComment(id: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/retry`),
      ),
      { method: 'POST' },
      normalizeCommentResponse,
    )
  },
  async reworkComment(id: string, input: { text: string }, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(moduleId, `/api/comments/${encodeURIComponent(id)}/rework`),
      ),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeCommentResponse,
    )
  },
  async getCommentNotifications(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/comment-notifications')),
      { method: 'GET' },
      normalizeCommentNotificationsResponse,
    )
  },
  async getModuleUsers(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/admin/module-users')),
      { method: 'GET' },
      normalizeModuleUsersResponse,
    )
  },
  async createModuleUser(
    input: {
      login: string
      firstName?: string | null
      lastName?: string | null
      password: string
      role: ModuleRole
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/admin/module-users')),
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      normalizeModuleUserResponse,
    )
  },
  async updateModuleUser(
    id: number,
    input: {
      firstName?: string | null
      lastName?: string | null
      password?: string
      role?: ModuleRole
      disabled?: boolean
      membershipStatus?: 'active' | 'disabled'
    },
    moduleId = 'attraction',
  ) {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/admin/module-users/${id}`)),
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
      normalizeModuleUserResponse,
    )
  },
  async deleteModuleUser(id: number, moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, `/api/admin/module-users/${id}`)),
      { method: 'DELETE' },
      normalizeModuleUserResponse,
    )
  },
  async getPlatformAccess() {
    return requestJson(
      buildUrl('/api/admin/platform/access'),
      { method: 'GET' },
      normalizePlatformAccessResponse,
    )
  },
  async updatePlatformUserMemberships(
    id: number,
    memberships: PlatformMembershipInput[],
  ) {
    return requestJson(
      buildUrl(`/api/admin/platform/users/${id}/module-memberships`),
      {
        method: 'PATCH',
        body: JSON.stringify({ memberships }),
      },
      normalizePlatformUserResponse,
    )
  },
  async getDashboard(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/dashboard', buildQueryParams(query)),
      { method: 'GET' },
      normalizeDashboard,
    )
  },
  async getLeadgenFunnelReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/funnel`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeLeadgenFunnelReport,
    )
  },
  async getLeadgenActivitiesWorkloadReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/activities-workload`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeActivitiesWorkloadReport,
    )
  },
  async getLeadgenCallsWorkloadReport(moduleId: string, query: DashboardQuery) {
    return requestJson(
      buildUrl(
        `/api/modules/${encodeURIComponent(moduleId)}/reports/calls-workload`,
        buildQueryParams(query),
      ),
      { method: 'GET' },
      normalizeCallsWorkloadReport,
    )
  },
  async getSalesPlan(range: ReportRange) {
    return requestJson(
      buildUrl('/api/sales-plan', {
        from: range.from,
        to: range.to,
      }),
      { method: 'GET' },
      normalizeSalesPlan,
    )
  },
  async saveSalesPlan(input: SalesPlanInput) {
    return requestJson(
      buildUrl('/api/sales-plan'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeSalesPlan,
    )
  },
  async getEffectiveSalesPlan(range: ReportRange) {
    return requestJson(
      buildUrl('/api/sales-plan/effective', {
        from: range.from,
        to: range.to,
      }),
      { method: 'GET' },
      normalizeSalesPlan,
    )
  },
  async getSalesPlanQuarter(input: { year: number; quarter: number }) {
    return requestJson(
      buildUrl('/api/sales-plan/quarter', {
        year: String(input.year),
        quarter: String(input.quarter),
      }),
      { method: 'GET' },
      normalizeSalesPlanQuarter,
    )
  },
  async saveSalesPlanQuarter(input: SalesPlanQuarterInput) {
    return requestJson(
      buildUrl('/api/sales-plan/quarter'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeSalesPlanQuarter,
    )
  },
  async getPricingSettings() {
    return requestJson(
      buildUrl('/api/settings/pricing'),
      { method: 'GET' },
      normalizePricingSettings,
    )
  },
  async savePricingSettings(input: DealPricingSettingsInput) {
    return requestJson(
      buildUrl('/api/settings/pricing'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizePricingSettings,
    )
  },
  async getConversionEventTypeSettings() {
    return requestJson(
      buildUrl('/api/settings/conversion-event-types'),
      { method: 'GET' },
      normalizeConversionEventTypeSettings,
    )
  },
  async saveConversionEventTypeSettings(input: ConversionEventTypeSettingsInput) {
    return requestJson(
      buildUrl('/api/settings/conversion-event-types'),
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      normalizeConversionEventTypeSettings,
    )
  },
  async getMeta(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/meta')),
      { method: 'GET' },
      normalizeMeta,
    )
  },
  async getAttractionOntology(moduleId = 'attraction') {
    return requestJson(
      buildUrl(buildModulePath(moduleId, '/api/ontology')),
      { method: 'GET' },
      normalizeAttractionOntology,
    )
  },
  async getAttractionOntologySourceDocument(sourceId: string, moduleId = 'attraction') {
    return requestJson(
      buildUrl(
        buildModulePath(
          moduleId,
          `/api/ontology/sources/${encodeURIComponent(sourceId)}`,
        ),
      ),
      { method: 'GET' },
      normalizeOntologySourceDocument,
    )
  },
  async getSourceQualityConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/source-quality-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeSourceQualityConversionReport,
    )
  },
  async getActivitiesWorkloadReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/activities-workload', buildQueryParams(query)),
      { method: 'GET' },
      normalizeActivitiesWorkloadReport,
    )
  },
  async getAcquisitionOutcomesReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/acquisition-outcomes', buildQueryParams(query)),
      { method: 'GET' },
      normalizeAcquisitionOutcomesReport,
    )
  },
  async getTargetGroupConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/target-group-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeTargetGroupConversionReport,
    )
  },
  async getManagerActionOutcomeReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/manager-action-outcomes', buildQueryParams(query)),
      { method: 'GET' },
      normalizeManagerActionOutcomeReport,
    )
  },
  async getConversionEventsReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/conversion-events', buildQueryParams(query)),
      { method: 'GET' },
      normalizeConversionEventsReport,
    )
  },
  async getCallsWorkloadReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/calls-workload', buildQueryParams(query)),
      { method: 'GET' },
      normalizeCallsWorkloadReport,
    )
  },
  async getCohortConversionReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/cohort-conversion', buildQueryParams(query)),
      { method: 'GET' },
      normalizeCohortConversionReport,
    )
  },
  async getTocFlowReport(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/reports/toc-flow', buildQueryParams(query)),
      { method: 'GET' },
      normalizeTocFlowReport,
    )
  },
  async getRevenueVelocityReport(query: RevenueVelocityQuery) {
    return requestJson(
      buildUrl(
        '/api/reports/revenue-velocity',
        buildRevenueVelocityQueryParams(query),
      ),
      { method: 'GET' },
      normalizeRevenueVelocityReport,
    )
  },
  async triggerSync(
    moduleIdOrProgress: string | ((event: SyncProgressEvent) => void) = 'attraction',
    maybeProgress?: (event: SyncProgressEvent) => void,
  ) {
    const moduleId =
      typeof moduleIdOrProgress === 'string' ? moduleIdOrProgress : 'attraction'
    const onProgress =
      typeof moduleIdOrProgress === 'function' ? moduleIdOrProgress : maybeProgress
    const syncPath = buildModulePath(moduleId, '/api/sync')

    if (onProgress) {
      return requestSyncStream(moduleId, onProgress)
    }

    return requestJson(buildUrl(syncPath), { method: 'POST' }, normalizeSyncSummary)
  },
}

export { ApiClientError }
