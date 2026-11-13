import { expect, test } from 'vitest'
import { DEFAULT_ROLES, DIRECTOR_KEY, combinationAllowed, newRestrictionBody, newRoleBody, roleNameTaken, sameRestriction, sortedPair } from './role-rules.js'

const defaults = [{ first: DIRECTOR_KEY, second: 'drums' }]

test('the default catalog is alphabetical and leaves Dirigir out', () => {
  expect([...DEFAULT_ROLES]).toEqual(['Batería', 'Guitarra', 'Piano', 'Voces'])
  expect([...DEFAULT_ROLES].sort((a, b) => a.localeCompare(b, 'es'))).toEqual([...DEFAULT_ROLES])
})

test('a role name is trimmed and spaces collapse; empty and over-long names are refused', () => {
  expect(newRoleBody.parse({ name: '  Coro   de   niños ' }).name).toBe('Coro de niños')
  expect(newRoleBody.safeParse({ name: '   ' }).success).toBe(false)
  expect(newRoleBody.safeParse({ name: 'x'.repeat(41) }).success).toBe(false)
  expect(newRoleBody.safeParse({ name: 'Bajo', churchId: 'otra' }).success).toBe(false)
})

test('names collide ignoring case and accents, and Dirigir is reserved', () => {
  expect(roleNameTaken(['Batería', 'Voces'], ' BATERIA ')).toBe(true)
  expect(roleNameTaken(['Batería'], 'bateria  ')).toBe(true)
  expect(roleNameTaken(['Batería'], 'Bajo')).toBe(false)
  expect(roleNameTaken([], 'dirigir')).toBe(true)
})

test('a pair has no order: (a, b) and (b, a) are the same restriction', () => {
  expect(sortedPair('b', 'a')).toEqual({ first: 'a', second: 'b' })
  expect(sortedPair('a', 'b')).toEqual({ first: 'a', second: 'b' })
  expect(sameRestriction({ first: 'x', second: 'y' }, { first: 'y', second: 'x' })).toBe(true)
  expect(sameRestriction({ first: 'x', second: 'y' }, { first: 'x', second: 'z' })).toBe(false)
})

test('the restriction body takes exactly two role keys and no church', () => {
  expect(newRestrictionBody.safeParse({ first: 'a', second: 'b' }).success).toBe(true)
  expect(newRestrictionBody.safeParse({ first: 'a' }).success).toBe(false)
  expect(newRestrictionBody.safeParse({ first: 'a', second: 'b', churchId: 'x' }).success).toBe(false)
})

test('combinationAllowed refuses a person holding both roles of any restricted pair', () => {
  expect(combinationAllowed(defaults, [DIRECTOR_KEY, 'drums'])).toBe(false)
  expect(combinationAllowed(defaults, ['drums', DIRECTOR_KEY])).toBe(false)
  expect(combinationAllowed(defaults, [DIRECTOR_KEY, 'guitar'])).toBe(true)
  expect(combinationAllowed(defaults, ['drums', 'guitar'])).toBe(true)
  expect(combinationAllowed(defaults, ['guitar', 'voices', DIRECTOR_KEY, 'drums'])).toBe(false)
})

test('combinationAllowed allows everything without restrictions and a single role always', () => {
  expect(combinationAllowed([], [DIRECTOR_KEY, 'drums', 'guitar'])).toBe(true)
  expect(combinationAllowed(defaults, ['drums'])).toBe(true)
  expect(combinationAllowed(defaults, [])).toBe(true)
})

test('combinationAllowed ignores a repeated role and a role paired with itself', () => {
  expect(combinationAllowed(defaults, ['drums', 'drums'])).toBe(true)
  expect(combinationAllowed([{ first: 'a', second: 'a' }], ['a'])).toBe(true)
  expect(combinationAllowed([{ first: 'a', second: 'b' }, { first: 'b', second: 'c' }], ['a', 'c'])).toBe(true)
  expect(combinationAllowed([{ first: 'a', second: 'b' }, { first: 'b', second: 'c' }], ['c', 'b'])).toBe(false)
})
