import { useState, type FormEvent, type ReactNode } from 'react'
import { PageHeader } from '../calendar/ChurchGate'
import { ApiError } from '../calendar/api'
import { Button, Notice, TextField } from '../ui'
import { useLibraryAccess } from './songs-api'

/** Panel de título y autor (juntos identifican la canción), con la puerta de «solo editores de biblioteca». En móvil es una pantalla con regreso; en escritorio, el panel derecho. */
export function SongForm({ heading, intro, initial, submit, onSave, children }: {
  heading: string; intro: string; initial: { title: string; author: string }; submit: string
  onSave: (song: { title: string; author: string }) => Promise<void>; children?: ReactNode
}) {
  const access = useLibraryAccess()
  const [title, setTitle] = useState(initial.title)
  const [author, setAuthor] = useState(initial.author)
  const [errors, setErrors] = useState<{ title?: string; author?: string }>({})
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const header = <div className="lg:hidden"><PageHeader title={heading} back="/canciones" backLabel="Volver a canciones" /></div>

  if (access.isPending) return <p role="status" className="p-4">Cargando…</p>
  if (!access.data?.canCreate) {
    return (
      <>
        {header}
        <div className="p-4"><Notice title="Solo lectura">Agregar o editar canciones requiere el acceso de editor de biblioteca.</Notice></div>
      </>
    )
  }

  async function send(event: FormEvent) {
    event.preventDefault()
    const next = { title: title.trim() ? undefined : 'Escribe el título.', author: author.trim() ? undefined : 'Escribe el autor.' }
    setErrors(next)
    if (next.title || next.author) return
    setSending(true)
    setFailure('')
    try {
      await onSave({ title: title.trim(), author: author.trim() })
    } catch (caught) {
      setFailure(
        caught instanceof ApiError && caught.code === 'Song exists' ? 'Ya existe una canción con ese título y autor. Búscala en la biblioteca.'
          : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para modificar canciones.'
            : caught instanceof ApiError && caught.status === 404 ? 'La canción ya no existe.'
              : 'No se pudo guardar la canción. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <>
      {header}
      <form onSubmit={(event) => void send(event)} noValidate className="mx-auto grid w-full max-w-[480px] content-start gap-4 p-4 lg:pt-6">
        <h2 className="m-0 hidden font-display text-xl font-bold lg:block">{heading}</h2>
        <p className="m-0 text-[0.9375rem] text-text-2">{intro}</p>
        <TextField label="Título" value={title} maxLength={120} autoComplete="off" error={errors.title} onChange={(event) => setTitle(event.target.value)} />
        <TextField label="Autor" value={author} maxLength={120} autoComplete="off" error={errors.author} onChange={(event) => setAuthor(event.target.value)} />
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending}>{submit}</Button>
        {children}
      </form>
    </>
  )
}
