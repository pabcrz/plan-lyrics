import { Hono } from 'hono'
import { guarded } from './active-guard.js'
import type { PrismaClient } from './generated/prisma/client.ts'
import { todayInZone } from './service-rules.js'
import { effectiveBlocks, linkStatus, newLinkBody, reactivation, reactivationEnd, validUntil } from './share-rules.js'
import { hashToken, newNonce, secretIsUsable, tokenFor } from './share-token.js'
import { requireSession, type SessionConfig, type SessionEnvironment } from './session.js'

const day = (date: Date) => date.toISOString().slice(0, 10)
const dateValue = (value: string) => new Date(`${value}T00:00:00Z`)

const linkSelect = {
  id: true, nonce: true, version: true, fromDate: true, toDate: true, serviceId: true, showKeys: true, showNotes: true, showPeople: true,
  activeUntil: true, revokedAt: true, reactivatedAt: true, createdAt: true,
} as const
type Row = { id: string; nonce: string; version: string; fromDate: Date; toDate: Date; serviceId: string | null; showKeys: boolean; showNotes: boolean; showPeople: boolean; activeUntil: Date; revokedAt: Date | null; reactivatedAt: Date | null; createdAt: Date }

/**
 * A link as the people who manage them see it. The path (with the token) is only given while the link works:
 * a deactivated link has nothing to copy. Without the server secret there is no token to derive.
 */
function present(row: Row, secret: string | undefined, today: string) {
  const state = { revoked: row.revokedAt !== null, activeUntil: day(row.activeUntil), reactivated: row.reactivatedAt !== null }
  const status = linkStatus(state, today)
  return {
    id: row.id, version: row.version,
    scope: row.serviceId ? { kind: 'service', serviceId: row.serviceId, date: day(row.fromDate) } : { kind: 'range', from: day(row.fromDate), to: day(row.toDate) },
    blocks: { keys: row.showKeys, notes: row.showNotes, people: row.showPeople },
    status, activeUntil: state.activeUntil, reactivated: state.reactivated, canReactivate: reactivation(state, today) === 'ok',
    createdAt: row.createdAt.toISOString(),
    path: status === 'ACTIVE' && secretIsUsable(secret) ? `/m/${tokenFor(secret, row.nonce)}` : null,
  }
}

/**
 * Management of ministry links. Only whoever administers or edits services creates, revokes or reactivates them
 * (and lists them: a listing carries the working links). The church always comes from the caller's access.
 */
export function shareLinkRoutes(config: SessionConfig, db: PrismaClient | undefined, now: () => Date, secret: string | undefined) {
  const routes = new Hono<SessionEnvironment>()
  for (const path of ['/api/share-links', '/api/share-links/*']) {
    routes.use(path, requireSession(config))
    routes.use(path, async (c, next) => { await next(); c.header('Cache-Control', 'no-store') })
  }

  routes.get('/api/share-links', guarded(db, 'share_links_list_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const today = todayInZone(now())
    const rows = await db.shareLink.findMany({ where: { churchId: church.churchId }, orderBy: { createdAt: 'desc' }, take: 100, select: linkSelect })
    return c.json(rows.map(row => present(row, secret, today)))
  }))

  routes.post('/api/share-links', guarded(db, 'share_link_creation_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    if (!secretIsUsable(secret)) return c.json({ error: 'Sharing unavailable' }, 503)
    const body = newLinkBody.safeParse(await c.req.json().catch(() => undefined))
    if (!body.success) return c.json({ error: 'Invalid request' }, 400)
    const { version, scope } = body.data
    const blocks = effectiveBlocks(version, body.data.blocks)
    if (!blocks) return c.json({ error: 'Invalid request' }, 400)
    // Preaching can be switched off by the church: nothing of it can be asked for while it is.
    if (!church.usesPreaching && (version === 'PREACHING' || blocks.notes)) return c.json({ error: 'Preaching disabled' }, 409)

    // The scope is read in the caller's church only; a service of another church does not exist for them.
    let from: string, to: string, last: string | undefined, serviceId: string | null = null
    if (scope.kind === 'service') {
      const service = await db.service.findFirst({ where: { id: scope.serviceId, churchId: church.churchId, status: { not: 'CANCELLED' } }, select: { id: true, date: true } })
      if (!service) return c.json({ error: 'Not found' }, 404)
      serviceId = service.id
      from = to = last = day(service.date)
    } else {
      ;({ from, to } = scope)
      const latest = await db.service.findFirst({
        where: { churchId: church.churchId, status: { not: 'CANCELLED' }, date: { gte: dateValue(from), lte: dateValue(to) } },
        orderBy: { date: 'desc' }, select: { date: true },
      })
      last = latest ? day(latest.date) : undefined
    }
    if (!last) return c.json({ error: 'No services in scope' }, 409)
    const activeUntil = validUntil(last)
    // A link whose validity already ended would be born deactivated.
    if (activeUntil < todayInZone(now())) return c.json({ error: 'Scope in the past' }, 400)

    const nonce = newNonce()
    const created = await db.shareLink.create({
      data: {
        churchId: church.churchId, nonce, tokenHash: hashToken(tokenFor(secret, nonce)), version, fromDate: dateValue(from), toDate: dateValue(to), serviceId,
        showKeys: blocks.keys, showNotes: blocks.notes, showPeople: blocks.people, activeUntil: dateValue(activeUntil),
      },
      select: linkSelect,
    })
    return c.json(present(created, secret, todayInZone(now())), 201)
  }))

  // Both changes are one conditional statement: two people acting at once cannot both succeed.
  routes.post('/api/share-links/:id/revoke', guarded(db, 'share_link_revoke_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('id') ?? ''
    const today = todayInZone(now())
    const changed = await db.shareLink.updateMany({ where: { id, churchId: church.churchId, revokedAt: null, activeUntil: { gte: dateValue(today) } }, data: { revokedAt: now() } })
    const row = await db.shareLink.findFirst({ where: { id, churchId: church.churchId }, select: linkSelect })
    if (!row) return c.json({ error: 'Not found' }, 404)
    if (changed.count === 0) return c.json({ error: 'Link inactive' }, 409)
    return c.json(present(row, secret, today))
  }))

  routes.post('/api/share-links/:id/reactivate', guarded(db, 'share_link_reactivate_failed', async (c, db, church) => {
    if (!church.canEdit) return c.json({ error: 'Forbidden' }, 403)
    const id = c.req.param('id') ?? ''
    const today = todayInZone(now())
    const changed = await db.shareLink.updateMany({
      where: { id, churchId: church.churchId, reactivatedAt: null, OR: [{ revokedAt: { not: null } }, { activeUntil: { lt: dateValue(today) } }] },
      data: { revokedAt: null, reactivatedAt: now(), activeUntil: dateValue(reactivationEnd(today)) },
    })
    const row = await db.shareLink.findFirst({ where: { id, churchId: church.churchId }, select: linkSelect })
    if (!row) return c.json({ error: 'Not found' }, 404)
    if (changed.count === 0) {
      const why = reactivation({ revoked: row.revokedAt !== null, activeUntil: day(row.activeUntil), reactivated: row.reactivatedAt !== null }, today)
      return c.json({ error: why === 'used' ? 'Reactivation used' : 'Link active' }, 409)
    }
    return c.json(present(row, secret, today))
  }))
  return routes
}
