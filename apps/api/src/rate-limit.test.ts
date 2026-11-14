import { expect, test } from 'vitest'
import { createLimiter } from './rate-limit.js'

test('allows up to the limit in a window and then refuses, per key', () => {
  const now = 0
  const allow = createLimiter({ limit: 3, windowMs: 1000, now: () => now })
  expect([allow('a'), allow('a'), allow('a'), allow('a')]).toEqual([true, true, true, false])
  expect(allow('b')).toBe(true)
})

test('a new window starts afresh', () => {
  let now = 0
  const allow = createLimiter({ limit: 1, windowMs: 1000, now: () => now })
  expect(allow('a')).toBe(true)
  expect(allow('a')).toBe(false)
  now = 1000
  expect(allow('a')).toBe(true)
})

test('expired windows are dropped so the table cannot grow forever', () => {
  let now = 0
  const limiter = createLimiter({ limit: 1, windowMs: 1000, now: () => now, maxKeys: 5 })
  for (let index = 0; index < 5; index += 1) limiter(`k${index}`)
  now = 5000
  limiter('fresh')
  expect(limiter.size()).toBe(1)
})
