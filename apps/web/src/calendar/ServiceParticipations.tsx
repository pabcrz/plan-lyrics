import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Notice, Segmented, Sheet } from '../ui'
import { ApiError, usePeople } from './api'
import { formatDay, formatLongDay, todayIn } from './dates'
import type { Person, Service } from './model'
import { PersonList } from './PeopleSheet'
import { useAssignmentActions, useAssignments, useRoleTurns, type Assignment } from './participations-api'
import { useRoles } from './roles-api'

const failureText = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'Combination not allowed') return 'Esa persona no puede tener esos dos roles a la vez en el mismo servicio.'
  if (code === 'Already assigned') return 'Esa persona ya tiene este rol en el servicio.'
  if (code === 'Date in the past') return 'Los servicios pasados se conservan como registro y ya no se modifican.'
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para cambiar las participaciones.'
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}

const pendingChip = (
  <span className="inline-flex min-h-7 w-fit items-center rounded-full border border-dashed border-line-strong bg-surface-2 px-3 text-[0.8125rem] font-medium">Pendiente</span>
)

/** Por qué una participación no tiene persona, sin inventar una prioridad entre roles. */
function pendingExplanation(row: Assignment) {
  if (row.pending === 'ROLE_REMOVED') return `El rol «${row.roleName}» se eliminó y nadie lo ocupa ahora. Quita este marcador cuando ya no haga falta.`
  const who = row.proposed ? row.proposed.name : 'La persona propuesta'
  return `${who} coincide aquí con otro rol que esta iglesia no permite combinar en el mismo servicio. Todavía no hay una regla para decidir cuál conserva, así que este rol queda sin persona: elige a alguien.`
}

/** Participaciones de un servicio: quien las edita puede reemplazar, intercambiar, agregar o quitar. */
export function ServiceParticipations({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const assignments = useAssignments(service.id)
  const [changing, setChanging] = useState<Assignment | null>(null)
  const [adding, setAdding] = useState(false)
  const [done, setDone] = useState('')
  // Los servicios de fechas pasadas son un registro: la API tampoco los modifica.
  const editable = canEdit && service.date >= todayIn()
  const finish = (message: string) => { setChanging(null); setAdding(false); setDone(message) }

  return (
    <section aria-labelledby="participations" className="grid gap-2">
      <h3 id="participations" className="m-0 text-sm font-semibold text-text-2">Participaciones</h3>
      {assignments.isPending && <p role="status" className="m-0 text-[0.8125rem] text-text-3">Cargando participaciones…</p>}
      {assignments.error && <Notice tone="warn" icon="alert" role="alert">No se pudieron cargar las participaciones.</Notice>}
      {assignments.data && (
        <>
          {assignments.data.assignments.length === 0 && <p className="m-0 text-[0.8125rem] text-text-3">Este servicio no tiene participaciones cargadas.</p>}
          <ul aria-labelledby="participations" className="m-0 grid list-none gap-2 p-0">
            {assignments.data.assignments.map((row) => {
              const body = (
                <>
                  <span className="flex-1 text-left">
                    <small className="block text-[0.8125rem] text-text-3">{row.roleName}</small>
                    {row.person ? <b className="font-semibold">{row.person.name}</b> : pendingChip}
                  </span>
                  {editable && <span className="text-sm font-semibold text-accent">Cambiar</span>}
                </>
              )
              return (
                <li key={row.id} className="rounded-md border border-line bg-surface">
                  {editable ? (
                    <button type="button" aria-label={`${row.roleName}: ${row.person?.name ?? 'pendiente'}. Cambiar`} onClick={() => { setDone(''); setChanging(row) }}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 py-2">{body}</button>
                  ) : <div className="flex min-h-14 items-center gap-3 px-3 py-2">{body}</div>}
                  {row.pending && <p className="m-0 border-t border-line px-3 py-2 text-[0.8125rem] text-text-2">{pendingExplanation(row)}</p>}
                </li>
              )
            })}
          </ul>
          {done && <p role="status" className="m-0 text-[0.8125rem] font-medium text-text-2">{done}</p>}
          {editable && <Button variant="secondary" block onClick={() => { setDone(''); setAdding(true) }}><Icon name="plus" />Agregar participación</Button>}
        </>
      )}
      <ChangeSheet row={changing} service={service} onClose={() => setChanging(null)} onDone={finish} />
      <AddSheet open={adding} service={service} onClose={() => setAdding(false)} onDone={finish} />
    </section>
  )
}

type Mode = 'one' | 'swap'

function ChangeSheet({ row, service, onClose, onDone }: { row: Assignment | null; service: Service; onClose: () => void; onDone: (message: string) => void }) {
  return (
    <Sheet open={row !== null} onClose={onClose} title={row?.roleName ?? 'Participación'}>
      {row && <ChangeBody key={row.id} row={row} service={service} onClose={onClose} onDone={onDone} />}
    </Sheet>
  )
}

function ChangeBody({ row, service, onClose, onDone }: { row: Assignment; service: Service; onClose: () => void; onDone: (message: string) => void }) {
  const navigate = useNavigate()
  const people = usePeople(true)
  const actions = useAssignmentActions()
  const [mode, setMode] = useState<Mode>('one')
  const [personId, setPersonId] = useState<string | null>(null)
  const [turnId, setTurnId] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const turns = useRoleTurns(mode === 'swap' ? row.roleId : null)
  const others = (turns.data ?? []).filter((turn) => turn.serviceId !== service.id && turn.person.id !== row.person?.id)
  const turn = others.find((item) => item.id === turnId)

  async function run(action: () => Promise<unknown>, message: string) {
    setSending(true)
    setFailure('')
    try {
      await action()
      onDone(message)
    } catch (caught) {
      setFailure(failureText(caught))
      setSending(false)
    }
  }

  if (!row.roleId) {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-sm text-text-2">{pendingExplanation(row)}</p>
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button variant="danger" block loading={sending} onClick={() => void run(() => actions.remove(row.id), 'Marcador quitado')}>Quitar marcador</Button>
        <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
      </div>
    )
  }

  const choices: Person[] = (people.data ?? []).filter((person) => person.id !== row.person?.id)
  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm text-text-2">{row.person ? `Ahora: ${row.person.name}` : 'Sin persona asignada'} · {formatLongDay(service.date)}</p>
      {row.person && (
        <Segmented<Mode> label="Tipo de cambio" value={mode} onChange={(next) => { setMode(next); setFailure('') }}
          options={[{ value: 'one', label: 'Solo este servicio' }, { value: 'swap', label: 'Intercambiar turnos' }]} />
      )}
      {mode === 'one' ? (
        <PersonList people={choices} selectedId={personId} onSelect={(person) => { setPersonId(person.id); setFailure('') }} empty="No hay otras personas en el directorio." />
      ) : turns.isPending ? (
        <p role="status" className="m-0 text-[0.8125rem] text-text-3">Cargando turnos…</p>
      ) : others.length === 0 ? (
        <p className="m-0 text-[0.8125rem] text-text-3">No hay otros turnos próximos de este rol con los que intercambiar.</p>
      ) : (
        <ul aria-label="Turnos del mismo rol" className="m-0 max-h-[40dvh] list-none overflow-y-auto rounded-md border border-line bg-surface p-0">
          {others.map((item) => (
            <li key={item.id}>
              <button type="button" aria-pressed={item.id === turnId} onClick={() => { setTurnId(item.id); setFailure('') }}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent px-3 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft">
                <span className="font-semibold">{formatDay(item.date)}</span><span>{item.person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === 'swap' && turn && row.person && (
        <Notice icon="info" title={`${row.person.name} ↔ ${turn.person.name}`}>
          {formatDay(service.date)} pasa a {turn.person.name} · {formatDay(turn.date)} pasa a {row.person.name}. Los demás turnos no cambian.
        </Notice>
      )}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      {mode === 'one' ? (
        <Button variant="primary" block loading={sending} disabled={!personId} onClick={() => void run(() => actions.replace(row.id, personId!), 'Participación reemplazada solo en este servicio')}>Reemplazar solo aquí</Button>
      ) : (
        <Button variant="primary" block loading={sending} disabled={!turn} onClick={() => void run(() => actions.swap(row.id, turn!.id), 'Turnos intercambiados')}>Confirmar intercambio</Button>
      )}
      <Button variant="quiet" block onClick={() => void navigate(`/participaciones/${encodeURIComponent(row.roleId!)}?desde=${service.date}`)}>Configurar la rotación de {row.roleName}</Button>
      <Button variant="quiet" block loading={sending} onClick={() => void run(() => actions.remove(row.id), 'Participación quitada de este servicio')}>Quitar de este servicio</Button>
      <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
    </div>
  )
}

function AddSheet({ open, service, onClose, onDone }: { open: boolean; service: Service; onClose: () => void; onDone: (message: string) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Agregar participación">
      {open && <AddBody service={service} onClose={onClose} onDone={onDone} />}
    </Sheet>
  )
}

function AddBody({ service, onClose, onDone }: { service: Service; onClose: () => void; onDone: (message: string) => void }) {
  const roles = useRoles()
  const people = usePeople(true)
  const actions = useAssignmentActions()
  const [roleId, setRoleId] = useState('')
  const [personId, setPersonId] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      await actions.add(service.id, roleId, personId!)
      onDone('Participación agregada')
    } catch (caught) {
      setFailure(failureText(caught))
      setSending(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div role="group" aria-label="Rol" className="flex flex-wrap gap-2">
        {(roles.data ?? []).map((role) => (
          <button key={role.id} type="button" aria-pressed={role.id === roleId} onClick={() => { setRoleId(role.id); setFailure('') }}
            className="min-h-touch-lg cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-[0.9375rem] font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">
            {role.name}
          </button>
        ))}
      </div>
      <PersonList people={people.data ?? []} selectedId={personId} onSelect={(person) => { setPersonId(person.id); setFailure('') }} empty="No hay personas en el directorio." />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button variant="primary" block loading={sending} disabled={!roleId || !personId} onClick={() => void submit()}>Agregar</Button>
      <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
    </div>
  )
}
