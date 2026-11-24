import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { connectDatabase } from '../src/database.ts'
import type { IdentityProvider } from '../src/identity-provider.js'
import { seedFixtures } from './fixtures.ts'
import { sessionFixture } from './session-fixture.mjs'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const fixture = sessionFixture()
const inviteByEmail = vi.fn<IdentityProvider['inviteByEmail']>(async email => ({ subject: `fixture-invited-${email.split('@')[0]}` }))
const api = createApp(fixture.config, db, undefined, { identity: { inviteByEmail } })

// Everything this file creates carries the `acc-` / `Prueba acceso` marker and is removed afterwards.
const names = { 'acc-a1': 'Prueba acceso A1', 'acc-a2': 'Prueba acceso A2', 'acc-b': 'Prueba acceso B', 'acc-free': 'Prueba acceso Libre', 'acc-none': 'Prueba acceso Sin cuenta' }
const accounts = ['acc-a1', 'acc-a2', 'acc-b', 'acc-free']

async function reset() {
  await db.membership.deleteMany({ where: { OR: [{ userId: { startsWith: 'acc-' } }, { userId: 'owner' }, { user: { clerkSubject: { startsWith: 'fixture-invited-' } } }] } })
  await db.person.deleteMany({ where: { name: { startsWith: 'Prueba acceso' } } })
  await db.user.deleteMany({ where: { OR: [{ id: { startsWith: 'acc-' } }, { clerkSubject: { startsWith: 'fixture-invited-' } }] } })
  await db.user.updateMany({ where: { id: { in: ['member', 'admin', 'editor', 'library', 'accounts', 'owner', 'b-editor', 'multi'] } }, data: { libraryEditor: false } })
  await db.user.update({ where: { id: 'library' }, data: { libraryEditor: true } })
  await db.user.updateMany({ where: { id: { in: ['accounts'] } }, data: { accountManager: true } })
  await db.person.updateMany({ where: { id: { in: ['person-a', 'person-b', 'person-no-account'] } }, data: { userId: null } })
  // Restore the shared fixture memberships that these tests move around.
  await db.membership.deleteMany({ where: { userId: { in: ['multi', 'b-editor'] } } })
  for (const [userId, churchId, role] of [['admin', 'church-a', 'ADMIN'], ['member', 'church-a', 'MEMBER'], ['editor', 'church-a', 'EDITOR'], ['combined', 'church-a', 'MEMBER'],
    ['multi', 'church-a', 'MEMBER'], ['multi', 'church-b', 'MEMBER'], ['b-editor', 'church-b', 'EDITOR']] as const) {
    await db.membership.upsert({ where: { userId_churchId: { userId, churchId } }, update: { role }, create: { userId, churchId, role } })
  }
  inviteByEmail.mockClear()
  inviteByEmail.mockImplementation(async email => ({ subject: `fixture-invited-${email.split('@')[0]}` }))
}
async function seed() {
  await reset()
  for (const id of accounts) await db.user.create({ data: { id, clerkSubject: `fixture-${id}`, email: `${id}@example.com` } })
  // acc-a1 (administrator) and acc-a2 (member) belong to church A; acc-b only to church B; acc-free to none.
  await db.membership.createMany({ data: [
    { userId: 'acc-a1', churchId: 'church-a', role: 'ADMIN' }, { userId: 'acc-a2', churchId: 'church-a', role: 'MEMBER' }, { userId: 'acc-b', churchId: 'church-b', role: 'MEMBER' },
  ] })
  const link = (id: string, churches: string[], userId?: string) => db.person.create({ data: { id: `person-${id}`, name: names[id as keyof typeof names], userId, churches: { create: churches.map(churchId => ({ churchId })) } } })
  await link('acc-a1', ['church-a'], 'acc-a1')
  await link('acc-a2', ['church-a'], 'acc-a2')
  await link('acc-b', ['church-b'], 'acc-b')
  await link('acc-free', ['church-a', 'church-b'], 'acc-free')
  await link('acc-none', ['church-a'])
}
beforeAll(() => seedFixtures(db))
beforeEach(seed)
afterAll(async () => { await reset(); await db.$disconnect() })

function call(subject: string | undefined, method: string, path: string, body?: unknown, church?: string) {
  return api.request(path, {
    method,
    headers: { ...(church ? { 'X-Church-Id': church } : {}), ...(subject ? { Authorization: `Bearer ${fixture.token(`fixture-${subject}`)}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const state = async () => ({
  users: await db.user.findMany({ orderBy: { id: 'asc' } }),
  memberships: await db.membership.findMany({ orderBy: [{ userId: 'asc' }, { churchId: 'asc' }] }),
  people: await db.person.findMany({ orderBy: { id: 'asc' } }),
})
async function unchanged(run: () => Promise<Response>, status: number, body?: unknown) {
  const before = await state()
  const response = await run()
  expect(response.status).toBe(status)
  if (body !== undefined) expect(await response.json()).toEqual(body)
  expect(await state()).toEqual(before)
}

// ---------------------------------------------------------------- account creation and invitation

test.each(['owner', 'accounts'])('%s invites by e-mail: a bare account with no church, role or capability', async role => {
  const response = await call(role, 'POST', '/api/accounts', { email: '  Nueva@Example.com ' })
  expect(response.status).toBe(201)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ id: expect.any(String), email: 'nueva@example.com', accountManager: false, libraryEditor: false, owner: false, person: null })
  expect(inviteByEmail).toHaveBeenCalledExactlyOnceWith('nueva@example.com')
  const user = await db.user.findUniqueOrThrow({ where: { clerkSubject: 'fixture-invited-nueva' }, include: { memberships: true, ownership: true, person: true } })
  expect(user).toMatchObject({ email: 'nueva@example.com', libraryEditor: false, accountManager: false, memberships: [], ownership: null, person: null })
})

test.each(['admin', 'editor', 'member', 'library', 'combined', 'nobody'])('%s cannot create accounts or invite', async role => {
  await unchanged(() => call(role, 'POST', '/api/accounts', { email: 'otra@example.com' }), 404, { error: 'Not found' })
  expect(inviteByEmail).not.toHaveBeenCalled()
})

test('a revoked account manager loses the capability for an already issued session', async () => {
  expect((await call('accounts', 'GET', '/api/accounts')).status).toBe(200)
  await db.user.update({ where: { id: 'accounts' }, data: { accountManager: false } })
  await unchanged(() => call('accounts', 'POST', '/api/accounts', { email: 'tarde@example.com' }), 404)
  expect((await call('accounts', 'GET', '/api/accounts')).status).toBe(404)
  expect(inviteByEmail).not.toHaveBeenCalled()
})

test('unauthenticated requests are rejected before anything happens', async () => {
  await unchanged(() => call(undefined, 'POST', '/api/accounts', { email: 'x@example.com' }), 401)
  expect(inviteByEmail).not.toHaveBeenCalled()
})

test.each([{}, { email: 'no-es-correo' }, { email: 'a@example.com', churchId: 'church-b' }, { email: 'a@example.com', accountManager: true }, null])('invalid invitation %j never reaches the provider', async body => {
  await unchanged(() => call('owner', 'POST', '/api/accounts', body), 400, { error: 'Invalid request' })
  expect(inviteByEmail).not.toHaveBeenCalled()
})

test('a provider failure creates nothing and leaks no detail; a missing provider answers 503', async () => {
  inviteByEmail.mockRejectedValueOnce(new Error('sk_live_secret boom'))
  await unchanged(() => call('owner', 'POST', '/api/accounts', { email: 'falla@example.com' }), 502, { error: 'Identity provider unavailable' })
  inviteByEmail.mockResolvedValueOnce({ subject: 'bad subject!' })
  await unchanged(() => call('owner', 'POST', '/api/accounts', { email: 'raro@example.com' }), 502, { error: 'Identity provider unavailable' })
  const without = createApp(fixture.config, db)
  const response = await without.request('/api/accounts', { method: 'POST', headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sin@example.com' }) })
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'Identity provider unavailable' })
})

test('inviting an e-mail that already has an account is refused before the provider is called', async () => {
  await call('owner', 'POST', '/api/accounts', { email: 'repetida@example.com' })
  const again = await call('accounts', 'POST', '/api/accounts', { email: 'REPETIDA@example.com' })
  expect(again.status).toBe(409)
  expect(await again.json()).toEqual({ error: 'Email registered' })
  expect(inviteByEmail).toHaveBeenCalledTimes(1)
  expect(await db.user.count({ where: { clerkSubject: 'fixture-invited-repetida' } })).toBe(1)
})

test('a concurrent registration of the same e-mail conflicts without a second account', async () => {
  // The other registration lands while the provider is called: the first e-mail check passed, the insert then clashes on the e-mail.
  inviteByEmail.mockImplementationOnce(async () => {
    await db.user.create({ data: { clerkSubject: 'fixture-invited-concurrente', email: 'carrera@example.com' } })
    return { subject: 'fixture-invited-carrera' }
  })
  const response = await call('owner', 'POST', '/api/accounts', { email: 'carrera@example.com' })
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({ error: 'Conflict' })
  expect(await db.user.count({ where: { email: 'carrera@example.com' } })).toBe(1)
})

test('signing in grants nothing: an invited account sees no church and no management', async () => {
  await call('owner', 'POST', '/api/accounts', { email: 'recien@example.com' })
  for (const path of ['/api/active-church', '/api/members', '/api/accounts', '/api/churches/church-a', '/api/churches/church-b']) {
    expect((await call('invited-recien', 'GET', path)).status, path).toBe(404)
  }
  expect((await call('invited-recien', 'GET', '/api/access')).status).toBe(200)
})

// ---------------------------------------------------------------- listing and capabilities

test('the capability endpoint reports only the caller\'s own flags', async () => {
  expect(await (await call('owner', 'GET', '/api/access')).json()).toEqual({ owner: true, accountManager: false })
  expect(await (await call('accounts', 'GET', '/api/access')).json()).toEqual({ owner: false, accountManager: true })
  expect(await (await call('admin', 'GET', '/api/access')).json()).toEqual({ owner: false, accountManager: false })
  expect(await (await call('nobody', 'GET', '/api/access')).json()).toEqual({ owner: false, accountManager: false })
})

test('an account manager sees accounts and unlinked people by name only, and still no church', async () => {
  const body = await (await call('accounts', 'GET', '/api/accounts')).json()
  expect(body.viewer).toEqual({ owner: false })
  expect(body.accounts).toContainEqual({ id: 'acc-a1', email: 'acc-a1@example.com', accountManager: false, libraryEditor: false, owner: false, person: { id: 'person-acc-a1', name: 'Prueba acceso A1' } })
  expect(body.accounts.find((account: { id: string }) => account.id === 'owner')).toMatchObject({ owner: true })
  expect(body.people).toContainEqual({ id: 'person-acc-none', name: 'Prueba acceso Sin cuenta' })
  expect(body.people.map((person: { id: string }) => person.id)).not.toContain('person-acc-a1')
  expect(JSON.stringify(body)).not.toMatch(/clerkSubject|fixture-acc|church-a|phone/)
  for (const path of ['/api/churches/church-a', '/api/churches/church-b', '/api/active-church', '/api/members']) expect((await call('accounts', 'GET', path)).status, path).toBe(404)
})

test.each(['admin', 'editor', 'member', 'library', 'nobody'])('%s cannot list accounts', async role => {
  expect((await call(role, 'GET', '/api/accounts')).status).toBe(404)
})

// ---------------------------------------------------------------- linking people to accounts

test.each(['owner', 'accounts'])('%s links and unlinks a person without creating any membership', async role => {
  const before = (await state()).memberships
  const user = await db.user.create({ data: { id: 'acc-link', clerkSubject: 'fixture-acc-link' } })
  const linked = await call(role, 'PUT', `/api/accounts/${user.id}/person`, { personId: 'person-acc-none' })
  expect(linked.status).toBe(200)
  expect(await linked.json()).toMatchObject({ id: 'acc-link', person: { id: 'person-acc-none', name: 'Prueba acceso Sin cuenta' } })
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-acc-none' } })).userId).toBe('acc-link')
  expect((await state()).memberships).toEqual(before)
  const unlinked = await call(role, 'DELETE', `/api/accounts/${user.id}/person`)
  expect(unlinked.status).toBe(204)
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-acc-none' } })).userId).toBeNull()
  expect((await state()).memberships).toEqual(before)
  await db.user.delete({ where: { id: 'acc-link' } })
})

test.each(['admin', 'editor', 'member', 'library', 'nobody'])('%s cannot link or unlink accounts', async role => {
  await db.user.create({ data: { id: 'acc-link', clerkSubject: 'fixture-acc-link' } })
  await unchanged(() => call(role, 'PUT', '/api/accounts/acc-link/person', { personId: 'person-acc-none' }), 404, { error: 'Not found' })
  await unchanged(() => call(role, 'DELETE', '/api/accounts/acc-a1/person'), 404, { error: 'Not found' })
  await db.user.delete({ where: { id: 'acc-link' } })
})

test('linking refuses people or accounts that are already linked and unknown targets', async () => {
  await db.user.create({ data: { id: 'acc-link', clerkSubject: 'fixture-acc-link' } })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/acc-link/person', { personId: 'person-acc-a1' }), 409, { error: 'Person linked' })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/acc-a2/person', { personId: 'person-acc-none' }), 409, { error: 'Account linked' })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/acc-link/person', { personId: 'missing' }), 404, { error: 'Not found' })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/missing/person', { personId: 'person-acc-none' }), 404, { error: 'Not found' })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/acc-link/person', { personId: 'person-acc-none', churchId: 'church-a' }), 400, { error: 'Invalid request' })
  await unchanged(() => call('owner', 'DELETE', '/api/accounts/acc-link/person'), 404, { error: 'Not found' })
  await db.user.delete({ where: { id: 'acc-link' } })
})

test('a race to link the same person has exactly one winner', async () => {
  await db.user.createMany({ data: [{ id: 'acc-r1', clerkSubject: 'fixture-acc-r1' }, { id: 'acc-r2', clerkSubject: 'fixture-acc-r2' }] })
  const responses = await Promise.all(['acc-r1', 'acc-r2'].map(id => call('owner', 'PUT', `/api/accounts/${id}/person`, { personId: 'person-acc-none' })))
  expect(responses.map(response => response.status).sort()).toEqual([200, 409])
  await db.person.update({ where: { id: 'person-acc-none' }, data: { userId: null } })
  await db.user.deleteMany({ where: { id: { in: ['acc-r1', 'acc-r2'] } } })
})

test('an account manager cannot touch the platform owner account; the owner can', async () => {
  const person = await db.person.create({ data: { id: 'person-acc-owner', name: 'Prueba acceso Owner' } })
  await unchanged(() => call('accounts', 'PUT', '/api/accounts/owner/person', { personId: person.id }), 404, { error: 'Not found' })
  expect((await call('owner', 'PUT', '/api/accounts/owner/person', { personId: person.id })).status).toBe(200)
  await unchanged(() => call('accounts', 'DELETE', '/api/accounts/owner/person'), 404, { error: 'Not found' })
  expect((await call('owner', 'DELETE', '/api/accounts/owner/person')).status).toBe(204)
})

// ---------------------------------------------------------------- library editor (owner only, most restrictive reading)

test('only the platform owner grants and revokes library editing, and never on the owner record', async () => {
  const granted = await call('owner', 'PUT', '/api/accounts/acc-a2/library-editor', { enabled: true })
  expect(granted.status).toBe(200)
  expect(await granted.json()).toMatchObject({ id: 'acc-a2', libraryEditor: true })
  expect((await call('owner', 'PUT', '/api/accounts/acc-a2/library-editor', { enabled: false })).status).toBe(200)
  expect((await db.user.findUniqueOrThrow({ where: { id: 'acc-a2' } })).libraryEditor).toBe(false)
  for (const role of ['accounts', 'admin', 'editor', 'member', 'library', 'nobody']) {
    await unchanged(() => call(role, 'PUT', '/api/accounts/acc-a2/library-editor', { enabled: true }), 404, { error: 'Not found' })
  }
  await unchanged(() => call('owner', 'PUT', '/api/accounts/owner/library-editor', { enabled: true }), 404, { error: 'Not found' })
  await unchanged(() => call('owner', 'PUT', '/api/accounts/acc-a2/library-editor', { enabled: 'yes' }), 400, { error: 'Invalid request' })
})

test('library editing never grants church access, and church admin never grants library editing', async () => {
  await call('owner', 'PUT', '/api/accounts/acc-free/library-editor', { enabled: true })
  expect((await call('acc-free', 'GET', '/api/active-church')).status).toBe(404)
  expect((await call('acc-free', 'GET', '/api/members')).status).toBe(404)
  await unchanged(() => call('admin', 'PUT', '/api/accounts/acc-free/library-editor', { enabled: false }), 404)
})

// ---------------------------------------------------------------- church memberships (administrator of that church)

const memberOf = async (subject: string) => {
  const body = await (await call(subject, 'GET', '/api/members')).json()
  return body as { members: Array<{ userId: string; role: string; email: string | null; person: { id: string; name: string } | null; self: boolean; protected: boolean }>; candidates: Array<{ personId: string; name: string; email: string | null }> }
}

test('an administrator lists only the members of their own church, with candidates that have an account', async () => {
  const body = await memberOf('acc-a1')
  const ids = body.members.map(member => member.userId)
  expect(ids).toEqual(expect.arrayContaining(['acc-a1', 'acc-a2', 'admin', 'editor', 'member']))
  expect(ids).not.toContain('acc-b')
  expect(ids).not.toContain('b-editor')
  expect(body.members.find(member => member.userId === 'acc-a1')).toMatchObject({ role: 'ADMIN', self: true, protected: false, person: { id: 'person-acc-a1', name: 'Prueba acceso A1' } })
  // acc-free has an account and is in A's directory (shared with B) but has no membership here; acc-none has no account.
  // A church role never reads addresses: only the owner and account managers do.
  expect(body.candidates).toEqual([{ personId: 'person-acc-free', name: 'Prueba acceso Libre', email: null }])
  expect(body.members.every(member => member.email === null)).toBe(true)
  expect(JSON.stringify(body)).not.toMatch(/clerkSubject|fixture-|church-b/)
})

test('the church always comes from the session, never from the request', async () => {
  const query = await (await call('acc-a1', 'GET', '/api/members?churchId=church-b')).json()
  expect(query.members.map((member: { userId: string }) => member.userId)).not.toContain('acc-b')
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-free', role: 'MEMBER', churchId: 'church-b' }), 400, { error: 'Invalid request' })
  await unchanged(() => call('acc-a1', 'PATCH', '/api/members/acc-a2?churchId=church-b', { role: 'EDITOR', churchId: 'church-b' }), 400)
})

test.each(['member', 'editor', 'acc-a2', 'combined', 'library', 'accounts', 'nobody'])('%s cannot manage members of a church', async role => {
  const denied = role === 'library' || role === 'accounts' || role === 'nobody' ? 404 : 403
  await unchanged(() => call(role, 'GET', '/api/members'), denied)
  await unchanged(() => call(role, 'POST', '/api/members', { personId: 'person-acc-free', role: 'MEMBER' }), denied)
  await unchanged(() => call(role, 'PATCH', '/api/members/acc-a2', { role: 'ADMIN' }), denied)
  await unchanged(() => call(role, 'DELETE', '/api/members/acc-a2'), denied)
})

test('the administrator grants a role to a person with an account, who then gains exactly that access', async () => {
  const created = await call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-free', role: 'EDITOR' })
  expect(created.status).toBe(201)
  expect(await created.json()).toMatchObject({ userId: 'acc-free', role: 'EDITOR', person: { id: 'person-acc-free' } })
  expect(await db.membership.findMany({ where: { userId: 'acc-free' } })).toMatchObject([{ churchId: 'church-a', role: 'EDITOR' }])
  // The editor of services now edits the directory, but cannot manage members.
  expect((await call('acc-free', 'POST', '/api/people', { name: 'Prueba acceso Nueva' })).status).toBe(201)
  expect((await call('acc-free', 'GET', '/api/members')).status).toBe(403)
})

test('granting refuses people without an account, from other churches, members already, or accounts of another church', async () => {
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-none', role: 'MEMBER' }), 409, { error: 'No account' })
  // Person of church B only: not in A's directory, so it does not exist for this administrator.
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-b', role: 'MEMBER' }), 404, { error: 'Not found' })
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-a2', role: 'ADMIN' }), 409, { error: 'Member exists' })
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'missing', role: 'MEMBER' }), 404, { error: 'Not found' })
  // An account of another church can belong to this one too; it then picks the active church with X-Church-Id.
  await db.membership.create({ data: { userId: 'acc-free', churchId: 'church-b', role: 'MEMBER' } })
  expect((await call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-free', role: 'MEMBER' })).status).toBe(201)
  expect(await (await call('acc-free', 'GET', '/api/me/churches')).json()).toHaveLength(2)
  expect((await call('acc-free', 'GET', '/api/active-church')).status).toBe(409)
  const inA = await call('acc-free', 'GET', '/api/active-church', undefined, 'church-a')
  expect(inA.status).toBe(200)
  expect(await inA.json()).toMatchObject({ id: 'church-a' })
  expect(await (await call('acc-free', 'GET', '/api/active-church', undefined, 'church-b')).json()).toMatchObject({ id: 'church-b' })
  // A church the caller does not belong to does not exist for them, header or not.
  expect((await call('acc-a1', 'GET', '/api/active-church', undefined, 'church-b')).status).toBe(404)
  // A person removed from this church's directory is not offered either.
  await db.churchPerson.update({ where: { churchId_personId: { churchId: 'church-a', personId: 'person-acc-free' } }, data: { removedAt: new Date() } })
  await db.membership.deleteMany({ where: { userId: 'acc-free' } })
  await unchanged(() => call('acc-a1', 'POST', '/api/members', { personId: 'person-acc-free', role: 'MEMBER' }), 404)
})

test('changing a role takes effect at once for an already issued session, and removing revokes access', async () => {
  expect((await call('acc-a2', 'POST', '/api/people', { name: 'Prueba acceso Antes' })).status).toBe(403)
  const promoted = await call('acc-a1', 'PATCH', '/api/members/acc-a2', { role: 'EDITOR' })
  expect(promoted.status).toBe(200)
  expect(await promoted.json()).toMatchObject({ userId: 'acc-a2', role: 'EDITOR' })
  expect((await call('acc-a2', 'POST', '/api/people', { name: 'Prueba acceso Después' })).status).toBe(201)
  expect((await call('acc-a1', 'DELETE', '/api/members/acc-a2')).status).toBe(204)
  expect((await call('acc-a2', 'GET', '/api/active-church')).status).toBe(404)
  expect(await db.user.findUnique({ where: { id: 'acc-a2' } })).not.toBeNull()
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-acc-a2' } })).userId).toBe('acc-a2')
  await unchanged(() => call('acc-a1', 'DELETE', '/api/members/acc-a2'), 404, { error: 'Not found' })
})

test('an administrator never reaches another church through a shared person or user', async () => {
  // Same account in both churches: A's change touches only A's row.
  await db.membership.deleteMany({ where: { userId: 'multi' } })
  await db.membership.createMany({ data: [{ userId: 'multi', churchId: 'church-a', role: 'MEMBER' }, { userId: 'multi', churchId: 'church-b', role: 'MEMBER' }] })
  expect((await call('acc-a1', 'PATCH', '/api/members/multi', { role: 'EDITOR' })).status).toBe(200)
  expect(await db.membership.findMany({ where: { userId: 'multi' }, orderBy: { churchId: 'asc' } })).toMatchObject([{ churchId: 'church-a', role: 'EDITOR' }, { churchId: 'church-b', role: 'MEMBER' }])
  expect((await call('acc-a1', 'DELETE', '/api/members/multi')).status).toBe(204)
  expect((await db.membership.findMany({ where: { userId: 'multi' } })).map(row => row.churchId)).toEqual(['church-b'])
  // A member that exists only in B is invisible to A.
  await unchanged(() => call('acc-a1', 'PATCH', '/api/members/acc-b', { role: 'ADMIN' }), 404, { error: 'Not found' })
  await unchanged(() => call('acc-a1', 'PATCH', '/api/members/b-editor', { role: 'ADMIN' }), 404)
  await unchanged(() => call('acc-a1', 'DELETE', '/api/members/b-editor'), 404)
  // Neither managing members nor listing candidates changes shared person data.
  expect((await db.person.findUniqueOrThrow({ where: { id: 'person-acc-free' } })).userId).toBe('acc-free')
})

test('a church is never left without an administrator', async () => {
  await db.membership.update({ where: { userId_churchId: { userId: 'admin', churchId: 'church-a' } }, data: { role: 'MEMBER' } })
  await unchanged(() => call('acc-a1', 'PATCH', '/api/members/acc-a1', { role: 'MEMBER' }), 409, { error: 'Last administrator' })
  await unchanged(() => call('acc-a1', 'DELETE', '/api/members/acc-a1'), 409, { error: 'Last administrator' })
  // With a second administrator the same change is allowed.
  await db.membership.update({ where: { userId_churchId: { userId: 'admin', churchId: 'church-a' } }, data: { role: 'ADMIN' } })
  expect((await call('admin', 'PATCH', '/api/members/acc-a1', { role: 'EDITOR' })).status).toBe(200)
})

test('two administrators demoting each other at once cannot leave zero', async () => {
  await db.membership.update({ where: { userId_churchId: { userId: 'admin', churchId: 'church-a' } }, data: { role: 'MEMBER' } })
  await db.membership.update({ where: { userId_churchId: { userId: 'acc-a2', churchId: 'church-a' } }, data: { role: 'ADMIN' } })
  const responses = await Promise.all([call('acc-a1', 'PATCH', '/api/members/acc-a2', { role: 'MEMBER' }), call('acc-a2', 'PATCH', '/api/members/acc-a1', { role: 'MEMBER' })])
  expect(responses.map(response => response.status).sort()).toEqual([200, 409])
  expect(await db.membership.count({ where: { churchId: 'church-a', role: 'ADMIN' } })).toBe(1)
})

test('the platform owner membership is protected from church screens, and the owner manages their active church', async () => {
  await db.membership.create({ data: { userId: 'owner', churchId: 'church-a', role: 'MEMBER' } })
  const listed = await memberOf('acc-a1')
  expect(listed.members.find(member => member.userId === 'owner')).toMatchObject({ protected: true })
  await unchanged(() => call('acc-a1', 'PATCH', '/api/members/owner', { role: 'EDITOR' }), 409, { error: 'Protected account' })
  await unchanged(() => call('acc-a1', 'DELETE', '/api/members/owner'), 409, { error: 'Protected account' })
  // The owner has full access: they manage members of their active church even as a plain member there.
  expect((await call('owner', 'PATCH', '/api/members/acc-a2', { role: 'EDITOR' })).status).toBe(200)
  expect(await db.platformOwner.count()).toBe(1)
})

test('invalid member bodies are rejected without side effects', async () => {
  for (const body of [{}, { role: 'OWNER' }, { role: 'admin' }, { role: 'ADMIN', extra: 1 }, null]) {
    await unchanged(() => call('acc-a1', 'PATCH', '/api/members/acc-a2', body), 400, { error: 'Invalid request' })
  }
  for (const body of [{ personId: 'person-acc-free' }, { personId: 'person-acc-free', role: 'OWNER' }, { role: 'MEMBER' }]) {
    await unchanged(() => call('acc-a1', 'POST', '/api/members', body), 400, { error: 'Invalid request' })
  }
})

test('the owner founds several churches, sees them all and enters one they do not belong to in support mode', async () => {
  expect((await call('acc-a1', 'POST', '/api/churches', { name: 'Intrusa' })).status).toBe(404)
  const before = await db.membership.count({ where: { user: { clerkSubject: 'fixture-owner' } } })
  const apart = await call('owner', 'POST', '/api/churches', { name: 'Iglesia Sur', addMe: false })
  expect(apart.status).toBe(201)
  const south = (await apart.json()) as { id: string }
  expect(await db.membership.count({ where: { user: { clerkSubject: 'fixture-owner' } } })).toBe(before)
  const own = await call('owner', 'POST', '/api/churches', { name: 'Iglesia Este' })
  expect(own.status).toBe(201)
  expect(await db.membership.count({ where: { user: { clerkSubject: 'fixture-owner' } } })).toBe(before + 1)
  const listed = (await (await call('owner', 'GET', '/api/me/churches')).json()) as Array<{ id: string; name: string; role: string | null }>
  expect(listed.find(item => item.id === south.id)).toMatchObject({ name: 'Iglesia Sur', role: null })
  expect(listed.find(item => item.name === 'Iglesia Este')).toMatchObject({ role: 'ADMIN' })
  // Only the owner sees churches they do not belong to; support mode grants the administrator's powers there.
  expect((await (await call('acc-a1', 'GET', '/api/me/churches')).json() as unknown[]).length).toBe(1)
  const support = await call('owner', 'GET', '/api/active-church', undefined, south.id)
  expect(support.status).toBe(200)
  expect(await support.json()).toMatchObject({ id: south.id, support: true, canEdit: true, canConfigure: true })
  expect((await call('acc-a1', 'GET', '/api/active-church', undefined, south.id)).status).toBe(404)
  expect((await call('owner', 'GET', '/api/members', undefined, south.id)).status).toBe(200)
  await db.church.deleteMany({ where: { name: { in: ['Iglesia Sur', 'Iglesia Este'] } } })
})

test('the agenda lists the upcoming services of every church of the caller and nothing else', async () => {
  await db.membership.create({ data: { userId: 'acc-free', churchId: 'church-a', role: 'MEMBER' } })
  await db.membership.create({ data: { userId: 'acc-free', churchId: 'church-b', role: 'MEMBER' } })
  const future = new Date(Date.now() + 40 * 86_400_000)
  future.setUTCHours(0, 0, 0, 0)
  const past = new Date(Date.now() - 40 * 86_400_000)
  past.setUTCHours(0, 0, 0, 0)
  await db.service.createMany({ data: [
    { id: 'agenda-a', churchId: 'church-a', title: 'Servicio A', date: future, slot: 'SINGLE', status: 'PUBLISHED' },
    { id: 'agenda-b', churchId: 'church-b', title: 'Servicio B', date: future, slot: 'SINGLE', status: 'PUBLISHED' },
    { id: 'agenda-old', churchId: 'church-a', title: 'Ya pasó', date: past, slot: 'SINGLE', status: 'COMPLETED' },
  ] })
  try {
    const both = (await (await call('acc-free', 'GET', '/api/me/agenda')).json()) as Array<{ id: string; churchId: string; churchName: string }>
    expect(both.map(item => item.id).sort()).toEqual(['agenda-a', 'agenda-b'])
    expect(both.find(item => item.id === 'agenda-b')).toMatchObject({ churchId: 'church-b', churchName: expect.any(String) })
    // A caller of one church never sees the other church's services, and the owner without memberships gets an empty list.
    expect((await (await call('acc-a1', 'GET', '/api/me/agenda')).json() as Array<{ id: string }>).map(item => item.id)).toEqual(['agenda-a'])
    expect(await (await call('owner', 'GET', '/api/me/agenda')).json()).toEqual([])
    expect((await call(undefined, 'GET', '/api/me/agenda')).status).toBe(401)
  } finally {
    await db.service.deleteMany({ where: { id: { in: ['agenda-a', 'agenda-b', 'agenda-old'] } } })
  }
})
