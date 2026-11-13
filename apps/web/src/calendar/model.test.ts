import { describe, expect, test } from 'vitest'
import { freeSlots, habitualFor, upcomingDates, type Church, type Service } from './model'

const church: Church = {
  id: 'c', name: 'Betel', sundayDouble: true, usesPreaching: false, canEdit: true, canConfigure: true, timeZone: 'America/Mexico_City',
  days: [
    { weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Viernes' },
    { weekday: 0, slot: 'MORNING', time: '09:00', title: 'Mañana' },
    { weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Tarde' },
  ],
}
const service = (date: string, slot: Service['slot']): Service => ({
  id: `${date}-${slot}`, title: 'x', date, slot, time: null, status: 'DRAFT', director: { id: 'p', name: 'Ana' },
})

describe('freeSlots', () => {
  test('an ordinary date is free until it has one service', () => {
    expect(freeSlots(church, '2026-11-13', [])).toEqual(['SINGLE'])
    expect(freeSlots(church, '2026-11-13', [service('2026-11-13', 'SINGLE')])).toEqual([])
  })
  test('a double Sunday offers only the slot that is still free, then none', () => {
    expect(freeSlots(church, '2026-11-15', [])).toEqual(['MORNING', 'AFTERNOON'])
    expect(freeSlots(church, '2026-11-15', [service('2026-11-15', 'MORNING')])).toEqual(['AFTERNOON'])
    expect(freeSlots(church, '2026-11-15', [service('2026-11-15', 'MORNING'), service('2026-11-15', 'AFTERNOON')])).toEqual([])
  })
  test('a Sunday is single when the church does not enable the double; other dates are ignored', () => {
    const single = { ...church, sundayDouble: false }
    expect(freeSlots(single, '2026-11-15', [])).toEqual(['SINGLE'])
    expect(freeSlots(single, '2026-11-15', [service('2026-11-15', 'SINGLE')])).toEqual([])
    expect(freeSlots(church, '2026-11-13', [service('2026-11-15', 'MORNING')])).toEqual(['SINGLE'])
  })
})

test('habitual time and title exist only for configured days and slots', () => {
  expect(habitualFor(church, '2026-11-13', 'SINGLE')).toMatchObject({ time: '19:30', title: 'Viernes' })
  expect(habitualFor(church, '2026-11-15', 'AFTERNOON')).toMatchObject({ time: '17:00' })
  expect(habitualFor(church, '2026-11-17', 'SINGLE')).toBeUndefined()
})

test('upcoming dates follow the configured weekdays and start tomorrow', () => {
  expect(upcomingDates(church, '2026-11-13', 3)).toEqual(['2026-11-15', '2026-11-20', '2026-11-22'])
  expect(upcomingDates({ days: [] }, '2026-11-13', 3)).toEqual([])
})
