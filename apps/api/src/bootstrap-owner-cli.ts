import { connectDatabase } from './database.ts'
import { newUserBody } from './users.ts'
import { bootstrapOwner } from './bootstrap-owner.ts'

const help = 'Usage: pnpm --filter @plan-lyrics/api db:bootstrap-owner\nSupply DATABASE_URL in the environment and one Clerk subject on stdin.\nCreates the initial owner only; refuses if an owner already exists.\nDoes not verify Clerk identity or send invitations. No dotenv files are loaded.\nExit codes: 0 success/help, 1 database failure, 2 invalid input/config, 3 owner exists.\n'
const invalid = () => {
  process.stderr.write('Invalid input or configuration. Use --help.\n')
  process.exitCode = 2
}
function validDatabaseUrl(value: string | undefined): value is string {
  try {
    const url = new URL(value ?? '')
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname && url.pathname.length > 1)
  } catch { return false }
}
async function readSubject() {
  let input = ''
  let bytes = 0
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk)
    if (bytes > 256) { process.stdin.destroy(); return undefined }
    input += chunk.toString()
  }
  const parsed = newUserBody.safeParse({ clerkSubject: input })
  return parsed.success ? parsed.data.clerkSubject : undefined
}
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(help); return }
  if (args.length || !validDatabaseUrl(process.env.DATABASE_URL)) { invalid(); return }
  let subject: string | undefined
  try { subject = await readSubject() } catch { invalid(); return }
  if (!subject) { invalid(); return }
  const db = connectDatabase(process.env.DATABASE_URL)
  try {
    if (await bootstrapOwner(db, subject)) process.stdout.write('Initial owner created.\n')
    else {
      process.stderr.write('Owner already exists. No changes made.\n')
      process.exitCode = 3
    }
  } catch {
    process.stderr.write('Owner initialization unavailable.\n')
    process.exitCode = 1
  } finally {
    await db.$disconnect().catch(() => {})
  }
}
// No dotenv loader and no raw exception output, including initialization failures.
await main().catch(() => {
  process.stderr.write('Owner initialization unavailable.\n')
  process.exitCode = 1
})
