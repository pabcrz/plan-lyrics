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
  expect(person.churches.map(c => c.id).sort()).toEqual(['church-a', 'church-b'])
})

it('rejects a second owner without changing ownership', async () => {
  await expect(db.platformOwner.create({ data: { id: 2, userId: 'member' } })).rejects.toThrow()
  expect(await db.platformOwner.findMany()).toEqual([{ id: 1, userId: 'owner' }])
})

it('rejects duplicate identity and membership without adding records', async () => {
  const before = [await db.user.count(), await db.membership.count()]
  await expect(db.user.create({ data: { clerkSubject: 'fixture-owner' } })).rejects.toThrow()
  await expect(db.membership.create({ data: { userId: 'member', churchId: 'church-a', role: 'ADMIN' } })).rejects.toThrow()
  expect([await db.user.count(), await db.membership.count()]).toEqual(before)
})
