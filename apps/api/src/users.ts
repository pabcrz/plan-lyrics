import { z } from 'zod'
import type { PrismaClient } from './generated/prisma/client.ts'

export const newUserBody = z.strictObject({
  clerkSubject: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
})
export const accountManagerBody = z.strictObject({ enabled: z.boolean() })

export async function userCapability(db: PrismaClient, subject: string) {
  // Read current database state, never token claims. No church role implies this capability.
  const rows = await db.$queryRaw<Array<{ owner: boolean; accountManager: boolean }>>`
    SELECT u."accountManager", EXISTS (
      SELECT 1 FROM "PlatformOwner" o WHERE o.id = 1 AND o."userId" = u.id
    ) AS owner FROM "User" u WHERE u."clerkSubject" = ${subject}
  `
  return rows[0]
}

export function createUser(db: PrismaClient, clerkSubject: string) {
  // Reuse Prisma's ID and capability defaults; never provision related access rows.
  // The unique constraint (not a preflight lookup) arbitrates concurrent duplicates.
  return db.user.create({ data: { clerkSubject }, select: { id: true } })
}

export async function setAccountManager(db: PrismaClient, id: string, enabled: boolean) {
  // Exclude ownership in the write itself; preserve every other field and relation.
  const rows = await db.user.updateManyAndReturn({
    where: { id, ownership: { is: null } },
    data: { accountManager: enabled },
    select: { id: true, accountManager: true },
  })
  return rows[0]
}
