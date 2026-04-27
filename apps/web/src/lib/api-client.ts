import type {
  AcquisitionOutcomesReport,
  AcquisitionOutcomesReportSnapshot,
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  DashboardQuery,
  DashboardData,
  DashboardDataSnapshot,
  ManagerActionOutcomeDealSlaStatus,
  ManagerActionOutcomeReport,
  ManagerActionOutcomeReportSnapshot,
  MetaResponse,
  ReportComparison,
  ReportRange,
  SalesPlanData,
  SalesPlanInput,
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

class ApiClientError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

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

function asArray<T>(value: unknown, mapper: (input: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(mapper) : []
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
      newDealsCount: asNumber(salesSummary.newDealsCount),
      conversionRate: asNumber(salesSummary.conversionRate),
      meetingsCount: asNumber(salesSummary.meetingsCount),
    },
    managerGroups: asArray(data.managerGroups, (group) => {
      const item = isRecord(group) ? group : {}
      return {
        managerId: asString(item.managerId),
        managerName: asString(item.managerName, asString(item.managerId)),
        totalWonDeals: asNumber(item.totalWonDeals),
        totalSalesAmount: asNumber(item.totalSalesAmount),
        deals: asArray(item.deals, (deal) => {
          const row = isRecord(deal) ? deal : {}
          const cohort = isRecord(row.cohortContext) ? row.cohortContext : {}
          const calls = isRecord(row.callSummary) ? row.callSummary : {}
          const tasks = isRecord(row.taskSummary) ? row.taskSummary : {}
          const meetings = isRecord(row.meetingSummary) ? row.meetingSummary : {}

          return {
            dealId: asString(row.dealId),
            dealTitle: asString(row.dealTitle, asString(row.dealId)),
            managerId: asString(row.managerId, asString(item.managerId)),
            managerName: asString(
              row.managerName,
              asString(item.managerName, asString(item.managerId)),
            ),
            amount: asNumber(row.amount),
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
            callSummary: {
              total: asNumber(calls.total),
              incoming: asNumber(calls.incoming),
              outgoing: asNumber(calls.outgoing),
              successful: asNumber(calls.successful),
              failed: asNumber(calls.failed),
              overThirtySeconds: asNumber(calls.overThirtySeconds),
              connectedOverThirtySeconds: asNumber(
                calls.connectedOverThirtySeconds,
              ),
            },
            taskSummary: {
              created: asNumber(tasks.created),
              closed: asNumber(tasks.closed),
            },
            meetingSummary: {
              total: asNumber(meetings.total),
            },
            stageTimeline: asArray(row.stageTimeline, (stage) => {
              const stageRow = isRecord(stage) ? stage : {}
              return {
                stageId: asString(stageRow.stageId),
                stageName: asString(stageRow.stageName, asString(stageRow.stageId)),
                enteredAt: asString(stageRow.enteredAt),
                leftAt: asString(stageRow.leftAt),
                durationHours: asNumber(stageRow.durationHours),
                meetingEvents: asArray(stageRow.meetingEvents, (event) => {
                  const eventRow = isRecord(event) ? event : {}
                  return {
                    activityId: asString(eventRow.activityId),
                    createdAt: asString(eventRow.createdAt),
                    timelineAt: asString(
                      eventRow.timelineAt,
                      asString(eventRow.createdAt),
                    ),
                    scheduledAt: asString(eventRow.scheduledAt),
                    completed: Boolean(eventRow.completed),
                  }
                }),
              }
            }),
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

function normalizeManagerActionOutcomeSnapshot(
  value: unknown,
): ManagerActionOutcomeReportSnapshot {
  const data = isRecord(value) ? value : {}
  const normalizeStatusKey = (value: unknown) =>
    value === 'won' || value === 'lost' || value === 'wip' ? value : 'wip'
  const normalizeDealSlaStatus = (value: unknown): ManagerActionOutcomeDealSlaStatus =>
    value === 'onTime' || value === 'late' || value === 'noTouch' ? value : 'noTouch'
  const normalizeCallSummary = (value: unknown) => {
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
  const normalizeTaskSummary = (value: unknown) => {
    const tasks = isRecord(value) ? value : {}
    return {
      created: asNumber(tasks.created),
      closed: asNumber(tasks.closed),
    }
  }
  const normalizeMeetingSummary = (value: unknown) => {
    const meetings = isRecord(value) ? value : {}
    return {
      total: asNumber(meetings.total),
    }
  }
  const normalizeStageTimeline = (value: unknown) =>
    asArray(value, (stage) => {
      const stageRow = isRecord(stage) ? stage : {}
      return {
        stageId: asString(stageRow.stageId),
        stageName: asString(stageRow.stageName, asString(stageRow.stageId)),
        enteredAt: asString(stageRow.enteredAt),
        leftAt: asString(stageRow.leftAt),
        durationHours: asNumber(stageRow.durationHours),
        meetingEvents: asArray(stageRow.meetingEvents, (event) => {
          const eventRow = isRecord(event) ? event : {}
          return {
            activityId: asString(eventRow.activityId),
            createdAt: asString(eventRow.createdAt),
            timelineAt: asString(eventRow.timelineAt, asString(eventRow.createdAt)),
            scheduledAt: asString(eventRow.scheduledAt),
            completed: Boolean(eventRow.completed),
          }
        }),
      }
    })
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
            taskSummary: normalizeTaskSummary(row.taskSummary),
            callSummary: normalizeCallSummary(row.callSummary),
            meetingSummary: normalizeMeetingSummary(row.meetingSummary),
            sla: normalizeDealSla(row.sla),
            stageTimeline: normalizeStageTimeline(row.stageTimeline),
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
  }
}

function normalizeTocFlowReport(value: unknown): TocFlowReport {
  const data = isRecord(value) ? value : {}

  return {
    ...normalizeTocFlowSnapshot(data),
    comparisons: normalizeComparisons(data.comparisons, normalizeTocFlowSnapshot),
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

async function requestJson<T>(
  pathname: string,
  init: RequestInit,
  normalize: (value: unknown) => T,
) {
  const response = await fetch(pathname, {
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = 'Local API request failed'
    try {
      const errorBody = (await response.json()) as unknown
      if (isRecord(errorBody)) {
        message = asString(errorBody.code, asString(errorBody.error, message))
      }
    } catch {
      // Keep the stable fallback when the server did not return JSON.
    }

    throw new ApiClientError(message, response.status)
  }

  const data = (await response.json()) as unknown
  return normalize(data)
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
  onProgress: (event: SyncProgressEvent) => void,
) {
  const response = await fetch(buildUrl('/api/sync'), {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
    },
  })

  if (!response.ok || !response.body) {
    if (!response.ok) {
      let message = 'Local API request failed'
      try {
        const errorBody = (await response.json()) as unknown
        if (isRecord(errorBody)) {
          message = asString(errorBody.code, asString(errorBody.error, message))
        }
      } catch {
        // Keep fallback.
      }
      throw new ApiClientError(message, response.status)
    }

    return requestJson(buildUrl('/api/sync'), { method: 'POST' }, normalizeSyncSummary)
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
  async getDashboard(query: DashboardQuery) {
    return requestJson(
      buildUrl('/api/dashboard', buildQueryParams(query)),
      { method: 'GET' },
      normalizeDashboard,
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
  async getMeta() {
    return requestJson(buildUrl('/api/meta'), { method: 'GET' }, normalizeMeta)
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
  async triggerSync(onProgress?: (event: SyncProgressEvent) => void) {
    if (onProgress) {
      return requestSyncStream(onProgress)
    }

    return requestJson(buildUrl('/api/sync'), { method: 'POST' }, normalizeSyncSummary)
  },
}

export { ApiClientError }
