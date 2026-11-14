import { describe, expect, test } from 'vitest'
import { absoluteUrl, estimate, expiryNote, monthsBetween, scopeLabel, versionLabel, type ShareLink } from './share-model'

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  id: 'l1', version: 'FULL', scope: { kind: 'range', from: '2026-12-01', to: '2026-12-31' }, blocks: { keys: false, notes: true, people: true },
  status: 'ACTIVE', activeUntil: '2027-01-26', reactivated: false, canReactivate: false, createdAt: '2026-11-04T12:00:00.000Z', path: '/m/abc', ...over,
})

describe('labels', () => {
  test('versions use the product names', () => {
    expect([versionLabel.PRAISE, versionLabel.PREACHING, versionLabel.FULL]).toEqual(['Alabanza', 'Predicación', 'Servicio completo'])
  })

  test('a whole month is named by the month; any other range by its two dates; one service by its date', () => {
    expect(scopeLabel({ kind: 'range', from: '2026-12-01', to: '2026-12-31' })).toBe('Diciembre 2026')
    expect(scopeLabel({ kind: 'range', from: '2026-11-20', to: '2026-12-31' })).toBe('vie 20 nov a jue 31 dic')
    expect(scopeLabel({ kind: 'range', from: '2026-02-01', to: '2026-02-28' })).toBe('Febrero 2026')
    expect(scopeLabel({ kind: 'service', serviceId: 's1', date: '2026-11-20' })).toBe('vie 20 nov')
  })

  test('the note of a link says until when it works, or why it does not', () => {
    expect(expiryNote(link())).toBe('Activo hasta 26 ene 2027')
    expect(expiryNote(link({ status: 'EXPIRED', activeUntil: '2026-11-30' }))).toBe('Venció el 1 dic 2026')
    expect(expiryNote(link({ status: 'REVOKED' }))).toBe('Revocado a mano')
  })
})

describe('new link estimate', () => {
  const services = [
    { id: 'a', date: '2026-12-04', status: 'PUBLISHED' }, { id: 'b', date: '2026-12-27', status: 'DRAFT' },
    { id: 'c', date: '2026-12-30', status: 'CANCELLED' }, { id: 'd', date: '2027-01-08', status: 'PUBLISHED' },
  ]

  test('counts the services of the range, never the cancelled ones, and gives the validity from the last', () => {
    expect(estimate(services, { kind: 'range', from: '2026-12-01', to: '2026-12-31' })).toEqual({ count: 2, activeUntil: '2027-01-26' })
  })

  test('a single service is its own scope', () => {
    expect(estimate(services, { kind: 'service', serviceId: 'a' })).toEqual({ count: 1, activeUntil: '2027-01-03' })
    expect(estimate(services, { kind: 'service', serviceId: 'c' })).toBeNull()
  })

  test('a range without services has no estimate', () => {
    expect(estimate(services, { kind: 'range', from: '2026-11-01', to: '2026-11-30' })).toBeNull()
    expect(estimate(services, { kind: 'range', from: '2026-12-31', to: '2026-12-01' })).toBeNull()
  })
})

describe('helpers', () => {
  test('months between two dates are listed in order and capped', () => {
    expect(monthsBetween('2026-11-20', '2027-01-05')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(monthsBetween('2026-12-31', '2026-12-01')).toEqual([])
    expect(monthsBetween('', '2026-12-01')).toEqual([])
    expect(monthsBetween('2026-01-01', '2030-01-01')).toHaveLength(13)
  })

  test('the address is built with the origin of the page, never from the API', () => {
    expect(absoluteUrl('https://app.example', '/m/abc')).toBe('https://app.example/m/abc')
  })
})
