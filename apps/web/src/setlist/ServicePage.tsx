import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar, Button, Icon, Notice, StatusChip, Toast, format12h, from24h } from '../ui'
import { AppShell } from '../calendar/AppShell'
import { ChurchGate } from '../calendar/ChurchGate'
import { ApiError, useServices, type AgendaService } from '../calendar/api'
import { formatLongDay, monthOf, todayIn } from '../calendar/dates'
import type { Church } from '../calendar/model'
import { PreachingSection } from '../calendar/PreachingSection'
import { ServiceParticipations } from '../calendar/ServiceParticipations'
import { AddSheet, EditSheet } from './SetlistSheets'
import { EditServiceSheet } from './EditServiceSheet'
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
  if (code === 'Song repeat rule') return 'Esa canción no puede repetirse todavía según la regla de la iglesia. Elige otra.'
  if (status === 404) return 'Ese elemento ya no existe. Se actualizó la lista.'
  return 'No se pudo guardar el cambio. Inténtalo de nuevo.'
}

export function ServicePage() {
  return <ChurchGate>{(church) => <Screen church={church} />}</ChurchGate>
}

/** Pantalla del servicio: datos, setlist, participaciones y predicación juntos; qué se puede cambiar lo decide el servidor. */
function Screen({ church }: { church: Church }) {
  const { serviceId = '' } = useParams()
  const navigate = useNavigate()
  const query = useSetlist(serviceId)
  const month = query.data ? monthOf(query.data.service.date) : ''
  // La dirección y lo demás del servicio vienen de la lista del mes (no hay lectura de un servicio suelto).
  // Sin red, un servicio de otra iglesia no está en esa lista: se toma de la agenda guardada.
  const listed = useServices(month ? [month] : []).services.find((item) => item.id === serviceId)
  const agendaItem = useQueryClient().getQueryData<AgendaService[]>(['agenda'])?.find((item) => item.id === serviceId)
  const service = listed ?? agendaItem
  const other = agendaItem && agendaItem.churchId !== church.id ? agendaItem : undefined
  const missing = query.error instanceof ApiError && query.error.status === 404
  // Si la iglesia activa ya no tiene el servicio, no se muestra lo guardado de antes.
  const setlist = missing ? undefined : query.data
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const back = setlist && monthOf(setlist.service.date) !== monthOf(todayIn()) ? `/?mes=${monthOf(setlist.service.date)}` : '/'

  return (
    <AppShell church={church} current="home" wide>
      <main className="grid flex-1 content-start gap-4 p-4 lg:px-6">
        <Link to={back} className="flex min-h-11 w-fit items-center gap-1 font-semibold text-accent no-underline hover:underline lg:hidden"><Icon name="right" className="-scale-x-100" />Inicio</Link>
        {query.isPending && <p role="status" className="m-0 text-text-2">Cargando el servicio…</p>}
        {missing && <Notice title="No encontramos este servicio">No existe en tu iglesia o ya no está disponible.</Notice>}
        {query.isError && !missing && !setlist && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el servicio">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void query.refetch()}>Reintentar</Button>
          </>
        )}
        {setlist && (
          <>
            <header className="grid justify-items-start gap-2">
              <div className="flex w-full items-center justify-between gap-3">
                {setlist.service.status === 'CANCELLED' && <StatusChip status="cancelled" />}
                {setlist.canEdit && <Button variant="secondary" onClick={() => setEditing(true)}><Icon name="edit" width={16} height={16} />Editar servicio</Button>}
              </div>
              {other && <p className="m-0 text-sm font-semibold text-accent">Servicio de {other.churchName}</p>}
              {saved && <p role="status" className="m-0 text-[0.8125rem] font-medium text-pub-fg">Servicio actualizado</p>}
              <h1 className="m-0 font-display text-[1.75rem] leading-[1.1] font-bold tracking-tight">{setlist.service.title}</h1>
              <p className="m-0 flex flex-wrap gap-x-3 text-[0.9375rem] text-text-2">
                <span>{capitalize(formatLongDay(setlist.service.date).replace(',', ''))}</span>
                <span>{setlist.service.time ? format12h(from24h(setlist.service.time)) : 'Sin hora fija'}{slotText[setlist.service.slot]}</span>
              </p>
              {service?.director && (
                <div className="flex items-center gap-3">
                  <Avatar name={service.director.name} />
                  <span><small className="block text-[0.8125rem] text-text-3">Dirige</small><b className="font-semibold">{service.director.name}</b></span>
                </div>
              )}
              {service && !service.director && (
                <p className="m-0 flex flex-wrap items-center gap-x-3 text-[0.9375rem] text-text-2">
                  <span>Sin director</span>
                  {setlist.canEdit && <Button variant="secondary" onClick={() => setEditing(true)}>Asignar director</Button>}
                </p>
              )}
            </header>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <SetlistSection key={serviceId} setlist={setlist} />
              {service && (
                <div className="grid gap-4">
                  <div className="rounded-lg border border-line bg-surface p-4"><ServiceParticipations service={service} canEdit={setlist.canEdit} /></div>
                  {(other ? Boolean(other.preaching) : church.usesPreaching) && <div className="rounded-lg border border-line bg-surface p-4"><PreachingSection service={service} canEdit={setlist.canEdit} /></div>}
                </div>
              )}
            </div>
            {editing && (
              <EditServiceSheet church={church} service={setlist.service} directorId={service?.director?.id} onClose={() => setEditing(false)}
                onSaved={() => { setEditing(false); setSaved(true) }} onDeleted={() => void navigate('/', { replace: true })} />
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}

type Sheet = { kind: 'add' } | { kind: 'edit'; id: string } | null
type Undo = { message: string; restore?: () => void }

function SetlistSection({ setlist }: { setlist: Setlist }) {
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
    <section aria-labelledby="setlist-title" className="grid content-start gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <h2 id="setlist-title" className="m-0 flex-1 font-display text-[1.0625rem] font-bold">
          Setlist<small aria-live="polite" className="block font-body text-[0.8125rem] font-normal text-text-3">{summary}</small>
        </h2>
        {canEdit && <Button variant="secondary" onClick={() => setSheet({ kind: 'add' })}><Icon name="plus" width={18} height={18} />Agregar</Button>}
      </div>
      <p role="status" aria-live="assertive" className="sr-only">{announcement}</p>
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}

        {entries.length === 0 ? (
          <div className="grid gap-1 text-[0.9375rem]">
            <p className="m-0 font-bold">El setlist está vacío</p>
            <p className="m-0">{canEdit ? 'Agrega canciones de la biblioteca y los momentos del servicio, en el orden en que ocurren.' : 'Quien edita los servicios todavía no lo ha preparado.'}</p>
          </div>
        ) : (
          <>
            <ul aria-label="Setlist" className="m-0 list-none overflow-hidden rounded-md border border-line p-0">
              {entries.map((entry, index) => {
                const moment = entry.kind === 'MOMENT'
                const origin = entry.link ? referenceOrigin(entry.link) : null
                const label = entryLabel(entry)
                const dragging = drag?.from === index
                return (
                  <li key={entry.id} ref={(node) => { if (node) rows.current.set(entry.id, node); else rows.current.delete(entry.id) }} style={rowStyle(index)}
                    className={`relative grid min-h-[68px] items-center gap-1 border-b border-line py-0 pl-3 transition-transform duration-(--t-fast) ease-out last:border-b-0 ${canEdit ? 'grid-cols-[28px_1fr_44px] pr-1' : 'grid-cols-[28px_1fr] pr-3'} ${dragging ? '' : moment ? 'bg-surface-2' : 'bg-surface'} ${dragging ? 'z-10 bg-accent-soft shadow-2' : ''}`}>
                    <span className="text-center font-mono text-[0.8125rem] text-text-3 tabular-nums">{index + 1}</span>
                    <button type="button" onClick={() => setSheet({ kind: 'edit', id: entry.id })} aria-label={`${canEdit ? 'Editar' : 'Ver'} ${label}`}
                      className="block min-h-14 w-full min-w-0 cursor-pointer rounded-md border-0 bg-transparent px-2 py-2 text-left hover:bg-surface-2">
                      <b className={`block text-[0.9375rem] leading-tight [overflow-wrap:anywhere] ${moment ? 'font-medium text-text-2' : 'font-semibold'}`}>{label}</b>
                      <small className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-text-2">
                        {moment ? (
                          <span className="inline-flex items-center gap-1"><Icon name="clock" width={13} height={13} />Momento</span>
                        ) : (
                          <>
                            {entry.song?.author && <span>{entry.song.author}</span>}
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
            {canEdit && <p className="m-0 text-[0.8125rem] text-text-3">Arrastra el asa para reordenar. Con teclado, usa las flechas arriba y abajo sobre el asa.</p>}
          </>
        )}
      {canEdit && <InternalNotice />}
      {notice && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-[480px] lg:max-w-[720px] px-4">
          <Toast message={notice.message} onUndo={notice.restore} onDismiss={() => setNotice(null)} />
        </div>
      )}
      {sheet?.kind === 'add' && (
        <AddSheet serviceId={service.id} entries={entries} canCreateSongs={canCreateSongs} onClose={() => setSheet(null)} createSong={actions.createSong}
          onAddSong={(song) => addEntry({ songId: song.id }, song.title, true)} onAddMoment={(name) => addEntry({ moment: name }, name, false)} />
      )}
      {editing && (
        <EditSheet entry={editing} canEdit={canEdit} canEditSong={canCreateSongs} onClose={() => setSheet(null)} onRemove={() => void removeEntry(editing, entries.indexOf(editing))}
          onSave={async (patch) => { if (await perform(() => actions.edit(editing.id, patch))) setSheet(null) }} />
      )}
    </section>
  )
}

const SEEN = 'plan-lyrics.seen.internal-notice'

/** Aviso de lo que no se publica: lo ven una sola vez quienes editan; después de la primera vista no vuelve, para no hacer ruido. */
function InternalNotice() {
  const [show] = useState(() => { try { return localStorage.getItem(SEEN) === null } catch { return false } })
  useEffect(() => { try { localStorage.setItem(SEEN, '1') } catch { /* sin almacenamiento: no se vuelve a mostrar en esta sesión */ } }, [])
  if (!show) return null
  return <Notice title="Lo interno no se publica">Los tonos, el BPM y las notas son solo para el equipo. La vista pública muestra títulos y letras.</Notice>
}
