import type { RevenueVelocityFormulaTooltip } from '@/lib/dashboard-types'

export const revenueVelocityTooltips: Record<string, RevenueVelocityFormulaTooltip> = {
  averageCheck: {
    key: 'averageCheck',
    label: 'Средний чек',
    formula: 'Сумма выигранных сделок / Количество выигранных сделок',
    description: 'Показывает средний размер успешной сделки в выбранной когорте.',
    emptyState: 'Если выигранных сделок нет, средний чек не считается.',
  },
  winRate: {
    key: 'winRate',
    label: 'Конверсия',
    formula: 'Выигранные сделки / Созданные возможности',
    description: 'Показывает, какая доля сделок из выбранной когорты дошла до успешного результата.',
  },
  averageCycleDays: {
    key: 'averageCycleDays',
    label: 'Средний цикл',
    formula: 'Среднее dateClosed - dateCreate по выигранным сделкам',
    description: 'Показывает средний путь успешной сделки от создания до закрытия.',
    emptyState: 'Если выигранных сделок нет или нет даты закрытия, цикл не считается.',
  },
  revenueVelocityPerDay: {
    key: 'revenueVelocityPerDay',
    label: 'Revenue Velocity',
    formula: 'Средний чек × Количество возможностей × Конверсия / Средний цикл сделки',
    description: 'Показывает денежную скорость: сколько денег в день эта группа генерирует через свою воронку.',
    emptyState: 'Если нет выигранных сделок или средний цикл равен 0, денежная скорость не считается.',
  },
  moneyPerMeeting: {
    key: 'moneyPerMeeting',
    label: '₽ / встречу',
    formula: 'Сумма выигранных сделок / Количество встреч',
    description: 'Показывает, сколько денег приходится на одну встречу по сделкам выбранной когорты.',
    emptyState: 'Если встреч нет, метрика не считается.',
  },
  moneyPerConnectedCallOverThirtySeconds: {
    key: 'moneyPerConnectedCallOverThirtySeconds',
    label: '₽ / звонок >30 сек',
    formula: 'Сумма выигранных сделок / Количество звонков >30 секунд',
    description: 'Показывает, сколько денег приходится на один содержательный звонок.',
    emptyState: 'Если успешных звонков больше 30 секунд нет, метрика не считается.',
  },
  moneyPerConversionEvent: {
    key: 'moneyPerConversionEvent',
    label: '₽ / конв. мероприятие',
    formula: 'Сумма выигранных сделок / Количество конверсионных мероприятий',
    description: 'Показывает, сколько денег приходится на одно мероприятие на этапах Активация и Демонстрация.',
    emptyState: 'Если мероприятий нет или они ещё не подключены, метрика не считается.',
  },
  weightedActionPoints: {
    key: 'weightedActionPoints',
    label: 'Взвешенные баллы',
    formula: 'Звонки >30 сек × 1 + Встречи × 3 + Конв. мероприятия × 5 + Закрытые задачи × 0.5',
    description: 'Переводит разные действия в условные баллы, потому что встреча или мероприятие глубже двигают сделку.',
  },
  moneyPerWeightedActionPoint: {
    key: 'moneyPerWeightedActionPoint',
    label: '₽ / балл действий',
    formula: 'Сумма выигранных сделок / Взвешенные баллы действий',
    description: 'Показывает, сколько денег приносит один условный балл полезных действий.',
    emptyState: 'Если действий нет, метрика не считается.',
  },
  weightedActionPointsPerWin: {
    key: 'weightedActionPointsPerWin',
    label: 'Балл действий / выигрыш',
    formula: 'Взвешенные баллы действий / Выигранные сделки',
    description: 'Показывает, сколько условных баллов действий в среднем требуется для одной выигранной сделки.',
  },
  actionEfficiencyIndex: {
    key: 'actionEfficiencyIndex',
    label: 'Индекс эффективности действий',
    formula: '₽ / балл действий строки / Средний ₽ / балл действий по команде × 100',
    description: '100 — средний уровень команды. Выше 100 — действия монетизируются лучше среднего.',
  },
}
