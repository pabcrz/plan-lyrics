import { describe, expect, test } from 'vitest'
import { findSameName, newPersonBody, nameKey, personPatch, personRolesBody } from './people-rules.js'

describe('nameKey', () => {
  test('ignores case, accents and extra spaces', () => {
    expect(nameKey('  JUAN  Pérez   Rodríguez ')).toBe(nameKey('juan perez rodriguez'))
    expect(nameKey('Sofía')).not.toBe(nameKey('Sofia Torres'))
  })
})

describe('findSameName', () => {
  const people = [{ id: 'a', name: 'Juan Pérez Rodríguez' }, { id: 'b', name: 'Ana Ramírez' }]
  test('finds an existing person regardless of case and accents', () => {
    expect(findSameName(people, 'JUAN PEREZ RODRIGUEZ')?.id).toBe('a')
  })
  test('does not match a partial name and can skip one person', () => {
    expect(findSameName(people, 'Juan Pérez')).toBeUndefined()
    expect(findSameName(people, 'ana ramirez', 'b')).toBeUndefined()
  })
})

describe('newPersonBody', () => {
  test('trims and collapses the name; phone is optional and blank means none', () => {
    expect(newPersonBody.parse({ name: '  Juan   Pérez ' })).toEqual({ name: 'Juan Pérez' })
    expect(newPersonBody.parse({ name: 'Juan Pérez', phone: ' ' })).toEqual({ name: 'Juan Pérez', phone: null })
    expect(newPersonBody.parse({ name: 'Juan Pérez', phone: '+525512345678' }).phone).toBe('+525512345678')
  })
  test('rejects an empty name, a bad phone and unknown fields such as the church', () => {
    expect(newPersonBody.safeParse({ name: ' ' }).success).toBe(false)
    for (const phone of ['abc', '5512345678', '+52 55 1234 5678', '+5255123456', '+52551234567890']) expect(newPersonBody.safeParse({ name: 'Ana', phone }).success).toBe(false)
    expect(newPersonBody.safeParse({ name: 'Ana', churchId: 'church-b' }).success).toBe(false)
    expect(newPersonBody.safeParse({ name: 'Ana', userId: 'x' }).success).toBe(false)
  })
})

describe('personPatch', () => {
  test('requires at least one personal field', () => {
    expect(personPatch.safeParse({}).success).toBe(false)
    expect(personPatch.safeParse({ phone: null }).success).toBe(true)
    expect(personPatch.safeParse({ name: 'Ana Ramírez', roles: ['x'] }).success).toBe(false)
  })
})

describe('person email', () => {
  test('is optional, lowercased, and empty means no email', () => {
    expect(newPersonBody.parse({ name: 'Ana Ramírez', email: ' Ana@Example.com ' }).email).toBe('ana@example.com')
    expect(newPersonBody.parse({ name: 'Ana Ramírez', email: '  ' }).email).toBeNull()
    expect(personPatch.parse({ email: null }).email).toBeNull()
    expect(newPersonBody.safeParse({ name: 'Ana Ramírez', email: 'no-es-correo' }).success).toBe(false)
  })
})

describe('person roles', () => {
  test('is a list of distinct role ids; empty means no roles', () => {
    expect(personRolesBody.parse({ roleIds: ['a', 'b'] }).roleIds).toEqual(['a', 'b'])
    expect(personRolesBody.parse({ roleIds: [] }).roleIds).toEqual([])
    expect(personRolesBody.safeParse({ roleIds: ['a', 'a'] }).success).toBe(false)
    expect(personRolesBody.safeParse({ roleIds: ['a'], churchId: 'x' }).success).toBe(false)
  })
})
