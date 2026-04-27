import { useState, type ReactNode } from 'react'

import type {
  PickerOption,
  ProtoFilterState,
  ProtoScene,
  SceneComponentProps,
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

type ActivityRow = {
  manager: string
  createdTasks: string
  outgoing: string
  successfulCalls: string
  otherOutgoing: string
  incoming: string
  noAnswer: string
  closedTasks: string
}

type ActivityMatrixRow = {
  manager: string
  stages: Array<{
    label: string
    callsPerDeal: string
    closedTasksAvg: string
    level: number
  }>
  avgCalls: string
  avgClosedTasks: string
}

type HeatCell = {
  value: string
  level: number
}

type Tone = 'positive' | 'negative' | 'neutral'

type FlowStageMetric = {
  stage: string
  entered: number
  throughputPerDay: number
  queueEnd: number
  avgCycleDays: number
  note: string
}

const salesRows: SalesRow[] = [
  { source: 'Платный поиск', created: '68', quality: '41', ready: '33', intro: '24', won: '12', cycle: '26 дн.' },
  { source: 'Партнёры', created: '54', quality: '38', ready: '29', intro: '21', won: '14', cycle: '22 дн.' },
  { source: 'Вебинары', created: '37', quality: '19', ready: '14', intro: '9', won: '5', cycle: '34 дн.' },
  { source: 'Органика', created: '23', quality: '12', ready: '9', intro: '7', won: '3', cycle: '31 дн.' },
]

const activityRows: ActivityRow[] = [
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

const activityMatrixRows: ActivityMatrixRow[] = [
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
]

const cohortRows: Array<{
  month: string
  cells: HeatCell[]
  conversion: string
  cycle: string
}> = [
  {
    month: 'Октябрь 2025',
    cells: [
      { value: '6', level: 3 },
      { value: '11', level: 5 },
      { value: '7', level: 4 },
      { value: '3', level: 2 },
      { value: '1', level: 1 },
    ],
    conversion: '31%',
    cycle: '59 дн.',
  },
  {
    month: 'Ноябрь 2025',
    cells: [
      { value: '5', level: 2 },
      { value: '13', level: 5 },
      { value: '8', level: 4 },
      { value: '4', level: 2 },
      { value: '2', level: 1 },
    ],
    conversion: '29%',
    cycle: '63 дн.',
  },
  {
    month: 'Декабрь 2025',
    cells: [
      { value: '4', level: 2 },
      { value: '10', level: 4 },
      { value: '9', level: 4 },
      { value: '6', level: 3 },
      { value: '3', level: 2 },
    ],
    conversion: '26%',
    cycle: '67 дн.',
  },
  {
    month: 'Январь 2026',
    cells: [
      { value: '3', level: 1 },
      { value: '9', level: 4 },
      { value: '11', level: 5 },
      { value: '6', level: 3 },
      { value: '4', level: 2 },
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

const cycleBuckets = [
  { label: 'В 1 месяц', value: '8%', compare: '7%', delta: '+1 п.п.', width: 32 },
  { label: 'Во 2 месяц', value: '9%', compare: '8%', delta: '+1 п.п.', width: 44 },
  { label: 'В 3 месяц', value: '5%', compare: '6%', delta: '-1 п.п.', width: 24 },
  { label: 'В 4+ месяц', value: '2%', compare: '3%', delta: '-1 п.п.', width: 14 },
]

const activitySummaryDeltas: Record<string, string[]> = {
  'Анна Петрова': ['+9%', '+6%', '+12%', '+3%', '+4%', '-5%', '+8%'],
  'Илья Ковалёв': ['-3%', '+2%', '+7%', '+5%', '+1%', '+4%', '-2%'],
  'Марина Орлова': ['+14%', '+11%', '+15%', '+4%', '-6%', '-8%', '+10%'],
  'Ольга Лунёва': ['+4%', '-2%', '+5%', '+1%', '+3%', '-11%', '+6%'],
}

const cohortManagerDistribution = [
  { manager: 'Анна Петрова', month1: '7%', month2: '12%', month3: '6%', tail: '2%', width: 82 },
  { manager: 'Марина Орлова', month1: '9%', month2: '10%', month3: '5%', tail: '3%', width: 76 },
  { manager: 'Илья Ковалёв', month1: '6%', month2: '8%', month3: '4%', tail: '2%', width: 62 },
  { manager: 'Ольга Лунёва', month1: '5%', month2: '7%', month3: '4%', tail: '1%', width: 54 },
]

const cohortSourceDistribution = [
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
            <g key={`grid-${tick}`}>
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

export const defaultFilters: ProtoFilterState = {
  rangeStart: '2026-03-01',
  rangeEnd: '2026-03-31',
  compareRanges: [],
  managers: [],
  sources: [],
}

function PanelHeading({
  title,
  description,
  right,
}: {
  title: string
  description?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {right}
    </div>
  )
}

function SalesScene() {
  return (
    <div className="space-y-6">
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
    </div>
  )
}

function ActivitiesScene({ filters }: SceneComponentProps) {
  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <PanelHeading
          title="Матрица активности"
          description="Показывает текущий период, сравнение и процентную динамику по выбранному окну фильтров."
          right={
            <div className="flex flex-wrap gap-2">
              <span className="badge-chip badge-neutral">4 менеджера · 9 этапов</span>
              <span className="badge-chip badge-neutral">{getCompareLabel(filters)}</span>
            </div>
          }
        />
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.1em] text-slate-500">
                <th className="px-3 py-3">Менеджер</th>
                {activityStages.map((stage) => (
                  <th key={stage} className="px-3 py-3">{stage}</th>
                ))}
                <th className="px-3 py-3">Итого</th>
              </tr>
            </thead>
            <tbody>
              {activityMatrixRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold text-slate-900">{row.manager}</div>
                  </td>
                  {row.stages.map((stage) => (
                    <td key={`${row.manager}-${stage.label}`} className="min-w-[180px] px-3 py-3 align-top">
                      <div
                        className="grid gap-2 rounded-xl border border-slate-200 px-3 py-3"
                        style={{
                          backgroundColor:
                            stage.level >= 5 ? 'rgba(77,124,255,0.18)' :
                            stage.level === 4 ? 'rgba(77,124,255,0.14)' :
                            stage.level === 3 ? 'rgba(77,124,255,0.1)' :
                            stage.level === 2 ? 'rgba(77,124,255,0.07)' :
                            'rgba(77,124,255,0.04)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Звонки</span>
                          <span className="flex items-center gap-1.5">
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-sm font-bold text-slate-900">
                              {stage.callsPerDeal}
                            </span>
                            <DeltaPill value={getStageDelta(stage.level)} />
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Закрыто дел</span>
                          <span className="flex items-center gap-1.5">
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-sm font-bold text-slate-900">
                              {stage.closedTasksAvg}
                            </span>
                            <DeltaPill value={stage.level >= 3 ? '+5%' : '-4%'} />
                          </span>
                        </div>
                      </div>
                    </td>
                  ))}
                  <td className="px-3 py-3 align-top">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Звонки</span>
                        <span className="flex items-center gap-2">
                          <strong className="text-slate-900">{row.avgCalls}</strong>
                          <DeltaPill value="+7%" />
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500">Закрыто дел</span>
                        <span className="flex items-center gap-2">
                          <strong className="text-slate-900">{row.avgClosedTasks}</strong>
                          <DeltaPill value="+4%" />
                        </span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                <th className="px-3 py-3">Создано дел</th>
                <th className="px-3 py-3">Исходящие</th>
                <th className="px-3 py-3">Успешные &gt;30 сек</th>
                <th className="px-3 py-3">Прочие исходящие</th>
                <th className="px-3 py-3">Входящие</th>
                <th className="px-3 py-3">Недозвоны</th>
                <th className="px-3 py-3">Закрыто дел</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.map((row) => (
                <tr key={row.manager} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-semibold text-slate-900">{row.manager}</td>
                  {[row.createdTasks, row.outgoing, row.successfulCalls, row.otherOutgoing, row.incoming, row.noAnswer, row.closedTasks].map(
                    (value, index) => (
                      <td key={`${row.manager}-${index}`} className="px-3 py-3">
                        <span className="inline-flex items-center gap-2">
                          <span>{value}</span>
                          <DeltaPill value={activitySummaryDeltas[row.manager]?.[index] ?? '0%'} />
                        </span>
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CohortsScene({ filters }: SceneComponentProps) {
  const [sliceMode, setSliceMode] = useState<'summary' | 'managers' | 'sources'>('summary')
  const sliceLabel =
    sliceMode === 'summary'
      ? 'общий срез'
      : sliceMode === 'managers'
        ? 'срез по менеджерам'
        : 'срез по источникам'
  const sliceDistribution =
    sliceMode === 'sources' ? cohortSourceDistribution : cohortManagerDistribution
  const selectedManagers = summarizeFilterSelection(filters.managers, managerOptions, 'Все менеджеры')
  const selectedSources = summarizeFilterSelection(filters.sources, sourceOptions, 'Все источники')

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <section className="panel p-5">
          <PanelHeading
            title="Когортная матрица"
            description={`Месяц создания по строкам, закрытие по окнам времени по столбцам. Матрица пересчитывается по менеджерам, источникам и основному диапазону из фильтров, сейчас выбран ${sliceLabel}.`}
            right={
              <div className="flex flex-wrap gap-2">
                <span className="badge-chip badge-neutral">4 когорты</span>
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
              основной период: {formatFilterDate(filters.rangeStart)} - {formatFilterDate(filters.rangeEnd)}
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
                  <th className="px-3 py-3">В 1 месяц</th>
                  <th className="px-3 py-3">Во 2 месяц</th>
                  <th className="px-3 py-3">В 3 месяц</th>
                  <th className="px-3 py-3">В 4 месяц</th>
                  <th className="px-3 py-3">В 4+ месяц</th>
                  <th className="px-3 py-3">Конверсия</th>
                  <th className="px-3 py-3">Средний цикл</th>
                </tr>
              </thead>
              <tbody>
                {cohortRows.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-3 font-semibold text-slate-900">{row.month}</td>
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
              {cycleBuckets.map((bucket) => (
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
    </div>
  )
}

function FunnelFlowScene({ filters }: SceneComponentProps) {
  const currentLabel = `${formatFilterDate(filters.rangeStart)} - ${formatFilterDate(filters.rangeEnd)}`
  const compareLabel = getCompareRangeLabel(filters)
  const compareByStage = new Map(funnelFlowCompare.map((stage) => [stage.stage, stage]))
  const bottleneck = funnelFlowCurrent.reduce((best, current) =>
    current.throughputPerDay < best.throughputPerDay ? current : best,
  )
  const compareBottleneck = funnelFlowCompare.reduce((best, current) =>
    current.throughputPerDay < best.throughputPerDay ? current : best,
  )
  const maxQueueStage = funnelFlowCurrent.reduce((best, current) =>
    current.queueEnd > best.queueEnd ? current : best,
  )
  const throughputDropStage = funnelFlowCurrent.reduce(
    (worst, current) => {
      const compare = compareByStage.get(current.stage)
      const delta = current.throughputPerDay - (compare?.throughputPerDay ?? 0)

      return delta < worst.delta ? { stage: current.stage, delta } : worst
    },
    { stage: funnelFlowCurrent[0]!.stage, delta: Infinity },
  )
  const bottleneckBuffer = queueBufferDays(bottleneck.queueEnd, bottleneck.throughputPerDay)
  const maxQueueBuffer = queueBufferDays(maxQueueStage.queueEnd, maxQueueStage.throughputPerDay)

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
        <div>
          <FunnelTocChart
            current={funnelFlowCurrent}
            compare={funnelFlowCompare}
            currentLabel={currentLabel}
            compareLabel={compareLabel}
          />
        </div>

        <div className="panel p-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">Фокус TOC</h3>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Ограничение</p>
              <p className="font-semibold">{bottleneck.stage}</p>
              <p className="text-sm text-slate-500">Пропускная способность: {formatNumber(bottleneck.throughputPerDay)} / день</p>
              <p className="text-sm text-slate-500">Очередь: {formatNumber(bottleneck.queueEnd)}</p>
              <p className="text-sm text-slate-500">
                Буфер очереди: {bottleneckBuffer ? `${bottleneckBuffer.toFixed(1)} дн.` : '—'}
              </p>
              <p className="text-sm text-slate-500">Сравнение 1: {compareBottleneck.stage}</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Где копится очередь</p>
              <p className="font-semibold">{maxQueueStage.stage}</p>
              <p className="text-sm text-slate-500">
                Объем: {formatNumber(maxQueueStage.queueEnd)} | Буфер:{' '}
                {maxQueueBuffer ? `${maxQueueBuffer.toFixed(1)} дн.` : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/65 p-3">
              <p className="text-xs text-slate-500">Вывод недели</p>
              <p className="text-sm text-slate-700">
                Самая сильная просадка ПС: <span className="font-semibold">{throughputDropStage.stage}</span>{' '}
                ({formatSignedNumber(throughputDropStage.delta)} сдел./день). Первый фокус: разгрузить этот этап и не переливать
                входящий поток выше его фактической ПС.
              </p>
            </div>
          </div>
        </div>
      </section>

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
            {funnelFlowCurrent.map((stage) => {
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
    id: 'activities-calls',
    label: 'Отчет активности',
    description: 'Матричная структура по менеджерам и этапам: дела, звонки и переносы дедлайнов.',
    focus: 'Дела / звонки / дисциплина',
    kpis: [
      { label: 'Создано дел', value: '486', note: 'за активный диапазон', compare: 'пред. период: 441', delta: '+10%', deltaTone: 'positive' },
      { label: 'Перенесён дедлайн', value: '92', note: '19% от всех дел', compare: 'пред. период: 104', delta: '-12%', deltaTone: 'positive' },
      { label: 'Закрыто дел', value: '401', note: '82% от созданных', compare: 'пред. период: 362', delta: '+11%', deltaTone: 'positive' },
      { label: 'Звонков на сделку', value: '2.8', note: 'среднее по воронке', compare: 'пред. период: 2.4', delta: '+17%', deltaTone: 'positive' },
      { label: 'Дел на сделку', value: '4.6', note: 'среднее по воронке', compare: 'пред. период: 4.9', delta: '-6%', deltaTone: 'neutral' },
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
      { label: 'Выход в неделю', value: '68', note: 'через все этапы воронки', compare: 'пред. период: 61', delta: '+11%', deltaTone: 'positive' },
      { label: 'Главное ограничение', value: 'Проблематизация', note: 'самый плотный этап', compare: '17 сделок в очереди' },
      { label: 'Средний WIP', value: '31', note: 'на один активный этап', compare: 'пред. период: 28', delta: '+3', deltaTone: 'negative' },
      { label: 'Средний цикл этапа', value: '9 дн.', note: 'по этапам с накоплением', compare: 'пред. период: 10 дн.', delta: '-1 дн.', deltaTone: 'positive' },
    ],
    component: FunnelFlowScene,
  },
]
