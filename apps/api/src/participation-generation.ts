import type { PrismaClient } from './generated/prisma/client.ts'
import { generateAssignments, type RolePlan } from './participation-rules.js'

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
export const slotOrder = { SINGLE: 0, MORNING: 1, AFTERNOON: 2 } as const
const day = (date: Date) => date.toISOString().slice(0, 10)
export const lockChurch = (tx: Tx, churchId: string) => tx.$queryRaw`SELECT id FROM "Church" WHERE id = ${churchId} FOR UPDATE`

export const planSelect = { roleId: true, rotationOn: true, mode: true, startsOn: true, habitualIds: true, sequences: { select: { weekday: true, memberIds: true, nextPersonId: true } } } as const

/** Plans of every role of the church that has habitual people or a rotation, ready to generate from. */
async function loadPlans(tx: Tx, churchId: string): Promise<RolePlan[]> {
  const roles = await tx.musicalRole.findMany({ where: { churchId, plan: { isNot: null } }, orderBy: { name: 'asc' }, select: { id: true, name: true, plan: { select: planSelect } } })
  return roles.flatMap(role => role.plan ? [{
    roleId: role.id, roleName: role.name, habitualIds: role.plan.habitualIds, rotationOn: role.plan.rotationOn, mode: role.plan.mode,
    startsOn: role.plan.startsOn ? day(role.plan.startsOn) : null, sequences: role.plan.sequences.map(sequence => ({ ...sequence })),
  }] : [])
}

export const activePeople = async (tx: Tx | PrismaClient, churchId: string) =>
  new Set((await tx.churchPerson.findMany({ where: { churchId, removedAt: null }, select: { personId: true } })).map(link => link.personId))

/**
 * Loads the habitual people and rotation of every role and creates the assignments of the given new services,
 * in date order, continuing each rotation where the last services left it. Runs inside the creation transaction
 * of the individual service and of the monthly batch, under the same church lock.
 */
export async function generateForServices(tx: Tx, churchId: string, services: readonly { id: string; date: string; slot: string; directorId: string }[]) {
  const [plans, restrictions, active] = await Promise.all([
    loadPlans(tx, churchId), tx.roleRestriction.findMany({ where: { churchId }, select: { first: true, second: true } }), activePeople(tx, churchId),
  ])
  if (plans.length === 0 || services.length === 0) return
  const ordered = [...services].sort((a, b) => a.date.localeCompare(b.date) || slotOrder[a.slot as keyof typeof slotOrder] - slotOrder[b.slot as keyof typeof slotOrder])
  const before = new Map(plans.flatMap(plan => plan.sequences.map(sequence => [`${plan.roleId}:${sequence.weekday}`, sequence.nextPersonId] as const)))
  const generated = generateAssignments(ordered, plans, restrictions, active)
  await tx.assignment.createMany({
    data: ordered.flatMap((service, index) => generated[index].map(item => ({
      churchId, serviceId: service.id, roleId: item.roleId, roleName: item.roleName, personId: item.personId, source: item.source,
      pending: item.pending, proposedPersonId: item.proposedPersonId,
    }))),
  })
  for (const plan of plans) for (const sequence of plan.sequences) {
    if (before.get(`${plan.roleId}:${sequence.weekday}`) !== sequence.nextPersonId) {
      await tx.rotationSequence.update({ where: { roleId_weekday: { roleId: plan.roleId, weekday: sequence.weekday } }, data: { nextPersonId: sequence.nextPersonId } })
    }
  }
}

