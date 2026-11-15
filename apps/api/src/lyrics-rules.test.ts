import { describe, expect, test } from 'vitest'
import { LYRICS_LIMITS, lyricsBody, publicLyrics } from './lyrics-rules.js'

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
