import type { PrismaClient } from '../src/generated/prisma/client.ts'

export async function seedFixtures(db: PrismaClient) {
  await db.user.createMany({ data: [
    { id: 'owner', clerkSubject: 'fixture-owner' },
    { id: 'member', clerkSubject: 'fixture-member' },
    { id: 'admin', clerkSubject: 'fixture-admin' },
    { id: 'editor', clerkSubject: 'fixture-editor' },
    { id: 'library', clerkSubject: 'fixture-library', libraryEditor: true },
    { id: 'combined', clerkSubject: 'fixture-combined', libraryEditor: true },
    { id: 'accounts', clerkSubject: 'fixture-accounts', accountManager: true },
    { id: 'b-editor', clerkSubject: 'fixture-b-editor' },
    { id: 'multi', clerkSubject: 'fixture-multi' },
  ], skipDuplicates: true })
  await db.church.createMany({ data: [
    { id: 'church-a', name: 'Fixture Church A' },
    { id: 'church-b', name: 'Fixture Church B' },
  ], skipDuplicates: true })
  for (const [userId, role] of [['member', 'MEMBER'], ['admin', 'ADMIN'], ['editor', 'EDITOR'], ['combined', 'MEMBER']] as const) {
    await db.membership.upsert({ where: { userId_churchId: { userId, churchId: 'church-a' } }, update: {}, create: { userId, churchId: 'church-a', role } })
  }
  // Church B enables the double Sunday; church A does not.
  await db.church.update({ where: { id: 'church-b' }, data: { sundayDouble: true } })
  for (const [userId, churchId, role] of [['b-editor', 'church-b', 'EDITOR'], ['multi', 'church-a', 'MEMBER'], ['multi', 'church-b', 'MEMBER']] as const) {
    await db.membership.upsert({ where: { userId_churchId: { userId, churchId } }, update: {}, create: { userId, churchId, role } })
  }
  for (const [id, churchId] of [['person-a', 'church-a'], ['person-b', 'church-b']]) {
    await db.person.upsert({ where: { id }, update: {}, create: { id, name: `Director ${id}`, churches: { create: { churchId } } } })
  }
  await db.serviceDay.createMany({ data: [
    { churchId: 'church-a', weekday: 5, slot: 'SINGLE', time: '19:30', title: 'Servicio de viernes' },
    { churchId: 'church-a', weekday: 0, slot: 'SINGLE', time: '10:00', title: 'Servicio dominical' },
    { churchId: 'church-b', weekday: 0, slot: 'MORNING', time: '09:00', title: 'Culto de la mañana' },
    { churchId: 'church-b', weekday: 0, slot: 'AFTERNOON', time: '17:00', title: 'Culto de la tarde' },
  ], skipDuplicates: true })
  await db.platformOwner.upsert({ where: { id: 1 }, update: {}, create: { userId: 'owner' } })
  await db.person.upsert({ where: { id: 'person-no-account' }, update: {}, create: {
    id: 'person-no-account', name: 'Fixture Participant', churches: { create: [{ churchId: 'church-a' }, { churchId: 'church-b' }] },
  } })
}
