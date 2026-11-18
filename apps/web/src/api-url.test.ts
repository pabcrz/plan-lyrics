import { expect, test } from 'vitest'
import { buildApiUrl } from './api-url'

test('without a base the path stays relative, as the local Vite proxy expects', () => {
  expect(buildApiUrl(undefined, '/api/health')).toBe('/api/health')
  expect(buildApiUrl('  ', '/api/health')).toBe('/api/health')
})

test('with a base the path goes to the API origin, ignoring trailing slashes', () => {
  expect(buildApiUrl('https://api.example.com', '/api/health')).toBe('https://api.example.com/api/health')
  expect(buildApiUrl('https://api.example.com/', '/api/public/links/abc')).toBe('https://api.example.com/api/public/links/abc')
})
