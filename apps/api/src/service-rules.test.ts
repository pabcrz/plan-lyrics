import { describe, expect, test } from 'vitest'
import { newServiceBody, planEdit, planSlot, servicePatch, todayInZone, weekdayOf } from './service-rules.js'

const base = { title: 'Servicio', date: '2026-11-15', status: 'DRAFT', directorId: 'p1' }

describe('newServiceBody', () => {
  test('accepts the minimal valid body', () => {
    expect(newServiceBody.safeParse(base).success).toBe(true)
    expect(newServiceBody.safeParse({ ...base, time: '19:30', slot: 'MORNING' }).success).toBe(true)
  })
  test('a service needs a director, a preacher or both', () => {
    const none = { ...base, directorId: undefined }
    expect(newServiceBody.safeParse({ ...none, preacher: { personId: 'p2' } }).success).toBe(true)
    expect(newServiceBody.safeParse({ ...none, preacher: { personId: 'p2', topic: 'La gracia' } }).success).toBe(true)
    expect(newServiceBody.safeParse({ ...base, preacher: { personId: 'p2' } }).success).toBe(true)
    expect(newServiceBody.safeParse(none).success).toBe(false)
  })
  test.each([
    ['neither director nor preacher', { ...base, directorId: undefined }],
    ['empty director', { ...base, directorId: ' ' }],
    ['client church', { ...base, churchId: 'church-b' }],
    ['preacher without person', { ...base, preacher: {} }],
    ['preacher with an extra field', { ...base, preacher: { personId: 'p2', churchId: 'church-b' } }],
    ['empty title', { ...base, title: '  ' }],
    ['impossible date', { ...base, date: '2026-02-30' }],
    ['bad date shape', { ...base, date: '15/11/2026' }],
    ['bad time', { ...base, time: '7pm' }],
    ['completed on creation', { ...base, status: 'COMPLETED' }],
    ['SINGLE slot from client', { ...base, slot: 'SINGLE' }],
  ])('rejects %s', (_name, body) => {
    expect(newServiceBody.safeParse(body).success).toBe(false)
  })
})

describe('planSlot', () => {
  test('weekday uses Sunday = 0', () => {
    expect(weekdayOf('2026-11-15')).toBe(0)
    expect(weekdayOf('2026-11-13')).toBe(5)
  })
  test('ordinary dates and single-Sunday churches use SINGLE', () => {
    expect(planSlot({ date: '2026-11-13', sundayDouble: true })).toEqual({ slot: 'SINGLE' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: false })).toEqual({ slot: 'SINGLE' })
  })
  test('a slot outside an enabled double Sunday is rejected', () => {
    expect(planSlot({ date: '2026-11-13', sundayDouble: true, slot: 'MORNING' })).toEqual({ error: 'Invalid request' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: false, slot: 'AFTERNOON' })).toEqual({ error: 'Invalid request' })
  })
  test('double Sunday requires a slot and keeps the hour inside it', () => {
    expect(planSlot({ date: '2026-11-15', sundayDouble: true })).toEqual({ error: 'Invalid request' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: true, slot: 'MORNING', time: '09:00' })).toEqual({ slot: 'MORNING' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: true, slot: 'MORNING', time: '12:00' })).toEqual({ error: 'Invalid request' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: true, slot: 'AFTERNOON', time: '11:45' })).toEqual({ error: 'Invalid request' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: true, slot: 'AFTERNOON', time: '18:00' })).toEqual({ slot: 'AFTERNOON' })
    expect(planSlot({ date: '2026-11-15', sundayDouble: true, slot: 'AFTERNOON' })).toEqual({ slot: 'AFTERNOON' })
  })
})

test('today is the Mexico City day: the boundary is local midnight, not UTC midnight', () => {
  expect(todayInZone(new Date('2026-11-14T05:59:59Z'))).toBe('2026-11-13') // 23:59:59 local
  expect(todayInZone(new Date('2026-11-14T06:00:00Z'))).toBe('2026-11-14') // 00:00:00 local
  expect(todayInZone(new Date('2026-11-13T00:30:00Z'))).toBe('2026-11-12') // UTC already the 13th
})

describe('servicePatch and planEdit', () => {
  const current = { date: '2026-11-22', slot: 'SINGLE' as const, time: '10:00' }
  test('accepts any subset, clears the hour with null, and refuses an empty or foreign body', () => {
    expect(servicePatch.parse({ title: ' Nuevo ' }).title).toBe('Nuevo')
    expect(servicePatch.parse({ time: null }).time).toBeNull()
    expect(servicePatch.safeParse({}).success).toBe(false)
    expect(servicePatch.safeParse({ churchId: 'x' }).success).toBe(false)
    expect(servicePatch.safeParse({ status: 'ARCHIVED' }).success).toBe(false)
  })
  test('keeps what was not touched', () => {
    expect(planEdit(current, { time: null }, false)).toEqual({ date: '2026-11-22', slot: 'SINGLE', time: null })
    expect(planEdit(current, { date: '2026-11-27' }, false)).toEqual({ date: '2026-11-27', slot: 'SINGLE', time: '10:00' })
  })
  test('a slot only exists on an enabled double Sunday', () => {
    expect(planEdit(current, { slot: 'MORNING' }, false)).toEqual({ error: 'Invalid request' })
    expect(planEdit({ ...current, slot: 'MORNING', time: '09:00' }, { date: '2026-11-27' }, true)).toEqual({ date: '2026-11-27', slot: 'SINGLE', time: '09:00' })
    expect(planEdit({ ...current, slot: 'MORNING', time: '09:00' }, { slot: 'AFTERNOON' }, true)).toEqual({ error: 'Invalid request' })
    expect(planEdit({ ...current, slot: 'MORNING', time: '09:00' }, { slot: 'AFTERNOON', time: '17:00' }, true)).toEqual({ date: '2026-11-22', slot: 'AFTERNOON', time: '17:00' })
    expect(planEdit(current, {}, true)).toEqual({ error: 'Invalid request' })
  })
})
