import { expect, test } from 'vitest'
import { allWindowEnd, churchWindowEnd } from './home-window'

test('all: this week from today and the whole next one, Sunday to Saturday', () => {
  // Miércoles 25 nov 2026: la semana va del dom 22 al sáb 28; la siguiente, del dom 29 al sáb 5 dic.
  expect(allWindowEnd('2026-11-25')).toBe('2026-12-05')
  // Un domingo abre la semana; un sábado la cierra.
  expect(allWindowEnd('2026-11-29')).toBe('2026-12-12')
  expect(allWindowEnd('2026-11-28')).toBe('2026-12-05')
})

test('one church: the rest of the month until its last week', () => {
  expect(churchWindowEnd('2026-11-25')).toBe('2026-11-30')
  expect(churchWindowEnd('2026-11-01')).toBe('2026-11-30')
})

test('one church: from the last week of the month it also shows the next week, then the new month is complete', () => {
  // El 30 de nov es lunes: su semana va del dom 29 nov al sáb 5 dic, y se suma la siguiente (hasta el sáb 12 dic).
  expect(churchWindowEnd('2026-11-29')).toBe('2026-12-12')
  expect(churchWindowEnd('2026-11-30')).toBe('2026-12-12')
  // Ya en diciembre: el mes completo hasta el 31 (la última semana de diciembre aún no empieza).
  expect(churchWindowEnd('2026-12-01')).toBe('2026-12-31')
  // Un mes que termina en sábado: su última semana es la que empieza el domingo 25 de abril (30 de abril 2026 es jueves, 31 de oct es sábado).
  expect(churchWindowEnd('2026-10-25')).toBe('2026-11-07')
  expect(churchWindowEnd('2026-10-24')).toBe('2026-10-31')
})
