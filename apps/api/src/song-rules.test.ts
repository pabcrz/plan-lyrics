import { expect, test } from 'vitest'
import { repeatConflict } from './song-rules.js'

// Friday 6 Nov, Sunday 8, Friday 13, Sunday 15, Friday 20 (all of 2026), one service each.
const services = ['2026-11-06', '2026-11-08', '2026-11-13', '2026-11-15', '2026-11-20'].map((date, index) => ({ id: `s${index}`, date }))
const sungFriday = [{ serviceId: 's0', date: '2026-11-06' }]
const target = (index: number) => services[index]!

test('by services: sung on Friday, Sunday and the next Friday are blocked and the Sunday after is free', () => {
  const rule = { unit: 'SERVICES', amount: 2 } as const
  expect(repeatConflict(rule, target(1), services, sungFriday)).toBe('2026-11-06')
  expect(repeatConflict(rule, target(2), services, sungFriday)).toBe('2026-11-06')
  expect(repeatConflict(rule, target(3), services, sungFriday)).toBeNull()
  expect(repeatConflict({ unit: 'SERVICES', amount: 1 }, target(2), services, sungFriday)).toBeNull()
})

test('by services it also protects what is already planned after the service, and never counts the service itself', () => {
  const rule = { unit: 'SERVICES', amount: 1 } as const
  expect(repeatConflict(rule, target(0), services, [{ serviceId: 's1', date: '2026-11-08' }])).toBe('2026-11-08')
  expect(repeatConflict(rule, target(1), services, [{ serviceId: 's1', date: '2026-11-08' }])).toBeNull()
})

test('by weeks the calendar date decides, not the hour: two weeks after Sunday 1 Nov the song is free on Sunday 15', () => {
  const rule = { unit: 'WEEKS', amount: 2 } as const
  const sungSunday = [{ serviceId: 'x', date: '2026-11-01' }]
  expect(repeatConflict(rule, { id: 'a', date: '2026-11-14' }, [], sungSunday)).toBe('2026-11-01')
  expect(repeatConflict(rule, { id: 'b', date: '2026-11-15' }, [], sungSunday)).toBeNull()
  expect(repeatConflict(rule, { id: 'c', date: '2026-10-25' }, [], sungSunday)).toBe('2026-11-01')
})
