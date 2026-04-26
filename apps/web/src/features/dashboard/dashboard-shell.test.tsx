import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardShell } from '@/features/dashboard/dashboard-shell'

const { getMetaMock, getDashboardMock, triggerSyncMock } = vi.hoisted(() => ({
  getMetaMock: vi.fn(),
  getDashboardMock: vi.fn(),
  triggerSyncMock: vi.fn(),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMeta: getMetaMock,
    getDashboard: getDashboardMock,
    triggerSync: triggerSyncMock,
  },
}))

function buildMeta() {
  return {
    stageCatalog: [],
    managerCatalog: [{ id: '7', name: 'Анна Петрова' }],
    sourceCatalog: [{ key: 'WEB', label: 'Платный поиск' }],
    wonStageIds: ['C10:WON'],
    defaultPeriodDays: 30,
    lastSync: {
      finishedAt: '2026-04-19T12:00:00.000Z',
      leadsSynced: 0,
      dealsSynced: 4,
      mode: 'delta' as const,
    },
  }
}

function buildDashboard() {
  return {
    salesSummary: {
      salesCount: 2,
      salesAmount: 240000,
      averageSaleAmount: 120000,
      newDealsCount: 11,
      conversionRate: 18.18,
    },
    managerGroups: [
      {
        managerId: '7',
        managerName: 'Анна Петрова',
        totalWonDeals: 2,
        totalSalesAmount: 240000,
        deals: [
          {
            dealId: 'D-102',
            dealTitle: 'ООО Альфа',
            amount: 140000,
            dateCreate: '2026-03-10T10:00:00.000Z',
            dateClosed: '2026-04-12T12:00:00.000Z',
            cycleDays: 33,
            cohortContext: {
              createdMonth: '2026-03',
              cohortCreatedDeals: 18,
              cohortWonDeals: 4,
              cohortWonConversionRate: 22.22,
            },
            callSummary: {
              total: 8,
              incoming: 2,
              outgoing: 6,
              successful: 5,
              failed: 1,
              overThirtySeconds: 4,
              connectedOverThirtySeconds: 3,
            },
            taskSummary: {
              created: 7,
              closed: 6,
            },
            stageTimeline: [
              {
                stageId: 'NEW',
                stageName: 'Новая',
                enteredAt: '2026-03-10T10:00:00.000Z',
                leftAt: '2026-03-12T09:00:00.000Z',
                durationHours: 47,
              },
              {
                stageId: 'CALL',
                stageName: 'Звонок-знакомство',
                enteredAt: '2026-03-12T09:00:00.000Z',
                leftAt: '2026-03-20T09:00:00.000Z',
                durationHours: 192,
              },
            ],
          },
          {
            dealId: 'D-101',
            dealTitle: 'ИП Бета',
            amount: 100000,
            dateCreate: '2026-03-02T10:00:00.000Z',
            dateClosed: '2026-04-02T12:00:00.000Z',
            cycleDays: 31,
            cohortContext: {
              createdMonth: '2026-03',
              cohortCreatedDeals: 18,
              cohortWonDeals: 4,
              cohortWonConversionRate: 22.22,
            },
            callSummary: {
              total: 5,
              incoming: 1,
              outgoing: 4,
              successful: 3,
              failed: 1,
              overThirtySeconds: 2,
              connectedOverThirtySeconds: 2,
            },
            taskSummary: {
              created: 4,
              closed: 4,
            },
            stageTimeline: [],
          },
        ],
      },
    ],
    comparisons: [],
  }
}

describe('DashboardShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getMetaMock.mockResolvedValue(buildMeta())
    getDashboardMock.mockResolvedValue(buildDashboard())
    triggerSyncMock.mockResolvedValue({
      syncRunId: 1,
      leadsSynced: 0,
      dealsSynced: 2,
      mode: 'delta',
      modifiedAfter: null,
      finishedAt: '2026-04-19T12:00:00.000Z',
    })
  })

  it('renders the new sales report instead of the old source and funnel cards', async () => {
    render(<DashboardShell />)

    expect(await screen.findByRole('heading', { name: /продажи по менеджерам/i })).toBeInTheDocument()
    expect(screen.getByText('Анна Петрова')).toBeInTheDocument()
    expect(screen.getByText('Сделка #D-102')).toBeInTheDocument()
    expect(screen.queryByText('ООО Альфа')).not.toBeInTheDocument()
    expect(screen.queryByText('ИП Бета')).not.toBeInTheDocument()
    expect(screen.queryByText(/top source/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/выбрать отчет/i)).not.toBeInTheDocument()
  })

  it('shows an explicit live error with retry instead of switching to preview data', async () => {
    getMetaMock.mockReset()
    getDashboardMock.mockReset()
    getMetaMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(buildMeta())
    getDashboardMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(buildDashboard())

    render(<DashboardShell />)

    expect(
      await screen.findByText(/не удалось загрузить live-данные/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /повторить загрузку/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/preview dataset active/i)).not.toBeInTheDocument()
    expect(screen.queryByText('ООО Альфа')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /повторить загрузку/i }))

    expect(
      await screen.findByRole('heading', { name: /продажи по менеджерам/i }),
    ).toBeInTheDocument()
  })

  it('reveals per-deal timeline details on demand', async () => {
    render(<DashboardShell />)

    const report = await screen.findByRole('heading', { name: /продажи по менеджерам/i })
    const section = report.closest('section')
    expect(section).not.toBeNull()

    await userEvent.click(within(section as HTMLElement).getAllByRole('button', { name: /подробнее/i })[0]!)

    expect(screen.getByText(/когорта 2026-03/i)).toBeInTheDocument()
    expect(screen.getByText(/создано дел/i)).toBeInTheDocument()
    expect(screen.getByText(/звонок-знакомство/i)).toBeInTheDocument()
    expect(screen.getByText(/192 ч/i)).toBeInTheDocument()
  })

  it('serializes custom date input to UTC day boundaries', async () => {
    render(<DashboardShell />)

    await screen.findByRole('heading', { name: /продажи по менеджерам/i })

    await userEvent.click(screen.getByRole('radio', { name: /^custom$/i }))
    fireEvent.change(screen.getByLabelText(/from date/i), {
      target: { value: '2026-04-01' },
    })
    fireEvent.change(screen.getByLabelText(/to date/i), {
      target: { value: '2026-04-30' },
    })

    await userEvent.click(screen.getByRole('button', { name: /apply range/i }))

    expect(getDashboardMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      }),
    )
  })
})
