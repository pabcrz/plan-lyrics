import { afterEach, expect, test } from 'vitest'
import { clearBatchDraft, loadBatchDraft, saveBatchDraft, type BatchDraft } from './batch-draft'

afterEach(() => localStorage.clear())

const draft = (over: Partial<BatchDraft> = {}): BatchDraft => ({
  version: 1, savedAt: '2026-11-12T18:00:00.000Z', step: 'directors', month: '2026-11', weekdays: [5], configs: {}, list: [{ id: 'p1', name: 'Ana Ramírez' }],
  repeat: true, continues: true, review: { assignment: {}, removed: [], preachers: {} }, preachers: [], repeatPreachers: true, ...over,
})
const now = Date.parse('2026-11-13T18:00:00Z')

test('a saved draft comes back as it was, per church, and clearing removes it', () => {
  saveBatchDraft('a', draft())
  expect(loadBatchDraft('a', now)).toEqual(draft())
  expect(loadBatchDraft('b', now)).toBeNull()
  clearBatchDraft('a')
  expect(loadBatchDraft('a', now)).toBeNull()
})

test.each([
  ['broken JSON', '{no'],
  ['another version', JSON.stringify({ ...draft(), version: 2 })],
  ['an unknown step', JSON.stringify({ ...draft(), step: 'done' })],
  ['a missing month', JSON.stringify({ ...draft(), month: undefined })],
  ['an older draft than 14 days', JSON.stringify(draft({ savedAt: '2026-10-20T00:00:00.000Z' }))],
])('%s is ignored', (_name, raw) => {
  localStorage.setItem('plan-lyrics:batch-draft:a', raw)
  expect(loadBatchDraft('a', now)).toBeNull()
})

test('a full storage never breaks the batch', () => {
  const original = Storage.prototype.setItem
  Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
  try { expect(() => saveBatchDraft('a', draft())).not.toThrow() } finally { Storage.prototype.setItem = original }
})
