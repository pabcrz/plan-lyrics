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

export type LyricsOptions = {
  canEdit?: boolean
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
  const state = { version: options.version ?? 3, published: options.published ?? false, sections: structuredClone(options.sections ?? sample) }
  const calls: Array<{ method: string; url: string; body?: { version: number; published?: boolean; sections: Section[] } }> = []
  const snapshot = (): Lyrics => ({ version: state.version, published: state.published, canEdit: options.canEdit ?? true, sections: structuredClone(state.sections) })
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as { version: number; published?: boolean; sections: Section[] }) : undefined
    calls.push({ method, url, body })
    const reply = (status: number, payload: unknown) => new Response(JSON.stringify(payload), { status })
    if (!/^\/api\/songs\/[^/]+\/lyrics$/.test(url)) return reply(404, { error: 'Not found' })
    if (method === 'GET') return options.readStatus ? reply(options.readStatus, { error: 'x' }) : reply(200, snapshot())
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
    state.sections = body.sections.map((section) => ({ ...section, label: section.label?.trim() || null }))
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
