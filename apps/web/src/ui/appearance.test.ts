import { beforeEach, expect, test } from 'vitest'
import { applyAppearance, readAppearance, saveAppearance } from './appearance'

beforeEach(() => { localStorage.clear(); delete document.documentElement.dataset.accent; delete document.documentElement.dataset.mode })

test('defaults to the sage accent following the system, and ignores corrupt storage', () => {
  expect(readAppearance()).toEqual({ accent: 'salvia', mode: 'system' })
  localStorage.setItem('plan-lyrics.appearance', '{"accent":"rojo","mode":"x"}')
  expect(readAppearance()).toEqual({ accent: 'salvia', mode: 'system' })
  localStorage.setItem('plan-lyrics.appearance', 'no-json')
  expect(readAppearance()).toEqual({ accent: 'salvia', mode: 'system' })
})

test('saving applies the choice to <html> and keeps it for the next visit', () => {
  saveAppearance({ accent: 'granate', mode: 'dark' })
  expect(document.documentElement.dataset.accent).toBe('granate')
  expect(document.documentElement.dataset.mode).toBe('dark')
  expect(readAppearance()).toEqual({ accent: 'granate', mode: 'dark' })
  applyAppearance({ accent: 'azul', mode: 'light' })
  expect(document.documentElement.dataset.mode).toBe('light')
})
