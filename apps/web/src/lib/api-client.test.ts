import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/lib/api-client'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads and saves sales plan rows by report range', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:00:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 3,
              plannedAmount: 2500000,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-30T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:05:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 4,
              plannedAmount: 3000000,
              updatedAt: '2026-04-10T12:05:00.000Z',
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const loaded = await apiClient.getSalesPlan({
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
    })

    const [loadUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedLoadUrl = new URL(loadUrl, window.location.origin)

    expect(parsedLoadUrl.pathname).toBe('/api/sales-plan')
    expect(parsedLoadUrl.searchParams.get('from')).toBe('2026-04-01T00:00:00.000+03:00')
    expect(parsedLoadUrl.searchParams.get('to')).toBe('2026-04-30T23:59:59.999+03:00')
    expect(loaded.rows[0]).toMatchObject({
      managerId: '78',
      targetGroupKey: 'ClubFirst Russia',
      plannedDeals: 3,
      plannedAmount: 2500000,
    })

    const saved = await apiClient.saveSalesPlan({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 4,
          plannedAmount: 3000000,
        },
      ],
    })

    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toEqual({
      periodStart: '2026-04-01T00:00:00.000+03:00',
      periodEnd: '2026-04-30T23:59:59.999+03:00',
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          plannedDeals: 4,
          plannedAmount: 3000000,
        },
      ],
    })
    expect(saved.updatedAt).toBe('2026-04-10T12:05:00.000Z')
    expect(saved.rows[0]?.plannedAmount).toBe(3000000)
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

  it('loads and normalizes conversion events report', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalInvitedCount: 10,
        totalAttendedCount: 6,
        totalRefusedCount: 2,
        totalMissedCount: 4,
        attendanceRate: 60,
        nextStepEligibleCount: 6,
        nextStepCount: 3,
        nextStepRate: 50,
        warnings: ['Conversion event visit V5 is not linked to an attraction deal.'],
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
            unlinkedCount: 1,
            unknownStatusCount: 0,
            managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 6 }],
            sourceBreakdown: [{ key: 'WEB', label: 'Веб', count: 6 }],
            businessClubBreakdown: [{ key: 'ClubOne', label: 'ClubOne', count: 6 }],
          },
        ],
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const report = await apiClient.getConversionEventsReport({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
      managerIds: ['78'],
    })

    const [requestUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedUrl = new URL(requestUrl, window.location.origin)

    expect(parsedUrl.pathname).toBe('/api/reports/conversion-events')
    expect(parsedUrl.searchParams.get('managerIds')).toBe('78')
    expect(report.rows[0]).toMatchObject({
      eventName: 'Знакомство с клубом 29.04.',
      attendedCount: 6,
      attendanceRate: 60,
      nextStepRate: 50,
      managerBreakdown: [{ key: '78', label: 'Егоров Андрей', count: 6 }],
    })
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
            targetGroups: [
              { targetGroupKey: 'ClubFirst', targetGroupLabel: 'ClubFirst', count: 2 },
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
    expect(report.businessClubByManager[0]?.targetGroups[0]).toEqual({
      targetGroupKey: 'ClubFirst',
      targetGroupLabel: 'ClubFirst',
      count: 2,
    })
    expect(report.lostDealDetails[0]?.reasonDetail).toBe('Нет интереса')
  })

  it('normalizes sync health from meta responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stageCatalog: [],
        managerCatalog: [],
        sourceCatalog: [],
        wonStageIds: [],
        defaultPeriodDays: 30,
        lastSync: null,
        snapshotStats: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18,
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
              message: 'Нет покрытия',
            },
          ],
          warnings: ['Нет покрытия'],
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.getMeta()).resolves.toMatchObject({
      syncHealth: {
        status: 'blocked',
        blocking: true,
        warnings: ['Нет покрытия'],
        issues: [
          {
            code: 'MISSING_COVERAGE',
            severity: 'blocking',
            message: 'Нет покрытия',
          },
        ],
      },
      snapshotStats: {
        deals: 42,
        activities: 12,
        calls: 7,
        stageHistory: 18,
      },
    })
  })

  it('normalizes sync summary counters and snapshot stats', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        syncRunId: 18,
        leadsSynced: 0,
        dealsSynced: 5,
        mode: 'delta',
        modifiedAfter: '2026-04-08T00:00:00.000Z',
        finishedAt: '2026-04-08T12:00:00.000Z',
        snapshotBefore: {
          deals: 40,
          activities: 10,
          calls: 5,
          stageHistory: 16,
        },
        snapshotAfter: {
          deals: 42,
          activities: 12,
          calls: 7,
          stageHistory: 18,
        },
        changes: {
          deals: 5,
          activities: 2,
          calls: 2,
          stageHistory: 2,
          managers: 1,
        },
        diagnostics: ['dealCursor=2026-04-08T12:00:00.000Z'],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.triggerSync()).resolves.toMatchObject({
      syncRunId: 18,
      dealsSynced: 5,
      snapshotAfter: {
        deals: 42,
        activities: 12,
        calls: 7,
        stageHistory: 18,
      },
      changes: {
        deals: 5,
        activities: 2,
        calls: 2,
        stageHistory: 2,
        managers: 1,
      },
    })
  })

  it('streams sync progress events when a progress callback is provided', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: progress\ndata: {"syncRunId":18,"phase":"fetch_deals","progress":35,"message":"Получено обновлений сделок: 5"}\n\n',
          ),
        )
        controller.enqueue(
          encoder.encode(
            'event: complete\ndata: {"syncRunId":18,"leadsSynced":0,"dealsSynced":5,"mode":"delta","modifiedAfter":null,"finishedAt":"2026-04-08T12:00:00.000Z","snapshotBefore":{"deals":40,"activities":10,"calls":5,"stageHistory":16},"snapshotAfter":{"deals":42,"activities":12,"calls":7,"stageHistory":18},"changes":{"deals":5,"activities":2,"calls":2,"stageHistory":2,"managers":1},"diagnostics":[]}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })
    const progress = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    const summary = await apiClient.triggerSync(progress)

    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'fetch_deals',
        progress: 35,
        message: 'Получено обновлений сделок: 5',
      }),
    )
    expect(summary.syncRunId).toBe(18)
    expect(summary.changes.deals).toBe(5)
  })

  it('surfaces safe sync stream diagnostics from error events', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: error\ndata: {"error":"SYNC_FAILED","code":"SYNC_FAILED","details":{"diagnostics":["network=UND_ERR_CONNECT_TIMEOUT"]}}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiClient.triggerSync(vi.fn())).rejects.toThrow(
      'SYNC_FAILED: network=UND_ERR_CONNECT_TIMEOUT',
    )
  })
})
