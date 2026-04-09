export function formatInteger(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatAmount(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value)
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: value < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatShortDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

export function formatLongDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime()

  if (Number.isNaN(timestamp)) {
    return 'unknown'
  }

  const deltaHours = Math.round((timestamp - Date.now()) / 3_600_000)

  if (Math.abs(deltaHours) < 24) {
    const formatter = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' })
    return formatter.format(deltaHours, 'hour')
  }

  const deltaDays = Math.round(deltaHours / 24)
  return new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(
    deltaDays,
    'day',
  )
}

export function formatSyncMode(mode: 'full' | 'delta') {
  return mode === 'full' ? 'Full backfill' : 'Delta refresh'
}
