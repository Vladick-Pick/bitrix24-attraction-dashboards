import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/lib/api-client'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('serializes compare ranges and normalizes comparison snapshots', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
              totalDealCount: 2,
              totalCreatedCount: 5,
              totalRescheduledCount: 0,
              totalClosedCount: 2,
              totalMeetingCount: 1,
              warnings: ['reschedule disabled'],
              managerRows: [],
              comparisons: [
          {
            compareIndex: 1,
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            snapshot: {
              range: {
                from: '2026-03-01T00:00:00.000Z',
                to: '2026-03-31T23:59:59.999Z',
              },
              totalDealCount: 1,
              totalCreatedCount: 3,
              totalRescheduledCount: 0,
              totalClosedCount: 1,
              totalMeetingCount: 0,
              warnings: [],
              managerRows: [],
            },
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getActivitiesWorkloadReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['7', '9'],
      sourceKeys: ['WEB'],
      compareRanges: [
        {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
        },
      ],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.searchParams.get('from')).toBe('2026-04-01T00:00:00.000Z')
    expect(parsedUrl.searchParams.get('to')).toBe('2026-04-30T23:59:59.999Z')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('7,9')
    expect(parsedUrl.searchParams.get('sourceKeys')).toBe('WEB')
    expect(parsedUrl.searchParams.get('compareFrom')).toBe(
      '2026-03-01T00:00:00.000Z',
    )
    expect(parsedUrl.searchParams.get('compareTo')).toBe(
      '2026-03-31T23:59:59.999Z',
    )

    expect(report.warnings).toEqual(['reschedule disabled'])
    expect(report.comparisons).toEqual([
      {
        compareIndex: 1,
        range: {
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-31T23:59:59.999Z',
        },
          snapshot: {
            range: {
              from: '2026-03-01T00:00:00.000Z',
              to: '2026-03-31T23:59:59.999Z',
            },
            totalDealCount: 1,
            totalCreatedCount: 3,
            totalRescheduledCount: 0,
            totalClosedCount: 1,
            totalMeetingCount: 0,
            warnings: [],
            managerRows: [],
          },
      },
    ])
  })

  it('normalizes acquisition outcome reports defensively', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalNewDeals: 3,
        totalLostDeals: 1,
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
                qualities: [{ qualityKey: 'A', qualityLabel: 'A', count: 2 }],
              },
            ],
          },
        ],
        lostDealsByManager: [],
        lostStages: [{ stageId: 'C10:LOSE', stageName: 'Корзина', count: 1 }],
        businessClubByManager: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            totalDeals: 2,
            businessClubs: [
              { businessClubKey: 'ClubOne', businessClubLabel: 'ClubOne', count: 2 },
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
            count: 1,
          },
        ],
        lostDealDetails: [
          {
            dealId: 'D-1',
            managerId: '78',
            managerName: 'Егоров Андрей',
            sourceKey: 'WEB',
            sourceLabel: 'Сайт',
            businessClubValue: 'ClubOne',
            stageId: 'C10:LOSE',
            stageName: 'Корзина',
            reasonKey: 'Клиенту не интересен формат',
            reasonLabel: 'Клиенту не интересен формат',
            reasonDetail: 'Нет интереса',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getAcquisitionOutcomesReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['78'],
      sourceKeys: ['WEB'],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.pathname).toBe('/api/reports/acquisition-outcomes')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('78')
    expect(parsedUrl.searchParams.get('sourceKeys')).toBe('WEB')
    expect(report.totalNewDeals).toBe(3)
    expect(report.newDealsByManager[0]?.sources[0]?.qualities[0]).toEqual({
      qualityKey: 'A',
      qualityLabel: 'A',
      count: 2,
    })
    expect(report.lostStages).toEqual([
      { stageId: 'C10:LOSE', stageName: 'Корзина', count: 1 },
    ])
    expect(report.topLossReasons[0]?.reasonLabel).toBe('Клиенту не интересен формат')
    expect(report.businessClubByManager[0]?.businessClubs[0]).toEqual({
      businessClubKey: 'ClubOne',
      businessClubLabel: 'ClubOne',
      count: 2,
    })
    expect(report.lostDealDetails[0]?.reasonDetail).toBe('Нет интереса')
  })
})
