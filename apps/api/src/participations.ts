import { Hono, type Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { activePeople, lockChurch, planSelect, slotOrder, type Tx } from './participation-generation.js'
import {
  assignmentBody, keepCursor, newAssignmentBody, participationBody, participationIssue, personFits, previewTurns,
  SHARED_WEEKDAY, swapBody, type RolePlan, type Sequence,
} from './participation-rules.js'
import { ensureSeeded } from './roles.js'
import { isoDate, todayInZone, weekdayOf } from './service-rules.js'
import { activeChurch, type Active } from './services.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Http = Context<SessionEnvironment>

const param = (c: Http, name: string) => c.req.param(name) ?? ''
const day = (date: Date) => date.toISOString().slice(0, 10)
const dateValue = (date: string) => new Date(`${date}T00:00:00Z`)

async function nameMap(db: Tx | PrismaClient, churchId: string, ids: readonly string[]) {
  const links = await db.churchPerson.findMany({ where: { churchId, personId: { in: [...new Set(ids)] } }, select: { person: { select: { id: true, name: true } } } })
  return new Map(links.map(link => [link.person.id, link.person.name]))
}
const person = (names: Map<string, string>, id: string | null) => id && names.has(id) ? { id, name: names.get(id)! } : null

/** The next service dates of the church's habitual days, as a preview of what generation would do. */
export function upcomingDates(days: readonly { weekday: number; slot: string }[], today: string, count = 6) {
  const out: { date: string; slot: string }[] = []
  for (let offset = 0; offset < 120 && out.length < count; offset++) {
    const date = new Date(dateValue(today).getTime() + offset * 86_400_000).toISOString().slice(0, 10)
    out.push(...days.filter(entry => entry.weekday === weekdayOf(date)).sort((a, b) => slotOrder[a.slot as keyof typeof slotOrder] - slotOrder[b.slot as keyof typeof slotOrder]).map(entry => ({ date, slot: entry.slot })))
  }
  return out.slice(0, count)
}

async function presentRole(db: Tx | PrismaClient, church: Active, roleId: string, today: string) {
  const role = await db.musicalRole.findFirst({ where: { id: roleId, churchId: church.churchId }, select: { id: true, name: true, plan: { select: planSelect } } })
  if (!role) return null
  const plan = role.plan
  const sequences: Sequence[] = plan?.sequences ?? []
  const [active, days] = await Promise.all([activePeople(db, church.churchId), db.serviceDay.findMany({ where: { churchId: church.churchId }, select: { weekday: true, slot: true } })])
  const names = await nameMap(db, church.churchId, [...(plan?.habitualIds ?? []), ...sequences.flatMap(sequence => sequence.memberIds)])
  const people = (ids: readonly string[]) => ids.filter(id => active.has(id)).map(id => person(names, id)!)
  const base: RolePlan = {
    roleId, roleName: role.name, habitualIds: plan?.habitualIds ?? [], rotationOn: plan?.rotationOn ?? false, mode: plan?.mode ?? 'BY_DAY',
    startsOn: plan?.startsOn ? day(plan.startsOn) : null, sequences,
  }
  const dates = upcomingDates(days, today)
  const turns = previewTurns(base, dates.map(entry => entry.date), active)
  return {
    roleId, name: role.name,
    habitual: people(base.habitualIds),
    rotation: { enabled: base.rotationOn, mode: base.mode, startsOn: base.startsOn, sequences: sequences.map(sequence => ({ weekday: sequence.weekday === SHARED_WEEKDAY ? null : sequence.weekday, people: people(sequence.memberIds) })) },
    preview: dates.map((entry, index) => ({ ...entry, rotation: person(names, turns[index].personId), habitual: base.habitualIds.length ? people(base.habitualIds) : [] })),
  }
}

const presentAssignment = (row: { id: string; roleId: string | null; roleName: string; source: string; pending: string | null; personId: string | null; proposedPersonId: string | null }, names: Map<string, string>) => ({
  id: row.id, roleId: row.roleId, roleName: row.roleName, source: row.source, pending: row.pending,
  person: person(names, row.personId), proposed: person(names, row.proposedPersonId),
})
const assignmentSelect = { id: true, roleId: true, roleName: true, source: true, pending: true, personId: true, proposedPersonId: true } as const

export function participationRoutes(config: SessionConfig, db?: PrismaClient, now: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/role-participations', '/api/role-participations/*', '/api/role-turns', '/api/assignments', '/api/assignments/*', '/api/services/:serviceId/assignments']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }
  const guarded = (event: string, handler: (c: Http, db: PrismaClient, church: Active) => Promise<Response>) => async (c: Http) => {
    if (!db) return c.json({ error: 'Access unavailable' }, 503)
    try {
      const church = await activeChurch(db, c.get('clerkSubject'))
      if (church === 'none') return c.json({ error: 'Not found' }, 404)
      if (church === 'ambiguous') return c.json({ error: 'Active church required' }, 409)
      return await handler(c, db, church)
    } catch (error) {
      console.error(JSON.stringify({ event, code: safeErrorCode(error) }))
      return c.json({ error: 'Access unavailable' }, 503)
    }
  }
  const today = () => todayInZone(now())

  routes.get('/api/role-participations', guarded('participations_list_failed', async (c, db, church) => {
    await ensureSeeded(db, church.churchId)
    const roles = await db.musicalRole.findMany({ where: { churchId: church.churchId }, select: { id: true } })
    const presented = await Promise.all(roles.map(role => presentRole(db, church, role.id, today())))
    return c.json(presented.flatMap(role => role ? [role] : []).sort((a, b) => a.name.localeCompare(b.name, 'es')))
  }))

  // One request replaces the role's whole configuration. A rotation restarts at its first person when it is
  // turned on or its reference date changes; otherwise each sequence keeps its cursor while that person stays.
  routes.put('/api/role-participations/:roleId', guarded('participation_save_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const roleId = param(c, 'roleId')
    const body = participationBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success || participationIssue(body.data)) return c.json({ error: 'Invalid request' }, 400)
    const { habitualIds, rotation } = body.data
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const role = await tx.musicalRole.findFirst({ where: { id: roleId, churchId: church.churchId }, select: { plan: { select: planSelect } } })
      if (!role) return 'missing' as const
      const wanted = new Set([...habitualIds, ...rotation.sequences.flatMap(sequence => sequence.personIds)])
      if (await tx.churchPerson.count({ where: { churchId: church.churchId, removedAt: null, personId: { in: [...wanted] } } }) !== wanted.size) return 'invalid' as const
      const previous = role.plan
      const startsOn = rotation.startsOn ? dateValue(rotation.startsOn) : null
      const restarted = !previous?.rotationOn || (previous.startsOn ? day(previous.startsOn) : null) !== rotation.startsOn
      const data = { churchId: church.churchId, habitualIds, rotationOn: rotation.enabled, mode: rotation.mode, startsOn }
      await tx.rolePlan.upsert({ where: { roleId }, update: data, create: { roleId, ...data } })
      const keys = rotation.sequences.map(sequence => sequence.weekday ?? SHARED_WEEKDAY)
      await tx.rotationSequence.deleteMany({ where: { roleId, weekday: { notIn: keys } } })
      for (const sequence of rotation.sequences) {
        const weekday = sequence.weekday ?? SHARED_WEEKDAY
        const nextPersonId = keepCursor(previous?.sequences.find(old => old.weekday === weekday)?.nextPersonId ?? null, sequence.personIds, restarted)
        await tx.rotationSequence.upsert({
          where: { roleId_weekday: { roleId, weekday } }, update: { memberIds: sequence.personIds, nextPersonId }, create: { roleId, weekday, memberIds: sequence.personIds, nextPersonId },
        })
      }
      return presentRole(tx, church, roleId, today())
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (result === 'invalid') return c.json({ error: 'Invalid request' }, 400)
    return c.json(result)
  }))

  // Assignments of one service, with the role they belong to and who was proposed when a role is pending.
  routes.get('/api/services/:serviceId/assignments', guarded('assignments_list_failed', async (c, db, church) => {
    const service = await db.service.findFirst({ where: { id: param(c, 'serviceId'), churchId: church.churchId }, select: { id: true, title: true, date: true, slot: true, directorId: true } })
    if (!service) return c.json({ error: 'Not found' }, 404)
    const rows = await db.assignment.findMany({ where: { serviceId: service.id, churchId: church.churchId }, orderBy: [{ roleName: 'asc' }, { createdAt: 'asc' }], select: assignmentSelect })
    const names = await nameMap(db, church.churchId, [service.directorId, ...rows.flatMap(row => [row.personId, row.proposedPersonId].filter((id): id is string => id !== null))])
    return c.json({
      service: { id: service.id, title: service.title, date: day(service.date), slot: service.slot, director: person(names, service.directorId) },
      assignments: rows.map(row => presentAssignment(row, names)),
    })
  }))

  /** Checks that `personId` may hold `roleId` in the service and returns why not; `ignore` is the assignment being replaced. */
  const fit = async (tx: Tx, church: Active, service: { id: string; date: Date; directorId: string }, roleId: string, personId: string, ignore?: string) => {
    if (day(service.date) < today()) return 'Date in the past' as const
    if (!await tx.churchPerson.findFirst({ where: { churchId: church.churchId, personId, removedAt: null }, select: { personId: true } })) return 'Invalid request' as const
    const held = await tx.assignment.findMany({ where: { serviceId: service.id, personId, id: ignore ? { not: ignore } : undefined }, select: { roleId: true } })
    const roles = held.flatMap(row => row.roleId ? [row.roleId] : [])
    if (roles.includes(roleId)) return 'Already assigned' as const
    const restrictions = await tx.roleRestriction.findMany({ where: { churchId: church.churchId }, select: { first: true, second: true } })
    return personFits(restrictions, roles, roleId, service.directorId === personId) ? null : 'Combination not allowed' as const
  }
  const failure = (c: Http, error = 'Invalid request') => c.json({ error }, error === 'Invalid request' || error === 'Date in the past' ? 400 : 409)

  routes.post('/api/services/:serviceId/assignments', guarded('assignment_creation_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const body = newAssignmentBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const service = await tx.service.findFirst({ where: { id: param(c, 'serviceId'), churchId: church.churchId }, select: { id: true, date: true, directorId: true } })
      const role = await tx.musicalRole.findFirst({ where: { id: body.data.roleId, churchId: church.churchId }, select: { id: true, name: true } })
      if (!service) return 'missing' as const
      if (!role) return { error: 'Invalid request' }
      const problem = await fit(tx, church, service, role.id, body.data.personId)
      if (problem) return { error: problem }
      const row = await tx.assignment.create({ data: { churchId: church.churchId, serviceId: service.id, roleId: role.id, roleName: role.name, personId: body.data.personId, source: 'MANUAL' }, select: assignmentSelect })
      return { row }
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if ('error' in result) return failure(c, result.error)
    return c.json(presentAssignment(result.row, await nameMap(db, church.churchId, [body.data.personId])), 201)
  }))

  // «Reemplazar solo en este servicio»: changes this assignment alone; the rotation cursor and other services stay.
  routes.put('/api/assignments/:assignmentId', guarded('assignment_replace_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const body = assignmentBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const current = await tx.assignment.findFirst({ where: { id: param(c, 'assignmentId'), churchId: church.churchId }, select: { id: true, roleId: true, service: { select: { id: true, date: true, directorId: true } } } })
      if (!current) return 'missing' as const
      // A role that no longer exists has nobody to replace: the marker can only be removed.
      if (!current.roleId) return { error: 'Role removed' }
      const problem = await fit(tx, church, current.service, current.roleId, body.data.personId, current.id)
      if (problem) return { error: problem }
      const row = await tx.assignment.update({ where: { id: current.id }, data: { personId: body.data.personId, source: 'MANUAL', pending: null, proposedPersonId: null }, select: assignmentSelect })
      return { row }
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if ('error' in result) return failure(c, result.error)
    return c.json(presentAssignment(result.row, await nameMap(db, church.churchId, [body.data.personId])))
  }))

  routes.delete('/api/assignments/:assignmentId', guarded('assignment_removal_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const current = await tx.assignment.findFirst({ where: { id: param(c, 'assignmentId'), churchId: church.churchId }, select: { id: true, service: { select: { date: true } } } })
      if (!current) return 'missing' as const
      if (day(current.service.date) < today()) return 'past' as const
      await tx.assignment.delete({ where: { id: current.id } })
      return 'removed' as const
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    return result === 'past' ? c.json({ error: 'Date in the past' }, 400) : c.body(null, 204)
  }))

  // Swapping is its own explicit action between two turns of the same role; a replacement never does it on the side.
  routes.post('/api/assignments/swap', guarded('assignment_swap_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const body = swapBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success || body.data.first === body.data.second) return c.json({ error: 'Invalid request' }, 400)
    const result = await db.$transaction(async tx => {
      await lockChurch(tx, church.churchId)
      const select = { id: true, roleId: true, personId: true, service: { select: { id: true, date: true, directorId: true } } } as const
      const [first, second] = await Promise.all([body.data.first, body.data.second].map(id => tx.assignment.findFirst({ where: { id, churchId: church.churchId }, select })))
      if (!first || !second) return 'missing' as const
      if (!first.roleId || first.roleId !== second.roleId || !first.personId || !second.personId || first.service.id === second.service.id || first.personId === second.personId) return { error: 'Invalid request' }
      for (const [target, incoming] of [[first, second.personId], [second, first.personId]] as const) {
        const problem = await fit(tx, church, target.service, first.roleId, incoming, target.id)
        if (problem) return { error: problem }
      }
      // Each person lands in the other's service; neither holds the role there yet (checked above), so no unique clash.
      await tx.assignment.update({ where: { id: first.id }, data: { personId: second.personId, source: 'MANUAL' } })
      await tx.assignment.update({ where: { id: second.id }, data: { personId: first.personId, source: 'MANUAL' } })
      return { ok: true }
    })
    if (result === 'missing') return c.json({ error: 'Not found' }, 404)
    if ('error' in result) return failure(c, result.error)
    return c.json({ swapped: [body.data.first, body.data.second] })
  }))

  // Upcoming turns of one role with a person, to choose the counterpart of a swap.
  routes.get('/api/role-turns', guarded('role_turns_failed', async (c, db, church) => {
    const roleId = c.req.query('roleId') ?? ''
    const from = isoDate.safeParse(c.req.query('from') ?? today())
    if (!roleId || !from.success) return c.json({ error: 'Invalid request' }, 400)
    const rows = await db.assignment.findMany({
      where: { churchId: church.churchId, roleId, personId: { not: null }, service: { date: { gte: dateValue(from.data) } } },
      orderBy: [{ service: { date: 'asc' } }, { service: { slot: 'asc' } }], take: 40,
      select: { id: true, personId: true, service: { select: { id: true, date: true, slot: true } } },
    })
    const names = await nameMap(db, church.churchId, rows.flatMap(row => row.personId ? [row.personId] : []))
    return c.json(rows.map(row => ({ id: row.id, serviceId: row.service.id, date: day(row.service.date), slot: row.service.slot, person: person(names, row.personId) })))
  }))
  return routes
}
