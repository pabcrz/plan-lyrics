import { expect, test } from 'vitest'
import { serviceTitle } from './service-title'

test('the title is only the day: nobody\'s name goes in it, so it never goes stale', () => {
  expect(serviceTitle({ date: '2026-11-27' })).toBe('Viernes 27')
  expect(serviceTitle({ date: '2026-12-04', slot: 'SINGLE' })).toBe('Viernes 4')
})

test('a Sunday with two services says which', () => {
  expect(serviceTitle({ date: '2026-11-29', slot: 'MORNING' })).toBe('Domingo 29 mañana')
  expect(serviceTitle({ date: '2026-11-29', slot: 'AFTERNOON' })).toBe('Domingo 29 tarde')
})
