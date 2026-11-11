import { afterAll, beforeAll, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
const api = createApp(fixture.config, db)
beforeAll(() => seedFixtures(db))
afterAll(() => db.$disconnect())

function request(body: unknown, subject = 'fixture-owner', id?: string, target = api, claims = {}) {
  return target.request(id === undefined ? '/api/users' : `/api/users/${encodeURIComponent(id)}/account-manager`, {
    method: id === undefined ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json', ...(subject ? { Authorization: `Bearer ${fixture.token(subject, claims)}` } : {}) },
    body: JSON.stringify(body),
  })
}
async function result(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual(body)
}
// The database is the observable persistence interface; include timestamps and all access rows.
async function snapshot() {
  return { users: await db.user.findMany({ orderBy: { id: 'asc' } }), memberships: await db.membership.findMany(), owners: await db.platformOwner.findMany() }
}
async function rejected(body: unknown, subject: string, status: number, error: string, id?: string, claims = {}) {
  const before = await snapshot()
  await result(await request(body, subject, id, api, claims), status, { error })
  expect(await snapshot()).toEqual(before)
}

test.each(['owner', 'accounts'])('%s creates only a bare user, with a trimmed subject', async role => {
  const subject = `new-${role}`
  const before = await snapshot()
  const response = await request({ clerkSubject: `  ${subject}  ` }, `fixture-${role}`)
  expect(response.status).toBe(201)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const body = await response.json()
  expect(body).toEqual({ id: expect.any(String) })
  const user = await db.user.findUniqueOrThrow({ where: { id: body.id }, include: { memberships: true, ownership: true } })
  expect(user).toMatchObject({ clerkSubject: subject, libraryEditor: false, accountManager: false, memberships: [], ownership: null })
  const after = await snapshot()
  expect(after.users).toHaveLength(before.users.length + 1)
  expect(after.memberships).toEqual(before.memberships)
  expect(after.owners).toEqual(before.owners)
  for (const church of ['church-a', 'church-b']) {
    await result(await api.request(`/api/churches/${church}`, { headers: { Authorization: `Bearer ${fixture.token(subject)}` } }), 404, { error: 'Not found' })
  }
})

test.each(['member', 'admin', 'editor', 'library', 'unknown'])('%s cannot provision or delegate', async role => {
  await rejected({ clerkSubject: `denied-${role}` }, `fixture-${role}`, 404, 'Not found')
  await rejected({ enabled: true }, `fixture-${role}`, 404, 'Not found', 'member')
})

test('account managers cannot delegate or read churches', async () => {
  await rejected({ enabled: true }, 'fixture-accounts', 404, 'Not found', 'member')
  for (const church of ['church-a', 'church-b']) {
    await result(await api.request(`/api/churches/${church}`, { headers: { Authorization: `Bearer ${fixture.token('fixture-accounts')}` } }), 404, { error: 'Not found' })
  }
})

test.each([undefined, 'member'])('missing and expired credentials reject writes (%s)', async id => {
  const body = id ? { enabled: true } : { clerkSubject: 'unauthenticated' }
  await rejected(body, '', 401, 'Unauthorized', id)
  await rejected(body, 'fixture-owner', 401, 'Unauthorized', id, { exp: 1 })
})

test.each([
  {}, { clerkSubject: '' }, { clerkSubject: '   ' }, { clerkSubject: 'a'.repeat(129) },
  { clerkSubject: 'bad.subject' }, { clerkSubject: "bad' OR TRUE --" },
  { clerkSubject: 'valid', accountManager: true }, { clerkSubject: 42 }, null,
])('invalid create body is side-effect free: %j', async body => {
  await rejected(body, 'fixture-owner', 400, 'Invalid request')
})

test.each([{}, { enabled: 'true' }, { enabled: true, extra: true }, null])('invalid delegation body is side-effect free: %j', async body => {
  await rejected(body, 'fixture-owner', 400, 'Invalid request', 'member')
})

test.each(['/api/users', '/api/users/member/account-manager'])('non-JSON body is rejected: %s', async path => {
  const before = await snapshot()
  await result(await api.request(path, {
    method: path === '/api/users' ? 'POST' : 'PUT',
    headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}`, 'Content-Type': 'text/plain' }, body: 'not json',
  }), 400, { error: 'Invalid request' })
  expect(await snapshot()).toEqual(before)
})

test('accepts charset and length boundaries', async () => {
  for (const clerkSubject of ['Z', `${'a'.repeat(125)}_9-`]) {
    const response = await request({ clerkSubject })
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.json()
    expect(body).toEqual({ id: expect.any(String) })
    expect(await db.user.findUnique({ where: { id: body.id } })).toMatchObject({ clerkSubject, libraryEditor: false, accountManager: false })
  }
})

test('duplicates and a concurrent duplicate race return conflict without extra writes', async () => {
  await rejected({ clerkSubject: 'fixture-member' }, 'fixture-owner', 409, 'Conflict')
  const before = await snapshot()
  const responses = await Promise.all([request({ clerkSubject: 'racing-user' }), request({ clerkSubject: 'racing-user' })])
  expect(responses.map(r => r.status).sort()).toEqual([201, 409])
  for (const response of responses) {
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(response.status === 201 ? { id: expect.any(String) } : { error: 'Conflict' })
  }
  const after = await snapshot()
  expect(after.users).toHaveLength(before.users.length + 1)
  expect(after.memberships).toEqual(before.memberships)
  expect(after.owners).toEqual(before.owners)
})

test('only the owner grants and revokes, with immediate effect for an issued token', async () => {
  const response = await request({ clerkSubject: 'delegated-user' })
  expect(response.status).toBe(201)
  const { id } = await response.json()
  const token = fixture.token('delegated-user')
  const create = (clerkSubject: string) => api.request('/api/users', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ clerkSubject }),
  })
  const owners = await db.platformOwner.findMany()
  await result(await request({ enabled: true }, 'fixture-owner', id), 200, { id, accountManager: true })
  const created = await create('delegated-creation')
  expect(created.status).toBe(201)
  expect(await created.json()).toEqual({ id: expect.any(String) })
  await result(await request({ enabled: false }, 'fixture-owner', id), 200, { id, accountManager: false })
  const before = await snapshot()
  await result(await create('revoked-creation'), 404, { error: 'Not found' })
  expect(await snapshot()).toEqual(before)
  expect(await db.platformOwner.findMany()).toEqual(owners)
  expect(await db.user.findUnique({ where: { id } })).toMatchObject({ accountManager: false, libraryEditor: false })
})

test('owner record and unknown targets cannot be changed', async () => {
  for (const id of ['owner', 'missing', "member' OR TRUE --"]) {
    for (const enabled of [true, false]) await rejected({ enabled }, 'fixture-owner', 404, 'Not found', id)
  }
})

test.each([undefined, 'member'])('missing or failing database fails closed (%s)', async id => {
  const body = id ? { enabled: true } : { clerkSubject: 'no-database' }
  const before = await snapshot()
  await result(await request(body, 'fixture-owner', id, createApp(fixture.config)), 503, { error: 'Access unavailable' })
  const unavailable = connectDatabase(`${url}_missing`)
  try {
    await result(await request(body, 'fixture-owner', id, createApp(fixture.config, unavailable)), 503, { error: 'Access unavailable' })
  } finally { await unavailable.$disconnect() }
  expect(await snapshot()).toEqual(before)
})
