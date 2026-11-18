export type MigrationEnvironment = { ok: true; url: string } | { ok: false; reason: string }

/**
 * Migrations run only against `DIRECT_URL`, a non-pooled connection (Neon: the host without `-pooler`). The pooled
 * `DATABASE_URL` is never a fallback here. Reasons never include the value, which carries credentials.
 */
export function checkMigrationEnvironment(env: Record<string, string | undefined>): MigrationEnvironment {
  const value = env.DIRECT_URL?.trim()
  if (!value) return { ok: false, reason: 'DIRECT_URL is not set' }
  let url: URL
  try { url = new URL(value) } catch { url = new URL('invalid:') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
    return { ok: false, reason: 'DIRECT_URL is not a PostgreSQL connection URL with a database name' }
  }
  if (url.hostname.includes('-pooler') || url.port === '6432' || url.port === '6543' || url.searchParams.has('pgbouncer')) {
    return { ok: false, reason: 'DIRECT_URL points to a connection pooler; use the direct connection string' }
  }
  return { ok: true, url: value }
}
