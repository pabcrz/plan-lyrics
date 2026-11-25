import { expect, test } from 'vitest'
import { serviceTitle } from './service-title'

test('the title is the day and the first name of whoever directs', () => {
  expect(serviceTitle({ date: '2026-11-27', who: 'Jairo León' })).toBe('Viernes 27 - Jairo')
  expect(serviceTitle({ date: '2026-11-29', who: '  Ana María  Ramírez ' })).toBe('Domingo 29 - Ana')
})

test('a Sunday with two services says which, and without a person it is just the date', () => {
  expect(serviceTitle({ date: '2026-11-29', slot: 'MORNING', who: 'Jairo León' })).toBe('Domingo 29 mañana - Jairo')
  expect(serviceTitle({ date: '2026-11-29', slot: 'AFTERNOON' })).toBe('Domingo 29 tarde')
  expect(serviceTitle({ date: '2026-12-04', slot: 'SINGLE', who: null })).toBe('Viernes 4')
})
