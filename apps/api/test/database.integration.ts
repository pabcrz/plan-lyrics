import { afterAll, beforeAll, expect, it } from 'vitest'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) {
  throw new Error('Use pnpm test:db; an isolated fixture database is required')
}
const db = connectDatabase(url)
beforeAll(() => seedFixtures(db))
afterAll(() => db.$disconnect())

it('persists a person without an account in multiple churches', async () => {
  const person = await db.person.findUniqueOrThrow({ where: { id: 'person-no-account' }, include: { churches: true } })
  expect(person.userId).toBeNull()
  expect(person.churches.map(link => link.churchId).sort()).toEqual(['church-a', 'church-b'])
  expect(person.churches.every(link => link.createdAt instanceof Date && link.updatedAt instanceof Date)).toBe(true)
})

it('rejects a second owner without changing ownership', async () => {
  await expect(db.platformOwner.create({ data: { id: 2, userId: 'member' } })).rejects.toThrow()
  expect(await db.platformOwner.findMany({ select: { id: true, userId: true } })).toEqual([{ id: 1, userId: 'owner' }])
})

it('rejects duplicate identity and membership without adding records', async () => {
  const before = [await db.user.count(), await db.membership.count()]
  await expect(db.user.create({ data: { clerkSubject: 'fixture-owner' } })).rejects.toThrow()
  await expect(db.membership.create({ data: { userId: 'member', churchId: 'church-a', role: 'ADMIN' } })).rejects.toThrow()
  expect([await db.user.count(), await db.membership.count()]).toEqual(before)
})

it('records creation and update times on access records', async () => {
  const church = await db.church.findUniqueOrThrow({ where: { id: 'church-a' } })
  expect(church.createdAt).toBeInstanceOf(Date)
  expect(church.updatedAt.getTime()).toBeGreaterThanOrEqual(church.createdAt.getTime())
  const renamed = await db.church.update({ where: { id: 'church-a' }, data: { name: church.name } })
  expect(renamed.createdAt).toEqual(church.createdAt)
  expect(renamed.updatedAt.getTime()).toBeGreaterThan(church.updatedAt.getTime())
  const counts = await db.$queryRaw<Array<{ missing: bigint }>>`
    SELECT (SELECT count(*) FROM "User" WHERE "createdAt" IS NULL OR "updatedAt" IS NULL)
      + (SELECT count(*) FROM "Membership" WHERE "createdAt" IS NULL OR "updatedAt" IS NULL) AS missing`
  expect(counts[0].missing).toBe(0n)
})

it('keeps one shared person and rejects a duplicate church link', async () => {
  const before = await db.churchPerson.count()
  await expect(db.churchPerson.create({ data: { churchId: 'church-a', personId: 'person-no-account' } })).rejects.toThrow()
  expect(await db.churchPerson.count()).toBe(before)
  expect(await db.person.count({ where: { name: 'Fixture Participant' } })).toBe(1)
})

it('removes only the church link when a church is deleted, never the shared person', async () => {
  await db.church.create({ data: { id: 'church-temp', name: 'Fixture Temporary Church', people: { create: { personId: 'person-no-account' } } } })
  await db.church.delete({ where: { id: 'church-temp' } })
  const person = await db.person.findUniqueOrThrow({ where: { id: 'person-no-account' }, include: { churches: true } })
  expect(person.churches.map(link => link.churchId).sort()).toEqual(['church-a', 'church-b'])
})

it('defaults the account manager capability to false', async () => {
  expect((await db.user.findUniqueOrThrow({ where: { id: 'member' } })).accountManager).toBe(false)
  expect((await db.user.findUniqueOrThrow({ where: { id: 'accounts' } })).accountManager).toBe(true)
})
