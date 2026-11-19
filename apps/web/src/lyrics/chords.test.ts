import { expect, test } from 'vitest'
import { isChord, keysOfMode, parseKey, parseLines, segments, semitonesBetween, serializeLines } from './chords'

test('splits a chorded text into lines with the offset of each chord inside its clean text', () => {
  expect(parseLines('[G]Primera [Em]línea\nSegunda línea[D]')).toEqual([
    { text: 'Primera línea', chords: [{ offset: 0, chord: 'G' }, { offset: 8, chord: 'Em' }] },
    { text: 'Segunda línea', chords: [{ offset: 13, chord: 'D' }] },
  ])
})

test('a plain text is lines without chords, brackets included (they are literal text there)', () => {
  expect(parseLines('Una línea\n\nOtra')).toEqual([{ text: 'Una línea', chords: [] }, { text: '', chords: [] }, { text: 'Otra', chords: [] }])
})

test('serializing is the inverse of parsing', () => {
  const source = '[G]Primera [Em]línea\nSegunda\n[C][D]Dos en la misma sílaba'
  expect(serializeLines(parseLines(source))).toBe(source)
})

test('a line is cut into segments, each with the chord that falls on its first letter', () => {
  const [line] = parseLines('Antes [Am]de [C/G]ahora')
  expect(segments(line)).toEqual([
    { chord: null, text: 'Antes ' },
    { chord: 'Am', text: 'de ' },
    { chord: 'C/G', text: 'ahora' },
  ])
  expect(segments({ text: 'Sin acordes', chords: [] })).toEqual([{ chord: null, text: 'Sin acordes' }])
  expect(segments({ text: '', chords: [] })).toEqual([])
})

test('accepts the chords the API accepts and refuses the rest', () => {
  for (const chord of ['C', 'F#m', 'Bb', 'Am7/G', 'Dsus4', 'E7#9', 'Gmaj7', 'C/E']) expect(isChord(chord), chord).toBe(true)
  for (const chord of ['', 'H7', 'c', 'C6/9', 'Am7(add9)', 'G#b', 'C/', 'A B']) expect(isChord(chord), chord).toBe(false)
})

test('reads a key and knows which keys share its mode', () => {
  expect(parseKey('F#m')).toEqual({ pitch: 6, minor: true })
  expect(parseKey('Bb')).toEqual({ pitch: 10, minor: false })
  expect(parseKey('H')).toBeNull()
  expect(keysOfMode(false)).toEqual(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])
  expect(keysOfMode(true)).toEqual(['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'])
})

test('the distance between two keys of the same mode goes up from 0 to 11; another mode has none', () => {
  expect(semitonesBetween('G', 'A')).toBe(2)
  expect(semitonesBetween('G', 'F')).toBe(10)
  expect(semitonesBetween('Em', 'Em')).toBe(0)
  expect(semitonesBetween('G', 'Em')).toBeNull()
})
