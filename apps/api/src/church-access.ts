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

export const newChurchBody = z.strictObject({ name: z.string().trim().min(1).max(120), addMe: z.boolean().optional() })

/** The platform owner founds as many churches as needed; by default they also become its administrator (`addMe: false` skips it). */
export async function createChurch(db: PrismaClient, userSubject: string, name: string, addMe = true) {
  const user = await db.user.findUnique({ where: { clerkSubject: userSubject }, select: { id: true } })
  if (!user) return false
  return db.church.create({ data: { name, ...(addMe ? { memberships: { create: { userId: user.id, role: 'ADMIN' } } } : {}) }, select: { id: true, name: true } })
}

/**
 * The churches the caller belongs to, with their role there. The platform owner also gets the rest with `role: null`
 * (reachable only in support mode, never part of their own home).
 */
export async function myChurches(db: PrismaClient, subject: string) {
  const rows = await db.membership.findMany({ where: { user: { clerkSubject: subject } }, select: { role: true, church: { select: { id: true, name: true } } } })
  const mine = rows.map(row => ({ id: row.church.id, name: row.church.name, role: row.role as string | null }))
  const owner = await db.platformOwner.findFirst({ where: { user: { clerkSubject: subject } }, select: { id: true } })
  const others = owner ? (await db.church.findMany({ where: { id: { notIn: mine.map(item => item.id) } }, select: { id: true, name: true } })).map(church => ({ ...church, role: null })) : []
  return [...mine, ...others].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
