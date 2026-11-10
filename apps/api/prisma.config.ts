import { defineConfig } from 'prisma/config'

// Generation needs no database. Migration commands require an explicit URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
})
