import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Button, Icon, Notice, Segmented, Sheet, TextField } from '../ui'
import { ApiError } from '../calendar/api'
import { ChordLine, ChordsLost, PositionRuler, linesOf } from './ChordParts'
import { EditHeader } from './LyricsEditPage'
import { LyricsHeader, LyricsLoadFailure } from './LyricsPage'
import { isChord, keysOfMode, parseKey, serializeLines, type Line } from './chords'
import { useLyrics, useReloadLyrics, useSaveLyrics, type LyricsBody } from './lyrics-api'
import { kindLabel, navState, newKey, type Lyrics } from './lyrics-model'

type Draft = { id: string; lines: Line[] }
/** Un acorde en la hoja: `index` es su lugar en la línea (`null` si es nuevo). */
type Editing = { section: number; line: number; index: number | null; chord: string; offset: number }

const invalidChord = (value: string) => `«${value}» no es un acorde válido. Usa una nota de A a G, con # o b, y una terminación como m, 7, maj7 o sus4.`

function failureText(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 403) return 'No tienes permiso para editar acordes.'
  if (status === 404) return 'Esta canción ya no existe en la biblioteca.'
  if (status === 400) return 'No se guardó: algún acorde o el texto no es válido. Revisa los acordes (por ejemplo, Am, C/G o F#m7) e inténtalo de nuevo.'
  return 'No se pudieron guardar los acordes. Inténtalo de nuevo.'
}

const chordPro = (lines: Line[]) => (lines.some((line) => line.chords.length > 0) ? serializeLines(lines) : null)

/** Edición de los acordes de una letra: nunca toca el texto, solo dónde cae cada acorde y la tonalidad base. */
export function ChordsEditPage() {
  const { songId = '' } = useParams()
  const navigate = useNavigate()
  const nav = navState(useLocation().state)
  const query = useLyrics(songId, true)
  const lyrics = query.data
  const viewPath = `/canciones/${encodeURIComponent(songId)}/letra`
  const state = { title: nav.title, back: nav.back, key: nav.key }

  if (lyrics?.canEdit && lyrics.sections.length > 0) return <Editor key={query.dataUpdatedAt} songId={songId} lyrics={lyrics} nav={nav} />
  return (
    <div className="mx-auto min-h-dvh max-w-[480px] lg:max-w-[720px]">
      <EditHeader title="Editar acordes" onBack={() => void navigate(viewPath, { state })} />
      <main className="grid gap-4 p-4">
        {query.isPending && <p role="status" className="m-0 text-text-2">Cargando la letra…</p>}
        {query.isError && <LyricsLoadFailure error={query.error} onRetry={() => void query.refetch()} />}
        {lyrics && !lyrics.canEdit && (
          <>
            <Notice tone="warn" icon="lock" title="Solo quien edita la biblioteca puede editar acordes">Puedes leerlos, pero no cambiarlos.</Notice>
            <Link to={viewPath} state={state} className="inline-flex min-h-touch items-center font-semibold text-accent underline">Ver la letra</Link>
          </>
        )}
        {lyrics?.canEdit && (
          <>
            <Notice icon="music" title="Primero escribe la letra">Los acordes van sobre el texto de cada sección; esta canción aún no tiene letra.</Notice>
            <Link to={`${viewPath}/editar`} state={state} className="inline-flex min-h-touch items-center font-semibold text-accent underline">Escribir letra</Link>
          </>
        )}
      </main>
    </div>
  )
}

function Editor({ songId, lyrics, nav }: { songId: string; lyrics: Lyrics; nav: ReturnType<typeof navState> }) {
  const navigate = useNavigate()
  const save = useSaveLyrics(songId)
  const reload = useReloadLyrics(songId)
  const [drafts, setDrafts] = useState<Draft[]>(() => lyrics.sections.map((section) => ({ id: newKey(), lines: linesOf(section) })))
  const [baseKey, setBaseKey] = useState(lyrics.key)
  const [minor, setMinor] = useState(parseKey(lyrics.key ?? '')?.minor ?? false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [chordError, setChordError] = useState('')
  const [sending, setSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [lost, setLost] = useState<ApiError['affected'] | null>(null)
  const [failure, setFailure] = useState('')
  const viewPath = `/canciones/${encodeURIComponent(songId)}/letra`
  const state = { title: nav.title, back: nav.back, key: nav.key }

  const dirty = baseKey !== lyrics.key || drafts.some((draft, index) => chordPro(draft.lines) !== (lyrics.sections[index]!.chordPro || null))
  const touched = () => { setFailure(''); setLost(null) }

  function open(next: Editing) { setChordError(''); setEditing(next) }

  const lineOf = (at: Editing) => drafts[at.section]!.lines[at.line]!
  /** La línea con el acorde de la hoja puesto donde se está eligiendo, para la vista previa y para aceptar. */
  function withChord(at: Editing, remove = false): Line {
    const { text, chords } = lineOf(at)
    const rest = chords.filter((_, index) => index !== at.index)
    if (remove) return { text, chords: rest }
    const next = rest.findIndex((mark) => mark.offset > at.offset)
    rest.splice(next < 0 ? rest.length : next, 0, { offset: at.offset, chord: at.chord.trim() || '?' })
    return { text, chords: rest }
  }

  function apply(at: Editing, line: Line) {
    setDrafts((current) => current.map((draft, index) => (index === at.section ? { ...draft, lines: draft.lines.map((old, i) => (i === at.line ? line : old)) } : draft)))
    setEditing(null)
    touched()
  }

  function accept() {
    if (!editing) return
    const name = editing.chord.trim()
    if (!name) { setChordError('Escribe el acorde.'); return }
    if (!isChord(name)) { setChordError(invalidChord(name)); return }
    apply(editing, withChord(editing))
  }

  async function send() {
    setSending(true)
    touched()
    // Siempre `chordPro` explícito: con acordes viaja solo él (el texto sale de él); sin ellos, `null` y el texto.
    const body: LyricsBody = {
      version: lyrics.version, published: lyrics.published, key: baseKey,
      sections: drafts.map(({ lines }, index) => {
        const { kind, label, repeat } = lyrics.sections[index]!
        const marked = chordPro(lines)
        return marked === null ? { kind, label, repeat, text: lines.map((line) => line.text).join('\n'), chordPro: null } : { kind, label, repeat, chordPro: marked }
      }),
    }
    try {
      await save(body)
      void navigate(viewPath, { replace: true, state: { ...state, saved: true } })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        if (caught.code === 'chords_would_be_lost') setLost(caught.affected)
        else setConflict(true)
      } else setFailure(failureText(caught))
      setSending(false)
    }
  }

  const leave = () => void navigate(viewPath, { state })
  const keys = keysOfMode(minor)
  const sheetLine = editing && withChord(editing)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] lg:max-w-[720px] flex-col">
      <EditHeader title="Editar acordes" onBack={() => (dirty ? setLeaving(true) : leave())} />
      <main className="flex-1 pb-4">
        <LyricsHeader title={nav.title} lyrics={lyrics} />
        <div className="grid gap-3 px-4 pb-3 empty:hidden">
          {conflict && (
            <Notice tone="warn" icon="alert" role="alert" title="La letra cambió mientras la editabas">
              Otra persona guardó una versión nueva y la tuya no se guardó. Tus cambios siguen aquí hasta que recargues.
              <span className="mt-2 block"><Button variant="secondary" onClick={() => void reload()}>Recargar la letra</Button></span>
            </Notice>
          )}
          {lost && <ChordsLost sections={lost} intro="Con lo que intentas guardar, los acordes de estas secciones no se podrían conservar. No se guardó nada." onReload={() => void reload()} />}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        </div>

        <div className="grid gap-3 px-4">
          <div role="group" aria-label="Tonalidad base de la canción" className="grid gap-2 rounded-lg border border-line bg-surface p-4">
            <span className="text-sm font-semibold" aria-hidden="true">Tonalidad base de la canción</span>
            <Segmented label="Modo" value={minor ? 'minor' : 'major'} onChange={(value) => setMinor(value === 'minor')} options={[{ value: 'major', label: 'Mayor' }, { value: 'minor', label: 'Menor' }]} />
            <div className="grid grid-cols-4 gap-1.5">
              {keys.map((name) => (
                <button key={name} type="button" aria-pressed={baseKey === name} onClick={() => { setBaseKey(baseKey === name ? null : name); touched() }}
                  className={`min-h-touch cursor-pointer rounded-md border font-mono text-[0.9375rem] font-semibold ${baseKey === name ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text'}`}>{name}</button>
              ))}
            </div>
            <p className="m-0 text-[0.8125rem] text-text-3">Toca de nuevo la tonalidad elegida para quitarla. Es un dato interno: la congregación nunca la ve.</p>
          </div>

          {drafts.map((draft, sectionIndex) => {
            const section = lyrics.sections[sectionIndex]!
            return (
              <div key={draft.id} role="group" aria-label={`Sección ${sectionIndex + 1} de ${drafts.length}${section.label ? `, ${section.label}` : `, ${kindLabel(section.kind)}`}`} className="grid gap-1 rounded-lg border border-line bg-surface px-4 pt-3 pb-3">
                <b className="font-mono text-[0.8125rem] font-medium text-text-3" aria-hidden="true">Sección {sectionIndex + 1} de {drafts.length} · {section.label ?? kindLabel(section.kind)}</b>
                {draft.lines.map((line, lineIndex) => (
                  <div key={lineIndex} className="grid grid-cols-[1fr_auto] items-end gap-1 border-t border-dashed border-line py-1 first-of-type:border-t-0">
                    <ChordLine line={line} renderChord={(chord, index) => (
                      <button type="button" aria-label={`Editar acorde ${chord}`} onClick={() => open({ section: sectionIndex, line: lineIndex, index, chord, offset: line.chords[index]!.offset })}
                        className="mr-1.5 mb-0.5 min-h-8 min-w-8 cursor-pointer self-start rounded-sm border-0 bg-accent-soft px-2 font-mono text-sm font-medium text-accent-soft-text hover:bg-accent-soft/70">{chord}</button>
                    )} />
                    {line.text !== '' && (
                      <button type="button" aria-label={`Agregar acorde a la línea ${lineIndex + 1}`} onClick={() => open({ section: sectionIndex, line: lineIndex, index: null, chord: '', offset: 0 })}
                        className="grid size-touch cursor-pointer place-items-center rounded-md border border-dashed border-accent bg-transparent text-accent hover:bg-accent-soft"><Icon name="plus" /></button>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </main>
      <div className="sticky bottom-0 grid gap-1 border-t border-line bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <Button block loading={sending} disabled={!dirty || conflict} onClick={() => void send()}>Guardar</Button>
        {dirty && <Button variant="quiet" block onClick={() => { setDrafts(lyrics.sections.map((section) => ({ id: newKey(), lines: linesOf(section) }))); setBaseKey(lyrics.key); setMinor(parseKey(lyrics.key ?? '')?.minor ?? false); setConflict(false); touched() }}>Descartar cambios</Button>}
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Acorde">
        {editing && sheetLine && (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-text-2">Línea {editing.line + 1} de la sección {editing.section + 1}. Mueve el acorde hasta la sílaba donde cambia.</p>
            <div aria-live="polite" className="grid gap-1 rounded-md border border-line bg-surface-2 p-3">
              <ChordLine line={sheetLine} mark={sheetLine.chords.findIndex((mark, index) => mark.offset === editing.offset && sheetLine.chords[index]!.chord === editing.chord.trim())} />
              <small className="text-[0.8125rem] text-text-3">Posición {editing.offset} de {lineOf(editing).text.length}</small>
            </div>
            <PositionRuler text={lineOf(editing).text} offset={editing.offset} onPick={(offset) => setEditing({ ...editing, offset })} />
            <TextField label="Acorde" value={editing.chord} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={16} className="font-mono"
              help="Por ejemplo: Am, C/G, F#m7, Dsus4." error={chordError || undefined}
              onChange={(event) => { setEditing({ ...editing, chord: event.target.value }); setChordError('') }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); accept() } }} />
            <div role="group" aria-labelledby="chord-position" className="grid gap-1.5">
              <span id="chord-position" className="text-sm font-semibold">Posición en la línea</span>
              <div className="grid min-h-touch-lg grid-cols-[44px_1fr_44px] items-center rounded-md border border-line-strong bg-surface">
                <button type="button" aria-label="Un carácter a la izquierda" disabled={editing.offset <= 0} onClick={() => setEditing({ ...editing, offset: editing.offset - 1 })}
                  className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="right" className="-scale-x-100" /></button>
                <output className="text-center font-mono text-[0.9375rem] font-semibold">{editing.offset}</output>
                <button type="button" aria-label="Un carácter a la derecha" disabled={editing.offset >= lineOf(editing).text.length} onClick={() => setEditing({ ...editing, offset: editing.offset + 1 })}
                  className="grid min-h-touch-lg cursor-pointer place-items-center rounded-md border-0 bg-transparent hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"><Icon name="right" /></button>
              </div>
            </div>
            <Button block onClick={accept}>Listo</Button>
            {editing.index !== null && <Button variant="danger" block onClick={() => apply(editing, withChord(editing, true))}>Quitar acorde</Button>}
            <Button variant="quiet" block onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        )}
      </Sheet>
      <Sheet open={leaving} onClose={() => setLeaving(false)} title="¿Salir sin guardar?">
        <div className="grid gap-3">
          <p className="m-0 text-[0.9375rem] text-text-2">Tienes cambios sin guardar en los acordes. Si sales, se pierden.</p>
          <Button variant="danger" block onClick={leave}>Salir sin guardar</Button>
          <Button variant="quiet" block onClick={() => setLeaving(false)}>Seguir editando</Button>
        </div>
      </Sheet>
    </div>
  )
}
