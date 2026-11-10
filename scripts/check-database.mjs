import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:net'

// Never connect to, reset or seed an existing database, including DATABASE_URL.
const base = resolve('.local/postgres')
mkdirSync(base, { recursive: true })
const directory = mkdtempSync(`${base}/access-`)
const data = `${directory}/data`
const listener = createServer()
await new Promise((ok, fail) => { listener.once('error', fail); listener.listen(0, '127.0.0.1', ok) })
const port = listener.address().port
await new Promise((ok, fail) => listener.close(error => error ? fail(error) : ok()))
const url = `postgresql://planlyrics_fixture@127.0.0.1:${port}/plan_lyrics_access_fixture`
// Do not inherit PostgreSQL service/credential selectors or Prisma dotenv loading.
const env = { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url }
for (const key of Object.keys(env)) if (key.startsWith('PG')) delete env[key]
function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`)
}
let started = false
try {
  run('initdb', ['-D', data, '-U', 'planlyrics_fixture', '--auth-local=trust', '--auth-host=trust', '--no-locale', '--encoding=UTF8'])
  run('pg_ctl', ['-D', data, '-l', `${directory}/postgres.log`, '-o', `-h 127.0.0.1 -p ${port} -k ''`, '-w', 'start'])
  started = true
  run('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'planlyrics_fixture', 'plan_lyrics_access_fixture'])
  run('pnpm', ['--config.verifyDepsBeforeRun=false', '--filter', '@plan-lyrics/api', 'db:migrate'])
  run('pnpm', ['--config.verifyDepsBeforeRun=false', 'check'])
  run('pnpm', ['--config.verifyDepsBeforeRun=false', '--filter', '@plan-lyrics/api', 'test:integration'])
  run('node', ['apps/api/test/built-smoke.mjs'])
  console.log('PASS: isolated PostgreSQL migration, application checks and integration tests')
} catch (error) {
  // Only our command errors are printed; never driver errors or connection strings.
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (started) {
    const stopped = spawnSync('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { env, stdio: 'inherit' })
    if (stopped.status !== 0) process.exitCode = 1
  }
}
