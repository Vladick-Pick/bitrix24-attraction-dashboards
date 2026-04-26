import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { apiClient } from '@/lib/api-client'
import type {
  DashboardQuery,
  DashboardData,
  DashboardSnapshot,
  MetaResponse,
  PeriodDays,
  ReportRange,
  ReportPreset,
} from '@/lib/dashboard-types'
import {
  formatInteger,
  formatLongDate,
  formatRelativeDate,
  formatSyncMode,
} from '@/lib/formatters'
import { getWonStageLabels } from '@/lib/reporting'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ReportFilters,
  type ComparisonWindow,
} from '@/features/dashboard/report-filters'
import { KpiGrid } from '@/features/dashboard/kpi-grid'
import { SalesReportCard } from '@/features/dashboard/sales-report-card'

type ConnectionMode = 'live' | 'preview'
const DEFAULT_COMPARISON_WINDOWS: ComparisonWindow[] = ['prev-30', 'yoy']

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDefaultCustomRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 6)

  return {
    from: formatInputDate(from),
    to: formatInputDate(to),
  }
}

function toBoundaryIso(value: string, boundary: 'start' | 'end') {
  const [year, month, day] = value.split('-').map(Number)
  if (![year, month, day].every(Number.isFinite)) {
    throw new Error(`Invalid date value: ${value}`)
  }

  const date =
    boundary === 'start'
      ? new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0))
      : new Date(Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999))
  return date.toISOString()
}

function createPresetRange(periodDays: PeriodDays, now = new Date()): ReportRange {
  const to = new Date(now)
  const from = new Date(now)

  from.setDate(from.getDate() - (periodDays - 1))

  return {
    from: toBoundaryIso(formatInputDate(from), 'start'),
    to: toBoundaryIso(formatInputDate(to), 'end'),
  }
}

function shiftIsoDate(value: string, shift: { days?: number; years?: number }) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (shift.years) {
    date.setUTCFullYear(date.getUTCFullYear() + shift.years)
  }

  if (shift.days) {
    date.setUTCDate(date.getUTCDate() + shift.days)
  }

  return date.toISOString()
}

function resolveDashboardQueryRange(query: DashboardQuery): ReportRange {
  return query.preset === 'custom'
    ? {
        from: query.from,
        to: query.to,
      }
    : createPresetRange(query.preset)
}

function buildCompareRanges(
  query: DashboardQuery,
  windows: ComparisonWindow[],
): ReportRange[] {
  const range = resolveDashboardQueryRange(query)

  return windows.map((window) => {
    switch (window) {
      case 'prev-7':
        return {
          from: shiftIsoDate(range.from, { days: -7 }),
          to: shiftIsoDate(range.to, { days: -7 }),
        }
      case 'prev-30':
        return {
          from: shiftIsoDate(range.from, { days: -30 }),
          to: shiftIsoDate(range.to, { days: -30 }),
        }
      case 'prev-90':
        return {
          from: shiftIsoDate(range.from, { days: -90 }),
          to: shiftIsoDate(range.to, { days: -90 }),
        }
      case 'prev-180':
        return {
          from: shiftIsoDate(range.from, { days: -180 }),
          to: shiftIsoDate(range.to, { days: -180 }),
        }
      case 'yoy':
        return {
          from: shiftIsoDate(range.from, { years: -1 }),
          to: shiftIsoDate(range.to, { years: -1 }),
        }
    }
  })
}

function withCompareRanges(
  query: DashboardQuery,
  windows: ComparisonWindow[],
): DashboardQuery {
  const baseQuery = { ...query }
  delete baseQuery.compareRanges
  const nextCompareRanges = buildCompareRanges(query, windows)

  return {
    ...baseQuery,
    ...(nextCompareRanges.length > 0
      ? { compareRanges: nextCompareRanges }
      : {}),
  } as DashboardQuery
}

function DashboardSkeleton() {
  return (
    <div className="app-shell">
      <Skeleton className="h-[16rem] rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-[2rem]" />
        ))}
      </div>
      <Skeleton className="h-[30rem] rounded-[2rem]" />
    </div>
  )
}

function DashboardErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <main className="app-shell">
      <Alert>
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={1.8} />
        <AlertTitle>Live local API недоступен</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{message}</span>
          <Button variant="outline" onClick={onRetry}>
            Повторить загрузку
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}

interface DashboardShellProps {
  previewSnapshot?: DashboardSnapshot | null
}

export function DashboardShell({ previewSnapshot = null }: DashboardShellProps) {
  const [dashboardQuery, setDashboardQuery] = useState<DashboardQuery>(() =>
    withCompareRanges({ preset: 30 }, DEFAULT_COMPARISON_WINDOWS),
  )
  const [activePreset, setActivePreset] = useState<ReportPreset>(30)
  const [comparisonWindows, setComparisonWindows] = useState<ComparisonWindow[]>(
    DEFAULT_COMPARISON_WINDOWS,
  )
  const [customRange, setCustomRange] = useState(createDefaultCustomRange)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hydrateRequestIdRef = useRef(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const hydrate = useCallback(async (nextQuery: DashboardQuery) => {
    const requestId = ++hydrateRequestIdRef.current
    const canCommit = () =>
      isMountedRef.current && requestId === hydrateRequestIdRef.current

    try {
      const [nextMeta, nextDashboard] = await Promise.all([
        apiClient.getMeta(),
        apiClient.getDashboard(nextQuery),
      ])

      if (!canCommit()) {
        return
      }

      startTransition(() => {
        setMeta(nextMeta)
        setDashboard(nextDashboard)
        setConnectionMode('live')
        setStatusMessage(null)
      })
    } catch {
      if (!canCommit()) {
        return
      }

      startTransition(() => {
        if (previewSnapshot) {
          setMeta(previewSnapshot.meta)
          setDashboard(previewSnapshot.dashboard)
          setConnectionMode('preview')
          setStatusMessage('Активирован preview dataset по явному opt-in сценарию.')
          return
        }

        setConnectionMode('live')
        setStatusMessage(
          'Не удалось загрузить live-данные. Проверьте локальный API и повторите загрузку.',
        )
      })
    } finally {
      if (canCommit()) {
        setIsInitialLoading(false)
      }
    }
  }, [previewSnapshot])

  useEffect(() => {
    void hydrate(dashboardQuery)
  }, [dashboardQuery, hydrate])

  const handleRetry = () => {
    setConnectionMode('live')
    setStatusMessage(null)

    if (!dashboard || !meta) {
      setIsInitialLoading(true)
    }

    void hydrate(dashboardQuery)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)

    try {
      const summary = await apiClient.triggerSync()
      await hydrate(dashboardQuery)

      toast.success('Local snapshot refreshed', {
        description: `${formatInteger(summary.dealsSynced)} deals synced for the Привлечение funnel.`,
      })
    } catch {
      toast.error('Refresh failed', {
        description: 'The local API did not accept the refresh request.',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isInitialLoading) {
    return <DashboardSkeleton />
  }

  if (!dashboard || !meta) {
    return (
      <DashboardErrorState
        message={
          statusMessage ??
          'Не удалось загрузить live-данные. Проверьте локальный API и повторите загрузку.'
        }
        onRetry={handleRetry}
      />
    )
  }

  const isCustomRangeValid =
    customRange.from.length > 0 &&
    customRange.to.length > 0 &&
    customRange.from <= customRange.to

  const handlePresetChange = (nextPreset: ReportPreset | PeriodDays) => {
    if (nextPreset === 'custom') {
      setActivePreset('custom')
      return
    }

    setActivePreset(nextPreset)
    setDashboardQuery(withCompareRanges({ preset: nextPreset }, comparisonWindows))
  }

  const applyCustomRange = () => {
    if (!isCustomRangeValid) {
      return
    }

    setDashboardQuery(
      withCompareRanges(
        {
          preset: 'custom',
          from: toBoundaryIso(customRange.from, 'start'),
          to: toBoundaryIso(customRange.to, 'end'),
        },
        comparisonWindows,
      ),
    )
  }

  const handleComparisonWindowsChange = (nextWindows: ComparisonWindow[]) => {
    setComparisonWindows(nextWindows)
    setDashboardQuery((current) => withCompareRanges(current, nextWindows))
  }

  const lastSyncLabel = meta.lastSync
    ? formatRelativeDate(meta.lastSync.finishedAt)
    : 'Not synced yet'
  const lastStampLabel = meta.lastSync
    ? formatLongDate(meta.lastSync.finishedAt)
    : 'Awaiting first run'
  const syncModeLabel = meta.lastSync ? formatSyncMode(meta.lastSync.mode) : 'Idle'
  const wonStagesLabel = getWonStageLabels(meta).join(' • ') || 'Not configured yet'

  return (
    <main className="app-shell">
      <ReportFilters
        activePreset={activePreset}
        connectionMode={connectionMode}
        customFrom={customRange.from}
        customTo={customRange.to}
        defaultPeriodDays={meta.defaultPeriodDays}
        isCustomRangeValid={isCustomRangeValid}
        isRefreshing={isRefreshing}
        lastStampLabel={lastStampLabel}
        lastSyncLabel={lastSyncLabel}
        onApplyCustomRange={applyCustomRange}
        onCustomFromChange={(next) =>
          setCustomRange((current) => ({
            ...current,
            from: next,
          }))
        }
        onCustomToChange={(next) =>
          setCustomRange((current) => ({
            ...current,
            to: next,
          }))
        }
        onPresetChange={handlePresetChange}
        onRefresh={handleRefresh}
        comparisonWindows={comparisonWindows}
        syncModeLabel={syncModeLabel}
        wonStagesLabel={wonStagesLabel}
        onComparisonWindowsChange={handleComparisonWindowsChange}
      />

      {statusMessage ? (
        <Alert>
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={1.8} />
          <AlertTitle>
            {connectionMode === 'preview'
              ? 'Preview dataset active'
              : 'Live local API недоступен'}
          </AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{statusMessage}</span>
            {connectionMode === 'preview' ? null : (
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Повторить загрузку
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <KpiGrid dashboard={dashboard} />
      <SalesReportCard groups={dashboard.managerGroups} />
    </main>
  )
}
