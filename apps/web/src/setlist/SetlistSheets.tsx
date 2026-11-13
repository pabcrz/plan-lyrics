import { useEffect, useState, type FormEvent } from 'react'
import { Button, Icon, Notice, Segmented, Sheet, TextField, inputClass } from '../ui'
import { ApiError } from '../calendar/api'
import { entryLabel, referenceOrigin, tonalities, useSongs, type Entry, type Song } from './setlist-api'

const MOMENTS = ['Oración', 'Ofrenda', 'Anuncios', 'Lectura bíblica', 'Predicación', 'Santa cena']

/** Hoja «Agregar al setlist»: una canción de la biblioteca o un momento del servicio. */
export function AddSheet({ entries, canCreateSongs, onClose, createSong, onAddSong, onAddMoment }: {
  entries: Entry[]
  canCreateSongs: boolean
  onClose: () => void
  createSong: (song: { title: string; author: string }) => Promise<Song>
  onAddSong: (song: Song) => Promise<boolean>
  onAddMoment: (name: string) => Promise<boolean>
}) {
  const [mode, setMode] = useState<'song' | 'moment'>('song')
  return (
    <Sheet open onClose={onClose} title="Agregar al setlist">
      <div className="grid gap-3">
        <Segmented label="Qué agregar" value={mode} onChange={setMode} options={[{ value: 'song', label: 'Canción' }, { value: 'moment', label: 'Momento' }]} />
        {mode === 'song'
          ? <SongTab entries={entries} canCreateSongs={canCreateSongs} createSong={createSong} onAdd={onAddSong} />
          : <MomentTab onAdd={onAddMoment} />}
        <Button variant="quiet" block onClick={onClose}>Cerrar</Button>
      </div>
    </Sheet>
  )
}

function SongTab({ entries, canCreateSongs, createSong, onAdd }: {
  entries: Entry[]; canCreateSongs: boolean
  createSong: (song: { title: string; author: string }) => Promise<Song>
  onAdd: (song: Song) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [term, setTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])
  const songs = useSongs(term, !creating)
  const used = new Set(entries.flatMap((entry) => (entry.song ? [entry.song.id] : [])))

  async function add(song: Song) {
    setSending(true)
    if (!await onAdd(song)) setSending(false)
  }

  async function create(song: { title: string; author: string }) {
    try {
      const created = await createSong(song)
      if (await onAdd(created)) return ''
      return 'La canción se guardó en la biblioteca, pero no se pudo agregar al setlist.'
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'Song exists') return 'Ya existe una canción con ese título y autor. Búscala en la biblioteca y agrégala desde la lista.'
      if (caught instanceof ApiError && caught.status === 403) return 'No tienes permiso para agregar canciones a la biblioteca.'
      return 'No se pudo guardar la canción. Inténtalo de nuevo.'
    }
  }

  if (creating) return <NewSongForm initialTitle={text.trim()} onCancel={() => setCreating(false)} onSave={create} />
  const rows = songs.data ?? []
  return (
    <div className="grid gap-3">
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
        <input type="search" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" placeholder="Buscar por título o autor"
          aria-label="Buscar canciones" className={`${inputClass} pl-10`} />
      </div>
      {songs.isError && <Notice tone="warn" icon="alert" role="alert">No se pudo cargar la biblioteca. Inténtalo de nuevo.</Notice>}
      {songs.isPending && <p role="status" className="m-0 text-sm text-text-3">Buscando…</p>}
      {songs.data && rows.length === 0 && (
        <p className="m-0 text-[0.9375rem] text-text-3">
          {term ? 'Ninguna canción coincide.' : 'La biblioteca todavía no tiene canciones.'}
          {!canCreateSongs && ' La biblioteca la edita quien tenga ese acceso.'}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="m-0 max-h-[260px] list-none overflow-y-auto rounded-md border border-line p-0">
          {rows.map((song) => {
            const already = used.has(song.id)
            return (
              <li key={song.id} className="border-b border-line last:border-b-0">
                <button type="button" disabled={already || sending} onClick={() => void add(song)} aria-label={already ? `${song.title}, ${song.author}. Ya está en el setlist` : `Agregar ${song.title}, ${song.author}`}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-55">
                  <span className="min-w-0 flex-1"><b className="block text-[0.9375rem] leading-tight [overflow-wrap:anywhere]">{song.title}</b><small className="text-[0.8125rem] text-text-3">{song.author}</small></span>
                  {already && <span className="text-xs font-medium text-text-3">Ya está</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {canCreateSongs && <Button variant="secondary" block onClick={() => setCreating(true)}><Icon name="plus" width={18} height={18} />Agregar canción nueva</Button>}
    </div>
  )
}

/** Alta rápida en la biblioteca: título y autor (juntos son la identidad de la canción). */
function NewSongForm({ initialTitle, onCancel, onSave }: { initialTitle: string; onCancel: () => void; onSave: (song: { title: string; author: string }) => Promise<string> }) {
  const [title, setTitle] = useState(initialTitle)
  const [author, setAuthor] = useState('')
  const [errors, setErrors] = useState<{ title?: string; author?: string }>({})
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const next = { title: title.trim() ? undefined : 'Escribe el título.', author: author.trim() ? undefined : 'Escribe el autor.' }
    setErrors(next)
    if (next.title || next.author) return
    setSending(true)
    setFailure('')
    const result = await onSave({ title: title.trim(), author: author.trim() })
    if (result) { setFailure(result); setSending(false) }
  }
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-3">
      <p className="m-0 text-sm text-text-2">Se agrega a la biblioteca compartida y al setlist. El título y el autor juntos identifican la canción.</p>
      <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} autoComplete="off" error={errors.title} />
      <TextField label="Autor" value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={120} autoComplete="off" error={errors.author} />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button type="submit" block loading={sending}>Guardar y agregar</Button>
      <Button variant="quiet" block onClick={onCancel}>Volver a la búsqueda</Button>
    </form>
  )
}

function MomentTab({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  async function add(value: string) {
    setSending(true)
    if (!await onAdd(value)) setSending(false)
  }
  function addCustom() {
    const value = name.trim().replace(/\s+/g, ' ')
    if (!value) { setError('Escribe un nombre.'); return }
    void add(value.charAt(0).toUpperCase() + value.slice(1))
  }
  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm text-text-2">Un momento del servicio que no es una canción.</p>
      <div className="flex flex-wrap gap-2">
        {MOMENTS.map((moment) => (
          <button key={moment} type="button" disabled={sending} onClick={() => void add(moment)}
            className="min-h-touch cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-55">{moment}</button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <TextField label="Otro momento" value={name} onChange={(event) => { setName(event.target.value); setError('') }} maxLength={60} autoComplete="off" placeholder="Por ejemplo, Bautismos" error={error}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom() } }} />
        <Button variant="secondary" disabled={sending} onClick={addCustom}>Agregar</Button>
      </div>
    </div>
  )
}

const split = (key: string | null) => ({ root: key ? key.replace(/m$/, '') : '', minor: Boolean(key?.endsWith('m')) })

/** Edición de una entrada: tonalidad y enlace de una canción, nombre de un momento; quien no edita solo la lee. */
export function EditSheet({ entry, canEdit, onClose, onRemove, onSave }: {
  entry: Entry
  canEdit: boolean
  onClose: () => void
  onRemove: () => void
  onSave: (patch: { key?: string | null; link?: string | null; moment?: string }) => Promise<void>
}) {
  const initial = split(entry.key)
  const [root, setRoot] = useState(initial.root)
  const [minor, setMinor] = useState(initial.minor)
  const [link, setLink] = useState(entry.link ?? '')
  const [name, setName] = useState(entry.moment ?? '')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const song = entry.song
  const origin = entry.link ? referenceOrigin(entry.link) : null
  const reference = entry.link && origin && (
    <a href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-touch items-center gap-1.5 font-semibold text-accent underline">
      <Icon name="link" width={16} height={16} />Abrir en {origin}
    </a>
  )

  async function save() {
    const patch: { key?: string | null; link?: string | null; moment?: string } = {}
    if (song) {
      const key = root ? `${root}${minor ? 'm' : ''}` : null
      const value = link.trim()
      if (value && !referenceOrigin(value)) { setError('Pega un enlace de YouTube o Spotify.'); return }
      if (key !== entry.key) patch.key = key
      if ((value || null) !== entry.link) patch.link = value || null
    } else {
      const value = name.trim().replace(/\s+/g, ' ')
      if (!value) { setError('Escribe un nombre.'); return }
      if (value !== entry.moment) patch.moment = value
    }
    if (Object.keys(patch).length === 0) { onClose(); return }
    setSending(true)
    await onSave(patch)
    setSending(false)
  }

  return (
    <Sheet open onClose={onClose} title={entryLabel(entry)}>
      <div className="grid gap-4">
        {song && <p className="m-0 text-sm text-text-2">{song.author} · de la biblioteca compartida; aquí solo cambian la tonalidad y el enlace de este servicio.</p>}
        {song && canEdit && (
          <>
            <div role="group" aria-label="Tonalidad en este servicio" className="grid gap-2">
              <span className="text-sm font-semibold">Tonalidad en este servicio</span>
              <Segmented label="Modo" value={minor ? 'minor' : 'major'} onChange={(value) => setMinor(value === 'minor')} options={[{ value: 'major', label: 'Mayor' }, { value: 'minor', label: 'Menor' }]} />
              <div className="grid grid-cols-4 gap-1.5">
                {tonalities.map((note) => (
                  <button key={note} type="button" aria-pressed={root === note} onClick={() => setRoot(root === note ? '' : note)}
                    className={`min-h-touch cursor-pointer rounded-md border font-mono text-[0.9375rem] font-semibold ${root === note ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text'}`}>
                    {note}{minor ? 'm' : ''}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[0.8125rem] text-text-3">Toca de nuevo la tonalidad elegida para quitarla.</p>
            </div>
            <TextField label={<>Enlace de referencia <span className="font-normal text-text-3">(opcional)</span></>} type="url" inputMode="url" autoComplete="off" placeholder="YouTube o Spotify"
              value={link} onChange={(event) => { setLink(event.target.value); setError('') }} error={error}
              help="Se abre desde el setlist; no se reproduce dentro de la app." />
            {reference}
          </>
        )}
        {song && !canEdit && (
          <>
            <p className="m-0">Tonalidad: {entry.key ? <span className="rounded-sm bg-accent-soft px-2 py-0.5 font-mono font-medium text-accent-soft-text">{entry.key}</span> : 'sin definir'}</p>
            {reference}
          </>
        )}
        {!song && canEdit && <TextField label="Nombre del momento" value={name} onChange={(event) => { setName(event.target.value); setError('') }} maxLength={60} autoComplete="off" error={error} />}
        {!song && !canEdit && <p className="m-0 text-text-2">Momento del servicio.</p>}
        {canEdit ? (
          <div className="grid gap-2">
            <Button block loading={sending} onClick={() => void save()}>Listo</Button>
            <Button variant="danger" block onClick={onRemove}>Quitar del setlist</Button>
          </div>
        ) : (
          <Button variant="secondary" block onClick={onClose}>Cerrar</Button>
        )}
      </div>
    </Sheet>
  )
}
