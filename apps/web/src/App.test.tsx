import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMeta: vi.fn(async () => ({
      stageCatalog: [],
      managerCatalog: [],
      sourceCatalog: [],
      wonStageIds: [],
      defaultPeriodDays: 30,
      lastSync: null,
    })),
    getDashboard: vi.fn(async () => ({
      salesSummary: {
        salesCount: 0,
        salesAmount: 0,
        averageSaleAmount: 0,
        newDealsCount: 0,
        conversionRate: 0,
      },
      managerGroups: [],
      comparisons: [],
    })),
    getActivitiesWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })),
    getCallsWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCalls: 0,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 0,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 0,
      totalFailedCalls: 0,
      totalCallsOverThirtySeconds: 0,
      totalConnectedCallsOverThirtySeconds: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })),
    getAcquisitionOutcomesReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalNewDeals: 0,
      totalLostDeals: 0,
      newDealsByManager: [],
      lostDealsByManager: [],
      lostStages: [],
      businessClubByManager: [],
      topLossReasons: [],
      lostDealDetails: [],
      comparisons: [],
    })),
    getTargetGroupConversionReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 0,
      totalWonDeals: 0,
      rows: [],
      comparisons: [],
    })),
    getManagerActionOutcomeReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      rows: [],
      comparisons: [],
    })),
    getCohortConversionReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 0,
      totalClosedDeals: 0,
      totalWonDeals: 0,
      closureMonths: [],
      relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
      rows: [],
      comparisons: [],
    })),
    getTocFlowReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      businessDays: 0,
      warnings: [],
      estimatedGainPerDay: null,
      rows: [],
      bottleneck: null,
      comparisons: [],
    })),
  },
}))

function createResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (!init || init.method === 'GET') {
          return createResponse({ comments: [], updatedAt: null })
        }

        const next = JSON.parse(String(init.body)) as { comments: unknown[] }
        return createResponse({
          comments: next.comments,
          updatedAt: '2026-04-10T12:00:00.000Z',
        })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the prototype dashboard as the main app', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^comment mode$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/фильтры периода и среза/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /операционный стол привлечения/i })).not.toBeInTheDocument()
  })

  it('switches to the activity scene with the matrix hidden', async () => {
    render(<App />)

    await userEvent.click(
      await screen.findByRole('button', { name: /отчет активности/i }),
    )

    expect(
      screen.getByRole('heading', { name: /сводка по менеджерам/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /матрица активности/i })).not.toBeInTheDocument()
  })
})
