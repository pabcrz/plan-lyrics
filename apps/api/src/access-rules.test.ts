import { expect, test } from 'vitest'
import { canManageAccounts, canTargetAccount, inviteBody, libraryEditorBody, linkBody, memberGrantBody, memberRoleBody, planMemberChange } from './access-rules.js'

const admin = { role: 'ADMIN', isOwner: false } as const
const editor = { role: 'EDITOR', isOwner: false } as const

test('only the owner or an account manager manages accounts; nothing else counts', () => {
  expect(canManageAccounts({ owner: true, accountManager: false })).toBe(true)
  expect(canManageAccounts({ owner: false, accountManager: true })).toBe(true)
  expect(canManageAccounts({ owner: false, accountManager: false })).toBe(false)
  expect(canManageAccounts(undefined)).toBe(false)
})

test('an account manager never targets the platform owner account', () => {
  expect(canTargetAccount({ owner: false }, { isOwner: true })).toBe(false)
  expect(canTargetAccount({ owner: true }, { isOwner: true })).toBe(true)
  expect(canTargetAccount({ owner: false }, { isOwner: false })).toBe(true)
})

test('a role change keeps at least one administrator and protects the owner', () => {
  expect(planMemberChange({ ...admin, admins: 2 }, 'MEMBER')).toBe('ok')
  expect(planMemberChange({ ...admin, admins: 1 }, 'MEMBER')).toBe('last-admin')
  expect(planMemberChange({ ...admin, admins: 1 }, 'REMOVE')).toBe('last-admin')
  expect(planMemberChange({ ...admin, admins: 2 }, 'REMOVE')).toBe('ok')
  expect(planMemberChange({ ...editor, admins: 1 }, 'ADMIN')).toBe('ok')
  expect(planMemberChange({ ...editor, admins: 1 }, 'REMOVE')).toBe('ok')
  expect(planMemberChange({ ...admin, admins: 1 }, 'ADMIN')).toBe('noop')
  expect(planMemberChange({ role: 'MEMBER', isOwner: true, admins: 3 }, 'EDITOR')).toBe('protected')
  expect(planMemberChange({ role: 'ADMIN', isOwner: true, admins: 3 }, 'REMOVE')).toBe('protected')
})

test('invitation emails are trimmed, lowercased and must look like an address', () => {
  expect(inviteBody.parse({ email: '  Ana@Example.COM ' })).toEqual({ email: 'ana@example.com' })
  for (const email of ['', 'sin-arroba', 'a@b', 'a b@c.com', `${'a'.repeat(250)}@x.com`, 42]) expect(inviteBody.safeParse({ email }).success).toBe(false)
  expect(inviteBody.safeParse({ email: 'a@b.co', churchId: 'x' }).success).toBe(false)
})

test('bodies accept only their fields and the three church roles; the church never comes from the client', () => {
  expect(memberGrantBody.safeParse({ personId: 'p1', role: 'EDITOR' }).success).toBe(true)
  for (const body of [{ personId: 'p1', role: 'OWNER' }, { personId: 'p1' }, { role: 'ADMIN' }, { personId: 'p1', role: 'ADMIN', churchId: 'c2' }]) {
    expect(memberGrantBody.safeParse(body).success).toBe(false)
  }
  expect(memberRoleBody.safeParse({ role: 'MEMBER' }).success).toBe(true)
  expect(memberRoleBody.safeParse({ role: 'MEMBER', churchId: 'c2' }).success).toBe(false)
  expect(linkBody.safeParse({ personId: 'p1' }).success).toBe(true)
  expect(linkBody.safeParse({ personId: '' }).success).toBe(false)
  expect(libraryEditorBody.safeParse({ enabled: true }).success).toBe(true)
  expect(libraryEditorBody.safeParse({ enabled: 'yes' }).success).toBe(false)
})
