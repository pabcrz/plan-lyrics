/**
 * Acordes en línea (ChordPro, `[Am]texto`) vistos desde la pantalla. El servidor es quien valida y transpone; aquí solo se
 * parte el texto para mostrarlo y editarlo, y se reconoce un acorde para avisar antes de enviar. No hay paquete
 * compartido con la API: las listas de abajo repiten las de `apps/api/src/chord-rules.ts` y deben cambiar juntas.
 */

export type ChordMark = { offset: number; chord: string }
/** Una línea de texto limpio y sus acordes, con su posición (unidades UTF-16) dentro de ese texto. */
export type Line = { text: string; chords: ChordMark[] }
export type Segment = { chord: string | null; text: string }

const SUFFIXES = new Set(['', 'm', '5', '6', 'm6', '7', 'm7', 'maj7', 'maj9', 'maj13', '9', 'm9', '11', 'm11', '13', 'm13', 'sus2', 'sus4', '7sus4', 'add9', 'madd9', 'dim', 'dim7', 'm7b5', 'aug', 'aug7', '7b5', '7b9', '7#9', '7#5'])
const CHORD = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/

export function isChord(token: string) {
  if (token.length > 16) return false
  const match = CHORD.exec(token)
  return match !== null && SUFFIXES.has(match[2]!)
}

/** Una línea con marcas `[acorde]`; lo que no es una marca válida se queda como texto. */
function parseLine(source: string): Line {
  let text = ''
  const chords: ChordMark[] = []
  for (let index = 0; index < source.length; index++) {
    const end = source[index] === '[' ? source.indexOf(']', index) : -1
    const token = end < 0 ? '' : source.slice(index + 1, end)
    if (end > 0 && isChord(token)) { chords.push({ offset: text.length, chord: token }); index = end } else text += source[index]
  }
  return { text, chords }
}

export const parseLines = (source: string): Line[] => source.split('\n').map(parseLine)

export function serializeLine({ text, chords }: Line) {
  let result = ''
  let last = 0
  for (const { offset, chord } of chords) { result += `${text.slice(last, offset)}[${chord}]`; last = offset }
  return result + text.slice(last)
}

export const serializeLines = (lines: Line[]) => lines.map(serializeLine).join('\n')

/** La línea partida en tramos: cada acorde con el texto que cae bajo él, hasta el siguiente acorde. */
export function segments({ text, chords }: Line): Segment[] {
  if (chords.length === 0) return text ? [{ chord: null, text }] : []
  const result: Segment[] = chords[0]!.offset > 0 ? [{ chord: null, text: text.slice(0, chords[0]!.offset) }] : []
  chords.forEach(({ offset, chord }, index) => result.push({ chord, text: text.slice(offset, chords[index + 1]?.offset ?? text.length) }))
  return result
}

const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const
const mod = (value: number) => ((value % 12) + 12) % 12
const KEY = /^([A-G])([#b]?)(m?)$/

/** Una tonalidad es una nota y una `m` opcional; `null` si no lo es. */
export function parseKey(name: string) {
  const match = KEY.exec(name)
  return match ? { pitch: mod(NATURAL[match[1] as keyof typeof NATURAL] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0)), minor: match[3] === 'm' } : null
}

const MAJOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm']
/** Las doce tonalidades de un modo, con la grafía habitual de cada una. */
export const keysOfMode = (minor: boolean) => (minor ? MINOR : MAJOR)

/** Medios tonos hacia arriba, de 0 a 11, entre dos tonalidades del mismo modo; `null` si el modo difiere o un nombre no es válido. */
export function semitonesBetween(from: string, to: string) {
  const [a, b] = [parseKey(from), parseKey(to)]
  return a && b && a.minor === b.minor ? mod(b.pitch - a.pitch) : null
}
