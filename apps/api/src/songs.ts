import { Hono } from 'hono'
import type { Prisma, PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { nameKey } from './people-rules.js'
import { guarded } from './active-guard.js'
import { todayInZone } from './service-rules.js'
import { newSongBody, songListQuery } from './setlist-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

const songSelect = { id: true, title: true, author: true } as const
/** Songs per page of the library list; a full page means there may be more (`offset`). */
const PAGE_SIZE = 50

/**
 * Who edits the shared library: the platform owner, the library editors and, by the product owner's decision, whoever
 * administers or edits services in a church. A plain member never does. Never derived from the request.
 */
export async function canEditLibrary(db: PrismaClient, subject: string) {
  const user = await db.user.findUnique({ where: { clerkSubject: subject }, select: { libraryEditor: true, ownership: { select: { id: true } }, memberships: { select: { role: true } } } })
  return Boolean(user && (user.libraryEditor || user.ownership || user.memberships.some(({ role }) => role === 'ADMIN' || role === 'EDITOR')))
}

export function songRoutes(config: SessionConfig, db?: PrismaClient, now: () => Date = () => new Date()) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/songs', '/api/songs/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  // Any member reads the shared library (it belongs to no church). Search ignores case and accents,
  // and every word must appear in the title or the author.
  routes.get('/api/songs', guarded(db, 'songs_list_failed', async (c, db, church) => {
    const query = songListQuery.safeParse({ q: c.req.query('q') ?? '', filter: c.req.query('filter'), offset: c.req.query('offset') })
    if (!query.success) return c.json({ error: 'Invalid request' }, 400)
    const words = nameKey(query.data.q).split(' ').filter(Boolean).slice(0, 8)
    // «Sin letra»: no lyrics or none with a section; «Sin acordes»: no section carries chords (a song without lyrics has none).
    const missing: Record<'no-lyrics' | 'no-chords', Prisma.SongWhereInput> = {
      'no-lyrics': { OR: [{ lyrics: { is: null } }, { lyrics: { is: { sections: { none: {} } } } }] },
      'no-chords': { OR: [{ lyrics: { is: null } }, { lyrics: { is: { sections: { none: { chordPro: { not: null } } } } } }] },
    }
    const rows = await db.song.findMany({
      where: { AND: [...words.map(word => ({ OR: [{ titleKey: { contains: word } }, { authorKey: { contains: word } }] })), ...(query.data.filter ? [missing[query.data.filter]] : [])] },
      orderBy: [{ titleKey: 'asc' }, { authorKey: 'asc' }], skip: query.data.offset, take: PAGE_SIZE,
      select: { ...songSelect, lyrics: { select: { _count: { select: { sections: true } }, sections: { where: { chordPro: { not: null } }, select: { id: true }, take: 1 } } } },
    })
    // Use is by the date of the service, not the hour: a song sung on Sunday counts from that Sunday on. Only this church's
    // services that are not cancelled count; `lastUsed` is the latest date up to today and `nextUse` the earliest one after it.
    const today = todayInZone(now())
    const used = rows.length === 0 ? [] : await db.setlistEntry.findMany({
      where: { songId: { in: rows.map(row => row.id) }, service: { churchId: church.churchId, status: { not: 'CANCELLED' } } },
      select: { songId: true, service: { select: { date: true } } },
    })
    const usage = new Map<string, { lastUsed: string | null; nextUse: string | null }>()
    for (const { songId, service } of used) {
      const date = service.date.toISOString().slice(0, 10)
      const entry = usage.get(songId!) ?? { lastUsed: null, nextUse: null }
      if (date <= today) { if (!entry.lastUsed || date > entry.lastUsed) entry.lastUsed = date } else if (!entry.nextUse || date < entry.nextUse) entry.nextUse = date
      usage.set(songId!, entry)
    }
    return c.json(rows.map(({ lyrics, ...song }) => ({ ...song, hasLyrics: (lyrics?._count.sections ?? 0) > 0, hasChords: (lyrics?.sections.length ?? 0) > 0, ...(usage.get(song.id) ?? { lastUsed: null, nextUse: null }) })))
  }))

  // Lets the library screen show «Nueva» only to who can create songs (the POST below still decides).
  routes.get('/api/songs/access', guarded(db, 'songs_access_failed', async (c, db) => c.json({ canCreate: await canEditLibrary(db, c.get('clerkSubject')) })))

  // Whoever may edit the library creates songs (see canEditLibrary).
  routes.post('/api/songs', guarded(db, 'song_creation_failed', async (c, db) => {
    if (!await canEditLibrary(db, c.get('clerkSubject'))) return c.json({ error: 'Forbidden' }, 403)
    const body = newSongBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const keys = { titleKey: nameKey(body.data.title), authorKey: nameKey(body.data.author) }
    const existing = () => db.song.findUnique({ where: { titleKey_authorKey: keys }, select: songSelect })
    const found = await existing()
    if (found) return c.json({ error: 'Song exists', existing: found }, 409)
    try {
      return c.json(await db.song.create({ data: { ...body.data, ...keys }, select: songSelect }), 201)
    } catch (error) {
      if (safeErrorCode(error) !== 'P2002') throw error
      return c.json({ error: 'Song exists', existing: await existing() }, 409)
    }
  }))

  // Same permission as creating. Changing title/author keeps the id, so setlists and lyrics follow the song.
  routes.patch('/api/songs/:songId', guarded(db, 'song_update_failed', async (c, db) => {
    if (!await canEditLibrary(db, c.get('clerkSubject'))) return c.json({ error: 'Forbidden' }, 403)
    const body = newSongBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const id = c.req.param('songId')
    const keys = { titleKey: nameKey(body.data.title), authorKey: nameKey(body.data.author) }
    const clash = async () => db.song.findUnique({ where: { titleKey_authorKey: keys }, select: songSelect })
    const other = await clash()
    if (other && other.id !== id) return c.json({ error: 'Song exists', existing: other }, 409)
    try {
      return c.json(await db.song.update({ where: { id }, data: { ...body.data, ...keys }, select: songSelect }))
    } catch (error) {
      const code = safeErrorCode(error)
      if (code === 'P2025') return c.json({ error: 'Not found' }, 404)
      if (code !== 'P2002') throw error
      return c.json({ error: 'Song exists', existing: await clash() }, 409)
    }
  }))

  // A song with lyrics or in any setlist is never deleted (the database restricts both): only one created by mistake goes.
  routes.delete('/api/songs/:songId', guarded(db, 'song_deletion_failed', async (c, db) => {
    if (!await canEditLibrary(db, c.get('clerkSubject'))) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('songId')
    try {
      await db.song.delete({ where: { id } })
      return c.body(null, 204)
    } catch (error) {
      const code = safeErrorCode(error)
      if (code === 'P2025') return c.json({ error: 'Not found' }, 404)
      if (code === 'P2003') return c.json({ error: 'Song in use' }, 409)
      throw error
    }
  }))
  return routes
}
