import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearActiveChurch, setActiveChurch } from './calendar/active-church'
import { claimCache, forgetCache, hasOfflineData, persistCache, restoreCache } from './offline-cache'

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); forgetCache() })
afterEach(() => { vi.useRealTimers(); clearActiveChurch() })

const save = (client: QueryClient) => { persistCache(client); vi.advanceTimersByTime(2000) }

test('what a person saw is stored and comes back as readable data in a new session', () => {
  const first = new QueryClient()
  save(first)
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
