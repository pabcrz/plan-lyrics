/**
 * Pure chord rules. A section's chords travel inline, ChordPro style (`[Am]`), inside the same text they belong to:
 * a chord cannot drift from its syllable when the text is edited, because it is part of the text. The clean text is
 * always derivable (`parseChordPro(...).text`). Transposition moves roots and basses only; the rest of each chord
 * (its quality and extensions) is kept verbatim.
 */

export const CHORD_LIMITS = { maxChords: 200, maxChordPro: 8000 } as const

export type Spelling = 'sharp' | 'flat'
export type Chord = { root: string; suffix: string; bass: string | null }

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const
const mod = (value: number) => ((value % 12) + 12) % 12
const pitchOf = (note: string) => mod(NATURAL[note[0] as keyof typeof NATURAL] + (note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0))

// Strict whitelist: anything else is refused instead of guessed («C6/9» is refused because its slash is not a bass).
const SUFFIXES = new Set(['', 'm', '5', '6', 'm6', '7', 'm7', 'maj7', 'maj9', 'maj13', '9', 'm9', '11', 'm11', '13', 'm13', 'sus2', 'sus4', '7sus4', 'add9', 'madd9', 'dim', 'dim7', 'm7b5', 'aug', 'aug7', '7b5', '7b9', '7#9', '7#5'])
const CHORD = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/

export function parseChord(token: string): Chord | null {
  if (token.length > 16) return null
  const match = CHORD.exec(token)
  if (!match || !SUFFIXES.has(match[2]!)) return null
  return { root: match[1]!, suffix: match[2]!, bass: match[3] ?? null }
}

export const formatChord = (chord: Chord) => `${chord.root}${chord.suffix}${chord.bass ? `/${chord.bass}` : ''}`

export function transposeChord(chord: Chord, semitones: number, spelling: Spelling): Chord {
  const names = spelling === 'sharp' ? SHARPS : FLATS
  const move = (note: string) => names[mod(pitchOf(note) + semitones)]!
  return { root: move(chord.root), suffix: chord.suffix, bass: chord.bass ? move(chord.bass) : null }
}

const KEY = /^(C|C#|Db|D|D#|Eb|E|F|F#|Gb|G|G#|Ab|A|A#|Bb|B)(m?)$/
/** A tonality is a note and an optional `m` (minor); nothing else. */
export function parseKey(name: string) {
  const match = KEY.exec(name)
  return match ? { pitch: pitchOf(match[1]!), minor: match[2] === 'm' } : null
}

/** Sharps or flats for a key written by name: its own accidental decides, otherwise its key signature. */
export function keySpelling(name: string): Spelling {
  if (name[1] === '#') return 'sharp'
  if (name[1] === 'b') return 'flat'
  const flatKeys = name.endsWith('m') ? ['Dm', 'Gm', 'Cm', 'Fm'] : ['F']
  return flatKeys.includes(name) ? 'flat' : 'sharp'
}

const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']

/** The key moved by `semitones`, written with its canonical spelling and the same mode. */
export function transposeKeyName(name: string, semitones: number) {
  const key = parseKey(name)
  if (!key) return null
  return (key.minor ? MINOR_NAMES : MAJOR_NAMES)[mod(key.pitch + semitones)]!
}

/** Going up, 0..11, from one key to another of the same mode; `null` when the mode differs or a name is invalid. */
export function semitonesBetween(from: string, to: string) {
  const [a, b] = [parseKey(from), parseKey(to)]
  return a && b && a.minor === b.minor ? mod(b.pitch - a.pitch) : null
}

type Parsed = { ok: true; text: string; chords: Array<{ offset: number; chord: string }> } | { ok: false }

/**
 * Splits `[Am]text` into the clean text and the chords with their offset in that text (UTF-16 units). Anything that
 * is not a valid mark is refused: an unclosed `[`, a stray `]`, nested or empty marks, a mark across lines, an
 * unknown chord, or more than `CHORD_LIMITS.maxChords` marks. Literal brackets cannot appear in a chorded text.
 */
export function parseChordPro(source: string): Parsed {
  let text = ''
  const chords: Array<{ offset: number; chord: string }> = []
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (char === ']') return { ok: false }
    if (char !== '[') { text += char; continue }
    const end = source.indexOf(']', index)
    const token = end < 0 ? '' : source.slice(index + 1, end)
    if (!parseChord(token) || chords.length >= CHORD_LIMITS.maxChords) return { ok: false }
    chords.push({ offset: text.length, chord: token })
    index = end
  }
  return { ok: true, text, chords }
}

/** Inverse of `parseChordPro`; throws on offsets outside the text, chords out of order or an invalid chord. */
export function serializeChordPro(text: string, chords: Array<{ offset: number; chord: string }>) {
  let result = ''
  let last = 0
  for (const { offset, chord } of chords) {
    if (!parseChord(chord) || !Number.isInteger(offset) || offset < last || offset > text.length) throw new Error('Invalid chord position')
    result += `${text.slice(last, offset)}[${chord}]`
    last = offset
  }
  return result + text.slice(last)
}

/** Every mark transposed; the text between marks is untouched. `null` when the source is not valid. */
export function transposeChordPro(source: string, semitones: number, spelling: Spelling) {
  const parsed = parseChordPro(source)
  if (!parsed.ok) return null
  return serializeChordPro(parsed.text, parsed.chords.map(({ offset, chord }) => ({ offset, chord: formatChord(transposeChord(parseChord(chord)!, semitones, spelling)) })))
}

type Plan = { ok: true; semitones: number; spelling: Spelling; key: string | null } | { ok: false }

/**
 * How to transpose: by `semitones` (-11..11) or to a target key of the same mode as the stored one, never both.
 * The destination key decides the spelling; without a stored key, flats in the source keep flats and anything else
 * uses sharps.
 */
export function planTransposition(key: string | null, request: { semitones?: number; toKey?: string }, sources: string[] = []): Plan {
  if ((request.semitones === undefined) === (request.toKey === undefined)) return { ok: false }
  if (request.toKey !== undefined) {
    const semitones = key === null ? null : semitonesBetween(key, request.toKey)
    return semitones === null ? { ok: false } : { ok: true, semitones, spelling: keySpelling(request.toKey), key: request.toKey }
  }
  const { semitones } = request
  if (semitones === undefined || !Number.isInteger(semitones) || semitones < -11 || semitones > 11) return { ok: false }
  if (key !== null) {
    const moved = transposeKeyName(key, semitones)
    return moved ? { ok: true, semitones, spelling: keySpelling(moved), key: moved } : { ok: false }
  }
  const notes = sources.flatMap(source => { const parsed = parseChordPro(source); return parsed.ok ? parsed.chords.flatMap(item => { const chord = parseChord(item.chord)!; return [chord.root, ...(chord.bass ? [chord.bass] : [])] }) : [] })
  const flat = notes.some(note => note[1] === 'b') && !notes.some(note => note[1] === '#')
  return { ok: true, semitones, spelling: flat ? 'flat' : 'sharp', key: null }
}
