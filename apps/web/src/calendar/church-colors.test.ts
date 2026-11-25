import { renderHook, act } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { CHURCH_HUES, cssColor, useChurchColors, churchColorsStore } from './church-colors'

beforeEach(() => { localStorage.clear(); churchColorsStore.set({}) })

test('a church without a chosen color gets a stable one from the palette, and each church can be given its own', () => {
  const { result } = renderHook(() => useChurchColors())
  const first = result.current.hueOf('betel')
  expect(CHURCH_HUES.map((item) => item.hue)).toContain(first)
  expect(result.current.hueOf('betel')).toBe(first)
  act(() => result.current.set('betel', 15))
  act(() => result.current.set('cristo', 145))
  expect(result.current.hueOf('betel')).toBe(15)
  expect(result.current.colorOf('cristo')).toBe(cssColor(145))
  expect(JSON.parse(localStorage.getItem('plan-lyrics.churchColors')!)).toEqual({ betel: 15, cristo: 145 })
})
