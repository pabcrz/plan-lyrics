import { describe, expect, test } from 'vitest'
import { formatDay, monthCells, monthTitle, shiftMonth, todayIn, weekdayOf } from './dates'

describe('dates', () => {
  test('today is the Mexico City calendar day, not the UTC one', () => {
    // 2026-11-14 03:30 UTC is still the 13th at 21:30 in Mexico City (UTC-6).
    expect(todayIn(new Date('2026-11-14T03:30:00Z'))).toBe('2026-11-13')
    expect(todayIn(new Date('2026-11-14T06:30:00Z'))).toBe('2026-11-14')
  })
  test('weeks run Sunday to Saturday and months are padded to whole weeks', () => {
    const cells = monthCells('2026-11') // 1 Nov 2026 is a Sunday
    expect(cells).toHaveLength(35)
    expect(cells[0]).toBe('2026-11-01')
    expect(cells[29]).toBe('2026-11-30')
    expect(cells.slice(30)).toEqual([null, null, null, null, null])
    const october = monthCells('2026-10') // 1 Oct 2026 is a Thursday
    expect(october.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01'])
    expect(october.length % 7).toBe(0)
  })
  test('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
  test('formats in Spanish', () => {
    expect(monthTitle('2026-11')).toBe('Noviembre 2026')
    expect(formatDay('2026-11-13')).toBe('vie 13 nov')
    expect(weekdayOf('2026-11-15')).toBe(0)
  })
})
