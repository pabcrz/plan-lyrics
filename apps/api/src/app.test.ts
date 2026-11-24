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

test('POST /api/churches is owner-only, validates the name and founds the church with an ADMIN membership', async () => {
  const { sessionFixture } = await import('../test/session-fixture.mjs')
  const { createApp } = await import('./app.js')
  const fixture = sessionFixture()
  const created: unknown[] = []
  const database = {
    $queryRaw: () => Promise.resolve([{ owner: true, accountManager: false }]),
    user: { findUnique: () => Promise.resolve({ id: 'u1' }) },
    church: { create: (args: unknown) => { created.push(args); return Promise.resolve({ id: 'c1', name: 'Mi iglesia' }) } },
  } as never
  const post = (body: unknown) => createApp(fixture.config, database).request('/api/churches', {
    method: 'POST', body: JSON.stringify(body),
    headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}`, 'Content-Type': 'application/json' },
  })
  expect((await post({ name: '  ' })).status).toBe(400)
  const ok = await post({ name: ' Mi iglesia ' })
  expect(ok.status).toBe(201)
  expect(created).toEqual([{ data: { name: 'Mi iglesia', memberships: { create: { userId: 'u1', role: 'ADMIN' } } }, select: { id: true, name: true } }])

  const stranger = { $queryRaw: () => Promise.resolve([{ owner: false, accountManager: true }]) } as never
  const denied = await createApp(fixture.config, stranger).request('/api/churches', {
    method: 'POST', body: JSON.stringify({ name: 'X' }),
    headers: { Authorization: `Bearer ${fixture.token('fixture-owner')}`, 'Content-Type': 'application/json' },
  })
  expect(denied.status).toBe(404)
})
