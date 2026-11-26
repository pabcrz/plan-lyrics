import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearActiveChurch, setActiveChurch } from './calendar/active-church'
import { claimCache, forgetCache, hasOfflineData, persistCache, restoreCache, saveUpcoming } from './offline-cache'

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); forgetCache() })
afterEach(() => { vi.useRealTimers(); clearActiveChurch() })

const save = (client: QueryClient) => { persistCache(client); vi.advanceTimersByTime(2000) }

test('what a person saw is stored and comes back as readable data in a new session', () => {
  const first = new QueryClient()
  save(first)
  first.setQueryData(['church'], { id: 'c1' })
  first.setQueryData(['services', '2026-11'], [{ id: 's1', title: 'Culto' }])
  vi.advanceTimersByTime(2000)
  expect(hasOfflineData()).toBe(false)

  const second = new QueryClient()
  restoreCache(second)
  expect(second.getQueryData(['services', '2026-11'])).toEqual([{ id: 's1', title: 'Culto' }])
  expect(hasOfflineData()).toBe(true)
})

test('data of another church is not restored', () => {
  setActiveChurch('c1')
  const first = new QueryClient()
  save(first)
  first.setQueryData(['people'], [{ id: 'p1' }])
  vi.advanceTimersByTime(2000)
  setActiveChurch('c2')
  const second = new QueryClient()
  restoreCache(second)
  expect(second.getQueryData(['people'])).toBeUndefined()
  expect(hasOfflineData()).toBe(false)
})

test('signing in as another account drops the saved data, and signing out erases it', () => {
  const first = new QueryClient()
  save(first)
  claimCache(first, 'ana')
  first.setQueryData(['people'], [{ id: 'p1' }])
  vi.advanceTimersByTime(2000)

  const second = new QueryClient()
  restoreCache(second)
  claimCache(second, 'luis')
  expect(second.getQueryData(['people'])).toBeUndefined()
  expect(localStorage.getItem('plan-lyrics.cache')).toBeNull()

  first.setQueryData(['people'], [{ id: 'p2' }])
  vi.advanceTimersByTime(2000)
  forgetCache()
  expect(localStorage.getItem('plan-lyrics.cache')).toBeNull()
  expect(hasOfflineData()).toBe(false)
})

test('public data alone never opens the product: a saved church is what marks a signed-in device', () => {
  const first = new QueryClient()
  save(first)
  first.setQueryData(['local-api-health'], { status: 'ok' })
  first.setQueryData(['public-songbook'], [])
  vi.advanceTimersByTime(2000)
  restoreCache(new QueryClient())
  expect(hasOfflineData()).toBe(false)
})

test('a refetch that fails without network keeps what was already saved', async () => {
  const first = new QueryClient()
  save(first)
  first.setQueryData(['setlist', 's1'], { version: 1 })
  await first.fetchQuery({ queryKey: ['setlist', 's1'], queryFn: () => Promise.reject(new Error('offline')), retry: false }).catch(() => {})
  vi.advanceTimersByTime(2000)
  const second = new QueryClient()
  restoreCache(second)
  expect(second.getQueryData(['setlist', 's1'])).toEqual({ version: 1 })
})

test('when the storage budget is exceeded the oldest data is dropped, not the newest', () => {
  const first = new QueryClient()
  save(first)
  first.setQueryData(['lyrics', 'old'], 'a'.repeat(2_000_000), { updatedAt: 1 })
  first.setQueryData(['lyrics', 'new'], 'b'.repeat(1_000_000))
  vi.advanceTimersByTime(2000)
  const second = new QueryClient()
  restoreCache(second)
  expect(second.getQueryData(['lyrics', 'new'])).toBeDefined()
  expect(second.getQueryData(['lyrics', 'old'])).toBeUndefined()
})

test('upcoming services of every church are saved, each asked with its own church', async () => {
  const asked: Array<[string, string | undefined]> = []
  const api = async <T,>(path: string, init?: { church?: string }) => {
    asked.push([path, init?.church])
    return (path.endsWith('/setlist') ? { entries: [{ song: { id: 'song' } }] } : {}) as T
  }
  const upcoming = Array.from({ length: 8 }, (_, at) => ({ id: `s${at}`, church: at % 2 ? 'c2' : 'c1' }))
  await saveUpcoming(new QueryClient(), api, upcoming)
  expect(asked.filter(([path]) => path.endsWith('/setlist'))).toHaveLength(8)
  expect(asked).toContainEqual(['/api/services/s1/setlist', 'c2'])
})
