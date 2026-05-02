import type {
  ActivitiesWorkloadReport,
  ActivitiesWorkloadReportSnapshot,
  CallsWorkloadReport,
  CallsWorkloadReportSnapshot,
  CohortConversionReport,
  CohortConversionReportSnapshot,
  DashboardQuery,
  ReportRange,
  TocFlowReport,
  TocFlowReportSnapshot,
} from '@/lib/dashboard-types'
import type {
  ActivitiesCallsSceneData,
  ActivityMatrixRow,
  ActivitySummaryRow,
  CohortDistributionRow,
  CohortSceneData,
  CohortMatrixRow,
  FlowStageMetric,
  ProtoFilterState,
  ProtoKpi,
  TocManagerConversionRow,
  TocFlowSceneData,
  TocStableLeaderRow,
  TocStageDistribution,
} from '@/proto/types'

type ManagerCohortBreakdown = {
  key: string
  label: string
  report: Pick<
    CohortConversionReportSnapshot,
    'totalCreatedDeals' | 'totalClosedDeals' | 'totalWonDeals' | 'rows'
  >
}

type SourceCohortBreakdown = ManagerCohortBreakdown

type ManagerTocBreakdown = {
  key: string
  label: string
  report: Pick<TocFlowReport, 'rows' | 'comparisons'>
}

const STABLE_LEADER_RATE_THRESHOLD = 0.85
const MOSCOW_TIMEZONE_OFFSET = '+03:00'

const cohortBucketOrder = ['month_1', 'month_2', 'month_3', 'month_4_plus'] as const

const cohortBucketLabels = new Map<
  (typeof cohortBucketOrder)[number],
  string
>([
  ['month_1', 'В 1 месяц'],
  ['month_2', 'Во 2 месяц'],
  ['month_3', 'В 3 месяц'],
  ['month_4_plus', 'В 4+ месяц'],
])

function toMoscowRangeBoundary(date: string, boundary: 'start' | 'end') {
  return boundary === 'start'
    ? `${date}T00:00:00.000${MOSCOW_TIMEZONE_OFFSET}`
    : `${date}T23:59:59.999${MOSCOW_TIMEZONE_OFFSET}`
}

function formatSignedValue(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const rounded = Math.round(value * 10) / 10
  const normalized = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1)

  return `${rounded > 0 ? '+' : ''}${normalized}${suffix}`
}

function formatSignedInteger(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value))
}

function formatDecimal(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0'
  }

  return (Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1)
}

function formatPercentDisplay(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%'
  }

  if (value < 1) {
    return '<1%'
  }

  return `${Math.floor(value)}%`
}

function formatPercentPointDelta(current: number, compare: number) {
  if (!Number.isFinite(compare)) {
    return '—'
  }

  const diff = current - compare
  const magnitude = Math.abs(diff)
  const rounded =
    magnitude >= 5 ? Math.ceil(magnitude) : Math.floor(magnitude)

  if (rounded === 0) {
    return '0 п.п.'
  }

  return `${diff > 0 ? '+' : '-'}${rounded} п.п.`
}

function formatPercentDelta(current: number, compare: number) {
  if (!Number.isFinite(compare) || compare === 0) {
    if (current === 0) {
      return '0%'
    }

    return '—'
  }

  const delta = ((current - compare) / compare) * 100
  return `${formatSignedInteger(delta)}%`
}

function normalizeKpiTone(
  delta: string,
  positiveIsGood: boolean,
): ProtoKpi['deltaTone'] {
  if (
    !delta ||
    delta === '—' ||
    delta === '0' ||
    delta === '0%' ||
    delta === '0 п.п.' ||
    delta === '0 дн.'
  ) {
    return 'neutral'
  }

  const isPositive = delta.startsWith('+')
  if (positiveIsGood) {
    return isPositive ? 'positive' : 'negative'
  }

  return isPositive ? 'negative' : 'positive'
}

function buildKpi(input: {
  label: string
  value: string
  note: string
  compare?: string | undefined
  delta?: string | undefined
  deltaTone?: ProtoKpi['deltaTone'] | undefined
}): ProtoKpi {
  const kpi: ProtoKpi = {
    label: input.label,
    value: input.value,
    note: input.note,
  }

  if (input.compare !== undefined) {
    kpi.compare = input.compare
  }

  if (input.delta !== undefined) {
    kpi.delta = input.delta
  }

  if (input.deltaTone !== undefined) {
    kpi.deltaTone = input.deltaTone
  }

  return kpi
}

function formatCompareValue(prefix: string, value: string) {
  return `${prefix}: ${value}`
}

function formatOptionalCompareValue(
  prefix: string,
  value: number | null | undefined,
  formatter: (input: number) => string,
) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }

  return formatCompareValue(prefix, formatter(value))
}

function getFirstComparison<TSnapshot extends { range: ReportRange }>(
  report: { comparisons?: Array<{ snapshot: TSnapshot }> },
) {
  return report.comparisons?.[0]?.snapshot ?? null
}

function getStageOrder(
  activities: ActivitiesWorkloadReport,
  calls: CallsWorkloadReport,
) {
  const seen = new Set<string>()
  const order: string[] = []

  for (const row of activities.managerRows) {
    for (const stage of row.stageBreakdown) {
      if (!seen.has(stage.stageName)) {
        seen.add(stage.stageName)
        order.push(stage.stageName)
      }
    }
  }

  for (const row of calls.managerRows) {
    for (const stage of row.stageBreakdown) {
      if (!seen.has(stage.stageName)) {
        seen.add(stage.stageName)
        order.push(stage.stageName)
      }
    }
  }

  return order
}

function createActivityLevel(
  currentCallsPerDeal: number,
  currentClosedPerDeal: number,
  maxCallsPerDeal: number,
  maxClosedPerDeal: number,
) {
  const callsRatio = maxCallsPerDeal > 0 ? currentCallsPerDeal / maxCallsPerDeal : 0
  const closedRatio =
    maxClosedPerDeal > 0 ? currentClosedPerDeal / maxClosedPerDeal : 0
  const ratio = Math.max(callsRatio, closedRatio)

  return Math.max(1, Math.min(5, Math.ceil(ratio * 5)))
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .replace(/\s*г\.$/, '')
    .replace(/^./, (letter) => letter.toUpperCase())
}

function getRelativeClosureBucket(
  row: CohortConversionReportSnapshot['rows'][number],
  bucketKey: (typeof cohortBucketOrder)[number],
) {
  return (
    row.relativeClosureBuckets.find((bucket) => bucket.bucketKey === bucketKey) ?? {
      bucketKey,
      label: cohortBucketLabels.get(bucketKey) ?? bucketKey,
      closedDeals: 0,
      wonDeals: 0,
      closedRate: 0,
      wonConversionRate: 0,
    }
  )
}

function createHeatLevel(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return 1
  }

  return Math.max(1, Math.min(5, Math.ceil((value / maxValue) * 5)))
}

function sumRelativeBucketWonDeals(
  rows: CohortConversionReportSnapshot['rows'],
  bucketKey: (typeof cohortBucketOrder)[number],
) {
  return rows.reduce((total, row) => {
    const bucket = row.relativeClosureBuckets.find((entry) => entry.bucketKey === bucketKey)
    return total + (bucket?.wonDeals ?? 0)
  }, 0)
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function sumRowsCreatedDeals(rows: CohortConversionReportSnapshot['rows']) {
  return rows.reduce((total, row) => total + row.createdDeals, 0)
}

function sumRowsWonDeals(rows: CohortConversionReportSnapshot['rows']) {
  return rows.reduce((total, row) => total + row.wonDeals, 0)
}

function weightedAverageCohortCycleDays(rows: CohortConversionReportSnapshot['rows']) {
  const totals = rows.reduce(
    (accumulator, row) => {
      if (row.wonDeals <= 0 || row.averageDaysToWin <= 0) {
        return accumulator
      }

      return {
        weightedDays: accumulator.weightedDays + row.averageDaysToWin * row.wonDeals,
        wonDeals: accumulator.wonDeals + row.wonDeals,
      }
    },
    { weightedDays: 0, wonDeals: 0 },
  )

  return totals.wonDeals > 0 ? totals.weightedDays / totals.wonDeals : 0
}

function widthFromPercent(value: number) {
  return Math.max(12, Math.min(100, Math.round(value * 3.2)))
}

function formatSignedTenthsTrunc(value: number, suffix = '') {
  if (!Number.isFinite(value) || value === 0) {
    return `0${suffix}`
  }

  const truncated = Math.trunc(value * 10) / 10
  const normalized = Number.isInteger(truncated)
    ? String(truncated)
    : truncated.toFixed(1)

  return `${truncated > 0 ? '+' : ''}${normalized}${suffix}`
}

function mapDistributionRow(
  label: string,
  report: Pick<CohortConversionReportSnapshot, 'totalCreatedDeals' | 'rows'>,
): CohortDistributionRow {
  const denominator = report.totalCreatedDeals || sumRowsCreatedDeals(report.rows) || 1
  const month1 = (sumRelativeBucketWonDeals(report.rows, 'month_1') / denominator) * 100
  const month2 = (sumRelativeBucketWonDeals(report.rows, 'month_2') / denominator) * 100
  const month3 = (sumRelativeBucketWonDeals(report.rows, 'month_3') / denominator) * 100
  const tail = (sumRelativeBucketWonDeals(report.rows, 'month_4_plus') / denominator) * 100

  return {
    manager: label,
    month1: formatPercentDisplay(month1),
    month2: formatPercentDisplay(month2),
    month3: formatPercentDisplay(month3),
    tail: formatPercentDisplay(tail),
    width: widthFromPercent(Math.max(month1, month2, month3, tail)),
  }
}

function sortBreakdowns<T extends { label: string; report: { totalCreatedDeals: number } }>(
  rows: T[],
) {
  return [...rows]
    .filter((row) => row.report.totalCreatedDeals > 0)
    .sort((left, right) => right.report.totalCreatedDeals - left.report.totalCreatedDeals)
}

function formatActivitySummaryValues(
  activityRow: ActivitiesWorkloadReportSnapshot['managerRows'][number] | null,
  callRow: CallsWorkloadReportSnapshot['managerRows'][number] | null,
) {
  const rawValues = [
    activityRow?.createdCount ?? 0,
    activityRow?.closedCount ?? 0,
    callRow?.outgoingCalls ?? 0,
    callRow?.connectedCallsOverThirtySeconds ?? 0,
    callRow?.otherOutgoingCalls ?? 0,
    callRow?.failedCalls ?? 0,
    callRow?.incomingCalls ?? 0,
  ]

  return {
    rawValues,
    values: rawValues.map(formatCount),
  }
}

function conversionLevel(rate: number) {
  if (rate >= 70) {
    return 4
  }

  if (rate >= 50) {
    return 3
  }

  if (rate >= 25) {
    return 2
  }

  return rate > 0 ? 1 : 0
}

function mapTocManagerConversionRow(entry: ManagerTocBreakdown): TocManagerConversionRow & { averageRate: number } {
  const rows = [...entry.report.rows].sort((left, right) => left.sortOrder - right.sortOrder)
  const totalEntered = rows.reduce((total, row) => total + row.enteredDeals, 0)
  const totalMovedNext = rows.reduce((total, row) => total + row.movedNextDeals, 0)
  const averageRate = totalEntered > 0 ? (totalMovedNext / totalEntered) * 100 : 0

  return {
    manager: entry.label,
    averageConversion: formatPercentDisplay(averageRate),
    averageRate,
    stages: rows.map((row) => {
      const rate = row.enteredDeals > 0 ? (row.movedNextDeals / row.enteredDeals) * 100 : 0

      return {
        stage: row.stageName,
        conversion: formatPercentDisplay(rate),
        volume: `${formatCount(row.movedNextDeals)} / ${formatCount(row.enteredDeals)}`,
        level: conversionLevel(rate),
      }
    }),
  }
}

function buildStableLeaderRows(managerBreakdowns: ManagerTocBreakdown[]): TocStableLeaderRow[] {
  const stageIds = Array.from(
    new Set(
      managerBreakdowns.flatMap((entry) => entry.report.rows.map((row) => row.stageId)),
    ),
  )

  return stageIds
    .map((stageId) => {
      const currentEntries = managerBreakdowns
        .map((entry) => {
          const row = entry.report.rows.find((item) => item.stageId === stageId)
          if (!row || row.enteredDeals === 0) {
            return null
          }

          return {
            key: entry.key,
            manager: entry.label,
            stage: row.stageName,
            conversionRate: row.enteredDeals > 0 ? row.movedNextDeals / row.enteredDeals : 0,
            movedNextDeals: row.movedNextDeals,
            enteredDeals: row.enteredDeals,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => {
          if (right.conversionRate !== left.conversionRate) {
            return right.conversionRate - left.conversionRate
          }

          if (right.enteredDeals !== left.enteredDeals) {
            return right.enteredDeals - left.enteredDeals
          }

          return left.manager.localeCompare(right.manager, 'ru-RU')
        })

      const leader = currentEntries[0]
      if (!leader) {
        return null
      }

      const compareEntries = managerBreakdowns
        .map((entry) => {
          const row = entry.report.comparisons?.[0]?.snapshot.rows.find(
            (item) => item.stageId === stageId,
          )
          if (!row || row.enteredDeals === 0) {
            return null
          }

          return {
            key: entry.key,
            conversionRate: row.enteredDeals > 0 ? row.movedNextDeals / row.enteredDeals : 0,
            movedNextDeals: row.movedNextDeals,
            enteredDeals: row.enteredDeals,
          }
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
        .sort((left, right) => {
          if (right.conversionRate !== left.conversionRate) {
            return right.conversionRate - left.conversionRate
          }

          if (right.enteredDeals !== left.enteredDeals) {
            return right.enteredDeals - left.enteredDeals
          }

          return left.key.localeCompare(right.key)
        })

      const compareEntry = compareEntries.find((entry) => entry.key === leader.key) ?? null
      const compareRank = compareEntry ? compareEntries.indexOf(compareEntry) : -1
      const isStable =
        compareEntry !== null &&
        compareRank <= 1 &&
        (compareEntry.conversionRate === 0
          ? leader.conversionRate === 0
          : leader.conversionRate >= compareEntry.conversionRate * STABLE_LEADER_RATE_THRESHOLD)
      const stabilityTone: TocStableLeaderRow['stabilityTone'] =
        compareEntries.length === 0
          ? 'neutral'
          : isStable
            ? 'positive'
            : compareEntry
              ? 'negative'
              : 'neutral'

      return {
        stage: leader.stage,
        manager: leader.manager,
        conversion: formatPercentDisplay(leader.conversionRate * 100),
        volume: `${formatCount(leader.movedNextDeals)} / ${formatCount(leader.enteredDeals)}`,
        compareConversion:
          compareEntry !== null
            ? formatPercentDisplay(compareEntry.conversionRate * 100)
            : '—',
        compareVolume:
          compareEntry !== null
            ? `${formatCount(compareEntry.movedNextDeals)} / ${formatCount(compareEntry.enteredDeals)}`
            : '—',
        stabilityLabel:
          compareEntries.length === 0
            ? 'Без сравнения'
            : isStable
              ? 'Устойчив'
              : compareEntry
                ? 'Нужно проверить'
                : 'Новый лидер',
        stabilityTone,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
}

export function buildDashboardQueryFromProtoFilters(
  filters: ProtoFilterState,
): DashboardQuery {
  return {
    preset: 'custom',
    from: toMoscowRangeBoundary(filters.rangeStart, 'start'),
    to: toMoscowRangeBoundary(filters.rangeEnd, 'end'),
    managerIds: filters.managers,
    sourceKeys: filters.sources,
    compareRanges: filters.compareRanges.map((range) => ({
      from: toMoscowRangeBoundary(range.start, 'start'),
      to: toMoscowRangeBoundary(range.end, 'end'),
    })),
  }
}

export function mapActivitiesCallsSceneData(input: {
  activities: ActivitiesWorkloadReport
  calls: CallsWorkloadReport
}): ActivitiesCallsSceneData {
  const { activities, calls } = input
  const compareActivities = getFirstComparison<ActivitiesWorkloadReportSnapshot>(activities)
  const compareCalls = getFirstComparison<CallsWorkloadReportSnapshot>(calls)

  const managerNames = new Set<string>()
  for (const row of activities.managerRows) {
    managerNames.add(row.managerName)
  }
  for (const row of calls.managerRows) {
    managerNames.add(row.managerName)
  }

  const orderedManagers = Array.from(managerNames).sort((left, right) =>
    left.localeCompare(right, 'ru-RU'),
  )
  const stageOrder = getStageOrder(activities, calls)

  const maxCallsPerDeal = Math.max(
    0,
    ...calls.managerRows.flatMap((row) =>
      row.stageBreakdown.map((stage) => stage.averageCallsPerDeal),
    ),
  )
  const maxClosedPerDeal = Math.max(
    0,
    ...activities.managerRows.flatMap((row) =>
      row.stageBreakdown.map((stage) => stage.averageClosedPerDeal),
    ),
  )

  const summaryRows: ActivitySummaryRow[] = orderedManagers.map((managerName) => {
    const activityRow =
      activities.managerRows.find((row) => row.managerName === managerName) ?? null
    const callRow = calls.managerRows.find((row) => row.managerName === managerName) ?? null
    const currentSummary = formatActivitySummaryValues(activityRow, callRow)
    const comparePoints = Array.from(
      {
        length: Math.max(
          activities.comparisons?.length ?? 0,
          calls.comparisons?.length ?? 0,
        ),
      },
      (_item, index) => {
        const compareActivityRow =
          activities.comparisons?.[index]?.snapshot.managerRows.find(
            (row) => row.managerName === managerName,
          ) ?? null
        const compareCallRow =
          calls.comparisons?.[index]?.snapshot.managerRows.find(
            (row) => row.managerName === managerName,
          ) ?? null
        const compareSummary = formatActivitySummaryValues(compareActivityRow, compareCallRow)

        return {
          label: `С${index + 1}`,
          values: compareSummary.values,
          deltas: currentSummary.rawValues.map((value, metricIndex) =>
            formatPercentDelta(value, compareSummary.rawValues[metricIndex] ?? 0),
          ),
        }
      },
    )
    const firstCompareDeltas =
      comparePoints[0]?.deltas ??
      currentSummary.rawValues.map((value) => formatPercentDelta(value, 0))

    return {
      manager: managerName,
      sortValues: currentSummary.rawValues,
      createdTasks: currentSummary.values[0]!,
      closedTasks: currentSummary.values[1]!,
      outgoing: currentSummary.values[2]!,
      successfulCalls: currentSummary.values[3]!,
      otherOutgoing: currentSummary.values[4]!,
      noAnswer: currentSummary.values[5]!,
      incoming: currentSummary.values[6]!,
      deltas: firstCompareDeltas,
      comparePoints,
    }
  })

  const matrixRows: ActivityMatrixRow[] = orderedManagers.map((managerName) => {
    const activityRow =
      activities.managerRows.find((row) => row.managerName === managerName) ?? null
    const callRow = calls.managerRows.find((row) => row.managerName === managerName) ?? null
    const compareActivityRow =
      compareActivities?.managerRows.find((row) => row.managerName === managerName) ?? null
    const compareCallRow =
      compareCalls?.managerRows.find((row) => row.managerName === managerName) ?? null

    return {
      manager: managerName,
      totalCalls: formatCount(callRow?.totalCalls ?? 0),
      avgCalls: formatDecimal(callRow?.averageCallsPerDeal ?? 0),
      totalClosedTasks: formatCount(activityRow?.closedCount ?? 0),
      avgClosedTasks: formatDecimal(activityRow?.averageClosedPerDeal ?? 0),
      avgCallsDelta: formatPercentDelta(
        callRow?.averageCallsPerDeal ?? 0,
        compareCallRow?.averageCallsPerDeal ?? 0,
      ),
      avgClosedTasksDelta: formatPercentDelta(
        activityRow?.averageClosedPerDeal ?? 0,
        compareActivityRow?.averageClosedPerDeal ?? 0,
      ),
      stages: stageOrder.map((stageName) => {
        const activityStage =
          activityRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null
        const callStage =
          callRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null
        const compareActivityStage =
          compareActivityRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ??
          null
        const compareCallStage =
          compareCallRow?.stageBreakdown.find((stage) => stage.stageName === stageName) ?? null

        const currentCallsPerDeal = callStage?.averageCallsPerDeal ?? 0
        const currentClosedPerDeal = activityStage?.averageClosedPerDeal ?? 0

        return {
          label: stageName,
          totalCalls: formatCount(callStage?.totalCalls ?? 0),
          callsPerDeal: formatDecimal(currentCallsPerDeal),
          totalClosedTasks: formatCount(activityStage?.closedCount ?? 0),
          closedTasksAvg: formatDecimal(currentClosedPerDeal),
          level: createActivityLevel(
            currentCallsPerDeal,
            currentClosedPerDeal,
            maxCallsPerDeal,
            maxClosedPerDeal,
          ),
          callsDelta: formatPercentDelta(
            currentCallsPerDeal,
            compareCallStage?.averageCallsPerDeal ?? 0,
          ),
          closedTasksDelta: formatPercentDelta(
            currentClosedPerDeal,
            compareActivityStage?.averageClosedPerDeal ?? 0,
          ),
        }
      }),
    }
  })

  const hasCallsPerDealBase = calls.totalDealCount > 0
  const totalCallsPerDeal =
    hasCallsPerDealBase ? calls.totalCalls / calls.totalDealCount : 0
  const compareCallsPerDeal =
    compareCalls && compareCalls.totalDealCount > 0
      ? compareCalls.totalCalls / compareCalls.totalDealCount
      : null
  const totalTasksPerDeal =
    activities.totalDealCount > 0
      ? activities.totalCreatedCount / activities.totalDealCount
      : 0
  const compareTasksPerDeal =
    compareActivities && compareActivities.totalDealCount > 0
      ? compareActivities.totalCreatedCount / compareActivities.totalDealCount
      : null

  const createdDelta = formatPercentDelta(
    activities.totalCreatedCount,
    compareActivities?.totalCreatedCount ?? 0,
  )
  const closedDelta = formatPercentDelta(
    activities.totalClosedCount,
    compareActivities?.totalClosedCount ?? 0,
  )
  const callsPerDealDelta = hasCallsPerDealBase
    ? compareCallsPerDeal === null
      ? '—'
      : formatPercentDelta(totalCallsPerDeal, compareCallsPerDeal)
    : calls.totalCalls > 0
      ? 'нет привязки'
      : 'нет базы'
  const tasksPerDealDelta =
    compareTasksPerDeal === null
      ? '—'
      : formatPercentDelta(totalTasksPerDeal, compareTasksPerDeal)

  return {
    kpis: [
      buildKpi({
        label: 'Создано задач',
        value: formatCount(activities.totalCreatedCount),
        note: 'за активный диапазон',
        compare: compareActivities
          ? formatCompareValue('пред. период', formatCount(compareActivities.totalCreatedCount))
          : undefined,
        delta: createdDelta,
        deltaTone: normalizeKpiTone(createdDelta, true),
      }),
      buildKpi({
        label: 'Перенесён дедлайн',
        value: formatCount(activities.totalRescheduledCount),
        note: 'метрика пока выключена',
        compare: 'недостоверная история отсутствует',
        delta: '—',
        deltaTone: 'neutral',
      }),
      buildKpi({
        label: 'Закрыто задач',
        value: formatCount(activities.totalClosedCount),
        note:
          activities.totalCreatedCount > 0
            ? `${Math.round((activities.totalClosedCount / activities.totalCreatedCount) * 100)}% от созданных`
            : '0% от созданных',
        compare: compareActivities
          ? formatCompareValue('пред. период', formatCount(compareActivities.totalClosedCount))
          : undefined,
        delta: closedDelta,
        deltaTone: normalizeKpiTone(closedDelta, true),
      }),
      buildKpi({
        label: 'Звонков на сделку',
        value: hasCallsPerDealBase ? formatDecimal(totalCallsPerDeal) : '—',
        note: hasCallsPerDealBase
          ? 'все звонки / сделки в выборке'
          : calls.totalCalls > 0
            ? 'есть звонки, но они не привязаны к сделкам'
            : 'нет связанных сделок для расчета',
        compare:
          hasCallsPerDealBase && compareCallsPerDeal !== null
            ? formatCompareValue('пред. период', formatDecimal(compareCallsPerDeal))
            : undefined,
        delta: callsPerDealDelta,
        deltaTone: hasCallsPerDealBase
          ? normalizeKpiTone(callsPerDealDelta, true)
          : 'neutral',
      }),
      buildKpi({
        label: 'Задач на сделку',
        value: formatDecimal(totalTasksPerDeal),
        note: 'созданные задачи / сделки в выборке',
        compare: formatOptionalCompareValue(
          'пред. период',
          compareTasksPerDeal,
          formatDecimal,
        ),
        delta: tasksPerDealDelta,
        deltaTone: tasksPerDealDelta === '0%' ? 'neutral' : normalizeKpiTone(tasksPerDealDelta, true),
      }),
    ],
    warnings: Array.from(new Set([...activities.warnings, ...calls.warnings])),
    managerCount: orderedManagers.length,
    stageCount: stageOrder.length,
    summaryRows,
    matrixRows,
  }
}

export function mapCohortSceneData(input: {
  report: CohortConversionReport
  managerBreakdowns: ManagerCohortBreakdown[]
  sourceBreakdowns: SourceCohortBreakdown[]
}): CohortSceneData {
  const { report, managerBreakdowns, sourceBreakdowns } = input
  const compare = getFirstComparison<CohortConversionReportSnapshot>(report)

  const matrixRowsBase: Array<
    CohortMatrixRow & {
      rawValues: number[]
    }
  > = report.rows.map((row) => {
    const matrixBuckets = cohortBucketOrder.map((bucketKey) =>
      getRelativeClosureBucket(row, bucketKey),
    )
    const rawValues = matrixBuckets.map((bucket) => bucket.wonDeals)

    return {
      month: monthLabel(row.createdMonth),
      createdDeals: formatCount(row.createdDeals),
      rawValues,
      cells: matrixBuckets.map((bucket) => ({
        value: formatCount(bucket.wonDeals),
        subvalue: formatPercentDisplay(bucket.wonConversionRate),
        level: 1,
      })),
      conversion: formatPercentDisplay(row.wonConversionRate),
      cycle: `${Math.round(row.averageDaysToWin)} дн.`,
    }
  })

  const maxMatrixValue = Math.max(
    0,
    ...matrixRowsBase.flatMap((row) => row.rawValues),
  )

  const matrixRows: CohortMatrixRow[] = matrixRowsBase.map((row) => ({
    month: row.month,
    createdDeals: row.createdDeals,
    conversion: row.conversion,
    cycle: row.cycle,
    cells: row.cells.map((cell, index) => ({
      ...cell,
      level: createHeatLevel(row.rawValues[index] ?? 0, maxMatrixValue),
    })),
  }))

  const currentCreatedDeals = sumRowsCreatedDeals(report.rows) || report.totalCreatedDeals
  const currentWonDeals = sumRowsWonDeals(report.rows) || report.totalWonDeals
  const compareCreatedDeals =
    compare ? sumRowsCreatedDeals(compare.rows) || compare.totalCreatedDeals : 0
  const compareWonDeals =
    compare ? sumRowsWonDeals(compare.rows) || compare.totalWonDeals : 0
  const currentAverageConversion =
    currentCreatedDeals > 0
      ? (currentWonDeals / currentCreatedDeals) * 100
      : 0
  const compareAverageConversion =
    compareCreatedDeals > 0
      ? (compareWonDeals / compareCreatedDeals) * 100
      : 0
  const currentAverageCycle = weightedAverageCohortCycleDays(report.rows)
  const compareAverageCycle = weightedAverageCohortCycleDays(compare?.rows ?? [])

  const currentBucketDenominator = currentCreatedDeals || 1
  const compareBucketDenominator =
    (compare?.rows ? sumRowsCreatedDeals(compare.rows) : 0) ||
    compare?.totalCreatedDeals ||
    1

  const distributionBuckets = cohortBucketOrder.map((bucketKey) => {
    const label = cohortBucketLabels.get(bucketKey) ?? bucketKey
    const currentExact =
      (sumRelativeBucketWonDeals(report.rows, bucketKey) / currentBucketDenominator) * 100
    const compareExact =
      compare
        ? (sumRelativeBucketWonDeals(compare.rows, bucketKey) / compareBucketDenominator) * 100
        : 0

    return {
      label,
      value: formatPercentDisplay(currentExact),
      compare: compare
        ? `предыдущий период: ${formatPercentDisplay(compareExact)}`
        : 'предыдущий период: —',
      delta: compare ? formatPercentPointDelta(currentExact, compareExact) : '—',
      width: widthFromPercent(currentExact),
    }
  })

  const summaryConversionDelta = compare
    ? formatPercentPointDelta(
        currentAverageConversion,
        compareAverageConversion,
      )
    : '—'
  const averageCycleDelta = compare
    ? `${formatSignedTenthsTrunc(currentAverageCycle - compareAverageCycle)} дн.`
    : '—'

  return {
    range: report.range,
    kpis: [
      buildKpi({
        label: 'Средняя когортная конверсия',
        value: formatPercentDisplay(currentAverageConversion),
        note: '',
        compare: 'с учетом менеджеров и источников',
        delta: summaryConversionDelta,
        deltaTone: normalizeKpiTone(summaryConversionDelta, true),
      }),
      ...distributionBuckets.map((bucket) => buildKpi({
        label: bucket.label,
        value: bucket.value,
        note: '',
        compare: bucket.compare,
        delta: bucket.delta,
        deltaTone: normalizeKpiTone(bucket.delta, true),
      })),
      buildKpi({
        label: 'Средний цикл',
        value: `${Math.round(currentAverageCycle)} дн.`,
        note: '',
        compare: compare
          ? `пред. период: ${Math.round(compareAverageCycle)} дн.`
          : undefined,
        delta: averageCycleDelta,
        deltaTone: normalizeKpiTone(averageCycleDelta, false),
      }),
    ],
    matrixRows,
    distributionBuckets,
    managerDistribution: sortBreakdowns(managerBreakdowns)
      .slice(0, 5)
      .map((entry) => mapDistributionRow(entry.label, entry.report)),
    sourceDistribution: sortBreakdowns(sourceBreakdowns)
      .slice(0, 5)
      .map((entry) => mapDistributionRow(entry.label, entry.report)),
  }
}

function mapStageDistribution(
  report: TocFlowReport,
): TocStageDistribution {
  const distribution = report.stageDistribution

  if (!distribution) {
    return {
      totalCreatedDeals: 0,
      nodes: [],
      edges: [],
    }
  }

  return {
    totalCreatedDeals: distribution.totalCreatedDeals,
    nodes: distribution.nodes
      .map((node) => ({
        stageId: node.stageId,
        stage: node.stageName,
        sortOrder: node.sortOrder,
        count: node.dealCount,
        shareOfCreatedDeals: node.shareOfCreatedDeals,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    edges: distribution.edges.map((edge, index) => ({
      id: `${edge.fromStageId ?? 'created'}-${edge.toStageId}-${index}`,
      fromStageId: edge.fromStageId,
      fromStage: edge.fromStageName ?? 'Создано',
      toStageId: edge.toStageId,
      toStage: edge.toStageName,
      count: edge.dealCount,
      conversionRate: edge.conversionRate,
    })),
    routeNodes: (distribution.routeNodes ?? []).map((node) => ({
      id: `step-${node.step}-${node.stageId}`,
      step: node.step,
      stageId: node.stageId,
      stage: node.stageName,
      sortOrder: node.sortOrder,
      count: node.dealCount,
      shareOfCreatedDeals: node.shareOfCreatedDeals,
    })),
    routeEdges: (distribution.routeEdges ?? []).map((edge, index) => ({
      id: `step-${edge.fromStep}-${edge.fromStageId}-${edge.toStep}-${edge.toStageId}-${index}`,
      fromStep: edge.fromStep,
      fromStageId: edge.fromStageId,
      fromStage: edge.fromStageName,
      toStep: edge.toStep,
      toStageId: edge.toStageId,
      toStage: edge.toStageName,
      count: edge.dealCount,
      conversionRate: edge.conversionRate,
    })),
  }
}

export function mapTocFlowSceneData(input: {
  report: TocFlowReport
  managerBreakdowns?: ManagerTocBreakdown[]
}): TocFlowSceneData {
  const { report, managerBreakdowns = [] } = input
  const compare = getFirstComparison<TocFlowReportSnapshot>(report)
  const currentRows = [...report.rows].sort((left, right) => left.sortOrder - right.sortOrder)
  const compareRows = [...(compare?.rows ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )
  const compareByStageId = new Map(compareRows.map((row) => [row.stageId, row]))

  const currentStages: FlowStageMetric[] = currentRows.map((row) => ({
    stage: row.stageName,
    entered: row.enteredDeals,
    throughputPerDay: row.throughputPerDay,
    queueEnd: row.queueEnd,
    avgCycleDays: row.averageStageDurationDays,
    note:
      report.bottleneck?.stageId === row.stageId
        ? 'Главное ограничение периода'
        : row.queueBufferDays
          ? `Буфер ${row.queueBufferDays.toFixed(1)} дн.`
          : 'Буфер не определен',
  }))

  const compareStages: FlowStageMetric[] = compareRows.map((row) => ({
    stage: row.stageName,
    entered: row.enteredDeals,
    throughputPerDay: row.throughputPerDay,
    queueEnd: row.queueEnd,
    avgCycleDays: row.averageStageDurationDays,
    note:
      compare?.bottleneck?.stageId === row.stageId
        ? 'Ограничение сравнения'
        : row.queueBufferDays
          ? `Буфер ${row.queueBufferDays.toFixed(1)} дн.`
          : 'Буфер не определен',
  }))

  const totalQueue = currentRows.reduce((total, row) => total + row.queueEnd, 0)
  const compareTotalQueue = compareRows.reduce((total, row) => total + row.queueEnd, 0)
  const totalMovedNext = currentRows.reduce((total, row) => total + row.movedNextDeals, 0)
  const compareTotalMovedNext = compareRows.reduce(
    (total, row) => total + row.movedNextDeals,
    0,
  )
  const averageWip = currentRows.length > 0 ? totalQueue / currentRows.length : 0
  const compareAverageWip = compareRows.length > 0 ? compareTotalQueue / compareRows.length : 0
  const averageCycle = average(currentRows.map((row) => row.averageStageDurationDays))
  const compareAverageCycle = average(compareRows.map((row) => row.averageStageDurationDays))

  const throughputDropStage =
    currentRows.reduce(
      (worst, row) => {
        const compareRow = compareByStageId.get(row.stageId)
        const delta = row.throughputPerDay - (compareRow?.throughputPerDay ?? 0)

        if (delta < worst.delta) {
          return { stage: row.stageName, delta }
        }

        return worst
      },
      {
        stage: currentRows[0]?.stageName ?? '—',
        delta: Number.POSITIVE_INFINITY,
      },
    ).stage ?? '—'

  const totalQueueDelta = formatPercentDelta(totalQueue, compareTotalQueue)
  const totalMovedNextDelta = formatPercentDelta(totalMovedNext, compareTotalMovedNext)
  const averageCycleDelta = `${formatSignedTenthsTrunc(averageCycle - compareAverageCycle)} дн.`
  const managerConversionRows = managerBreakdowns
    .map(mapTocManagerConversionRow)
    .filter((row) => row.stages.length > 0)
    .sort((left, right) => right.averageRate - left.averageRate)
    .map(
      (row): TocManagerConversionRow => ({
        manager: row.manager,
        averageConversion: row.averageConversion,
        stages: row.stages,
      }),
    )

  return {
    kpis: [
      buildKpi({
        label: 'Сделок в работе',
        value: formatCount(totalQueue),
        note: 'вся очередь на конец периода',
        compare: compare ? `пред. период: ${formatCount(compareTotalQueue)}` : undefined,
        delta: totalQueueDelta,
        deltaTone: normalizeKpiTone(totalQueueDelta, false),
      }),
      buildKpi({
        label: 'Выход за период',
        value: formatCount(totalMovedNext),
        note: 'перешло на следующий этап в периоде',
        compare: compare
          ? `пред. период: ${formatCount(compareTotalMovedNext)}`
          : undefined,
        delta: totalMovedNextDelta,
        deltaTone: normalizeKpiTone(totalMovedNextDelta, true),
      }),
      buildKpi({
        label: 'Главное ограничение',
        value: report.bottleneck?.stageName ?? '—',
        note: 'самый плотный этап',
        compare: report.bottleneck
          ? `${formatCount(report.bottleneck.queueEnd)} сделок в очереди`
          : undefined,
      }),
      buildKpi({
        label: 'Средний WIP',
        value: formatCount(averageWip),
        note: 'на один активный этап',
        compare: compare ? `пред. период: ${formatCount(compareAverageWip)}` : undefined,
        delta: formatSignedValue(averageWip - compareAverageWip),
        deltaTone: normalizeKpiTone(
          formatSignedValue(averageWip - compareAverageWip),
          false,
        ),
      }),
      buildKpi({
        label: 'Средний цикл этапа',
        value: `${formatDecimal(averageCycle)} дн.`,
        note: 'по этапам с накоплением',
        compare: compare
          ? `пред. период: ${formatDecimal(compareAverageCycle)} дн.`
          : undefined,
        delta: averageCycleDelta,
        deltaTone: normalizeKpiTone(averageCycleDelta, false),
      }),
    ],
    warnings: report.warnings,
    currentStages,
    compareStages,
    managerConversionRows,
    stableLeaders: buildStableLeaderRows(managerBreakdowns),
    stageDistribution: mapStageDistribution(report),
    focus: {
      bottleneckStage: report.bottleneck?.stageName ?? '—',
      compareBottleneckStage: compare?.bottleneck?.stageName ?? '—',
      maxQueueStage:
        currentRows.length > 0
          ? currentRows.reduce((best, row) => (row.queueEnd > best.queueEnd ? row : best)).stageName
          : '—',
      throughputDropStage,
    },
  }
}
