import type { ReactNode } from 'react'
import { Button, Notice } from '../ui'
import { parseLines, segments, type Line } from './chords'
import { kindLabel, type Section, type SectionKind } from './lyrics-model'

/** Las líneas de una sección: con acordes, partidas donde cae cada uno; sin ellos, el texto tal cual (los corchetes son texto). */
export const linesOf = (section: Pick<Section, 'text' | 'chordPro'>): Line[] =>
  section.chordPro ? parseLines(section.chordPro) : section.text.split('\n').map((text) => ({ text, chords: [] }))

/**
 * Una línea con cada acorde sobre la sílaba donde cae: la línea se parte en tramos «acorde + texto hasta el siguiente
 * acorde» apilados, así la alineación no depende de una fuente monoespaciada. `renderChord` deja a la edición
 * convertir el acorde en un botón; `mark` resalta uno (el que se está moviendo).
 */
export function ChordLine({ line, renderChord, mark }: { line: Line; renderChord?: (chord: string, index: number) => ReactNode; mark?: number }) {
  const parts = segments(line)
  let seen = 0
  return (
    <p className="m-0 min-h-[1.5em] leading-none [overflow-wrap:anywhere]">
      {parts.length === 0 && <span className="text-[1.0625rem] leading-normal">&nbsp;</span>}
      {parts.map((part, index) => {
        const at = part.chord === null ? -1 : seen++
        return (
          <span key={index} className="inline-flex flex-col align-bottom whitespace-pre-wrap">
            {part.chord === null
              ? <span aria-hidden="true" className="min-h-[1.5em]" />
              : renderChord?.(part.chord, at) ?? <span className={`min-h-[1.5em] self-start pr-[0.6em] font-mono text-sm leading-normal font-medium ${at === mark ? 'rounded-sm bg-accent-soft px-1 text-accent-soft-text' : 'text-accent'}`}>{part.chord}</span>}
            <span className="text-[1.0625rem] leading-normal">{part.text}</span>
          </span>
        )
      })}
    </p>
  )
}

type Affected = Array<{ position: number; kind: string; label: string | null }>

/** `chords_would_be_lost`: la API no escribió nada y nombra las secciones cuyos acordes no se podrían conservar. */
export function ChordsLost({ sections, intro, onReload }: { sections: Affected; intro: string; onReload: () => void }) {
  return (
    <Notice tone="warn" icon="alert" role="alert" title="Se perderían acordes">
      {intro}
      <ul className="mt-2 mb-0 list-disc pl-5">
        {sections.map((item) => (
          <li key={item.position}>Sección {item.position + 1} · {kindLabel(item.kind as SectionKind)}{item.label ? ` «${item.label}»` : ''}</li>
        ))}
      </ul>
      <span className="mt-2 block"><Button variant="secondary" onClick={onReload}>Recargar la letra</Button></span>
    </Notice>
  )
}
