import type { PrismaClient } from './generated/prisma/client.ts'

export function bootstrapOwner(db: PrismaClient, clerkSubject: string) {
  return db.$transaction(async tx => {
    // Serialize initialization before checking emptiness, including when no row exists.
    // The singleton SQL constraint remains the final invariant for other writers.
    await tx.$executeRaw`LOCK TABLE "PlatformOwner" IN EXCLUSIVE MODE`
    if (await tx.platformOwner.findFirst({ select: { id: true } })) return false
    const existing = await tx.user.findUnique({ where: { clerkSubject }, select: { id: true } })
    const user = existing ?? await tx.user.create({ data: { clerkSubject }, select: { id: true } })
    await tx.platformOwner.create({ data: { id: 1, userId: user.id } })
    return true
  })
}
