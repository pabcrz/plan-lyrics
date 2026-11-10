import { expect, test, vi } from 'vitest'
import { app } from './app.js'

test('GET /api/health identifies only the local API process', async () => {
  const response = await app.request('/api/health')

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('application/json')
  expect(await response.json()).toEqual({ status: 'ok', service: 'plan-lyrics-api' })
})

test('logs only a safe error code when church access fails', async () => {
  const { sessionFixture } = await import('../test/session-fixture.mjs')
  const { createApp } = await import('./app.js')
  const fixture = sessionFixture()
  const failure = Object.assign(new Error('connect postgresql://secret-user:secret-pass@db.example/prod'), { code: 'P1001' })
  const database = { $queryRaw: () => Promise.reject(failure) } as never
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const response = await createApp(fixture.config, database).request('/api/churches/church-a', {
      headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}` },
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'Access unavailable' })
    expect(errors).toHaveBeenCalledTimes(1)
    const logged = errors.mock.calls[0].join(' ')
    expect(JSON.parse(logged)).toEqual({ event: 'church_access_failed', code: 'P1001' })
    expect(logged).not.toMatch(/secret|fixture-owner|church-a/)
  } finally { errors.mockRestore() }
})

test('logs an unknown code for errors without a safe code', async () => {
  const { sessionFixture } = await import('../test/session-fixture.mjs')
  const { createApp } = await import('./app.js')
  const fixture = sessionFixture()
  const database = { $queryRaw: () => Promise.reject(Object.assign(new Error('x'), { code: 'has spaces; DROP' })) } as never
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await createApp(fixture.config, database).request('/api/churches/church-a', {
      headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}` },
    })
    expect(JSON.parse(errors.mock.calls[0].join(' '))).toEqual({ event: 'church_access_failed', code: 'unknown' })
  } finally { errors.mockRestore() }
})
