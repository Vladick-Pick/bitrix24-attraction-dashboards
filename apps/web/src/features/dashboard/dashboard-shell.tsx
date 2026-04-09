import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  DatabaseIcon,
  RefreshIcon,
  Shield01Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { apiClient } from '@/lib/api-client'
import { getDemoSnapshot } from '@/lib/demo-dashboard'
import type {
  DashboardData,
  MetaResponse,
  PeriodDays,
  TimelineGranularity,
} from '@/lib/dashboard-types'
import { formatInteger, formatLongDate, formatRelativeDate, formatSyncMode } from '@/lib/formatters'
import { filterSourceBreakdown, getTopSource, getWonStageLabels, aggregateTimeline } from '@/lib/reporting'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportFilters } from '@/features/dashboard/report-filters'
import { KpiGrid } from '@/features/dashboard/kpi-grid'
import { SalesTimelineCard } from '@/features/dashboard/sales-timeline-card'
import { FunnelSnapshotCard } from '@/features/dashboard/funnel-snapshot-card'
import { SourceBreakdownCard } from '@/features/dashboard/source-breakdown-card'

type ConnectionMode = 'live' | 'preview'

function DashboardSkeleton() {
  return (
    <div className="app-shell">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Skeleton className="h-[18rem] rounded-[2rem]" />
        <Skeleton className="h-[18rem] rounded-[2rem]" />
      </div>
      <Skeleton className="h-28 rounded-[2rem]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-[2rem]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <Skeleton className="h-[30rem] rounded-[2rem]" />
        <Skeleton className="h-[30rem] rounded-[2rem]" />
      </div>
      <Skeleton className="h-[22rem] rounded-[2rem]" />
    </div>
  )
}

export function DashboardShell() {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30)
  const [timelineGranularity, setTimelineGranularity] =
    useState<TimelineGranularity>('daily')
  const [sourceQuery, setSourceQuery] = useState('')
  const deferredQuery = useDeferredValue(sourceQuery)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [meta, setMeta] = useState<MetaResponse | null>(null)
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('live')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function hydrate(nextPeriodDays: PeriodDays) {
    try {
      const [nextMeta, nextDashboard] = await Promise.all([
        apiClient.getMeta(),
        apiClient.getDashboard(nextPeriodDays),
      ])

      startTransition(() => {
        setMeta(nextMeta)
        setDashboard(nextDashboard)
        setConnectionMode('live')
        setStatusMessage(null)
      })
    } catch {
      const snapshot = getDemoSnapshot(nextPeriodDays)

      startTransition(() => {
        setMeta(snapshot.meta)
        setDashboard(snapshot.dashboard)
        setConnectionMode('preview')
        setStatusMessage(
          'Local API is not reachable yet, so the shell is rendering a preview dataset.',
        )
      })
    } finally {
      setIsInitialLoading(false)
    }
  }

  useEffect(() => {
    void hydrate(periodDays)
  }, [periodDays])

  const wonStageLabels = useMemo(() => getWonStageLabels(meta), [meta])
  const timeline = useMemo(
    () =>
      aggregateTimeline(
        dashboard?.salesOverview.salesTimeline ?? [],
        timelineGranularity,
      ),
    [dashboard?.salesOverview.salesTimeline, timelineGranularity],
  )
  const filteredSources = useMemo(
    () => filterSourceBreakdown(dashboard?.sourceBreakdown ?? [], deferredQuery),
    [dashboard?.sourceBreakdown, deferredQuery],
  )
  const topSource = useMemo(
    () => getTopSource(dashboard?.sourceBreakdown ?? []),
    [dashboard?.sourceBreakdown],
  )

  const handleRefresh = async () => {
    setIsRefreshing(true)

    try {
      const summary = await apiClient.triggerSync()
      await hydrate(periodDays)

      toast.success('Local snapshot refreshed', {
        description: `${formatInteger(summary.leadsSynced)} leads and ${formatInteger(summary.dealsSynced)} deals synced.`,
      })
    } catch {
      toast.error('Refresh failed', {
        description: 'The local API did not accept the refresh request.',
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isInitialLoading || !dashboard || !meta) {
    return <DashboardSkeleton />
  }

  return (
    <main className="app-shell">
      <section className="hero-grid">
        <Card className="hero-card">
          <CardHeader className="gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">Bitrix24 local reporting deck</Badge>
              <Badge variant={connectionMode === 'live' ? 'default' : 'outline'}>
                {connectionMode === 'live' ? 'Live local API' : 'Preview mode'}
              </Badge>
            </div>
            <div className="flex flex-col gap-4">
              <CardTitle className="hero-title">
                Beautiful local reporting, with a hard boundary against contact data.
              </CardTitle>
              <CardDescription className="max-w-3xl text-base leading-7">
                Deals, leads, sources and stage catalogs only. No direct Bitrix
                calls from the browser, no contact/company entities, no raw CRM
                payloads leaking into the UI.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="hero-chip">
                <HugeiconsIcon icon={Shield01Icon} strokeWidth={1.8} className="size-5 text-primary" />
                <div>
                  <div className="eyebrow">Privacy rail</div>
                  <p>No contact, company, phone, email or raw payload fields.</p>
                </div>
              </div>
              <div className="hero-chip">
                <HugeiconsIcon icon={DatabaseIcon} strokeWidth={1.8} className="size-5 text-primary" />
                <div>
                  <div className="eyebrow">Won stage set</div>
                  <p>{wonStageLabels.join(' • ') || 'Not configured yet'}</p>
                </div>
              </div>
            </div>

            <div className="hero-panel">
              <div className="eyebrow">Top source pressure</div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div className="spotlight-number">
                  {topSource ? topSource.sourceLabel : 'No data'}
                </div>
                <Badge variant="outline">
                  {topSource ? `${formatInteger(topSource.salesCount)} wins` : 'Waiting'}
                </Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {topSource
                  ? `${formatInteger(topSource.newDealsCount)} new deals and ${formatInteger(topSource.newLeadsCount)} new leads in this window.`
                  : 'No source attribution rows yet.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="status-card" size="sm">
          <CardHeader>
            <CardTitle>Snapshot control</CardTitle>
            <CardDescription>
              Manual refresh stays inside the local API boundary.
            </CardDescription>
            <CardAction>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <HugeiconsIcon
                  data-icon="inline-start"
                  icon={RefreshIcon}
                  strokeWidth={1.8}
                  className={isRefreshing ? 'animate-spin' : undefined}
                />
                Refresh
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="status-row">
              <span>Default period</span>
              <strong>{meta.defaultPeriodDays} days</strong>
            </div>
            <div className="status-row">
              <span>Last sync</span>
              <strong>
                {meta.lastSync ? formatRelativeDate(meta.lastSync.finishedAt) : 'Not synced yet'}
              </strong>
            </div>
            <div className="status-row">
              <span>Sync mode</span>
              <strong>{meta.lastSync ? formatSyncMode(meta.lastSync.mode) : 'Idle'}</strong>
            </div>
            <div className="status-row">
              <span>Last stamp</span>
              <strong>
                {meta.lastSync ? formatLongDate(meta.lastSync.finishedAt) : 'Awaiting first run'}
              </strong>
            </div>
          </CardContent>
        </Card>
      </section>

      {statusMessage ? (
        <Alert>
          <HugeiconsIcon icon={Alert02Icon} strokeWidth={1.8} />
          <AlertTitle>{connectionMode === 'preview' ? 'Preview dataset active' : 'Status update'}</AlertTitle>
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}

      <ReportFilters
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
        sourceQuery={sourceQuery}
        onSourceQueryChange={setSourceQuery}
      />

      <KpiGrid dashboard={dashboard} />

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <SalesTimelineCard
          timeline={timeline}
          granularity={timelineGranularity}
          onGranularityChange={setTimelineGranularity}
        />
        <FunnelSnapshotCard funnelSnapshot={dashboard.funnelSnapshot} />
      </section>

      <SourceBreakdownCard rows={filteredSources} query={deferredQuery} />
    </main>
  )
}
