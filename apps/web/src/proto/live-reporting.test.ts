import { describe, expect, it } from 'vitest'

import type {
  ActivitiesWorkloadReport,
  CallsWorkloadReport,
  CohortConversionReport,
} from '@/lib/dashboard-types'
import {
  buildDashboardQueryFromProtoFilters,
  mapActivitiesCallsSceneData,
  mapCohortSceneData,
  mapTocFlowSceneData,
} from '@/proto/live-reporting'

describe('live-reporting', () => {
  it('builds a dashboard query from prototype filters in the Bitrix business timezone', () => {
    const query = buildDashboardQueryFromProtoFilters({
      rangeStart: '2026-04-01',
      rangeEnd: '2026-04-30',
      compareRanges: [
        {
          id: 'cmp-1',
          start: '2026-03-01',
          end: '2026-03-31',
        },
      ],
      managers: ['7', '9'],
      sources: ['WEB', 'REFERRAL'],
    })

    expect(query).toEqual({
      preset: 'custom',
      from: '2026-04-01T00:00:00.000+03:00',
      to: '2026-04-30T23:59:59.999+03:00',
      managerIds: ['7', '9'],
      sourceKeys: ['WEB', 'REFERRAL'],
      compareRanges: [
        {
          from: '2026-03-01T00:00:00.000+03:00',
          to: '2026-03-31T23:59:59.999+03:00',
        },
      ],
    })
  })

  it('maps activities and calls reports into prototype-friendly activity scene data', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalDealCount: 20,
      totalCreatedCount: 80,
      totalRescheduledCount: 0,
      totalClosedCount: 60,
      totalMeetingCount: 0,
      warnings: ['Перенос дедлайна пока отключен'],
      managerRows: [
        {
          managerId: '7',
          managerName: 'Анна Петрова',
          dealCount: 10,
          createdCount: 40,
          rescheduledCount: 0,
          closedCount: 32,
          meetingCount: 0,
          averageCreatedPerDeal: 4,
          averageRescheduledPerDeal: 0,
          averageClosedPerDeal: 3.2,
          averageMeetingsPerDeal: 0,
          meetingTypeBreakdown: [],
          businessClubBreakdown: [],
          slaMetrics: [],
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 8,
              createdCount: 24,
              rescheduledCount: 0,
              closedCount: 18,
              averageCreatedPerDeal: 3,
              averageRescheduledPerDeal: 0,
              averageClosedPerDeal: 2.25,
            },
          ],
        },
      ],
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
            totalDealCount: 16,
            totalCreatedCount: 64,
            totalRescheduledCount: 0,
            totalClosedCount: 48,
            totalMeetingCount: 0,
            warnings: [],
            managerRows: [
              {
                managerId: '7',
                managerName: 'Анна Петрова',
                dealCount: 8,
                createdCount: 32,
                rescheduledCount: 0,
                closedCount: 24,
                meetingCount: 0,
                averageCreatedPerDeal: 4,
                averageRescheduledPerDeal: 0,
                averageClosedPerDeal: 3,
                averageMeetingsPerDeal: 0,
                meetingTypeBreakdown: [],
                businessClubBreakdown: [],
                slaMetrics: [],
                stageBreakdown: [
                  {
                    stageId: 'CALL',
                    stageName: 'Звонок-знакомство',
                    dealCount: 6,
                    createdCount: 18,
                    rescheduledCount: 0,
                    closedCount: 12,
                    averageCreatedPerDeal: 3,
                    averageRescheduledPerDeal: 0,
                    averageClosedPerDeal: 2,
                  },
                ],
              },
            ],
          },
        },
      ],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalDealCount: 20,
      totalCalls: 50,
      totalIncomingCalls: 15,
      totalOutgoingCalls: 35,
      totalOtherOutgoingCalls: 8,
      totalConnectedCalls: 40,
      totalFailedCalls: 10,
      totalCallsOverThirtySeconds: 30,
      totalConnectedCallsOverThirtySeconds: 24,
      warnings: [],
      managerRows: [
        {
          managerId: '7',
          managerName: 'Анна Петрова',
          dealCount: 10,
          totalCalls: 25,
          incomingCalls: 8,
          outgoingCalls: 17,
          otherOutgoingCalls: 0,
          connectedCalls: 20,
          failedCalls: 5,
          callsOverThirtySeconds: 15,
          connectedCallsOverThirtySeconds: 12,
          averageCallsPerDeal: 2.5,
          averageDurationSeconds: 88,
          stageBreakdown: [
            {
              stageId: 'CALL',
              stageName: 'Звонок-знакомство',
              dealCount: 8,
              totalCalls: 16,
              incomingCalls: 5,
              outgoingCalls: 11,
              otherOutgoingCalls: 1,
              connectedCalls: 13,
              failedCalls: 3,
              callsOverThirtySeconds: 9,
              connectedCallsOverThirtySeconds: 7,
              averageCallsPerDeal: 2,
              averageDurationSeconds: 92,
            },
          ],
        },
      ],
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
            totalDealCount: 16,
            totalCalls: 32,
            totalIncomingCalls: 10,
            totalOutgoingCalls: 22,
            totalOtherOutgoingCalls: 4,
            totalConnectedCalls: 26,
            totalFailedCalls: 6,
            totalCallsOverThirtySeconds: 20,
            totalConnectedCallsOverThirtySeconds: 14,
            warnings: [],
            managerRows: [
              {
                managerId: '7',
                managerName: 'Анна Петрова',
                dealCount: 8,
                totalCalls: 16,
                incomingCalls: 4,
                outgoingCalls: 12,
                otherOutgoingCalls: 2,
                connectedCalls: 13,
                failedCalls: 3,
                callsOverThirtySeconds: 10,
                connectedCallsOverThirtySeconds: 7,
                averageCallsPerDeal: 2,
                averageDurationSeconds: 80,
                stageBreakdown: [
                  {
                    stageId: 'CALL',
                    stageName: 'Звонок-знакомство',
                    dealCount: 6,
                    totalCalls: 12,
                    incomingCalls: 3,
                    outgoingCalls: 9,
                    otherOutgoingCalls: 2,
                    connectedCalls: 10,
                    failedCalls: 2,
                    callsOverThirtySeconds: 8,
                    connectedCallsOverThirtySeconds: 5,
                    averageCallsPerDeal: 2,
                    averageDurationSeconds: 76,
                  },
                ],
              },
            ],
          },
        },
      ],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.kpis).toEqual([
      expect.objectContaining({ label: 'Создано задач', value: '80', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Перенесён дедлайн', value: '0', delta: '—', deltaTone: 'neutral' }),
      expect.objectContaining({ label: 'Закрыто задач', value: '60', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Звонков на сделку', value: '2.5', delta: '+25%', deltaTone: 'positive' }),
      expect.objectContaining({ label: 'Задач на сделку', value: '4.0', delta: '0%', deltaTone: 'neutral' }),
    ])
    expect(scene.summaryRows).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        createdTasks: '40',
        closedTasks: '32',
        outgoing: '17',
        successfulCalls: '12',
        otherOutgoing: '0',
        incoming: '8',
        noAnswer: '5',
        comparePoints: [
          {
            label: 'С1',
            values: ['32', '24', '12', '7', '2', '3', '4'],
            deltas: ['+25%', '+33%', '+42%', '+71%', '-100%', '+67%', '+100%'],
          },
        ],
      }),
    ])
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        avgCalls: '2.5',
        totalCalls: '25',
        avgClosedTasks: '3.2',
        totalClosedTasks: '32',
        stages: [
          expect.objectContaining({
            label: 'Звонок-знакомство',
            totalCalls: '16',
            callsPerDeal: '2.0',
            totalClosedTasks: '18',
            closedTasksAvg: '2.3',
          }),
        ],
      }),
    ])
    expect(scene.warnings).toContain('Перенос дедлайна пока отключен')
  })

  it('explains when calls exist but are not linked to deals for calls-per-deal KPI', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCreatedCount: 0,
      totalRescheduledCount: 0,
      totalClosedCount: 0,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [],
      comparisons: [],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 0,
      totalCalls: 12,
      totalIncomingCalls: 1,
      totalOutgoingCalls: 11,
      totalOtherOutgoingCalls: 3,
      totalConnectedCalls: 8,
      totalFailedCalls: 4,
      totalCallsOverThirtySeconds: 5,
      totalConnectedCallsOverThirtySeconds: 4,
      warnings: [],
      managerRows: [],
      comparisons: [],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })
    const callsPerDeal = scene.kpis.find((metric) => metric.label === 'Звонков на сделку')

    expect(callsPerDeal).toEqual({
      label: 'Звонков на сделку',
      value: '—',
      note: 'есть звонки, но они не привязаны к сделкам',
      delta: 'нет привязки',
      deltaTone: 'neutral',
    })
  })

  it('does not invent zero compare values when the comparison base is missing', () => {
    const activities: ActivitiesWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 4,
      totalCreatedCount: 12,
      totalRescheduledCount: 0,
      totalClosedCount: 6,
      totalMeetingCount: 0,
      warnings: [],
      managerRows: [],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-30T00:00:00.000Z',
            to: '2026-04-05T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-30T00:00:00.000Z',
              to: '2026-04-05T23:59:59.999Z',
            },
            totalDealCount: 0,
            totalCreatedCount: 0,
            totalRescheduledCount: 0,
            totalClosedCount: 0,
            totalMeetingCount: 0,
            warnings: [],
            managerRows: [],
          },
        },
      ],
    }

    const calls: CallsWorkloadReport = {
      range: {
        from: '2026-04-06T00:00:00.000Z',
        to: '2026-04-12T23:59:59.999Z',
      },
      totalDealCount: 4,
      totalCalls: 8,
      totalIncomingCalls: 2,
      totalOutgoingCalls: 6,
      totalOtherOutgoingCalls: 1,
      totalConnectedCalls: 4,
      totalFailedCalls: 2,
      totalCallsOverThirtySeconds: 3,
      totalConnectedCallsOverThirtySeconds: 2,
      warnings: [],
      managerRows: [],
      comparisons: [
        {
          compareIndex: 1,
          range: {
            from: '2026-03-30T00:00:00.000Z',
            to: '2026-04-05T23:59:59.999Z',
          },
          snapshot: {
            range: {
              from: '2026-03-30T00:00:00.000Z',
              to: '2026-04-05T23:59:59.999Z',
            },
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
          },
        },
      ],
    }

    const scene = mapActivitiesCallsSceneData({ activities, calls })

    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({
          label: 'Звонков на сделку',
          compare: 'пред. период: 0.0',
        }),
        expect.not.objectContaining({
          label: 'Задач на сделку',
          compare: 'пред. период: 0.0',
        }),
      ]),
    )
    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Звонков на сделку',
          delta: '—',
        }),
        expect.objectContaining({
          label: 'Задач на сделку',
          delta: '—',
        }),
      ]),
    )
  })

  it('maps cohort report into matrix rows, cycle buckets and breakdown slices', () => {
    const report: CohortConversionReport = {
      range: {
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      totalCreatedDeals: 20,
      totalClosedDeals: 15,
      totalWonDeals: 10,
      closureMonths: ['2026-02', '2026-03', '2026-04', '2026-05'],
      relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
      rows: [
        {
          createdMonth: '2026-01',
          createdDeals: 10,
          closedDeals: 8,
          wonDeals: 6,
          closedRate: 80,
          wonConversionRate: 60,
          averageDaysToClose: 53,
          averageDaysToWin: 49,
          closureBuckets: [
            { closedMonth: '2026-01', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { closedMonth: '2026-02', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { closedMonth: '2026-03', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
            { closedMonth: '2026-04', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
          ],
          relativeClosureBuckets: [
            { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
            { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 2, wonDeals: 1, closedRate: 20, wonConversionRate: 10 },
            { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 2, closedRate: 20, wonConversionRate: 20 },
          ],
        },
      ],
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
            totalCreatedDeals: 16,
            totalClosedDeals: 11,
            totalWonDeals: 8,
            closureMonths: ['2026-01', '2026-02', '2026-03'],
            relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
            rows: [
              {
                createdMonth: '2025-12',
                createdDeals: 8,
                closedDeals: 6,
                wonDeals: 4,
                closedRate: 75,
                wonConversionRate: 50,
                averageDaysToClose: 58,
                averageDaysToWin: 54,
                closureBuckets: [],
                relativeClosureBuckets: [
                  { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
                  { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 2, wonDeals: 1, closedRate: 25, wonConversionRate: 12.5 },
                  { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 1, wonDeals: 1, closedRate: 12.5, wonConversionRate: 12.5 },
                  { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 2, wonDeals: 1, closedRate: 25, wonConversionRate: 12.5 },
                ],
              },
            ],
          },
        },
      ],
    }

    const scene = mapCohortSceneData({
      report,
      managerBreakdowns: [
        {
          key: '7',
          label: 'Анна Петрова',
          report: {
            totalCreatedDeals: 10,
            totalClosedDeals: 8,
            totalWonDeals: 6,
            rows: report.rows,
          },
        },
      ],
      sourceBreakdowns: [
        {
          key: 'WEB',
          label: 'Платный поиск',
          report: {
            totalCreatedDeals: 10,
            totalClosedDeals: 8,
            totalWonDeals: 6,
            rows: report.rows,
          },
        },
      ],
    })

    expect(scene.range).toEqual(report.range)
    expect(scene.kpis).toEqual([
      expect.objectContaining({ label: 'Средняя когортная конверсия', value: '60%', delta: '+10 п.п.' }),
      expect.objectContaining({ label: 'В 1 месяц', value: '20%', delta: '+8 п.п.' }),
      expect.objectContaining({ label: 'Во 2 месяц', value: '20%', delta: '+8 п.п.' }),
      expect.objectContaining({ label: 'В 3 месяц', value: '10%', delta: '-2 п.п.' }),
      expect.objectContaining({ label: 'В 4+ месяц', value: '20%', delta: '+8 п.п.' }),
      expect.objectContaining({ label: 'Средний цикл', value: '49 дн.', delta: '-5 дн.' }),
    ])
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        month: 'Январь 2026',
        createdDeals: '10',
        cells: [
          { value: '2', subvalue: '20%', level: 5 },
          { value: '2', subvalue: '20%', level: 5 },
          { value: '1', subvalue: '10%', level: 3 },
          { value: '2', subvalue: '20%', level: 5 },
        ],
        conversion: '60%',
        cycle: '49 дн.',
      }),
    ])
    expect(scene.distributionBuckets).toEqual([
      expect.objectContaining({ label: 'В 1 месяц', value: '20%', compare: 'предыдущий период: 12%', delta: '+8 п.п.' }),
      expect.objectContaining({ label: 'Во 2 месяц', value: '20%', compare: 'предыдущий период: 12%', delta: '+8 п.п.' }),
      expect.objectContaining({ label: 'В 3 месяц', value: '10%', compare: 'предыдущий период: 12%', delta: '-2 п.п.' }),
      expect.objectContaining({ label: 'В 4+ месяц', value: '20%', compare: 'предыдущий период: 12%', delta: '+8 п.п.' }),
    ])
    expect(scene.managerDistribution).toEqual([
      expect.objectContaining({
        manager: 'Анна Петрова',
        month1: '20%',
        month2: '20%',
        month3: '10%',
        tail: '20%',
      }),
    ])
    expect(scene.sourceDistribution).toEqual([
      expect.objectContaining({
        manager: 'Платный поиск',
        month1: '20%',
        month2: '20%',
        month3: '10%',
        tail: '20%',
      }),
    ])
  })

  it('formats sub-one-percent values without collapsing them to zero', () => {
    const scene = mapCohortSceneData({
      report: {
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        totalCreatedDeals: 200,
        totalClosedDeals: 1,
        totalWonDeals: 1,
        closureMonths: ['2026-04'],
        relativeBucketKeys: ['month_1', 'month_2', 'month_3', 'month_4_plus'],
        rows: [
          {
            createdMonth: '2026-04',
            createdDeals: 200,
            closedDeals: 1,
            wonDeals: 1,
            closedRate: 0.5,
            wonConversionRate: 0.5,
            averageDaysToClose: 12,
            averageDaysToWin: 12,
            closureBuckets: [],
            relativeClosureBuckets: [
              { bucketKey: 'month_1', label: 'В 1 месяц', closedDeals: 1, wonDeals: 1, closedRate: 0.5, wonConversionRate: 0.5 },
              { bucketKey: 'month_2', label: 'Во 2 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_3', label: 'В 3 месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
              { bucketKey: 'month_4_plus', label: 'В 4+ месяц', closedDeals: 0, wonDeals: 0, closedRate: 0, wonConversionRate: 0 },
            ],
          },
        ],
        comparisons: [],
      },
      managerBreakdowns: [],
      sourceBreakdowns: [],
    })

    expect(scene.kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Средняя когортная конверсия', value: '<1%' }),
        expect.objectContaining({ label: 'В 1 месяц', value: '<1%' }),
      ]),
    )
    expect(scene.matrixRows).toEqual([
      expect.objectContaining({
        cells: [
          expect.objectContaining({ subvalue: '<1%' }),
          expect.objectContaining({ subvalue: '0%' }),
          expect.objectContaining({ subvalue: '0%' }),
          expect.objectContaining({ subvalue: '0%' }),
        ],
      }),
    ])
  })

  it('maps toc report into current and comparison stage tables with bottleneck summary', () => {
    const scene = mapTocFlowSceneData({
      report: {
        range: {
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        businessDays: 22,
        warnings: [],
        estimatedGainPerDay: null,
        rows: [
          {
            stageId: 'CALL',
            stageName: 'Звонок-знакомство',
            stageSemanticId: null,
            sortOrder: 10,
            enteredDeals: 40,
            movedNextDeals: 20,
            throughputPerDay: 0.91,
            queueEnd: 15,
            queueBufferDays: 16.48,
            averageStageDurationDays: 4.5,
          },
          {
            stageId: 'PROBLEM',
            stageName: 'Проблематизация',
            stageSemanticId: null,
            sortOrder: 20,
            enteredDeals: 28,
            movedNextDeals: 8,
            throughputPerDay: 0.36,
            queueEnd: 17,
            queueBufferDays: 47.22,
            averageStageDurationDays: 9.2,
          },
        ],
        bottleneck: {
          stageId: 'PROBLEM',
          stageName: 'Проблематизация',
          throughputPerDay: 0.36,
          queueEnd: 17,
          queueBufferDays: 47.22,
        },
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
              businessDays: 21,
              warnings: [],
              estimatedGainPerDay: null,
              rows: [
                {
                  stageId: 'CALL',
                  stageName: 'Звонок-знакомство',
                  stageSemanticId: null,
                  sortOrder: 10,
                  enteredDeals: 36,
                  movedNextDeals: 22,
                  throughputPerDay: 1.05,
                  queueEnd: 10,
                  queueBufferDays: 9.52,
                  averageStageDurationDays: 3.8,
                },
                {
                  stageId: 'PROBLEM',
                  stageName: 'Проблематизация',
                  stageSemanticId: null,
                  sortOrder: 20,
                  enteredDeals: 25,
                  movedNextDeals: 10,
                  throughputPerDay: 0.48,
                  queueEnd: 11,
                  queueBufferDays: 22.92,
                  averageStageDurationDays: 6.4,
                },
              ],
              bottleneck: {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                throughputPerDay: 0.48,
                queueEnd: 11,
                queueBufferDays: 22.92,
              },
            },
          },
        ],
      },
      managerBreakdowns: [
        {
          key: '78',
          label: 'Егоров Андрей',
          report: {
            rows: [
              {
                stageId: 'CALL',
                stageName: 'Звонок-знакомство',
                stageSemanticId: null,
                sortOrder: 10,
                enteredDeals: 10,
                movedNextDeals: 5,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
              {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                stageSemanticId: null,
                sortOrder: 20,
                enteredDeals: 4,
                movedNextDeals: 1,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
            ],
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
                  businessDays: 0,
                  warnings: [],
                  estimatedGainPerDay: null,
                  bottleneck: null,
                  rows: [
                    {
                      stageId: 'CALL',
                      stageName: 'Звонок-знакомство',
                      stageSemanticId: null,
                      sortOrder: 10,
                      enteredDeals: 12,
                      movedNextDeals: 7,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                    {
                      stageId: 'PROBLEM',
                      stageName: 'Проблематизация',
                      stageSemanticId: null,
                      sortOrder: 20,
                      enteredDeals: 5,
                      movedNextDeals: 2,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          key: '11234',
          label: 'Ромашова Ольга',
          report: {
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
              {
                stageId: 'PROBLEM',
                stageName: 'Проблематизация',
                stageSemanticId: null,
                sortOrder: 20,
                enteredDeals: 6,
                movedNextDeals: 3,
                throughputPerDay: 0,
                queueEnd: 0,
                queueBufferDays: null,
                averageStageDurationDays: 0,
              },
            ],
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
                  businessDays: 0,
                  warnings: [],
                  estimatedGainPerDay: null,
                  bottleneck: null,
                  rows: [
                    {
                      stageId: 'CALL',
                      stageName: 'Звонок-знакомство',
                      stageSemanticId: null,
                      sortOrder: 10,
                      enteredDeals: 9,
                      movedNextDeals: 7,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                    {
                      stageId: 'PROBLEM',
                      stageName: 'Проблематизация',
                      stageSemanticId: null,
                      sortOrder: 20,
                      enteredDeals: 5,
                      movedNextDeals: 2,
                      throughputPerDay: 0,
                      queueEnd: 0,
                      queueBufferDays: null,
                      averageStageDurationDays: 0,
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    })

    expect(scene.kpis).toEqual([
      expect.objectContaining({ label: 'Сделок в работе', value: '32', delta: '+52%' }),
      expect.objectContaining({ label: 'Выход за период', value: '28', delta: '-12%', deltaTone: 'negative' }),
      expect.objectContaining({ label: 'Главное ограничение', value: 'Проблематизация' }),
      expect.objectContaining({ label: 'Средний WIP', value: '16' }),
      expect.objectContaining({ label: 'Средний цикл этапа', value: '6.9 дн.', delta: '+1.7 дн.', deltaTone: 'negative' }),
    ])
    expect(scene.currentStages).toEqual([
      expect.objectContaining({
        stage: 'Звонок-знакомство',
        entered: 40,
        throughputPerDay: 0.91,
        queueEnd: 15,
        avgCycleDays: 4.5,
      }),
      expect.objectContaining({
        stage: 'Проблематизация',
        note: 'Главное ограничение периода',
      }),
    ])
    expect(scene.compareStages).toEqual([
      expect.objectContaining({
        stage: 'Звонок-знакомство',
        throughputPerDay: 1.05,
      }),
      expect.objectContaining({
        stage: 'Проблематизация',
      }),
    ])
    expect(scene.focus).toEqual(
      expect.objectContaining({
        bottleneckStage: 'Проблематизация',
        compareBottleneckStage: 'Проблематизация',
        maxQueueStage: 'Проблематизация',
        throughputDropStage: 'Звонок-знакомство',
      }),
    )
    expect(scene.managerConversionRows).toEqual([
      {
        manager: 'Ромашова Ольга',
        averageConversion: '64%',
        stages: [
          { stage: 'Звонок-знакомство', conversion: '75%', volume: '6 / 8', level: 4 },
          { stage: 'Проблематизация', conversion: '50%', volume: '3 / 6', level: 3 },
        ],
      },
      {
        manager: 'Егоров Андрей',
        averageConversion: '42%',
        stages: [
          { stage: 'Звонок-знакомство', conversion: '50%', volume: '5 / 10', level: 3 },
          { stage: 'Проблематизация', conversion: '25%', volume: '1 / 4', level: 2 },
        ],
      },
    ])
    expect(scene.stableLeaders).toEqual([
      {
        stage: 'Звонок-знакомство',
        manager: 'Ромашова Ольга',
        conversion: '75%',
        volume: '6 / 8',
        compareConversion: '77%',
        compareVolume: '7 / 9',
        stabilityLabel: 'Устойчив',
        stabilityTone: 'positive',
      },
      {
        stage: 'Проблематизация',
        manager: 'Ромашова Ольга',
        conversion: '50%',
        volume: '3 / 6',
        compareConversion: '40%',
        compareVolume: '2 / 5',
        stabilityLabel: 'Устойчив',
        stabilityTone: 'positive',
      },
    ])
  })
})
