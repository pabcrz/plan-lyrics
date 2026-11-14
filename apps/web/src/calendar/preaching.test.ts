import { expect, test } from 'vitest'
import { formIssues, LIMITS, parseInline, parseNotes, passagesText, textPassages } from './preaching'

test('bold and underline are read from their markers and nothing else is interpreted', () => {
  expect(parseInline('Una **idea** y __otra__')).toEqual([
    { text: 'Una ', bold: false, underline: false }, { text: 'idea', bold: true, underline: false },
    { text: ' y ', bold: false, underline: false }, { text: 'otra', bold: false, underline: true },
  ])
  expect(parseInline('**__ambas__**')).toEqual([{ text: 'ambas', bold: true, underline: true }])
  expect(parseInline('<b>x</b> [a](http://x.example) *una*')).toEqual([{ text: '<b>x</b> [a](http://x.example) *una*', bold: false, underline: false }])
})

test('a marker without a partner on the line stays as typed', () => {
  expect(parseInline('Precio **alto')).toEqual([{ text: 'Precio **alto', bold: false, underline: false }])
  expect(parseInline('a __b')).toEqual([{ text: 'a __b', bold: false, underline: false }])
})

test('lines that start with a dash and a space are bullets; blank lines are gaps', () => {
  expect(parseNotes('Intro\n- Uno **claro**\n-sin espacio\n\n- Dos').map((block) => [block.kind, block.spans.map((span) => span.text).join('')])).toEqual([
    ['text', 'Intro'], ['bullet', 'Uno claro'], ['text', '-sin espacio'], ['gap', ''], ['bullet', 'Dos'],
  ])
})

test('passages are one per line, trimmed and without empty lines, and go back to the same text', () => {
  expect(textPassages(' Juan   3:16 \n\n  \nRomanos 8:1\r\nSalmo 23')).toEqual(['Juan 3:16', 'Romanos 8:1', 'Salmo 23'])
  expect(passagesText(['A 1:1', 'B 2:2'])).toBe('A 1:1\nB 2:2')
})

test('the limits are reported per field before sending', () => {
  const ok = { preacherId: null, topic: 'x'.repeat(LIMITS.topic), passages: 'Juan 3:16', notes: '- a' }
  expect(formIssues(ok)).toEqual({})
  expect(formIssues({ ...ok, topic: 'x'.repeat(LIMITS.topic + 1) }).topic).toBeTruthy()
  expect(formIssues({ ...ok, passages: Array.from({ length: LIMITS.passages + 1 }, (_, index) => `Salmo ${index}`).join('\n') }).passages).toBeTruthy()
  expect(formIssues({ ...ok, passages: 'x'.repeat(LIMITS.passage + 1) }).passages).toBeTruthy()
  expect(formIssues({ ...ok, notes: 'x'.repeat(LIMITS.notes + 1) }).notes).toBeTruthy()
  expect(formIssues({ ...ok, notes: Array.from({ length: LIMITS.noteLines + 1 }, () => '- a').join('\n') }).notes).toBeTruthy()
})
