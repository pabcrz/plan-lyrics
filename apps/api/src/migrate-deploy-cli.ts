import { spawnSync } from 'node:child_process'
import { checkMigrationEnvironment } from './migration-url.ts'

// Applies the committed migrations with `prisma migrate deploy` over the direct connection (DIRECT_URL) only.
// There is no path to `migrate dev` or `migrate reset`, and no dotenv file is loaded: the URL comes from the environment.
const help = 'Usage: pnpm db:migrate:deploy\nSet DIRECT_URL (non-pooled PostgreSQL connection) in the environment.\nRuns prisma migrate deploy: applies pending committed migrations, never resets or creates migrations.\nExit codes: 0 success/help, 1 migration failed, 2 invalid configuration.\n'
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
  process.stdout.write(help)
} else {
  const check = args.length ? { ok: false as const, reason: 'no arguments are accepted' } : checkMigrationEnvironment(process.env)
  if (!check.ok) {
    process.stderr.write(`Refusing to migrate: ${check.reason}.\n`)
    process.exitCode = 2
  } else {
    // prisma.config.ts reads DIRECT_URL first; DATABASE_URL (pooled) is removed so it can never be used here.
    const env: NodeJS.ProcessEnv = { ...process.env, DIRECT_URL: check.url, DATABASE_URL: undefined }
    const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env, stdio: 'inherit' })
    process.exitCode = result.status === 0 ? 0 : 1
  }
}
