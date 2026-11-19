import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Lyrics, Section } from './lyrics-model'

// Solo textos inventados: ninguna letra real entra al repositorio.
export const sample: Section[] = [
  { kind: 'INTRO', label: null, text: 'Línea inventada de la introducción', repeat: 1 },
  { kind: 'VERSE', label: 'Estrofa 1', text: 'Primera línea de una estrofa ficticia\nSegunda línea de la misma estrofa', repeat: 1 },
  { kind: 'CHORUS', label: null, text: 'Texto inventado del coro', repeat: 2 },
]

// Con acordes: las marcas van en línea, ChordPro. Todo inventado.
export const chorded: Section[] = [
  { kind: 'INTRO', label: null, text: 'Línea inventada de la introducción', chordPro: '[G]Línea inventada [D]de la introducción', repeat: 1 },
  { kind: 'VERSE', label: 'Estrofa 1', text: 'Primera línea de una estrofa ficticia\nSegunda línea de la misma estrofa', chordPro: '[G]Primera línea [Em]de una estrofa ficticia\nSegunda línea de la misma estrofa', repeat: 1 },
  { kind: 'CHORUS', label: null, text: 'Texto inventado del coro', chordPro: null, repeat: 2 },
]

type Moved = { key: string; semitones: number; sections: Section[] }

export type LyricsOptions = {
  canEdit?: boolean
  /** Tonalidad guardada de la letra. */
  key?: string | null
  /** Respuestas a las lecturas transpuestas, por su consulta (`toKey=A`, `semitones=3`); otra consulta es un 400 como en la API. */
  transposed?: Record<string, Moved>
  /** Respuesta con la que falla el guardado, con su cuerpo (por ejemplo, `chords_would_be_lost`). */
  writeFailure?: { status: number; body: unknown }
  published?: boolean
  sections?: Section[]
  version?: number
  /** Estado HTTP con el que falla la lectura. */
  readStatus?: number
  /** Estado HTTP con el que falla el guardado (409 simula a otra persona que guardó antes). */
  writeStatus?: number
}

/** Servidor ficticio de una letra, con las mismas reglas que la API: versión, permiso de escritura y 409 si la versión no coincide. */
export function stubLyrics(options: LyricsOptions = {}) {
  const state = { version: options.version ?? 3, published: options.published ?? false, key: options.key ?? null, sections: structuredClone(options.sections ?? sample) }
  type Write = { version: number; published?: boolean; key?: string | null; sections: Section[] }
  const calls: Array<{ method: string; url: string; body?: Write }> = []
  const snapshot = (): Lyrics => ({ version: state.version, published: state.published, key: state.key, canEdit: options.canEdit ?? true, sections: structuredClone(state.sections) })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Write) : undefined
    calls.push({ method, url, body })
    const reply = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status })
    const [route, query = ''] = url.split('?')
    if (!/^\/api\/songs\/[^/]+\/lyrics$/.test(route)) return reply(404, { error: 'Not found' })
    if (method === 'GET') {
      if (options.readStatus) return reply(options.readStatus, { error: 'x' })
      if (!query) return reply(200, snapshot())
      const moved = options.transposed?.[query]
      return moved ? reply(200, { ...snapshot(), ...moved }) : reply(400, { error: 'Invalid request' })
    }
    if (options.writeFailure) return reply(options.writeFailure.status, options.writeFailure.body)
    if (options.writeStatus === 409) {
      // Otra persona guardó mientras tanto.
      state.version += 1
      state.sections = [{ kind: 'VERSE', label: null, text: 'Texto que guardó otra persona', repeat: 1 }]
      options.writeStatus = undefined
      return reply(409, { error: 'Lyrics changed', version: state.version })
    }
    if (options.writeStatus) return reply(options.writeStatus, { error: 'x' })
    if (body?.version !== state.version) return reply(409, { error: 'Lyrics changed', version: state.version })
    state.version += 1
    if (body.key !== undefined) state.key = body.key
    // Como la API: el texto sale de las marcas y una sección sin marcas queda sin `chordPro`.
    state.sections = body.sections.map((section) => {
      const chordPro = section.chordPro && /\[/.test(section.chordPro) ? section.chordPro : null
      return { ...section, chordPro, text: chordPro ? chordPro.replace(/\[[^\]]*\]/g, '') : section.text, label: section.label?.trim() || null }
    })
    if (body.published !== undefined) state.published = body.published
    return reply(200, snapshot())
  }))
  return { calls, state, writes: () => calls.filter((call) => call.method === 'PUT') }
}

export type Entry = string | { pathname: string; state: unknown }

export function mountAt(ui: ReactNode, entry: Entry) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}
