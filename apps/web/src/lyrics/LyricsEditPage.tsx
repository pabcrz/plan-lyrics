import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, Field, Icon, Notice, Sheet, Switch, TextField, Toast, inputClass } from '../ui'
import { ApiError } from '../calendar/api'
import { LyricsHeader, LyricsLoadFailure } from './LyricsPage'
import { useLyrics, useReloadLyrics, useSaveLyrics } from './lyrics-api'
import {
  blankSection, changed, cleanText, hasText, kindLabel, kinds, limits, moveItem, navState, toBody, toDraft,
  type DraftSection, type Lyrics, type SectionKind,
} from './lyrics-model'

/** Texto de un fallo al guardar; el servidor decide siempre permisos, versión y validez. */
export function saveFailureText(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 403) return 'No tienes permiso para editar letras.'
  if (status === 404) return 'Esta canción ya no existe en la biblioteca.'
  if (status === 400) return 'La letra no es válida. Revisa los textos e inténtalo de nuevo.'
  return 'No se pudo guardar la letra. Inténtalo de nuevo.'
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex min-h-14 items-center gap-1 border-b border-line px-2">
      <Button variant="quiet" icon aria-label="Volver a la letra" onClick={onBack}><Icon name="right" className="-scale-x-100" /></Button>
      <h1 className="m-0 font-display text-lg font-bold">{title}</h1>
    </div>
  )
}

/** Edición de la letra de una canción; solo para quien edita la biblioteca (la API lo exige además). */
export function LyricsEditPage() {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const nav = navState(useLocation().state)
  const query = useLyrics(songId, true)
  const viewPath = `/canciones/${encodeURIComponent(songId)}/letra`
  const lyrics = query.data

  if (lyrics?.canEdit) return <Editor key={query.dataUpdatedAt} songId={songId} lyrics={lyrics} title={nav.title ?? lyrics.title} back={nav.back} />
  return (
    <div className="mx-auto min-h-dvh max-w-[480px]">
      <Header title="Editar letra" onBack={() => void navigate(viewPath, { state: { title: nav.title, back: nav.back } })} />
      <main className="grid gap-4 p-4">
        {query.isPending && <p role="status" className="m-0 text-text-2">Cargando la letra…</p>}
        {query.isError && <LyricsLoadFailure error={query.error} onRetry={() => void query.refetch()} />}
        {lyrics && !lyrics.canEdit && (
          <>
            <Notice tone="warn" icon="lock" title="Solo quien edita la biblioteca puede editar letras">Puedes leerla, pero no cambiarla.</Notice>
            <Link to={viewPath} state={{ title: nav.title, back: nav.back }} className="inline-flex min-h-touch items-center font-semibold text-accent underline">Ver la letra</Link>
          </>
        )}
      </main>
    </div>
  )
}

type Undo = { message: string; restore: () => void }

function Editor({ songId, lyrics, title, back }: { songId: string; lyrics: Lyrics; title?: string; back?: string }) {
  const navigate = useNavigate()
  const save = useSaveLyrics(songId)
  const reload = useReloadLyrics(songId)
  const [sections, setSections] = useState<DraftSection[]>(() => toDraft(lyrics.sections))
  const [published, setPublished] = useState(lyrics.published)
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState<Undo | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const texts = useRef(new Map<string, HTMLTextAreaElement>())
  const list = useRef<HTMLDivElement>(null)
  const focusAfter = useRef<{ key: string; dir: 'up' | 'down' } | null>(null)

  const effective = published && sections.length > 0
  const dirty = changed(lyrics, sections, published)
  const viewPath = `/canciones/${encodeURIComponent(songId)}/letra`

  // Tras mover una tarjeta, el foco vuelve a su botón (el elemento puede haberse recolocado en el DOM).
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const find = (dir: string) => list.current?.querySelector<HTMLButtonElement>(`[data-move="${target.key}:${dir}"]`)
    const button = find(target.dir)
    ;(button && !button.disabled ? button : find(target.dir === 'up' ? 'down' : 'up'))?.focus()
  }, [sections])

  const patch = (key: string, change: Partial<DraftSection>) => {
    setSections((current) => current.map((section) => (section.key === key ? { ...section, ...change } : section)))
    setFailure('')
  }

  function move(index: number, to: number) {
    const moved = sections[index]
    focusAfter.current = { key: moved.key, dir: to < index ? 'up' : 'down' }
    setAnnouncement(`${moved.label.trim() || kindLabel(moved.kind)}, posición ${to + 1} de ${sections.length}`)
    setSections(moveItem(sections, index, to))
  }

  function remove(index: number) {
    const removed = sections[index]
    setSections(sections.filter((_, at) => at !== index))
    setNotice({ message: 'Sección quitada', restore: () => setSections((current) => { const next = [...current]; next.splice(Math.min(index, next.length), 0, removed); return next }) })
  }

  function add() {
    const added = blankSection()
    setSections([...sections, added])
    setAnnouncement(`Sección ${sections.length + 1} agregada`)
  }

  function requestSave() {
    const empty = sections.filter((section) => !hasText(section))
    setInvalid(new Set(empty.map((section) => section.key)))
    if (empty.length > 0) {
      texts.current.get(empty[0].key)?.focus()
      return
    }
    // Una letra que ya estaba publicada y sigue publicada cambia al instante lo que ve la congregación.
    if (lyrics.published && effective) setConfirming(true)
    else void send()
  }

  async function send() {
    setConfirming(false)
    setSending(true)
    setFailure('')
    try {
      await save(toBody(lyrics.version, sections, published))
      void navigate(viewPath, { replace: true, state: { title, back, saved: true } })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setConflict(true)
      else setFailure(saveFailureText(caught))
      setSending(false)
    }
  }

  const leave = () => void navigate(viewPath, { state: { title, back } })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <Header title="Editar letra" onBack={() => (dirty ? setLeaving(true) : leave())} />
      <main className="flex-1 pb-4">
        <LyricsHeader title={title} lyrics={lyrics} />
        <p role="status" className="sr-only">{announcement}</p>
        <div className="grid gap-3 px-4 pb-3 empty:hidden">
          {conflict && (
            <Notice tone="warn" icon="alert" role="alert" title="La letra cambió mientras la editabas">
              Otra persona guardó una versión nueva y la tuya no se guardó. Tus cambios siguen aquí hasta que recargues.
              <span className="mt-2 block"><Button variant="secondary" onClick={() => void reload()}>Recargar la letra</Button></span>
            </Notice>
          )}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          {lyrics.published && !conflict && <Notice tone="warn" icon="alert" title="Esta letra ya está publicada">Lo que guardes se verá enseguida en los enlaces compartidos con la congregación.</Notice>}
        </div>

        <div ref={list} className="grid gap-3 px-4">
          {sections.map((section, index) => {
            const number = index + 1
            const name = `Sección ${number} de ${sections.length}`
            const error = invalid.has(section.key) && !hasText(section)
            return (
              <div key={section.key} role="group" aria-label={name} className="grid gap-3 rounded-lg border border-line bg-surface px-4 pt-2 pb-4">
                <div className="-mx-2 flex items-center gap-0.5">
                  <b className="flex-1 pl-2 font-mono text-[0.8125rem] font-medium text-text-3" aria-hidden="true">{name}</b>
                  <Button variant="quiet" icon aria-label={`Subir sección ${number}`} disabled={index === 0} onClick={() => move(index, index - 1)}
                    data-move={`${section.key}:up`}><Icon name="down" className="rotate-180" /></Button>
                  <Button variant="quiet" icon aria-label={`Bajar sección ${number}`} disabled={index === sections.length - 1} onClick={() => move(index, index + 1)}
                    data-move={`${section.key}:down`}><Icon name="down" /></Button>
                  <Button variant="quiet" icon aria-label={`Quitar sección ${number}`} onClick={() => remove(index)}><Icon name="x" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tipo">
                    {(control) => (
                      <select {...control} value={section.kind} onChange={(event) => patch(section.key, { kind: event.target.value as SectionKind })} className={`${inputClass} bg-surface`}>
                        {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                      </select>
                    )}
                  </Field>
                  <div role="group" aria-labelledby={`${section.key}-rep`} className="grid gap-1.5">
                    <span id={`${section.key}-rep`} className="text-sm font-semibold">Se canta</span>
                    <div className="grid min-h-touch-lg grid-cols-[44px_1fr_44px] items-center rounded-md border border-line-strong bg-surface">
                      <button type="button" aria-label="Una vez menos" disabled={section.repeat <= 1} onClick={() => patch(section.key, { repeat: section.repeat - 1 })}
                        className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="minus" /></button>
                      <output className="text-center font-mono text-[0.9375rem] font-semibold">{section.repeat === 1 ? '1 vez' : `${section.repeat} veces`}</output>
                      <button type="button" aria-label="Una vez más" disabled={section.repeat >= limits.maxRepeat} onClick={() => patch(section.key, { repeat: section.repeat + 1 })}
                        className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="plus" /></button>
                    </div>
                  </div>
                </div>
                <TextField label={<>Etiqueta <span className="font-normal text-text-3">(opcional)</span></>} value={section.label} maxLength={limits.maxLabel} autoComplete="off"
                  placeholder="Por ejemplo, Estrofa 1" onChange={(event) => patch(section.key, { label: event.target.value })} />
                <Field label="Texto" help={`${cleanText(section.text).length} de ${limits.maxText} caracteres`} error={error ? 'Escribe el texto de la sección o quítala.' : undefined}>
                  {(control) => (
                    <textarea {...control} ref={(node) => { if (node) texts.current.set(section.key, node); else texts.current.delete(section.key) }} value={section.text} maxLength={limits.maxText} rows={5}
                      onChange={(event) => { patch(section.key, { text: event.target.value }); if (invalid.has(section.key)) setInvalid(new Set([...invalid].filter((key) => key !== section.key))) }}
                      className={`${inputClass} min-h-[132px] resize-y py-3 leading-normal`} />
                  )}
                </Field>
              </div>
            )
          })}
          {sections.length === 0 && <p className="m-0 rounded-lg border border-dashed border-line-strong bg-surface p-4 text-[0.9375rem]">Esta letra no tiene secciones. Agrega la primera.</p>}
          <Button variant="secondary" block disabled={sections.length >= limits.maxSections} onClick={add}><Icon name="plus" width={18} height={18} />Agregar sección</Button>
          {sections.length >= limits.maxSections && <p className="m-0 text-[0.8125rem] text-text-3">Una letra admite hasta {limits.maxSections} secciones.</p>}
          <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">
            <Switch checked={effective} onCheckedChange={setPublished} disabled={sections.length === 0} label="Publicable"
              description={sections.length === 0 ? 'Agrega al menos una sección para poder publicarla.' : 'Si está activa, la congregación ve esta letra en los enlaces compartidos.'} />
          </div>
        </div>
      </main>
      {notice && (
        <div className="fixed inset-x-0 bottom-32 z-40 mx-auto max-w-[480px] px-4">
          <Toast message={notice.message} onUndo={notice.restore} onDismiss={() => setNotice(null)} />
        </div>
      )}
      <div className="sticky bottom-0 grid gap-1 border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <Button block loading={sending} disabled={!dirty || conflict} onClick={requestSave}>Guardar</Button>
        {dirty && <Button variant="quiet" block onClick={() => { setSections(toDraft(lyrics.sections)); setPublished(lyrics.published); setInvalid(new Set()); setFailure(''); setConflict(false) }}>Descartar cambios</Button>}
      </div>
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="¿Guardar una letra publicada?">
        <div className="grid gap-3">
          <p className="m-0 text-[0.9375rem] text-text-2">Esta letra ya está publicada. Al guardar, el cambio se verá de inmediato en todos los enlaces compartidos con la congregación.</p>
          <p className="m-0 text-[0.8125rem] text-text-3">Si aún no está lista, desactiva «Publicable» y guárdala sin que se vea.</p>
          <Button block onClick={() => void send()}>Guardar y mantener publicada</Button>
          <Button variant="quiet" block onClick={() => setConfirming(false)}>Seguir editando</Button>
        </div>
      </Sheet>
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="¿Salir sin guardar?">
        <div className="grid gap-3">
          <p className="m-0 text-[0.9375rem] text-text-2">Tienes cambios sin guardar en esta letra. Si sales, se pierden.</p>
          <Button variant="danger" block onClick={leave}>Salir sin guardar</Button>
          <Button variant="quiet" block onClick={() => setLeaving(false)}>Seguir editando</Button>
        </div>
      </Sheet>
    </div>
  )
}
