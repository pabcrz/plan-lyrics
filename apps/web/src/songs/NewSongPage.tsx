import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button, Notice, TextField } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError } from '../calendar/api'
import type { Church } from '../calendar/model'
import { lyricsPath, useCreateSong, useLibraryAccess } from './songs-api'

export function NewSongPage() {
  return <ChurchGate>{(church) => <Gate church={church} />}</ChurchGate>
}

function Gate({ church }: { church: Church }) {
  const access = useLibraryAccess()
  if (access.isPending) return <p role="status" className="p-4">Cargando…</p>
  return access.data?.canCreate ? <Form church={church} /> : (
    <main className="mx-auto max-w-[480px]">
      <TopBar name={church.name} />
      <PageHeader title="Canción nueva" back="/canciones" backLabel="Volver a canciones" />
      <div className="p-4"><Notice title="Solo lectura">Agregar canciones requiere el acceso de editor de biblioteca.</Notice></div>
    </main>
  )
}

function Form({ church }: { church: Church }) {
  const navigate = useNavigate()
  const create = useCreateSong()
  const [title, setTitle] = useState((useLocation().state as { title?: string } | null)?.title ?? '')
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
    try {
      const song = await create({ title: title.trim(), author: author.trim() })
      void navigate(lyricsPath(song.id), { replace: true })
    } catch (caught) {
      setFailure(
        caught instanceof ApiError && caught.code === 'Song exists' ? 'Ya existe una canción con ese título y autor. Búscala en la biblioteca.'
          : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para agregar canciones.'
            : 'No se pudo guardar la canción. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Canción nueva" back="/canciones" backLabel="Volver a canciones" />
      <form onSubmit={(event) => void submit(event)} noValidate className="grid flex-1 content-start gap-4 p-4">
        <p className="m-0 text-[0.9375rem] text-text-2">Se agrega a la biblioteca compartida. El título y el autor juntos identifican la canción; después puedes escribir su letra y acordes.</p>
        <TextField label="Título" value={title} maxLength={120} autoComplete="off" error={errors.title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Autor" value={author} maxLength={120} autoComplete="off" error={errors.author} onChange={(event) => setAuthor(event.target.value)} />
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending}>Guardar y escribir la letra</Button>
      </form>
    </main>
  )
}
