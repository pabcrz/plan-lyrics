import { describe, expect, test } from 'vitest'
import { LYRICS_LIMITS, lyricsBody, publicLyrics, transposeLyrics, transposeQuery } from './lyrics-rules.js'

// Every text below is invented for these tests.
const section = (over: Record<string, unknown> = {}) => ({ kind: 'VERSE', text: 'Línea ficticia uno\nLínea ficticia dos', ...over })
const body = (over: Record<string, unknown> = {}) => ({ version: 0, sections: [section()], ...over })
const parse = (value: unknown) => lyricsBody.safeParse(value)

describe('cuerpo de la letra', () => {
  test('accepts the six kinds of section, in the order given', () => {
    const kinds = ['INTRO', 'VERSE', 'CHORUS', 'BRIDGE', 'OUTRO', 'CLOSING']
    const result = parse(body({ sections: kinds.map(kind => section({ kind })) }))
    expect(result.success && result.data.sections.map(item => item.kind)).toEqual(kinds)
  })

  test('refuses an unknown kind, an unknown field and a missing or invalid version', () => {
    expect(parse(body({ sections: [section({ kind: 'SOLO' })] })).success).toBe(false)
    expect(parse(body({ extra: true })).success).toBe(false)
    expect(parse(body({ sections: [section({ chords: 'G C' })] })).success).toBe(false)
    expect(parse({ sections: [section()] }).success).toBe(false)
    expect(parse(body({ version: -1 })).success).toBe(false)
    expect(parse(body({ version: 1.5 })).success).toBe(false)
  })

  test('normalizes line breaks and trims text and label but keeps inner lines', () => {
    const result = parse(body({ sections: [section({ label: '  Estrofa   1 ', text: '\r\n  Uno  \r\n\r\nDos \n\n' })] }))
    expect(result.success && result.data.sections[0]).toEqual({ kind: 'VERSE', label: 'Estrofa 1', text: 'Uno\n\nDos', repeat: 1 })
  })

  test('a section needs text, and an empty label means no label', () => {
    expect(parse(body({ sections: [section({ text: '  \n ' })] })).success).toBe(false)
    const result = parse(body({ sections: [section({ label: '   ' })] }))
    expect(result.success && result.data.sections[0]?.label).toBeNull()
  })

  test('repeat defaults to 1 and stays within its limits', () => {
    const repeats = (repeat: unknown) => parse(body({ sections: [section({ repeat })] })).success
    const plain = parse(body())
    expect(plain.success && plain.data.sections[0]?.repeat).toBe(1)
    expect(repeats(LYRICS_LIMITS.maxRepeat)).toBe(true)
    expect(repeats(0)).toBe(false)
    expect(repeats(LYRICS_LIMITS.maxRepeat + 1)).toBe(false)
    expect(repeats(2.5)).toBe(false)
  })

  test('bounds the number of sections and the size of text and label', () => {
    const many = (count: number) => Array.from({ length: count }, () => section())
    expect(parse(body({ sections: many(LYRICS_LIMITS.maxSections) })).success).toBe(true)
    expect(parse(body({ sections: many(LYRICS_LIMITS.maxSections + 1) })).success).toBe(false)
    expect(parse(body({ sections: [section({ text: 'a'.repeat(LYRICS_LIMITS.maxText) })] })).success).toBe(true)
    expect(parse(body({ sections: [section({ text: 'a'.repeat(LYRICS_LIMITS.maxText + 1) })] })).success).toBe(false)
    expect(parse(body({ sections: [section({ label: 'a'.repeat(LYRICS_LIMITS.maxLabel + 1) })] })).success).toBe(false)
  })

  test('refuses control characters in text and label', () => {
    expect(parse(body({ sections: [section({ text: 'hola\u0000mundo' })] })).success).toBe(false)
    expect(parse(body({ sections: [section({ label: 'a\u0007b' })] })).success).toBe(false)
  })

  test('published is optional (absent keeps the stored value) and must be a boolean', () => {
    const plain = parse(body())
    expect(plain.success && 'published' in plain.data).toBe(false)
    expect(parse(body({ published: false, sections: [] })).success).toBe(true)
    expect(parse(body({ published: 'yes' })).success).toBe(false)
  })

  test('an empty lyrics cannot be published', () => {
    expect(parse(body({ published: true, sections: [] })).success).toBe(false)
    expect(parse(body({ published: true })).success).toBe(true)
  })
})

describe('letra pública', () => {
  const stored = (published: boolean) => ({ published, sections: [{ kind: 'CHORUS' as const, label: null, text: 'Texto ficticio', repeat: 2, position: 0 }] })

  test('an unpublished or missing lyrics is not shown, and both look the same', () => {
    expect(publicLyrics(stored(false))).toBeNull()
    expect(publicLyrics(undefined)).toBeNull()
  })

  test('a published lyrics shows only kind, label, text and repeat', () => {
    expect(publicLyrics(stored(true))).toEqual([{ kind: 'CHORUS', label: null, text: 'Texto ficticio', repeat: 2 }])
  })

  test('a published lyrics with no sections is not shown', () => {
    expect(publicLyrics({ published: true, sections: [] })).toBeNull()
  })
})

describe('acordes en el cuerpo de la letra', () => {
  const chorded = (over: Record<string, unknown> = {}) => section({ text: undefined, chordPro: '[G]Luz de la [Em]mañana\n[C]Canto [D]hoy', ...over })
  const first = (value: unknown) => { const result = parse(body({ sections: [value] })); return result.success ? result.data.sections[0] : undefined }

  test('the clean text is derived from the chords when it is omitted', () => {
    expect(first(chorded())).toEqual({ kind: 'VERSE', label: null, text: 'Luz de la mañana\nCanto hoy', chordPro: '[G]Luz de la [Em]mañana\n[C]Canto [D]hoy', repeat: 1 })
  })

  test('a text that is sent must be exactly the chorded one without its marks', () => {
    expect(first(chorded({ text: 'Luz de la mañana\nCanto hoy' }))?.text).toBe('Luz de la mañana\nCanto hoy')
    expect(first(chorded({ text: 'Luz de la mañana\nCanto ayer' }))).toBeUndefined()
    expect(first(chorded({ text: '' }))).toBeUndefined()
  })

  test('omitting chordPro is not the same as sending null, and a chordPro without marks is plain text', () => {
    expect(first(section())).toEqual({ kind: 'VERSE', label: null, text: 'Línea ficticia uno\nLínea ficticia dos', repeat: 1 })
    expect(first(section())).not.toHaveProperty('chordPro', null)
    expect(first(section({ chordPro: null }))?.chordPro).toBeNull()
    // Marks that carry no chord at all are the same as no chords.
    expect(first(section({ text: undefined, chordPro: 'solo texto' }))).toMatchObject({ text: 'solo texto', chordPro: null })
  })

  test('refuses an invalid, empty or unknown mark and a section with neither text nor chords', () => {
    for (const chordPro of ['[Hm]x', '[Am', 'x]', '[]x', 'texto [libre]', '[G]', '[G] \n [C]', '']) expect(first(chorded({ chordPro })), chordPro).toBeUndefined()
    expect(first({ kind: 'VERSE' })).toBeUndefined()
    expect(first(section({ chordPro: 5 }))).toBeUndefined()
  })

  test('normalizes line breaks and edges like the text, and refuses control characters and excess size', () => {
    expect(first(chorded({ chordPro: '\r\n [G]Uno \r\n\r\n[C]Dos  \n' }))).toMatchObject({ text: 'Uno\n\nDos', chordPro: '[G]Uno\n\n[C]Dos' })
    expect(first(chorded({ chordPro: '[G]hola\u0000' }))).toBeUndefined()
    expect(first(chorded({ chordPro: `[G]${'a'.repeat(LYRICS_LIMITS.maxText)}` }))).toBeDefined()
    expect(first(chorded({ chordPro: `[G]${'a'.repeat(LYRICS_LIMITS.maxText + 1)}` }))).toBeUndefined()
  })

  test('the tonality is optional (absent keeps the stored one), nullable and must be a note with an optional m', () => {
    const plain = parse(body())
    expect(plain.success && 'key' in plain.data).toBe(false)
    expect(parse(body({ key: 'Em' })).success).toBe(true)
    expect(parse(body({ key: null })).success).toBe(true)
    for (const key of ['', 'H', 'em', 'G7', 'Gmaj', ' G', 5]) expect(parse(body({ key })).success, String(key)).toBe(false)
  })
})

describe('parámetros de transposición', () => {
  test('reads semitones as a signed integer and a target key; nothing is a no transposition', () => {
    expect(transposeQuery({})).toEqual({ ok: true, request: null })
    expect(transposeQuery({ semitones: '3' })).toEqual({ ok: true, request: { semitones: 3 } })
    expect(transposeQuery({ semitones: '-2' })).toEqual({ ok: true, request: { semitones: -2 } })
    expect(transposeQuery({ toKey: 'F#m' })).toEqual({ ok: true, request: { toKey: 'F#m' } })
    expect(transposeQuery({ other: 'x' })).toEqual({ ok: true, request: null })
  })

  test('refuses non numeric, fractional, huge, empty or combined parameters', () => {
    for (const query of [{ semitones: 'x' }, { semitones: '1.5' }, { semitones: '' }, { semitones: '+2' }, { semitones: '123' }, { toKey: '' }, { toKey: 'H' }, { semitones: '1', toKey: 'A' }])
      expect(transposeQuery(query), JSON.stringify(query)).toEqual({ ok: false })
  })
})

describe('transposición de una letra', () => {
  const sections = [{ text: 'a', chordPro: '[G]a [Em]b' }, { text: 'c', chordPro: null }, { text: 'd', chordPro: '[D/F#]d' }]

  test('moves every chorded section and the key, and leaves the rest as it is', () => {
    expect(transposeLyrics('G', sections, { semitones: 3 })).toEqual({
      key: 'Bb', semitones: 3,
      sections: [{ text: 'a', chordPro: '[Bb]a [Gm]b' }, { text: 'c', chordPro: null }, { text: 'd', chordPro: '[F/A]d' }],
    })
  })

  test('to a target key, and a refusal when it cannot be done', () => {
    expect(transposeLyrics('Em', [{ chordPro: '[Em]x [C]y' }], { toKey: 'Gm' })?.sections).toEqual([{ chordPro: '[Gm]x [Eb]y' }])
    expect(transposeLyrics('Em', sections, { toKey: 'G' })).toBeNull()
    expect(transposeLyrics(null, sections, { toKey: 'G' })).toBeNull()
  })

  test('refuses to guess when the stored chords are corrupt', () => {
    expect(() => transposeLyrics('G', [{ chordPro: '[Zz]x' }], { semitones: 2 })).toThrow()
  })
})

describe('letra pública sin acordes', () => {
  test('never shows chords, key or any other stored field even if the stored rows carry them', () => {
    const stored = { published: true, key: 'G', sections: [{ kind: 'VERSE' as const, label: null, text: 'Luz ficticia', chordPro: '[G]Luz ficticia', repeat: 1, position: 0 }] }
    const shown = publicLyrics(stored)
    expect(shown).toEqual([{ kind: 'VERSE', label: null, text: 'Luz ficticia', repeat: 1 }])
    expect(JSON.stringify(shown)).not.toMatch(/chordPro|key|\[G\]/)
  })
})
