import { z } from 'zod'
import type { PrismaClient } from './generated/prisma/client.ts'

export async function readChurch(db: PrismaClient, subject: string, id: string) {
  // One parameterized statement checks current access and projects only public DTO fields.
  // Library editing is deliberately absent: it never grants church access.
  const rows = await db.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT c.id, c.name FROM "Church" c
    WHERE c.id = ${id} AND EXISTS (
      SELECT 1 FROM "User" u WHERE u."clerkSubject" = ${subject} AND (
        EXISTS (SELECT 1 FROM "PlatformOwner" o WHERE o."userId" = u.id AND o.id = 1)
        OR EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u.id AND m."churchId" = c.id)
      )
    )
  `
  return rows[0]
}

export const newChurchBody = z.strictObject({ name: z.string().trim().min(1).max(120) })

/**
 * The platform owner founds a church and becomes its administrator. The active church is the caller's only
 * membership, so an owner who already belongs to one gets `false` instead of a second church.
 */
export async function createChurch(db: PrismaClient, userSubject: string, name: string) {
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { clerkSubject: userSubject }, select: { id: true, memberships: { select: { churchId: true } } } })
    if (!user || user.memberships.length > 0) return false
    return tx.church.create({ data: { name, memberships: { create: { userId: user.id, role: 'ADMIN' } } }, select: { id: true, name: true } })
  })
}

/** The churches the caller belongs to, with their role there: what the client offers when choosing the active one. */
export async function myChurches(db: PrismaClient, subject: string) {
  const rows = await db.membership.findMany({ where: { user: { clerkSubject: subject } }, select: { role: true, church: { select: { id: true, name: true } } } })
  return rows.map(row => ({ id: row.church.id, name: row.church.name, role: row.role })).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
