import { describe, expect, test } from 'vitest'
import { assignDirectors, assignmentFor, changeDirector, defaultDayConfig, entryKey, sundayHoursOk, swapDirectors, type PeriodEntry } from './batch'

const dates = (...days: string[]): PeriodEntry[] => days.map((date) => ({ date: `2026-11-${date}`, slot: 'SINGLE', lock: null }))

describe('assignDirectors', () => {
  test('repeats the list cyclically until every free date is covered', () => {
    expect(assignDirectors(5, ['a', 'b', 'c', 'd'], { repeat: true, previousLast: null })).toEqual(['a', 'b', 'c', 'd', 'a'])
    expect(assignDirectors(3, ['a'], { repeat: true, previousLast: null })).toEqual(['a', 'a', 'a'])
  })
  test('without repetition only the first dates get a director, in the order entered', () => {
    expect(assignDirectors(4, ['a', 'b', 'c'], { repeat: false, previousLast: null })).toEqual(['a', 'b', 'c', null])
  })
  test('a list longer than the dates leaves the extra people out', () => {
    expect(assignDirectors(2, ['a', 'b', 'c'], { repeat: true, previousLast: null })).toEqual(['a', 'b'])
  })
  test('continues after whoever closed the previous batch, wrapping around the list', () => {
    expect(assignDirectors(4, ['a', 'b', 'c'], { repeat: true, previousLast: 'b' })).toEqual(['c', 'a', 'b', 'c'])
    expect(assignDirectors(2, ['a', 'b', 'c'], { repeat: true, previousLast: 'c' })).toEqual(['a', 'b'])
  })
  test('continuity also starts the partial batch after the previous director', () => {
    expect(assignDirectors(4, ['a', 'b', 'c'], { repeat: false, previousLast: 'a' })).toEqual(['b', 'c', 'a', null])
  })
  test('starts at the first person when the previous director is no longer in the list', () => {
    expect(assignDirectors(2, ['a', 'b'], { repeat: true, previousLast: 'z' })).toEqual(['a', 'b'])
  })
  test('an empty list or no dates assigns nobody', () => {
    expect(assignDirectors(2, [], { repeat: true, previousLast: null })).toEqual([null, null])
    expect(assignDirectors(0, ['a'], { repeat: true, previousLast: null })).toEqual([])
  })
})

describe('assignmentFor', () => {
  test('walks only the free entries; locked dates are skipped and never receive a director', () => {
    const entries: PeriodEntry[] = [
      { date: '2026-11-06', slot: 'SINGLE', lock: { kind: 'service', title: 'Oración', director: 'Ana' } },
      ...dates('13', '20'),
      { date: '2026-11-27', slot: 'SINGLE', lock: { kind: 'closed', reason: 'Feriado' } },
      ...dates('28'),
    ]
    expect(assignmentFor(entries, ['a', 'b'], { repeat: true, previousLast: null })).toEqual({
      '2026-11-13/SINGLE': 'a', '2026-11-20/SINGLE': 'b', '2026-11-28/SINGLE': 'a',
    })
  })
  test('a double Sunday gives each slot its own turn, morning first', () => {
    const entries: PeriodEntry[] = [
      { date: '2026-11-15', slot: 'MORNING', lock: null }, { date: '2026-11-15', slot: 'AFTERNOON', lock: null }, ...dates('20'),
    ]
    expect(assignmentFor(entries, ['a', 'b', 'c'], { repeat: true, previousLast: null })).toEqual({
      '2026-11-15/MORNING': 'a', '2026-11-15/AFTERNOON': 'b', '2026-11-20/SINGLE': 'c',
    })
  })
  test('with a double Sunday where only one slot is free, the free slot takes the turn', () => {
    const entries: PeriodEntry[] = [
      { date: '2026-11-15', slot: 'MORNING', lock: { kind: 'service', title: 'x', director: 'y' } }, { date: '2026-11-15', slot: 'AFTERNOON', lock: null },
    ]
    expect(assignmentFor(entries, ['a'], { repeat: true, previousLast: null })).toEqual({ '2026-11-15/AFTERNOON': 'a' })
  })
})

describe('swapDirectors and changeDirector', () => {
  const assignment = { '2026-11-06/SINGLE': 'luis', '2026-11-13/SINGLE': 'pedro', '2026-11-20/SINGLE': 'juan' }
  test('swaps the directors of two dates and leaves the one in between untouched', () => {
    expect(swapDirectors(assignment, '2026-11-06/SINGLE', '2026-11-13/SINGLE')).toEqual({
      '2026-11-06/SINGLE': 'pedro', '2026-11-13/SINGLE': 'luis', '2026-11-20/SINGLE': 'juan',
    })
    expect(swapDirectors(assignment, '2026-11-06/SINGLE', '2026-11-20/SINGLE')).toEqual({
      '2026-11-06/SINGLE': 'juan', '2026-11-13/SINGLE': 'pedro', '2026-11-20/SINGLE': 'luis',
    })
  })
  test('does not mutate the original assignment', () => {
    swapDirectors(assignment, '2026-11-06/SINGLE', '2026-11-13/SINGLE')
    expect(assignment['2026-11-06/SINGLE']).toBe('luis')
  })
  test('swapping with a date without director changes nothing', () => {
    expect(swapDirectors(assignment, '2026-11-06/SINGLE', '2026-11-27/SINGLE')).toEqual(assignment)
  })
  test('changes only one date', () => {
    expect(changeDirector(assignment, '2026-11-13/SINGLE', 'ana')).toEqual({ ...assignment, '2026-11-13/SINGLE': 'ana' })
  })
})

describe('defaultDayConfig', () => {
  const days = [
    { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    { weekday: 0, slot: 'MORNING', time: '09:00', title: 'Culto de la mañana' },
    { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Culto de la tarde' },
  ] as const
  test('preloads the habitual name and hour; an unusual day starts empty', () => {
    expect(defaultDayConfig({ days: [...days], sundayDouble: true }, 5)).toEqual({ title: 'Servicio de viernes', time: '19:30', time2: '' })
    expect(defaultDayConfig({ days: [...days], sundayDouble: true }, 2)).toEqual({ title: '', time: '', time2: '' })
  })
  test('a double Sunday loads both hours', () => {
    expect(defaultDayConfig({ days: [...days], sundayDouble: true }, 0)).toEqual({ title: 'Culto de la mañana', time: '09:00', time2: '17:00' })
  })
})

test('entryKey names a date and its slot', () => {
  expect(entryKey({ date: '2026-11-15', slot: 'AFTERNOON' })).toBe('2026-11-15/AFTERNOON')
})

test('the Sunday hours must put the morning before 12:00 and the afternoon from 12:00', () => {
  expect(sundayHoursOk('09:00', '17:00')).toBe(true)
  expect(sundayHoursOk('11:59', '12:00')).toBe(true)
  expect(sundayHoursOk('12:00', '17:00')).toBe(false)
  expect(sundayHoursOk('09:00', '11:00')).toBe(false)
  expect(sundayHoursOk('', '17:00')).toBe(false)
})
