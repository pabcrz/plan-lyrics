import { beforeEach, expect, test } from 'vitest'
import { applyAppearance, readAppearance, saveAppearance, setChurchAccent } from './appearance'

beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.accent; delete document.documentElement.dataset.mode })

test('defaults to the sage accent following the system, and ignores corrupt storage', () => {
  expect(readAppearance()).toEqual({ accent: 'azul', mode: 'system', byChurch: false })
  localStorage.setItem('plan-lyrics.appearance', '{"accent":"rojo","mode":"x"}')
  expect(readAppearance()).toEqual({ accent: 'azul', mode: 'system', byChurch: false })
  localStorage.setItem('plan-lyrics.appearance', 'no-json')
  expect(readAppearance()).toEqual({ accent: 'azul', mode: 'system', byChurch: false })
})

test('saving applies the choice to <html> and keeps it for the next visit', () => {
  saveAppearance({ accent: 'granate', mode: 'dark', byChurch: false })
  expect(document.documentElement.dataset.accent).toBe('granate')
  expect(document.documentElement.dataset.mode).toBe('dark')
  expect(readAppearance()).toEqual({ accent: 'granate', mode: 'dark', byChurch: false })
  applyAppearance({ accent: 'azul', mode: 'light', byChurch: false })
  expect(document.documentElement.dataset.mode).toBe('light')
})

test('with a fixed color the church color is only remembered, never applied', () => {
  saveAppearance({ accent: 'ocre', mode: 'light', byChurch: false })
  setChurchAccent('salvia')
  expect(document.documentElement.dataset.accent).toBe('ocre')
})

test('by church, the app takes the last church color, and falls back to the fixed one before any is known', () => {
  saveAppearance({ accent: 'ocre', mode: 'light', byChurch: true })
  expect(document.documentElement.dataset.accent).toBe('ocre')
  setChurchAccent('salvia')
  expect(document.documentElement.dataset.accent).toBe('salvia')
  setChurchAccent('granate')
  expect(document.documentElement.dataset.accent).toBe('granate')
  expect(readAppearance().byChurch).toBe(true)
})
