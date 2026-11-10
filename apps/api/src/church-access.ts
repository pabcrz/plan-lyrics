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
