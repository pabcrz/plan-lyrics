import { describe, expect, test } from 'vitest'
import { newServiceBody, planSlot, weekdayOf } from './service-rules.js'

const base = { title: 'Servicio', date: '2026-11-15', status: 'DRAFT', directorId: 'p1' }

describe('newServiceBody', () => {
  test('accepts the minimal valid body', () => {
    expect(newServiceBody.safeParse(base).success).toBe(true)
    expect(newServiceBody.safeParse({ ...base, time: '19:30', slot: 'MORNING' }).success).toBe(true)
  })
  test.each([
    ['director missing', { ...base, directorId: undefined }],
    ['empty director', { ...base, directorId: ' ' }],
    ['client church', { ...base, churchId: 'church-b' }],
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
