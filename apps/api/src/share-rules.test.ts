import { describe, expect, test } from 'vitest'
import { addDays, effectiveBlocks, linkStatus, newLinkBody, reactivation, reactivationEnd, validUntil } from './share-rules.js'

const range = { kind: 'range', from: '2026-12-01', to: '2026-12-31' } as const
const body = (over: Record<string, unknown> = {}) => ({ version: 'FULL', scope: range, ...over })

describe('vigencia', () => {
  test('a link lasts until 30 days after the last included service, counted on calendar dates', () => {
    expect(validUntil('2026-12-27')).toBe('2027-01-26')
    expect(validUntil('2026-11-30')).toBe('2026-12-30')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  test('it is active through the last day and expires the day after', () => {
    expect(linkStatus({ revoked: false, activeUntil: '2027-01-26' }, '2027-01-26')).toBe('ACTIVE')
    expect(linkStatus({ revoked: false, activeUntil: '2027-01-26' }, '2027-01-27')).toBe('EXPIRED')
  })

  test('a revoked link is revoked even while its date would still be valid or already passed', () => {
    expect(linkStatus({ revoked: true, activeUntil: '2027-01-26' }, '2026-12-01')).toBe('REVOKED')
    expect(linkStatus({ revoked: true, activeUntil: '2027-01-26' }, '2027-03-01')).toBe('REVOKED')
  })
})

describe('reactivación', () => {
  test('an active link cannot be reactivated', () => {
    expect(reactivation({ revoked: false, activeUntil: '2027-01-26', reactivated: false }, '2027-01-01')).toBe('active')
  })

  test('an expired or a revoked link can be reactivated once', () => {
    expect(reactivation({ revoked: false, activeUntil: '2027-01-26', reactivated: false }, '2027-02-01')).toBe('ok')
    expect(reactivation({ revoked: true, activeUntil: '2027-01-26', reactivated: false }, '2026-12-01')).toBe('ok')
  })

  test('a link already reactivated stays deactivated: the strictest reading of the open decision', () => {
    expect(reactivation({ revoked: false, activeUntil: '2027-03-01', reactivated: true }, '2027-04-01')).toBe('used')
    expect(reactivation({ revoked: true, activeUntil: '2027-03-01', reactivated: true }, '2027-02-01')).toBe('used')
  })

  test('a reactivation lasts 30 days from today', () => {
    expect(reactivationEnd('2027-02-01')).toBe('2027-03-03')
  })
})

describe('new link body', () => {
  test('accepts a range or a single service for each version', () => {
    expect(newLinkBody.safeParse(body()).success).toBe(true)
    expect(newLinkBody.safeParse(body({ version: 'PRAISE', scope: { kind: 'service', serviceId: 's1' } })).success).toBe(true)
    expect(newLinkBody.safeParse(body({ version: 'PREACHING' })).success).toBe(true)
  })

  test('rejects a church, unknown versions and any extra field', () => {
    for (const over of [{ churchId: 'church-b' }, { version: 'ALL' }, { version: 'CONGREGATION' }, { token: 'x' }, { scope: { ...range, churchId: 'b' } }]) {
      expect(newLinkBody.safeParse(body(over)).success).toBe(false)
    }
  })

  test('a range needs real dates in order and at most a year', () => {
    for (const scope of [
      { kind: 'range', from: '2026-12-31', to: '2026-12-01' },
      { kind: 'range', from: '2026-02-30', to: '2026-03-01' },
      { kind: 'range', from: '2026-01-01', to: '2027-01-02' },
      { kind: 'service', serviceId: '' },
      { kind: 'service' },
    ]) expect(newLinkBody.safeParse(body({ scope })).success).toBe(false)
    expect(newLinkBody.safeParse(body({ scope: { kind: 'range', from: '2026-01-01', to: '2027-01-01' } })).success).toBe(true)
  })
})

describe('blocks', () => {
  test('keys and notes are off by default and people is on', () => {
    expect(effectiveBlocks('FULL', undefined)).toEqual({ keys: false, notes: false, people: true })
  })

  test('each version accepts the blocks it can show', () => {
    expect(effectiveBlocks('PRAISE', { keys: true })).toEqual({ keys: true, notes: false, people: true })
    expect(effectiveBlocks('PREACHING', { notes: true, people: false })).toEqual({ keys: false, notes: true, people: false })
    expect(effectiveBlocks('FULL', { keys: true, notes: true, people: true })).toEqual({ keys: true, notes: true, people: true })
  })

  test('a block the version cannot show is rejected, never ignored', () => {
    expect(effectiveBlocks('PRAISE', { notes: true })).toBeNull()
    expect(effectiveBlocks('PREACHING', { keys: true })).toBeNull()
    expect(effectiveBlocks('PRAISE', { notes: false })).toEqual({ keys: false, notes: false, people: true })
  })
})
