import { describe, expect, it } from 'vitest'

import { formatShortDate } from '@/lib/formatters'

describe('formatShortDate', () => {
  it('formats Bitrix calendar dates in the report timezone', () => {
    expect(formatShortDate('2026-02-02T00:00:00.000+03:00')).toBe('02 февр.')
  })
})
