import { spawn } from 'node:child_process'
import { afterAll, beforeEach, expect, test } from 'vitest'
import { connectDatabase } from '../src/database.ts'
import { seedFixtures } from './fixtures.ts'

const url = process.env.TEST_DATABASE_URL
if (!url || !/^postgresql:\/\/planlyrics_fixture@127\.0\.0\.1:\d+\/plan_lyrics_access_fixture$/.test(url)) throw new Error('Use pnpm test:db')
const db = connectDatabase(url)
const help = 'Usage: pnpm --filter @plan-lyrics/api db:bootstrap-owner\nSupply DATABASE_URL in the environment and one Clerk subject on stdin.\nCreates the initial owner only; refuses if an owner already exists.\nDoes not verify Clerk identity or send invitations. No dotenv files are loaded.\nExit codes: 0 success/help, 1 database failure, 2 invalid input/config, 3 owner exists.\n'
function command(input = '', database: string | null = url!, args: string[] = [], launcher: 'compiled' | 'tsx' | 'pnpm' = 'compiled') {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    if (database !== null) env.DATABASE_URL = database
    const executable = launcher === 'pnpm' ? 'pnpm' : process.execPath
    const entry = launcher === 'compiled' ? ['dist/bootstrap-owner-cli.js']
      : launcher === 'tsx' ? ['node_modules/tsx/dist/cli.mjs', 'src/bootstrap-owner-cli.ts']
      : ['--config.verifyDepsBeforeRun=false', '--filter', '@plan-lyrics/api', 'db:bootstrap-owner']
    const child = spawn(executable, [...entry, ...args], { env, stdio: 'pipe' })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => resolve({ code, stdout, stderr }))
    child.stdin.on('error', () => {}) // Early --help/input rejection may close stdin first.
    child.stdin.end(input)
  })
}
async function snapshot() {
  return Promise.all([
    db.user.findMany({ orderBy: { id: 'asc' } }), db.platformOwner.findMany(),
    db.membership.findMany({ orderBy: [{ userId: 'asc' }, { churchId: 'asc' }] }),
    db.person.findMany({ orderBy: { id: 'asc' } }), db.churchPerson.findMany(), db.church.findMany(),
  ])
}
async function cleanup() {
  await db.platformOwner.deleteMany()
  await db.user.deleteMany({ where: { clerkSubject: { startsWith: 'bootstrap-' } } })
  await seedFixtures(db)
}
beforeEach(async () => { await cleanup(); await db.platformOwner.deleteMany() })
afterAll(async () => { await cleanup(); await db.$disconnect() })

test('help is exact and needs no database; unknown arguments are rejected', async () => {
  const before = await snapshot()
  expect(await command('', null, ['--help'])).toEqual({ code: 0, stdout: help, stderr: '' })
  expect(await command('', null, ['--unsafe'])).toEqual({ code: 2, stdout: '', stderr: 'Invalid input or configuration. Use --help.\n' })
  expect(await snapshot()).toEqual(before)
})

test.each(['', ' ', 'bad subject', 'é', 'a'.repeat(129), 'x'.repeat(300), 'one\ntwo'])('invalid stdin is rejected before database use (%#)', async input => {
  const before = await snapshot()
  expect(await command(input)).toEqual({ code: 2, stdout: '', stderr: 'Invalid input or configuration. Use --help.\n' })
  expect(await snapshot()).toEqual(before)
})

test.each([null, '', 'not-a-url', 'https://example.invalid/db'])('missing/invalid database configuration changes nothing (%#)', async database => {
  const before = await snapshot()
  const result = await command('bootstrap-new', database)
  expect(result).toEqual({ code: 2, stdout: '', stderr: 'Invalid input or configuration. Use --help.\n' })
  expect(await snapshot()).toEqual(before)
})

test('unavailable database returns only a safe error', async () => {
  const before = await snapshot()
  expect(await command('bootstrap-secret-subject', url!.replace('/plan_lyrics_access_fixture', '/missing_bootstrap_fixture'))).toEqual({ code: 1, stdout: '', stderr: 'Owner initialization unavailable.\n' })
  expect(await snapshot()).toEqual(before)
})

test('creates a single owner atomically without implicit memberships or capabilities', async () => {
  const before = await snapshot()
  expect(await command(' bootstrap-new\n')).toEqual({ code: 0, stdout: 'Initial owner created.\n', stderr: '' })
  const user = await db.user.findUniqueOrThrow({ where: { clerkSubject: 'bootstrap-new' } })
  expect(user.libraryEditor).toBe(false)
  expect(user.accountManager).toBe(false)
  expect(await db.platformOwner.findMany()).toEqual([expect.objectContaining({ id: 1, userId: user.id })])
  expect((await snapshot()).slice(2)).toEqual(before.slice(2))
  const initialized = await snapshot()
  for (const subject of ['bootstrap-new', 'bootstrap-another']) {
    expect(await command(subject)).toEqual({ code: 3, stdout: '', stderr: 'Owner already exists. No changes made.\n' })
    expect(await snapshot()).toEqual(initialized)
  }
})

test('accepts the 128-character subject boundary', async () => {
  const subject = 'bootstrap-' + 'a'.repeat(118)
  expect(subject).toHaveLength(128)
  expect(await command(subject)).toEqual({ code: 0, stdout: 'Initial owner created.\n', stderr: '' })
  expect(await db.user.count({ where: { clerkSubject: subject } })).toBe(1)
})

test('uses an existing subject without changing its capabilities, timestamps or relations', async () => {
  const before = await snapshot()
  expect(await command('fixture-combined')).toEqual({ code: 0, stdout: 'Initial owner created.\n', stderr: '' })
  const after = await snapshot()
  expect(after[0]).toEqual(before[0])
  expect(after.slice(2)).toEqual(before.slice(2))
  expect(after[1]).toEqual([expect.objectContaining({ id: 1, userId: 'combined' })])
})

test('source entry and documented pnpm launcher expose help without database access', async () => {
  const before = await snapshot()
  expect(await command('', null, ['--help'], 'tsx')).toEqual({ code: 0, stdout: help, stderr: '' })
  const launched = await command('', null, ['--help'], 'pnpm')
  expect(launched.code).toBe(0)
  // pnpm emits its script banner on stderr; it is not an application error.
  expect(launched.stderr).toBe('$ tsx src/bootstrap-owner-cli.ts --help\n')
  // The CLI help itself must remain byte-exact.
  expect(launched.stdout.endsWith(help)).toBe(true)
  expect(launched.stdout).not.toMatch(/Already up to date|install|download/i)
  expect(await snapshot()).toEqual(before)
})

test('failed owner insertion rolls back a new user and preserves existing users', async () => {
  const before = await snapshot()
  // Failure injection is restricted to the guarded disposable fixture database.
  await db.$executeRaw`ALTER TABLE "PlatformOwner" ADD CONSTRAINT bootstrap_forced_failure CHECK (false)`
  try {
    for (const subject of ['bootstrap-rollback-secret', 'fixture-combined']) {
      expect(await command(subject)).toEqual({ code: 1, stdout: '', stderr: 'Owner initialization unavailable.\n' })
      expect(await snapshot()).toEqual(before)
    }
  } finally {
    await db.$executeRaw`ALTER TABLE "PlatformOwner" DROP CONSTRAINT bootstrap_forced_failure`
  }
})

test('existing and new subjects racing preserve all unrelated data and leave no loser user', async () => {
  const before = await snapshot()
  const results = await Promise.all(['fixture-combined', 'bootstrap-mixed-race'].map(subject => command(subject)))
  expect(results.filter(result => result.code === 0)).toEqual([{ code: 0, stdout: 'Initial owner created.\n', stderr: '' }])
  expect(results.filter(result => result.code === 3)).toEqual([{ code: 3, stdout: '', stderr: 'Owner already exists. No changes made.\n' }])
  const after = await snapshot()
  const newUser = await db.user.findUnique({ where: { clerkSubject: 'bootstrap-mixed-race' } })
  expect(Boolean(newUser)).toBe(results[1]!.code === 0)
  expect(after[0].filter(user => user.clerkSubject !== 'bootstrap-mixed-race')).toEqual(before[0])
  expect(after.slice(2)).toEqual(before.slice(2))
  expect(after[1]).toEqual([expect.objectContaining({ id: 1, userId: results[0]!.code === 0 ? 'combined' : newUser!.id })])
})

test('concurrent initializations leave one owner and no orphan new users', async () => {
  const results = await Promise.all(['bootstrap-race-a', 'bootstrap-race-b'].map(subject => command(subject)))
  expect(results.filter(result => result.code === 0)).toEqual([{ code: 0, stdout: 'Initial owner created.\n', stderr: '' }])
  expect(results.filter(result => result.code === 3)).toEqual([{ code: 3, stdout: '', stderr: 'Owner already exists. No changes made.\n' }])
  const created = await db.user.findMany({ where: { clerkSubject: { startsWith: 'bootstrap-race-' } } })
  expect(created).toHaveLength(1)
  expect(await db.platformOwner.findMany()).toEqual([expect.objectContaining({ id: 1, userId: created[0]!.id })])
})
