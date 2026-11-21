import { Hono, type Context } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { lyricsBody } from './lyrics-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

const lyricsSelect = { version: true, published: true, sections: { orderBy: { position: 'asc' }, select: { kind: true, label: true, text: true, repeat: true } } } as const

/**
 * What the caller may do with the shared library: the owner and the library editors write; whoever belongs to at
 * least one church reads (lyrics are internal data of the ministry). An account with neither sees no library.
 */
async function libraryAccess(db: PrismaClient, subject: string) {
  const user = await db.user.findUnique({ where: { clerkSubject: subject }, select: { libraryEditor: true, ownership: { select: { id: true } }, _count: { select: { memberships: true } } } })
  if (!user) return { read: false, write: false }
  const write = user.libraryEditor || Boolean(user.ownership)
  return { read: write || user._count.memberships > 0, write }
}

/** The lyrics of a song as the client sees it; a song without lyrics answers an empty, unpublished version 0. */
async function readLyrics(db: Pick<PrismaClient, 'song'>, songId: string, canEdit: boolean) {
  const song = await db.song.findUnique({ where: { id: songId }, select: { title: true, lyrics: { select: lyricsSelect } } })
  if (!song) return null
  return { title: song.title, version: song.lyrics?.version ?? 0, published: song.lyrics?.published ?? false, canEdit, sections: song.lyrics?.sections ?? [] }
}

/**
 * Replaces the whole lyrics under the row lock of its song's lyrics, comparing the version the client read. A lyrics
 * that does not exist yet is version 0; two creations at once end with one winner (the unique song id).
 */
async function replace(tx: Tx, songId: string, body: { version: number; published?: boolean; sections: Array<{ kind: 'INTRO' | 'VERSE' | 'CHORUS' | 'BRIDGE' | 'OUTRO' | 'CLOSING'; label: string | null; text: string; repeat: number }> }) {
  if (!await tx.song.findUnique({ where: { id: songId }, select: { id: true } })) return { result: 'missing' as const }
  const [current] = await tx.$queryRaw<Array<{ id: string; version: number }>>`SELECT id, version FROM "SongLyrics" WHERE "songId" = ${songId} FOR UPDATE`
  if ((current?.version ?? 0) !== body.version) return { result: 'stale' as const, version: current?.version ?? 0 }
  const rows = body.sections.map((section, position) => ({ ...section, position }))
  if (!current) {
    await tx.songLyrics.create({ data: { songId, published: body.published ?? false, sections: { create: rows } }, select: { id: true } })
  } else {
    await tx.lyricsSection.deleteMany({ where: { lyricsId: current.id } })
    await tx.songLyrics.update({
      where: { id: current.id }, select: { id: true },
      data: { version: { increment: 1 }, ...(body.published === undefined ? {} : { published: body.published }), sections: { create: rows } },
    })
  }
  return { result: 'ok' as const }
}

export function lyricsRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  const path = '/api/songs/:songId/lyrics'
  routes.use(path, requireSession(config))
  routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })

  const guard = (event: string, handler: (c: Context<SessionEnvironment>, db: PrismaClient, access: { read: boolean; write: boolean }) => Promise<Response>) =>
    async (c: Context<SessionEnvironment>) => {
      if (!db) return c.json({ error: 'Access unavailable' }, 503)
      try {
        return await handler(c, db, await libraryAccess(db, c.get('clerkSubject')))
      } catch (error) {
        console.error(JSON.stringify({ event, code: safeErrorCode(error) }))
        return c.json({ error: 'Access unavailable' }, 503)
      }
    }

  routes.get(path, guard('lyrics_read_failed', async (c, db, access) => {
    if (!access.read) return c.json({ error: 'Forbidden' }, 403)
    const lyrics = await readLyrics(db, c.req.param('songId')!, access.write)
    return lyrics ? c.json(lyrics) : c.json({ error: 'Not found' }, 404)
  }))

  // Refused before anything else is looked at: a caller who may not edit learns nothing about the song or the body.
  routes.put(path, guard('lyrics_write_failed', async (c, db, access) => {
    if (!access.write) return c.json({ error: 'Forbidden' }, 403)
    const songId = c.req.param('songId')!
    const body = lyricsBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const outcome = await db.$transaction(tx => replace(tx, songId, body.data)).catch(error => {
      if (safeErrorCode(error) !== 'P2002') throw error
      return { result: 'stale' as const, version: undefined }
    })
    if (outcome.result === 'missing') return c.json({ error: 'Not found' }, 404)
    if (outcome.result === 'stale') {
      const version = outcome.version ?? (await db.songLyrics.findUnique({ where: { songId }, select: { version: true } }))?.version ?? 0
      return c.json({ error: 'Lyrics changed', version }, 409)
    }
    return c.json(await readLyrics(db, songId, true))
  }))
  return routes
}
