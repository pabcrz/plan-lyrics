import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { CHURCH_TONES, churchColorsStore, useChurchColors } from './church-colors'

beforeEach(() => { localStorage.clear(); churchColorsStore.set({}) })

test('the colors are the themes of the app, and each church starts with a different one', () => {
  expect(CHURCH_TONES.map((tone) => tone.id)).toEqual(['azul', 'salvia', 'indigo', 'ocre', 'granate'])
  const { result } = renderHook(() => useChurchColors(['c3', 'c1', 'c2']))
  expect(['c1', 'c2', 'c3'].map((id) => result.current.toneId(id))).toEqual(['azul', 'salvia', 'indigo'])
})

test('each church can be given its own tone, which is kept on the device', () => {
  const { result } = renderHook(() => useChurchColors(['betel', 'cristo']))
  act(() => result.current.set('betel', 'granate'))
  act(() => result.current.set('cristo', 'ocre'))
  expect(result.current.toneId('betel')).toBe('granate')
  expect(result.current.style('cristo')).toEqual({ '--h': 62, '--c': 0.105 })
  expect(JSON.parse(localStorage.getItem('plan-lyrics.churchColors')!)).toEqual({ betel: 'granate', cristo: 'ocre' })
})
