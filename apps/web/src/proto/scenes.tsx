import { useEffect, useMemo, useState, type ReactNode } from 'react'

import type {
  ActivitiesWorkloadReport,
  AcquisitionOutcomesReport,
  DashboardData,
  ManagerActionOutcomeDealDetail,
  ManagerActionOutcomeReport,
  SalesPlanData,
  SalesPlanDraftRow,
  SalesDealRow,
  SalesManagerGroup,
  TargetGroupConversionReport,
} from '@/lib/dashboard-types'
import {
  formatAmount,
  formatInteger,
  formatPercent,
  formatShortDate,
} from '@/lib/formatters'
import type {
  ActivityMatrixRow,
  ActivityMatrixStageRow,
  ActivitySummaryRow,
  CohortDistributionBucket,
  CohortDistributionRow,
  CohortMatrixRow,
  FlowStageMetric,
  PickerOption,
  ProtoFilterState,
  ProtoScene,
  SceneComponentProps,
  TocStageDistribution,
} from '@/proto/types'

type SalesRow = {
  source: string
  created: string
  quality: string
  ready: string
  intro: string
  won: string
  cycle: string
}

type Tone = 'positive' | 'negative' | 'neutral'
type ActivitySummarySort = {
  index: number
  direction: 'asc' | 'desc'
}
type StaticActivityMatrixRow = Omit<ActivityMatrixRow, 'totalCalls' | 'totalClosedTasks' | 'stages'> & {
  stages: Array<Omit<ActivityMatrixStageRow, 'totalCalls' | 'totalClosedTasks'>>
}

const SHOW_ACTIVITY_MATRIX = false
const SHOW_TARGET_GROUP_CONVERSION = false
const SHOW_ACTION_OUTCOME_WIP = true
const SHOW_SALES_SECONDARY_REPORTS = false

const attachActivityMatrixTotals = (rows: StaticActivityMatrixRow[]): ActivityMatrixRow[] =>
  rows.map((row) => ({
    ...row,
    totalCalls: '0',
    totalClosedTasks: '0',
    stages: row.stages.map((stage) => ({
      ...stage,
      totalCalls: '0',
      totalClosedTasks: '0',
    })),
  }))

const salesRows: SalesRow[] = [
  { source: 'Платный поиск', created: '68', quality: '41', ready: '33', intro: '24', won: '12', cycle: '26 дн.' },
  { source: 'Партнёры', created: '54', quality: '38', ready: '29', intro: '21', won: '14', cycle: '22 дн.' },
  { source: 'Вебинары', created: '37', quality: '19', ready: '14', intro: '9', won: '5', cycle: '34 дн.' },
  { source: 'Органика', created: '23', quality: '12', ready: '9', intro: '7', won: '3', cycle: '31 дн.' },
]

const activityRows: ActivitySummaryRow[] = [
  { manager: 'Анна Петрова', createdTasks: '118', outgoing: '88', successfulCalls: '57', otherOutgoing: '12', incoming: '42', noAnswer: '19', closedTasks: '104' },
  { manager: 'Илья Ковалёв', createdTasks: '96', outgoing: '72', successfulCalls: '41', otherOutgoing: '20', incoming: '37', noAnswer: '11', closedTasks: '79' },
  { manager: 'Марина Орлова', createdTasks: '103', outgoing: '91', successfulCalls: '63', otherOutgoing: '18', incoming: '28', noAnswer: '10', closedTasks: '84' },
  { manager: 'Ольга Лунёва', createdTasks: '88', outgoing: '63', successfulCalls: '39', otherOutgoing: '15', incoming: '24', noAnswer: '9', closedTasks: '77' },
]

const activityStages = [
  'База входящая',
  'Звонок-знакомство',
  'Встреча-знакомство',
  'Активация',
  'Проблематизация',
  'Демонстрация',
  'Адмиссия',
  'Контрактация',
  'На передаче',
]

const activityMatrixRows = attachActivityMatrixTotals([
  {
    manager: 'Анна Петрова',
    avgCalls: '2.9',
    avgClosedTasks: '4.8',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.4', closedTasksAvg: '0.9', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.9', closedTasksAvg: '1.6', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.8', closedTasksAvg: '1.1', level: 3 },
      { label: 'Активация', callsPerDeal: '0.7', closedTasksAvg: '1.0', level: 3 },
      { label: 'Проблематизация', callsPerDeal: '0.6', closedTasksAvg: '0.9', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Адмиссия', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'На передаче', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
    ],
  },
  {
    manager: 'Илья Ковалёв',
    avgCalls: '2.5',
    avgClosedTasks: '4.2',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.7', closedTasksAvg: '1.4', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.7', closedTasksAvg: '1.0', level: 3 },
      { label: 'Активация', callsPerDeal: '0.6', closedTasksAvg: '0.8', level: 2 },
      { label: 'Проблематизация', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'Адмиссия', callsPerDeal: '0.4', closedTasksAvg: '0.6', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.3', closedTasksAvg: '0.6', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.2', closedTasksAvg: '0.4', level: 1 },
    ],
  },
  {
    manager: 'Марина Орлова',
    avgCalls: '3.1',
    avgClosedTasks: '4.9',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.3', closedTasksAvg: '0.8', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '2.1', closedTasksAvg: '1.8', level: 5 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.9', closedTasksAvg: '1.2', level: 4 },
      { label: 'Активация', callsPerDeal: '0.8', closedTasksAvg: '1.1', level: 3 },
      { label: 'Проблематизация', callsPerDeal: '0.7', closedTasksAvg: '0.9', level: 3 },
      { label: 'Демонстрация', callsPerDeal: '0.6', closedTasksAvg: '0.8', level: 2 },
      { label: 'Адмиссия', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Контрактация', callsPerDeal: '0.4', closedTasksAvg: '0.7', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
    ],
  },
  {
    manager: 'Ольга Лунёва',
    avgCalls: '2.2',
    avgClosedTasks: '3.9',
    stages: [
      { label: 'База входящая', callsPerDeal: '0.3', closedTasksAvg: '0.7', level: 1 },
      { label: 'Звонок-знакомство', callsPerDeal: '1.5', closedTasksAvg: '1.3', level: 4 },
      { label: 'Встреча-знакомство', callsPerDeal: '0.6', closedTasksAvg: '0.9', level: 2 },
      { label: 'Активация', callsPerDeal: '0.5', closedTasksAvg: '0.8', level: 2 },
      { label: 'Проблематизация', callsPerDeal: '0.5', closedTasksAvg: '0.7', level: 2 },
      { label: 'Демонстрация', callsPerDeal: '0.4', closedTasksAvg: '0.6', level: 1 },
      { label: 'Адмиссия', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
      { label: 'Контрактация', callsPerDeal: '0.3', closedTasksAvg: '0.5', level: 1 },
      { label: 'На передаче', callsPerDeal: '0.2', closedTasksAvg: '0.4', level: 1 },
    ],
  },
])

const cohortRows: CohortMatrixRow[] = [
  {
    month: 'Октябрь 2025',
    createdDeals: '92',
    cells: [
      { value: '6', subvalue: '7%', level: 3 },
      { value: '11', subvalue: '12%', level: 5 },
      { value: '7', subvalue: '8%', level: 4 },
      { value: '4', subvalue: '4%', level: 2 },
    ],
    conversion: '31%',
    cycle: '59 дн.',
  },
  {
    month: 'Ноябрь 2025',
    createdDeals: '101',
    cells: [
      { value: '5', subvalue: '5%', level: 2 },
      { value: '13', subvalue: '13%', level: 5 },
      { value: '8', subvalue: '8%', level: 4 },
      { value: '6', subvalue: '6%', level: 2 },
    ],
    conversion: '29%',
    cycle: '63 дн.',
  },
  {
    month: 'Декабрь 2025',
    createdDeals: '108',
    cells: [
      { value: '4', subvalue: '4%', level: 2 },
      { value: '10', subvalue: '9%', level: 4 },
      { value: '9', subvalue: '8%', level: 4 },
      { value: '9', subvalue: '8%', level: 3 },
    ],
    conversion: '26%',
    cycle: '67 дн.',
  },
  {
    month: 'Январь 2026',
    createdDeals: '114',
    cells: [
      { value: '3', subvalue: '3%', level: 1 },
      { value: '9', subvalue: '8%', level: 4 },
      { value: '11', subvalue: '10%', level: 5 },
      { value: '10', subvalue: '9%', level: 3 },
    ],
    conversion: '24%',
    cycle: '71 дн.',
  },
]

const stagePressure = [
  { label: 'Качество “Готов ко встрече”', value: 77, note: '74 сделки в статусе качества' },
  { label: 'Звонок-знакомство', value: 58, note: '51 сделка перешла в первый звонок' },
  { label: 'Встреча проведена', value: 39, note: '34 сделки дошли до встречи' },
  { label: 'Коммерческое предложение', value: 28, note: '25 сделок дошли до оффера' },
  { label: 'Выиграно', value: 21, note: '18 успешных закрытий' },
]

const cycleBuckets: CohortDistributionBucket[] = [
  { label: 'В 1 месяц', value: '8%', compare: '7%', delta: '+1 п.п.', width: 32 },
  { label: 'Во 2 месяц', value: '9%', compare: '8%', delta: '+1 п.п.', width: 44 },
  { label: 'В 3 месяц', value: '5%', compare: '6%', delta: '-1 п.п.', width: 24 },
  { label: 'В 4+ месяц', value: '2%', compare: '3%', delta: '-1 п.п.', width: 14 },
]

const activitySummaryDeltas: Record<string, string[]> = {
  'Анна Петрова': ['+9%', '+8%', '+6%', '+12%', '+3%', '-5%', '+4%'],
  'Илья Ковалёв': ['-3%', '-2%', '+2%', '+7%', '+5%', '+4%', '+1%'],
  'Марина Орлова': ['+14%', '+10%', '+11%', '+15%', '+4%', '-8%', '-6%'],
  'Ольга Лунёва': ['+4%', '+6%', '-2%', '+5%', '+1%', '-11%', '+3%'],
}

const cohortManagerDistribution: CohortDistributionRow[] = [
  { manager: 'Анна Петрова', month1: '7%', month2: '12%', month3: '6%', tail: '2%', width: 82 },
  { manager: 'Марина Орлова', month1: '9%', month2: '10%', month3: '5%', tail: '3%', width: 76 },
  { manager: 'Илья Ковалёв', month1: '6%', month2: '8%', month3: '4%', tail: '2%', width: 62 },
  { manager: 'Ольга Лунёва', month1: '5%', month2: '7%', month3: '4%', tail: '1%', width: 54 },
]

const cohortSourceDistribution: CohortDistributionRow[] = [
  { manager: 'Платный поиск', month1: '8%', month2: '11%', month3: '4%', tail: '1%' },
  { manager: 'Партнёры', month1: '10%', month2: '9%', month3: '5%', tail: '2%' },
  { manager: 'Вебинары', month1: '4%', month2: '7%', month3: '6%', tail: '3%' },
  { manager: 'Органика', month1: '3%', month2: '6%', month3: '5%', tail: '4%' },
]

const funnelFlowCurrent: FlowStageMetric[] = [
  { stage: 'База входящая', entered: 128, throughputPerDay: 23, queueEnd: 84, avgCycleDays: 3.6, note: 'Новый приток без дефицита слотов' },
  { stage: 'Звонок-знакомство', entered: 112, throughputPerDay: 18, queueEnd: 61, avgCycleDays: 4.2, note: 'Нагрузка на первый каскад касаний' },
  { stage: 'Встреча-знакомство', entered: 86, throughputPerDay: 14, queueEnd: 42, avgCycleDays: 5.4, note: 'Календарь встреч уже плотный' },
  { stage: 'Активация', entered: 61, throughputPerDay: 11, queueEnd: 35, avgCycleDays: 6.1, note: 'Много ручного follow-up' },
  { stage: 'Проблематизация', entered: 48, throughputPerDay: 7, queueEnd: 33, avgCycleDays: 8.8, note: 'Главный затор недели' },
  { stage: 'Демонстрация', entered: 31, throughputPerDay: 6, queueEnd: 20, avgCycleDays: 7.1, note: 'Упираемся в слоты демонстраций' },
  { stage: 'Контрактация', entered: 19, throughputPerDay: 4, queueEnd: 12, avgCycleDays: 5.9, note: 'Финальная юридическая обработка' },
  { stage: 'На передаче', entered: 14, throughputPerDay: 3, queueEnd: 9, avgCycleDays: 4.3, note: 'Передача в производство' },
]

const funnelFlowCompare: FlowStageMetric[] = [
  { stage: 'База входящая', entered: 121, throughputPerDay: 21, queueEnd: 73, avgCycleDays: 3.2, note: 'Прошлый период' },
  { stage: 'Звонок-знакомство', entered: 101, throughputPerDay: 19, queueEnd: 52, avgCycleDays: 3.8, note: 'Прошлый период' },
  { stage: 'Встреча-знакомство', entered: 79, throughputPerDay: 17, queueEnd: 31, avgCycleDays: 4.6, note: 'Прошлый период' },
  { stage: 'Активация', entered: 58, throughputPerDay: 12, queueEnd: 29, avgCycleDays: 5.2, note: 'Прошлый период' },
  { stage: 'Проблематизация', entered: 44, throughputPerDay: 9, queueEnd: 24, avgCycleDays: 6.1, note: 'Прошлый период' },
  { stage: 'Демонстрация', entered: 28, throughputPerDay: 7, queueEnd: 18, avgCycleDays: 6.5, note: 'Прошлый период' },
  { stage: 'Контрактация', entered: 17, throughputPerDay: 5, queueEnd: 10, avgCycleDays: 5.2, note: 'Прошлый период' },
  { stage: 'На передаче', entered: 12, throughputPerDay: 3, queueEnd: 8, avgCycleDays: 4.0, note: 'Прошлый период' },
]

const emptyStageDistribution: TocStageDistribution = {
  totalCreatedDeals: 0,
  nodes: [],
  edges: [],
}

const funnelStageDistribution: TocStageDistribution = {
  totalCreatedDeals: 128,
  nodes: [
    { stageId: 'BASE', stage: 'База входящая', sortOrder: 1, count: 128, shareOfCreatedDeals: 100 },
    { stageId: 'CALL', stage: 'Звонок-знакомство', sortOrder: 2, count: 112, shareOfCreatedDeals: 88 },
    { stageId: 'MEETING', stage: 'Встреча-знакомство', sortOrder: 3, count: 86, shareOfCreatedDeals: 67 },
    { stageId: 'ACTIVATION', stage: 'Активация', sortOrder: 4, count: 61, shareOfCreatedDeals: 48 },
    { stageId: 'DEMO', stage: 'Демонстрация', sortOrder: 5, count: 43, shareOfCreatedDeals: 34 },
    { stageId: 'CONTRACT', stage: 'Контрактация', sortOrder: 6, count: 27, shareOfCreatedDeals: 21 },
    { stageId: 'HANDOFF', stage: 'На передаче', sortOrder: 7, count: 14, shareOfCreatedDeals: 11 },
    { stageId: 'BASKET', stage: 'Корзина', sortOrder: 8, count: 28, shareOfCreatedDeals: 22 },
    { stageId: 'RETURN', stage: 'Возврат в лидген', sortOrder: 9, count: 16, shareOfCreatedDeals: 13 },
  ],
  edges: [
    { id: 'created-BASE-0', fromStageId: null, fromStage: 'Создано', toStageId: 'BASE', toStage: 'База входящая', count: 128, conversionRate: 100 },
    { id: 'BASE-CALL-1', fromStageId: 'BASE', fromStage: 'База входящая', toStageId: 'CALL', toStage: 'Звонок-знакомство', count: 112, conversionRate: 88 },
    { id: 'BASE-RETURN-2', fromStageId: 'BASE', fromStage: 'База входящая', toStageId: 'RETURN', toStage: 'Возврат в лидген', count: 16, conversionRate: 13 },
    { id: 'CALL-MEETING-3', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'MEETING', toStage: 'Встреча-знакомство', count: 86, conversionRate: 77 },
    { id: 'CALL-BASKET-4', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'BASKET', toStage: 'Корзина', count: 18, conversionRate: 16 },
    { id: 'CALL-CONTRACT-5', fromStageId: 'CALL', fromStage: 'Звонок-знакомство', toStageId: 'CONTRACT', toStage: 'Контрактация', count: 8, conversionRate: 7 },
    { id: 'MEETING-ACTIVATION-6', fromStageId: 'MEETING', fromStage: 'Встреча-знакомство', toStageId: 'ACTIVATION', toStage: 'Активация', count: 61, conversionRate: 71 },
    { id: 'MEETING-DEMO-7', fromStageId: 'MEETING', fromStage: 'Встреча-знакомство', toStageId: 'DEMO', toStage: 'Демонстрация', count: 12, conversionRate: 14 },
    { id: 'ACTIVATION-DEMO-8', fromStageId: 'ACTIVATION', fromStage: 'Активация', toStageId: 'DEMO', toStage: 'Демонстрация', count: 31, conversionRate: 51 },
    { id: 'ACTIVATION-BASKET-9', fromStageId: 'ACTIVATION', fromStage: 'Активация', toStageId: 'BASKET', toStage: 'Корзина', count: 10, conversionRate: 16 },
    { id: 'DEMO-CONTRACT-10', fromStageId: 'DEMO', fromStage: 'Демонстрация', toStageId: 'CONTRACT', toStage: 'Контрактация', count: 19, conversionRate: 44 },
    { id: 'CONTRACT-HANDOFF-11', fromStageId: 'CONTRACT', fromStage: 'Контрактация', toStageId: 'HANDOFF', toStage: 'На передаче', count: 14, conversionRate: 52 },
  ],
}

function getManagerPickerOptions(runtimeData?: SceneComponentProps['runtimeData']) {
  return runtimeData?.managerOptions.length ? runtimeData.managerOptions : managerOptions
}

function getSourcePickerOptions(runtimeData?: SceneComponentProps['runtimeData']) {
  return runtimeData?.sourceOptions.length ? runtimeData.sourceOptions : sourceOptions
}

function getActivitiesSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.activitiesCalls) {
    return runtimeData.activitiesCalls
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      kpis: [],
      warnings: [],
      managerCount: 0,
      stageCount: 0,
      summaryRows: [],
      matrixRows: [],
    }
  }

  return (
    {
      kpis: [],
      warnings: [],
      managerCount: activityRows.length,
      stageCount: activityStages.length,
      summaryRows: activityRows,
      matrixRows: activityMatrixRows,
    }
  )
}

function isVisibleActivityWarning(warning: string) {
  return !warning.toLowerCase().includes('deadline reschedule counts are disabled')
}

const activitySummaryColumns = [
  { index: 0, label: 'Создано задач' },
  { index: 1, label: 'Закрыто задач' },
  { index: 2, label: 'Исходящие', hint: 'успешные + прочие + недозвоны' },
  { index: 3, label: 'Успешные >30 сек' },
  { index: 4, label: 'Прочие исходящие' },
  { index: 5, label: 'Недозвоны' },
  { index: 6, label: 'Входящие' },
]

function getActivitySummaryCells(row: ActivitySummaryRow) {
  return [
    { key: 'created', value: row.createdTasks },
    { key: 'closed', value: row.closedTasks },
    {
      key: 'outgoing',
      value: row.outgoing,
      helper: `= ${row.successfulCalls} + ${row.otherOutgoing} + ${row.noAnswer}`,
    },
    { key: 'successful', value: row.successfulCalls },
    { key: 'other', value: row.otherOutgoing },
    { key: 'no-answer', value: row.noAnswer },
    { key: 'incoming', value: row.incoming },
  ]
}

function sortActivitySummaryRows(rows: ActivitySummaryRow[], sort: ActivitySummarySort) {
  return [...rows].sort((left, right) => {
    const leftValue = left.sortValues?.[sort.index] ?? 0
    const rightValue = right.sortValues?.[sort.index] ?? 0
    const result = leftValue === rightValue
      ? left.manager.localeCompare(right.manager, 'ru-RU')
      : leftValue - rightValue

    return sort.direction === 'asc' ? result : -result
  })
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean
  direction: ActivitySummarySort['direction']
}) {
  return (
    <span
      className={[
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition',
        active
          ? 'border-slate-300 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600',
      ].join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        {active ? (
          <path
            d={direction === 'desc' ? 'M4 6.5 8 10.5 12 6.5' : 'M4 9.5 8 5.5 12 9.5'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <path d="M5 6.25 8 3.25 11 6.25" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 9.75 8 12.75 11 9.75" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
    </span>
  )
}

function DisclosureIndicator({ expanded }: { expanded: boolean }) {
  return (
    <span
      className={[
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition',
        expanded
          ? 'border-slate-300 bg-slate-900 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600',
      ].join(' ')}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 16 16"
        className={['size-3.5 transition-transform duration-150', expanded ? 'rotate-90' : ''].join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 4.5 10 8 6 11.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function ActivityStageMetricCard({
  label,
  value,
  unit,
  average,
  delta,
}: {
  label: string
  value: string
  unit: string
  average: string
  delta?: string
}) {
  return (
    <div className="min-w-0 rounded-lg border border-white/70 bg-white/65 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <DeltaPill value={delta ?? '—'} />
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <strong className="text-lg leading-none text-slate-950 tabular-nums">{value}</strong>
        <span className="truncate text-[0.68rem] font-semibold text-slate-500">{unit}</span>
      </div>
      <div className="mt-1 truncate text-[0.68rem] font-medium text-slate-500">
        ср. {average} / сделку
      </div>
    </div>
  )
}

function getCohortSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.cohorts) {
    return runtimeData.cohorts
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      range: undefined,
      kpis: [],
      matrixRows: [],
      distributionBuckets: [],
      managerDistribution: [],
      sourceDistribution: [],
    }
  }

  return (
    {
      range: undefined,
      kpis: [],
      matrixRows: cohortRows,
      distributionBuckets: cycleBuckets,
      managerDistribution: cohortManagerDistribution,
      sourceDistribution: cohortSourceDistribution,
    }
  )
}

function getTocSceneData(runtimeData?: SceneComponentProps['runtimeData']) {
  if (runtimeData?.tocFlow) {
    return runtimeData.tocFlow
  }

  if (runtimeData && runtimeData.operationalStatus !== 'ready') {
    return {
      kpis: [],
      warnings: [],
      currentStages: [],
      compareStages: [],
      managerConversionRows: [],
      stableLeaders: [],
      stageDistribution: emptyStageDistribution,
      focus: {
        bottleneckStage: '',
        compareBottleneckStage: '',
        maxQueueStage: '',
        throughputDropStage: '',
      },
    }
  }

  return (
    {
      kpis: [],
      warnings: [],
      currentStages: funnelFlowCurrent,
      compareStages: funnelFlowCompare,
      managerConversionRows: [],
      stableLeaders: [],
      stageDistribution: funnelStageDistribution,
      focus: {
        bottleneckStage: 'Проблематизация',
        compareBottleneckStage: 'Проблематизация',
        maxQueueStage: 'База входящая',
        throughputDropStage: 'Звонок-знакомство',
      },
    }
  )
}

function formatFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatSignedNumber(value: number) {
  if (value === 0) {
    return '0'
  }

  return `${value > 0 ? '+' : '-'}${formatNumber(Math.abs(value))}`
}

function queueBufferDays(queue: number, throughputPerDay: number) {
  if (throughputPerDay <= 0) {
    return null
  }

  return queue / throughputPerDay
}

function conversionHeatColor(level: number) {
  if (level >= 4) {
    return 'rgba(22,163,74,0.16)'
  }

  if (level === 3) {
    return 'rgba(77,124,255,0.16)'
  }

  if (level === 2) {
    return 'rgba(245,158,11,0.15)'
  }

  if (level === 1) {
    return 'rgba(244,63,94,0.11)'
  }

  return 'rgba(148,163,184,0.1)'
}

function getCompareLabel(filters: ProtoFilterState) {
  const range = filters.compareRanges[0]

  if (!range) {
    return 'Сравнение: mock-период не выбран'
  }

  return `Сравнение: ${formatFilterDate(range.start)} - ${formatFilterDate(range.end)}`
}

function getCompareRangeLabel(filters: ProtoFilterState) {
  const range = filters.compareRanges[0]

  if (!range) {
    return '01.02.26 - 28.02.26'
  }

  return `${formatFilterDate(range.start)} - ${formatFilterDate(range.end)}`
}

function getFilterScopeLabel(filters: ProtoFilterState) {
  const managers = filters.managers.length === 0 ? 'все менеджеры' : `${filters.managers.length} менедж.`
  const sources = filters.sources.length === 0 ? 'все источники' : `${filters.sources.length} источн.`

  return `Срез: ${managers} / ${sources}`
}

function summarizeFilterSelection(
  selected: string[],
  options: PickerOption[],
  fallback: string,
) {
  if (selected.length === 0) {
    return fallback
  }

  const labels = options
    .filter((option) => selected.includes(option.id))
    .map((option) => option.label)

  return labels.length <= 2 ? labels.join(', ') : `${labels.length} выбрано`
}

function getStageDelta(level: number) {
  if (level >= 5) {
    return '+18%'
  }
  if (level === 4) {
    return '+11%'
  }
  if (level === 3) {
    return '+6%'
  }
  if (level === 2) {
    return '-3%'
  }

  return '-8%'
}

function getDeltaTone(value: string): Tone {
  if (value.startsWith('+')) {
    return 'positive'
  }
  if (value.startsWith('-')) {
    return 'negative'
  }

  return 'neutral'
}

function DeltaPill({ value }: { value: string }) {
  const tone = getDeltaTone(value)

  return (
    <span
      className={
        tone === 'positive'
          ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-bold text-emerald-700'
          : tone === 'negative'
            ? 'rounded-full bg-rose-50 px-2 py-0.5 text-[0.68rem] font-bold text-rose-700'
            : 'rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-bold text-slate-600'
      }
    >
      {value}
    </span>
  )
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function FunnelTocChart({
  current,
  compare,
  currentLabel,
  compareLabel,
}: {
  current: FlowStageMetric[]
  compare: FlowStageMetric[]
  currentLabel: string
  compareLabel: string
}) {
  const [hovered, setHovered] = useState<{
    x: number
    y: number
    title: string
    rows: string[]
  } | null>(null)
  const width = 920
  const height = 336
  const margin = { top: 28, right: 56, bottom: 92, left: 56 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const stageCount = current.length
  const slot = plotWidth / stageCount
  const barWidth = Math.min(22, slot * 0.2)
  const maxThroughput = Math.max(...current.map((stage) => stage.throughputPerDay), ...compare.map((stage) => stage.throughputPerDay), 1)
  const maxQueue = Math.max(...current.map((stage) => stage.queueEnd), ...compare.map((stage) => stage.queueEnd), 1)
  const throughputTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(maxThroughput * step))
  const queueTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(maxQueue * step))

  const barTop = (value: number) => margin.top + plotHeight - (value / maxThroughput) * plotHeight
  const lineY = (value: number) => margin.top + plotHeight - (value / maxQueue) * plotHeight

  const currentLinePoints = current.map((stage, index) => ({
    x: margin.left + slot * index + slot * 0.5,
    y: lineY(stage.queueEnd),
  }))

  const compareLinePoints = compare.map((stage, index) => ({
    x: margin.left + slot * index + slot * 0.5,
    y: lineY(stage.queueEnd),
  }))
  return (
    <section className="panel relative p-4" onMouseLeave={() => setHovered(null)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Пропускная способность и очереди
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            ПС/день показывает, сколько сделок этап реально проводит дальше. Очередь показывает, сколько осталось на этапе к концу периода.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="inline-flex h-4 w-3 rounded-[4px] bg-slate-900" />
            Текущий ПС
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="inline-flex h-4 w-3 rounded-[4px] bg-[rgba(77,124,255,0.18)] ring-1 ring-inset ring-blue-200" />
            ПС сравнение
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="relative inline-flex h-4 w-8 items-center">
              <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-blue-600" />
            </span>
            Очередь текущая
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="relative inline-flex h-4 w-8 items-center">
              <span
                className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #93c5fd 60%, transparent 60%)',
                  backgroundSize: '10px 3px',
                  backgroundRepeat: 'repeat-x',
                }}
              />
            </span>
            Очередь сравнение
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full">
        {throughputTicks.map((tick, index) => {
          const y = margin.top + (plotHeight / (throughputTicks.length - 1)) * index

          return (
            <g key={`grid-${index}-${tick}`}>
              <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="rgba(148,163,184,0.22)" />
              <text x={margin.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {formatNumber(throughputTicks[throughputTicks.length - 1 - index] ?? 0)}
              </text>
              <text x={width - margin.right + 10} y={y + 4} fontSize="11" fill="#64748b">
                {formatNumber(queueTicks[queueTicks.length - 1 - index] ?? 0)}
              </text>
            </g>
          )
        })}

        {current.map((stage, index) => {
          const baseX = margin.left + slot * index
          const currentBarX = baseX + slot * 0.24
          const compareBarX = currentBarX + barWidth + 6

          return (
            <g key={stage.stage}>
              <rect
                x={compareBarX}
                y={barTop(compare[index]?.throughputPerDay ?? 0)}
                width={barWidth}
                height={margin.top + plotHeight - barTop(compare[index]?.throughputPerDay ?? 0)}
                rx={8}
                fill="rgba(77,124,255,0.18)"
                data-testid={`toc-compare-bar-${index}`}
                onMouseEnter={() =>
                  setHovered({
                    x: compareBarX + barWidth * 0.5,
                    y: barTop(compare[index]?.throughputPerDay ?? 0),
                    title: stage.stage,
                    rows: [
                      `${compareLabel}: ПС ${formatNumber(compare[index]?.throughputPerDay ?? 0)} / день`,
                      `${compareLabel}: очередь ${formatNumber(compare[index]?.queueEnd ?? 0)}`,
                    ],
                  })
                }
              />
              <rect
                x={currentBarX}
                y={barTop(stage.throughputPerDay)}
                width={barWidth}
                height={margin.top + plotHeight - barTop(stage.throughputPerDay)}
                rx={8}
                fill="#0f172a"
                data-testid={`toc-current-bar-${index}`}
                onMouseEnter={() =>
                  setHovered({
                    x: currentBarX + barWidth * 0.5,
                    y: barTop(stage.throughputPerDay),
                    title: stage.stage,
                    rows: [
                      `${currentLabel}: ПС ${formatNumber(stage.throughputPerDay)} / день`,
                      `${currentLabel}: очередь ${formatNumber(stage.queueEnd)}`,
                      `Буфер: ${queueBufferDays(stage.queueEnd, stage.throughputPerDay)?.toFixed(1) ?? '—'} дн.`,
                    ],
                  })
                }
              />
              <text
                x={baseX + slot * 0.5}
                y={height - margin.bottom + 24}
                transform={`rotate(20 ${baseX + slot * 0.5} ${height - margin.bottom + 24})`}
                fontSize="11"
                fill="#475569"
              >
                {stage.stage}
              </text>
            </g>
          )
        })}

        <path d={buildLinePath(compareLinePoints)} fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeDasharray="8 6" />
        <path d={buildLinePath(currentLinePoints)} fill="none" stroke="#2563eb" strokeWidth="3" />

        {compareLinePoints.map((point, index) => (
          <circle
            key={`compare-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5}
            fill="#93c5fd"
            data-testid={`toc-compare-point-${index}`}
            onMouseEnter={() =>
              setHovered({
                x: point.x,
                y: point.y,
                title: compare[index]?.stage ?? '',
                rows: [
                  `${compareLabel}: очередь ${formatNumber(compare[index]?.queueEnd ?? 0)}`,
                  `${compareLabel}: ПС ${formatNumber(compare[index]?.throughputPerDay ?? 0)} / день`,
                ],
              })
            }
          />
        ))}
        {currentLinePoints.map((point, index) => (
          <circle
            key={`current-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={5.5}
            fill="#2563eb"
            data-testid={`toc-current-point-${index}`}
            onMouseEnter={() =>
              setHovered({
                x: point.x,
                y: point.y,
                title: current[index]?.stage ?? '',
                rows: [
                  `${currentLabel}: очередь ${formatNumber(current[index]?.queueEnd ?? 0)}`,
                  `${currentLabel}: ПС ${formatNumber(current[index]?.throughputPerDay ?? 0)} / день`,
                  `Буфер: ${queueBufferDays(current[index]?.queueEnd ?? 0, current[index]?.throughputPerDay ?? 0)?.toFixed(1) ?? '—'} дн.`,
                ],
              })
            }
          />
        ))}

        <text x={margin.left} y={16} fontSize="11" fill="#64748b">ПС/день</text>
        <text x={width - margin.right + 8} y={16} fontSize="11" fill="#64748b">Очередь</text>
      </svg>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">ПС/день</div>
          <div className="mt-1 text-sm text-slate-600">Сколько сделок этап проводит дальше за 1 рабочий день.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">Очередь</div>
          <div className="mt-1 text-sm text-slate-600">Сколько сделок осталось на этапе к концу выбранного периода.</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <div className="subtle-label">Буфер очереди</div>
          <div className="mt-1 text-sm text-slate-600">Очередь / ПС в днях. Вынесен ниже по каждому этапу, а в hover виден в контексте точки.</div>
        </div>
      </div>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-20 min-w-[220px] rounded-2xl border border-slate-200 bg-white/96 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
          style={{
            left: `${(hovered.x / width) * 100}%`,
            top: `${(hovered.y / height) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 14px))',
          }}
        >
          <div className="text-sm font-semibold text-slate-900">{hovered.title}</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            {hovered.rows.map((row) => (
              <div key={row}>{row}</div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatDistributionPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%'
  }

  if (value < 1) {
    return '<1%'
  }

  return `${Math.round(value)}%`
}

type DistributionStageTone = 'process' | 'success' | 'loss'

function getDistributionStageTone(stage: string): DistributionStageTone {
  if (/корзин|возврат|отказ|проиг|утер|лидген|неквал/i.test(stage)) {
    return 'loss'
  }

  if (/контракт|счет|счёт|успеш|won|оплат/i.test(stage)) {
    return 'success'
  }

  return 'process'
}

function getDistributionToneOrder(stage: string) {
  const tone = getDistributionStageTone(stage)

  if (tone === 'process') {
    return 0
  }

  if (tone === 'success') {
    return 1
  }

  return 2
}

function getDistributionSvgTone(stage: string) {
  const tone = getDistributionStageTone(stage)

  if (tone === 'loss') {
    return {
      accent: '#f97316',
      fill: '#fff7ed',
      ribbon: '#fb923c',
      stroke: '#fed7aa',
    }
  }

  if (tone === 'success') {
    return {
      accent: '#16a34a',
      fill: '#ecfdf5',
      ribbon: '#22c55e',
      stroke: '#bbf7d0',
    }
  }

  return {
    accent: '#2563eb',
    fill: '#eff6ff',
    ribbon: '#2563eb',
    stroke: '#bfdbfe',
  }
}

function splitDistributionStageLabel(value: string) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []

  for (const word of words) {
    const lastLine = lines.at(-1)
    if (!lastLine) {
      lines.push(word)
      continue
    }

    if (`${lastLine} ${word}`.length <= 21) {
      lines[lines.length - 1] = `${lastLine} ${word}`
    } else if (lines.length < 2) {
      lines.push(word)
    }
  }

  if (lines.length === 0) {
    return ['Без этапа']
  }

  const lastLine = lines[lines.length - 1] ?? ''
  if (lastLine.length > 24) {
    lines[lines.length - 1] = `${lastLine.slice(0, 21)}...`
  }

  return lines.slice(0, 2)
}

function getDistributionTransitionLabel(
  edge: Pick<TocStageDistribution['edges'][number], 'fromStageId' | 'fromStage' | 'toStage'>,
) {
  if (edge.fromStageId === null) {
    return `Старт выборки -> ${edge.toStage}`
  }

  return `${edge.fromStage} -> ${edge.toStage}`
}

function getDistributionStepLabel(step: number) {
  if (step === 0) {
    return 'Старт'
  }

  return `${step}-й этап`
}

function FunnelStageDistributionChart({
  distribution,
}: {
  distribution: TocStageDistribution
}) {
  const nodes = [...distribution.nodes].sort((left, right) => left.sortOrder - right.sortOrder)
  const nodeById = new Map(nodes.map((node) => [node.stageId, node]))
  const edges = distribution.edges.filter(
    (edge) =>
      nodeById.has(edge.toStageId) &&
      (edge.fromStageId === null || nodeById.has(edge.fromStageId)),
  )
  const hasData = nodes.length > 0 && edges.length > 0

  if (!hasData) {
    return (
      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Распределение этапов воронки
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Фактические переходы по созданным сделкам за выбранный период.
            </p>
          </div>
          <span className="badge-chip badge-neutral">ожидает stage-history</span>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
          API пока не передал фактические переходы между этапами для этого отчета.
        </div>
      </section>
    )
  }

  type StepVisualNode = {
    id: string
    stageId: string | null
    stage: string
    step: number
    count: number
    shareOfCreatedDeals: number
    sortOrder: number
  }
  type StepVisualEdge = {
    id: string
    edge: TocStageDistribution['edges'][number]
    fromVisualId: string
    toVisualId: string
    step: number
  }

  let visualColumns: StepVisualNode[][] = []
  let visualEdgeLinks: StepVisualEdge[] = []
  const routeNodes = distribution.routeNodes ?? []
  const routeEdges = distribution.routeEdges ?? []

  if (routeNodes.length > 0 && routeEdges.length > 0) {
    const routeColumnsByStep = new Map<number, StepVisualNode[]>()
    const routeNodeByKey = new Map<string, StepVisualNode>()

    for (const node of routeNodes) {
      if (!node.stageId || node.count <= 0) {
        continue
      }

      const visualNode: StepVisualNode = {
        id: node.id,
        stageId: node.stageId,
        stage: node.stage,
        step: node.step,
        count: node.count,
        shareOfCreatedDeals: node.shareOfCreatedDeals,
        sortOrder: node.sortOrder,
      }
      const column = routeColumnsByStep.get(node.step) ?? []
      column.push(visualNode)
      routeColumnsByStep.set(node.step, column)
      routeNodeByKey.set(`${node.step}->${node.stageId}`, visualNode)
    }

    visualColumns = Array.from(routeColumnsByStep.entries())
      .sort(([leftStep], [rightStep]) => leftStep - rightStep)
      .map(([, column]) =>
        column.sort((left, right) => {
          const byCount = right.count - left.count
          const byTone = getDistributionToneOrder(left.stage) - getDistributionToneOrder(right.stage)
          return byCount || byTone || left.sortOrder - right.sortOrder || left.stage.localeCompare(right.stage)
        }),
      )

    visualEdgeLinks = routeEdges.flatMap((edge) => {
      const fromNode = routeNodeByKey.get(`${edge.fromStep}->${edge.fromStageId}`)
      const toNode = routeNodeByKey.get(`${edge.toStep}->${edge.toStageId}`)

      if (!fromNode || !toNode) {
        return []
      }

      return [
        {
          id: edge.id,
          edge: {
            id: edge.id,
            fromStageId: edge.fromStageId,
            fromStage: edge.fromStage,
            toStageId: edge.toStageId,
            toStage: edge.toStage,
            count: edge.count,
            conversionRate: edge.conversionRate,
          },
          fromVisualId: fromNode.id,
          toVisualId: toNode.id,
          step: edge.toStep,
        },
      ]
    })
  }

  if (visualColumns.length === 0 || visualEdgeLinks.length === 0) {
    const rootEdges = edges
      .filter((edge) => edge.fromStageId === null)
      .sort((left, right) => {
        const leftStage = nodeById.get(left.toStageId)
        const rightStage = nodeById.get(right.toStageId)

        return right.count - left.count || (leftStage?.sortOrder ?? 0) - (rightStage?.sortOrder ?? 0)
      })
    const outgoingByStage = new Map<string, typeof edges>()
    for (const edge of edges) {
      if (!edge.fromStageId) {
        continue
      }

      const outgoing = outgoingByStage.get(edge.fromStageId) ?? []
      outgoing.push(edge)
      outgoingByStage.set(edge.fromStageId, outgoing)
    }
    const rootAnchorEdge =
      rootEdges.length === 1 &&
      /база|входящ/i.test(rootEdges[0]?.toStage ?? '') &&
      outgoingByStage.has(rootEdges[0]?.toStageId ?? '')
        ? rootEdges[0]
        : null
    const rootNode: StepVisualNode = {
      id: 'step-0-root',
      stageId: rootAnchorEdge?.toStageId ?? null,
      stage: rootAnchorEdge?.toStage ?? 'База входящая',
      step: 0,
      count: rootAnchorEdge?.count ?? distribution.totalCreatedDeals,
      shareOfCreatedDeals: rootAnchorEdge?.conversionRate ?? 100,
      sortOrder: rootAnchorEdge ? nodeById.get(rootAnchorEdge.toStageId)?.sortOrder ?? 0 : 0,
    }

    visualColumns = [[rootNode]]
    visualEdgeLinks = []
    const usedTransitionIds = new Set<string>()
    let previousStepNodes: StepVisualNode[] = [rootNode]
    const maxStepColumns = Math.min(6, nodes.length + 1)

    for (let step = 1; step <= maxStepColumns; step += 1) {
      const stepCandidates: Array<{
        edge: (typeof edges)[number]
        parentNode: StepVisualNode
      }> = []

      if (step === 1) {
        const firstStepEdges = rootAnchorEdge?.toStageId
          ? outgoingByStage.get(rootAnchorEdge.toStageId) ?? []
          : rootEdges

        for (const edge of firstStepEdges) {
          if (usedTransitionIds.has(edge.id)) {
            continue
          }
          stepCandidates.push({ edge, parentNode: rootNode })
        }
      } else {
        for (const parentNode of previousStepNodes) {
          if (!parentNode.stageId) {
            continue
          }

          for (const edge of outgoingByStage.get(parentNode.stageId) ?? []) {
            if (usedTransitionIds.has(edge.id)) {
              continue
            }
            stepCandidates.push({ edge, parentNode })
          }
        }
      }

      if (stepCandidates.length === 0) {
        break
      }

      const stepGroups = new Map<
        string,
        {
          count: number
          incoming: typeof stepCandidates
        }
      >()
      for (const candidate of stepCandidates) {
        const group = stepGroups.get(candidate.edge.toStageId) ?? {
          count: 0,
          incoming: [],
        }
        group.count += candidate.edge.count
        group.incoming.push(candidate)
        stepGroups.set(candidate.edge.toStageId, group)
      }

      const stepNodes = Array.from(stepGroups.entries())
        .map(([stageId, group]) => {
          const stageNode = nodeById.get(stageId)
          return {
            id: `step-${step}-${stageId}`,
            stageId,
            stage: stageNode?.stage ?? group.incoming[0]?.edge.toStage ?? stageId,
            step,
            count: group.count,
            shareOfCreatedDeals:
              distribution.totalCreatedDeals > 0 ? (group.count / distribution.totalCreatedDeals) * 100 : 0,
            sortOrder: stageNode?.sortOrder ?? step,
          } satisfies StepVisualNode
        })
        .sort((left, right) => {
          const byCount = right.count - left.count
          const byTone = getDistributionToneOrder(left.stage) - getDistributionToneOrder(right.stage)
          return byCount || byTone || left.sortOrder - right.sortOrder || left.stage.localeCompare(right.stage)
        })

      if (stepNodes.length === 0) {
        break
      }

      visualColumns.push(stepNodes)
      const stepNodeByStageId = new Map(stepNodes.map((stepNode) => [stepNode.stageId, stepNode]))
      for (const [stageId, group] of stepGroups.entries()) {
        const toNode = stepNodeByStageId.get(stageId)
        if (!toNode) {
          continue
        }

        for (const incoming of group.incoming) {
          if (usedTransitionIds.has(incoming.edge.id)) {
            continue
          }

          usedTransitionIds.add(incoming.edge.id)
          visualEdgeLinks.push({
            id: `step-${step}-${incoming.parentNode.id}-${incoming.edge.id}`,
            edge: incoming.edge,
            fromVisualId: incoming.parentNode.id,
            toVisualId: toNode.id,
            step,
          })
        }
      }

      previousStepNodes = stepNodes
    }
  }

  const nodeWidth = 178
  const nodeHeight = 92
  const columnGap = 190
  const rowGap = 58
  const paddingX = 50
  const columnTopY = 82
  const chartBottomPadding = 56
  const maxRows = Math.max(...visualColumns.map((column) => column.length), 1)
  const chartWidth =
    paddingX * 2 + visualColumns.length * nodeWidth + (visualColumns.length - 1) * columnGap
  const chartHeight = Math.max(
    430,
    columnTopY + maxRows * nodeHeight + (maxRows - 1) * rowGap + chartBottomPadding,
  )
  const layoutNodes = new Map<
    string,
    StepVisualNode & { x: number; y: number; width: number; height: number }
  >()

  visualColumns.forEach((columnNodes, columnIndex) => {
    const firstStepHeight =
      (visualColumns[1]?.length ?? 0) > 0
        ? (visualColumns[1]?.length ?? 0) * nodeHeight +
          ((visualColumns[1]?.length ?? 1) - 1) * rowGap
        : nodeHeight
    const startY =
      columnIndex === 0
        ? columnTopY + Math.min(180, Math.max(0, (firstStepHeight - nodeHeight) / 2))
        : columnTopY

    columnNodes.forEach((node, index) => {
      layoutNodes.set(node.id, {
        ...node,
        x: paddingX + columnIndex * (nodeWidth + columnGap),
        y: startY + index * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
      })
    })
  })

  const maxEdgeCount = Math.max(...visualEdgeLinks.map((link) => link.edge.count), 1)
  const visualEdges = visualEdgeLinks.flatMap((link) => {
    const fromNode = layoutNodes.get(link.fromVisualId)
    const toNode = layoutNodes.get(link.toVisualId)
    if (!fromNode || !toNode) {
      return []
    }

    const fromX = fromNode.x + fromNode.width
    const fromY = fromNode.y + fromNode.height / 2
    const toX = toNode.x
    const toY = toNode.y + toNode.height / 2
    const curve = Math.max(84, Math.abs(toX - fromX) * 0.5)

    return [
      {
        edge: link.edge,
        fromX,
        fromY,
        labelX: fromX + (toX - fromX) * 0.54,
        labelY: fromY + (toY - fromY) * 0.54,
        path: [
          `M ${fromX} ${fromY}`,
          `C ${fromX + curve} ${fromY}`,
          `${toX - curve} ${toY}`,
          `${toX} ${toY}`,
        ].join(' '),
        strokeWidth: Math.max(5, Math.min(24, (link.edge.count / maxEdgeCount) * 24)),
        toNode,
      },
    ]
  })
  const drawnEdges = [...visualEdges].sort((left, right) => right.edge.count - left.edge.count)
  const labeledEdges = visualEdges

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Распределение этапов воронки
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Проценты считаются от фактического предыдущего этапа; пропущенные этапы не докидываются.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="inline-flex h-2.5 w-8 rounded-full bg-blue-600" />
            Процент на линии от предыдущего этапа
          </span>
          <span className="rounded-full bg-white px-3 py-1">
            Создано: {formatNumber(distribution.totalCreatedDeals)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="subtle-label">Карта маршрутов</p>
          <p className="text-xs font-semibold text-slate-500">
            {formatNumber(nodes.length)} этапов · {formatNumber(edges.length)} переходов
          </p>
        </div>
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label="Визуальная карта фактических переходов по стадиям воронки"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="block min-w-[920px]"
            style={{ width: chartWidth, height: chartHeight }}
          >
            <title>Визуальная карта фактических переходов по стадиям воронки</title>
            <defs>
              <filter id="stage-distribution-node-shadow" x="-18%" y="-22%" width="136%" height="150%">
                <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
              </filter>
            </defs>

            {visualColumns.map((column, columnIndex) => {
              const x = paddingX + columnIndex * (nodeWidth + columnGap)
              return (
                <g key={`column-${columnIndex}`}>
                  <line
                    x1={x + nodeWidth / 2}
                    y1="36"
                    x2={x + nodeWidth / 2}
                    y2={chartHeight - 18}
                    stroke="#e2e8f0"
                    strokeDasharray="4 12"
                    strokeWidth="1"
                  />
                  <text x={x} y="24" fontSize="12" fontWeight="800" fill="#64748b">
                    {getDistributionStepLabel(column[0]?.step ?? columnIndex)}
                  </text>
                </g>
              )
            })}

            {drawnEdges.map((visualEdge) => {
              const tone = getDistributionSvgTone(visualEdge.edge.toStage)
              return (
                <path
                  key={`path-${visualEdge.edge.id}`}
                  d={visualEdge.path}
                  fill="none"
                  stroke={tone.ribbon}
                  strokeLinecap="round"
                  strokeOpacity={visualEdge.edge.fromStageId === null ? 0.2 : 0.28}
                  strokeWidth={visualEdge.strokeWidth}
                />
              )
            })}

            {labeledEdges.map((visualEdge, index) => {
              const tone = getDistributionSvgTone(visualEdge.edge.toStage)
              const label = formatDistributionPercent(visualEdge.edge.conversionRate)
              const labelWidth = Math.max(42, label.length * 9 + 18)
              const offsetY = ((index % 5) - 2) * 13

              return (
                <g
                  key={`label-${visualEdge.edge.id}`}
                  transform={`translate(${visualEdge.labelX - labelWidth / 2} ${visualEdge.labelY - 13 + offsetY})`}
                >
                  <rect
                    width={labelWidth}
                    height="24"
                    rx="12"
                    fill="#ffffff"
                    stroke={tone.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={labelWidth / 2}
                    y="16"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="800"
                    fill={tone.accent}
                  >
                    {label}
                  </text>
                </g>
              )
            })}

            {Array.from(layoutNodes.values()).map((node) => {
              const tone = getDistributionSvgTone(node.stage)
              const labelLines = splitDistributionStageLabel(node.stage)
              const percentY = labelLines.length > 1 ? 62 : 58

              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="16"
                    fill={tone.fill}
                    stroke={tone.stroke}
                    strokeWidth="1.5"
                    filter="url(#stage-distribution-node-shadow)"
                  />
                  <rect x="14" y="74" width={node.width - 28} height="4" rx="2" fill="#ffffff" />
                  <rect
                    x="14"
                    y="74"
                    width={(node.width - 28) * Math.max(0, Math.min(100, node.shareOfCreatedDeals)) / 100}
                    height="4"
                    rx="2"
                    fill={tone.accent}
                  />
                  {labelLines.map((line, index) => (
                    <text
                      key={`${node.id}-${line}`}
                      x="14"
                      y={24 + index * 15}
                      fontSize="12"
                      fontWeight="800"
                      fill="#0f172a"
                    >
                      {line}
                    </text>
                  ))}
                  <text x="14" y={percentY} fontSize="25" fontWeight="900" fill="#0f172a">
                    {formatDistributionPercent(node.shareOfCreatedDeals)}
                  </text>
                  <text x="88" y={percentY - 2} fontSize="11" fontWeight="800" fill="#64748b">
                    {formatNumber(node.count)} сдел.
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      <ul className="sr-only">
        {visualEdgeLinks.map((link) => (
          <li key={`route-text-${link.id}`}>
            {getDistributionTransitionLabel(link.edge)}: {formatDistributionPercent(link.edge.conversionRate)} ·{' '}
            {formatNumber(link.edge.count)} сдел.
          </li>
        ))}
      </ul>
    </section>
  )
}

export const managerOptions: PickerOption[] = [
  { id: '78', label: 'Егоров Андрей', meta: 'Менеджер' },
  { id: '11234', label: 'Ромашова Ольга', meta: 'Менеджер' },
  { id: '7824', label: 'Мусальникова Кристина', meta: 'Менеджер' },
  { id: '6994', label: 'Кузнецова Анастасия', meta: 'Менеджер' },
  { id: '7814', label: 'Дарья Бычкова', meta: 'Менеджер' },
  { id: '72', label: 'Крохалева Мария', meta: 'Менеджер' },
  { id: '2236', label: 'Потапова Мария', meta: 'Менеджер' },
  { id: '2764', label: 'Каньков Вячеслав', meta: 'Менеджер' },
]

export const sourceOptions: PickerOption[] = [
  { id: 'paid-search', label: 'Платный поиск', meta: 'Высокий интент' },
  { id: 'partners', label: 'Партнёры', meta: 'Реферальный поток' },
  { id: 'webinars', label: 'Вебинары', meta: 'Тёплые лиды' },
  { id: 'organic', label: 'Органика', meta: 'Поиск' },
  { id: 'events', label: 'События', meta: 'Оффлайн' },
]

function normalizeDateForInput(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(12, 0, 0, 0)

  return normalized
}

function shiftDate(date: Date, days: number) {
  const shifted = normalizeDateForInput(date)
  shifted.setDate(shifted.getDate() + days)

  return shifted
}

function formatDateInputValue(date: Date) {
  const normalized = normalizeDateForInput(date)
  const year = normalized.getFullYear()
  const month = String(normalized.getMonth() + 1).padStart(2, '0')
  const day = String(normalized.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function startOfCalendarWeek(date: Date) {
  const normalized = normalizeDateForInput(date)
  const daysSinceMonday = (normalized.getDay() + 6) % 7

  return shiftDate(normalized, -daysSinceMonday)
}

export function createDefaultFilters(today = new Date()): ProtoFilterState {
  const currentWeekStart = startOfCalendarWeek(today)
  const previousWeekStart = shiftDate(currentWeekStart, -7)
  const previousWeekEnd = shiftDate(previousWeekStart, 6)

  return {
    rangeStart: formatDateInputValue(previousWeekStart),
    rangeEnd: formatDateInputValue(previousWeekEnd),
    compareRanges: [],
    managers: [],
    sources: [],
  }
}

export const defaultFilters: ProtoFilterState = createDefaultFilters()

function PanelHeading({
  id,
  title,
  description,
  right,
}: {
  id?: string
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id={id} className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

function formatSalesDays(value: number) {
  return `${formatInteger(value)} д`
}

function formatOneDecimal(value: number) {
  return Number(value).toFixed(1).replace('.', ',')
}

function formatSalesHours(value: number) {
  return `${formatInteger(value)} ч`
}

function formatMeetingCount(value: number) {
  return `${formatInteger(value)} встреч`
}

function formatRatioPercent(value: number) {
  return `${formatPercent((value ?? 0) * 100)}%`
}

function formatCompareDelta(current: number, previous: number, kind: 'count' | 'amount' | 'rate' | 'days' = 'count') {
  if (!Number.isFinite(previous)) {
    return '—'
  }

  if (kind === 'rate') {
    return `${formatSignedNumber((current - previous) * 100)} п.п.`
  }

  if (kind === 'days') {
    return `${formatSignedNumber(current - previous)} дн.`
  }

  if (kind === 'amount') {
    return formatSignedNumber(current - previous)
  }

  return formatSignedNumber(current - previous)
}

function SalesDealDetails({ deal }: { deal: SalesDealRow }) {
  const detailFields = [
    { label: 'Итоговое качество', value: deal.qualityValue ?? '—' },
    { label: 'Источник', value: deal.sourceLabel ?? '—' },
    { label: 'Business club', value: deal.businessClubValue ?? '—' },
    { label: 'Таргет-группа', value: deal.targetGroupValue ?? '—' },
    { label: 'Тип встречи', value: deal.meetingTypeValue ?? '—' },
    { label: 'Дата встречи', value: deal.meetingDateValue ? formatShortDate(deal.meetingDateValue) : '—' },
    { label: 'Тариф', value: deal.tariffValue ?? '—' },
  ]

  return (
    <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white/75 p-4">
          <div className="subtle-label">Атрибуты продажи</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {detailFields.map((field) => (
              <div key={field.label} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <div className="subtle-label">{field.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/75 p-4">
          <div className="subtle-label">Когорта {deal.cohortContext.createdMonth || '—'}</div>
          <div className="mt-2 text-sm text-slate-700">
            <strong className="text-slate-950">
              {formatInteger(deal.cohortContext.cohortCreatedDeals)}
            </strong>{' '}
            создано в месяце сделки
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatInteger(deal.cohortContext.cohortWonDeals)} выиграно ·{' '}
            {formatPercent(deal.cohortContext.cohortWonConversionRate)}% конверсия
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/75 p-4">
          <div className="subtle-label">Дела, звонки и встречи</div>
          <div className="mt-2 text-sm text-slate-700">
            <strong className="text-slate-950">{formatInteger(deal.taskSummary.created)}</strong>{' '}
            создано дел · {formatInteger(deal.taskSummary.closed)} закрыто
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatInteger(deal.callSummary.incoming)} вход. ·{' '}
            {formatInteger(deal.callSummary.outgoing)} исход. ·{' '}
            {formatInteger(deal.callSummary.connectedOverThirtySeconds)} успешных &gt;30 сек
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatMeetingCount(deal.meetingSummary?.total ?? 0)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/75">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          <span>Этап</span>
          <span>Вход</span>
          <span className="text-right">Время</span>
        </div>
        <div className="divide-y divide-slate-100">
          {deal.stageTimeline.length > 0 ? (
            deal.stageTimeline.map((stage) => (
              <div
                key={`${deal.dealId}-${stage.stageId}-${stage.enteredAt}`}
                className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{stage.stageName}</div>
                  {stage.meetingEvents && stage.meetingEvents.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {stage.meetingEvents.map((meeting) => (
                        <span
                          key={meeting.activityId}
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800"
                        >
                          Встреча {formatShortDate(meeting.timelineAt)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="truncate text-xs text-slate-500">
                    до {formatShortDate(stage.leftAt)}
                  </div>
                </div>
                <span className="text-slate-500">{formatShortDate(stage.enteredAt)}</span>
                <span className="text-right font-semibold text-slate-900">
                  {formatSalesHours(stage.durationHours)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-sm text-slate-500">
              История этапов по сделке пока не подтянута.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SalesManagerBlock({
  group,
  expandedDeals,
  onToggleDeal,
}: {
  group: SalesManagerGroup
  expandedDeals: Set<string>
  onToggleDeal: (dealId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div>
          <h4 className="text-base font-bold text-slate-950">{group.managerName}</h4>
          <p className="text-sm text-slate-500">
            {formatInteger(group.totalWonDeals)} продаж · {formatAmount(group.totalSalesAmount)}
          </p>
        </div>
        <span className="badge-chip badge-neutral">
          средний чек{' '}
          {formatAmount(group.totalWonDeals === 0 ? 0 : group.totalSalesAmount / group.totalWonDeals)}
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {group.deals.map((deal) => {
          const isExpanded = expandedDeals.has(deal.dealId)

          return (
            <article key={deal.dealId} className="px-4 py-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(12rem,1.1fr)_7rem_6rem_8rem_11rem_7rem_auto] xl:items-center">
                <div className="min-w-0">
                  <h5 className="truncate text-base font-bold text-slate-950">{deal.dealId}</h5>
                  <p className="text-sm text-slate-500">
                    Передана {formatShortDate(deal.dateClosed)} · создана{' '}
                    {formatShortDate(deal.dateCreate)}
                  </p>
                </div>

                <div>
                  <div className="subtle-label">Сумма</div>
                  <div className="mt-1 font-bold text-slate-950">{formatAmount(deal.amount)}</div>
                </div>

                <div>
                  <div className="subtle-label">Цикл</div>
                  <div className="mt-1 font-bold text-slate-950">{formatSalesDays(deal.cycleDays)}</div>
                </div>

                <div>
                  <div className="subtle-label">Когорта</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {deal.cohortContext.createdMonth || '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(deal.cohortContext.cohortWonConversionRate)}% win
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Звонки</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {formatInteger(deal.callSummary.total)} всего
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatInteger(deal.callSummary.successful)} успешных ·{' '}
                    {formatInteger(deal.callSummary.failed)} недозвона
                  </div>
                </div>

                <div>
                  <div className="subtle-label">Дела</div>
                  <div className="mt-1 font-bold text-slate-950">
                    {formatInteger(deal.taskSummary.created)} / {formatInteger(deal.taskSummary.closed)}
                  </div>
                  <div className="text-xs text-slate-500">создано / закрыто</div>
                </div>

                <button
                  type="button"
                  className={isExpanded ? 'btn btn-dark' : 'btn btn-ghost'}
                  onClick={() => onToggleDeal(deal.dealId)}
                >
                  Подробнее
                </button>
              </div>

              {isExpanded ? <SalesDealDetails deal={deal} /> : null}
            </article>
          )
        })}
      </div>
    </div>
  )
}

function SalesManagersReport({
  dashboard,
  status,
  error,
}: {
  dashboard: DashboardData | undefined
  status: NonNullable<SceneComponentProps['runtimeData']>['operationalStatus'] | undefined
  error?: string | null | undefined
}) {
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(() => new Set())
  const groups = dashboard?.managerGroups ?? []
  const salesSummary = dashboard?.salesSummary
  const totalDeals = salesSummary?.salesCount ?? groups.reduce((total, group) => total + group.totalWonDeals, 0)

  function toggleDeal(dealId: string) {
    setExpandedDeals((current) => {
      const next = new Set(current)
      if (next.has(dealId)) {
        next.delete(dealId)
      } else {
        next.add(dealId)
      }

      return next
    })
  }

  return (
    <section className="panel p-5" aria-labelledby="sales-by-manager-title">
      <PanelHeading
        id="sales-by-manager-title"
        title="Продажи по менеджерам"
        description="Каждая строка - отдельная выигранная сделка с суммой, циклом, когортой, звонками, делами и историей этапов."
        right={<span className="badge-chip badge-neutral">{formatInteger(totalDeals)} продаж</span>}
      />

      {status === 'loading' && !dashboard ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
          Загружаю продажи из локальной базы.
        </div>
      ) : status === 'error' ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800"
        >
          {error ?? 'Не удалось загрузить продажи из локальной базы.'}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
          В выбранном периоде нет выигранных сделок.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <SalesManagerBlock
              key={group.managerId}
              group={group}
              expandedDeals={expandedDeals}
              onToggleDeal={toggleDeal}
            />
          ))}
        </div>
      )}
    </section>
  )
}

type SalesPlanFactRow = {
  key: string
  managerId: string
  managerName: string
  targetGroupKey: string
  targetGroupLabel: string
  plannedDeals: number
  plannedAmount: number
  actualDeals: number
  actualAmount: number
}

type EditableSalesPlanRow = SalesPlanDraftRow & {
  localId: string
}

const defaultSalesPlanTargetGroups = [
  'ClubFirst Russia',
  'ClubFirst Future',
  'ClubFirst One',
  'ClubFirst Guest',
  'ClubFirst Ladies',
  'ClubFirst GlobAll',
  'ClubFirst Kazakstan',
  'Атланты',
  'Маркетплейсы',
  'CTU',
].map((label) => ({ key: label, label }))

function addSalesPlanTargetGroupOption(
  options: Map<string, string>,
  key: string | null | undefined,
  label = key,
) {
  const normalizedKey = key?.trim()
  const normalizedLabel = label?.trim()
  if (!normalizedKey || !normalizedLabel) {
    return
  }

  options.set(normalizedKey, normalizedLabel)
}

function resolveDealTargetGroup(deal: SalesDealRow) {
  const value = deal.targetGroupValue?.trim() || deal.businessClubValue?.trim()

  return {
    key: value || 'Без таргет-группы',
    label: value || 'Без таргет-группы',
  }
}

function buildSalesPlanFactRows(
  dashboard: DashboardData | undefined,
  salesPlan: SalesPlanData | undefined,
) {
  const rows = new Map<string, SalesPlanFactRow>()

  function getOrCreateRow(input: {
    managerId: string
    managerName: string
    targetGroupKey: string
    targetGroupLabel: string
  }) {
    const key = `${input.managerId}::${input.targetGroupKey}`
    const existing = rows.get(key)
    if (existing) {
      if (input.managerName && existing.managerName === input.managerId) {
        existing.managerName = input.managerName
      }
      if (input.targetGroupLabel && existing.targetGroupLabel === input.targetGroupKey) {
        existing.targetGroupLabel = input.targetGroupLabel
      }
      return existing
    }

    const row: SalesPlanFactRow = {
      key,
      managerId: input.managerId,
      managerName: input.managerName || input.managerId,
      targetGroupKey: input.targetGroupKey,
      targetGroupLabel: input.targetGroupLabel || input.targetGroupKey,
      plannedDeals: 0,
      plannedAmount: 0,
      actualDeals: 0,
      actualAmount: 0,
    }
    rows.set(key, row)
    return row
  }

  for (const planRow of salesPlan?.rows ?? []) {
    const row = getOrCreateRow({
      managerId: planRow.managerId,
      managerName: planRow.managerName ?? planRow.managerId,
      targetGroupKey: planRow.targetGroupKey,
      targetGroupLabel: planRow.targetGroupLabel,
    })
    row.plannedDeals += planRow.plannedDeals
    row.plannedAmount += planRow.plannedAmount
  }

  for (const group of dashboard?.managerGroups ?? []) {
    for (const deal of group.deals) {
      const targetGroup = resolveDealTargetGroup(deal)
      const row = getOrCreateRow({
        managerId: group.managerId,
        managerName: group.managerName,
        targetGroupKey: targetGroup.key,
        targetGroupLabel: targetGroup.label,
      })
      row.actualDeals += 1
      row.actualAmount += deal.amount
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    const byManager = left.managerName.localeCompare(right.managerName, 'ru-RU')
    return byManager !== 0
      ? byManager
      : left.targetGroupLabel.localeCompare(right.targetGroupLabel, 'ru-RU')
  })
}

function sumSalesPlanFactRows(rows: SalesPlanFactRow[]) {
  return rows.reduce(
    (total, row) => ({
      plannedDeals: total.plannedDeals + row.plannedDeals,
      plannedAmount: total.plannedAmount + row.plannedAmount,
      actualDeals: total.actualDeals + row.actualDeals,
      actualAmount: total.actualAmount + row.actualAmount,
    }),
    {
      plannedDeals: 0,
      plannedAmount: 0,
      actualDeals: 0,
      actualAmount: 0,
    },
  )
}

function formatPlanCompletion(actual: number, planned: number) {
  if (planned <= 0) {
    return actual > 0 ? 'вне плана' : '—'
  }

  return `${formatInteger(Math.round((actual / planned) * 100))}%`
}

function SalesPlanFactSection({
  dashboard,
  salesPlan,
}: {
  dashboard: DashboardData | undefined
  salesPlan: SalesPlanData | undefined
}) {
  const rows = buildSalesPlanFactRows(dashboard, salesPlan)
  const totals = sumSalesPlanFactRows(rows)

  return (
    <section className="panel p-5">
      <PanelHeading
        title="План / факт продаж"
        description="Сверка сохраненного плана с выигранными сделками периода в разрезе менеджеров и таргет-группы/клуба заказчика."
        right={
          <span className="badge-chip badge-neutral">
            {formatInteger(totals.actualDeals)} / {formatInteger(totals.plannedDeals)} сделок
          </span>
        }
      />

      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Таргет-группа / клуб</th>
                <th className="px-3 py-3">План сделок</th>
                <th className="px-3 py-3">Факт сделок</th>
                <th className="px-3 py-3">% выполнения</th>
                <th className="px-3 py-3">План сумма</th>
                <th className="px-3 py-3">Факт сумма</th>
                <th className="px-3 py-3">Разрыв</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.managerName}</td>
                  <td className="px-3 py-3">{row.targetGroupLabel}</td>
                  <td className="px-3 py-3">{formatInteger(row.plannedDeals)}</td>
                  <td className="px-3 py-3">{formatInteger(row.actualDeals)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-900">
                    {formatPlanCompletion(row.actualDeals, row.plannedDeals)}
                  </td>
                  <td className="px-3 py-3">{formatAmount(row.plannedAmount)}</td>
                  <td className="px-3 py-3">{formatAmount(row.actualAmount)}</td>
                  <td className="px-3 py-3">{formatAmount(row.actualAmount - row.plannedAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-900">
                <td className="px-3 py-3" colSpan={2}>Итого</td>
                <td className="px-3 py-3">{formatInteger(totals.plannedDeals)}</td>
                <td className="px-3 py-3">{formatInteger(totals.actualDeals)}</td>
                <td className="px-3 py-3">
                  {formatPlanCompletion(totals.actualDeals, totals.plannedDeals)}
                </td>
                <td className="px-3 py-3">{formatAmount(totals.plannedAmount)}</td>
                <td className="px-3 py-3">{formatAmount(totals.actualAmount)}</td>
                <td className="px-3 py-3">{formatAmount(totals.actualAmount - totals.plannedAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="План продаж еще не заполнен, и фактических продаж в выбранном периоде нет." />
      )}
    </section>
  )
}

function toEditableSalesPlanRows(
  salesPlan: SalesPlanData | undefined,
  managers: PickerOption[],
  targetGroups: Array<{ key: string; label: string }> = [],
): EditableSalesPlanRow[] {
  if (salesPlan?.rows.length) {
    return salesPlan.rows.map((row, index) => ({
      localId: `${row.managerId}-${row.targetGroupKey}-${index}`,
      managerId: row.managerId,
      managerName: row.managerName,
      targetGroupKey: row.targetGroupKey,
      targetGroupLabel: row.targetGroupLabel,
      plannedDeals: row.plannedDeals,
      plannedAmount: row.plannedAmount,
    }))
  }

  const firstManager = managers[0]
  const firstTargetGroup = targetGroups[0]
  return [
    {
      localId: crypto.randomUUID(),
      managerId: firstManager?.id ?? '',
      managerName: firstManager?.label ?? null,
      targetGroupKey: firstTargetGroup?.key ?? '',
      targetGroupLabel: firstTargetGroup?.label ?? '',
      plannedDeals: 0,
      plannedAmount: 0,
    },
  ]
}

function collectTargetGroupOptions(
  dashboard: DashboardData | undefined,
  salesPlan: SalesPlanData | undefined,
  acquisitionOutcomes: AcquisitionOutcomesReport | undefined,
  targetGroupConversion: TargetGroupConversionReport | undefined,
) {
  const options = new Map<string, string>()

  for (const targetGroup of defaultSalesPlanTargetGroups) {
    addSalesPlanTargetGroupOption(options, targetGroup.key, targetGroup.label)
  }

  for (const planRow of salesPlan?.rows ?? []) {
    addSalesPlanTargetGroupOption(options, planRow.targetGroupKey, planRow.targetGroupLabel)
  }

  for (const group of dashboard?.managerGroups ?? []) {
    for (const deal of group.deals) {
      const targetGroup = resolveDealTargetGroup(deal)
      addSalesPlanTargetGroupOption(options, targetGroup.key, targetGroup.label)
    }
  }

  for (const managerRow of acquisitionOutcomes?.businessClubByManager ?? []) {
    for (const club of managerRow.businessClubs) {
      addSalesPlanTargetGroupOption(options, club.businessClubKey, club.businessClubLabel)
    }
    for (const targetGroup of managerRow.targetGroups) {
      addSalesPlanTargetGroupOption(options, targetGroup.targetGroupKey, targetGroup.targetGroupLabel)
    }
  }

  for (const row of targetGroupConversion?.rows ?? []) {
    addSalesPlanTargetGroupOption(options, row.targetGroupKey, row.targetGroupLabel)
  }

  return Array.from(options.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label, 'ru-RU'))
}

function SalesPlanScene({
  runtimeData,
  salesPlanMonth,
  salesPlanLoading,
  salesPlanSaving,
  salesPlanSaveError,
  onSalesPlanMonthChange,
  onSalesPlanSave,
}: SceneComponentProps) {
  const managers =
    runtimeData?.managerOptions.length ? runtimeData.managerOptions : managerOptions
  const salesPlan = runtimeData?.salesPlan
  const isPlanLocked = Boolean(salesPlanLoading || salesPlanSaving)
  const targetGroups = useMemo(
    () =>
      collectTargetGroupOptions(
        runtimeData?.salesDashboard,
        salesPlan,
        runtimeData?.acquisitionOutcomes,
        runtimeData?.targetGroupConversion,
      ),
    [
      runtimeData?.salesDashboard,
      runtimeData?.acquisitionOutcomes,
      runtimeData?.targetGroupConversion,
      salesPlan,
    ],
  )
  const [rows, setRows] = useState<EditableSalesPlanRow[]>(() =>
    toEditableSalesPlanRows(salesPlan, managers, targetGroups),
  )

  useEffect(() => {
    setRows(toEditableSalesPlanRows(salesPlan, managers, targetGroups))
  }, [salesPlan, managers, targetGroups])

  function patchRow(localId: string, patch: Partial<EditableSalesPlanRow>) {
    setRows((current) =>
      current.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    )
  }

  function addRow() {
    const firstManager = managers[0]
    const firstTargetGroup = targetGroups[0]
    setRows((current) => [
      ...current,
      {
        localId: crypto.randomUUID(),
        managerId: firstManager?.id ?? '',
        managerName: firstManager?.label ?? null,
        targetGroupKey: firstTargetGroup?.key ?? '',
        targetGroupLabel: firstTargetGroup?.label ?? '',
        plannedDeals: 0,
        plannedAmount: 0,
      },
    ])
  }

  function removeRow(localId: string) {
    setRows((current) => current.filter((row) => row.localId !== localId))
  }

  async function saveRows() {
    if (!onSalesPlanSave) {
      return
    }

    await onSalesPlanSave(
      rows
        .map((row) => {
          const selectedTargetGroup = targetGroups.find(
            (targetGroup) => targetGroup.key === row.targetGroupKey,
          )
          const targetGroupLabel = (
            selectedTargetGroup?.label ??
            row.targetGroupLabel ??
            row.targetGroupKey
          ).trim()
          const managerName =
            managers.find((manager) => manager.id === row.managerId)?.label ??
            row.managerName ??
            row.managerId

          return {
            managerId: row.managerId,
            managerName,
            targetGroupKey: (row.targetGroupKey || targetGroupLabel).trim(),
            targetGroupLabel,
            plannedDeals: Number.isFinite(row.plannedDeals) ? row.plannedDeals : 0,
            plannedAmount: Number.isFinite(row.plannedAmount) ? row.plannedAmount : 0,
          }
        })
        .filter(
          (row) =>
            row.managerId &&
            row.targetGroupKey &&
            (row.plannedDeals > 0 || row.plannedAmount > 0),
        ),
    )
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="План продаж"
        description="План по количеству и сумме продаж в разрезе менеджера и таргет-группы/клуба заказчика. Сохраненные строки используются в отчете по продажам."
        right={
          <span className="badge-chip badge-neutral">
            {salesPlanLoading
              ? 'загрузка плана'
              : salesPlan?.updatedAt
                ? `сохранено ${formatShortDate(salesPlan.updatedAt)}`
                : 'план не сохранен'}
          </span>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="subtle-label">Месяц плана</span>
          <input
            className="field w-44"
            type="month"
            aria-label="Месяц плана"
            value={salesPlanMonth ?? ''}
            onChange={(event) => onSalesPlanMonthChange?.(event.target.value)}
          />
        </label>
      </div>

      {salesPlanSaveError ? (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {salesPlanSaveError}
        </div>
      ) : null}

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-3">Менеджер</th>
              <th className="px-3 py-3">Таргет-группа / клуб</th>
              <th className="px-3 py-3">План сделок</th>
              <th className="px-3 py-3">План сумма</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const managerName =
                managers.find((manager) => manager.id === row.managerId)?.label ??
                row.managerName ??
                row.managerId
              const targetGroupOption = targetGroups.find(
                (targetGroup) => targetGroup.key === row.targetGroupKey,
              )
              const targetGroupLabel =
                targetGroupOption?.label ?? row.targetGroupLabel ?? row.targetGroupKey
              const fieldSuffix = `${managerName} ${targetGroupLabel}`.trim()

              return (
                <tr key={row.localId} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3">
                    <select
                      className="field min-w-[210px]"
                      aria-label={`Менеджер ${index + 1}`}
                      value={row.managerId}
                      disabled={isPlanLocked}
                      onChange={(event) => {
                        const manager = managers.find((entry) => entry.id === event.target.value)
                        patchRow(row.localId, {
                          managerId: event.target.value,
                          managerName: manager?.label ?? event.target.value,
                        })
                      }}
                    >
                      {managers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="field min-w-[240px]"
                      aria-label={`Таргет-группа ${index + 1}`}
                      value={row.targetGroupKey}
                      disabled={isPlanLocked}
                      onChange={(event) => {
                        const targetGroup = targetGroups.find(
                          (entry) => entry.key === event.target.value,
                        )
                        patchRow(row.localId, {
                          targetGroupKey: event.target.value,
                          targetGroupLabel: targetGroup?.label ?? event.target.value,
                        })
                      }}
                    >
                      {targetGroups.length === 0 ? (
                        <option value="">Нет таргет-групп</option>
                      ) : (
                        <option value="" disabled>
                          Выберите таргет-группу
                        </option>
                      )}
                      {targetGroups.map((targetGroup) => (
                        <option key={targetGroup.key} value={targetGroup.key}>
                          {targetGroup.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="field w-32"
                      type="number"
                      min={0}
                      aria-label={`План сделок ${fieldSuffix}`}
                      value={row.plannedDeals}
                      disabled={isPlanLocked}
                      onChange={(event) =>
                        patchRow(row.localId, {
                          plannedDeals: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      className="field w-40"
                      type="number"
                      min={0}
                      step={1000}
                      aria-label={`План суммы ${fieldSuffix}`}
                      value={row.plannedAmount}
                      disabled={isPlanLocked}
                      onChange={(event) =>
                        patchRow(row.localId, {
                          plannedAmount: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeRow(row.localId)}
                      disabled={isPlanLocked || rows.length === 1}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={addRow} disabled={isPlanLocked}>
          Добавить строку
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void saveRows()}
          disabled={isPlanLocked}
        >
          {salesPlanLoading ? 'Загружаю план...' : salesPlanSaving ? 'Сохраняю...' : 'Сохранить план'}
        </button>
      </div>
    </section>
  )
}

function TargetGroupConversionSection({
  report,
  filters,
}: {
  report: TargetGroupConversionReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const compareByTargetGroup = new Map(
    (report.comparisons?.[0]?.snapshot.rows ?? []).map((row) => [row.targetGroupKey, row]),
  )

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Конверсия по таргет-группам"
        description="Срез по customer target group: новые заказы в период, победы в период, доля побед среди закрытых исходов, выручка, средний чек и средний цикл по выигранным."
        right={<span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>}
      />

      {report.rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Target group</th>
                <th className="px-3 py-3">Создано</th>
                <th className="px-3 py-3">Выиграно</th>
                <th className="px-3 py-3">Win-rate</th>
                <th className="px-3 py-3">Выручка</th>
                <th className="px-3 py-3">Средний чек</th>
                <th className="px-3 py-3">Средний цикл</th>
                <th className="px-3 py-3">Сравнение 1</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => {
                const compareRow = compareByTargetGroup.get(row.targetGroupKey)
                return (
                  <tr key={row.targetGroupKey} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.targetGroupLabel}</td>
                    <td className="px-3 py-3">{formatInteger(row.createdDeals)}</td>
                    <td className="px-3 py-3">{formatInteger(row.wonDeals)}</td>
                    <td className="px-3 py-3">{formatRatioPercent(row.winRate)}</td>
                    <td className="px-3 py-3">{formatAmount(row.salesAmount)}</td>
                    <td className="px-3 py-3">{formatAmount(row.averageSaleAmount)}</td>
                    <td className="px-3 py-3">{formatSalesDays(row.averageCycleDays)}</td>
                    <td className="px-3 py-3">
                      <div className="text-sm text-slate-700">
                        {compareRow ? `${formatInteger(compareRow.wonDeals)} выигр. · ${formatRatioPercent(compareRow.winRate)}` : '—'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {compareRow
                          ? `${formatCompareDelta(row.wonDeals, compareRow.wonDeals)} · ${formatCompareDelta(
                              row.winRate,
                              compareRow.winRate,
                              'rate',
                            )}`
                          : 'без базы'}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="Конверсия по таргет-группам в выбранном окне пустая." />
      )}
    </section>
  )
}

type ManagerActionSortKey =
  | 'dealCount'
  | 'statusShare'
  | 'createdTasksPerDeal'
  | 'totalCallsPerDeal'
  | 'meetingsPerDeal'
  | 'sla1OnTimeRate'
  | 'financialAmount'
  | 'averageFinancialAmount'

const managerActionStatusOrder = ['won', 'lost', 'wip'] as const
type ManagerActionStatusKey = (typeof managerActionStatusOrder)[number]
type ManagerActionStatusRow = NonNullable<ManagerActionOutcomeReport['cohortStatusRows']>[number]
type ManagerActionDisplayRow = ManagerActionStatusRow & { isSynthetic?: boolean }

const managerActionStatusLabels: Record<ManagerActionStatusKey, string> = {
  won: 'Выиграно',
  lost: 'Проиграно',
  wip: 'В работе сейчас',
}

function getManagerActionStatusClass(statusKey: string) {
  if (statusKey === 'won') {
    return 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700'
  }

  if (statusKey === 'lost') {
    return 'rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700'
  }

  return 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'
}

function getManagerActionRowKey(row: Pick<ManagerActionStatusRow, 'managerId' | 'cohortMonth' | 'statusKey'>) {
  return `${row.managerId}-${row.cohortMonth ?? 'all'}-${row.statusKey}`
}

function getManagerActionDealKey(
  row: Pick<ManagerActionStatusRow, 'managerId' | 'cohortMonth' | 'statusKey'>,
  dealId: string,
) {
  return `${getManagerActionRowKey(row)}-${dealId}`
}

function formatDealSlaStatus(value: ManagerActionOutcomeDealDetail['sla']['sla1']) {
  const hours = value.hours === null ? '—' : `${formatOneDecimal(value.hours)} ч`

  if (value.status === 'onTime') {
    return `в срок · ${hours}`
  }

  if (value.status === 'late') {
    return `поздно · ${hours}`
  }

  return `нет касания · ${hours}`
}

function ManagerActionDealDetails({ deal }: { deal: ManagerActionOutcomeDealDetail }) {
  const detailFields = [
    { label: 'Итоговое качество', value: deal.qualityValue ?? '—' },
    { label: 'Источник', value: deal.sourceLabel ?? '—' },
    { label: 'Бизнес-клуб заказчика', value: deal.businessClubValue ?? '—' },
    { label: 'Таргет-группа', value: deal.targetGroupValue ?? '—' },
    { label: 'Тип встречи', value: deal.meetingTypeValue ?? '—' },
    { label: 'Дата встречи', value: deal.meetingDateValue ? formatShortDate(deal.meetingDateValue) : '—' },
    { label: 'Тариф', value: deal.tariffValue ?? '—' },
  ]

  return (
    <div className="mt-3 grid gap-4 border-t border-slate-200 pt-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="subtle-label">Атрибуты сделки</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {detailFields.map((field) => (
              <div key={field.label} className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                <div className="subtle-label">{field.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{field.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="subtle-label">Дела, звонки и встречи</div>
          <div className="mt-2 text-sm text-slate-700">
            <strong className="text-slate-950">{formatInteger(deal.taskSummary.created)}</strong>{' '}
            создано дел · {formatInteger(deal.taskSummary.closed)} закрыто
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatInteger(deal.callSummary.incoming)} вход. ·{' '}
            {formatInteger(deal.callSummary.outgoing)} исход. ·{' '}
            {formatInteger(deal.callSummary.connectedOverThirtySeconds)} успешных &gt;30 сек
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatMeetingCount(deal.meetingSummary.total)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
          <div className="subtle-label">SLA по сделке</div>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <div>1: {formatDealSlaStatus(deal.sla.sla1)}</div>
            <div>2: {formatDealSlaStatus(deal.sla.sla2)}</div>
            <div>3: {formatDealSlaStatus(deal.sla.sla3)}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/80">
        <div className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
          <span>Этап</span>
          <span>Вход</span>
          <span className="text-right">Время</span>
        </div>
        <div className="divide-y divide-slate-100">
          {deal.stageTimeline.length > 0 ? (
            deal.stageTimeline.map((stage) => (
              <div
                key={`${deal.dealId}-${stage.stageId}-${stage.enteredAt}`}
                className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{stage.stageName}</div>
                  {stage.meetingEvents && stage.meetingEvents.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {stage.meetingEvents.map((meeting) => (
                        <span
                          key={meeting.activityId}
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800"
                        >
                          Встреча {formatShortDate(meeting.timelineAt)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="truncate text-xs text-slate-500">
                    до {formatShortDate(stage.leftAt)}
                  </div>
                </div>
                <span className="text-slate-500">{formatShortDate(stage.enteredAt)}</span>
                <span className="text-right font-semibold text-slate-900">
                  {formatSalesHours(stage.durationHours)}
                </span>
              </div>
            ))
          ) : (
            <div className="px-4 py-5 text-sm text-slate-500">
              История этапов по сделке пока не подтянута.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function createEmptyManagerActionStatusRow(
  referenceRow: ManagerActionStatusRow,
  statusKey: ManagerActionStatusKey,
  selectedCohortMonth: string | null,
): ManagerActionDisplayRow {
  return {
    managerId: referenceRow.managerId,
    managerName: referenceRow.managerName,
    cohortMonth: selectedCohortMonth,
    statusKey,
    statusLabel: managerActionStatusLabels[statusKey],
    cohortCreatedDeals: referenceRow.cohortCreatedDeals,
    dealCount: 0,
    statusShare: 0,
    createdTasksPerDeal: 0,
    closedTasksPerDeal: 0,
    totalCallsPerDeal: 0,
    successfulCallsOverThirtySecondsPerDeal: 0,
    meetingsPerDeal: 0,
    sla1OnTimeRate: 0,
    sla2OnTimeRate: 0,
    sla3OnTimeRate: 0,
    financialAmount: 0,
    averageFinancialAmount: 0,
    dealDetails: [],
    isSynthetic: true,
  }
}

function getManagerActionGroupSortValue(
  rows: ManagerActionDisplayRow[],
  sortKey: ManagerActionSortKey,
) {
  const dealCount = rows.reduce((total, row) => total + row.dealCount, 0)

  if (sortKey === 'dealCount') {
    return dealCount
  }

  if (sortKey === 'statusShare') {
    const cohortCreatedDeals = rows[0]?.cohortCreatedDeals ?? 0
    return cohortCreatedDeals === 0 ? 0 : dealCount / cohortCreatedDeals
  }

  if (sortKey === 'financialAmount') {
    return rows.reduce((total, row) => total + row.financialAmount, 0)
  }

  if (sortKey === 'averageFinancialAmount') {
    const financialAmount = rows.reduce((total, row) => total + row.financialAmount, 0)
    return dealCount === 0 ? 0 : financialAmount / dealCount
  }

  return dealCount === 0
    ? 0
    : rows.reduce((total, row) => total + Number(row[sortKey]) * row.dealCount, 0) / dealCount
}

function ManagerActionOutcomeSection({
  report,
}: {
  report: ManagerActionOutcomeReport | undefined
}) {
  const [sortState, setSortState] = useState<{
    key: ManagerActionSortKey
    direction: 'asc' | 'desc'
  }>({
    key: 'financialAmount',
    direction: 'desc',
  })
  const [selectedCohortMonth, setSelectedCohortMonth] = useState<string | null>(null)
  const [expandedStatusRows, setExpandedStatusRows] = useState<Set<string>>(() => new Set())
  const [expandedDealDetails, setExpandedDealDetails] = useState<Set<string>>(() => new Set())

  if (!report) {
    return null
  }

  const columns: Array<{
    key: string
    label: string
    sortKey: ManagerActionSortKey
    render: (row: ManagerActionDisplayRow) => ReactNode
  }> = [
    {
      key: 'deals',
      label: 'Сделки',
      sortKey: 'dealCount',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatInteger(row.dealCount)}</div>
          <div className="text-xs text-slate-500">
            из {formatInteger(row.cohortCreatedDeals)} · {formatRatioPercent(row.statusShare)}
          </div>
        </div>
      ),
    },
    {
      key: 'tasks',
      label: 'Дела / сделку',
      sortKey: 'createdTasksPerDeal',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatOneDecimal(row.createdTasksPerDeal)}</div>
          <div className="text-xs text-slate-500">закр. {formatOneDecimal(row.closedTasksPerDeal)}</div>
        </div>
      ),
    },
    {
      key: 'calls',
      label: 'Звонки / сделку',
      sortKey: 'totalCallsPerDeal',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatOneDecimal(row.totalCallsPerDeal)}</div>
          <div className="text-xs text-slate-500">
            &gt;30с {formatOneDecimal(row.successfulCallsOverThirtySecondsPerDeal)}
          </div>
        </div>
      ),
    },
    {
      key: 'meetings',
      label: 'Встречи / сделку',
      sortKey: 'meetingsPerDeal',
      render: (row) => (
        <div className="font-semibold text-slate-900">{formatOneDecimal(row.meetingsPerDeal)}</div>
      ),
    },
    {
      key: 'sla',
      label: 'SLA on-time',
      sortKey: 'sla1OnTimeRate',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">1: {formatRatioPercent(row.sla1OnTimeRate)}</span>
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">2: {formatRatioPercent(row.sla2OnTimeRate)}</span>
          <span className="rounded-md bg-slate-50 px-1.5 py-1 text-xs font-semibold text-slate-700">3: {formatRatioPercent(row.sla3OnTimeRate)}</span>
        </div>
      ),
    },
    {
      key: 'finance',
      label: 'Финансы',
      sortKey: 'financialAmount',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{formatAmount(row.financialAmount)}</div>
          <div className="text-xs text-slate-500">ср. {formatAmount(row.averageFinancialAmount)}</div>
        </div>
      ),
    },
  ]

  const cohortStatusRows = report.cohortStatusRows ?? []
  const cohortMonths = report.cohortMonths ?? []
  const actionWarnings = report.warnings ?? []
  const selectedRows = cohortStatusRows.filter(
    (row) =>
      row.cohortMonth === selectedCohortMonth &&
      (SHOW_ACTION_OUTCOME_WIP || row.statusKey !== 'wip'),
  )
  const visibleStatusKeys = managerActionStatusOrder.filter(
    (statusKey) => SHOW_ACTION_OUTCOME_WIP || statusKey !== 'wip',
  )
  const totalCohortDeals = selectedCohortMonth
    ? (cohortMonths.find((cohort) => cohort.cohortMonth === selectedCohortMonth)?.totalCreatedDeals ?? 0)
    : Array.from(
        new Map(selectedRows.map((row) => [row.managerId, row.cohortCreatedDeals])).values(),
      ).reduce((total, value) => total + value, 0)
  const statusSummary = managerActionStatusOrder
    .filter((statusKey) => SHOW_ACTION_OUTCOME_WIP || statusKey !== 'wip')
    .map((statusKey) => {
      const rows = selectedRows.filter((row) => row.statusKey === statusKey)
      const dealCount = rows.reduce((total, row) => total + row.dealCount, 0)
      const financialAmount = rows.reduce((total, row) => total + row.financialAmount, 0)
      const callsPerDeal =
        dealCount === 0
          ? 0
          : rows.reduce((total, row) => total + row.totalCallsPerDeal * row.dealCount, 0) / dealCount
      const meetingsPerDeal =
        dealCount === 0
          ? 0
          : rows.reduce((total, row) => total + row.meetingsPerDeal * row.dealCount, 0) / dealCount
      const label = rows[0]?.statusLabel ?? (statusKey === 'won' ? 'Выиграно' : statusKey === 'lost' ? 'Проиграно' : 'В работе сейчас')

      return {
        statusKey,
        label,
        dealCount,
        financialAmount,
        callsPerDeal,
        meetingsPerDeal,
      }
    })
  const managerGroups = Array.from(
    selectedRows.reduce((groups, row) => {
      const current = groups.get(row.managerId) ?? []
      current.push(row)
      groups.set(row.managerId, current)
      return groups
    }, new Map<string, ManagerActionStatusRow[]>()),
  ).map(([managerId, rows]) => {
    const referenceRow = rows[0]
    const rowsByStatus = new Map(rows.map((row) => [row.statusKey, row]))
    const displayRows: ManagerActionDisplayRow[] = referenceRow
      ? visibleStatusKeys.map((statusKey) => {
          const existingRow = rowsByStatus.get(statusKey)
          return existingRow
            ? { ...existingRow, isSynthetic: false }
            : createEmptyManagerActionStatusRow(referenceRow, statusKey, selectedCohortMonth)
        })
      : []

    return {
      managerId,
      managerName: referenceRow?.managerName ?? managerId,
      rows: displayRows,
    }
  })

  const sortedGroups = [...managerGroups].sort((left, right) => {
    const leftValue = getManagerActionGroupSortValue(left.rows, sortState.key)
    const rightValue = getManagerActionGroupSortValue(right.rows, sortState.key)
    const result = leftValue === rightValue
      ? left.managerName.localeCompare(right.managerName, 'ru-RU')
      : leftValue - rightValue

    return sortState.direction === 'asc' ? result : -result
  })

  function toggleSort(key: ManagerActionSortKey) {
    setSortState((current) => ({
      key,
      direction:
        current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  function toggleStatusRow(row: ManagerActionDisplayRow) {
    if (row.dealDetails.length === 0) {
      return
    }

    const rowKey = getManagerActionRowKey(row)
    setExpandedStatusRows((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }

      return next
    })
  }

  function toggleDealDetails(row: ManagerActionDisplayRow, dealId: string) {
    const dealKey = getManagerActionDealKey(row, dealId)
    setExpandedDealDetails((current) => {
      const next = new Set(current)
      if (next.has(dealKey)) {
        next.delete(dealKey)
      } else {
        next.add(dealKey)
      }

      return next
    })
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Действия → результат"
        description="Средний объём действий на сделку по когорте создания и статусу: выиграно, проиграно, в работе сейчас."
        right={<span className="badge-chip badge-neutral">{cohortMonths.length || 12} когорт · годовой период</span>}
      />

      {actionWarnings.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionWarnings.join(' · ')}
        </div>
      ) : null}

      <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        <div className="flex min-w-max items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSelectedCohortMonth(null)}
            className={
              selectedCohortMonth === null
                ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
            }
          >
            Все когорты
          </button>
          {cohortMonths.map((cohort) => (
            <button
              key={cohort.cohortMonth}
              type="button"
              onClick={() => setSelectedCohortMonth(cohort.cohortMonth)}
              className={
                selectedCohortMonth === cohort.cohortMonth
                  ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
              }
            >
              {cohort.cohortLabel}
            </button>
          ))}
          <span className="ml-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
            создано сделок: {formatInteger(totalCohortDeals)}
          </span>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {statusSummary.map((status) => (
          <article key={status.statusKey} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={getManagerActionStatusClass(status.statusKey)}>{status.label}</span>
              <span className="text-xs font-semibold text-slate-500">{formatRatioPercent(totalCohortDeals === 0 ? 0 : status.dealCount / totalCohortDeals)}</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900">{formatInteger(status.dealCount)}</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <span>фин. {formatAmount(status.financialAmount)}</span>
              <span>звонки {formatOneDecimal(status.callsPerDeal)}</span>
              <span>встречи {formatOneDecimal(status.meetingsPerDeal)}</span>
            </div>
          </article>
        ))}
      </div>

      {sortedGroups.length > 0 ? (
        <div className="overflow-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Статус</th>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100"
                      onClick={() => toggleSort(column.sortKey)}
                    >
                      <span>{column.label}</span>
                      <SortIndicator
                        active={sortState.key === column.sortKey}
                        direction={sortState.direction}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGroups.flatMap((group) => {
                const expandedRowsInGroup = group.rows.filter(
                  (row) => expandedStatusRows.has(getManagerActionRowKey(row)) && row.dealDetails.length > 0,
                ).length
                const managerRowSpan = group.rows.length + expandedRowsInGroup

                return group.rows.flatMap((row, rowIndex) => {
                  const rowKey = getManagerActionRowKey(row)
                  const isExpanded = expandedStatusRows.has(rowKey) && row.dealDetails.length > 0
                  const canExpand = row.dealDetails.length > 0
                  const baseRow = (
                    <tr
                      key={rowKey}
                      className={`border-b border-slate-100 last:border-b-0 ${rowIndex === 0 ? 'border-t border-t-slate-200' : ''}`}
                    >
                      {rowIndex === 0 ? (
                        <td
                          rowSpan={managerRowSpan}
                          className="bg-white px-3 py-3 align-top font-semibold text-slate-900"
                        >
                          <div>{group.managerName}</div>
                          <div className="mt-1 text-xs font-medium text-slate-500">
                            {formatInteger(group.rows[0]?.cohortCreatedDeals ?? 0)} сделок в когорте
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={!canExpand}
                          onClick={() => toggleStatusRow(row)}
                          aria-expanded={canExpand ? isExpanded : undefined}
                          aria-label={
                            canExpand
                              ? `${isExpanded ? 'Свернуть' : 'Раскрыть'} статус ${row.statusLabel}`
                              : row.statusLabel
                          }
                          title={canExpand ? `${isExpanded ? 'Свернуть' : 'Раскрыть'} сделки` : undefined}
                          className="group inline-flex items-center gap-2 rounded-full px-1 py-1 text-left transition hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span className={getManagerActionStatusClass(row.statusKey)}>
                            {row.statusLabel}
                          </span>
                          {canExpand ? <DisclosureIndicator expanded={isExpanded} /> : null}
                        </button>
                      </td>
                      {columns.map((column) => (
                        <td
                          key={`${rowKey}-${column.key}`}
                          className={`px-3 py-3 ${row.isSynthetic ? 'text-slate-400' : ''}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  )

                  if (!isExpanded) {
                    return [baseRow]
                  }

                  const detailRow = (
                    <tr key={`${rowKey}-details`} className="border-b border-slate-100 bg-slate-50/70">
                      <td colSpan={columns.length + 1} className="px-3 py-4">
                        <div className="space-y-3">
                          {row.dealDetails.map((deal) => {
                            const dealKey = getManagerActionDealKey(row, deal.dealId)
                            const isDealExpanded = expandedDealDetails.has(dealKey)

                            return (
                              <article
                                key={deal.dealId}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                              >
                                <div className="grid gap-3 xl:grid-cols-[minmax(8rem,1fr)_8rem_8rem_8rem_9rem_auto] xl:items-center">
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-950">ID {deal.dealId}</div>
                                    <div className="text-xs text-slate-500">
                                      создана {formatShortDate(deal.dateCreate)} · {deal.stageName}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Сумма</div>
                                    <div className="font-semibold text-slate-900">{formatAmount(deal.amount)}</div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Дела</div>
                                    <div className="font-semibold text-slate-900">
                                      {formatInteger(deal.taskSummary.created)} / {formatInteger(deal.taskSummary.closed)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Звонки</div>
                                    <div className="font-semibold text-slate-900">{formatInteger(deal.callSummary.total)}</div>
                                    <div className="text-xs text-slate-500">
                                      &gt;30с {formatInteger(deal.callSummary.connectedOverThirtySeconds)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="subtle-label">Встречи</div>
                                    <div className="font-semibold text-slate-900">{formatInteger(deal.meetingSummary.total)}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className={isDealExpanded ? 'btn btn-dark' : 'btn btn-ghost'}
                                    onClick={() => toggleDealDetails(row, deal.dealId)}
                                  >
                                    Подробнее
                                  </button>
                                </div>
                                {isDealExpanded ? <ManagerActionDealDetails deal={deal} /> : null}
                              </article>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )

                  return [baseRow, detailRow]
                })
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="По выбранной когорте пока нет данных для блока «действия → результат»." />
      )}
    </section>
  )
}

function SalesKpiCards({
  dashboard,
  status,
}: {
  dashboard: DashboardData | undefined
  status: NonNullable<SceneComponentProps['runtimeData']>['operationalStatus'] | undefined
}) {
  const pendingState = !dashboard && status !== 'ready'
  const groups = dashboard?.managerGroups ?? []
  const salesSummary = dashboard?.salesSummary
  const totalDeals = salesSummary?.salesCount ?? groups.reduce((total, group) => total + group.totalWonDeals, 0)
  const totalAmount = salesSummary?.salesAmount ?? groups.reduce((total, group) => total + group.totalSalesAmount, 0)
  const averageSaleAmount =
    salesSummary?.averageSaleAmount ?? (totalDeals === 0 ? 0 : totalAmount / totalDeals)
  const pendingValue = status === 'loading' ? '…' : '—'
  const pendingNote =
    status === 'loading' ? 'ожидаем live-данные' : 'live-данные недоступны'

  const cards = [
    {
      label: 'Выиграно',
      value: pendingState ? pendingValue : formatInteger(totalDeals),
      note: pendingState ? pendingNote : 'передано в клуб за период',
    },
    {
      label: 'Сумма продаж',
      value: pendingState ? pendingValue : formatAmount(totalAmount),
      note: pendingState ? pendingNote : 'по выигранным сделкам',
    },
    {
      label: 'Средний чек',
      value: pendingState ? pendingValue : formatAmount(averageSaleAmount),
      note: pendingState ? pendingNote : 'среднее по продажам',
    },
    {
      label: 'Новые сделки / конверсия',
      value: pendingState ? pendingValue : formatInteger(salesSummary?.newDealsCount ?? 0),
      note: pendingState
        ? pendingNote
        : `${formatPercent(salesSummary?.conversionRate ?? 0)}% win-rate периода`,
    },
    {
      label: 'Встречи',
      value: pendingState ? pendingValue : formatInteger(salesSummary?.meetingsCount ?? 0),
      note: pendingState ? pendingNote : 'по выигранным сделкам',
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="KPI продаж">
      {cards.map((card) => (
        <div key={card.label} className="metric p-4">
          <p className="subtle-label">{card.label}</p>
          <p className="mt-1 text-xl font-bold text-slate-800">{card.value}</p>
          <p className="text-xs text-slate-500">{card.note}</p>
        </div>
      ))}
    </section>
  )
}

function SalesScene({ filters, runtimeData }: SceneComponentProps) {
  return (
    <div className="space-y-6">
      <SalesKpiCards
        dashboard={runtimeData?.salesDashboard}
        status={runtimeData?.operationalStatus}
      />

      {SHOW_TARGET_GROUP_CONVERSION ? (
        <TargetGroupConversionSection
          report={runtimeData?.targetGroupConversion}
          filters={filters}
        />
      ) : null}

      <SalesPlanFactSection
        dashboard={runtimeData?.salesDashboard}
        salesPlan={runtimeData?.salesPlan}
      />

      <SalesManagersReport
        dashboard={runtimeData?.salesDashboard}
        status={runtimeData?.operationalStatus}
        error={runtimeData?.operationalError}
      />

      {SHOW_SALES_SECONDARY_REPORTS ? (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Матрица по источникам"
              description="Сколько сделок было создано, сколько получили итоговое качество, дошли до звонка и были закрыты."
              right={<span className="badge-chip badge-neutral">4 источника</span>}
            />
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-3 py-3">Источник</th>
                    <th className="px-3 py-3">Создано</th>
                    <th className="px-3 py-3">Качество A/B</th>
                    <th className="px-3 py-3">Готов ко встрече</th>
                    <th className="px-3 py-3">Звонок-знакомство</th>
                    <th className="px-3 py-3">Выиграно</th>
                    <th className="px-3 py-3">Средний цикл</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRows.map((row) => (
                    <tr key={row.source} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-slate-900">{row.source}</td>
                      <td className="px-3 py-3">{row.created}</td>
                      <td className="px-3 py-3">{row.quality}</td>
                      <td className="px-3 py-3">{row.ready}</td>
                      <td className="px-3 py-3">{row.intro}</td>
                      <td className="px-3 py-3">{row.won}</td>
                      <td className="px-3 py-3">{row.cycle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title="Точки конверсии"
              description="Где реально теряется объем после статуса «Готов ко встрече»."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Лучший источник</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Партнёры</div>
                <p className="mt-2 text-sm text-slate-600">26% win-rate и самый короткий цикл по выигранным сделкам.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Главное узкое место</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Встреча → оффер</div>
                <p className="mt-2 text-sm text-slate-600">После звонка-знакомства теряется 27% сделок, нужен drill-down.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="subtle-label">Что проверить</div>
                <div className="mt-2 text-lg font-bold text-slate-900">Вебинары</div>
                <p className="mt-2 text-sm text-slate-600">Длинный цикл и слабый проход в звонок при неплохом входящем объёме.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Давление воронки"
              description="Справа остаётся один вертикальный разрез, без перегруза графиками."
            />
            <div className="space-y-4">
              {stagePressure.map((stage) => (
                <div key={stage.label} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{stage.label}</div>
                      <div className="text-sm text-slate-500">{stage.note}</div>
                    </div>
                    <div className="text-sm font-semibold text-slate-700">{stage.value}%</div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#80a2ff)]"
                      style={{ width: `${stage.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title="Фокус на период"
              description="Быстрый summary для обсуждения на летучке."
            />
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
                <div className="subtle-label">Сильный сигнал</div>
                <div className="mt-2 text-base font-bold text-slate-900">Платный поиск держит качество</div>
                <p className="mt-1 text-sm text-slate-600">41 сделка с итоговым качеством A/B. Это лучший вход в воронку.</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
                <div className="subtle-label">Риск периода</div>
                <div className="mt-2 text-base font-bold text-slate-900">Органика не доходит до встреч</div>
                <p className="mt-1 text-sm text-slate-600">Есть объём, но пробуксовка начинается сразу после этапа качества.</p>
              </div>
            </div>
          </section>
        </div>
      </section>
      ) : null}
    </div>
  )
}

function formatOutcomeCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function OutcomeEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
      {message}
    </div>
  )
}

function AcquisitionOutcomesSection({
  report,
  filters,
}: {
  report: AcquisitionOutcomesReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const lossReasonsByStage = report.topLossReasons.reduce<
    Array<{
      stageId: string
      stageName: string
      totalCount: number
      reasons: Array<{
        reasonKey: string
        reasonLabel: string
        count: number
      }>
    }>
  >((groups, row) => {
    const existing = groups.find((group) => group.stageId === row.stageId)
    if (existing) {
      existing.totalCount += row.count
      const existingReason = existing.reasons.find((reason) => reason.reasonKey === row.reasonKey)
      if (existingReason) {
        existingReason.count += row.count
      } else {
        existing.reasons.push({
          reasonKey: row.reasonKey,
          reasonLabel: row.reasonLabel,
          count: row.count,
        })
      }
      return groups
    }

    groups.push({
      stageId: row.stageId,
      stageName: row.stageName,
      totalCount: row.count,
      reasons: [
        {
          reasonKey: row.reasonKey,
          reasonLabel: row.reasonLabel,
          count: row.count,
        },
      ],
    })
    return groups
  }, []).map((group) => ({
    ...group,
    reasons: group.reasons.sort((left, right) => right.count - left.count || left.reasonLabel.localeCompare(right.reasonLabel, 'ru')),
  }))

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Сделки и потери"
        description="Новые сделки собраны по менеджерам, источникам и качеству, а потери разложены по этапам и причинам."
        right={
          <div className="flex flex-wrap gap-2">
            <span className="badge-chip badge-green">{formatOutcomeCount(report.totalNewDeals)} новых</span>
            <span className="badge-chip badge-neutral">{formatOutcomeCount(report.totalLostDeals)} потерь</span>
            <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        <article className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Новые сделки</h3>
            <p className="mt-1 text-xs text-slate-500">По менеджерам, источникам и качеству входа.</p>
          </div>

          {report.newDealsByManager.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-0 py-2">Менеджер</th>
                    <th className="px-3 py-2">Источники и качество</th>
                    <th className="px-0 py-2 text-right">Сделки</th>
                  </tr>
                </thead>
                <tbody>
                  {report.newDealsByManager.map((row) => (
                    <tr key={row.managerId} className="border-b border-slate-200/70 align-top last:border-b-0">
                      <td className="px-0 py-3 font-semibold text-slate-900">{row.managerName}</td>
                      <td className="px-3 py-3">
                        <div className="space-y-2">
                          {row.sources.map((source) => (
                            <div key={`${row.managerId}-${source.sourceKey}`} className="space-y-1">
                              <div className="flex items-center justify-between gap-3 text-sm text-slate-700">
                                <span>{source.sourceLabel}</span>
                                <span className="font-semibold text-slate-900">
                                  {formatOutcomeCount(source.totalNewDeals)}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {source.qualities.map((quality) => (
                                  <span
                                    key={`${row.managerId}-${source.sourceKey}-${quality.qualityKey}`}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                                  >
                                    <span>{quality.qualityLabel}</span>
                                    <span className="text-slate-400">{formatOutcomeCount(quality.count)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-0 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatOutcomeCount(row.totalNewDeals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <OutcomeEmptyState message="В выбранном окне новые сделки не появились." />
          )}
        </article>

        <article className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Проигранные сделки</h3>
            <p className="mt-1 text-xs text-slate-500">Этапы потерь, менеджеры и причины в одном блоке.</p>
          </div>

          {report.lostStages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {report.lostStages.map((stage) => (
                <span
                  key={stage.stageId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                >
                  <span>{stage.stageName}</span>
                  <span className="text-slate-400">{formatOutcomeCount(stage.count)}</span>
                </span>
              ))}
            </div>
          ) : (
            <OutcomeEmptyState message="Потерь по этапам в этом периоде нет." />
          )}

          {report.lostDealsByManager.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-0 py-2">Менеджер</th>
                    <th className="px-3 py-2">Этапы</th>
                    <th className="px-0 py-2 text-right">Потери</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lostDealsByManager.map((row) => (
                    <tr key={row.managerId} className="border-b border-slate-200/70 align-top last:border-b-0">
                      <td className="px-0 py-3 font-semibold text-slate-900">{row.managerName}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.stages.map((stage) => (
                            <span
                              key={`${row.managerId}-${stage.stageId}`}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600"
                            >
                              <span>{stage.stageName}</span>
                              <span className="text-slate-400">{formatOutcomeCount(stage.count)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-0 py-3 text-right text-sm font-semibold text-slate-900">
                        {formatOutcomeCount(row.totalLostDeals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Причины по стадиям</h4>
              <p className="mt-1 text-xs text-slate-500">Та же логика чтения, что и у новых сделок: стадия, набор причин и итоговый объём потерь.</p>
            </div>

            {report.topLossReasons.length > 0 ? (
              <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                      <th className="px-4 py-3">Стадия</th>
                      <th className="px-4 py-3">Причины</th>
                      <th className="px-4 py-3 text-right">Потери</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lossReasonsByStage.map((group) => (
                      <tr
                        key={group.stageId}
                        className="border-b border-slate-200/70 align-top last:border-b-0"
                      >
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-900">{group.stageName}</div>
                            <div className="text-xs text-slate-500">
                              {formatOutcomeCount(group.reasons.length)} причин в этой стадии
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {group.reasons.map((reason) => (
                              <span
                                key={`${group.stageId}-${reason.reasonKey}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
                              >
                                <span>{reason.reasonLabel}</span>
                                <span className="text-slate-400">{formatOutcomeCount(reason.count)}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900">
                          {formatOutcomeCount(group.totalCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <OutcomeEmptyState message="Причины проигрыша пока не синхронизировались для выбранного периода." />
            )}
          </div>
        </article>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Drill-down потерь</h3>
          <p className="mt-1 text-xs text-slate-500">
            Каждая проигранная сделка со стадией потери, источником, business club и детализацией причины.
          </p>
        </div>

        {report.lostDealDetails.length > 0 ? (
          <div className="overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-3">Сделка</th>
                  <th className="px-4 py-3">Менеджер</th>
                  <th className="px-4 py-3">Источник</th>
                  <th className="px-4 py-3">Business club</th>
                  <th className="px-4 py-3">Стадия потери</th>
                  <th className="px-4 py-3">Причина</th>
                </tr>
              </thead>
              <tbody>
                {report.lostDealDetails.map((row) => (
                  <tr key={row.dealId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.dealId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.managerName}</td>
                    <td className="px-4 py-3 text-slate-700">{row.sourceLabel}</td>
                    <td className="px-4 py-3 text-slate-700">{row.businessClubValue ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{row.stageName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{row.reasonLabel}</div>
                      <div className="text-xs text-slate-500">{row.reasonDetail ?? 'Без детализации'}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <OutcomeEmptyState message="Детализация по проигранным сделкам пока не сформировалась." />
        )}
      </div>
    </section>
  )
}

function ActivitiesMeetingsSection({
  report,
  filters,
}: {
  report: ActivitiesWorkloadReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const compareByManager = new Map(
    (report.comparisons?.[0]?.snapshot.managerRows ?? []).map((row) => [row.managerId, row]),
  )
  const rows = report.managerRows.filter(
    (row) => row.meetingCount > 0 || row.meetingTypeBreakdown.length > 0,
  )

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Встречи"
        description="Сколько встреч ведёт каждый менеджер, какие типы встреч доминируют и как меняется нагрузка относительно первого compare-периода."
        right={
          <div className="flex flex-wrap gap-2">
            <span className="badge-chip badge-neutral">{formatMeetingCount(report.totalMeetingCount)}</span>
            <span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>
          </div>
        }
      />

      {rows.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Встречи</th>
                <th className="px-3 py-3">На сделку</th>
                <th className="px-3 py-3">Типы встреч</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const compareRow = compareByManager.get(row.managerId)
                return (
                  <tr key={row.managerId} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.managerName}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{formatInteger(row.meetingCount)}</div>
                      <div className="text-xs text-slate-500">
                        С1: {formatInteger(compareRow?.meetingCount ?? 0)} ·{' '}
                        {formatCompareDelta(row.meetingCount, compareRow?.meetingCount ?? 0)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{row.averageMeetingsPerDeal.toFixed(1)}</div>
                      <div className="text-xs text-slate-500">
                        С1: {(compareRow?.averageMeetingsPerDeal ?? 0).toFixed(1)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.meetingTypeBreakdown.map((meetingType) => (
                          <span
                            key={`${row.managerId}-${meetingType.meetingTypeKey}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                          >
                            <span>{meetingType.meetingTypeLabel}</span>
                            <span className="text-slate-400">{formatInteger(meetingType.count)}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="В выбранном периоде встречи по менеджерам не зафиксированы." />
      )}
    </section>
  )
}

function ActivitiesSlaSection({
  report,
  filters,
}: {
  report: ActivitiesWorkloadReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  const compareByManager = new Map(
    (report.comparisons?.[0]?.snapshot.managerRows ?? []).map((row) => [row.managerId, row]),
  )
  const rows = report.managerRows.filter((row) => row.slaMetrics.length > 0)

  return (
    <section className="panel p-5">
      <PanelHeading
        title="SLA"
        description="SLA1 — вход в работу, SLA2 — первый звонок или встреча, SLA3 — выполнение правила двух звонков на этапе «Звонок-знакомство»."
        right={<span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>}
      />

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {rows.map((row) => {
            const compareRow = compareByManager.get(row.managerId)
            const compareMetrics = new Map(
              (compareRow?.slaMetrics ?? []).map((metric) => [metric.slaKey, metric]),
            )

            return (
              <article key={row.managerId} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">{row.managerName}</h3>
                  <p className="text-xs text-slate-500">{formatInteger(row.dealCount)} сделок в работе</p>
                </div>
                <div className="space-y-3">
                  {row.slaMetrics.map((metric) => {
                    const compareMetric = compareMetrics.get(metric.slaKey)
                    return (
                      <div key={`${row.managerId}-${metric.slaKey}`} className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{metric.label}</div>
                          <span className="text-xs font-semibold text-slate-500">
                            С1 {compareMetric ? `${compareMetric.medianHours} ч` : '—'}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                            on-time {metric.onTimeCount}
                          </span>
                          <span className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                            late {metric.lateCount}
                          </span>
                          <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                            no-touch {metric.noTouchCount}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          медиана {metric.medianHours} ч ·{' '}
                          {formatCompareDelta(
                            metric.medianHours,
                            compareMetric?.medianHours ?? 0,
                            'days',
                          ).replace(' дн.', ' ч')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <OutcomeEmptyState message="SLA-метрики пока не рассчитались для выбранного периода." />
      )}
    </section>
  )
}

function BusinessClubWorkloadSection({
  report,
  filters,
}: {
  report: AcquisitionOutcomesReport | undefined
  filters: ProtoFilterState
}) {
  if (!report) {
    return null
  }

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Нагрузка по заказчикам"
        description="Открытые сделки в воронке по менеджерам: отдельно бизнес-клуб заказчика и таргет-группа."
        right={<span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>}
      />

      {report.businessClubByManager.length > 0 ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                <th className="px-3 py-3">Бизнес-клуб заказчика</th>
                <th className="px-3 py-3">Таргет-группа</th>
                <th className="px-3 py-3 text-right">Открыто сделок</th>
              </tr>
            </thead>
            <tbody>
              {report.businessClubByManager.map((row) => (
                <tr key={row.managerId} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.managerName}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.businessClubs.map((club) => (
                        <span
                          key={`${row.managerId}-${club.businessClubKey}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <span>{club.businessClubLabel}</span>
                          <span className="text-slate-400">{formatInteger(club.count)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {row.targetGroups.map((targetGroup) => (
                        <span
                          key={`${row.managerId}-${targetGroup.targetGroupKey}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          <span>{targetGroup.targetGroupLabel}</span>
                          <span className="text-slate-400">{formatInteger(targetGroup.count)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900">
                    {formatInteger(row.totalDeals)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <OutcomeEmptyState message="В текущей воронке нет открытых сделок по выбранным фильтрам." />
      )}
    </section>
  )
}

function ActivitiesScene({ filters, runtimeData }: SceneComponentProps) {
  const [summarySort, setSummarySort] = useState<ActivitySummarySort>({
    index: 2,
    direction: 'desc',
  })
  const isUnavailable =
    runtimeData?.operationalStatus !== 'ready' && !runtimeData?.activitiesCalls
  const sceneData = getActivitiesSceneData(runtimeData)
  const activitiesWorkload = runtimeData?.activitiesWorkload
  const acquisitionOutcomes = runtimeData?.acquisitionOutcomes
  const visibleWarnings = sceneData.warnings.filter(isVisibleActivityWarning)
  const sortedSummaryRows = sortActivitySummaryRows(sceneData.summaryRows, summarySort)
  const matrixStageLabels = sceneData.matrixRows[0]?.stages.map((stage) => stage.label) ?? activityStages

  function toggleSummarySort(index: number) {
    setSummarySort((current) => ({
      index,
      direction: current.index === index && current.direction === 'desc' ? 'asc' : 'desc',
    }))
  }

  if (isUnavailable) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Отчет активности"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные отчёта активности.'
              : 'Live-данные отчёта активности сейчас недоступны.'
          }
        />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {SHOW_ACTIVITY_MATRIX ? (
      <section className="panel p-5">
        <PanelHeading
          title="Матрица активности"
          description="Показывает текущий период, сравнение и процентную динамику по выбранному окну фильтров."
          right={
            <div className="flex flex-wrap gap-2">
              <span className="badge-chip badge-neutral">
                {sceneData.managerCount} менеджера · {sceneData.stageCount} этапов
              </span>
              <span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>
            </div>
          }
        />
        {visibleWarnings.length > 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {visibleWarnings.join(' · ')}
          </div>
        ) : null}
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
	                {matrixStageLabels.map((stage) => (
	                  <th key={stage} className="px-3 py-3">{stage}</th>
	                ))}
                <th className="px-3 py-3">Итого</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.matrixRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold text-slate-900">{row.manager}</div>
                  </td>
                  {row.stages.map((stage) => (
	                    <td key={`${row.manager}-${stage.label}`} className="min-w-[168px] px-2 py-3 align-top">
	                      <div
	                        className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 px-2 py-2"
	                        aria-label={`${row.manager}, ${stage.label}: ${stage.totalCalls} звонков, ${stage.totalClosedTasks} закрытых дела`}
	                        style={{
	                          backgroundColor:
                            stage.level >= 5 ? 'rgba(77,124,255,0.18)' :
                            stage.level === 4 ? 'rgba(77,124,255,0.14)' :
                            stage.level === 3 ? 'rgba(77,124,255,0.1)' :
                            stage.level === 2 ? 'rgba(77,124,255,0.07)' :
                            'rgba(77,124,255,0.04)',
	                        }}
	                      >
	                        <ActivityStageMetricCard
	                          label="Звонки"
	                          value={stage.totalCalls}
	                          unit="шт."
	                          average={stage.callsPerDeal}
	                          delta={stage.callsDelta ?? getStageDelta(stage.level)}
	                        />
	                        <ActivityStageMetricCard
	                          label="Дела"
	                          value={stage.totalClosedTasks}
	                          unit="закр."
	                          average={stage.closedTasksAvg}
	                          delta={stage.closedTasksDelta ?? (stage.level >= 3 ? '+5%' : '-4%')}
	                        />
	                      </div>
	                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
	                        <span className="text-slate-500">Звонки</span>
	                        <span className="flex items-center gap-2">
	                          <strong className="text-slate-900">{row.totalCalls}</strong>
	                          <DeltaPill value={row.avgCallsDelta ?? '+7%'} />
	                        </span>
	                      </div>
	                      <div className="mt-1 text-xs font-medium text-slate-500">ср. {row.avgCalls} / сделку</div>
	                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
	                        <span className="text-slate-500">Закрыто дел</span>
	                        <span className="flex items-center gap-2">
	                          <strong className="text-slate-900">{row.totalClosedTasks}</strong>
	                          <DeltaPill value={row.avgClosedTasksDelta ?? '+4%'} />
	                        </span>
	                      </div>
	                      <div className="mt-1 text-xs font-medium text-slate-500">ср. {row.avgClosedTasks} / сделку</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      <section className="panel p-5">
        <PanelHeading
          title="Сводка по менеджерам"
          description="Абсолютные значения и динамика относительно первого периода сравнения."
          right={<span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>}
        />
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
	                {activitySummaryColumns.map((column) => {
	                  const isActive = summarySort.index === column.index

	                  return (
	                  <th
	                    key={column.index}
	                    className="px-3 py-3"
	                    aria-sort={
	                      isActive
	                        ? summarySort.direction === 'desc'
	                          ? 'descending'
	                          : 'ascending'
	                        : 'none'
	                    }
	                  >
	                    <button
	                      type="button"
	                      className="group flex min-w-[120px] items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
	                      onClick={() => toggleSummarySort(column.index)}
	                    >
                      <span>
                        <span className="block">{column.label}</span>
                        {column.hint ? (
                          <span className="block text-[0.62rem] normal-case tracking-normal text-slate-400">
                            {column.hint}
                          </span>
                        ) : null}
                      </span>
	                      <SortIndicator active={isActive} direction={summarySort.direction} />
	                    </button>
	                  </th>
	                )})}
              </tr>
            </thead>
            <tbody>
              {sortedSummaryRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.manager}</td>
                  {getActivitySummaryCells(row).map((cell, index) => (
                      <td key={`${row.manager}-${cell.key}`} className="px-3 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span>{cell.value}</span>
                          <DeltaPill value={row.deltas?.[index] ?? activitySummaryDeltas[row.manager]?.[index] ?? '0%'} />
                        </span>
                        {cell.helper ? (
                          <span className="mt-1 block text-xs font-medium text-slate-400">{cell.helper}</span>
                        ) : null}
                        {row.comparePoints && row.comparePoints.length > 0 ? (
                          <div className="mt-2 grid max-w-[190px] gap-1">
                            {row.comparePoints.slice(0, 5).map((point) => (
                              <span
                                key={`${row.manager}-${cell.key}-${point.label}`}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[0.68rem] font-semibold text-slate-600"
                              >
                                {point.label} {point.values[index]} / {point.deltas[index]}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ActivitiesMeetingsSection report={activitiesWorkload} filters={filters} />

      <ActivitiesSlaSection report={activitiesWorkload} filters={filters} />

      {acquisitionOutcomes ? (
        <AcquisitionOutcomesSection report={acquisitionOutcomes} filters={filters} />
      ) : null}

      <BusinessClubWorkloadSection report={acquisitionOutcomes} filters={filters} />
    </div>
  )
}

function CohortsScene({ filters, runtimeData }: SceneComponentProps) {
  const [sliceMode, setSliceMode] = useState<'summary' | 'managers' | 'sources'>('summary')
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !runtimeData?.cohorts
  const sceneData = getCohortSceneData(runtimeData)
  const managerPickerOptions = getManagerPickerOptions(runtimeData)
  const sourcePickerOptions = getSourcePickerOptions(runtimeData)
  const sliceLabel =
    sliceMode === 'summary'
      ? 'общий срез'
      : sliceMode === 'managers'
        ? 'срез по менеджерам'
        : 'срез по источникам'
  const sliceDistribution =
    sliceMode === 'sources'
      ? sceneData.sourceDistribution
      : sceneData.managerDistribution
  const selectedManagers = summarizeFilterSelection(filters.managers, managerPickerOptions, 'Все менеджеры')
  const selectedSources = summarizeFilterSelection(filters.sources, sourcePickerOptions, 'Все источники')
  const cohortRangeLabel = sceneData.range
    ? `${formatFilterDate(sceneData.range.from.slice(0, 10))} - ${formatFilterDate(sceneData.range.to.slice(0, 10))}`
    : `${formatFilterDate(filters.rangeStart)} - ${formatFilterDate(filters.rangeEnd)}`

  if (isUnavailable) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Когортный отчет"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные когортного отчёта.'
              : 'Live-данные когортного отчёта сейчас недоступны.'
          }
        />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section className="panel p-5">
          <PanelHeading
            title="Когортная матрица"
            description={`Месяц создания по строкам, закрытие по окнам времени по столбцам. Матрица всегда показывает последние 12 месяцев и пересчитывается только по менеджерам и источникам, сейчас выбран ${sliceLabel}.`}
            right={
              <div className="flex flex-wrap gap-2">
                <span className="badge-chip badge-neutral">{sceneData.matrixRows.length} когорты</span>
                <span className="badge-chip badge-neutral">{getFilterScopeLabel(filters)}</span>
              </div>
            }
          />
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 text-sm">
            {[
              { id: 'summary', label: 'Общий срез' },
              { id: 'managers', label: 'По менеджерам' },
              { id: 'sources', label: 'По источникам' },
            ].map((slice) => (
              <button
                key={slice.id}
                type="button"
                onClick={() => setSliceMode(slice.id as 'summary' | 'managers' | 'sources')}
                className={
                  sliceMode === slice.id
                    ? 'rounded-full bg-slate-900 px-3 py-1.5 font-bold text-white'
                    : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:border-slate-300'
                }
              >
                {slice.label}
              </button>
            ))}
            <span className="ml-auto rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              годовой период: {cohortRangeLabel}
            </span>
          </div>
          {sliceMode !== 'summary' ? (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {sliceMode === 'managers' ? (
                <span>Выбраны менеджеры: <span className="font-semibold text-slate-900">{selectedManagers}</span></span>
              ) : (
                <span>Выбраны источники: <span className="font-semibold text-slate-900">{selectedSources}</span></span>
              )}
            </div>
          ) : null}
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-3 py-3">Когорта</th>
                  <th className="px-3 py-3">Создано</th>
                  <th className="px-3 py-3">В 1 месяц</th>
                  <th className="px-3 py-3">Во 2 месяц</th>
                  <th className="px-3 py-3">В 3 месяц</th>
                  <th className="px-3 py-3">В 4+ месяц</th>
                  <th className="px-3 py-3">Конверсия</th>
                  <th className="px-3 py-3">Средний цикл</th>
                </tr>
              </thead>
              <tbody>
                {sceneData.matrixRows.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.month}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.createdDeals}</td>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.month}-${index}`} className="px-3 py-3">
                        <div className="rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-900" style={{
                          backgroundColor:
                            cell.level === 5 ? 'rgba(77,124,255,0.24)' :
                            cell.level === 4 ? 'rgba(77,124,255,0.18)' :
                            cell.level === 3 ? 'rgba(77,124,255,0.13)' :
                            cell.level === 2 ? 'rgba(77,124,255,0.1)' :
                            'rgba(77,124,255,0.06)',
                        }}>
                          <div>{cell.value}</div>
                          {cell.subvalue ? (
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">
                              {cell.subvalue}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-3">{row.conversion}</td>
                    <td className="px-3 py-3">{row.cycle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-5">
            <PanelHeading
              title="Распределение закрытия"
              description={`Какая часть побед приходит в 1-й, 2-й, 3-й и 4+ месяц. ${getCompareLabel(filters)}.`}
            />
            <div className="space-y-4">
              {sceneData.distributionBuckets.map((bucket) => (
                <div key={bucket.label} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">{bucket.label}</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-700">{bucket.value}</div>
                      <DeltaPill value={bucket.delta} />
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#4d7cff,#9ab4ff)]"
                      style={{ width: `${bucket.width}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">предыдущий период: {bucket.compare}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <PanelHeading
              title={sliceMode === 'sources' ? 'Распределение по источникам' : 'Распределение по менеджерам'}
              description={
                sliceMode === 'sources'
                  ? 'Какие каналы чаще закрываются в 1-й, 2-й, 3-й и 4+ месяц после создания.'
                  : 'У кого чаще закрываются сделки в 1-й, 2-й, 3-й и 4+ месяц после создания.'
              }
            />
            <div className="space-y-3">
              {sliceDistribution.map((row) => (
                <div key={row.manager} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-900">{row.manager}</div>
                    <div className="text-xs font-semibold text-slate-500">пик: во 2 месяц</div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">1м: {row.month1}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">2м: {row.month2}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">3м: {row.month3}</span>
                    <span className="rounded-lg bg-white px-2 py-1 font-semibold text-slate-700">4+: {row.tail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <ManagerActionOutcomeSection report={runtimeData?.managerActionOutcomes} />
    </div>
  )
}

function FunnelFlowScene({ filters, runtimeData }: SceneComponentProps) {
  const isUnavailable = runtimeData?.operationalStatus !== 'ready' && !runtimeData?.tocFlow
  const sceneData = getTocSceneData(runtimeData)

  if (isUnavailable) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Движение по воронке"
          description={
            runtimeData?.operationalStatus === 'loading'
              ? 'Загружаю live-данные stage-flow.'
              : 'Live-данные stage-flow сейчас недоступны.'
          }
        />
      </section>
    )
  }

  if (sceneData.currentStages.length === 0) {
    return (
      <section className="panel p-5">
        <PanelHeading
          title="Движение по воронке"
          description="Для выбранного периода пока нет stage-flow данных."
        />
      </section>
    )
  }

  const currentLabel = `${formatFilterDate(filters.rangeStart)} - ${formatFilterDate(filters.rangeEnd)}`
  const compareLabel = getCompareRangeLabel(filters)
  const compareByStage = new Map(sceneData.compareStages.map((stage) => [stage.stage, stage]))
  const bottleneck = sceneData.currentStages.reduce((best, current) =>
    current.throughputPerDay < best.throughputPerDay ? current : best,
  )
  const compareBottleneck =
    sceneData.compareStages.length > 0
      ? sceneData.compareStages.reduce((best, current) =>
          current.throughputPerDay < best.throughputPerDay ? current : best,
        )
      : null
  const maxQueueStage = sceneData.currentStages.reduce((best, current) =>
    current.queueEnd > best.queueEnd ? current : best,
  )
  const throughputDropStage = sceneData.currentStages.reduce(
    (worst, current) => {
      const compare = compareByStage.get(current.stage)
      const delta = current.throughputPerDay - (compare?.throughputPerDay ?? 0)

      return delta < worst.delta ? { stage: current.stage, delta } : worst
    },
    { stage: sceneData.currentStages[0]!.stage, delta: Infinity },
  )
  const bottleneckBuffer = queueBufferDays(bottleneck.queueEnd, bottleneck.throughputPerDay)
  const maxQueueBuffer = queueBufferDays(maxQueueStage.queueEnd, maxQueueStage.throughputPerDay)
  const managerConversionStages = sceneData.managerConversionRows[0]?.stages.map((stage) => stage.stage) ?? []

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div>
          <FunnelTocChart
            current={sceneData.currentStages}
            compare={sceneData.compareStages}
            currentLabel={currentLabel}
            compareLabel={compareLabel}
          />
        </div>

        <div className="panel p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Фокус TOC</h3>
          {sceneData.warnings.length > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {sceneData.warnings.join(' · ')}
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Ограничение</p>
              <p className="font-semibold">{sceneData.focus.bottleneckStage || bottleneck.stage}</p>
              <p className="text-sm text-slate-500">Пропускная способность: {formatNumber(bottleneck.throughputPerDay)} / день</p>
              <p className="text-sm text-slate-500">Очередь: {formatNumber(bottleneck.queueEnd)}</p>
              <p className="text-sm text-slate-500">
                Буфер очереди: {bottleneckBuffer ? `${bottleneckBuffer.toFixed(1)} дн.` : '—'}
              </p>
              <p className="text-sm text-slate-500">
                Сравнение 1: {sceneData.focus.compareBottleneckStage || compareBottleneck?.stage || '—'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Где копится очередь</p>
              <p className="font-semibold">{sceneData.focus.maxQueueStage || maxQueueStage.stage}</p>
              <p className="text-sm text-slate-500">
                Объем: {formatNumber(maxQueueStage.queueEnd)} | Буфер:{' '}
                {maxQueueBuffer ? `${maxQueueBuffer.toFixed(1)} дн.` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Вывод за период</p>
              <p className="text-sm text-slate-700">
                Самая сильная просадка ПС:{' '}
                <span className="font-semibold">
                  {sceneData.focus.throughputDropStage || throughputDropStage.stage}
                </span>{' '}
                ({formatSignedNumber(throughputDropStage.delta)} сдел./день). Первый фокус: разгрузить этот этап и не переливать
                входящий поток выше его фактической ПС.
              </p>
            </div>
          </div>
        </div>
      </section>

      <FunnelStageDistributionChart distribution={sceneData.stageDistribution} />

      <section className="panel overflow-auto p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
          Стадии: основной vs сравнение 1
        </h3>
        <p className="mb-2 text-xs text-slate-500">Сравнение 1: {compareLabel}</p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
              <th className="px-2 py-2">Этап</th>
              <th className="px-2 py-2">Вход в этап</th>
              <th className="px-2 py-2">Текущая ПС/день</th>
              <th className="px-2 py-2">ПС сравнения/день</th>
              <th className="px-2 py-2">Изменение ПС</th>
              <th className="px-2 py-2">Очередь (текущая)</th>
              <th className="px-2 py-2">Очередь (сравнение)</th>
              <th className="px-2 py-2">Буфер очереди</th>
            </tr>
          </thead>
          <tbody>
            {sceneData.currentStages.map((stage) => {
              const compare = compareByStage.get(stage.stage)
              const buffer = queueBufferDays(stage.queueEnd, stage.throughputPerDay)

              return (
                <tr key={stage.stage} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-semibold text-slate-900">{stage.stage}</td>
                  <td className="px-2 py-2">{formatNumber(stage.entered)}</td>
                  <td className="px-2 py-2">{formatNumber(stage.throughputPerDay)}</td>
                  <td className="px-2 py-2">{compare ? formatNumber(compare.throughputPerDay) : '—'}</td>
                  <td className="px-2 py-2">{compare ? formatSignedNumber(stage.throughputPerDay - compare.throughputPerDay) : '—'}</td>
                  <td className="px-2 py-2">{formatNumber(stage.queueEnd)}</td>
                  <td className="px-2 py-2">{compare ? formatNumber(compare.queueEnd) : '—'}</td>
                  <td className="px-2 py-2">{buffer ? `${buffer.toFixed(1)} дн.` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {sceneData.stableLeaders.length > 0 ? (
        <section className="panel overflow-auto p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Сильные менеджеры по этапам
          </h3>
          <p className="mb-2 text-xs text-slate-500">
            Для каждого этапа показывается лидер текущего периода, его объём и признак устойчивости относительно первого compare-периода.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Этап</th>
                <th className="px-2 py-2">Лидер</th>
                <th className="px-2 py-2">Текущая конверсия</th>
                <th className="px-2 py-2">Сравнение 1</th>
                <th className="px-2 py-2">Устойчивость</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.stableLeaders.map((leader) => (
                <tr key={leader.stage} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 font-semibold text-slate-900">{leader.stage}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.manager}</div>
                    <div className="text-xs text-slate-500">{leader.volume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.conversion}</div>
                    <div className="text-xs text-slate-500">{leader.volume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{leader.compareConversion}</div>
                    <div className="text-xs text-slate-500">{leader.compareVolume}</div>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                        leader.stabilityTone === 'positive'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leader.stabilityTone === 'negative'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {leader.stabilityLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {sceneData.managerConversionRows.length > 0 ? (
        <section className="panel overflow-auto p-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            Конверсии этапов по менеджерам
          </h3>
          <p className="mb-2 text-xs text-slate-500">
            Для каждого менеджера: перешло на следующий этап / вошло в этап за основной период.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-2 py-2">Менеджер</th>
                {managerConversionStages.map((stage) => (
                  <th key={stage} className="min-w-[170px] px-2 py-2">{stage}</th>
                ))}
                <th className="px-2 py-2">Средняя</th>
              </tr>
            </thead>
            <tbody>
              {sceneData.managerConversionRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 font-semibold text-slate-900">{row.manager}</td>
                  {row.stages.map((stage) => (
                    <td key={`${row.manager}-${stage.stage}`} className="px-2 py-2">
                      <div
                        className="rounded-xl border border-slate-200 px-3 py-2"
                        style={{ backgroundColor: conversionHeatColor(stage.level) }}
                      >
                        <div className="font-bold text-slate-900">{stage.conversion}</div>
                        <div className="text-xs text-slate-500">{stage.volume}</div>
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 font-bold text-slate-900">{row.averageConversion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  )
}

export const scenes: ProtoScene[] = [
  {
    id: 'sales',
    label: 'Отчет по продажам',
    description: 'Источники, качество и проход по ключевым этапам после статуса “Готов ко встрече”.',
    focus: 'Продажи / источники / качество',
    kpis: [
      { label: 'Создано сделок', value: '182', note: 'за активный диапазон' },
      { label: 'Готов ко встрече', value: '74', note: '41% от созданных' },
      { label: 'Конверсия в звонок', value: '53%', note: 'из качества в звонок-знакомство' },
      { label: 'Win-rate', value: '18%', note: 'по всей выборке' },
      { label: 'Средний цикл', value: '28 дн.', note: 'успешная сделка' },
    ],
    component: SalesScene,
  },
  {
    id: 'sales-plan',
    label: 'План продаж',
    description: 'План продаж по менеджерам и таргет-группам/клубам заказчика.',
    focus: 'План / факт / клубы',
    kpis: [
      { label: 'Разрез плана', value: 'Менеджер × клуб', note: 'таргет-группа или клуб заказчика' },
      { label: 'Поля плана', value: 'Сделки + ₽', note: 'количество и сумма продаж' },
      { label: 'Источник факта', value: 'Won', note: 'выигранные сделки периода' },
      { label: 'Сохранение', value: 'SQLite', note: 'локальный план для отчета' },
      { label: 'Сверка', value: 'План/факт', note: 'на вкладке отчета продаж' },
    ],
    component: SalesPlanScene,
  },
  {
    id: 'activities-calls',
    label: 'Отчет активности',
    description: 'Матричная структура по менеджерам и этапам: дела, звонки и переносы дедлайнов.',
    focus: 'Дела / звонки / дисциплина',
    kpis: [
      { label: 'Создано задач', value: '486', note: 'за активный диапазон', compare: 'пред. период: 441', delta: '+10%', deltaTone: 'positive' },
      { label: 'Перенесён дедлайн', value: '92', note: '19% от всех дел', compare: 'пред. период: 104', delta: '-12%', deltaTone: 'positive' },
      { label: 'Закрыто задач', value: '401', note: '82% от созданных', compare: 'пред. период: 362', delta: '+11%', deltaTone: 'positive' },
      { label: 'Звонков на сделку', value: '2.8', note: 'среднее по воронке', compare: 'пред. период: 2.4', delta: '+17%', deltaTone: 'positive' },
      { label: 'Задач на сделку', value: '4.6', note: 'среднее по воронке', compare: 'пред. период: 4.9', delta: '-6%', deltaTone: 'neutral' },
    ],
    component: ActivitiesScene,
  },
  {
    id: 'cohorts',
    label: 'Когортный отчет',
    description: 'Создание сделки по месяцам, закрытие по окнам времени и когортная конверсия.',
    focus: 'Когорты / цикл / закрытие',
    kpis: [
      { label: 'Средняя когортная конверсия', value: '24%', note: '', compare: 'с учетом менеджеров и источников', delta: '+3 п.п.', deltaTone: 'positive' },
      { label: 'В 1 месяц', value: '8%', note: '', compare: 'пред. период: 7%', delta: '+1 п.п.', deltaTone: 'positive' },
      { label: 'Во 2 месяц', value: '9%', note: '', compare: 'пред. период: 8%', delta: '+1 п.п.', deltaTone: 'positive' },
      { label: 'В 3 месяц', value: '5%', note: '', compare: 'пред. период: 6%', delta: '-1 п.п.', deltaTone: 'negative' },
      { label: 'В 4+ месяц', value: '2%', note: '', compare: 'пред. период: 3%', delta: '-1 п.п.', deltaTone: 'positive' },
      { label: 'Средний цикл', value: '67 дн.', note: '', compare: 'пред. период: 72 дн.', delta: '-5 дн.', deltaTone: 'positive' },
    ],
    component: CohortsScene,
  },
  {
    id: 'funnel-flow',
    label: 'Движение по воронке',
    description: 'Сколько сделок копится на этапах, какая пропускная способность и где ограничение системы.',
    focus: 'Очередь / throughput / ограничения',
    kpis: [
      { label: 'Сделок в работе', value: '223', note: 'вся очередь на конец периода', compare: 'пред. период: 205', delta: '+9%', deltaTone: 'negative' },
      { label: 'Выход за период', value: '68', note: 'через все этапы воронки', compare: 'пред. период: 61', delta: '+11%', deltaTone: 'positive' },
      { label: 'Главное ограничение', value: 'Проблематизация', note: 'самый плотный этап', compare: '17 сделок в очереди' },
      { label: 'Средний WIP', value: '31', note: 'на один активный этап', compare: 'пред. период: 28', delta: '+3', deltaTone: 'negative' },
      { label: 'Средний цикл этапа', value: '9 дн.', note: 'по этапам с накоплением', compare: 'пред. период: 10 дн.', delta: '-1 дн.', deltaTone: 'positive' },
    ],
    component: FunnelFlowScene,
  },
]
