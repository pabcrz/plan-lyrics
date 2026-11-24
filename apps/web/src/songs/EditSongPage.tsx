import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Button, Notice, Sheet } from '../ui'
import { ApiError } from '../calendar/api'
import { useSongs, type Song } from '../setlist/setlist-api'
import { SongForm } from './SongForm'
import { lyricsPath, useDeleteSong, useUpdateSong } from './songs-api'

/** Panel «Editar canción»: cambia título y autor, o elimina una canción creada por error (no una con letra o en un setlist). La canción llega por el estado de la ruta o, al recargar, de la biblioteca. */
export function EditSongPage() {
  const { songId } = useParams()
  const fromState = (useLocation().state as { song?: Song } | null)?.song
  const library = useSongs('', !fromState)
  const song = fromState ?? library.data?.find((candidate) => candidate.id === songId)
  if (song) return <Editor key={song.id} song={song} />
  return library.isPending ? <p role="status" className="p-4">Cargando…</p> : <Navigate to="/canciones" replace />
}

function Editor({ song }: { song: Song }) {
  const navigate = useNavigate()
  const update = useUpdateSong()
  const remove = useDeleteSong()
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')

  async function confirmRemoval() {
    setSending(true)
    setFailure('')
    try {
      await remove(song.id)
      void navigate('/canciones', { replace: true })
    } catch (caught) {
      setFailure(caught instanceof ApiError && caught.code === 'Song in use'
        ? 'No se puede eliminar: tiene letra o está en un setlist.'
        : 'No se pudo eliminar la canción. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <>
      <SongForm heading="Editar canción" initial={song} submit="Guardar cambios"
        intro="Cambiar el título o el autor no afecta los setlists ni la letra: la canción es la misma."
        onSave={async (next) => { await update(song.id, next); void navigate('/canciones', { replace: true }) }}>
        <Link to={lyricsPath(song.id)} className="grid min-h-12 place-items-center rounded-md border border-line-strong bg-surface font-semibold text-text no-underline hover:bg-surface-2">Abrir letra y acordes</Link>
        <Button variant="danger" block onClick={() => setConfirming(true)}>Eliminar canción</Button>
      </SongForm>
      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`¿Eliminar «${song.title}»?`}>
        <div className="grid gap-3">
          <p className="m-0 text-[0.9375rem] text-text-2">Solo se puede eliminar una canción sin letra y que no esté en ningún setlist. No se puede deshacer.</p>
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          <Button variant="danger" block loading={sending} onClick={() => void confirmRemoval()}>Eliminar canción</Button>
          <Button variant="quiet" block onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}
