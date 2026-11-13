import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button, Notice, TextField } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, usePersonActions } from '../calendar/api'
import type { Church } from '../calendar/model'

export function NewPersonPage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Form church={church} /> : <ReadOnly church={church} />)}</ChurchGate>
}

function ReadOnly({ church }: { church: Church }) {
  return (
    <main className="mx-auto max-w-[480px]">
      <TopBar name={church.name} />
      <PageHeader title="Persona nueva" back="/personas" backLabel="Volver a personas" />
      <div className="p-4"><Notice title="Solo lectura">Agregar personas requiere ser editor o administrador de tu iglesia.</Notice></div>
    </main>
  )
}

function Form({ church }: { church: Church }) {
  const navigate = useNavigate()
  const { create } = usePersonActions()
  const [name, setName] = useState((useLocation().state as { name?: string } | null)?.name ?? '')
  const [phone, setPhone] = useState('')
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setSending(true)
    setExisting(null)
    setFailure('')
    try {
      const person = await create({ name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) })
      void navigate(`/personas/${encodeURIComponent(person.id)}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.existing) setExisting(caught.existing)
      else setFailure(caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre y el teléfono.' : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para agregar personas.' : 'No se pudo agregar a la persona. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Persona nueva" back="/personas" backLabel="Volver a personas" />
      <form onSubmit={(event) => void submit(event)} noValidate className="grid flex-1 content-start gap-4 p-4">
        <div>
          <h2 className="m-0 font-display text-xl font-bold">Agregar a {church.name}</h2>
          <p className="m-0 mt-1 text-[0.9375rem] text-text-2">No necesita una cuenta de acceso para figurar en los servicios.</p>
        </div>
        <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off"
          onChange={(event) => { setName(event.target.value); setExisting(null) }}
          help="Con nombre y apellidos, por ejemplo «Juan Pérez Rodríguez». Búscala antes en la lista para no duplicarla."
          error={existing ? 'Ya hay una persona con ese nombre.' : undefined} />
        {existing && (
          <Notice tone="warn" icon="alert" role="alert" title={`Ya existe «${existing.name}»`}>
            Completa el nombre para distinguirla, o <Link className="font-semibold underline" to={`/personas/${encodeURIComponent(existing.id)}`}>abre su ficha</Link>.
          </Notice>
        )}
        <TextField label="Teléfono (opcional)" type="tel" inputMode="tel" autoComplete="off" value={phone} maxLength={30} onChange={(event) => setPhone(event.target.value)} />
        <p className="m-0 text-[0.8125rem] text-text-3">El nombre y el teléfono son información general: se ven en todas las iglesias donde participe. Sus roles y turnos se configuran en cada iglesia.</p>
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending} disabled={!name.trim()}>Agregar persona</Button>
      </form>
    </main>
  )
}
