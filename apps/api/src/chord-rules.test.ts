import { describe, expect, test } from 'vitest'
import {
  CHORD_LIMITS, formatChord, keySpelling, parseChord, parseChordPro, parseKey, planTransposition, semitonesBetween,
  serializeChordPro, transposeChord, transposeChordPro, transposeKeyName,
} from './chord-rules.js'

// Every text below is invented for these tests.

describe('acordes', () => {
  test.each([
    ['C', 'C', '', null], ['F#', 'F#', '', null], ['Bb', 'Bb', '', null], ['Am', 'A', 'm', null], ['G7', 'G', '7', null],
    ['Cmaj7', 'C', 'maj7', null], ['Dsus4', 'D', 'sus4', null], ['Esus2', 'E', 'sus2', null], ['Gadd9', 'G', 'add9', null],
    ['Bdim', 'B', 'dim', null], ['Caug', 'C', 'aug', null], ['Em7b5', 'E', 'm7b5', null], ['D7sus4', 'D', '7sus4', null],
    ['C/G', 'C', '', 'G'], ['Am7/G', 'A', 'm7', 'G'], ['D/F#', 'D', '', 'F#'], ['Bbmaj7/Ab', 'Bb', 'maj7', 'Ab'],
  ])('parses %s', (token, root, suffix, bass) => {
    expect(parseChord(token)).toEqual({ root, suffix, bass })
    expect(formatChord(parseChord(token)!)).toBe(token)
  })

  test.each(['', 'H', 'c', 'Am ', ' Am', 'A m', 'Cmaj', 'C#b', 'Cx7', 'C/', '/G', 'C/g', 'C/H', 'C//G', 'C6/9', 'Asus5', 'A\n', 'A]', '[A', 'C/G/B', 'Cm(maj7)', 'A'.repeat(40), 'Ñ'])('refuses %j', token => { expect(parseChord(token)).toBeNull() })
})

describe('tonalidades', () => {
  test('parses major and minor keys and refuses the rest', () => {
    expect(parseKey('G')).toEqual({ pitch: 7, minor: false })
    expect(parseKey('F#m')).toEqual({ pitch: 6, minor: true })
    expect(parseKey('Bb')).toEqual({ pitch: 10, minor: false })
    for (const bad of ['', 'H', 'g', 'Gmaj', 'G7', 'E#', 'Cb', 'Am7', ' G']) expect(parseKey(bad), bad).toBeNull()
  })

  test.each([
    ['C', 'sharp'], ['G', 'sharp'], ['D', 'sharp'], ['A', 'sharp'], ['E', 'sharp'], ['B', 'sharp'], ['F#', 'sharp'], ['C#', 'sharp'],
    ['F', 'flat'], ['Bb', 'flat'], ['Eb', 'flat'], ['Ab', 'flat'], ['Db', 'flat'], ['Gb', 'flat'],
    ['Am', 'sharp'], ['Em', 'sharp'], ['Bm', 'sharp'], ['F#m', 'sharp'], ['C#m', 'sharp'], ['G#m', 'sharp'],
    ['Dm', 'flat'], ['Gm', 'flat'], ['Cm', 'flat'], ['Fm', 'flat'], ['Bbm', 'flat'], ['Ebm', 'flat'], ['Abm', 'flat'],
  ] as const)('the key %s spells with %ss', (key, spelling) => { expect(keySpelling(key)).toBe(spelling) })

  test('transposes a key name with its canonical spelling and keeps the mode', () => {
    expect(transposeKeyName('G', 2)).toBe('A')
    expect(transposeKeyName('G', 3)).toBe('Bb')
    expect(transposeKeyName('Em', 3)).toBe('Gm')
    expect(transposeKeyName('Em', 1)).toBe('Fm')
    expect(transposeKeyName('Am', -2)).toBe('Gm')
    expect(transposeKeyName('C', -1)).toBe('B')
    expect(transposeKeyName('C', 1)).toBe('Db')
    expect(transposeKeyName('C', 6)).toBe('F#')
    expect(transposeKeyName('Am', 4)).toBe('C#m')
    expect(transposeKeyName('Am', 11)).toBe('G#m')
    expect(transposeKeyName('Am', 1)).toBe('Bbm')
    expect(transposeKeyName('D', 12)).toBe('D')
  })

  test('semitones between two keys of the same mode, from 0 to 11 going up', () => {
    expect(semitonesBetween('G', 'A')).toBe(2)
    expect(semitonesBetween('A', 'G')).toBe(10)
    expect(semitonesBetween('C', 'C')).toBe(0)
    expect(semitonesBetween('Em', 'Gm')).toBe(3)
    expect(semitonesBetween('G', 'Em')).toBeNull()
    expect(semitonesBetween('G', 'nope')).toBeNull()
  })
})

describe('transposición de un acorde', () => {
  const sharp = (token: string, n: number) => formatChord(transposeChord(parseChord(token)!, n, 'sharp'))
  const flat = (token: string, n: number) => formatChord(transposeChord(parseChord(token)!, n, 'flat'))

  test('moves root and bass and keeps the extension untouched', () => {
    expect(sharp('C', 2)).toBe('D')
    expect(sharp('Am7', 3)).toBe('Cm7')
    expect(sharp('Gmaj7', 1)).toBe('G#maj7')
    expect(flat('Gmaj7', 1)).toBe('Abmaj7')
    expect(sharp('C/G', 2)).toBe('D/A')
    expect(sharp('D/F#', 2)).toBe('E/G#')
    expect(flat('D/F#', 2)).toBe('E/Ab')
    for (const suffix of ['sus4', 'sus2', 'add9', 'madd9', 'dim', 'dim7', 'aug', 'm7b5', '7sus4', '13']) expect(sharp(`E${suffix}`, 5)).toBe(`A${suffix}`)
  })

  test('wraps around the octave in both directions', () => {
    expect(sharp('B', 1)).toBe('C')
    expect(sharp('C', -1)).toBe('B')
    expect(flat('C', -2)).toBe('Bb')
    expect(sharp('C', 12)).toBe('C')
    expect(sharp('C', -12)).toBe('C')
    expect(sharp('A', 0)).toBe('A')
  })

  test('respells an enharmonic input according to the destination spelling', () => {
    expect(sharp('Bb', 0)).toBe('A#')
    expect(flat('A#', 0)).toBe('Bb')
    expect(flat('C#m', 0)).toBe('Dbm')
    expect(sharp('E#', 0)).toBe('F')
  })

  test('twelve single steps return to the start in either spelling', () => {
    for (const spelling of ['sharp', 'flat'] as const) {
      let chord = parseChord('Am7/G')!
      for (let step = 0; step < 12; step++) chord = transposeChord(chord, 1, spelling)
      expect(formatChord(chord)).toBe('Am7/G')
    }
  })
})

describe('acordes en línea (ChordPro mínimo)', () => {
  test('separates the clean text from the chords by offset and writes it back identically', () => {
    const source = '[G]Luz de la [Em]mañana\n[C]Canto [D/F#]hoy'
    const parsed = parseChordPro(source)
    expect(parsed).toEqual({
      ok: true, text: 'Luz de la mañana\nCanto hoy',
      chords: [{ offset: 0, chord: 'G' }, { offset: 10, chord: 'Em' }, { offset: 17, chord: 'C' }, { offset: 23, chord: 'D/F#' }],
    })
    expect(serializeChordPro(parsed.ok ? parsed.text : '', parsed.ok ? parsed.chords : [])).toBe(source)
  })

  test('text without marks has no chords, and a mark at the very end is kept', () => {
    expect(parseChordPro('solo texto')).toEqual({ ok: true, text: 'solo texto', chords: [] })
    expect(parseChordPro('fin[G]')).toEqual({ ok: true, text: 'fin', chords: [{ offset: 3, chord: 'G' }] })
    expect(parseChordPro('[G][C]dos')).toEqual({ ok: true, text: 'dos', chords: [{ offset: 0, chord: 'G' }, { offset: 0, chord: 'C' }] })
  })

  test.each(['[Am', 'Am]', '[Hm]x', '[]x', '[ Am]x', '[Am ]x', '[[Am]]x', '[A[m]x', '[Am\n]x', '[C6/9]x', 'texto [no es acorde]', 'a ] b'])('refuses malformed or unknown marks: %j', source => { expect(parseChordPro(source)).toEqual({ ok: false }) })

  test('bounds the number of chords per section', () => {
    expect(parseChordPro('[C]a'.repeat(CHORD_LIMITS.maxChords)).ok).toBe(true)
    expect(parseChordPro('[C]a'.repeat(CHORD_LIMITS.maxChords + 1)).ok).toBe(false)
  })

  test('editing the text around a mark does not move the chord away from its syllable', () => {
    const before = 'Canto [Am]hoy al [F]alba'
    const edited = before.replace('Canto ', 'Canto fuerte, ').replace('al ', 'al primer ')
    const attachedTo = (source: string) => {
      const parsed = parseChordPro(source)
      if (!parsed.ok) throw new Error('invalid')
      return parsed.chords.map(item => `${item.chord}:${parsed.text.slice(item.offset, item.offset + 3)}`)
    }
    expect(attachedTo(before)).toEqual(['Am:hoy', 'F:alb'])
    expect(attachedTo(edited)).toEqual(['Am:hoy', 'F:alb'])
  })

  test('serializing refuses offsets outside the text or chords out of order', () => {
    expect(() => serializeChordPro('abc', [{ offset: 4, chord: 'C' }])).toThrow()
    expect(() => serializeChordPro('abc', [{ offset: 2, chord: 'C' }, { offset: 1, chord: 'G' }])).toThrow()
    expect(() => serializeChordPro('abc', [{ offset: 0, chord: 'no' }])).toThrow()
  })

  test('transposes every mark and leaves the text bit for bit identical', () => {
    const source = '[G]Luz de la [Em]mañana [C/E]cantamos\n[D]Gloria [G]\n\nOtra sin acordes'
    const result = transposeChordPro(source, 2, 'sharp')
    expect(result).toBe('[A]Luz de la [F#m]mañana [D/F#]cantamos\n[E]Gloria [A]\n\nOtra sin acordes')
    const [a, b] = [parseChordPro(source), parseChordPro(result!)]
    expect(a.ok && b.ok && a.text === b.text).toBe(true)
    expect(transposeChordPro('[Am', 2, 'sharp')).toBeNull()
  })
})

describe('plan de transposición', () => {
  test('by semitones with a stored key: the destination key decides the spelling', () => {
    expect(planTransposition('G', { semitones: 3 })).toEqual({ ok: true, semitones: 3, spelling: 'flat', key: 'Bb' })
    expect(planTransposition('G', { semitones: 2 })).toEqual({ ok: true, semitones: 2, spelling: 'sharp', key: 'A' })
    expect(planTransposition('Em', { semitones: -2 })).toEqual({ ok: true, semitones: -2, spelling: 'flat', key: 'Dm' })
  })

  test('to a target key: same mode only, spelled as the target is written', () => {
    expect(planTransposition('G', { toKey: 'Bb' })).toEqual({ ok: true, semitones: 3, spelling: 'flat', key: 'Bb' })
    expect(planTransposition('G', { toKey: 'A#' })).toEqual({ ok: true, semitones: 3, spelling: 'sharp', key: 'A#' })
    expect(planTransposition('Em', { toKey: 'Gm' })).toEqual({ ok: true, semitones: 3, spelling: 'flat', key: 'Gm' })
    expect(planTransposition('Am', { toKey: 'F#m' })).toEqual({ ok: true, semitones: 9, spelling: 'sharp', key: 'F#m' })
    expect(planTransposition('G', { toKey: 'Em' })).toEqual({ ok: false })
    expect(planTransposition('Gm', { toKey: 'G' })).toEqual({ ok: false })
    expect(planTransposition('G', { toKey: 'H' })).toEqual({ ok: false })
  })

  test('a target key needs a stored key; semitones do not', () => {
    expect(planTransposition(null, { toKey: 'A' })).toEqual({ ok: false })
    expect(planTransposition(null, { semitones: 2 }, ['[C]x'])).toEqual({ ok: true, semitones: 2, spelling: 'sharp', key: null })
  })

  test('without a key, flats in the source keep flats and anything else uses sharps', () => {
    expect(planTransposition(null, { semitones: 1 }, ['[Bb]x [F]y'])).toMatchObject({ spelling: 'flat' })
    expect(planTransposition(null, { semitones: 1 }, ['[Bb]x [F#]y'])).toMatchObject({ spelling: 'sharp' })
    expect(planTransposition(null, { semitones: 1 }, ['[C/Eb]x'])).toMatchObject({ spelling: 'flat' })
    expect(planTransposition(null, { semitones: 1 }, [])).toMatchObject({ spelling: 'sharp' })
  })

  test('exactly one of semitones or toKey, and semitones within -11..11', () => {
    expect(planTransposition('G', {})).toEqual({ ok: false })
    expect(planTransposition('G', { semitones: 1, toKey: 'A' })).toEqual({ ok: false })
    expect(planTransposition('G', { semitones: 12 })).toEqual({ ok: false })
    expect(planTransposition('G', { semitones: -12 })).toEqual({ ok: false })
    expect(planTransposition('G', { semitones: 1.5 })).toEqual({ ok: false })
    expect(planTransposition('G', { semitones: 11 }).ok).toBe(true)
    expect(planTransposition('G', { semitones: -11 }).ok).toBe(true)
    expect(planTransposition('G', { semitones: 0 })).toMatchObject({ ok: true, semitones: 0, key: 'G' })
  })
})
