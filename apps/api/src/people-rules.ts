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
export const newPersonBody = z.strictObject({ name, phone: phone.optional() })
// Solo información personal general; roles, turnos y cuentas no se editan por aquí.
export const personPatch = z.strictObject({ name: name.optional(), phone: phone.nullable().optional() })
  .refine(body => body.name !== undefined || body.phone !== undefined)
