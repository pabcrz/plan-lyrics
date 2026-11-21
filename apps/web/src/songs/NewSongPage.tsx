import { useLocation, useNavigate } from 'react-router'
import { SongForm } from './SongForm'
import { lyricsPath, useCreateSong } from './songs-api'

/** Panel «Canción nueva» dentro de la biblioteca. */
export function NewSongPage() {
  const navigate = useNavigate()
  const create = useCreateSong()
  const title = (useLocation().state as { title?: string } | null)?.title ?? ''
  return (
    <SongForm heading="Canción nueva" initial={{ title, author: '' }} submit="Guardar y escribir la letra"
      intro="Se agrega a la biblioteca compartida. El título y el autor juntos identifican la canción; después puedes escribir su letra y acordes."
      onSave={async (song) => { const created = await create(song); void navigate(lyricsPath(created.id), { replace: true }) }} />
  )
}
