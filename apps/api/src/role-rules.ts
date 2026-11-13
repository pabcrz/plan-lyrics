import { z } from 'zod'
import { nameKey } from './people-rules.js'

/** «Dirigir» es un rol fijo del servicio: no está en el catálogo, pero participa en las combinaciones. */
export const DIRECTOR_KEY = 'DIRIGIR'
export const DIRECTOR_NAME = 'Dirigir'

/** Catálogo inicial de cada iglesia; se presenta siempre en orden alfabético. */
export const DEFAULT_ROLES = ['Batería', 'Guitarra', 'Piano', 'Voces'] as const

/** Par de roles que una misma persona no puede tener a la vez; cada lado es el id de un rol o `DIRIGIR`. */
export type Restriction = { first: string; second: string }

// La iglesia nunca forma parte del cuerpo: siempre es la iglesia activa de quien llama.
export const newRoleBody = z.strictObject({
  name: z.string().transform(value => value.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(40)),
})
export const newRestrictionBody = z.strictObject({ first: z.string().min(1).max(64), second: z.string().min(1).max(64) })

/** El nombre «Dirigir» ya existe como rol fijo, así que cuenta como duplicado del catálogo. */
export function roleNameTaken(names: readonly string[], name: string) {
  const key = nameKey(name)
  return key === nameKey(DIRECTOR_NAME) || names.some(existing => nameKey(existing) === key)
}

/** Forma canónica del par (sin orden): el menor primero, igual que lo guarda la base de datos. */
export function sortedPair(a: string, b: string): Restriction {
  return a < b ? { first: a, second: b } : { first: b, second: a }
}

export function sameRestriction(a: Restriction, b: Restriction) {
  const [x, y] = [sortedPair(a.first, a.second), sortedPair(b.first, b.second)]
  return x.first === y.first && x.second === y.second
}

/**
 * ¿Puede una misma persona tener todos estos roles a la vez en un servicio?
 * Los roles son ids de rol o `DIRIGIR`; un rol repetido cuenta una sola vez y un par inválido (un rol consigo mismo) no restringe nada.
 */
export function combinationAllowed(restrictions: readonly Restriction[], roles: readonly string[]) {
  const held = new Set(roles)
  return !restrictions.some(({ first, second }) => first !== second && held.has(first) && held.has(second))
}
