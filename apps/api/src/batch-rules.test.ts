import { describe, expect, test } from 'vitest'
import { batchBody, batchEntries, checkBatch, lastDirectorOf, parseWeekdays, type Occupant } from './batch-rules.js'

const free = (entries: ReturnType<typeof batchEntries>) => entries.filter(entry => !entry.lock)
const base = { month: '2026-11', today: '2026-11-12', sundayDouble: false, services: [] as Occupant[], closed: [] as { date: string; reason: string | null }[] }

describe('parseWeekdays', () => {
  test('accepts one to three distinct weekdays', () => {
    expect(parseWeekdays('5')).toEqual([5])
    expect(parseWeekdays('5,0')).toEqual([0, 5])
    expect(parseWeekdays('4,0,2')).toEqual([0, 2, 4])
  })
  test.each(['', '7', '1,1', '0,1,2,3', 'a', '1,,2'])('rejects %j', text => {
    expect(parseWeekdays(text)).toBeNull()
  })
})

describe('batchEntries', () => {
  test('the current month counts from today inclusive, never earlier dates', () => {
    // Thursday 12 Nov 2026; Thursdays are 5, 12, 19, 26.
    expect(batchEntries({ ...base, weekdays: [4] }).map(entry => entry.date)).toEqual(['2026-11-12', '2026-11-19', '2026-11-26'])
    expect(batchEntries({ ...base, today: '2026-11-13', weekdays: [4] }).map(entry => entry.date)).toEqual(['2026-11-19', '2026-11-26'])
  })
  test('a future month lists every date of the chosen weekdays in one chronological sequence', () => {
    const entries = batchEntries({ ...base, month: '2026-12', weekdays: [4, 0] })
    expect(entries.map(entry => entry.date)).toEqual([
      '2026-12-03', '2026-12-06', '2026-12-10', '2026-12-13', '2026-12-17', '2026-12-20', '2026-12-24', '2026-12-27', '2026-12-31',
    ])
    expect(new Set(entries.map(entry => entry.slot))).toEqual(new Set(['SINGLE']))
  })
  test('a month before the current one has no dates', () => {
    expect(batchEntries({ ...base, month: '2026-10', weekdays: [5] })).toEqual([])
  })
  test('a closed date and a full date are locked with their reason or existing service, and keep their place', () => {
    const entries = batchEntries({
      ...base, month: '2026-12', weekdays: [5],
      closed: [{ date: '2026-12-25', reason: 'Navidad' }],
      services: [{ date: '2026-12-04', slot: 'SINGLE', title: 'Oración', director: 'Ana' }],
    })
    expect(entries.map(entry => [entry.date, entry.lock])).toEqual([
      ['2026-12-04', { kind: 'service', title: 'Oración', director: 'Ana' }],
      ['2026-12-11', null], ['2026-12-18', null],
      ['2026-12-25', { kind: 'closed', reason: 'Navidad' }],
    ])
    expect(free(entries).map(entry => entry.date)).toEqual(['2026-12-11', '2026-12-18'])
  })
  test('a church without double Sunday has one SINGLE entry per Sunday', () => {
    expect(batchEntries({ ...base, weekdays: [0] }).map(entry => [entry.date, entry.slot])).toEqual([
      ['2026-11-15', 'SINGLE'], ['2026-11-22', 'SINGLE'], ['2026-11-29', 'SINGLE'],
    ])
  })
  test('a double Sunday has a morning and an afternoon entry; only the taken one is locked', () => {
    const entries = batchEntries({
      ...base, sundayDouble: true, weekdays: [0, 5],
      services: [{ date: '2026-11-15', slot: 'MORNING', title: 'Dominical', director: 'Luis' }],
    })
    expect(entries.map(entry => [entry.date, entry.slot, entry.lock ? entry.lock.kind : null])).toEqual([
      ['2026-11-13', 'SINGLE', null],
      ['2026-11-15', 'MORNING', 'service'], ['2026-11-15', 'AFTERNOON', null],
      ['2026-11-20', 'SINGLE', null],
      ['2026-11-22', 'MORNING', null], ['2026-11-22', 'AFTERNOON', null],
      ['2026-11-27', 'SINGLE', null],
      ['2026-11-29', 'MORNING', null], ['2026-11-29', 'AFTERNOON', null],
    ])
  })
  test('a double Sunday with both services locks both entries; a closed Sunday locks both too', () => {
    const entries = batchEntries({
      ...base, sundayDouble: true, weekdays: [0],
      services: [
        { date: '2026-11-15', slot: 'MORNING', title: 'A', director: 'x' }, { date: '2026-11-15', slot: 'AFTERNOON', title: 'B', director: 'y' },
      ],
      closed: [{ date: '2026-11-22', reason: null }],
    })
    expect(entries.filter(entry => entry.date === '2026-11-15').map(entry => entry.lock?.kind)).toEqual(['service', 'service'])
    expect(entries.filter(entry => entry.date === '2026-11-22').map(entry => entry.lock)).toEqual([{ kind: 'closed', reason: null }, { kind: 'closed', reason: null }])
    expect(free(entries).map(entry => entry.date)).toEqual(['2026-11-29', '2026-11-29'])
  })
})

const entry = (over: Record<string, unknown> = {}) => ({ date: '2026-11-13', title: 'Viernes', time: '19:30', directorId: 'p1', ...over })
const body = (over: Record<string, unknown> = {}) => ({ month: '2026-11', directorIds: ['p1'], entries: [entry()], ...over })

describe('batchBody', () => {
  test('accepts a minimal batch and refuses the church, extra fields and empty director lists', () => {
    expect(batchBody.safeParse(body()).success).toBe(true)
    expect(batchBody.safeParse(body({ churchId: 'other' })).success).toBe(false)
    expect(batchBody.safeParse(body({ directorIds: [] })).success).toBe(false)
    expect(batchBody.safeParse(body({ directorIds: ['p1', 'p1'] })).success).toBe(false)
    expect(batchBody.safeParse(body({ entries: [] })).success).toBe(false)
    expect(batchBody.safeParse(body({ entries: [entry({ directorId: undefined })] })).success).toBe(false)
    expect(batchBody.safeParse(body({ entries: [entry({ time: '7pm' })] })).success).toBe(false)
    expect(batchBody.safeParse(body({ entries: [entry({ slot: 'SINGLE' })] })).success).toBe(false)
  })
})

describe('checkBatch', () => {
  const ctx = { today: '2026-11-12', sundayDouble: false }
  const check = (over: Record<string, unknown> = {}, context = ctx) => checkBatch(batchBody.parse(body(over)), context)
  test('resolves each slot and returns the entries in chronological order', () => {
    const result = check({ entries: [entry({ date: '2026-11-20' }), entry({ date: '2026-11-13' })] })
    expect('entries' in result && result.entries.map(item => [item.date, item.slot])).toEqual([['2026-11-13', 'SINGLE'], ['2026-11-20', 'SINGLE']])
  })
  test('today is valid all day; a past date or a past month is refused', () => {
    expect('entries' in check({ entries: [entry({ date: '2026-11-12' })] })).toBe(true)
    expect(check({ entries: [entry({ date: '2026-11-11' })] })).toEqual({ error: 'Date in the past' })
    expect(check({ month: '2026-10', entries: [entry({ date: '2026-10-30' })] })).toEqual({ error: 'Date in the past' })
  })
  test('refuses dates outside the month, repeated slots and more than three weekdays', () => {
    expect(check({ entries: [entry({ date: '2026-12-04' })] })).toEqual({ error: 'Invalid request' })
    expect(check({ entries: [entry(), entry()] })).toEqual({ error: 'Invalid request' })
    const four = ['2026-11-13', '2026-11-14', '2026-11-16', '2026-11-17'].map(date => entry({ date }))
    expect(check({ entries: four })).toEqual({ error: 'Invalid request' })
  })
  test('a date may carry a preacher, who can be its director too; without one the entry has no key', () => {
    const result = check({ entries: [entry({ preacherId: 'p1' }), entry({ date: '2026-11-20' })] })
    expect('entries' in result && result.entries.map(item => item.preacherId)).toEqual(['p1', undefined])
    expect('entries' in result && 'preacherId' in result.entries[1]!).toBe(false)
    expect(batchBody.safeParse(body({ entries: [entry({ preacherId: '' })] })).success).toBe(false)
  })
  test('a double Sunday needs a slot consistent with its hour; other days take none', () => {
    const double = { today: '2026-11-12', sundayDouble: true }
    const sunday = { date: '2026-11-15' }
    expect(check({ entries: [entry(sunday)] }, double)).toEqual({ error: 'Invalid request' })
    expect(check({ entries: [entry({ ...sunday, slot: 'MORNING', time: '17:00' })] }, double)).toEqual({ error: 'Invalid request' })
    expect('entries' in check({ entries: [entry({ ...sunday, slot: 'MORNING', time: '09:00' }), entry({ ...sunday, slot: 'AFTERNOON', time: '17:00' })] }, double)).toBe(true)
    expect(check({ entries: [entry({ ...sunday, slot: 'MORNING' })] })).toEqual({ error: 'Invalid request' })
    expect(check({ entries: [entry({ slot: 'MORNING' })] }, double)).toEqual({ error: 'Invalid request' })
  })
})

describe('lastDirectorOf', () => {
  test('is the director of the last entry of the sequence, afternoon after morning', () => {
    const result = checkBatch(batchBody.parse(body({
      entries: [
        entry({ date: '2026-11-15', slot: 'AFTERNOON', time: '17:00', directorId: 'p3' }),
        entry({ date: '2026-11-15', slot: 'MORNING', time: '09:00', directorId: 'p2' }),
        entry({ date: '2026-11-13', directorId: 'p1' }),
      ],
    })), { today: '2026-11-12', sundayDouble: true })
    expect('entries' in result && lastDirectorOf(result.entries)).toBe('p3')
  })
})
