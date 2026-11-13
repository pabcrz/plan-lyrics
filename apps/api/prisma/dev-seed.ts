// Datos ficticios para desarrollo local: una iglesia de ejemplo con días habituales y personas.
// Uso: DATABASE_URL=... SEED_CLERK_SUBJECT=user_xxx pnpm --filter @plan-lyrics/api db:seed
import { connectDatabase } from '../src/database.ts'

const url = process.env.DATABASE_URL?.trim()
const subject = process.env.SEED_CLERK_SUBJECT?.trim()
if (!url || !subject) throw new Error('Define DATABASE_URL y SEED_CLERK_SUBJECT (tu sujeto Clerk de desarrollo)')
const db = connectDatabase(url)
try {
  const churchId = 'dev-church'
  const userId = (await db.user.upsert({ where: { clerkSubject: subject }, update: {}, create: { clerkSubject: subject } })).id
  await db.church.upsert({ where: { id: churchId }, update: {}, create: { id: churchId, name: 'Iglesia de ejemplo', sundayDouble: true } })
  await db.membership.upsert({ where: { userId_churchId: { userId, churchId } }, update: {}, create: { userId, churchId, role: 'ADMIN' } })
  for (const [weekday, slot, time, title] of [
    [5, 'SINGLE', '19:30', 'Servicio de viernes'],
    [0, 'MORNING', '09:00', 'Servicio dominical (mañana)'],
    [0, 'AFTERNOON', '17:00', 'Servicio dominical (tarde)'],
  ] as const) {
    await db.serviceDay.upsert({ where: { churchId_weekday_slot: { churchId, weekday, slot } }, update: { time, title }, create: { churchId, weekday, slot, time, title } })
  }
  for (const [id, name] of [['dev-ana', 'Ana Ramírez'], ['dev-luis', 'Luis Herrera'], ['dev-sofia', 'Sofía Torres']]) {
    await db.person.upsert({ where: { id }, update: {}, create: { id, name, churches: { create: { churchId } } } })
  }
  console.log('Datos de ejemplo listos')
} finally { await db.$disconnect() }
