import { Hono } from 'hono'
import type { PrismaClient } from './generated/prisma/client.ts'
import { safeErrorCode } from './errors.js'
import { nameKey } from './people-rules.js'
import { guarded } from './active-guard.js'
import { newSongBody, songSearch } from './setlist-rules.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

const songSelect = { id: true, title: true, author: true } as const

/**
 * Who edits the shared library. Producto: the platform owner and the library editors, and no other
 * access (church administrators and service editors included). Never derived from the request.
 */
export async function canEditLibrary(db: PrismaClient, subject: string) {
  const user = await db.user.findUnique({ where: { clerkSubject: subject }, select: { libraryEditor: true, ownership: { select: { id: true } } } })
  return Boolean(user && (user.libraryEditor || user.ownership))
}

export function songRoutes(config: SessionConfig, db?: PrismaClient) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/songs', '/api/songs/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  // Any member reads the shared library (it belongs to no church). Search ignores case and accents,
  // and every word must appear in the title or the author.
  routes.get('/api/songs', guarded(db, 'songs_list_failed', async (c, db) => {
    const query = songSearch.safeParse(c.req.query('q') ?? '')
    if (!query.success) return c.json({ error: 'Invalid request' }, 400)
    const words = nameKey(query.data).split(' ').filter(Boolean).slice(0, 8)
    const rows = await db.song.findMany({
      where: { AND: words.map(word => ({ OR: [{ titleKey: { contains: word } }, { authorKey: { contains: word } }] })) },
      orderBy: [{ titleKey: 'asc' }, { authorKey: 'asc' }], take: 50, select: songSelect,
    })
    return c.json(rows)
  }))

  // Only the owner and library editors create songs; church roles never grant it (the most restrictive reading,
  // because producto does not say who may add a song while preparing a setlist).
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
  return routes
}
