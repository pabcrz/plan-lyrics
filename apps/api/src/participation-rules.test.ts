import { expect, test } from 'vitest'
import { generateAssignments, keepCursor, participationBody, participationIssue, personFits, previewTurns, SHARED_WEEKDAY, takeTurn, type RolePlan } from './participation-rules.js'
import { DIRECTOR_KEY } from './role-rules.js'

const everyone = new Set(['luis', 'pedro', 'juan', 'ana', 'sofia', 'dir'])
const plan = (over: Partial<RolePlan> = {}): RolePlan => ({
  roleId: 'voices', roleName: 'Voces', habitualIds: [], rotationOn: true, mode: 'SHARED', startsOn: '2026-11-01',
  sequences: [{ weekday: SHARED_WEEKDAY, memberIds: ['luis', 'pedro', 'juan'], nextPersonId: 'luis' }], ...over,
})
// Friday 6, Sunday 8, Friday 13, Sunday 15 November 2026.
const dates = ['2026-11-06', '2026-11-08', '2026-11-13', '2026-11-15']

test('the shared rotation ignores the weekday: Luis, Pedro, Juan, Luis across Friday and Sunday', () => {
  const shared = plan()
  expect(dates.map(date => takeTurn(shared, date, everyone))).toEqual(['luis', 'pedro', 'juan', 'luis'])
})

test('by weekday, each day has its own sequence and a Sunday does not advance Friday', () => {
  const byDay = plan({ mode: 'BY_DAY', sequences: [
    { weekday: 5, memberIds: ['luis', 'pedro'], nextPersonId: 'luis' },
    { weekday: 0, memberIds: ['juan', 'ana'], nextPersonId: 'juan' },
  ] })
  expect(dates.map(date => takeTurn(byDay, date, everyone))).toEqual(['luis', 'juan', 'pedro', 'ana'])
})

test('a weekday without people, a rotation that is off or one that has not started gives nobody a turn', () => {
  const byDay = plan({ mode: 'BY_DAY', sequences: [{ weekday: 5, memberIds: ['luis'], nextPersonId: 'luis' }] })
  expect(takeTurn(byDay, '2026-11-08', everyone)).toBeNull()
  expect(takeTurn(plan({ rotationOn: false }), '2026-11-06', everyone)).toBeNull()
  const later = plan({ startsOn: '2026-11-10' })
  expect([takeTurn(later, '2026-11-06', everyone), takeTurn(later, '2026-11-13', everyone)]).toEqual([null, 'luis'])
})

test('the cursor continues across calls and wraps around: the sequence is not restarted by another batch', () => {
  const shared = plan()
  expect(['2026-11-06', '2026-11-08'].map(date => takeTurn(shared, date, everyone))).toEqual(['luis', 'pedro'])
  expect(['2026-12-04', '2026-12-06', '2026-12-11'].map(date => takeTurn(shared, date, everyone))).toEqual(['juan', 'luis', 'pedro'])
})

test('people removed from the directory are skipped and never take a turn', () => {
  const shared = plan()
  const active = new Set(['luis', 'juan'])
  expect(dates.map(date => takeTurn(shared, date, active))).toEqual(['luis', 'juan', 'luis', 'juan'])
})

test('a preview does not move the saved cursor', () => {
  const shared = plan()
  expect(previewTurns(shared, dates, everyone).map(turn => turn.personId)).toEqual(['luis', 'pedro', 'juan', 'luis'])
  expect(shared.sequences[0].nextPersonId).toBe('luis')
})

test('habitual people (several voices) and the rotation turn are all assigned to the service', () => {
  const [one] = generateAssignments([{ date: '2026-11-06', directorId: 'dir' }], [plan({ habitualIds: ['ana', 'sofia'] })], [], everyone)
  expect(one.map(item => [item.personId, item.source])).toEqual([['ana', 'HABITUAL'], ['sofia', 'HABITUAL'], ['luis', 'ROTATION']])
})

test('a person who is habitual in one role and rotating in another is assigned to both when the church allows it', () => {
  const guitar = plan({ roleId: 'guitar', roleName: 'Guitarra', habitualIds: ['ana'], rotationOn: false })
  const voices = plan({ sequences: [{ weekday: SHARED_WEEKDAY, memberIds: ['ana'], nextPersonId: 'ana' }] })
  const [one] = generateAssignments([{ date: '2026-11-06', directorId: 'dir' }], [guitar, voices], [], everyone)
  expect(one.map(item => [item.roleId, item.personId])).toEqual([['guitar', 'ana'], ['voices', 'ana']])
})

test('two proposals for one person in a forbidden combination are both left pending, with no priority between roles', () => {
  const piano = plan({ roleId: 'piano', roleName: 'Piano', habitualIds: ['ana'], rotationOn: false })
  const guitar = plan({ roleId: 'guitar', roleName: 'Guitarra', habitualIds: ['ana', 'luis'], rotationOn: false })
  const [one] = generateAssignments([{ date: '2026-11-06', directorId: 'dir' }], [guitar, piano], [{ first: 'guitar', second: 'piano' }], everyone)
  expect(one).toEqual([
    { roleId: 'guitar', roleName: 'Guitarra', source: 'HABITUAL', personId: null, pending: 'COMBINATION', proposedPersonId: 'ana' },
    { roleId: 'guitar', roleName: 'Guitarra', source: 'HABITUAL', personId: 'luis', pending: null, proposedPersonId: null },
    { roleId: 'piano', roleName: 'Piano', source: 'HABITUAL', personId: null, pending: 'COMBINATION', proposedPersonId: 'ana' },
  ])
})

test('the service director keeps directing: a proposal that forms a forbidden combination with it stays pending', () => {
  const drums = plan({ roleId: 'drums', roleName: 'Batería', habitualIds: ['dir', 'pedro'], rotationOn: false })
  const [one] = generateAssignments([{ date: '2026-11-06', directorId: 'dir' }], [drums], [{ first: DIRECTOR_KEY, second: 'drums' }], everyone)
  expect(one.map(item => [item.personId, item.pending, item.proposedPersonId])).toEqual([[null, 'COMBINATION', 'dir'], ['pedro', null, null]])
  const [other] = generateAssignments([{ date: '2026-11-06', directorId: 'luis' }], [drums], [{ first: DIRECTOR_KEY, second: 'drums' }], everyone)
  expect(other.map(item => item.personId)).toEqual(['dir', 'pedro'])
})

test('a forbidden turn is still consumed so the sequence goes on to the next person', () => {
  const drums = plan({ roleId: 'drums', roleName: 'Batería', habitualIds: [], sequences: [{ weekday: SHARED_WEEKDAY, memberIds: ['dir', 'pedro'], nextPersonId: 'dir' }] })
  const restrictions = [{ first: DIRECTOR_KEY, second: 'drums' }]
  const out = generateAssignments([{ date: '2026-11-06', directorId: 'dir' }, { date: '2026-11-08', directorId: 'dir' }], [drums], restrictions, everyone)
  expect(out.map(([item]) => [item.personId, item.pending])).toEqual([[null, 'COMBINATION'], ['pedro', null]])
})

test('services are generated in the order given, each taking the next turn', () => {
  const out = generateAssignments(dates.map(date => ({ date, directorId: 'dir' })), [plan()], [], everyone)
  expect(out.map(([item]) => item.personId)).toEqual(['luis', 'pedro', 'juan', 'luis'])
})

test('a cursor is kept while its person stays in the list and restarts at the first person otherwise', () => {
  expect(keepCursor('pedro', ['luis', 'pedro', 'juan'], false)).toBe('pedro')
  expect(keepCursor('ana', ['luis', 'pedro'], false)).toBe('luis')
  expect(keepCursor('pedro', ['luis', 'pedro'], true)).toBe('luis')
  expect(keepCursor('pedro', [], false)).toBeNull()
})

test('personFits applies the church restrictions to the roles the person already has, the director included', () => {
  const restrictions = [{ first: DIRECTOR_KEY, second: 'drums' }, { first: 'guitar', second: 'piano' }]
  expect(personFits(restrictions, ['piano'], 'guitar', false)).toBe(false)
  expect(personFits(restrictions, ['piano'], 'voices', false)).toBe(true)
  expect(personFits(restrictions, [], 'drums', true)).toBe(false)
  expect(personFits(restrictions, [], 'drums', false)).toBe(true)
})

test('the participation body takes people and a rotation, never a church', () => {
  const rotation = { enabled: true, mode: 'BY_DAY', startsOn: '2026-11-06', sequences: [{ weekday: 5, personIds: ['luis'] }, { weekday: null, personIds: [] }] }
  const ok = { habitualIds: ['ana'], rotation }
  expect(participationBody.safeParse(ok).success).toBe(true)
  expect(participationBody.safeParse({ ...ok, churchId: 'x' }).success).toBe(false)
  expect(participationBody.safeParse({ ...ok, rotation: { ...rotation, startsOn: null } }).success).toBe(false)
  expect(participationBody.safeParse({ ...ok, rotation: { ...rotation, enabled: false, startsOn: null } }).success).toBe(true)
  expect(participationBody.safeParse({ ...ok, rotation: { ...rotation, sequences: [{ weekday: 7, personIds: [] }] } }).success).toBe(false)
})

test('nobody is both habitual and rotating in the same role, and nothing repeats', () => {
  const body = (habitualIds: string[], sequences: { weekday: number | null; personIds: string[] }[]) =>
    participationBody.parse({ habitualIds, rotation: { enabled: true, mode: 'BY_DAY', startsOn: '2026-11-06', sequences } })
  expect(participationIssue(body(['ana'], [{ weekday: 5, personIds: ['luis', 'pedro'] }, { weekday: 0, personIds: ['luis'] }]))).toBeNull()
  expect(participationIssue(body(['ana'], [{ weekday: 5, personIds: ['ana'] }]))).toBe('overlap')
  expect(participationIssue(body([], [{ weekday: 5, personIds: ['luis', 'luis'] }]))).toBe('sequences')
  expect(participationIssue(body([], [{ weekday: 5, personIds: [] }, { weekday: 5, personIds: [] }]))).toBe('sequences')
  expect(participationIssue(body(['ana', 'ana'], []))).toBe('habitualIds')
})
