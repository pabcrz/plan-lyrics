import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '../api-url'
import { Button, Icon, Notice, TextField, fold } from '../ui'
import { kindLabel } from '../lyrics/lyrics-model'
import type { PublicSection } from './share-api'

type Song = { title: string; author: string; sections: PublicSection[] }
const KEY = 'plan-lyrics.songbook'

/** Con conexión pide el cancionero y guarda una copia; sin ella, o si falla, usa la última copia guardada. */
async function loadSongbook(signal: AbortSignal): Promise<{ songs: Song[]; copy: boolean }> {
  try {
    const response = await fetch(apiUrl('/api/public/songbook'), { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal })
    if (!response.ok) throw new Error(String(response.status))
    const songs = (await response.json()) as Song[]
    try { localStorage.setItem(KEY, JSON.stringify(songs)) } catch { /* sin espacio: se lee en línea */ }
    return { songs, copy: false }
  } catch (caught) {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Song[] | null
      if (saved) return { songs: saved, copy: true }
    } catch { /* copia ilegible */ }
    throw caught
  }
}

/** No se indexa ni cita su origen, igual que los enlaces del ministerio. */
function useDiscreet() {
  useEffect(() => {
    const previous = document.title
    const metas = [['robots', 'noindex, nofollow, noarchive'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta')
      meta.name = name!
      meta.content = content!
      document.head.append(meta)
      return meta
    })
    document.title = 'Cancionero'
    return () => { metas.forEach((meta) => meta.remove()); document.title = previous }
  }, [])
}

/** Cancionero público: las letras publicadas de la biblioteca, con búsqueda; «Guardar como PDF» usa la impresión del navegador. */
export function SongbookPage() {
  useDiscreet()
  const [query, setQuery] = useState('')
  const book = useQuery({ queryKey: ['songbook'], queryFn: ({ signal }) => loadSongbook(signal), retry: false })
  const songs = (book.data?.songs ?? []).filter((song) => !query.trim() || fold(`${song.title} ${song.author}`).includes(fold(query)))
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-4 pt-6 pb-10 lg:max-w-[720px] print:max-w-none print:p-0">
      <header className="mb-4 grid gap-3 print:mb-6">
        <h1 className="m-0 font-display text-2xl leading-tight font-bold tracking-tight">Cancionero</h1>
        <div className="grid gap-3 print:hidden">
          <TextField label="Buscar por título o autor" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
          <Button variant="secondary" onClick={() => window.print()}><Icon name="doc" />Guardar como PDF</Button>
        </div>
      </header>
      {book.isPending && <p role="status" className="text-text-2">Cargando…</p>}
      {book.isError && <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el cancionero">Revisa tu conexión e inténtalo de nuevo.</Notice>}
      {book.data?.copy && <div className="mb-4"><Notice icon="info" title="Copia guardada en este dispositivo">No se pudo consultar; esto es lo último que se guardó.</Notice></div>}
      {book.data && songs.length === 0 && <p className="text-text-2">{book.data.songs.length === 0 ? 'Aún no hay canciones publicadas.' : 'Nada coincide con esa búsqueda.'}</p>}
      <div className="grid gap-4">
        {songs.map((song) => (
          <article key={`${song.title}|${song.author}`} className="grid gap-3 rounded-lg border border-line bg-surface p-4 print:break-inside-avoid print:rounded-none print:border-0 print:px-0">
            <header>
              <h2 className="m-0 font-display text-lg font-bold">{song.title}</h2>
              <p className="m-0 text-[0.8125rem] text-text-2">{song.author}</p>
            </header>
            {song.sections.map((section, index) => (
              <div key={index}>
                <p className="m-0 text-[0.8125rem] font-semibold text-text-2">
                  {section.label || kindLabel(section.kind)}{section.repeat > 1 && <span className="ml-1.5 font-mono font-medium">×{section.repeat}</span>}
                </p>
                <p className="m-0 text-base leading-[1.65] whitespace-pre-line [overflow-wrap:anywhere]">{section.text}</p>
              </div>
            ))}
          </article>
        ))}
      </div>
    </main>
  )
}
