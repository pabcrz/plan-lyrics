import { expect, test } from 'vitest'
import { trustedClientIp } from './client-ip.js'

const headers = (values: Record<string, string>) => new Headers(values)

test('prefers x-vercel-forwarded-for, then x-real-ip, then the last x-forwarded-for entry', () => {
  expect(trustedClientIp(headers({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '192.0.2.1' }))).toBe('203.0.113.7')
  expect(trustedClientIp(headers({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '192.0.2.1' }))).toBe('198.51.100.1')
  expect(trustedClientIp(headers({ 'x-forwarded-for': '192.0.2.99, 192.0.2.1' }))).toBe('192.0.2.1')
})

test('accepts IPv6 and trims whitespace', () => {
  expect(trustedClientIp(headers({ 'x-real-ip': ' 2001:db8::1 ' }))).toBe('2001:db8::1')
})

test('ignores values that are not an IP address, so a header cannot mint arbitrary keys', () => {
  expect(trustedClientIp(headers({ 'x-real-ip': 'not-an-ip', 'x-forwarded-for': '<script>' }))).toBeUndefined()
  expect(trustedClientIp(headers({ 'x-vercel-forwarded-for': 'junk', 'x-real-ip': '198.51.100.1' }))).toBe('198.51.100.1')
})

test('returns nothing without headers', () => {
  expect(trustedClientIp(headers({}))).toBeUndefined()
})
