import { expect, test } from 'vitest'
import { checkMigrationEnvironment } from './migration-url.js'

const direct = 'postgresql://user:pass@ep-quiet-cell-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const pooled = 'postgresql://user:pass@ep-quiet-cell-123456-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'

test('accepts a direct PostgreSQL URL', () => {
  expect(checkMigrationEnvironment({ DIRECT_URL: direct })).toEqual({ ok: true, url: direct })
})

test('requires DIRECT_URL and never falls back to the pooled DATABASE_URL', () => {
  expect(checkMigrationEnvironment({ DATABASE_URL: pooled })).toEqual({ ok: false, reason: 'DIRECT_URL is not set' })
  expect(checkMigrationEnvironment({ DIRECT_URL: '  ', DATABASE_URL: direct })).toEqual({ ok: false, reason: 'DIRECT_URL is not set' })
})

test('refuses pooled connections', () => {
  expect(checkMigrationEnvironment({ DIRECT_URL: pooled })).toEqual({ ok: false, reason: 'DIRECT_URL points to a connection pooler; use the direct connection string' })
  expect(checkMigrationEnvironment({ DIRECT_URL: 'postgresql://u:p@db.example.com:6432/app' }).ok).toBe(false)
  expect(checkMigrationEnvironment({ DIRECT_URL: 'postgresql://u:p@db.example.com/app?pgbouncer=true' }).ok).toBe(false)
})

test('refuses values that are not a PostgreSQL URL with a database name, without echoing them', () => {
  for (const value of ['not a url', 'mysql://u:p@h/db', 'postgresql://u:p@h']) {
    const result = checkMigrationEnvironment({ DIRECT_URL: value })
    expect(result).toEqual({ ok: false, reason: 'DIRECT_URL is not a PostgreSQL connection URL with a database name' })
  }
})
