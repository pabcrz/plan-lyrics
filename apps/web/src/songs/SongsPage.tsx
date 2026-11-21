import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Notice, inputClass } from '../ui'
import { ChurchGate, MainTabbar, TopBar } from '../calendar/ChurchGate'
import type { Church } from '../calendar/model'
import { useSongs } from '../setlist/setlist-api'
import { lyricsPath, useLibraryAccess } from './songs-api'

// El servidor devuelve como máximo 50 canciones por búsqueda.
const LIMIT = 50

export function SongsPage() {
  return <ChurchGate>{(church) => <Library church={church} />}</ChurchGate>
}

/** Biblioteca compartida: búsqueda por título o autor; abrir una canción lleva a su letra. */
function Library({ church }: { church: Church }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])
  const songs = useSongs(term, true)
  const access = useLibraryAccess()
  const rows = songs.data ?? []
  const add = () => void navigate('/canciones/nueva', { state: { title: text.trim() } })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <main className="grid flex-1 content-start gap-3 p-4">
        <div className="flex items-center gap-3">
          <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Canciones</h1>
          {access.data?.canCreate && <Button variant="primary" onClick={add}><Icon name="plus" />Nueva</Button>}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
          <input type="search" autoComplete="off" placeholder="Buscar por título o autor" aria-label="Buscar canciones"
            value={text} onChange={(event) => setText(event.target.value)} className={`${inputClass} pl-10`} />
        </div>
        {songs.isPending && <p role="status">Cargando canciones…</p>}
        {songs.isError && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la biblioteca">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void songs.refetch()}>Reintentar</Button>
          </>
        )}
        {songs.data && rows.length > 0 && (
          <p aria-live="polite" className="m-0 text-[0.8125rem] text-text-2">
            {rows.length >= LIMIT ? `Primeras ${LIMIT} canciones; afina la búsqueda.` : `${rows.length} ${rows.length === 1 ? 'canción' : 'canciones'}`}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
            {rows.map((song) => (
              <li key={song.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => void navigate(lyricsPath(song.id))}
                  className="flex min-h-16 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1"><b className="block text-[0.9375rem] leading-tight [overflow-wrap:anywhere]">{song.title}</b><small className="text-[0.8125rem] text-text-2">{song.author}</small></span>
                  <Icon name="right" className="text-text-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {songs.data && rows.length === 0 && (
          <div className="grid justify-items-center gap-2 py-6 text-center">
            <h2 className="m-0 font-display text-lg font-bold">{term ? 'Sin resultados' : 'Aún no hay canciones'}</h2>
            <p className="m-0 text-text-2">{term ? 'Prueba con otro título o autor.' : 'La biblioteca la edita quien tenga ese acceso.'}</p>
            {term && access.data?.canCreate && <Button variant="secondary" onClick={add}>Agregar «{term}»</Button>}
          </div>
        )}
      </main>
      <MainTabbar church={church} current="songs" />
    </div>
  )
}
