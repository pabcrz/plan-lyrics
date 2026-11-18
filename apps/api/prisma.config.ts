import { defineConfig } from 'prisma/config'

// Generation needs no database. Migration commands require an explicit URL: DIRECT_URL (non-pooled connection, used
// for `migrate deploy` against Neon) wins over DATABASE_URL (pooled connection used by the running app, or the local one).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL },
})
