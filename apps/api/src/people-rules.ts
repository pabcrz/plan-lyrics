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
// Vacío significa «sin teléfono»; el resto admite solo los símbolos habituales de un número.
const phone = z.string().trim().transform(value => value || null).pipe(z.string().regex(/^[\d+()\-.\s]{3,30}$/).nullable())

// La iglesia nunca forma parte del cuerpo: siempre es la iglesia activa de quien llama.
// `canDirect` and `canPreach` say which jobs the pickers offer this person for; both are off unless asked for.
const roles = { canDirect: z.boolean().optional(), canPreach: z.boolean().optional() }
export const newPersonBody = z.strictObject({ name, phone: phone.optional(), ...roles })
// Datos personales generales y los dos roles de esta iglesia; turnos y cuentas no se editan por aquí.
export const personPatch = z.strictObject({ name: name.optional(), phone: phone.nullable().optional(), ...roles })
  .refine(body => Object.values(body).some(value => value !== undefined))
export const peopleRoleQuery = z.enum(['direct', 'preach'])
