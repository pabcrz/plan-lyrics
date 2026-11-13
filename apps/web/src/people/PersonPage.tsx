import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatar, Button, Icon, Notice, Sheet, TextField } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, usePerson, usePersonActions } from '../calendar/api'
import type { Church, PersonDetail } from '../calendar/model'

export function PersonPage() {
  return <ChurchGate>{(church) => <Loader church={church} />}</ChurchGate>
}

function Loader({ church }: { church: Church }) {
  const { personId = '' } = useParams()
  const person = usePerson(personId)
  const missing = person.error instanceof ApiError && person.error.status === 404
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Persona" back="/personas" backLabel="Volver a personas" />
      {person.isPending && <p role="status" className="p-4">Cargando persona…</p>}
      {missing && <div className="p-4"><Notice title="No encontramos a esta persona">Puede haberse quitado de la iglesia.</Notice></div>}
      {person.isError && !missing && (
        <div className="grid gap-4 p-4">
          <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la ficha">Revisa tu conexión e inténtalo de nuevo.</Notice>
          <Button variant="secondary" onClick={() => void person.refetch()}>Reintentar</Button>
        </div>
      )}
      {person.data && <Record key={person.data.id} church={church} person={person.data} />}
    </main>
  )
}

function Record({ church, person }: { church: Church; person: PersonDetail }) {
  const navigate = useNavigate()
  const { update, remove } = usePersonActions()
  const [name, setName] = useState(person.name)
  const [phone, setPhone] = useState(person.phone ?? '')
  const [saved, setSaved] = useState({ name: person.name, phone: person.phone ?? '' })
  const [nameError, setNameError] = useState('')
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const dirty = name.trim() !== saved.name || phone.trim() !== saved.phone
  const edit = church.canEdit

  async function save() {
    if (!name.trim()) return setNameError('Escribe el nombre de la persona.')
    setSending(true)
    setNameError('')
    setFailure('')
    setDone(false)
    try {
      const result = await update(person.id, { name: name.trim(), phone: phone.trim() || null })
      setSaved({ name: result.name, phone: result.phone ?? '' })
      setName(result.name)
      setPhone(result.phone ?? '')
      setDone(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setNameError(`Ya hay una persona llamada «${caught.existing?.name ?? name.trim()}». Completa el nombre para distinguirlas.`)
      else setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para editar personas.' : caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre y el teléfono.' : 'No se pudo guardar. Inténtalo de nuevo.')
    }
    setSending(false)
  }
  function discard() {
    setName(saved.name)
    setPhone(saved.phone)
    setNameError('')
    setFailure('')
  }
  async function confirmRemoval() {
    setSending(true)
    try {
      await remove(person.id)
      void navigate('/personas', { replace: true, state: { removed: saved.name } })
    } catch {
      setConfirming(false)
      setFailure('No se pudo quitar a la persona. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <>
      <div className="grid flex-1 content-start gap-5 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={saved.name} className="size-12 text-base" />
          <div className="grid gap-1">
            <h1 className="m-0 font-display text-xl font-bold tracking-tight">{saved.name}</h1>
            {person.hasAccount && <span className="w-fit rounded-full border border-pub-bd bg-pub-bg px-2.5 text-[0.8125rem] font-medium text-pub-fg">Con cuenta</span>}
          </div>
        </div>

        <section className="grid gap-3" aria-labelledby="personal">
          <h2 id="personal" className="m-0 font-display text-lg font-bold">Información personal</h2>
          {edit ? (
            <>
              <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off" error={nameError || undefined}
                onChange={(event) => { setName(event.target.value); setNameError(''); setDone(false) }} />
              <TextField label="Teléfono (opcional)" type="tel" inputMode="tel" autoComplete="off" maxLength={30} value={phone}
                onChange={(event) => { setPhone(event.target.value); setDone(false) }} />
            </>
          ) : (
            <dl className="m-0 grid gap-1 text-[0.9375rem]">
              <div><dt className="text-[0.8125rem] text-text-3">Nombre completo</dt><dd className="m-0">{saved.name}</dd></div>
              <div><dt className="text-[0.8125rem] text-text-3">Teléfono</dt><dd className="m-0">{saved.phone || 'Sin teléfono'}</dd></div>
            </dl>
          )}
          <Notice>
            {person.sharedWithOtherChurches
              ? 'Esta información es general: si la cambias, se ve igual en las demás iglesias donde participa. Sus roles y turnos no se comparten.'
              : 'Esta información es general: se vería igual en cualquier otra iglesia donde participe. Sus roles y turnos son solo de esta iglesia.'}
          </Notice>
          {done && <p role="status" className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={16} height={16} />Cambios guardados</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          {edit && dirty && (
            <div className="grid gap-2">
              <Button variant="primary" block loading={sending} onClick={() => void save()}>Guardar cambios</Button>
              <Button variant="quiet" block onClick={discard}>Descartar cambios</Button>
            </div>
          )}
        </section>

        <section className="grid gap-2" aria-labelledby="here">
          <h2 id="here" className="m-0 font-display text-lg font-bold">En {church.name}</h2>
          <p className="m-0 text-[0.9375rem] text-text-2">Sus roles, turnos y participaciones se verán aquí cuando existan las participaciones.</p>
        </section>

        <section className="grid gap-2" aria-labelledby="account">
          <h2 id="account" className="m-0 font-display text-lg font-bold">Cuenta de acceso</h2>
          <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Estado: </span><b>{person.hasAccount ? 'Con cuenta vinculada' : 'Sin cuenta'}</b></p>
          <p className="m-0 text-[0.8125rem] text-text-3">Vincular o desvincular la cuenta lo hace el superadministrador o un gestor de cuentas.</p>
        </section>

        {church.canConfigure && <Button variant="danger" block onClick={() => setConfirming(true)}>Quitar de {church.name}</Button>}
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`¿Quitar a ${saved.name} de ${church.name}?`}>
        <div className="grid gap-3">
          {person.upcomingServices > 0 && (
            <Notice tone="warn" icon="alert" role="status">
              Tiene {person.upcomingServices} {person.upcomingServices === 1 ? 'servicio próximo' : 'servicios próximos'} a su cargo. Conviene revisar quién dirige {person.upcomingServices === 1 ? 'ese servicio' : 'esos servicios'}.
            </Notice>
          )}
          <p className="m-0 text-[0.9375rem] text-text-2">
            Dejará de aparecer al buscar personas y al elegir quién dirige en {church.name}. Los servicios pasados conservan su nombre y sus datos personales se mantienen para sus otras iglesias.
          </p>
          <Button variant="danger" block loading={sending} onClick={() => void confirmRemoval()}>Quitar de {church.name}</Button>
          <Button variant="quiet" block onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}
