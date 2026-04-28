import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { apiClient } from '@/lib/api-client'
import type { RevenueVelocityReport } from '@/lib/dashboard-types'

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
    getSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlan: vi.fn(async (input) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: [],
      updatedAt: '2026-04-10T12:05:00.000Z',
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
        routeNodes: [
          {
            step: 0,
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 10,
            shareOfCreatedDeals: 100,
          },
          {
            step: 1,
            stageId: 'MEETING',
            stageName: 'Встреча-знакомство',
            sortOrder: 2,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            step: 1,
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            sortOrder: 1,
            dealCount: 5,
            shareOfCreatedDeals: 50,
          },
          {
            step: 2,
            stageId: 'CONTRACT',
            stageName: 'Контрактация',
            sortOrder: 3,
            dealCount: 3,
            shareOfCreatedDeals: 30,
          },
        ],
        routeEdges: [
          {
            fromStep: 0,
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStep: 1,
            toStageId: 'MEETING',
            toStageName: 'Встреча-знакомство',
            dealCount: 5,
            conversionRate: 50,
          },
          {
            fromStep: 1,
            fromStageId: 'CALL',
            fromStageName: 'Звонок-знакомство',
            toStep: 2,
            toStageId: 'CONTRACT',
            toStageName: 'Контрактация',
            dealCount: 3,
            conversionRate: 60,
          },
        ],
      },
      comparisons: [],
    })),
    getRevenueVelocityReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      asOf: '2026-05-15T00:00:00.000Z',
      dimension: 'manager',
      actionWeights: {
        connectedCallOverThirtySeconds: 1,
        meeting: 3,
        conversionEvent: 5,
        closedTask: 0.5,
      },
      totals: {
        dimension: 'manager',
        key: 'total',
        label: 'Итого',
        managerId: null,
        managerName: null,
        sourceKey: null,
        sourceLabel: null,
        customerKey: null,
        customerLabel: null,
        createdDeals: 5,
        activeDeals: 4,
        wonDeals: 2,
        lostDeals: 1,
        wipDeals: 2,
        salesAmount: 300000,
        averageCheck: 150000,
        winRate: 0.4,
        averageCycleDays: 15,
        medianCycleDays: 15,
        revenueVelocityPerDay: 20000,
        actions: {
          totalCalls: 9,
          connectedCallsOverThirtySeconds: 4,
          meetingsCount: 3,
          conversionEventsCount: 0,
          createdTasks: 8,
          closedTasks: 5,
          weightedActionPoints: 15.5,
          weightedActionPointsPerDeal: 3.1,
          weightedActionPointsPerWin: 7.75,
        },
        moneyPerAction: {
          moneyPerMeeting: 100000,
          moneyPerConnectedCallOverThirtySeconds: 75000,
          moneyPerConversionEvent: null,
          moneyPerClosedTask: 60000,
          moneyPerWeightedActionPoint: 19354.84,
          actionEfficiencyIndex: 100,
        },
        bottleneckStageId: 'C10:DEMO',
        bottleneckStageName: 'Демонстрация',
        warnings: [
          'Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные на этапах Активация и Демонстрация.',
        ],
      },
      rows: [
        {
          dimension: 'manager',
          key: 'slow',
          label: 'Медленная строка',
          managerId: '91',
          managerName: 'Медленная строка',
          sourceKey: null,
          sourceLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 2,
          activeDeals: 2,
          wonDeals: 1,
          lostDeals: 0,
          wipDeals: 1,
          salesAmount: 50000,
          averageCheck: 50000,
          winRate: 0.5,
          averageCycleDays: 25,
          medianCycleDays: 25,
          revenueVelocityPerDay: 2000,
          actions: {
            totalCalls: 2,
            connectedCallsOverThirtySeconds: 1,
            meetingsCount: 1,
            conversionEventsCount: 0,
            createdTasks: 2,
            closedTasks: 1,
            weightedActionPoints: 4.5,
            weightedActionPointsPerDeal: 2.25,
            weightedActionPointsPerWin: 4.5,
          },
          moneyPerAction: {
            moneyPerMeeting: 50000,
            moneyPerConnectedCallOverThirtySeconds: 50000,
            moneyPerConversionEvent: null,
            moneyPerClosedTask: 50000,
            moneyPerWeightedActionPoint: 11111.11,
            actionEfficiencyIndex: 57.41,
          },
          bottleneckStageId: 'C10:DEMO',
          bottleneckStageName: 'Демонстрация',
          warnings: [],
        },
        {
          dimension: 'manager',
          key: 'fast',
          label: 'Быстрая строка',
          managerId: '78',
          managerName: 'Быстрая строка',
          sourceKey: null,
          sourceLabel: null,
          customerKey: null,
          customerLabel: null,
          createdDeals: 3,
          activeDeals: 2,
          wonDeals: 1,
          lostDeals: 1,
          wipDeals: 1,
          salesAmount: 250000,
          averageCheck: 250000,
          winRate: 0.33,
          averageCycleDays: 12,
          medianCycleDays: 12,
          revenueVelocityPerDay: 20833.33,
          actions: {
            totalCalls: 7,
            connectedCallsOverThirtySeconds: 3,
            meetingsCount: 2,
            conversionEventsCount: 0,
            createdTasks: 6,
            closedTasks: 4,
            weightedActionPoints: 11,
            weightedActionPointsPerDeal: 3.67,
            weightedActionPointsPerWin: 11,
          },
          moneyPerAction: {
            moneyPerMeeting: 125000,
            moneyPerConnectedCallOverThirtySeconds: 83333.33,
            moneyPerConversionEvent: null,
            moneyPerClosedTask: 62500,
            moneyPerWeightedActionPoint: 22727.27,
            actionEfficiencyIndex: 117.42,
          },
          bottleneckStageId: 'C10:ACTIVATION',
          bottleneckStageName: 'Активация',
          warnings: [],
        },
      ],
      formulaTooltips: [
        {
          key: 'revenueVelocityPerDay',
          label: 'Revenue Velocity',
          formula: 'Средний чек × Количество возможностей × Конверсия / Средний цикл сделки',
          description: 'Показывает денежную скорость.',
        },
      ],
      warnings: [
        'Конверсионные мероприятия пока не подключены. Колонка зарезервирована под будущие данные на этапах Активация и Демонстрация.',
      ],
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

function createEmptyRevenueVelocityReport(
  overrides: Partial<RevenueVelocityReport> = {},
): RevenueVelocityReport {
  const base: RevenueVelocityReport = {
    range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
    asOf: '2026-05-15T00:00:00.000Z',
    dimension: 'manager',
    actionWeights: {
      connectedCallOverThirtySeconds: 1,
      meeting: 3,
      conversionEvent: 5,
      closedTask: 0.5,
    },
    totals: {
      dimension: 'manager',
      key: 'total',
      label: 'Итого',
      createdDeals: 0,
      activeDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      wipDeals: 0,
      salesAmount: 0,
      averageCheck: null,
      winRate: null,
      averageCycleDays: null,
      medianCycleDays: null,
      revenueVelocityPerDay: null,
      actions: {
        totalCalls: 0,
        connectedCallsOverThirtySeconds: 0,
        meetingsCount: 0,
        conversionEventsCount: 0,
        createdTasks: 0,
        closedTasks: 0,
        weightedActionPoints: 0,
        weightedActionPointsPerDeal: null,
        weightedActionPointsPerWin: null,
      },
      moneyPerAction: {
        moneyPerMeeting: null,
        moneyPerConnectedCallOverThirtySeconds: null,
        moneyPerConversionEvent: null,
        moneyPerClosedTask: null,
        moneyPerWeightedActionPoint: null,
        actionEfficiencyIndex: null,
      },
      bottleneckStageId: null,
      bottleneckStageName: null,
      warnings: [],
    },
    rows: [],
    formulaTooltips: [],
    warnings: [],
    comparisons: [],
  }

  return { ...base, ...overrides }
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
    expect(screen.getByText(/карта маршрутов/i)).toBeInTheDocument()
    const routeMap = screen.getByRole('img', {
      name: /визуальная карта фактических переходов/i,
    })
    expect(routeMap).toBeInTheDocument()
    expect(Number.parseFloat(routeMap.style.width)).toBeGreaterThan(980)
    expect(screen.getByText(/1-й этап/i)).toBeInTheDocument()
    expect(screen.getByText(/2-й этап/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Звонок-знакомство -> Контрактация: 60% · 3 сдел/i),
    ).toBeInTheDocument()
  })

  it('renders the revenue velocity tab with KPI, sortable table, formula tooltip and conversion-event warning', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))

    expect(await screen.findByRole('heading', { name: /денежная скорость/i })).toBeInTheDocument()
    expect(screen.getByText('300 000 ₽')).toBeInTheDocument()
    expect(screen.getByText('20 000 ₽/день')).toBeInTheDocument()
    expect(
      screen.getAllByTitle(/Средний чек × Количество возможностей × Конверсия/i).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByText(/Конверсионные мероприятия пока не подключены/i),
    ).toBeInTheDocument()

    const fastRow = screen.getByText('Быстрая строка')
    const slowRow = screen.getByText('Медленная строка')
    expect(
      fastRow.compareDocumentPosition(slowRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Revenue Velocity, ₽\/день/i }))
    expect(
      slowRow.compareDocumentPosition(fastRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('shows an empty cohort state in the revenue velocity tab', async () => {
    vi.mocked(apiClient.getRevenueVelocityReport).mockResolvedValueOnce(
      createEmptyRevenueVelocityReport(),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))

    expect(await screen.findByText(/Нет сделок в выбранной когорте/i)).toBeInTheDocument()
  })

  it('shows a no-won-deals state in the revenue velocity tab', async () => {
    vi.mocked(apiClient.getRevenueVelocityReport).mockResolvedValueOnce(
      createEmptyRevenueVelocityReport({
        totals: {
          ...createEmptyRevenueVelocityReport().totals,
          createdDeals: 3,
          wipDeals: 3,
        },
        rows: [],
      }),
    )

    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /денежная скорость/i }))

    expect(
      await screen.findByText(/пока нет выигранных сделок/i),
    ).toBeInTheDocument()
  })
})
