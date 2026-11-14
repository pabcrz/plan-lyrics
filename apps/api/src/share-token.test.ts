import { describe, expect, test } from 'vitest'
import { hashToken, isTokenShape, newNonce, secretIsUsable, tokenFor } from './share-token.js'

const secret = 'x'.repeat(40)

describe('share tokens', () => {
  test('a token is derived from the nonce and the secret, and is the same every time', () => {
    const nonce = newNonce()
    expect(tokenFor(secret, nonce)).toBe(tokenFor(secret, nonce))
    expect(tokenFor(secret, nonce)).not.toBe(tokenFor('y'.repeat(40), nonce))
    expect(tokenFor(secret, nonce)).not.toBe(tokenFor(secret, newNonce()))
  })

  test('it carries 256 bits as 43 URL-safe characters and never contains the nonce', () => {
    const nonce = newNonce()
    const token = tokenFor(secret, nonce)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(isTokenShape(token)).toBe(true)
    expect(token).not.toContain(nonce)
  })

  test('nonces do not repeat', () => {
    expect(new Set(Array.from({ length: 500 }, newNonce)).size).toBe(500)
  })

  test('only the hash is meant to be stored: it is stable, hex and not the token', () => {
    const token = tokenFor(secret, newNonce())
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(token)).toBe(hashToken(token))
    expect(hashToken(token)).not.toContain(token)
  })

  test('anything that is not a 43 character URL-safe string is not a token', () => {
    for (const value of ['', 'abc', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}!`, `${'a'.repeat(42)}/`, ' '.repeat(43)]) expect(isTokenShape(value)).toBe(false)
  })

  test('a short or missing secret is unusable', () => {
    expect(secretIsUsable(undefined)).toBe(false)
    expect(secretIsUsable('short')).toBe(false)
    expect(secretIsUsable(secret)).toBe(true)
  })
})
