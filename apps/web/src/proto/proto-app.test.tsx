import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/lib/api-client'
import type {
  DealPricingRuleInput,
  SalesPlanInput,
  SalesPlanQuarterData,
  SalesPlanQuarterInput,
} from '@/lib/dashboard-types'
import { createCompareRange, ProtoApp } from '@/proto/proto-app'
import { createDefaultFilters } from '@/proto/scenes'

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
    getPricingSettings: vi.fn(async () => ({
      rules: [
        {
          id: 'clubfirst-federal',
          customerLabel: 'ClubFirst Russia / One',
          tariffLabel: 'Федеральный',
          attractionRevenueAmount: 300000,
          enabled: true,
          sortOrder: 10,
          updatedAt: null,
        },
      ],
      updatedAt: null,
    })),
    savePricingSettings: vi.fn(async (input: { rules: DealPricingRuleInput[] }) => ({
      rules: input.rules.map((rule: DealPricingRuleInput, index: number) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder ?? index * 10,
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlan: vi.fn(async (input: SalesPlanInput) => ({
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      rows: input.rows.map((row) => ({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        plannedDeals: row.plannedDeals,
        plannedAmount: row.plannedAmount,
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
      updatedAt: '2026-04-10T12:05:00.000Z',
    })),
    getEffectiveSalesPlan: vi.fn(async () => ({
      periodStart: '2026-04-20T00:00:00.000+03:00',
      periodEnd: '2026-04-26T23:59:59.999+03:00',
      rows: [],
      updatedAt: null,
    })),
    getSalesPlanQuarter: vi.fn(async () => ({
      year: 2026,
      quarter: 2,
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-06-30T23:59:59.999+03:00',
      months: [
        {
          month: '2026-04',
          label: 'Апрель',
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
        },
        {
          month: '2026-05',
          label: 'Май',
          periodStart: '2026-05-01T00:00:00.000+03:00',
          periodEnd: '2026-05-31T23:59:59.999+03:00',
        },
        {
          month: '2026-06',
          label: 'Июнь',
          periodStart: '2026-06-01T00:00:00.000+03:00',
          periodEnd: '2026-06-30T23:59:59.999+03:00',
        },
      ],
      rows: [],
      updatedAt: null,
    })),
    saveSalesPlanQuarter: vi.fn(async (input: SalesPlanQuarterInput) => ({
      year: input.year,
      quarter: input.quarter,
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-06-30T23:59:59.999+03:00',
      months: [
        {
          month: '2026-04',
          label: 'Апрель',
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
        },
        {
          month: '2026-05',
          label: 'Май',
          periodStart: '2026-05-01T00:00:00.000+03:00',
          periodEnd: '2026-05-31T23:59:59.999+03:00',
        },
        {
          month: '2026-06',
          label: 'Июнь',
          periodStart: '2026-06-01T00:00:00.000+03:00',
          periodEnd: '2026-06-30T23:59:59.999+03:00',
        },
      ],
      rows: input.rows.map((row) => ({
        managerId: row.managerId,
        managerName: row.managerName ?? null,
        targetGroupKey: row.targetGroupKey,
        targetGroupLabel: row.targetGroupLabel ?? row.targetGroupKey,
        quarterPlannedDeals: row.quarterPlannedDeals,
        quarterPlannedAmount: row.quarterPlannedAmount,
        months: row.months.map((month) => ({
          month: month.month,
          periodStart: `${month.month}-01T00:00:00.000+03:00`,
          periodEnd: `${month.month}-30T23:59:59.999+03:00`,
          plannedDeals: month.plannedDeals,
          plannedAmount: month.plannedAmount,
          updatedAt: '2026-04-10T12:05:00.000Z',
        })),
        updatedAt: '2026-04-10T12:05:00.000Z',
      })),
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
    getConversionEventsReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalInvitedCount: 0,
      totalAttendedCount: 0,
      totalRefusedCount: 0,
      totalMissedCount: 0,
      attendanceRate: null,
      nextStepEligibleCount: 0,
      nextStepCount: 0,
      nextStepRate: null,
      warnings: [],
      rows: [],
      comparisons: [],
    })),
    getCallsWorkloadReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCalls: 0,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 0,
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
      businessDays: 0,
      warnings: [],
      estimatedGainPerDay: null,
      rows: [],
      bottleneck: null,
      comparisons: [],
    })),
    getRevenueVelocityReport: vi.fn(async () => ({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      asOf: '2026-04-30T23:59:59.999Z',
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
    })),
    triggerSync: vi.fn(async () => ({
      syncRunId: 1,
      leadsSynced: 0,
      dealsSynced: 12,
      mode: 'delta',
      modifiedAfter: '2026-04-19T16:19:09.990Z',
      finishedAt: '2026-04-26T16:00:00.000Z',
      snapshotBefore: {
        deals: 10,
        activities: 20,
        calls: 30,
        stageHistory: 40,
      },
      snapshotAfter: {
        deals: 22,
        activities: 25,
        calls: 34,
        stageHistory: 45,
      },
      changes: {
        deals: 12,
        activities: 5,
        calls: 4,
        stageHistory: 5,
        managers: 1,
      },
      diagnostics: ['dealCursor=2026-04-26T16:00:00.000Z'],
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

function createQuarterSalesPlan(
  rows: SalesPlanQuarterData['rows'] = [],
): SalesPlanQuarterData {
  return {
    year: 2026,
    quarter: 2,
    periodStart: '2026-04-01T00:00:00.000+03:00',
    periodEnd: '2026-06-30T23:59:59.999+03:00',
    months: [
      {
        month: '2026-04',
        label: 'Апрель',
        periodStart: '2026-04-01T00:00:00.000+03:00',
        periodEnd: '2026-04-30T23:59:59.999+03:00',
      },
      {
        month: '2026-05',
        label: 'Май',
        periodStart: '2026-05-01T00:00:00.000+03:00',
        periodEnd: '2026-05-31T23:59:59.999+03:00',
      },
      {
        month: '2026-06',
        label: 'Июнь',
        periodStart: '2026-06-01T00:00:00.000+03:00',
        periodEnd: '2026-06-30T23:59:59.999+03:00',
      },
    ],
    rows,
    updatedAt: rows[0]?.updatedAt ?? null,
  }
}

describe('ProtoApp', () => {
  beforeEach(() => {
    vi.useRealTimers()
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
    vi.useRealTimers()
  })

  it('renders the prototype shell with comment mode controls', async () => {
    render(<ProtoApp />)

    expect(
      await screen.findByRole('heading', { name: /^pdca-дашборд метрик$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^comment mode$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/фильтры периода и среза/i)).toBeInTheDocument()
  })

  it('renders live sales by manager with deal details inside the prototype sales scene', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
        meetingsCount: 2,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-100',
              dealTitle: 'ООО Альфа',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: '3.1 Готов ко встрече',
              businessClubValue: 'ClubOne',
              targetGroupValue: 'ClubFirst',
              meetingTypeValue: 'Очная',
              tariffValue: 'Федеральный Москва',
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
              callSummary: {
                total: 8,
                incoming: 1,
                outgoing: 7,
                successful: 5,
                failed: 2,
                overThirtySeconds: 4,
                connectedOverThirtySeconds: 4,
              },
              taskSummary: {
                created: 6,
                closed: 5,
              },
              meetingSummary: {
                total: 2,
              },
              stageTimeline: [
                {
                  stageId: 'C10:CALL',
                  stageName: 'Звонок-знакомство',
                  enteredAt: '2026-03-13T10:00:00.000Z',
                  leftAt: '2026-03-14T10:00:00.000Z',
                  durationHours: 24,
                  meetingEvents: [
                    {
                      activityId: 'M-1',
                      createdAt: '2026-03-13T11:00:00.000Z',
                      timelineAt: '2026-03-13T11:00:00.000Z',
                      scheduledAt: '2026-03-14T16:00:00.000Z',
                      completed: false,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    const salesSection = (await screen.findByRole('heading', { name: /продажи по менеджерам/i }))
      .closest('section')
    expect(salesSection).not.toBeNull()

    expect(await within(salesSection!).findByText('Егоров Андрей')).toBeInTheDocument()
    expect(within(salesSection!).getByText('D-100')).toBeInTheDocument()
    expect(within(salesSection!).queryByText('ООО Альфа')).not.toBeInTheDocument()
    expect(within(salesSection!).getAllByText('1,3 млн').length).toBeGreaterThan(0)
    expect(within(salesSection!).getByText('29 д')).toBeInTheDocument()
    expect(within(salesSection!).getByText('8 всего')).toBeInTheDocument()
    expect(within(salesSection!).getByText('6 / 5')).toBeInTheDocument()
    expect(screen.getByLabelText('KPI продаж')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getByText('Встречи')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('Продажи по месяцам')).not.toBeInTheDocument()
    expect(screen.queryByText('Матрица по источникам')).not.toBeInTheDocument()
    expect(screen.queryByText('Точки конверсии')).not.toBeInTheDocument()
    expect(screen.queryByText('Давление воронки')).not.toBeInTheDocument()

    await userEvent.click(within(salesSection!).getByRole('button', { name: /подробнее/i }))

    expect(within(salesSection!).getByText('Когорта 2026-03')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Итоговое качество')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Источник')).toBeInTheDocument()
    expect(within(salesSection!).getByText('3.1 Готов ко встрече')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Сайт')).toBeInTheDocument()
    expect(within(salesSection!).getByText('ClubFirst')).toBeInTheDocument()
    expect(within(salesSection!).getByText('Федеральный Москва')).toBeInTheDocument()
    expect(within(salesSection!).getByText('2 встреч')).toBeInTheDocument()
    expect(within(salesSection!).getByText(/Встреча 13 мар/i)).toBeInTheDocument()
    expect(within(salesSection!).getByText('Звонок-знакомство')).toBeInTheDocument()
    expect(within(salesSection!).getByText('24 ч')).toBeInTheDocument()
  })

  it('edits a quarterly sales plan and compares effective plan with actual sales', async () => {
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 1_250_000,
        averageSaleAmount: 1_250_000,
        attractionRevenueAmount: 1_250_000,
        averageAttractionRevenueAmount: 1_250_000,
        membershipAmount: 1_250_000,
        averageMembershipAmount: 1_250_000,
        pricingWarnings: [],
        newDealsCount: 12,
        conversionRate: 8.33,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalWonDeals: 1,
          totalSalesAmount: 1_250_000,
          totalAttractionRevenueAmount: 1_250_000,
          averageAttractionRevenueAmount: 1_250_000,
          totalMembershipAmount: 1_250_000,
          averageMembershipAmount: 1_250_000,
          deals: [
            {
              dealId: 'D-100',
              dealTitle: 'ООО Альфа',
              managerId: '78',
              managerName: 'Егоров Андрей',
              amount: 1_250_000,
              attractionRevenueAmount: 1_250_000,
              membershipAmount: 1_250_000,
              pricingStatus: 'priced',
              pricingWarnings: [],
              dateCreate: '2026-03-12T09:00:00.000Z',
              dateClosed: '2026-04-10T15:00:00.000Z',
              cycleDays: 29,
              sourceKey: 'STORE',
              sourceLabel: 'Сайт',
              qualityValue: null,
              businessClubValue: 'ClubFirst Russia',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: null,
              tariffValue: null,
              cohortContext: {
                createdMonth: '2026-03',
                cohortCreatedDeals: 42,
                cohortWonDeals: 7,
                cohortWonConversionRate: 16.67,
              },
              callSummary: {
                total: 0,
                incoming: 0,
                outgoing: 0,
                successful: 0,
                failed: 0,
                overThirtySeconds: 0,
                connectedOverThirtySeconds: 0,
              },
              taskSummary: { created: 0, closed: 0 },
              meetingSummary: { total: 0 },
              stageTimeline: [],
            },
          ],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getEffectiveSalesPlan).mockResolvedValueOnce({
      periodStart: '2026-04-20T00:00:00.000+03:00',
      periodEnd: '2026-04-26T23:59:59.999+03:00',
      updatedAt: '2026-04-10T12:00:00.000Z',
      rows: [
        {
          periodStart: '2026-04-20T00:00:00.000+03:00',
          periodEnd: '2026-04-26T23:59:59.999+03:00',
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 2,
          plannedAmount: 1_166_667,
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ],
    })
    vi.mocked(apiClient.getSalesPlanQuarter).mockResolvedValueOnce(
      createQuarterSalesPlan([
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9_000_000,
          months: [
            {
              month: '2026-04',
              periodStart: '2026-04-01T00:00:00.000+03:00',
              periodEnd: '2026-04-30T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-05',
              periodStart: '2026-05-01T00:00:00.000+03:00',
              periodEnd: '2026-05-31T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
            {
              month: '2026-06',
              periodStart: '2026-06-01T00:00:00.000+03:00',
              periodEnd: '2026-06-30T23:59:59.999+03:00',
              plannedDeals: 3,
              plannedAmount: 3_000_000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-04-10T12:00:00.000Z',
        },
      ]),
    )

    render(<ProtoApp />)

    await waitFor(() => {
      expect(apiClient.getEffectiveSalesPlan).toHaveBeenCalledWith({
        from: '2026-04-20T00:00:00.000+03:00',
        to: '2026-04-26T23:59:59.999+03:00',
      })
    })

    const planFactHeading = await screen.findByRole('heading', {
      name: /план \/ факт продаж/i,
    })
    const planFactSection = planFactHeading.closest('section')
    expect(planFactSection).not.toBeNull()
    await waitFor(() => {
      expect(within(planFactSection as HTMLElement).getByText('ClubFirst Russia')).toBeInTheDocument()
      expect(within(planFactSection as HTMLElement).getAllByText('50%').length).toBeGreaterThan(0)
      expect(
        within(planFactSection as HTMLElement).getByText(/1 \/ 2 сделок/i),
      ).toBeInTheDocument()
    })

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))

    expect(await screen.findByRole('heading', { name: /^План продаж$/i })).toBeInTheDocument()
    expect(screen.getByText('2 квартал 2026')).toBeInTheDocument()
    expect(screen.getAllByText('Доход, млн ₽').length).toBeGreaterThan(0)
    expect(screen.queryByText('Апрель доход')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Таргет-группа 1').tagName).toBe('SELECT')
    expect(
      screen.getByLabelText('Квартальный план дохода, млн ₽ Егоров Андрей ClubFirst Russia'),
    ).toHaveValue(9)
    const quarterDealsInput = screen.getByLabelText(
      'Квартальный план сделок Егоров Андрей ClubFirst Russia',
    )
    await userEvent.clear(quarterDealsInput)
    await userEvent.type(quarterDealsInput, '10')
    expect(screen.getAllByText(/Сумма месяцев не равна квартальному плану/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /сохранить план/i })).toBeDisabled()

    const aprilDealsInput = screen.getByLabelText(
      'План сделок Апрель Егоров Андрей ClubFirst Russia',
    )
    await userEvent.clear(aprilDealsInput)
    await userEvent.type(aprilDealsInput, '4')
    await waitFor(() => {
      expect(screen.queryByText(/Сумма месяцев не равна квартальному плану/i)).not.toBeInTheDocument()
    })
    await userEvent.click(screen.getByRole('button', { name: /сохранить план/i }))

    await waitFor(() => {
      expect(apiClient.saveSalesPlanQuarter).toHaveBeenCalledWith({
        year: 2026,
        quarter: 2,
        rows: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            targetGroupKey: 'ClubFirst Russia',
            targetGroupLabel: 'ClubFirst Russia',
            quarterPlannedDeals: 10,
            quarterPlannedAmount: 9_000_000,
            months: [
              { month: '2026-04', plannedDeals: 4, plannedAmount: 3_000_000 },
              { month: '2026-05', plannedDeals: 3, plannedAmount: 3_000_000 },
              { month: '2026-06', plannedDeals: 3, plannedAmount: 3_000_000 },
            ],
          },
        ],
      })
    })
  })

  it('offers target-group choices for the first quarterly plan even when the report slice is empty', async () => {
    vi.mocked(apiClient.getSalesPlanQuarter).mockResolvedValueOnce(createQuarterSalesPlan())

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))

    const targetGroupSelect = await screen.findByLabelText('Таргет-группа 1')
    expect(
      within(targetGroupSelect).getByRole('option', { name: 'ClubFirst Russia' }),
    ).toBeInTheDocument()
  })

  it('does not allow saving the previous quarter plan while another quarter is loading', async () => {
    let resolveNextPlan: (value: Awaited<ReturnType<typeof apiClient.getSalesPlanQuarter>>) => void =
      () => undefined
    const nextPlanPromise = new Promise<Awaited<ReturnType<typeof apiClient.getSalesPlanQuarter>>>(
      (resolve) => {
        resolveNextPlan = resolve
      },
    )

    vi.mocked(apiClient.getSalesPlanQuarter)
      .mockResolvedValueOnce(
        createQuarterSalesPlan([
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            targetGroupKey: 'ClubFirst Russia',
            targetGroupLabel: 'ClubFirst Russia',
            quarterPlannedDeals: 9,
            quarterPlannedAmount: 9_000_000,
            months: [
              {
                month: '2026-04',
                periodStart: '2026-04-01T00:00:00.000+03:00',
                periodEnd: '2026-04-30T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
              {
                month: '2026-05',
                periodStart: '2026-05-01T00:00:00.000+03:00',
                periodEnd: '2026-05-31T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
              {
                month: '2026-06',
                periodStart: '2026-06-01T00:00:00.000+03:00',
                periodEnd: '2026-06-30T23:59:59.999+03:00',
                plannedDeals: 3,
                plannedAmount: 3_000_000,
                updatedAt: '2026-04-10T12:00:00.000Z',
              },
            ],
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        ]),
      )
      .mockImplementationOnce(async () => nextPlanPromise)

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^План продаж$/i }))
    expect(
      await screen.findByLabelText('Квартальный план сделок Егоров Андрей ClubFirst Russia'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /следующий квартал/i }))

    await waitFor(() => {
      expect(apiClient.getSalesPlanQuarter).toHaveBeenLastCalledWith({
        year: 2026,
        quarter: 3,
      })
    })
    expect(screen.getByRole('button', { name: /загружаю план/i })).toBeDisabled()
    expect(
      screen.queryByLabelText('Квартальный план сделок Егоров Андрей ClubFirst Russia'),
    ).not.toBeInTheDocument()

    resolveNextPlan({
      ...createQuarterSalesPlan(),
      quarter: 3,
      periodStart: '2026-07-01T00:00:00.000+03:00',
      periodEnd: '2026-09-30T23:59:59.999+03:00',
      months: [
        {
          month: '2026-07',
          label: 'Июль',
          periodStart: '2026-07-01T00:00:00.000+03:00',
          periodEnd: '2026-07-31T23:59:59.999+03:00',
        },
        {
          month: '2026-08',
          label: 'Август',
          periodStart: '2026-08-01T00:00:00.000+03:00',
          periodEnd: '2026-08-31T23:59:59.999+03:00',
        },
        {
          month: '2026-09',
          label: 'Сентябрь',
          periodStart: '2026-09-01T00:00:00.000+03:00',
          periodEnd: '2026-09-30T23:59:59.999+03:00',
        },
      ],
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /сохранить план/i })).toBeEnabled()
    })
  })

  it('moves the action-to-result block to cohorts without compare subrows', async () => {
    vi.mocked(apiClient.getTargetGroupConversionReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalCreatedDeals: 3,
      totalWonDeals: 2,
      rows: [
        {
          targetGroupKey: 'ClubFirst',
          targetGroupLabel: 'ClubFirst',
          createdDeals: 2,
          wonDeals: 1,
          winRate: 0.5,
          salesAmount: 120000,
          averageSaleAmount: 120000,
          averageCycleDays: 10,
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            totalCreatedDeals: 2,
            totalWonDeals: 1,
            rows: [
              {
                targetGroupKey: 'ClubFirst',
                targetGroupLabel: 'ClubFirst',
                createdDeals: 1,
                wonDeals: 1,
                winRate: 1,
                salesAmount: 90000,
                averageSaleAmount: 90000,
                averageCycleDays: 8,
              },
            ],
          },
        },
      ],
    })
    vi.mocked(apiClient.getManagerActionOutcomeReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      warnings: [],
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          createdTasks: 5,
          closedTasks: 4,
          totalCalls: 10,
          successfulCallsOverThirtySeconds: 6,
          meetingsCount: 2,
          sla1OnTimeCount: 2,
          sla1LateCount: 0,
          sla1NoTouchCount: 0,
          sla1MedianHours: 1.5,
          sla2OnTimeCount: 2,
          sla2LateCount: 0,
          sla2NoTouchCount: 0,
          sla2MedianHours: 3,
          sla3OnTimeCount: 1,
          sla3LateCount: 1,
          sla3NoTouchCount: 0,
          sla3MedianHours: 5,
          newDealsCount: 3,
          wonDealsCount: 1,
          winRate: 0.3333,
          salesAmount: 120000,
          averageSaleAmount: 120000,
          averageCycleDays: 10,
        },
      ],
      cohortMonths: [
        { cohortMonth: '2026-04', cohortLabel: '2026-04', totalCreatedDeals: 3 },
      ],
      cohortStatusRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'won',
          statusLabel: 'Выиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 1,
          totalCallsPerDeal: 2,
          successfulCallsOverThirtySecondsPerDeal: 2,
          meetingsPerDeal: 1,
          sla1OnTimeRate: 1,
          sla2OnTimeRate: 1,
          sla3OnTimeRate: 1,
          financialAmount: 120000,
          averageFinancialAmount: 120000,
          dealDetails: [
            {
              dealId: 'D1',
              stageId: 'C10:WON',
              stageName: 'Передано в клуб',
              amount: 120000,
              dateCreate: '2026-04-01T10:00:00.000Z',
              dateClosed: '2026-04-04T10:00:00.000Z',
              dateModify: '2026-04-04T10:00:00.000Z',
              sourceKey: 'WEB',
              sourceLabel: 'Сайт',
              qualityValue: '2 Пришёл на мероприятие',
              businessClubValue: 'ClubFirst One',
              targetGroupValue: 'ClubFirst Russia',
              meetingTypeValue: 'Мероприятие',
              tariffValue: 'Федеральный Москва',
              taskSummary: { created: 1, closed: 1 },
              callSummary: {
                total: 2,
                incoming: 0,
                outgoing: 2,
                successful: 2,
                failed: 0,
                overThirtySeconds: 2,
                connectedOverThirtySeconds: 2,
              },
              meetingSummary: { total: 1 },
              sla: {
                sla1: { status: 'onTime', hours: 1 },
                sla2: { status: 'onTime', hours: 2 },
                sla3: { status: 'onTime', hours: 3 },
              },
              stageTimeline: [
                {
                  stageId: 'C10:WON',
                  stageName: 'Передано в клуб',
                  enteredAt: '2026-04-04T10:00:00.000Z',
                  leftAt: '2026-04-04T10:00:00.000Z',
                  durationHours: 0,
                  meetingEvents: [],
                },
              ],
            },
          ],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'lost',
          statusLabel: 'Проиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 0,
          totalCallsPerDeal: 1,
          successfulCallsOverThirtySecondsPerDeal: 0,
          meetingsPerDeal: 0,
          sla1OnTimeRate: 0,
          sla2OnTimeRate: 0,
          sla3OnTimeRate: 0,
          financialAmount: 50000,
          averageFinancialAmount: 50000,
          dealDetails: [],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: null,
          statusKey: 'wip',
          statusLabel: 'В работе сейчас',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 0,
          closedTasksPerDeal: 0,
          totalCallsPerDeal: 0,
          successfulCallsOverThirtySecondsPerDeal: 0,
          meetingsPerDeal: 0,
          sla1OnTimeRate: 0,
          sla2OnTimeRate: 0,
          sla3OnTimeRate: 0,
          financialAmount: 70000,
          averageFinancialAmount: 70000,
          dealDetails: [],
        },
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          cohortMonth: '2026-04',
          statusKey: 'won',
          statusLabel: 'Выиграно',
          cohortCreatedDeals: 3,
          dealCount: 1,
          statusShare: 0.3333,
          createdTasksPerDeal: 1,
          closedTasksPerDeal: 1,
          totalCallsPerDeal: 2,
          successfulCallsOverThirtySecondsPerDeal: 2,
          meetingsPerDeal: 1,
          sla1OnTimeRate: 1,
          sla2OnTimeRate: 1,
          sla3OnTimeRate: 1,
          financialAmount: 120000,
          averageFinancialAmount: 120000,
          dealDetails: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            warnings: [],
            rows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                createdTasks: 4,
                closedTasks: 3,
                totalCalls: 8,
                successfulCallsOverThirtySeconds: 5,
                meetingsCount: 1,
                sla1OnTimeCount: 1,
                sla1LateCount: 1,
                sla1NoTouchCount: 0,
                sla1MedianHours: 2,
                sla2OnTimeCount: 1,
                sla2LateCount: 1,
                sla2NoTouchCount: 0,
                sla2MedianHours: 4,
                sla3OnTimeCount: 1,
                sla3LateCount: 0,
                sla3NoTouchCount: 0,
                sla3MedianHours: 4,
                newDealsCount: 2,
                wonDealsCount: 1,
                winRate: 0.5,
                salesAmount: 90000,
                averageSaleAmount: 90000,
                averageCycleDays: 8,
              },
            ],
            cohortMonths: [],
            cohortStatusRows: [],
          },
        },
      ],
    })

    render(<ProtoApp />)

    await screen.findByRole('heading', { name: /продажи по менеджерам/i })
    expect(screen.queryByRole('heading', { name: /действия → результат/i })).not.toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /когортный отчет/i }))

    const actionHeading = await screen.findByRole('heading', { name: /действия → результат/i })
    const actionSection = actionHeading.closest('section')

    expect(screen.queryByRole('heading', { name: /конверсия по таргет-группам/i })).not.toBeInTheDocument()
    expect(actionSection).not.toBeNull()
    expect(within(actionSection as HTMLElement).getAllByText('Егоров Андрей')).toHaveLength(1)
    expect(within(actionSection as HTMLElement).getByText('Все когорты')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('2026-04')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getAllByText('В работе сейчас').length).toBeGreaterThan(0)
    expect(within(actionSection as HTMLElement).getAllByRole('row')).toHaveLength(4)
    expect(within(actionSection as HTMLElement).getByText('SLA on-time')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).queryByText(/^С1:/)).not.toBeInTheDocument()

    await userEvent.click(
      within(actionSection as HTMLElement).getByRole('button', {
        name: /раскрыть статус выиграно/i,
      }),
    )
    expect(within(actionSection as HTMLElement).getByText('ID D1')).toBeInTheDocument()

    await userEvent.click(within(actionSection as HTMLElement).getByRole('button', { name: 'Подробнее' }))
    expect(within(actionSection as HTMLElement).getByText('Атрибуты сделки')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('2 Пришёл на мероприятие')).toBeInTheDocument()
    expect(within(actionSection as HTMLElement).getByText('Передано в клуб')).toBeInTheDocument()
  })

  it('keeps the manager filter prebuilt to the attraction team fallback list', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /^Менеджеры$/i }))

    expect(screen.getByText('Егоров Андрей')).toBeInTheDocument()
    expect(screen.getByText('Каньков Вячеслав')).toBeInTheDocument()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
  })

  it('defaults the main range and added compare ranges to sequential previous calendar weeks', () => {
    const filters = createDefaultFilters(new Date('2026-04-19T12:00:00+03:00'))
    const firstCompare = createCompareRange(filters)
    const secondCompare = createCompareRange({
      ...filters,
      compareRanges: [firstCompare],
    })

    expect(filters.rangeStart).toBe('2026-04-06')
    expect(filters.rangeEnd).toBe('2026-04-12')
    expect(firstCompare).toEqual(
      expect.objectContaining({ start: '2026-03-30', end: '2026-04-05' }),
    )
    expect(secondCompare).toEqual(
      expect.objectContaining({ start: '2026-03-23', end: '2026-03-29' }),
    )
  })

  it('creates and persists a comment pin at the clicked coordinate', async () => {
    render(<ProtoApp />)

    await userEvent.click(screen.getByRole('button', { name: /^comment mode$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(shell, { clientX: 100, clientY: 200 })

    const textarea = screen.getByPlaceholderText(/комментарий к точке интерфейса/i)
    await userEvent.type(textarea, 'Проверка точки')
    await userEvent.click(screen.getByRole('button', { name: /^сохранить$/i }))

    const pin = await screen.findByRole('button', { name: /^Комментарий 1$/ })
    expect(pin).toHaveStyle({ left: '10%', top: '20%' })

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/комментарий к точке интерфейса/i)).toBeDisabled()
    })
  })

  it('allows comment pins on the filter panel chrome without blocking form controls', async () => {
    render(<ProtoApp />)

    await userEvent.click(screen.getByRole('button', { name: /^comment mode$/i }))

    const shell = screen.getByRole('presentation')
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 1000,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.click(screen.getByText(/фильтры периода и среза/i), {
      clientX: 180,
      clientY: 90,
    })

    expect(screen.getByPlaceholderText(/комментарий к точке интерфейса/i)).not.toBeDisabled()
  })

  it('keeps disabled deadline-reschedule UI hidden in the activity report', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [
        'Deadline reschedule counts are disabled until a trustworthy Bitrix history source is available.',
      ],
      managerRows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    await screen.findByRole('heading', { name: /сводка по менеджерам/i })
    await waitFor(() => {
      expect(apiClient.getActivitiesWorkloadReport).toHaveBeenCalled()
    })

    expect(screen.queryByRole('heading', { name: /матрица активности/i })).not.toBeInTheDocument()
    expect(screen.getAllByText('Создано задач').length).toBeGreaterThan(0)
    expect(screen.queryByText('Перенесён дедлайн')).not.toBeInTheDocument()
    expect(screen.queryByText(/Deadline reschedule counts are disabled/i)).not.toBeInTheDocument()
  })

  it('shows a sales error state instead of an empty sales report when live loading fails', async () => {
    vi.mocked(apiClient.getDashboard).mockRejectedValueOnce(new Error('Тестовый сбой live-данных'))

    render(<ProtoApp />)

    expect(
      await screen.findAllByText('Тестовый сбой live-данных'),
    ).toHaveLength(2)
    expect(
      screen.queryByText('В выбранном периоде нет выигранных сделок.'),
    ).not.toBeInTheDocument()
  })

  it('uses the refresh button to synchronize Bitrix without applying draft filters', async () => {
    render(<ProtoApp />)

    expect(await screen.findByText('В выбранном периоде нет выигранных сделок.')).toBeInTheDocument()
    vi.mocked(apiClient.getDashboard).mockClear()

    const dateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]')
    fireEvent.change(dateInputs[0]!, { target: { value: '2026-01-01' } })

    await userEvent.click(screen.getByRole('button', { name: /^обновить данные$/i }))

    await waitFor(() => expect(apiClient.triggerSync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(apiClient.getDashboard).toHaveBeenCalled())

    const [query] = vi.mocked(apiClient.getDashboard).mock.calls.at(-1)!
    expect(query.preset).toBe('custom')
    expect('from' in query ? query.from : '').not.toContain('2026-01-01')
  })

  it('loads cached operational reports while warning that sync health is stale', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
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
        status: 'blocked',
        blocking: true,
        checkedAt: '2026-04-10T12:00:00.000Z',
        lastSuccessfulSync: null,
        issues: [
          {
            code: 'MISSING_COVERAGE',
            severity: 'blocking',
            message: 'Нет подтвержденного покрытия локального snapshot.',
          },
        ],
        warnings: ['Нет подтвержденного покрытия локального snapshot.'],
      },
    })
    vi.mocked(apiClient.getDashboard).mockResolvedValueOnce({
      salesSummary: {
        salesCount: 1,
        salesAmount: 940_000,
        averageSaleAmount: 940_000,
        attractionRevenueAmount: 940_000,
        averageAttractionRevenueAmount: 940_000,
        membershipAmount: 940_000,
        averageMembershipAmount: 940_000,
        pricingWarnings: [],
        newDealsCount: 66,
        conversionRate: 0,
        meetingsCount: 1,
      },
      managerGroups: [
        {
          managerId: '78',
          managerName: 'Потапова Мария',
          totalWonDeals: 1,
          totalSalesAmount: 940_000,
          totalAttractionRevenueAmount: 940_000,
          averageAttractionRevenueAmount: 940_000,
          totalMembershipAmount: 940_000,
          averageMembershipAmount: 940_000,
          deals: [],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    expect(
      (await screen.findAllByText('Нет подтвержденного покрытия локального snapshot.')).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText('Потапова Мария')).toBeInTheDocument()
    expect(within(screen.getByLabelText('KPI продаж')).getAllByText('1').length).toBeGreaterThan(0)
    expect(apiClient.getDashboard).toHaveBeenCalled()
    expect(apiClient.getCallsWorkloadReport).toHaveBeenCalled()
    expect(screen.queryByText(/live-данные недоступны/i)).not.toBeInTheDocument()
  })

  it('keeps scene filter signatures bound to applied filters until the user applies draft changes', async () => {
    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /когортный отчет/i }))

    const cohortSection = (await screen.findByRole('heading', { name: /когортная матрица/i }))
      .closest('section')
    expect(cohortSection).not.toBeNull()
    expect(
      within(cohortSection as HTMLElement).getByText('Срез: все менеджеры / все источники'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Менеджеры$/i }))
    await userEvent.click(screen.getByText('Егоров Андрей'))

    expect(
      within(cohortSection as HTMLElement).getByText('Срез: все менеджеры / все источники'),
    ).toBeInTheDocument()
    expect(screen.getByText(/менеджеры: егоров андрей/i)).toBeInTheDocument()
  })

  it('does not render prototype fallback activity data after an operational live error', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockRejectedValueOnce(
      new Error('Отчёт активности недоступен'),
    )

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    expect(await screen.findByText('Отчёт активности недоступен')).toBeInTheDocument()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
    expect(screen.queryByText('486')).not.toBeInTheDocument()
  })

  it('renders attraction deal outcome blocks below the activity manager summary', async () => {
    vi.mocked(apiClient.getAcquisitionOutcomesReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalNewDeals: 3,
      totalLostDeals: 4,
      newDealsByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalNewDeals: 2,
          sources: [
            {
              sourceKey: 'WEB',
              sourceLabel: 'Сайт',
              totalNewDeals: 2,
              qualities: [
                { qualityKey: 'Готов ко встрече', qualityLabel: 'Готов ко встрече', count: 2 },
              ],
            },
          ],
        },
      ],
      lostDealsByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalLostDeals: 4,
          stages: [
            { stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 },
            { stageId: 'C10:RETURN', stageName: 'Возврат в Лидген(неквал)', count: 2 },
          ],
        },
      ],
      lostStages: [
        { stageId: 'C10:LOSE', stageName: 'Корзина', count: 2 },
        { stageId: 'C10:RETURN', stageName: 'Возврат в Лидген(неквал)', count: 2 },
      ],
      businessClubByManager: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          totalDeals: 4,
          businessClubs: [
            { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', count: 3 },
            { businessClubKey: 'ClubTwo', businessClubLabel: 'ClubTwo', count: 1 },
          ],
          targetGroups: [
            { targetGroupKey: 'ClubFirst', targetGroupLabel: 'ClubFirst', count: 3 },
            { targetGroupKey: 'ClubFuture', targetGroupLabel: 'ClubFuture', count: 1 },
          ],
        },
      ],
      topLossReasons: [
        {
          stageId: 'C10:LOSE',
          stageName: 'Корзина',
          managerId: '78',
          managerName: 'Егоров Андрей',
          reasonKey: 'Клиенту не интересен формат',
          reasonLabel: 'Клиенту не интересен формат',
          count: 2,
        },
        {
          stageId: 'C10:RETURN',
          stageName: 'Возврат в Лидген(неквал)',
          managerId: '78',
          managerName: 'Егоров Андрей',
          reasonKey: 'Не соответствует критериям',
          reasonLabel: 'Не соответствует критериям',
          count: 2,
        },
      ],
      lostDealDetails: [
        {
          dealId: 'D-4',
          managerId: '78',
          managerName: 'Егоров Андрей',
          sourceKey: 'WEB',
          sourceLabel: 'Сайт',
          businessClubValue: 'ClubTwo',
          stageId: 'C10:RETURN',
          stageName: 'Возврат в Лидген(неквал)',
          reasonKey: 'Не соответствует критериям',
          reasonLabel: 'Не соответствует критериям',
          reasonDetail: 'Нет совпадения по профилю',
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    const outcomesSection = await screen.findByRole('heading', { name: /сделки и потери/i })
    expect(outcomesSection).toBeInTheDocument()
    const newDealsBlock = screen.getByText('Новые сделки').closest('article')
    const lostDealsBlock = screen.getByText('Проигранные сделки').closest('article')

    expect(newDealsBlock).not.toBeNull()
    expect(lostDealsBlock).not.toBeNull()
    expect(within(newDealsBlock as HTMLElement).getByText('Готов ко встрече')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getAllByText('Корзина').length).toBeGreaterThan(0)
    expect(within(lostDealsBlock as HTMLElement).getAllByText('Возврат в Лидген(неквал)').length).toBeGreaterThan(0)
    expect(within(lostDealsBlock as HTMLElement).getByText('Клиенту не интересен формат')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByText('Не соответствует критериям')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByText('Причины по стадиям')).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByRole('columnheader', { name: 'Стадия' })).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getByRole('columnheader', { name: 'Причины' })).toBeInTheDocument()
    expect(within(lostDealsBlock as HTMLElement).getAllByRole('columnheader', { name: 'Потери' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /drill-down потерь/i })).toBeInTheDocument()
    const businessClubHeading = screen.getByRole('heading', { name: /нагрузка по заказчикам/i })
    const businessClubSection = businessClubHeading.closest('section')

    expect(businessClubSection).not.toBeNull()
    expect(within(businessClubSection as HTMLElement).getByRole('columnheader', { name: 'Бизнес-клуб заказчика' })).toBeInTheDocument()
    expect(within(businessClubSection as HTMLElement).getByRole('columnheader', { name: 'Таргет-группа' })).toBeInTheDocument()
    expect(within(businessClubSection as HTMLElement).getAllByText('ClubTwo').length).toBeGreaterThan(0)
    expect(within(businessClubSection as HTMLElement).getAllByText('ClubFuture').length).toBeGreaterThan(0)
  })

  it('renders meetings and SLA blocks in the activity scene', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 2,
      totalCreatedCount: 4,
      totalRescheduledCount: 0,
      totalClosedCount: 3,
      totalMeetingCount: 2,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 2,
          createdCount: 4,
          rescheduledCount: 0,
          closedCount: 3,
          meetingCount: 2,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.5,
          averageMeetingsPerDeal: 1,
          meetingTypeBreakdown: [
            { meetingTypeKey: 'Очная', meetingTypeLabel: 'Очная', count: 2 },
          ],
          businessClubBreakdown: [
            { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', dealCount: 2 },
          ],
          meetingBusinessClubBreakdown: [
            {
              businessClubKey: 'ClubOne',
              businessClubLabel: 'ClubOne',
              meetingTypeKey: 'Очная',
              meetingTypeLabel: 'Очная',
              count: 2,
            },
          ],
          slaMetrics: [
            {
              slaKey: 'sla1',
              label: 'Время в работу',
              onTimeCount: 2,
              lateCount: 0,
              noTouchCount: 0,
              medianHours: 1.5,
            },
          ],
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getConversionEventsReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalInvitedCount: 5,
      totalAttendedCount: 2,
      totalRefusedCount: 1,
      totalMissedCount: 3,
      attendanceRate: 40,
      nextStepEligibleCount: 2,
      nextStepCount: 1,
      nextStepRate: 50,
      warnings: [],
      rows: [
        {
          eventKey: 'club-2026-04-29',
          eventName: 'Знакомство с клубом 29.04.',
          eventDate: '2026-04-29T00:00:00.000Z',
          invitedCount: 5,
          attendedCount: 2,
          refusedCount: 1,
          missedCount: 3,
          attendanceRate: 40,
          nextStepEligibleCount: 2,
          nextStepCount: 1,
          nextStepRate: 50,
          unlinkedCount: 0,
          unknownStatusCount: 0,
          managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 5 }],
          sourceBreakdown: [{ key: 'WEB', label: 'Веб', count: 5 }],
          businessClubBreakdown: [{ key: 'ClubOne', label: 'ClubOne', count: 5 }],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const meetingsHeading = await screen.findByRole('heading', { name: /встречи/i })
    const meetingsSection = meetingsHeading.closest('section')

    expect(meetingsSection).not.toBeNull()
    expect(within(meetingsSection as HTMLElement).queryByRole('columnheader', { name: /на сделку/i })).not.toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByRole('columnheader', { name: /клуб \/ тип встречи/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^sla$/i })).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('ClubOne')).toBeInTheDocument()
    expect(within(meetingsSection as HTMLElement).getByText('Очная')).toBeInTheDocument()
    const conversionHeading = screen.getByRole('heading', { name: /конверсионные мероприятия/i })
    const conversionSection = conversionHeading.closest('section')

    expect(conversionSection).not.toBeNull()
    expect(within(conversionSection as HTMLElement).getByText('Знакомство с клубом 29.04.')).toBeInTheDocument()
    expect(within(conversionSection as HTMLElement).getByRole('columnheader', { name: /доходимость/i })).toBeInTheDocument()
    expect(within(conversionSection as HTMLElement).getByText('40%')).toBeInTheDocument()
    expect(within(conversionSection as HTMLElement).getByText('50%')).toBeInTheDocument()
    expect(screen.queryByText('Данные появятся после настройки.')).not.toBeInTheDocument()
    expect(screen.getByText(/on-time 2/i)).toBeInTheDocument()
  })

  it('renders conversion events table in the activity scene without client names', async () => {
    vi.mocked(apiClient.getConversionEventsReport).mockResolvedValueOnce({
      range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
      totalInvitedCount: 10,
      totalAttendedCount: 6,
      totalRefusedCount: 2,
      totalMissedCount: 4,
      attendanceRate: 60,
      nextStepEligibleCount: 6,
      nextStepCount: 3,
      nextStepRate: 50,
      warnings: [],
      rows: [
        {
          eventKey: '2026-04-29::Знакомство с клубом 29.04.',
          eventName: 'Знакомство с клубом 29.04.',
          eventDate: '2026-04-29T00:00:00.000Z',
          invitedCount: 10,
          attendedCount: 6,
          refusedCount: 2,
          missedCount: 4,
          attendanceRate: 60,
          nextStepEligibleCount: 6,
          nextStepCount: 3,
          nextStepRate: 50,
          unlinkedCount: 0,
          unknownStatusCount: 0,
          managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 6 }],
          sourceBreakdown: [{ key: 'WEB', label: 'Веб', count: 6 }],
          businessClubBreakdown: [{ key: 'ClubOne', label: 'ClubOne', count: 6 }],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))

    const section = await screen.findByRole('heading', {
      name: /конверсионные мероприятия/i,
    })
    expect(section).toBeInTheDocument()
    expect(screen.getByText('Знакомство с клубом 29.04.')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === '3 / 6 · 50%'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /детали мероприятия/i }))
    expect(screen.getByText('Егоров Андрей')).toBeInTheDocument()
    expect(screen.getByText('Веб')).toBeInTheDocument()
    expect(screen.getByText('ClubOne')).toBeInTheDocument()
    expect(screen.queryByText(/Омаров/i)).not.toBeInTheDocument()
  })

  it('renders stable manager leaders in the funnel-flow scene', async () => {
    vi.mocked(apiClient.getMeta).mockResolvedValueOnce({
      stageCatalog: [],
      managerCatalog: [
        { id: '78', name: 'Егоров Андрей' },
        { id: '11234', name: 'Ромашова Ольга' },
      ],
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
    })
    vi.mocked(apiClient.getTocFlowReport)
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 20,
            movedNextDeals: 12,
            throughputPerDay: 0.5,
            queueEnd: 8,
            queueBufferDays: 16,
            averageStageDurationDays: 4,
          },
        ],
        bottleneck: null,
        comparisons: [],
      })
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 8,
            movedNextDeals: 5,
            throughputPerDay: 0,
            queueEnd: 0,
            queueBufferDays: null,
            averageStageDurationDays: 0,
          },
        ],
        bottleneck: null,
        comparisons: [
          {
            compareIndex: 1,
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            snapshot: {
              range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
              rows: [
                {
                  stageId: 'CALL',
                  stageName: 'Звонок-знакомство',
                  stageSemanticId: null,
                  sortOrder: 10,
                  enteredDeals: 9,
                  movedNextDeals: 6,
                  throughputPerDay: 0,
                  queueEnd: 0,
                  queueBufferDays: null,
                  averageStageDurationDays: 0,
                },
              ],
              bottleneck: null,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        range: { from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 7,
            movedNextDeals: 6,
            throughputPerDay: 0,
            queueEnd: 0,
            queueBufferDays: null,
            averageStageDurationDays: 0,
          },
        ],
        bottleneck: null,
        comparisons: [
          {
            compareIndex: 1,
            range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
            snapshot: {
              range: { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T23:59:59.999Z' },
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
              rows: [
                {
                  stageId: 'CALL',
                  stageName: 'Звонок-знакомство',
                  stageSemanticId: null,
                  sortOrder: 10,
                  enteredDeals: 8,
                  movedNextDeals: 6,
                  throughputPerDay: 0,
                  queueEnd: 0,
                  queueBufferDays: null,
                  averageStageDurationDays: 0,
                },
              ],
              bottleneck: null,
            },
          },
        ],
      })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /движение по воронке/i }))
    const stableLeadersHeading = await screen.findByRole('heading', { name: /сильные менеджеры по этапам/i })
    const stableLeadersSection = stableLeadersHeading.closest('section')

    expect(stableLeadersSection).not.toBeNull()
    expect(within(stableLeadersSection as HTMLElement).getAllByText('Ромашова Ольга').length).toBeGreaterThan(0)
    expect(within(stableLeadersSection as HTMLElement).getByText('Устойчив')).toBeInTheDocument()
  })

  it('explains that calls are not linked to deals when calls-per-deal cannot be calculated', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 0,
      totalCalls: 12,
      totalIncomingCalls: 0,
      totalOutgoingCalls: 12,
      totalOtherOutgoingCalls: 0,
      totalConnectedCalls: 8,
      totalFailedCalls: 4,
      totalCallsOverThirtySeconds: 5,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const callsKpi = (await screen.findByText('Звонков на сделку')).closest('.metric')
    expect(callsKpi).not.toBeNull()
    expect(within(callsKpi as HTMLElement).getByText('—')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).getByText('нет привязки')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).getByText('есть звонки, но они не привязаны к сделкам')).toBeInTheDocument()
    expect(within(callsKpi as HTMLElement).queryByText('0%')).not.toBeInTheDocument()
  })

  it('puts created and closed tasks first and explains outgoing call composition', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 3,
      totalCreatedCount: 7,
      totalRescheduledCount: 0,
      totalClosedCount: 5,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 3,
          createdCount: 7,
          rescheduledCount: 0,
          closedCount: 5,
          meetingCount: 0,
          averageCreatedPerDeal: 2.3,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.7,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 3,
      totalCalls: 10,
      totalIncomingCalls: 1,
      totalOutgoingCalls: 9,
      totalOtherOutgoingCalls: 2,
      totalConnectedCalls: 4,
      totalFailedCalls: 3,
      totalCallsOverThirtySeconds: 4,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 3,
          totalCalls: 10,
          incomingCalls: 1,
          outgoingCalls: 9,
          otherOutgoingCalls: 2,
          connectedCalls: 4,
          failedCalls: 3,
          callsOverThirtySeconds: 4,
          connectedCallsOverThirtySeconds: 4,
          averageCallsPerDeal: 3,
          averageDurationSeconds: 60,
          stageBreakdown: [],
        },
      ],
      comparisons: [],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const summarySection = (await screen.findByRole('heading', { name: /сводка по менеджерам/i }))
      .closest('section')
    expect(summarySection).not.toBeNull()

    await within(summarySection!).findByText('Егоров Андрей')
    const headers = within(summarySection!)
      .getAllByRole('columnheader')
      .map((header) =>
        header.textContent
          ?.replace(/\s+/g, ' ')
          .replace(/\s*(сорт|убыв|возр)$/i, '')
          .trim(),
      )

    expect(headers[0]).toBe('Менеджер')
    expect(headers[1]).toBe('Создано задач')
    expect(headers[2]).toBe('Закрыто задач')
    expect(headers[3]).toContain('Исходящие')
    expect(headers[3]).toContain('успешные + прочие + недозвоны')
    expect(headers[4]).toBe('Успешные >30 сек')
    expect(headers[5]).toBe('Прочие исходящие')
    expect(headers[6]).toBe('Недозвоны')
    expect(headers[7]).toBe('Входящие')
    expect(within(summarySection!).getByText('= 4 + 2 + 3')).toBeInTheDocument()
  })

  it('shows absolute calls inside activity blocks and supports compact sortable compare values', async () => {
    vi.mocked(apiClient.getActivitiesWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 8,
      totalCreatedCount: 14,
      totalRescheduledCount: 0,
      totalClosedCount: 10,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 5,
          createdCount: 10,
          rescheduledCount: 0,
          closedCount: 6,
          meetingCount: 0,
          averageCreatedPerDeal: 2,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.2,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 5,
              createdCount: 6,
              rescheduledCount: 0,
              closedCount: 4,
              averageCreatedPerDeal: 1.2,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 0.8,
            },
          ],
        },
        {
          managerId: '11234',
          managerName: 'Ромашова Ольга',
          dealCount: 3,
          createdCount: 4,
          rescheduledCount: 0,
          closedCount: 4,
          meetingCount: 0,
          averageCreatedPerDeal: 1.3,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 1.3,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
            totalDealCount: 8,
            totalCreatedCount: 8,
            totalRescheduledCount: 0,
            totalClosedCount: 8,
            totalMeetingCount: 0,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                createdCount: 8,
                rescheduledCount: 0,
                closedCount: 5,
                meetingCount: 0,
                averageCreatedPerDeal: 1.6,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 1,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [],
              },
            ],
          },
        },
        {
          compareIndex: 2,
          range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
            totalDealCount: 8,
            totalCreatedCount: 5,
            totalRescheduledCount: 0,
            totalClosedCount: 5,
            totalMeetingCount: 0,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                createdCount: 5,
                rescheduledCount: 0,
                closedCount: 4,
                meetingCount: 0,
                averageCreatedPerDeal: 1,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 0.8,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [],
              },
            ],
          },
        },
      ],
    })
    vi.mocked(apiClient.getCallsWorkloadReport).mockResolvedValueOnce({
      range: { from: '2026-04-06T00:00:00.000Z', to: '2026-04-12T23:59:59.999Z' },
      totalDealCount: 8,
      totalCalls: 20,
      totalIncomingCalls: 2,
      totalOutgoingCalls: 18,
      totalOtherOutgoingCalls: 3,
      totalConnectedCalls: 12,
      totalFailedCalls: 5,
      totalCallsOverThirtySeconds: 10,
      totalConnectedCallsOverThirtySeconds: 10,
      warnings: [],
      managerRows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          dealCount: 5,
          totalCalls: 14,
          incomingCalls: 1,
          outgoingCalls: 13,
          otherOutgoingCalls: 2,
          connectedCalls: 9,
          failedCalls: 2,
          callsOverThirtySeconds: 9,
          connectedCallsOverThirtySeconds: 9,
          averageCallsPerDeal: 2.8,
          averageDurationSeconds: 70,
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 5,
              totalCalls: 14,
              incomingCalls: 1,
              outgoingCalls: 13,
              otherOutgoingCalls: 2,
              connectedCalls: 9,
              failedCalls: 2,
              callsOverThirtySeconds: 9,
              connectedCallsOverThirtySeconds: 9,
              averageCallsPerDeal: 2.8,
              averageDurationSeconds: 70,
            },
          ],
        },
        {
          managerId: '11234',
          managerName: 'Ромашова Ольга',
          dealCount: 3,
          totalCalls: 6,
          incomingCalls: 1,
          outgoingCalls: 5,
          otherOutgoingCalls: 1,
          connectedCalls: 3,
          failedCalls: 1,
          callsOverThirtySeconds: 3,
          connectedCallsOverThirtySeconds: 3,
          averageCallsPerDeal: 2,
          averageDurationSeconds: 55,
          stageBreakdown: [],
        },
      ],
      comparisons: [
        {
          compareIndex: 1,
          range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-30T00:00:00.000Z', to: '2026-04-05T23:59:59.999Z' },
            totalDealCount: 8,
            totalCalls: 12,
            totalIncomingCalls: 1,
            totalOutgoingCalls: 11,
            totalOtherOutgoingCalls: 1,
            totalConnectedCalls: 8,
            totalFailedCalls: 2,
            totalCallsOverThirtySeconds: 8,
            totalConnectedCallsOverThirtySeconds: 8,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                totalCalls: 10,
                incomingCalls: 1,
                outgoingCalls: 9,
                otherOutgoingCalls: 1,
                connectedCalls: 7,
                failedCalls: 1,
                callsOverThirtySeconds: 7,
                connectedCallsOverThirtySeconds: 7,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 60,
                stageBreakdown: [],
              },
            ],
          },
        },
        {
          compareIndex: 2,
          range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
          snapshot: {
            range: { from: '2026-03-23T00:00:00.000Z', to: '2026-03-29T23:59:59.999Z' },
            totalDealCount: 8,
            totalCalls: 8,
            totalIncomingCalls: 1,
            totalOutgoingCalls: 7,
            totalOtherOutgoingCalls: 1,
            totalConnectedCalls: 5,
            totalFailedCalls: 1,
            totalCallsOverThirtySeconds: 5,
            totalConnectedCallsOverThirtySeconds: 5,
            warnings: [],
            managerRows: [
              {
                managerId: '78',
                managerName: 'Егоров Андрей',
                dealCount: 5,
                totalCalls: 8,
                incomingCalls: 1,
                outgoingCalls: 7,
                otherOutgoingCalls: 1,
                connectedCalls: 5,
                failedCalls: 1,
                callsOverThirtySeconds: 5,
                connectedCallsOverThirtySeconds: 5,
                averageCallsPerDeal: 1.6,
                averageDurationSeconds: 60,
                stageBreakdown: [],
              },
            ],
          },
        },
      ],
    })

    render(<ProtoApp />)

    await userEvent.click(await screen.findByRole('button', { name: /отчет активности/i }))
    const summarySection = (await screen.findByRole('heading', { name: /сводка по менеджерам/i }))
      .closest('section')
    expect(summarySection).not.toBeNull()

    expect(screen.queryByRole('heading', { name: /матрица активности/i })).not.toBeInTheDocument()
    expect(within(summarySection!).getByText('С1 9 / +44%')).toBeInTheDocument()
    expect(within(summarySection!).getByText('С2 7 / +86%')).toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^сорт$/i)).not.toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^убыв$/i)).not.toBeInTheDocument()
    expect(within(summarySection!).queryByText(/^возр$/i)).not.toBeInTheDocument()

    const rowsInitialDescending = within(summarySection!).getAllByRole('row')
    expect(within(rowsInitialDescending[1]!).getByText('Егоров Андрей')).toBeInTheDocument()
    expect(
      within(summarySection!).getByRole('button', { name: /^исходящие/i }).querySelector('svg'),
    ).not.toBeNull()

    await userEvent.click(within(summarySection!).getByRole('button', { name: /^исходящие/i }))
    const rowsAscending = within(summarySection!).getAllByRole('row')
    expect(within(rowsAscending[1]!).getByText('Ромашова Ольга')).toBeInTheDocument()

    await userEvent.click(within(summarySection!).getByRole('button', { name: /^исходящие/i }))
    const rowsDescending = within(summarySection!).getAllByRole('row')
    expect(within(rowsDescending[1]!).getByText('Егоров Андрей')).toBeInTheDocument()
  })
})
