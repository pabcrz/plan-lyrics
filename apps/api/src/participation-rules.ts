import { z } from 'zod'
import { combinationAllowed, DIRECTOR_KEY, type Restriction } from './role-rules.js'
import { isoDate, weekdayOf } from './service-rules.js'

/** Clave de la única secuencia de la modalidad «entre todos los servicios». */
export const SHARED_WEEKDAY = -1

const personId = z.string().trim().min(1).max(64)

// La iglesia nunca forma parte del cuerpo: siempre es la iglesia activa de quien llama. Las dos modalidades
// conservan sus secuencias al cambiar de una a otra; `weekday: null` es la secuencia compartida.
export const participationBody = z.strictObject({
  habitualIds: z.array(personId).max(30),
  rotation: z.strictObject({
    enabled: z.boolean(),
    mode: z.enum(['BY_DAY', 'SHARED']),
    startsOn: isoDate.nullable(),
    sequences: z.array(z.strictObject({ weekday: z.number().int().min(0).max(6).nullable(), personIds: z.array(personId).max(30) })).max(8),
  }),
}).refine(body => !body.rotation.enabled || body.rotation.startsOn !== null)
export type ParticipationBody = z.infer<typeof participationBody>

const distinct = (ids: readonly string[]) => new Set(ids).size === ids.length

/** Reglas que el esquema no puede expresar: sin repetidos y nadie a la vez habitual y en rotación del mismo rol. */
export function participationIssue(body: ParticipationBody): string | null {
  const keys = body.rotation.sequences.map(sequence => sequence.weekday)
  if (!distinct(keys.map(String))) return 'sequences'
  if (!body.rotation.sequences.every(sequence => distinct(sequence.personIds))) return 'sequences'
  if (!distinct(body.habitualIds)) return 'habitualIds'
  const rotating = new Set(body.rotation.sequences.flatMap(sequence => sequence.personIds))
  return body.habitualIds.some(id => rotating.has(id)) ? 'overlap' : null
}

export type Sequence = { weekday: number; memberIds: string[]; nextPersonId: string | null }
export type RolePlan = {
  roleId: string; roleName: string; habitualIds: string[]
  rotationOn: boolean; mode: 'BY_DAY' | 'SHARED'; startsOn: string | null; sequences: Sequence[]
}
export type Generated = {
  roleId: string; roleName: string; personId: string | null; source: 'HABITUAL' | 'ROTATION'
  pending: 'COMBINATION' | null; proposedPersonId: string | null
}

/**
 * Who takes the next turn of the role on `date`, advancing that sequence's cursor. Nobody takes it before the
 * reference date or when the sequence has no active person. Removed people are skipped by never being a member here.
 */
export function takeTurn(plan: RolePlan, date: string, active: ReadonlySet<string>): string | null {
  if (!plan.rotationOn || !plan.startsOn || date < plan.startsOn) return null
  const key = plan.mode === 'SHARED' ? SHARED_WEEKDAY : weekdayOf(date)
  const sequence = plan.sequences.find(candidate => candidate.weekday === key)
  const members = sequence?.memberIds.filter(id => active.has(id)) ?? []
  if (!sequence || members.length === 0) return null
  const at = Math.max(0, members.indexOf(sequence.nextPersonId ?? ''))
  sequence.nextPersonId = members[(at + 1) % members.length]
  return members[at]
}

type Proposal = { roleId: string; roleName: string; personId: string; source: 'HABITUAL' | 'ROTATION' }

/**
 * Generates the assignments of the given services, in order, from each role's habitual people and its rotation.
 * A proposal that forms a combination the church forbids with another proposal of the same person, or with the
 * director's own role, is not assigned to anybody: it stays pending and nobody wins by priority.
 * The plans' cursors advance in place, so the next call continues the sequences.
 */
export function generateAssignments(
  services: readonly { date: string; directorId: string }[],
  plans: readonly RolePlan[], restrictions: readonly Restriction[], active: ReadonlySet<string>,
): Generated[][] {
  return services.map(service => {
    const proposals: Proposal[] = []
    for (const plan of plans) {
      const turn = takeTurn(plan, service.date, active)
      const people = [...plan.habitualIds.filter(id => active.has(id)).map(id => [id, 'HABITUAL'] as const), ...(turn ? [[turn, 'ROTATION'] as const] : [])]
      for (const [id, source] of people) {
        if (!proposals.some(other => other.roleId === plan.roleId && other.personId === id)) proposals.push({ roleId: plan.roleId, roleName: plan.roleName, personId: id, source })
      }
    }
    const rolesOf = (id: string) => [...proposals.filter(p => p.personId === id).map(p => p.roleId), ...(id === service.directorId ? [DIRECTOR_KEY] : [])]
    return proposals.map(proposal => {
      const others = rolesOf(proposal.personId).filter(role => role !== proposal.roleId)
      const collides = others.some(role => !combinationAllowed(restrictions, [proposal.roleId, role]))
      return {
        roleId: proposal.roleId, roleName: proposal.roleName, source: proposal.source,
        personId: collides ? null : proposal.personId, pending: collides ? 'COMBINATION' as const : null, proposedPersonId: collides ? proposal.personId : null,
      }
    })
  })
}

/** Turnos que recibirían los próximos servicios sin tocar los cursores guardados. */
export function previewTurns(plan: RolePlan, dates: readonly string[], active: ReadonlySet<string>) {
  const copy: RolePlan = { ...plan, sequences: plan.sequences.map(sequence => ({ ...sequence })) }
  return dates.map(date => ({ date, personId: takeTurn(copy, date, active) }))
}

/** Cursor of a saved sequence: kept while its person is still in the list and the rotation did not restart. */
export function keepCursor(previous: string | null, members: readonly string[], restarted: boolean) {
  if (members.length === 0) return null
  return !restarted && previous && members.includes(previous) ? previous : members[0]
}

/** ¿Puede esta persona tener este rol además de los que ya tiene en el servicio (y de dirigirlo)? */
export function personFits(restrictions: readonly Restriction[], held: readonly string[], roleId: string, isDirector: boolean) {
  return combinationAllowed(restrictions, [...held, roleId, ...(isDirector ? [DIRECTOR_KEY] : [])])
}

export const assignmentBody = z.strictObject({ personId })
export const newAssignmentBody = z.strictObject({ roleId: z.string().trim().min(1).max(64), personId })
export const swapBody = z.strictObject({ first: z.string().trim().min(1).max(64), second: z.string().trim().min(1).max(64) })
