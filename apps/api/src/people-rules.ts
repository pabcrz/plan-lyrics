import { z } from 'zod'

/** Clave de comparación de nombres: sin mayúsculas, acentos ni espacios repetidos. */
export function nameKey(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Persona de la lista con el mismo nombre completo (el nombre es lo único que desambigua). */
export function findSameName<T extends { id: string; name: string }>(people: readonly T[], name: string, exceptId?: string) {
  const key = nameKey(name)
  return people.find(person => person.id !== exceptId && nameKey(person.name) === key)
}

const name = z.string().transform(value => value.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(120))
// Vacío significa «sin teléfono»; el resto es un número mexicano de 10 dígitos guardado como +52XXXXXXXXXX.
const phone = z.string().trim().transform(value => value || null).pipe(z.string().regex(/^\+52\d{10}$/).nullable())

// Vacío significa «sin correo».
const email = z.string().trim().transform(value => value.toLowerCase() || null).pipe(z.email().max(254).nullable())

export const personRolesBody = z.strictObject({ roleIds: z.array(z.string().trim().min(1).max(64)).max(60).refine(ids => new Set(ids).size === ids.length) })

// La iglesia nunca forma parte del cuerpo: siempre es la iglesia activa de quien llama.
// `canDirect` and `canPreach` say which jobs the pickers offer this person for; both are off unless asked for.
const roles = { canDirect: z.boolean().optional(), canPreach: z.boolean().optional(), canPlay: z.boolean().optional() }
export const newPersonBody = z.strictObject({ name, phone: phone.optional(), email: email.optional(), ...roles })
// Información personal general y los dos roles de esta iglesia; roles musicales, turnos y cuentas no se editan por aquí.
export const personPatch = z.strictObject({ name: name.optional(), phone: phone.nullable().optional(), email: email.nullable().optional(), ...roles })
  .refine(body => Object.values(body).some(value => value !== undefined))
export const peopleRoleQuery = z.enum(['direct', 'preach', 'play'])

// Superadministrador: datos generales de una persona (sin iglesia) y su enlace con una iglesia.
export const platformPersonBody = z.strictObject({ name, phone: phone.optional(), email: email.optional() })
export const platformPersonPatch = z.strictObject({ name: name.optional(), phone: phone.nullable().optional(), email: email.nullable().optional() }).refine(body => Object.values(body).some(value => value !== undefined))
// Los roles musicales solo existen para quien está en el grupo de alabanza.
export const platformLinkBody = z.strictObject({ canPlay: z.boolean(), canDirect: z.boolean(), canPreach: z.boolean(), roleIds: personRolesBody.shape.roleIds })
  .refine(body => body.roleIds.length === 0 || body.canPlay)
