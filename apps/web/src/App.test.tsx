import { fireEvent, render, screen } from '@testing-library/react'
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
      snapshotStats: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      syncHealth: {
        status: 'ready',
        blocking: false,
        checkedAt: '2026-04-10T12:00:00.000Z',
        lastSuccessfulSync: null,
        issues: [],
        warnings: [],
      },
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
      cohortMonths: [],
      cohortStatusRows: [],
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
      businessDays: 10,
      warnings: [],
      estimatedGainPerDay: null,
      rows: [
        {
          stageId: 'CALL',
          stageName: 'Звонок-знакомство',
          stageSemanticId: 'P',
          sortOrder: 1,
          enteredDeals: 10,
          movedNextDeals: 8,
          throughputPerDay: 1,
          queueEnd: 2,
          queueBufferDays: 2,
          averageStageDurationDays: 1.1,
        },
        {
          stageId: 'MEETING',
          stageName: 'Встреча-знакомство',
          stageSemanticId: 'P',
          sortOrder: 2,
          enteredDeals: 5,
          movedNextDeals: 4,
          throughputPerDay: 0.5,
          queueEnd: 1,
          queueBufferDays: 2,
          averageStageDurationDays: 1.4,
        },
        {
          stageId: 'CONTRACT',
          stageName: 'Контрактация',
          stageSemanticId: 'P',
          sortOrder: 3,
          enteredDeals: 3,
          movedNextDeals: 2,
          throughputPerDay: 0.3,
          queueEnd: 1,
          queueBufferDays: 3.3,
          averageStageDurationDays: 2.1,
        },
      ],
      bottleneck: {
        stageId: 'CONTRACT',
        stageName: 'Контрактация',
        throughputPerDay: 0.3,
        queueEnd: 1,
        queueBufferDays: 3.3,
      },
      stageDistribution: {
        totalCreatedDeals: 10,
        nodes: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 10,
            shareOfCreatedDeals: 100,
          },
          {
            stageId: 'MEETING',
            stageName: 'Встреча-знакомство',
            sortOrder: 2,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            stageId: 'CONTRACT',
            stageName: 'Контрактация',
            sortOrder: 3,
            dealCount: 3,
            shareOfCreatedDeals: 30,
          },
        ],
        edges: [
          {
            fromStageId: null,
            fromStageName: null,
            toStageId: 'CALL',
            toStageName: 'Звонок-знакомство',
            dealCount: 10,
            conversionRate: 100,
          },
          {
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStageId: 'MEETING',
            toStageName: 'Встреча-знакомство',
            dealCount: 5,
            conversionRate: 50,
          },
          {
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStageId: 'CONTRACT',
            toStageName: 'Контрактация',
            dealCount: 3,
            conversionRate: 30,
          },
        ],
      },
      comparisons: [],
    })),
    triggerSync: vi.fn(async () => ({
      syncRunId: 1,
      leadsSynced: 0,
      dealsSynced: 0,
      mode: 'delta',
      modifiedAfter: null,
      finishedAt: '2026-04-19T12:00:00.000Z',
      snapshotBefore: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      snapshotAfter: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
      },
      changes: {
        deals: 0,
        activities: 0,
        calls: 0,
        stageHistory: 0,
        managers: 0,
      },
      diagnostics: [],
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

  it('renders the prototype dashboard shell as the main app', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^comment mode$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/фильтры периода и среза/i),
    ).toBeInTheDocument()
  })

  it('renders factual stage distribution below the funnel throughput report', async () => {
    render(<App />)

    fireEvent.click(
      await screen.findByRole('button', { name: /движение по воронке/i }),
    )

    const throughput = await screen.findByText(/пропускная способность и очереди/i)
    const distribution = await screen.findByText(/распределение этапов воронки/i)

    expect(
      throughput.compareDocumentPosition(distribution) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByText(/Звонок-знакомство -> Контрактация/i),
    ).toBeInTheDocument()
  })
})
