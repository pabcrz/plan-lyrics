import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Button, Icon, Notice, Toast } from '../ui'
import { PageHeader } from '../calendar/ChurchGate'
import { ApiError } from '../calendar/api'
import { ChordLine, linesOf } from './ChordParts'
import { semitonesBetween } from './chords'
import { useLyrics, useTransposedLyrics, type Transposition } from './lyrics-api'
import { kindLabel, navState, type Lyrics } from './lyrics-model'

/** Cabecera común de la vista y la edición: estado de publicación y título de la canción. */
export function LyricsHeader({ title, lyrics }: { title?: string; lyrics?: Pick<Lyrics, 'published'> }) {
  return (
    <div className="relative px-4 pt-2 pb-4">
      <div aria-hidden="true" className="pointer-events-none absolute top-2 right-0 h-[25px] w-[100px] bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_1px,transparent_1px_6px)] mask-[linear-gradient(to_right,transparent,#000)]" />
      {lyrics && (
        lyrics.published
          ? <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-pub-bd bg-pub-bg py-0 pr-3 pl-2 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={14} height={14} />Publicada</span>
          : <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-dashed border-line-strong bg-draft-bg py-0 pr-3 pl-2 text-[0.8125rem] font-medium text-draft-fg"><Icon name="dash" width={14} height={14} />Sin publicar</span>
      )}
      <h1 className="mt-3 mb-1.5 font-display text-[1.625rem] leading-[1.1] font-bold tracking-tight [overflow-wrap:anywhere]">{title ?? 'Letra de la canción'}</h1>
    </div>
  )
}

/** Mensaje de un fallo al cargar la letra; el servidor decide siempre quién la ve. */
export function LyricsLoadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 403) return <Notice tone="warn" icon="lock" title="Tu cuenta no tiene acceso a las letras">Las letras son de la biblioteca compartida y las ve quien pertenece a una iglesia. Pide acceso a quien la administra.</Notice>
  if (status === 404) return <Notice title="No encontramos esta canción">Ya no existe en la biblioteca o el enlace no es válido.</Notice>
  return (
    <>
      <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la letra">Revisa tu conexión e inténtalo de nuevo.</Notice>
      <Button variant="secondary" onClick={onRetry}>Reintentar</Button>
    </>
  )
}

const mod12 = (value: number) => ((value % 12) + 12) % 12

/**
 * Qué pedir al servidor para mostrar los acordes: el tono del servicio (solo si es del mismo modo que la base) más lo que
 * la persona mueva a mano. Sin nada que mover, se muestran los acordes guardados.
 */
function requestFor(lyrics: Lyrics | undefined, serviceKey: string | undefined, offset: number): { request: Transposition | null; service: boolean } {
  const distance = lyrics?.key && serviceKey ? semitonesBetween(lyrics.key, serviceKey) : null
  if (!lyrics || !lyrics.sections.some((section) => section.chordPro)) return { request: null, service: false }
  const service = distance !== null && distance !== 0
  if (offset === 0) return { request: service ? { toKey: serviceKey! } : null, service }
  if (lyrics.key === null) return { request: { semitones: offset }, service: false }
  const total = mod12((distance ?? 0) + offset)
  return { request: total === 0 ? null : { semitones: total }, service }
}

/** Tonalidad base y actual, y el control para mover los acordes solo en pantalla (nada se guarda). */
function KeyBar({ base, now, serviceKey, offset, onOffset, note }: {
  base: string | null; now: string | null; serviceKey?: string; offset: number; onOffset: (value: number) => void; note?: string
}) {
  return (
    <div role="group" aria-label="Tonalidad" className="mx-4 mb-3 grid gap-3 rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-text-2">
        <span>Base <b className="font-mono text-[0.9375rem] font-medium text-text">{base ?? 'sin definir'}</b></span>
        {now && <span>Ahora <b className="rounded-sm bg-accent-soft px-2 py-0.5 font-mono text-[0.9375rem] font-medium text-accent-soft-text">{now}</b></span>}
      </div>
      <p className="m-0 text-[0.8125rem] text-text-3">
        {offset !== 0 ? 'Transposición manual solo en pantalla; no se guarda.' : note ?? (serviceKey ? 'Tono de este servicio. La letra guardada no cambia.' : 'Tono base de la canción.')}
      </p>
      <div role="group" aria-label="Transponer solo en pantalla" className="grid gap-1.5">
        <span className="text-sm font-semibold" aria-hidden="true">Transponer solo en pantalla</span>
        <div className="grid min-h-touch-lg grid-cols-[44px_1fr_44px] items-center rounded-md border border-line-strong bg-surface">
          <button type="button" aria-label="Medio tono abajo" disabled={offset <= -11} onClick={() => onOffset(offset - 1)}
            className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="minus" /></button>
          <output aria-label="Transposición manual" className="text-center font-mono text-[0.9375rem] font-semibold">{offset > 0 ? `+${offset}` : offset}</output>
          <button type="button" aria-label="Medio tono arriba" disabled={offset >= 11} onClick={() => onOffset(offset + 1)}
            className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="plus" /></button>
        </div>
        {offset !== 0 && <Button variant="quiet" onClick={() => onOffset(0)}>{serviceKey ? 'Volver al tono del servicio' : 'Volver al tono base'}</Button>}
      </div>
    </div>
  )
}

/** Letra de una canción por secciones, con sus acordes si los tiene; la ve cualquier integrante de una iglesia. */
export function LyricsPage() {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const { title, back = '/canciones', saved, key: serviceKey } = navState(useLocation().state)
  const query = useLyrics(songId)
  const [toast, setToast] = useState(saved === true)
  const [offset, setOffset] = useState(0)
  const stored = query.data
  const { request, service } = requestFor(stored, serviceKey, offset)
  const moved = useTransposedLyrics(songId, request)
  const hasChords = Boolean(stored?.sections.some((section) => section.chordPro))
  const failed = request !== null && moved.isError
  const waiting = request !== null && moved.isPending
  // Si no se pudo mover, se ven los acordes guardados y se dice cuál es la tonalidad.
  const lyrics = request !== null && moved.data && !failed ? moved.data : stored
  const unusable = hasChords && serviceKey && stored && (stored.key === null ? 'La canción no tiene tonalidad guardada, así que los acordes se ven como están guardados.' : semitonesBetween(stored.key, serviceKey) === null ? `El tono de este servicio (${serviceKey}) no es del mismo modo que el de la canción; se muestra el tono base.` : undefined)
  const editState = { title, back, key: serviceKey }
  const go = (suffix: string) => void navigate(`/canciones/${encodeURIComponent(songId)}/letra/${suffix}`, { state: editState })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] lg:max-w-[720px] flex-col">
      <PageHeader title="Letra" backLabel="Volver" back={back} />
      <main className="flex-1 pb-4">
        {query.isPending && <p role="status" className="m-0 p-4 text-text-2">Cargando la letra…</p>}
        {query.isError && <div className="grid gap-4 p-4"><LyricsLoadFailure error={query.error} onRetry={() => void query.refetch()} /></div>}
        {lyrics && stored && (
          <>
            <LyricsHeader title={title ?? lyrics.title} lyrics={lyrics} />
            {hasChords && <KeyBar base={stored.key} now={lyrics.key} serviceKey={service ? serviceKey : undefined} offset={offset} onOffset={setOffset} note={unusable || undefined} />}
            {failed && <div className="px-4 pb-3"><Notice tone="warn" icon="alert" role="alert" title="No se pudo transponer">Se muestran los acordes como están guardados. Inténtalo de nuevo.</Notice></div>}
            {waiting && <p role="status" className="m-0 px-4 pb-3 text-sm text-text-2">Calculando los acordes…</p>}
            {lyrics.sections.length === 0 ? (
              <div className="mx-4 mb-4 grid justify-items-center gap-2 rounded-lg border border-line bg-surface px-4 py-8 text-center">
                <span className="mb-1 grid size-14 place-items-center rounded-full bg-accent-soft text-accent-soft-text"><Icon name="music" width={26} height={26} /></span>
                <h2 className="m-0 font-display text-lg font-bold">Esta canción aún no tiene letra</h2>
                <p className="m-0 text-sm text-text-2">{lyrics.canEdit ? 'Escríbela por secciones: intro, estrofas, coro, puente y cierre.' : 'Quien edita la biblioteca todavía no la ha escrito.'}</p>
              </div>
            ) : (
              <>
                {!lyrics.published && <p className="m-0 px-4 pb-3 text-[0.8125rem] text-text-3">Solo la ve el equipo; la congregación no la ve en los enlaces compartidos.</p>}
                <ul aria-label="Secciones de la letra" className="m-0 grid list-none gap-3 p-0 px-4">
                  {lyrics.sections.map((section, index) => (
                    <li key={index} className="grid gap-2 rounded-lg border border-line bg-surface p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-sm bg-accent-soft px-2 py-0.5 text-xs font-semibold tracking-wide text-accent-soft-text uppercase">{kindLabel(section.kind)}</span>
                        {section.label && <span className="text-[0.9375rem] font-semibold">{section.label}</span>}
                        {section.repeat > 1 && <span aria-label={`Se canta ${section.repeat} veces`} className="ml-auto font-mono text-[0.8125rem] font-medium text-text-2">×{section.repeat}</span>}
                      </div>
                      {section.chordPro
                        ? <div className="grid gap-1">{linesOf(section).map((line, at) => <ChordLine key={at} line={line} />)}</div>
                        : <p className="m-0 text-[1.0625rem] leading-[1.65] whitespace-pre-line [overflow-wrap:anywhere]">{section.text}</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </main>
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-40 mx-auto max-w-[480px] lg:max-w-[720px] px-4">
          <Toast message="Letra guardada" onDismiss={() => setToast(false)} />
        </div>
      )}
      {stored && (
        <div className="sticky bottom-0 grid gap-1 border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {stored.canEdit ? (
            stored.sections.length === 0
              ? <Button block onClick={() => go('editar')}>Escribir letra</Button>
              : <>
                  <Button block onClick={() => go('acordes')}>Editar acordes</Button>
                  <Button variant="quiet" block onClick={() => go('editar')}>Editar letra</Button>
                </>
          ) : (
            <p className="m-0 text-center text-sm text-text-2">Solo quien edita la biblioteca puede cambiar la letra y los acordes.</p>
          )}
        </div>
      )}
    </div>
  )
}
