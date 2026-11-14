import { z } from 'zod'

export const CHURCH_ROLES = ['ADMIN', 'EDITOR', 'MEMBER'] as const
export type MemberRole = (typeof CHURCH_ROLES)[number]

const id = z.string().min(1).max(64)
const email = z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)

// Nothing here carries a church: the church always comes from the caller's session.
export const inviteBody = z.strictObject({ email })
export const memberGrantBody = z.strictObject({ personId: id, role: z.enum(CHURCH_ROLES) })
export const memberRoleBody = z.strictObject({ role: z.enum(CHURCH_ROLES) })
export const linkBody = z.strictObject({ personId: id })
export const libraryEditorBody = z.strictObject({ enabled: z.boolean() })

/** Global account management: the platform owner and the account managers the owner designated. */
export function canManageAccounts(capability: { owner: boolean; accountManager: boolean } | undefined) {
  return Boolean(capability?.owner || capability?.accountManager)
}

/** An account manager never touches the platform owner's account. */
export function canTargetAccount(caller: { owner: boolean }, target: { isOwner: boolean }) {
  return caller.owner || !target.isOwner
}

export type MemberChange = 'ok' | 'noop' | 'protected' | 'last-admin'

/**
 * What changing or removing one membership would do. `admins` counts the church's current administrators,
 * read under the church lock. The platform owner's membership is never changed from a church screen.
 */
export function planMemberChange(target: { role: MemberRole; isOwner: boolean; admins: number }, next: MemberRole | 'REMOVE'): MemberChange {
  if (target.isOwner) return 'protected'
  if (next === target.role) return 'noop'
  if (target.role === 'ADMIN' && target.admins <= 1) return 'last-admin'
  return 'ok'
}
