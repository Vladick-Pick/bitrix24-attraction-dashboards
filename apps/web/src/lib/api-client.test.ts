import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiClient, ApiClientError } from '@/lib/api-client'

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes stage timeline interaction summaries while preserving legacy fallbacks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        salesSummary: {
          salesCount: 1,
          salesAmount: 1000000,
          averageSaleAmount: 1000000,
          newDealsCount: 2,
          conversionRate: 50,
        },
        managerGroups: [
          {
            managerId: '78',
            managerName: 'Егоров Андрей',
            totalWonDeals: 1,
            totalSalesAmount: 1000000,
            totalAttractionRevenueAmount: 300000,
            averageAttractionRevenueAmount: 300000,
            totalMembershipAmount: 700000,
            averageMembershipAmount: 700000,
            deals: [
              {
                dealId: 'D-1',
                managerId: '78',
                managerName: 'Егоров Андрей',
                amount: 1000000,
                attractionRevenueAmount: 300000,
                membershipAmount: 700000,
                pricingStatus: 'priced',
                pricingWarnings: [],
                dateCreate: '2026-03-01T10:00:00.000Z',
                dateClosed: '2026-03-10T10:00:00.000Z',
                cycleDays: 9,
                cohortContext: {},
                callSummary: {},
                taskSummary: {},
                stageTimeline: [
                  {
                    stageId: 'C10:CALL',
                    stageName: 'Звонок-знакомство',
                    enteredAt: '2026-03-01T10:00:00.000Z',
                    leftAt: '2026-03-02T10:00:00.000Z',
                    durationHours: 24,
                    callSummary: {
                      total: 3,
                      incoming: 1,
                      outgoing: 2,
                      successful: 2,
                      failed: 1,
                      overThirtySeconds: 1,
                      connectedOverThirtySeconds: 1,
                    },
                    taskSummary: {
                      created: 2,
                      closed: 1,
                    },
                  },
                  {
                    stageId: 'C10:LEGACY',
                    stageName: 'Старый ответ',
                    enteredAt: '2026-03-02T10:00:00.000Z',
                    leftAt: '2026-03-03T10:00:00.000Z',
                    durationHours: 24,
                  },
                ],
              },
            ],
          },
        ],
        comparisons: [],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const dashboard = await apiClient.getDashboard({
      preset: 'custom',
      from: '2026-03-01T00:00:00.000+03:00',
      to: '2026-03-31T23:59:59.999+03:00',
    })

    expect(dashboard.managerGroups[0]?.deals[0]?.stageTimeline[0]).toMatchObject({
      callSummary: {
        total: 3,
        incoming: 1,
        outgoing: 2,
        successful: 2,
        failed: 1,
        overThirtySeconds: 1,
        connectedOverThirtySeconds: 1,
      },
      taskSummary: {
        created: 2,
        closed: 1,
      },
    })
    expect(dashboard.managerGroups[0]?.deals[0]?.stageTimeline[1]).toMatchObject({
      callSummary: {
        total: 0,
        incoming: 0,
        outgoing: 0,
        successful: 0,
        failed: 0,
        overThirtySeconds: 0,
        connectedOverThirtySeconds: 0,
      },
      taskSummary: {
        created: 0,
        closed: 0,
      },
    })
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

  it('returns a dashboard comment to development as a rework thread reply', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        comment: {
          id: 'comment-1',
          moduleId: 'attraction',
          sceneId: 'sales',
          x: 0.25,
          y: 0.4,
          text: 'Дата встречи есть в атрибутах',
          status: 'open',
          archivedAt: null,
          createdAt: '2026-05-12T15:00:00.000Z',
          updatedAt: '2026-05-12T16:00:00.000Z',
          paperclipIssueId: 'issue-143570',
          paperclipIssueIdentifier: 'BIT-6',
          paperclipStatus: 'in_work',
          paperclipSyncStatus: 'sent',
          paperclipError: null,
          paperclipLastSyncedAt: '2026-05-12T16:00:00.000Z',
          paperclipRetryCount: 0,
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const client = apiClient as typeof apiClient & {
      reworkComment(id: string, input: { text: string }): Promise<{
        comment: {
          id: string
          paperclipStatus?: string
          paperclipSyncStatus?: string
        }
      }>
    }
    const result = await client.reworkComment('comment-1', {
      text: 'Покажите предупреждение: дата встречи раньше создания сделки',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]

    expect(new URL(url, window.location.origin).pathname).toBe('/api/comments/comment-1/rework')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Покажите предупреждение: дата встречи раньше создания сделки',
    })
    expect(result.comment.id).toBe('comment-1')
    expect(result.comment.paperclipStatus).toBe('in_work')
    expect(result.comment.paperclipSyncStatus).toBe('sent')
  })

  it('normalizes Paperclip ready reports on comments and notifications', async () => {
    const readyReport = {
      id: 'paperclip-comment-ready',
      body: '## Готово к проверке\n\n- Проверено: web vitest.',
      authorAgentId: 'agent-1',
      authorUserId: null,
      createdAt: '2026-05-13T12:00:00.000Z',
      updatedAt: '2026-05-13T12:01:00.000Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: 'comment-1',
              moduleId: 'attraction',
              sceneId: 'sales',
              x: 0.25,
              y: 0.4,
              text: 'Проверить готовую доработку',
              status: 'open',
              archivedAt: null,
              createdAt: '2026-05-12T15:00:00.000Z',
              updatedAt: '2026-05-13T12:00:00.000Z',
              paperclipIssueId: 'issue-143570',
              paperclipIssueIdentifier: 'BIT-6',
              paperclipStatus: 'done',
              paperclipSyncStatus: 'sent',
              paperclipError: null,
              paperclipReadyReport: readyReport,
            },
          ],
          updatedAt: '2026-05-13T12:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 'comment-1',
              sceneId: 'sales',
              text: 'Проверить готовую доработку',
              status: 'done',
              paperclipSyncStatus: 'sent',
              paperclipIssueIdentifier: 'BIT-6',
              paperclipError: null,
              updatedAt: '2026-05-13T12:00:00.000Z',
              paperclipReadyReport: readyReport,
            },
          ],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const comments = await apiClient.getComments()
    const notifications = await apiClient.getCommentNotifications()

    expect(comments.comments[0]?.paperclipReadyReport).toEqual(readyReport)
    expect(notifications.notifications[0]?.paperclipReadyReport?.body).toContain(
      'Проверено: web vitest',
    )
  })

  it('keeps failed rework response payload on ApiClientError', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({
        code: 'PAPERCLIP_REWORK_FAILED',
        comment: {
          id: 'comment-1',
          moduleId: 'attraction',
          sceneId: 'sales',
          x: 0.25,
          y: 0.4,
          text: 'Дата встречи есть в атрибутах',
          status: 'open',
          archivedAt: null,
          createdAt: '2026-05-12T15:00:00.000Z',
          updatedAt: '2026-05-12T16:05:00.000Z',
          paperclipIssueId: 'issue-143570',
          paperclipIssueIdentifier: 'BIT-6',
          paperclipStatus: 'failed',
          paperclipSyncStatus: 'failed',
          paperclipError: 'Paperclip issue comment failed.',
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    let caught: unknown = null
    try {
      await apiClient.reworkComment('comment-1', {
        text: 'Покажите предупреждение в таймлайне',
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiClientError)
    expect(caught).toMatchObject({
      message: 'PAPERCLIP_REWORK_FAILED',
      status: 502,
      payload: expect.objectContaining({
        comment: expect.objectContaining({
          id: 'comment-1',
          paperclipStatus: 'failed',
          paperclipSyncStatus: 'failed',
        }),
      }),
    })
  })

  it('loads effective and quarterly sales plans', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-04-07T23:59:59.999+03:00',
          updatedAt: '2026-04-10T12:00:00.000Z',
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              plannedDeals: 2,
              plannedAmount: 1166667,
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
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
          rows: [
            {
              managerId: '78',
              managerName: 'Егоров Андрей',
              targetGroupKey: 'ClubFirst Russia',
              targetGroupLabel: 'ClubFirst Russia',
              quarterPlannedDeals: 9,
              quarterPlannedAmount: 9000000,
              months: [
                {
                  month: '2026-04',
                  periodStart: '2026-04-01T00:00:00.000+03:00',
                  periodEnd: '2026-04-30T23:59:59.999+03:00',
                  plannedDeals: 3,
                  plannedAmount: 3000000,
                  updatedAt: '2026-04-10T12:00:00.000Z',
                },
              ],
              updatedAt: '2026-04-10T12:00:00.000Z',
            },
          ],
          updatedAt: '2026-04-10T12:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          year: 2026,
          quarter: 2,
          periodStart: '2026-04-01T00:00:00.000+03:00',
          periodEnd: '2026-06-30T23:59:59.999+03:00',
          months: [],
          rows: [],
          updatedAt: '2026-04-10T12:05:00.000Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const effective = await apiClient.getEffectiveSalesPlan({
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-07T23:59:59.999+03:00',
    })
    const [effectiveUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsedEffectiveUrl = new URL(effectiveUrl, window.location.origin)

    expect(parsedEffectiveUrl.pathname).toBe('/api/sales-plan/effective')
    expect(effective.rows[0]?.plannedDeals).toBe(2)
    expect(effective.rows[0]?.plannedAmount).toBe(1166667)

    const quarter = await apiClient.getSalesPlanQuarter({ year: 2026, quarter: 2 })
    const [quarterUrl] = fetchMock.mock.calls[1] as [string, RequestInit]
    const parsedQuarterUrl = new URL(quarterUrl, window.location.origin)

    expect(parsedQuarterUrl.pathname).toBe('/api/sales-plan/quarter')
    expect(parsedQuarterUrl.searchParams.get('year')).toBe('2026')
    expect(parsedQuarterUrl.searchParams.get('quarter')).toBe('2')
    expect(quarter.months.map((month) => month.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
    ])
    expect(quarter.rows[0]?.quarterPlannedDeals).toBe(9)

    await apiClient.saveSalesPlanQuarter({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: '78',
          managerName: 'Егоров Андрей',
          targetGroupKey: 'ClubFirst Russia',
          targetGroupLabel: 'ClubFirst Russia',
          quarterPlannedDeals: 9,
          quarterPlannedAmount: 9000000,
          months: [
            { month: '2026-04', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-05', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-06', plannedDeals: 3, plannedAmount: 3000000 },
          ],
        },
      ],
    })

    const [, saveInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(saveInit.method).toBe('PUT')
    expect(JSON.parse(String(saveInit.body))).toMatchObject({
      year: 2026,
      quarter: 2,
      rows: [
        {
          managerId: '78',
          quarterPlannedDeals: 9,
          months: [
            { month: '2026-04', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-05', plannedDeals: 3, plannedAmount: 3000000 },
            { month: '2026-06', plannedDeals: 3, plannedAmount: 3000000 },
          ],
        },
      ],
    })
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

  it('stores csrf in memory after auth and sends it only in request headers', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            login: 'admin',
            role: 'admin',
          },
          csrfToken: 'csrf-from-login',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rules: [],
          updatedAt: '2026-04-10T12:05:00.000Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.login({
      login: 'admin',
      password: 'correct-password',
    })
    await apiClient.savePricingSettings({ rules: [] })

    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [, saveInit] = fetchMock.mock.calls[1] as [string, RequestInit]

    expect(new URL(loginUrl, window.location.origin).pathname).toBe(
      '/api/auth/login',
    )
    expect(loginInit.credentials).toBe('include')
    expect(String(loginInit.body)).toContain('correct-password')
    expect(window.localStorage.getItem('csrf-from-login')).toBeNull()
    expect(saveInit.credentials).toBe('include')
    expect(saveInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-login',
    })
  })

  it('sends csrf on streamed sync requests too', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(
          encoder.encode(
            'event: complete\ndata: {"syncRunId":18,"leadsSynced":0,"dealsSynced":5,"mode":"delta","modifiedAfter":null,"finishedAt":"2026-04-08T12:00:00.000Z","snapshotBefore":{"deals":40,"activities":10,"calls":5,"stageHistory":16},"snapshotAfter":{"deals":42,"activities":12,"calls":7,"stageHistory":18},"changes":{"deals":5,"activities":2,"calls":2,"stageHistory":2,"managers":1},"diagnostics":[]}\n\n',
          ),
        )
        controller.close()
      },
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            login: 'admin',
            role: 'admin',
          },
          csrfToken: 'csrf-from-me',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getCurrentUser()
    await apiClient.triggerSync(vi.fn())

    const [, syncInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(syncInit.headers).toMatchObject({
      Accept: 'text/event-stream',
      'X-CSRF-Token': 'csrf-from-me',
    })
  })

  it('creates dashboard comments and manages module users through the module API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 1,
            login: 'leader@example.com',
            role: 'admin',
            modules: [
              {
                id: 'attraction',
                slug: 'attraction',
                name: 'Привлечение',
                role: 'leader',
                permissions: ['comments:create', 'module-users:manage'],
              },
            ],
          },
          csrfToken: 'csrf-from-me',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comment: {
            id: 'comment-1',
            moduleId: 'attraction',
            authorUserId: 1,
            authorLogin: 'leader@example.com',
            sceneId: 'sales',
            x: 0.25,
            y: 0.5,
            text: 'Проверь блок',
            status: 'open',
            archivedAt: null,
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
            paperclipIssueId: 'issue-1',
            paperclipIssueIdentifier: 'BIT-1',
            paperclipStatus: 'sent',
            paperclipSyncStatus: 'sent',
            paperclipError: null,
            paperclipRetryCount: 0,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          notifications: [
            {
              id: 'comment-1',
              sceneId: 'sales',
              text: 'Проверь блок',
              status: 'in_work',
              paperclipSyncStatus: 'sent',
              paperclipIssueIdentifier: 'BIT-1',
              paperclipError: null,
              updatedAt: '2026-04-10T12:05:00.000Z',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            id: 2,
            login: 'employee@example.com',
            disabled: false,
            moduleId: 'attraction',
            moduleRole: 'employee',
            membershipStatus: 'active',
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const auth = await apiClient.getCurrentUser()
    const created = await apiClient.createComment({
      sceneId: 'sales',
      x: 0.25,
      y: 0.5,
      text: 'Проверь блок',
      context: {
        filters: {
          managers: ['78'],
        },
      },
    })
    const notifications = await apiClient.getCommentNotifications()
    const moduleUser = await apiClient.createModuleUser({
      login: 'employee@example.com',
      password: 'correct-password',
      role: 'employee',
    })

    expect(auth.user.modules[0]).toMatchObject({
      id: 'attraction',
      role: 'leader',
      permissions: ['comments:create', 'module-users:manage'],
    })
    expect(created.comment.paperclipStatus).toBe('sent')
    expect(notifications.notifications[0]?.status).toBe('in_work')
    expect(moduleUser.user.moduleRole).toBe('employee')

    const [, createCommentInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    const [notificationsUrl] = fetchMock.mock.calls[2] as [string, RequestInit]
    const [createUserUrl, createUserInit] = fetchMock.mock.calls[3] as [
      string,
      RequestInit,
    ]

    expect(new URL(notificationsUrl, window.location.origin).pathname).toBe(
      '/api/comment-notifications',
    )
    expect(createCommentInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-me',
    })
    expect(new URL(createUserUrl, window.location.origin).pathname).toBe(
      '/api/admin/module-users',
    )
    expect(createUserInit.headers).toMatchObject({
      'X-CSRF-Token': 'csrf-from-me',
    })
  })

  it('uses module-aware API paths for leadgen comments, users, and funnel report', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          updatedAt: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          users: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          range: {
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-31T23:59:59.999Z',
          },
          totalDeals: 4,
          createdDeals: 3,
          activeDeals: 2,
          closedDeals: 1,
          stageRows: [
            {
              stageId: 'C28:NEW',
              stageName: 'Новый лид',
              sortOrder: 10,
              activeDeals: 2,
              createdDeals: 3,
              closedDeals: 0,
            },
          ],
          sourceRows: [],
          managerRows: [],
          reasonRows: [],
          warnings: [],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    await apiClient.getComments('leadgen')
    await apiClient.getModuleUsers('leadgen')
    const report = await apiClient.getLeadgenFunnelReport('leadgen', {
      preset: 'custom',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.999Z',
      managerIds: ['501'],
    })

    expect(report.totalDeals).toBe(4)
    expect(report.stageRows[0]).toMatchObject({
      stageId: 'C28:NEW',
      stageName: 'Новый лид',
    })
    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url), window.location.origin).pathname),
    ).toEqual([
      '/api/modules/leadgen/comments',
      '/api/modules/leadgen/admin/module-users',
      '/api/modules/leadgen/reports/funnel',
    ])
  })
})
