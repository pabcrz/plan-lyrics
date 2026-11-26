import { useEffect, useState } from 'react'
import { Outlet, useMatch, useNavigate, useParams } from 'react-router'
import { Button, Icon, Notice, inputClass } from '../ui'
import { cx } from '../ui/cx'
import { AppShell } from '../calendar/AppShell'
import { ChurchGate } from '../calendar/ChurchGate'
import type { Church } from '../calendar/model'
import { lyricsPath, useLibrary, useLibraryAccess, type LibraryOrder } from './songs-api'
import { SongRowBody } from './SongRow'

const ORDERS: ReadonlyArray<{ value: LibraryOrder; label: string }> = [{ value: 'title', label: 'A–Z' }, { value: 'most', label: 'Más usadas' }, { value: 'least', label: 'Menos usadas' }]
const DESKTOP = '(min-width: 1024px)'

/** Escritorio ≥1024 px (la misma frontera que `lg:` de Tailwind); sin `matchMedia` (pruebas) cuenta como móvil. */
function useDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia?.(DESKTOP).matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.(DESKTOP)
    if (!query) return
    const update = () => setDesktop(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desktop
}

export function SongsPage() {
  return <ChurchGate>{(church) => <Library church={church} />}</ChurchGate>
}

/**
 * Biblioteca compartida. Móvil: la lista, o el panel de una canción (nueva o edición) como pantalla aparte. Escritorio: lista a la
 * izquierda y el panel a la derecha, con la navegación principal arriba. El panel es la ruta hija (`<Outlet />`).
 */
function Library({ church }: { church: Church }) {
  const navigate = useNavigate()
  const desktop = useDesktop()
  const editing = useParams().songId
  const panel = !useMatch({ path: '/canciones', end: true })
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])
  const [order, setOrder] = useState<LibraryOrder>('title')
  const [inverted, setInverted] = useState(false)
  const songs = useLibrary(term, order, inverted)
  const access = useLibraryAccess()
  const canCreate = Boolean(access.data?.canCreate)
  const rows = songs.rows
  const add = () => void navigate('/canciones/nueva', { state: { title: text.trim() } })
  const edit = (song: { id: string }) => void navigate(`/canciones/${encodeURIComponent(song.id)}/editar`, { state: { song } })

  return (
    <AppShell church={church} current="songs" wide focus={panel} action={canCreate ? { label: 'Nueva canción', onAction: add } : undefined}>
        <div className="flex flex-1 lg:h-dvh lg:min-h-0 lg:flex-none">
          <main className={cx('flex-1 content-start gap-3 p-4 lg:max-w-[400px] lg:flex-none lg:basis-[400px] lg:overflow-y-auto lg:border-r lg:border-line', panel ? 'hidden lg:grid' : 'grid')}>
            <div className="flex items-center gap-3">
              <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Canciones</h1>
              {canCreate && <Button variant="primary" onClick={add} className="max-lg:hidden"><Icon name="plus" />Nueva</Button>}
            </div>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
              <input type="search" autoComplete="off" placeholder="Buscar por título o autor" aria-label="Buscar canciones"
                value={text} onChange={(event) => setText(event.target.value)} className={`${inputClass} pl-10`} />
            </div>
            <div role="group" aria-label="Ordenar canciones" className="flex items-center gap-1.5">
              {ORDERS.map((item) => (
                <button key={item.value} type="button" aria-pressed={order === item.value} onClick={() => setOrder(item.value)}
                  className={cx('min-h-11 cursor-pointer rounded-full border px-3.5 text-sm font-medium whitespace-nowrap', order === item.value ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text hover:bg-surface-2')}>
                  {item.label}
                </button>
              ))}
              <button type="button" aria-pressed={inverted} aria-label="Invertir orden" title="Invertir orden" onClick={() => setInverted(!inverted)}
                className={cx('ml-auto grid size-11 flex-none cursor-pointer place-items-center rounded-full border', inverted ? 'border-accent bg-accent-soft text-accent-soft-text' : 'border-line-strong bg-surface text-text hover:bg-surface-2')}>
                <Icon name="down" width={18} height={18} className={cx('transition-transform duration-(--t-base) motion-reduce:transition-none', inverted && 'rotate-180')} />
              </button>
            </div>
            {songs.isPending && <p role="status">Cargando canciones…</p>}
            {songs.isError && !songs.data && (
              <>
                <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la biblioteca">Revisa tu conexión e inténtalo de nuevo.</Notice>
                <Button variant="secondary" onClick={() => void songs.refetch()}>Reintentar</Button>
              </>
            )}
            {songs.data && rows.length > 0 && (
              <p aria-live="polite" className="m-0 text-[0.8125rem] text-text-2">
                {rows.length} {rows.length === 1 && !songs.hasNextPage ? 'canción' : 'canciones'}{songs.hasNextPage ? ' o más' : ''}
              </p>
            )}
            {rows.length > 0 && (
              <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
                {rows.map((song) => (
                  <li key={song.id} className={cx('flex items-center border-b border-line last:border-b-0', editing === song.id && 'bg-accent-soft')}>
                    {/* Escritorio con permiso: elegir abre el panel de edición, que ofrece la letra; en móvil abre la letra. */}
                    <button type="button" aria-current={editing === song.id ? 'true' : undefined} onClick={() => (desktop && canCreate ? edit(song) : void navigate(lyricsPath(song.id)))}
                      className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent px-4 text-left hover:bg-surface-2">
                      <SongRowBody song={song} count={order !== 'title'} />
                      {!canCreate && <Icon name="right" className="text-text-3" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {songs.hasNextPage && <Button variant="secondary" block loading={songs.isFetchingNextPage} onClick={() => void songs.fetchNextPage()}>Cargar más</Button>}
            {songs.data && rows.length === 0 && (
              <div className="grid justify-items-center gap-2 py-6 text-center">
                <h2 className="m-0 font-display text-lg font-bold">{term ? 'Sin resultados' : 'Aún no hay canciones'}</h2>
                <p className="m-0 text-text-2">{term ? 'Prueba con otro título o autor.' : canCreate ? 'Agrega la primera con «Nueva».' : 'La biblioteca la edita quien tenga ese acceso.'}</p>
                {term && canCreate && <Button variant="secondary" onClick={add}>Agregar «{term}»</Button>}
              </div>
            )}
          </main>
          <section aria-label="Canción" className={cx('min-w-0 flex-1 overflow-y-auto', panel ? 'block' : 'hidden lg:grid lg:place-items-center')}>
            {panel ? <Outlet /> : (
              <div className="grid justify-items-center gap-2 p-6 text-center text-text-2">
                <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-soft-text"><Icon name="music" /></span>
                <h2 className="m-0 font-display text-lg font-bold text-text">Elige una canción</h2>
                <p className="m-0">{canCreate ? 'O toca «Nueva» para agregar una a la biblioteca.' : 'Se abre su letra.'}</p>
              </div>
            )}
          </section>
        </div>
    </AppShell>
  )
}
