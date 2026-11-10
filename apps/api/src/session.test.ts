import { createSign, generateKeyPairSync } from 'node:crypto'
import { expect, test } from 'vitest'
import { createApp } from './app.js'
import { authorizedPartyWarning } from './session.js'

// Generated only in memory; no real Clerk keys or tokens are used or stored.
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const issuer = 'https://clerk.fixture.test'
const origin = 'http://127.0.0.1:5173'
const api = createApp({ jwtKey: publicKey, issuer })

function token(overrides: Record<string, unknown> = {}, privateKey = keys.privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: 'fixture-key' }
  const claims = { sub: 'user_fixture', sid: 'sess_fixture', iss: issuer, azp: origin,
    iat: now, nbf: now - 10, exp: now + 120, ...overrides }
  const input = [header, claims].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')
  return `${input}.${createSign('RSA-SHA256').update(input).sign(privateKey).toString('base64url')}`
}

async function request(header?: string, target = api) {
  return target.request('/api/session', { headers: header === undefined ? {} : { Authorization: header } })
}

async function unauthorized(response: Response) {
  expect(response.status).toBe(401)
  expect(response.headers.get('www-authenticate')).toBe('Bearer')
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'Unauthorized' })
}

test.each([undefined, '', 'Basic ignored', 'Bearer not-a-jwt'])('rejects missing/malformed credentials: %s', async header => {
  await unauthorized(await request(header))
})

test('accepts only verified session identity without returning claims or personal data', async () => {
  const response = await request(`Bearer ${token()}`)
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ authenticated: true })
})

test.each([
  { exp: 1 }, { nbf: 4102444800 }, { iss: 'https://other.fixture.test' },
  { azp: 'http://attacker.example' }, { azp: undefined }, { sid: undefined }, { sub: '' },
])('rejects expired/future/wrong-instance/wrong-origin/non-session tokens: %j', async claims => {
  await unauthorized(await request(`Bearer ${token(claims)}`))
})

test('rejects tokens signed by an unrelated instance key', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
  await unauthorized(await request(`Bearer ${token({}, other.privateKey)}`))
})

test('missing verifier configuration fails closed without falling back to network verification', async () => {
  const unconfigured = createApp()
  await unauthorized(await request(undefined, unconfigured))
  const response = await request(`Bearer ${token()}`, unconfigured)
  expect(response.status).toBe(503)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({ error: 'Authentication unavailable' })
  const health = await unconfigured.request('/api/health')
  expect(health.status).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok', service: 'plan-lyrics-api' })
})

test('accepts only the configured authorized party when one is set', async () => {
  const deployed = 'https://app.fixture.test'
  const custom = createApp({ jwtKey: publicKey, issuer, authorizedParty: deployed })
  const accepted = await request(`Bearer ${token({ azp: deployed })}`, custom)
  expect(accepted.status).toBe(200)
  expect(await accepted.json()).toEqual({ authenticated: true })
  await unauthorized(await request(`Bearer ${token()}`, custom))
})

test.each(['*', 'https://app.fixture.test/', 'https://app.fixture.test/path', 'not a url'])(
  'fails closed when the authorized party is not an exact origin: %s', async authorizedParty => {
    const invalid = createApp({ jwtKey: publicKey, issuer, authorizedParty })
    const response = await request(`Bearer ${token({ azp: authorizedParty })}`, invalid)
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Authentication unavailable' })
  })

test.each([
  [undefined, 'CLERK_AUTHORIZED_PARTY is not set: accepting only the local origin http://127.0.0.1:5173'],
  ['  ', 'CLERK_AUTHORIZED_PARTY is not set: accepting only the local origin http://127.0.0.1:5173'],
  ['https://app.fixture.test/', 'CLERK_AUTHORIZED_PARTY is not an exact origin: authenticated routes respond 503'],
  ['https://app.fixture.test', undefined],
])('warns at startup about the authorized party configuration: %j', (value, warning) => {
  expect(authorizedPartyWarning(value)).toBe(warning)
})
