import { createSign, generateKeyPairSync } from 'node:crypto'

export function sessionFixture() {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const config = { jwtKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(), issuer: 'https://clerk.fixture.test' }
  return { config, token(sub, overrides = {}) {
    const now = Math.floor(Date.now() / 1000)
    const claims = { sub, sid: 'fixture-session', iss: config.issuer, azp: 'http://127.0.0.1:5173', iat: now, nbf: now - 10, exp: now + 120, ...overrides }
    const input = [{ alg: 'RS256', typ: 'JWT', kid: 'fixture-key' }, claims].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')
    return `${input}.${createSign('RSA-SHA256').update(input).sign(keys.privateKey).toString('base64url')}`
  } }
}
