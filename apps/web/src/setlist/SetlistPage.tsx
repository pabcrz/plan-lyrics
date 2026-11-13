import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { Button, Icon, Notice, StatusChip, Toast, format12h, from24h, type ServiceStatus } from '../ui'
import { PageHeader } from '../calendar/ChurchGate'
import { ApiError } from '../calendar/api'
import { formatLongDay, monthOf } from '../calendar/dates'
import { AddSheet, EditSheet } from './SetlistSheets'
import { moveItem, useDragReorder, type Rect } from './reorder'
import { entryLabel, referenceOrigin, useSetlist, useSetlistActions, type Entry, type NewEntry, type Setlist } from './setlist-api'

const slotText = { SINGLE: '', MORNING: ' · Mañana', AFTERNOON: ' · Tarde' } as const
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Texto de un fallo al cambiar el setlist; el servidor decide siempre permisos, duplicados y versión. */
export function failureText(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0
  const code = error instanceof ApiError ? error.code : ''
  if (status === 403) return 'No tienes permiso para cambiar el setlist.'
  if (code === 'Setlist changed') return 'El setlist cambió mientras lo ordenabas. Se actualizó con la versión más reciente.'
  if (code === 'Song already in setlist') return 'Esa canción ya está en el setlist.'
  if (code === 'Setlist full') return 'El setlist llegó al máximo de 100 elementos.'
  if (status === 404) return 'Ese elemento ya no existe. Se actualizó la lista.'
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}

export function SetlistPage() {
  const { serviceId = '' } = useParams()
  const query = useSetlist(serviceId)
  if (query.data) return <Editor key={serviceId} setlist={query.data} />
  const missing = query.error instanceof ApiError && query.error.status === 404
  return (
    <div className="mx-auto min-h-dvh max-w-[480px]">
      <PageHeader title="Setlist" backLabel="Volver al calendario" />
      <main className="grid gap-4 p-4">
        {query.isPending && <p role="status" className="m-0 text-text-2">Cargando el setlist…</p>}
        {missing && <Notice title="No encontramos este servicio">No existe en tu iglesia o ya no está disponible.</Notice>}
        {query.isError && !missing && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el setlist">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void query.refetch()}>Reintentar</Button>
          </>
        )}
      </main>
    </div>
  )
}

type Sheet = { kind: 'add' } | { kind: 'edit'; id: string } | null
type Undo = { message: string; restore?: () => void }

function Editor({ setlist }: { setlist: Setlist }) {
  const { service, entries, canEdit, canCreateSongs } = setlist
  const actions = useSetlistActions(service.id)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [notice, setNotice] = useState<Undo | null>(null)
  const [failure, setFailure] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const focusAfterMove = useRef<string | null>(null)
  const rows = useRef(new Map<string, HTMLElement>())
  const grips = useRef(new Map<string, HTMLElement>())

  const songs = entries.filter((entry) => entry.kind === 'SONG').length
  const moments = entries.length - songs
  const summary = entries.length === 0 ? '' : `${songs} ${songs === 1 ? 'canción' : 'canciones'} · ${moments} ${moments === 1 ? 'momento' : 'momentos'}`

  async function perform<T>(action: () => Promise<T>): Promise<T | undefined> {
    setFailure('')
    try {
      return await action()
    } catch (caught) {
      setFailure(failureText(caught))
      if (caught instanceof ApiError && (caught.status === 404 || caught.code === 'Song already in setlist')) void actions.reload()
      return undefined
    }
  }

  const { drag, gripProps, rowStyle } = useDragReorder({
    count: entries.length,
    rowRects: () => entries.map((entry): Rect => {
      const box = rows.current.get(entry.id)?.getBoundingClientRect()
      return { top: (box?.top ?? 0) + window.scrollY, height: box?.height ?? 0 }
    }),
    onMove(from, to) {
      const moved = entries[from]
      setAnnouncement(`${entryLabel(moved)}, posición ${to + 1} de ${entries.length}`)
      focusAfterMove.current = moved.id
      void perform(() => actions.reorder(moveItem(entries.map((entry) => entry.id), from, to)))
    },
  })

  // Tras mover una fila, el foco vuelve a su asa (el elemento puede haberse recolocado en el DOM).
  useEffect(() => {
    if (!focusAfterMove.current) return
    grips.current.get(focusAfterMove.current)?.focus()
    focusAfterMove.current = null
  }, [entries])

  async function addEntry(entry: NewEntry, label: string, feminine: boolean) {
    const saved = await perform(() => actions.add(entry))
    if (!saved) return false
    setSheet(null)
    setNotice({ message: `«${label}» ${feminine ? 'agregada' : 'agregado'}` })
    return true
  }

  async function removeEntry(entry: Entry, index: number) {
    setSheet(null)
    const saved = await perform(() => actions.remove(entry.id))
    if (!saved) return
    const restore: NewEntry = entry.song ? { songId: entry.song.id, key: entry.key, link: entry.link, position: index } : { moment: entry.moment ?? '', position: index }
    setNotice({ message: `«${entryLabel(entry)}» quitado`, restore: () => void perform(() => actions.add(restore)) })
  }

  const editing = sheet?.kind === 'edit' ? entries.find((entry) => entry.id === sheet.id) : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <PageHeader title="Setlist" backLabel="Volver al calendario" back={`/?mes=${monthOf(service.date)}`} />
      <main className="flex-1 pb-4">
        <div className="relative px-4 pt-2 pb-4">
          <div aria-hidden="true" className="pointer-events-none absolute top-2 right-0 h-[25px] w-[100px] bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_1px,transparent_1px_6px)] mask-[linear-gradient(to_right,transparent,#000)]" />
          <StatusChip status={service.status.toLowerCase() as ServiceStatus} />
          <h1 className="mt-3 mb-1.5 font-display text-[1.625rem] leading-[1.1] font-bold tracking-tight">{service.title}</h1>
          <p className="m-0 flex flex-wrap gap-x-3 text-[0.9375rem] text-text-2">
            <span>{capitalize(formatLongDay(service.date).replace(',', ''))}</span>
            <span>{service.time ? format12h(from24h(service.time)) : 'Sin hora fija'}{slotText[service.slot]}</span>
          </p>
        </div>
        <p aria-live="polite" className="m-0 px-4 pb-2 text-[0.8125rem] text-text-3">{summary}</p>
        <p role="status" aria-live="assertive" className="sr-only">{announcement}</p>
        {failure && <div className="px-4 pb-3"><Notice tone="warn" icon="alert" role="alert">{failure}</Notice></div>}

        {entries.length === 0 ? (
          <div className="mx-4 mb-4 grid gap-1 rounded-lg border border-dashed border-line-strong bg-surface p-4 text-[0.9375rem]">
            <p className="m-0 font-bold">El setlist está vacío</p>
            <p className="m-0">{canEdit ? 'Agrega canciones de la biblioteca y los momentos del servicio, en el orden en que ocurren.' : 'Quien edita los servicios todavía no lo ha preparado.'}</p>
          </div>
        ) : (
          <>
            <ul aria-label="Setlist" className="mx-4 mb-3 list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
              {entries.map((entry, index) => {
                const moment = entry.kind === 'MOMENT'
                const origin = entry.link ? referenceOrigin(entry.link) : null
                const label = entryLabel(entry)
                const dragging = drag?.from === index
                return (
                  <li key={entry.id} ref={(node) => { if (node) rows.current.set(entry.id, node); else rows.current.delete(entry.id) }} style={rowStyle(index)}
                    className={`relative grid min-h-[68px] items-center gap-1 border-b border-line py-0 pl-3 transition-transform duration-(--t-fast) ease-out last:border-b-0 ${canEdit ? 'grid-cols-[28px_1fr_44px] pr-1' : 'grid-cols-[28px_1fr] pr-3'} ${moment ? 'bg-surface-2' : 'bg-surface'} ${dragging ? 'z-10 bg-surface shadow-3 outline-[1.5px] -outline-offset-[1.5px] outline-accent' : ''}`}>
                    <span className="text-center font-mono text-[0.8125rem] text-text-3 tabular-nums">{index + 1}</span>
                    <button type="button" onClick={() => setSheet({ kind: 'edit', id: entry.id })} aria-label={`${canEdit ? 'Editar' : 'Ver'} ${label}`}
                      className="block min-h-14 w-full min-w-0 cursor-pointer rounded-md border-0 bg-transparent px-2 py-2 text-left hover:bg-surface-2">
                      <b className={`block text-[0.9375rem] leading-tight [overflow-wrap:anywhere] ${moment ? 'font-medium text-text-2' : 'font-semibold'}`}>{label}</b>
                      <small className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-text-2">
                        {moment ? (
                          <span className="inline-flex items-center gap-1"><Icon name="clock" width={13} height={13} />Momento</span>
                        ) : (
                          <>
                            <span>{entry.song?.author}</span>
                            {entry.key ? <span className="rounded-sm bg-accent-soft px-2 py-0.5 font-mono font-medium text-accent-soft-text">{entry.key}</span> : <span className="text-text-3">Sin tonalidad</span>}
                            {origin && <span className="inline-flex items-center gap-1"><Icon name="link" width={13} height={13} />{origin}</span>}
                          </>
                        )}
                      </small>
                    </button>
                    {canEdit && (
                      <button type="button" ref={(node) => { if (node) grips.current.set(entry.id, node); else grips.current.delete(entry.id) }} {...gripProps(index)}
                        aria-label={`Mover ${label}. Posición ${index + 1} de ${entries.length}. Usa las flechas arriba y abajo.`}
                        className="grid min-h-14 w-11 cursor-grab touch-none place-items-center rounded-md border-0 bg-transparent text-text-3 hover:bg-surface-2 hover:text-text">
                        <Icon name="grip" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            {canEdit && <p className="m-0 px-4 pb-2 text-[0.8125rem] text-text-3">Arrastra el asa para reordenar. Con teclado, usa las flechas arriba y abajo sobre el asa.</p>}
          </>
        )}
        <div className="px-4 pt-2">
          <Notice title="Lo interno no se publica">Los tonos, el BPM y las notas son solo para el equipo. La vista pública muestra títulos y letras.</Notice>
        </div>
      </main>
      {notice && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-[480px] px-4">
          <Toast message={notice.message} onUndo={notice.restore} onDismiss={() => setNotice(null)} />
        </div>
      )}
      <div className="sticky bottom-0 grid gap-1 border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        {canEdit ? (
          <Button block onClick={() => setSheet({ kind: 'add' })}><Icon name="plus" width={18} height={18} />Agregar al setlist</Button>
        ) : (
          <p className="m-0 text-center text-sm text-text-2">Solo quien edita los servicios puede cambiar el setlist.</p>
        )}
      </div>
      {sheet?.kind === 'add' && (
        <AddSheet entries={entries} canCreateSongs={canCreateSongs} onClose={() => setSheet(null)} createSong={actions.createSong}
          onAddSong={(song) => addEntry({ songId: song.id }, song.title, true)} onAddMoment={(name) => addEntry({ moment: name }, name, false)} />
      )}
      {editing && (
        <EditSheet entry={editing} canEdit={canEdit} onClose={() => setSheet(null)} onRemove={() => void removeEntry(editing, entries.indexOf(editing))}
          onSave={async (patch) => { if (await perform(() => actions.edit(editing.id, patch))) setSheet(null) }} />
      )}
    </div>
  )
}
