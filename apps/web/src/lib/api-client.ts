import type {
  DashboardData,
  MetaResponse,
  PeriodDays,
  SourceBreakdownEntry,
  SyncSummary,
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

function buildUrl(pathname: string, params?: Record<string, string | number>) {
  const url = new URL(`${API_BASE_URL}${pathname}`, window.location.origin)

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value))
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

function normalizeSourceRow(value: unknown): SourceBreakdownEntry {
  const row = isRecord(value) ? value : {}

  return {
    sourceKey: asString(row.sourceKey, 'unknown'),
    sourceLabel: asString(row.sourceLabel, 'Unknown'),
    salesCount: asNumber(row.salesCount),
    salesAmount: asNumber(row.salesAmount),
    newDealsCount: asNumber(row.newDealsCount),
    newLeadsCount: asNumber(row.newLeadsCount),
  }
}

function normalizeDashboard(value: unknown): DashboardData {
  const data = isRecord(value) ? value : {}
  const salesOverview = isRecord(data.salesOverview) ? data.salesOverview : {}

  return {
    salesOverview: {
      salesCount: asNumber(salesOverview.salesCount),
      salesAmount: asNumber(salesOverview.salesAmount),
      averageSaleAmount: asNumber(salesOverview.averageSaleAmount),
      newDealsCount: asNumber(salesOverview.newDealsCount),
      conversionRate: asNumber(salesOverview.conversionRate),
      salesTimeline: asArray(salesOverview.salesTimeline, (point) => {
        const item = isRecord(point) ? point : {}
        return {
          date: asString(item.date),
          salesCount: asNumber(item.salesCount),
          salesAmount: asNumber(item.salesAmount),
        }
      }),
    },
    funnelSnapshot: asArray(data.funnelSnapshot, (entry) => {
      const item = isRecord(entry) ? entry : {}
      return {
        stageId: asString(item.stageId),
        stageName: asString(item.stageName, asString(item.stageId)),
        count: asNumber(item.count),
        amount: asNumber(item.amount),
      }
    }),
    sourceBreakdown: asArray(data.sourceBreakdown, normalizeSourceRow),
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
    defaultPeriodDays: asNumber(data.defaultPeriodDays, 30),
    lastSync: lastSync
      ? {
          finishedAt: asString(lastSync.finishedAt),
          leadsSynced: asNumber(lastSync.leadsSynced),
          dealsSynced: asNumber(lastSync.dealsSynced),
          mode: lastSync.mode === 'full' ? 'full' : 'delta',
        }
      : null,
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
    throw new ApiClientError('Local API request failed', response.status)
  }

  const data = (await response.json()) as unknown
  return normalize(data)
}

export const apiClient = {
  async getDashboard(periodDays: PeriodDays) {
    return requestJson(
      buildUrl('/api/dashboard', { periodDays }),
      { method: 'GET' },
      normalizeDashboard,
    )
  },
  async getMeta() {
    return requestJson(buildUrl('/api/meta'), { method: 'GET' }, normalizeMeta)
  },
  async triggerSync() {
    return requestJson(
      buildUrl('/api/sync'),
      { method: 'POST' },
      normalizeSyncSummary,
    )
  },
}

export { ApiClientError }
