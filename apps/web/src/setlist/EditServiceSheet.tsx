import { useState } from 'react'
import { Button, Field, Notice, Segmented, Sheet, TextField, inputClass } from '../ui'
import { ApiError, usePeople, useUpdateService, type ServicePatch } from '../calendar/api'
import { weekdayOf } from '../calendar/dates'
import { PersonList } from '../calendar/PeopleSheet'
import type { Church, Service, Status } from '../calendar/model'

type Current = { id: string; title: string; date: string; slot: Service['slot']; time: string | null; status: Status }

const statusOptions = [
  { value: 'DRAFT', label: 'Borrador' }, { value: 'PUBLISHED', label: 'Publicado' }, { value: 'COMPLETED', label: 'Completado' }, { value: 'CANCELLED', label: 'Cancelado' },
] as const

/** Texto de un rechazo al corregir un servicio; el servidor decide siempre. */
export function updateFailure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 0
  const code = error instanceof ApiError ? error.code : ''
  if (status === 403) return 'No tienes permiso para editar servicios.'
  if (code === 'Date in the past') return 'No puedes mover el servicio a una fecha pasada.'
  if (code === 'Date closed') return 'Esa fecha está marcada como «No hay culto».'
  if (code === 'Date full') return 'Esa fecha ya tiene el máximo de servicios.'
  if (code === 'Combination not allowed') return 'Esa persona no puede dirigir y tener además su rol en este servicio. Cambia primero su participación.'
  if (status === 404) return 'Este servicio ya no existe.'
  if (status === 400) return 'Revisa la fecha, la hora y la franja.'
  return 'No se pudo guardar. Inténtalo de nuevo.'
}

/** Corrige título, fecha, hora, estado y dirección de un servicio; solo se envía lo que cambió. */
export function EditServiceSheet({ church, service, directorId, onClose, onSaved }: {
  church: Pick<Church, 'sundayDouble'>; service: Current; directorId: string | undefined; onClose: () => void; onSaved: () => void
}) {
  const people = usePeople(true, 'direct')
  const update = useUpdateService()
  const [title, setTitle] = useState(service.title)
  const [date, setDate] = useState(service.date)
  const [time, setTime] = useState(service.time ?? '')
  const [slot, setSlot] = useState<'MORNING' | 'AFTERNOON'>(service.slot === 'AFTERNOON' ? 'AFTERNOON' : 'MORNING')
  const [status, setStatus] = useState<Status>(service.status)
  const [director, setDirector] = useState(directorId ?? '')
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  const doubleDay = church.sundayDouble && /^\d{4}-\d{2}-\d{2}$/.test(date) && weekdayOf(date) === 0
  const patch: ServicePatch = {
    ...(title.trim() !== service.title ? { title: title.trim() } : {}),
    ...(date !== service.date ? { date } : {}),
    ...(time !== (service.time ?? '') ? { time: time || null } : {}),
    ...(doubleDay && (service.slot === 'SINGLE' || slot !== service.slot) ? { slot } : {}),
    ...(status !== service.status ? { status } : {}),
    ...(director && director !== directorId ? { directorId: director } : {}),
  }
  const dirty = Object.keys(patch).length > 0
  const valid = title.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date)

  async function save() {
    setSending(true)
    setFailure('')
    try {
      await update(service.id, patch)
      onSaved()
    } catch (caught) {
      setFailure(updateFailure(caught))
      setSending(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Editar servicio">
      <form onSubmit={(event) => { event.preventDefault(); if (dirty && valid) void save() }} noValidate className="grid gap-4">
        <TextField label="Título" value={title} maxLength={120} autoComplete="off" onChange={(event) => setTitle(event.target.value)} error={title.trim() ? undefined : 'Escribe un título.'} />
        <Field label="Fecha">{(control) => <input {...control} type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />}</Field>
        {doubleDay && <Segmented label="Franja" value={slot} onChange={setSlot} options={[{ value: 'MORNING', label: 'Mañana' }, { value: 'AFTERNOON', label: 'Tarde' }]} />}
        <Field label="Hora de inicio" help="Déjala vacía si no tiene hora fija.">{(control) => <input {...control} type="time" className={inputClass} value={time} onChange={(event) => setTime(event.target.value)} />}</Field>
        <Segmented label="Estado" value={status} onChange={setStatus} options={statusOptions} />
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Dirección</span>
          {people.data
            ? <PersonList people={people.data} selectedId={director} onSelect={(person) => setDirector(person.id)} empty="No hay personas en el directorio." />
            : <p role="status" className="m-0 text-[0.8125rem] text-text-3">{people.isError ? 'No se pudo cargar la lista de personas.' : 'Cargando personas…'}</p>}
        </div>
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" block loading={sending} disabled={!dirty || !valid}>Guardar cambios</Button>
        <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
      </form>
    </Sheet>
  )
}
