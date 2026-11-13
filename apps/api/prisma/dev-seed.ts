// Datos ficticios para desarrollo local: una iglesia de ejemplo con días habituales y personas.
// Uso: DATABASE_URL=... SEED_CLERK_SUBJECT=user_xxx pnpm --filter @plan-lyrics/api db:seed
import { connectDatabase } from '../src/database.ts'
import { nameKey } from '../src/people-rules.ts'

const url = process.env.DATABASE_URL?.trim()
const subject = process.env.SEED_CLERK_SUBJECT?.trim()
if (!url || !subject) throw new Error('Define DATABASE_URL y SEED_CLERK_SUBJECT (tu sujeto Clerk de desarrollo)')
const db = connectDatabase(url)
try {
  const churchId = 'dev-church'
  // En desarrollo la persona de ejemplo también edita la biblioteca, para probar el alta rápida de canciones.
  const userId = (await db.user.upsert({ where: { clerkSubject: subject }, update: { libraryEditor: true }, create: { clerkSubject: subject, libraryEditor: true } })).id
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
  // Biblioteca ficticia: títulos y autores inventados (nunca repertorio real). Hay dos canciones con el mismo título y distinto autor.
  for (const [title, author] of [
    ['Canción de ejemplo', 'Autora Uno'], ['Canción de ejemplo', 'Autor Dos'], ['Himno ficticio', 'Autor Dos'],
    ['Tema inventado', 'Autora Tres'], ['Melodía de prueba', 'Autora Uno'],
  ]) {
    const keys = { titleKey: nameKey(title), authorKey: nameKey(author) }
    await db.song.upsert({ where: { titleKey_authorKey: keys }, update: {}, create: { title, author, ...keys } })
  }
  console.log('Datos de ejemplo listos')
} finally { await db.$disconnect() }
