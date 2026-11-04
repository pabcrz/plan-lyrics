import { expect, test } from 'vitest'
import { app } from './app.js'

test('GET /api/health identifies only the local API process', async () => {
  const response = await app.request('/api/health')

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('application/json')
  expect(await response.json()).toEqual({ status: 'ok', service: 'plan-lyrics-api' })
})
