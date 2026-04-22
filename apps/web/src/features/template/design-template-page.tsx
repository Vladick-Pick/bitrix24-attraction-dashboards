import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ReportId = 'conversion' | 'activities' | 'calls'
type PeriodId = '7d' | '30d' | '90d' | 'custom'

interface MetricItem {
  label: string
  value: string
  note: string
}

interface StageItem {
  label: string
  note: string
  volume: string
  conversion: string
  time: string
  progress: number
}

interface TableRowItem {
  label: string
  note: string
  progress: number
  values: string[]
}

interface InsightGroup {
  title: string
  items: Array<{
    label: string
    value: string
    note: string
  }>
}

interface ReportDefinition {
  filterLabel: string
  title: string
  description: string
  metrics: MetricItem[]
  stageTitle: string
  stageDescription: string
  stages: StageItem[]
  tableTitle: string
  tableDescription: string
  tableColumns: string[]
  tableRows: TableRowItem[]
  insightGroups: InsightGroup[]
}

const REPORT_OPTIONS: Array<{ value: ReportId; label: string }> = [
  { value: 'conversion', label: 'Источники и качество' },
  { value: 'activities', label: 'Дела' },
  { value: 'calls', label: 'Звонки' },
]

const MANAGER_OPTIONS = ['Анна', 'Илья', 'Марина', 'Руслан'] as const

const COMPARISON_OPTIONS = [
  { value: 'prev-period', label: 'К предыдущему периоду' },
  { value: 'month-back', label: 'К прошлому месяцу' },
  { value: 'quarter-back', label: 'К прошлому кварталу' },
  { value: 'year-back', label: 'Год к году' },
] as const

type ComparisonId = (typeof COMPARISON_OPTIONS)[number]['value']

const PERIOD_RANGES: Record<
  Exclude<PeriodId, 'custom'>,
  { label: string; from: string; to: string }
> = {
  '7d': {
    label: '02 апр - 08 апр 2026',
    from: '2026-04-02',
    to: '2026-04-08',
  },
  '30d': {
    label: '10 мар - 08 апр 2026',
    from: '2026-03-10',
    to: '2026-04-08',
  },
  '90d': {
    label: '10 янв - 08 апр 2026',
    from: '2026-01-10',
    to: '2026-04-08',
  },
}

const REPORTS: Record<ReportId, ReportDefinition> = {
  conversion: {
    filterLabel: 'Источники и качество',
    title: 'Конверсия по источникам и качеству',
    description:
      'Рабочий экран для анализа того, как сделки из статуса «Готов ко встрече» идут по этапам, где ломается конверсия и сколько времени в среднем уходит на каждую ступень.',
    metrics: [
      {
        label: 'Создано в статусе «Готов ко встрече»',
        value: '148',
        note: 'Вся стартовая база за период',
      },
      {
        label: 'Дошли до звонка-знакомства',
        value: '96',
        note: '64,8% от стартового объема',
      },
      {
        label: 'Сквозная конверсия в выигранные',
        value: '12,1%',
        note: '18 сделок закрыты успешно',
      },
      {
        label: 'Среднее время на этапе',
        value: '2,4 дня',
        note: 'По активным этапам воронки',
      },
    ],
    stageTitle: 'Переход по этапам',
    stageDescription:
      'Короткая линия движения вместо большой диаграммы: объём, конверсия и среднее время видны в одном списке.',
    stages: [
      {
        label: 'Создано',
        note: 'Стартовая база',
        volume: '148',
        conversion: '100%',
        time: '0,8 дня',
        progress: 100,
      },
      {
        label: 'Звонок-знакомство',
        note: 'Первое подтверждение интереса',
        volume: '96',
        conversion: '64,8%',
        time: '1,4 дня',
        progress: 64.8,
      },
      {
        label: 'Встреча-знакомство',
        note: 'Главный фильтр качества',
        volume: '54',
        conversion: '36,5%',
        time: '2,7 дня',
        progress: 36.5,
      },
      {
        label: 'Активация',
        note: 'Длинный этап принятия решения',
        volume: '29',
        conversion: '19,6%',
        time: '3,1 дня',
        progress: 19.6,
      },
      {
        label: 'Выиграно',
        note: 'Финальный выход',
        volume: '18',
        conversion: '12,1%',
        time: '1,2 дня',
        progress: 12.1,
      },
    ],
    tableTitle: 'Источники трафика',
    tableDescription:
      'Основной рабочий срез собран в плотную таблицу: источник, качество, прохождение по этапам и среднее время без лишних карточек.',
    tableColumns: [
      'Создано',
      'Звонок',
      'Встреча',
      'Конверсия',
      'Ср. время',
    ],
    tableRows: [
      {
        label: 'Платный поиск',
        note: 'Качество A/B, быстрый проход',
        progress: 72,
        values: ['48', '34', '22', '45,8%', '1,8 дня'],
      },
      {
        label: 'Партнёрские рекомендации',
        note: 'Стабильный высокий intent',
        progress: 66,
        values: ['36', '23', '17', '47,2%', '2,1 дня'],
      },
      {
        label: 'Вебинары',
        note: 'Большой объем, ниже конверсия',
        progress: 44,
        values: ['29', '18', '10', '34,4%', '3,2 дня'],
      },
      {
        label: 'Органика',
        note: 'Ровный поток без всплесков',
        progress: 39,
        values: ['21', '12', '7', '33,3%', '2,9 дня'],
      },
    ],
    insightGroups: [
      {
        title: 'Итоговое качество',
        items: [
          { label: 'Качество A', value: '41%', note: 'Лучшая конверсия во встречу' },
          { label: 'Качество B', value: '37%', note: 'Основной рабочий объем' },
          { label: 'Качество C', value: '22%', note: 'Требует дополнительного прогрева' },
        ],
      },
      {
        title: 'Что держать в фокусе',
        items: [
          { label: 'Узкое место', value: 'Встреча', note: 'Здесь теряется основной объем' },
          { label: 'Лучший канал', value: 'Партнёры', note: 'Самая ровная конверсия' },
          { label: 'Следующий шаг', value: 'Качество C', note: 'Нужен отдельный сценарий касаний' },
        ],
      },
    ],
  },
  activities: {
    filterLabel: 'Дела',
    title: 'Отчет по делам менеджеров',
    description:
      'Компактный шаблон для контроля нагрузки: сколько дел создано, сколько раз переносили крайний срок, как выглядит закрытие и где на этапах скапливается работа.',
    metrics: [
      {
        label: 'Создано дел',
        value: '486',
        note: 'По выбранным менеджерам за период',
      },
      {
        label: 'Перенесён крайний срок',
        value: '74',
        note: '15,2% от всех созданных дел',
      },
      {
        label: 'Закрыто',
        value: '402',
        note: '82,7% завершены в срок',
      },
      {
        label: 'В среднем на сделку',
        value: '3,2',
        note: 'По этапам действующей воронки',
      },
    ],
    stageTitle: 'Статус дел',
    stageDescription:
      'Линия по действиям помогает быстро увидеть остаток в работе, долю переносов и плотность закрытия.',
    stages: [
      {
        label: 'Создано',
        note: 'Весь входящий поток',
        volume: '486',
        conversion: '100%',
        time: '0,6 дня',
        progress: 100,
      },
      {
        label: 'Активно',
        note: 'Остались в работе',
        volume: '84',
        conversion: '17,3%',
        time: '2,2 дня',
        progress: 17.3,
      },
      {
        label: 'Перенесено',
        note: 'Зона контроля по SLA',
        volume: '74',
        conversion: '15,2%',
        time: '1,6 дня',
        progress: 15.2,
      },
      {
        label: 'Закрыто',
        note: 'Финальный статус',
        volume: '402',
        conversion: '82,7%',
        time: '1,9 дня',
        progress: 82.7,
      },
    ],
    tableTitle: 'Нагрузка по менеджерам',
    tableDescription:
      'Вместо россыпи виджетов здесь один список, где сразу видно объём, переносы, закрытие и плотность работы по сделкам.',
    tableColumns: [
      'Создано',
      'Переносов',
      'Закрыто',
      'На сделку',
      'Ср. по этапам',
    ],
    tableRows: [
      {
        label: 'Анна',
        note: 'Лучший ритм закрытия',
        progress: 88,
        values: ['132', '14', '118', '2,8', '1,9 дня'],
      },
      {
        label: 'Илья',
        note: 'Ровная загрузка без перегруза',
        progress: 74,
        values: ['121', '19', '94', '3,1', '2,3 дня'],
      },
      {
        label: 'Марина',
        note: 'Есть накопление на середине воронки',
        progress: 63,
        values: ['118', '24', '81', '3,5', '2,8 дня'],
      },
      {
        label: 'Руслан',
        note: 'Больше переносов по срокам',
        progress: 58,
        values: ['115', '17', '109', '3,3', '2,4 дня'],
      },
    ],
    insightGroups: [
      {
        title: 'Риск по нагрузке',
        items: [
          { label: 'Перегруз', value: 'Марина', note: 'Больше всего дел на сделку' },
          { label: 'Стабильность', value: 'Анна', note: 'Лучший баланс закрытия' },
          { label: 'Потенциал', value: 'Руслан', note: 'Нужно сократить переносы' },
        ],
      },
      {
        title: 'Контроль по SLA',
        items: [
          { label: 'Вовремя закрыто', value: '82,7%', note: 'Текущий ориентир команды' },
          { label: 'Сдвиг срока', value: '15,2%', note: 'Цель на снижение' },
          { label: 'Осталось в работе', value: '17,3%', note: 'Контроль на следующую неделю' },
        ],
      },
    ],
  },
  calls: {
    filterLabel: 'Звонки',
    title: 'Отчет по звонкам по сделкам',
    description:
      'Шаблон для звонковой аналитики: нагрузка по менеджерам, входящие и исходящие касания, а также среднее число звонков по сделкам на разных этапах.',
    metrics: [
      {
        label: 'Всего звонков',
        value: '912',
        note: 'Весь поток за выбранный период',
      },
      {
        label: 'Входящие',
        value: '274',
        note: '30,0% от общего объёма',
      },
      {
        label: 'Исходящие',
        value: '638',
        note: 'Основной рабочий контур',
      },
      {
        label: 'В среднем на сделку',
        value: '4,8',
        note: 'По этапам воронки',
      },
    ],
    stageTitle: 'Структура звонков',
    stageDescription:
      'Один короткий блок вместо перегруженной диаграммы: видно объём, тип касаний и насыщенность этапов.',
    stages: [
      {
        label: 'Всего',
        note: 'Суммарная активность',
        volume: '912',
        conversion: '100%',
        time: '4,8',
        progress: 100,
      },
      {
        label: 'Входящие',
        note: 'Сигнал интереса после заявок',
        volume: '274',
        conversion: '30%',
        time: '1,4',
        progress: 30,
      },
      {
        label: 'Исходящие',
        note: 'Основной объём follow-up',
        volume: '638',
        conversion: '70%',
        time: '3,4',
        progress: 70,
      },
      {
        label: 'До встречи',
        note: 'Среднее число касаний',
        volume: '2,3',
        conversion: '48%',
        time: '2,3',
        progress: 48,
      },
      {
        label: 'После встречи',
        note: 'Контроль подтверждения',
        volume: '1,2',
        conversion: '25%',
        time: '1,2',
        progress: 25,
      },
    ],
    tableTitle: 'Нагрузка по менеджерам',
    tableDescription:
      'Таблица остается главным экраном: интенсивность звонков, баланс типов и среднее число касаний на сделку видно без прокрутки через графики.',
    tableColumns: [
      'Всего',
      'Входящие',
      'Исходящие',
      'На сделку',
      'Пик этапа',
    ],
    tableRows: [
      {
        label: 'Анна',
        note: 'Сильный входящий поток',
        progress: 82,
        values: ['248', '93', '155', '5,2', 'После встречи'],
      },
      {
        label: 'Илья',
        note: 'Стабильный follow-up',
        progress: 69,
        values: ['219', '54', '165', '4,4', 'После звонка'],
      },
      {
        label: 'Марина',
        note: 'Больше исходящих дожимов',
        progress: 64,
        values: ['207', '47', '160', '4,7', 'После активации'],
      },
      {
        label: 'Руслан',
        note: 'Ровная ежедневная активность',
        progress: 61,
        values: ['238', '80', '158', '4,9', 'После повторного касания'],
      },
    ],
    insightGroups: [
      {
        title: 'Баланс звонков',
        items: [
          { label: 'Входящие', value: '30%', note: 'Чаще всего после заявок' },
          { label: 'Исходящие', value: '70%', note: 'Основной рабочий объем' },
          { label: 'Повторные касания', value: '2,1', note: 'Среднее до следующего этапа' },
        ],
      },
      {
        title: 'Сигналы по этапам',
        items: [
          { label: 'До звонка-знакомства', value: '1,6', note: 'Касаний на сделку' },
          { label: 'До встречи', value: '2,3', note: 'Нужно больше подтверждений' },
          { label: 'До активации', value: '0,9', note: 'Точечный контроль менеджера' },
        ],
      },
    ],
  },
}

function formatDateRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return `${formatter.format(new Date(`${from}T00:00:00`))} - ${formatter.format(
    new Date(`${to}T00:00:00`),
  )}`
}

function buildComparisonSummary(values: ComparisonId[]) {
  if (values.length === 0) {
    return 'Без сравнения'
  }

  const labels = values.reduce<string[]>((accumulator, value) => {
    const label = COMPARISON_OPTIONS.find((option) => option.value === value)?.label

    if (label) {
      accumulator.push(label)
    }

    return accumulator
  }, [])

  return labels.join(' · ')
}

function buildManagersSummary(values: string[]) {
  if (values.length === MANAGER_OPTIONS.length) {
    return 'Все менеджеры'
  }

  if (values.length === 0) {
    return 'Не выбраны'
  }

  return values.join(', ')
}

export function DesignTemplatePage() {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ReportId>('conversion')
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>('30d')
  const [selectedManagers, setSelectedManagers] = useState<string[]>(
    MANAGER_OPTIONS.slice(),
  )
  const [selectedComparisons, setSelectedComparisons] = useState<ComparisonId[]>([
    'prev-period',
    'year-back',
  ])
  const [customRange, setCustomRange] = useState({
    from: PERIOD_RANGES['30d'].from,
    to: PERIOD_RANGES['30d'].to,
  })

  const activeReport = REPORTS[selectedReport]
  const activeRange =
    selectedPeriod === 'custom'
      ? customRange
      : {
          from: PERIOD_RANGES[selectedPeriod].from,
          to: PERIOD_RANGES[selectedPeriod].to,
        }

  const visibleRangeLabel =
    selectedPeriod === 'custom'
      ? formatDateRange(customRange.from, customRange.to)
      : PERIOD_RANGES[selectedPeriod].label

  const comparisonSummary = buildComparisonSummary(selectedComparisons)
  const managerSummary = buildManagersSummary(selectedManagers)

  return (
    <main className="lead-design-page">
      <div className="lead-design-shell">
        <header className="lead-panel lead-header">
          <div className="lead-header-copy">
            <span className="lead-kicker">Модуль «Привлечение»</span>
            <h1 className="lead-page-title">Шаблон отчетов по привлечению</h1>
            <p className="lead-page-note">
              Адаптация рабочего дизайна из проекта лидогенерации: один экран,
              скрываемые фильтры и плотная аналитика без декоративного шума.
            </p>
          </div>

          <div className="lead-header-meta">
            <Badge variant="outline" className="lead-badge">
              Дизайн-шаблон
            </Badge>
            <span className="lead-meta-pill">Один отчет на экране</span>
            <span className="lead-meta-pill">Компактный режим</span>
          </div>
        </header>

        <Collapsible
          open={isFiltersOpen}
          onOpenChange={setIsFiltersOpen}
          className="lead-panel"
        >
          <div className="lead-filter-bar">
            <div className="lead-filter-summary">
              <div className="lead-summary-item">
                <span className="lead-summary-label">Отчет</span>
                <strong className="lead-summary-value">
                  {activeReport.filterLabel}
                </strong>
              </div>
              <div className="lead-summary-item">
                <span className="lead-summary-label">Диапазон</span>
                <strong className="lead-summary-value">{visibleRangeLabel}</strong>
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                {isFiltersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="lead-filter-content">
              <div className="lead-filter-head">
                <div>
                  <span className="lead-summary-label">Состав фильтров</span>
                  <p className="lead-filter-note">
                    Скрытый режим показывает только отчет и даты. Всё остальное
                    раскрывается по запросу.
                  </p>
                </div>
              </div>

              <div className="lead-filter-grid">
                <section className="lead-filter-group">
                  <span className="lead-summary-label">Отчет</span>
                  <ToggleGroup
                    type="single"
                    value={selectedReport}
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedReport(value as ReportId)
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="lead-toggle-wrap"
                    aria-label="Выбор отчета"
                  >
                    {REPORT_OPTIONS.map((report) => (
                      <ToggleGroupItem key={report.value} value={report.value}>
                        {report.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </section>

                <section className="lead-filter-group">
                  <span className="lead-summary-label">Ответственные менеджеры</span>
                  <ToggleGroup
                    type="multiple"
                    value={selectedManagers}
                    onValueChange={(value) => setSelectedManagers(value)}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="lead-toggle-wrap"
                    aria-label="Выбор менеджеров"
                  >
                    {MANAGER_OPTIONS.map((manager) => (
                      <ToggleGroupItem key={manager} value={manager}>
                        {manager}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </section>

                <section className="lead-filter-group">
                  <span className="lead-summary-label">Быстрый период</span>
                  <ToggleGroup
                    type="single"
                    value={selectedPeriod}
                    onValueChange={(value) => {
                      if (value) {
                        setSelectedPeriod(value as PeriodId)
                      }
                    }}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="lead-toggle-wrap"
                    aria-label="Выбор периода"
                  >
                    <ToggleGroupItem value="7d">7 дней</ToggleGroupItem>
                    <ToggleGroupItem value="30d">30 дней</ToggleGroupItem>
                    <ToggleGroupItem value="90d">90 дней</ToggleGroupItem>
                    <ToggleGroupItem value="custom">Свои даты</ToggleGroupItem>
                  </ToggleGroup>
                </section>

                <section className="lead-filter-group">
                  <span className="lead-summary-label">Даты диапазона</span>
                  <div className="lead-date-grid">
                    <label className="lead-date-field">
                      <span>С</span>
                      <Input
                        type="date"
                        value={activeRange.from}
                        onChange={(event) => {
                          setSelectedPeriod('custom')
                          setCustomRange((current) => ({
                            ...current,
                            from: event.target.value,
                          }))
                        }}
                        aria-label="Дата начала"
                      />
                    </label>
                    <label className="lead-date-field">
                      <span>По</span>
                      <Input
                        type="date"
                        value={activeRange.to}
                        onChange={(event) => {
                          setSelectedPeriod('custom')
                          setCustomRange((current) => ({
                            ...current,
                            to: event.target.value,
                          }))
                        }}
                        aria-label="Дата окончания"
                      />
                    </label>
                  </div>
                </section>
              </div>

              <section className="lead-filter-group">
                <span className="lead-summary-label">Сравнение периода</span>
                <p className="lead-filter-note">
                  Можно держать до пяти сравнительных окон. Сейчас это шаблон
                  поведения интерфейса.
                </p>
                <ToggleGroup
                  type="multiple"
                  value={selectedComparisons}
                  onValueChange={(value) => {
                    if (value.length <= 5) {
                      setSelectedComparisons(value as ComparisonId[])
                    }
                  }}
                  variant="outline"
                  size="sm"
                  spacing={1}
                  className="lead-toggle-wrap"
                  aria-label="Выбор сравнения"
                >
                  {COMPARISON_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </section>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <section className="lead-panel lead-kpi-panel">
          {activeReport.metrics.map((metric) => (
            <div key={metric.label} className="lead-kpi">
              <span className="lead-summary-label">{metric.label}</span>
              <strong className="lead-kpi-value">{metric.value}</strong>
              <span className="lead-kpi-note">{metric.note}</span>
            </div>
          ))}
        </section>

        <section className="lead-report-grid">
          <section className="lead-panel lead-main-panel">
            <div className="lead-report-head">
              <span className="lead-kicker">Активный отчет</span>
              <h2 className="lead-report-title">{activeReport.title}</h2>
              <p className="lead-report-description">{activeReport.description}</p>
              <p className="lead-inline-context">
                <span>Период: {visibleRangeLabel}</span>
                <span>Менеджеры: {managerSummary}</span>
                <span>Сравнение: {comparisonSummary}</span>
              </p>
            </div>

            <section className="lead-stage-panel">
              <div className="lead-section-head">
                <div>
                  <span className="lead-summary-label">{activeReport.stageTitle}</span>
                  <p className="lead-section-note">
                    {activeReport.stageDescription}
                  </p>
                </div>
              </div>

              <div className="lead-stage-board">
                <div className="lead-stage-header">
                  <span>Этап</span>
                  <span>Объем</span>
                  <span>Конверсия</span>
                  <span>Ср. время</span>
                </div>

                {activeReport.stages.map((stage) => (
                  <div key={stage.label} className="lead-stage-row">
                    <div className="lead-stage-copy">
                      <strong>{stage.label}</strong>
                      <span>{stage.note}</span>
                      <div className="lead-stage-track">
                        <span style={{ width: `${stage.progress}%` }} />
                      </div>
                    </div>
                    <span className="lead-stage-number">{stage.volume}</span>
                    <span className="lead-stage-number">{stage.conversion}</span>
                    <span className="lead-stage-number">{stage.time}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="lead-table-panel">
              <div className="lead-section-head">
                <div>
                  <span className="lead-summary-label">{activeReport.tableTitle}</span>
                  <p className="lead-section-note">
                    {activeReport.tableDescription}
                  </p>
                </div>
              </div>

              <div className="lead-table-wrap">
                <Table className="lead-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Сегмент</TableHead>
                      {activeReport.tableColumns.map((column) => (
                        <TableHead key={column} className="text-right">
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeReport.tableRows.map((row) => (
                      <TableRow key={row.label} className="lead-table-row">
                        <TableCell className="lead-row-label-cell">
                          <div className="lead-row-copy">
                            <strong>{row.label}</strong>
                            <span>{row.note}</span>
                            <div className="lead-row-track">
                              <span style={{ width: `${row.progress}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        {row.values.map((value) => (
                          <TableCell
                            key={`${row.label}-${value}`}
                            className="text-right tabular-nums"
                          >
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </section>

          <aside className="lead-panel lead-side-panel">
            {activeReport.insightGroups.map((group) => (
              <section key={group.title} className="lead-side-group">
                <div className="lead-section-head">
                  <div>
                    <span className="lead-summary-label">{group.title}</span>
                  </div>
                </div>

                <div className="lead-side-list">
                  {group.items.map((item) => (
                    <div key={item.label} className="lead-side-item">
                      <div className="lead-side-copy">
                        <strong>{item.label}</strong>
                        <span>{item.note}</span>
                      </div>
                      <span className="lead-side-value">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </aside>
        </section>
      </div>
    </main>
  )
}
