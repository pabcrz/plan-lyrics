import type { PrismaClient } from '../src/generated/prisma/client.ts'

export async function seedFixtures(db: PrismaClient) {
  await db.user.createMany({ data: [
    { id: 'owner', clerkSubject: 'fixture-owner' },
    { id: 'member', clerkSubject: 'fixture-member' },
    { id: 'admin', clerkSubject: 'fixture-admin' },
    { id: 'editor', clerkSubject: 'fixture-editor' },
    { id: 'library', clerkSubject: 'fixture-library', libraryEditor: true },
    { id: 'combined', clerkSubject: 'fixture-combined', libraryEditor: true },
  ], skipDuplicates: true })
  await db.church.createMany({ data: [
    { id: 'church-a', name: 'Fixture Church A' },
    { id: 'church-b', name: 'Fixture Church B' },
  ], skipDuplicates: true })
  for (const [userId, role] of [['member', 'MEMBER'], ['admin', 'ADMIN'], ['editor', 'EDITOR'], ['combined', 'MEMBER']] as const) {
    await db.membership.upsert({ where: { userId_churchId: { userId, churchId: 'church-a' } }, update: {}, create: { userId, churchId: 'church-a', role } })
  }
  await db.platformOwner.upsert({ where: { id: 1 }, update: {}, create: { userId: 'owner' } })
  await db.person.upsert({ where: { id: 'person-no-account' }, update: {}, create: {
    id: 'person-no-account', name: 'Fixture Participant', churches: { connect: [{ id: 'church-a' }, { id: 'church-b' }] },
  } })
}
