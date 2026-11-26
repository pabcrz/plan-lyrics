import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearActiveChurch, setActiveChurch } from './calendar/active-church'
import { ApiError } from './calendar/api'
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
  // Como máximo tres cultos: cada petición cuenta en el consumo del servidor.
  expect(asked.filter(([path]) => path.endsWith('/setlist')).map(([path]) => path)).toEqual(['/api/services/s0/setlist', '/api/services/s1/setlist', '/api/services/s2/setlist'])
  expect(asked).toContainEqual(['/api/services/s1/setlist', 'c2'])
})

test('over the budget, what is needed to open without network is never dropped', () => {
  const first = new QueryClient()
  save(first)
  first.setQueryData(['church'], { id: 'c1' }, { updatedAt: 1 })
  first.setQueryData(['lyrics', 'huge'], 'a'.repeat(3_000_000))
  first.setQueryData(['lyrics', 'small'], 'b', { updatedAt: 2 })
  vi.advanceTimersByTime(2000)
  const second = new QueryClient()
  restoreCache(second)
  expect(hasOfflineData()).toBe(true)
  // Una entrada que no cabe no arrastra a las demás.
  expect(second.getQueryData(['lyrics', 'small'])).toBe('b')
})

test.each([403, 404])('what the server refuses with %i is removed from the device', async (status) => {
  const client = new QueryClient()
  save(client)
  client.setQueryData(['setlist', 's1'], { version: 1 })
  await client.fetchQuery({ queryKey: ['setlist', 's1'], queryFn: () => Promise.reject(new ApiError(status)), retry: false }).catch(() => {})
  expect(client.getQueryData(['setlist', 's1'])).toBeUndefined()
})

test('participations, preaching and the service key transposition are saved too', async () => {
  const asked: string[] = []
  const api = async <T,>(path: string) => {
    asked.push(path)
    if (path.endsWith('/setlist')) return { entries: [{ key: 'A', song: { id: 'song' } }] } as T
    return { key: 'G', sections: [{ chordPro: '[G]x' }] } as T
  }
  const client = new QueryClient()
  await saveUpcoming(client, api, [{ id: 's1', church: 'c1', preaching: true }])
  expect(asked).toEqual(expect.arrayContaining(['/api/services/s1/assignments', '/api/services/s1/preaching', '/api/songs/song/lyrics?toKey=A']))
  expect(client.getQueryData(['lyrics', 'song', 'view', 'toKey=A'])).toBeDefined()
})

test('what was saved less than six hours ago is not asked again, and preaching only where there is one', async () => {
  const asked: string[] = []
  const api = async <T,>(path: string) => {
    asked.push(path)
    return (path.endsWith('/setlist') ? { entries: [{ song: { id: 'song' } }] } : { sections: [] }) as T
  }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  await saveUpcoming(client, api, [{ id: 's1' }])
  expect(asked).toEqual(['/api/services/s1/setlist', '/api/services/s1/assignments', '/api/songs/song/lyrics'])
  asked.length = 0
  vi.advanceTimersByTime(5 * 3_600_000)
  await saveUpcoming(client, api, [{ id: 's1' }])
  expect(asked).toEqual([])
  vi.advanceTimersByTime(2 * 3_600_000)
  await saveUpcoming(client, api, [{ id: 's1' }])
  expect(asked).toHaveLength(3)
})

test('on request the copy is downloaded again at once, and says whether it worked', async () => {
  const asked: string[] = []
  let fail = false
  const api = async <T,>(path: string) => {
    asked.push(path)
    if (fail && path.endsWith('/lyrics')) throw new Error('offline')
    return (path.endsWith('/setlist') ? { entries: [{ song: { id: 'song' } }] } : { sections: [] }) as T
  }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } })
  expect(await saveUpcoming(client, api, [{ id: 's1' }])).toBe(true)
  asked.length = 0
  expect(await saveUpcoming(client, api, [{ id: 's1' }], { force: true })).toBe(true)
  expect(asked).toEqual(['/api/services/s1/setlist', '/api/services/s1/assignments', '/api/songs/song/lyrics'])
  fail = true
  expect(await saveUpcoming(client, api, [{ id: 's1' }], { force: true })).toBe(false)
})
