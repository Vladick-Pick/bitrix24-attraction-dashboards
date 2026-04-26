import type {
  DashboardData,
  DashboardSnapshot,
  PeriodDays,
  StageCatalogEntry,
} from '@/lib/dashboard-types'

const stageCatalog: StageCatalogEntry[] = [
  {
    entityType: 'deal',
    categoryId: '1',
    statusId: 'C1:NEW',
    name: 'Новая',
    semanticId: 'P',
  },
  {
    entityType: 'deal',
    categoryId: '1',
    statusId: 'C1:DISCOVERY',
    name: 'Звонок-знакомство',
    semanticId: 'P',
  },
  {
    entityType: 'deal',
    categoryId: '1',
    statusId: 'C1:WON',
    name: 'Продажа',
    semanticId: 'S',
  },
]

function buildDashboard(period: PeriodDays): DashboardData {
  const multiplier = period === 7 ? 1 : period === 30 ? 2 : period === 90 ? 3 : 4
  const amount = 140000 * multiplier

  return {
    salesSummary: {
      salesCount: multiplier,
      salesAmount: amount,
      averageSaleAmount: 140000,
      newDealsCount: 11 * multiplier,
      conversionRate: 18.2,
    },
    managerGroups: [
      {
        managerId: '7',
        managerName: 'Анна Петрова',
        totalWonDeals: multiplier,
        totalSalesAmount: amount,
        deals: [
          {
            dealId: 'DEMO-102',
            dealTitle: 'ООО Альфа',
            managerId: '7',
            managerName: 'Анна Петрова',
            amount,
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
                stageId: 'C1:NEW',
                stageName: 'Новая',
                enteredAt: '2026-03-10T10:00:00.000Z',
                leftAt: '2026-03-12T09:00:00.000Z',
                durationHours: 47,
              },
              {
                stageId: 'C1:DISCOVERY',
                stageName: 'Звонок-знакомство',
                enteredAt: '2026-03-12T09:00:00.000Z',
                leftAt: '2026-03-20T09:00:00.000Z',
                durationHours: 192,
              },
            ],
          },
        ],
      },
    ],
  }
}

export function getDemoSnapshot(period: PeriodDays): DashboardSnapshot {
  return {
    dashboard: buildDashboard(period),
    meta: {
      stageCatalog,
      managerCatalog: [{ id: '7', name: 'Анна Петрова' }],
      sourceCatalog: [],
      wonStageIds: ['C1:WON'],
      defaultPeriodDays: 30,
      lastSync: null,
      syncHealth: {
        status: 'ready',
        blocking: false,
        checkedAt: '',
        lastSuccessfulSync: null,
        issues: [],
        warnings: [],
      },
    },
  }
}
