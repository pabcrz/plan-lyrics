import type { Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { batchBody, batchEntries, checkBatch, lastDirectorOf, parseWeekdays } from './batch-rules.js'
import { safeErrorCode } from './errors.js'
import { generateForServices } from './participation-generation.js'
import { monthQuery, todayInZone, type SlotName } from './service-rules.js'
import type { SessionEnvironment } from './session.js'

// Only what the batch needs of the active church; the church always comes from the caller's access.
type Church = { churchId: string; sundayDouble: boolean; canEdit: boolean }
type Http = Context<SessionEnvironment>

const monthRange = (month: string) => {
  const [year, number] = month.split('-').map(Number)
  return { gte: new Date(Date.UTC(year, number - 1, 1)), lt: new Date(Date.UTC(year, number, 1)) }
}
const day = (date: Date) => date.toISOString().slice(0, 10)

/** Dates of the chosen weekdays with their locks, plus the continuity left by the previous batch. */
export async function batchPeriod(c: Http, db: PrismaClient, church: Church, now: Date) {
  if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
  const month = monthQuery.safeParse(c.req.query('month'))
  const weekdays = parseWeekdays(c.req.query('weekdays') ?? '')
  if (!month.success || !weekdays) return c.json({ error: 'Invalid request' }, 400)
  const today = todayInZone(now)
  if (month.data < today.slice(0, 7)) return c.json({ error: 'Month in the past' }, 400)
  const where = { churchId: church.churchId, date: monthRange(month.data) }
  const [services, closed, state] = await Promise.all([
    db.service.findMany({ where, select: { date: true, slot: true, title: true, director: { select: { person: { select: { name: true } } } } } }),
    db.closedDate.findMany({ where, select: { date: true, reason: true } }),
    db.batchDirectors.findUnique({ where: { churchId: church.churchId } }),
  ])
  const active = state ? await db.churchPerson.findMany({
    where: { churchId: church.churchId, removedAt: null, personId: { in: state.directorIds } }, select: { personId: true },
  }) : []
  const stillActive = new Set(active.map(link => link.personId))
  return c.json({
    month: month.data,
    entries: batchEntries({
      month: month.data, weekdays, today, sundayDouble: church.sundayDouble,
      services: services.map(row => ({ date: day(row.date), slot: row.slot as SlotName, title: row.title, director: row.director.person.name })),
      closed: closed.map(row => ({ date: day(row.date), reason: row.reason })),
    }),
    previous: state ? { directorIds: state.directorIds.filter(personId => stillActive.has(personId)), lastDirectorId: state.lastDirectorId } : null,
  })
}

const serviceSelect = {
  id: true, title: true, date: true, slot: true, time: true, status: true,
  director: { select: { person: { select: { id: true, name: true } } } },
} as const

/** Creates the reviewed batch atomically as drafts and stores the director continuity. */
export async function createBatch(c: Http, db: PrismaClient, church: Church, now: Date) {
  if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
  const body = batchBody.safeParse(await c.req.json().catch(() => undefined))
  if (!body.success) return c.json({ error: 'Invalid request' }, 400)
  const checked = checkBatch(body.data, { today: todayInZone(now), sundayDouble: church.sundayDouble })
  if ('error' in checked) return c.json({ error: checked.error }, 400)
  const { entries } = checked
  const outcome = await db.$transaction(async tx => {
    // Same per-church lock as individual creation: the checks below cannot race another request.
    await tx.$queryRaw`SELECT id FROM "Church" WHERE id = ${church.churchId} FOR UPDATE`
    const wanted = new Set([...body.data.directorIds, ...entries.map(entry => entry.directorId)])
    const links = await tx.churchPerson.count({ where: { churchId: church.churchId, removedAt: null, personId: { in: [...wanted] } } })
    if (links !== wanted.size) return { error: 'Invalid request' as const }
    const dates = [...new Set(entries.map(entry => entry.date))].map(date => new Date(`${date}T00:00:00Z`))
    const [closed, existing] = await Promise.all([
      tx.closedDate.findMany({ where: { churchId: church.churchId, date: { in: dates } }, select: { date: true } }),
      tx.service.findMany({ where: { churchId: church.churchId, date: { in: dates } }, select: { date: true, slot: true } }),
    ])
    const closedDates = new Set(closed.map(row => day(row.date)))
    for (const entry of entries) {
      if (closedDates.has(entry.date)) return { error: 'Date closed' as const, date: entry.date }
      const taken = existing.filter(row => day(row.date) === entry.date)
      const capacity = entry.slot === 'SINGLE' ? 1 : 2
      if (taken.length >= capacity || taken.some(row => row.slot === entry.slot)) return { error: 'Date full' as const, date: entry.date }
    }
    const created = []
    for (const entry of entries) {
      created.push(await tx.service.create({
        data: { churchId: church.churchId, directorId: entry.directorId, date: new Date(`${entry.date}T00:00:00Z`), slot: entry.slot, title: entry.title, time: entry.time, status: 'DRAFT' },
        select: serviceSelect,
      }))
    }
    // Habitual people and rotation turns, in date order so the sequences continue from where the last batch left them.
    await generateForServices(tx, church.churchId, created.map((row, index) => ({ id: row.id, date: entries[index].date, slot: entries[index].slot, directorId: entries[index].directorId })))
    const state = { directorIds: body.data.directorIds, lastDirectorId: lastDirectorOf(entries) }
    await tx.batchDirectors.upsert({ where: { churchId: church.churchId }, update: state, create: { churchId: church.churchId, ...state } })
    return { created }
  }).catch(error => { if (safeErrorCode(error) === 'P2002') return { error: 'Date full' as const }; throw error })
  if ('error' in outcome) return c.json(outcome, outcome.error === 'Invalid request' ? 400 : 409)
  return c.json({
    services: outcome.created.map(row => ({
      id: row.id, title: row.title, date: day(row.date), slot: row.slot, time: row.time, status: row.status, director: row.director.person,
    })),
  }, 201)
}
