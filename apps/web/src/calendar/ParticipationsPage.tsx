import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Avatar, Button, Icon, Notice, Segmented, Switch, TextField } from '../ui'
import { ChurchGate, PageHeader, TopBar } from './ChurchGate'
import { ApiError, usePeople } from './api'
import { formatDay, todayIn } from './dates'
import type { Church } from './model'
import { PeopleSheet } from './PeopleSheet'
import { toBody, useParticipations, useSaveParticipation, type Mode, type RoleParticipation, type Sequence, type Who } from './participations-api'
import { NewRoleSheet, RemoveRoleSheet } from './RoleSheets'
import { useRoleActions } from './roles-api'

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const count = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`
const card = 'rounded-lg border border-line bg-surface'

/** Resumen de una línea por cosa configurada, como en la lista de roles del diseño. */
function summary(role: RoleParticipation) {
  const lines: string[] = []
  if (role.habitual.length > 0) lines.push(`Habitual: ${role.habitual.map((person) => person.name.split(' ')[0]).join(', ')}`)
  const { enabled, mode, sequences } = role.rotation
  if (enabled && mode === 'SHARED') lines.push(`Rotación entre todos · ${count(sequences.find((sequence) => sequence.weekday === null)?.people.length ?? 0)}`)
  else if (enabled) {
    const days = sequences.filter((sequence) => sequence.weekday !== null && sequence.people.length > 0).map((sequence) => DAY_SHORT[sequence.weekday!])
    lines.push(`Rotación por día · ${days.length > 0 ? days.join(', ') : 'sin personas'}`)
  }
  return lines
}

export function ParticipationsPage() {
  return <ChurchGate>{(church) => <RolesList church={church} />}</ChurchGate>
}

export function RoleParticipationPage() {
  const { roleId = '' } = useParams()
  return <ChurchGate>{(church) => <RoleDetail church={church} roleId={roleId} />}</ChurchGate>
}

function Shell({ church, title, back, backLabel, children }: { church: Church; title: string; back: string; backLabel: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} />
      <PageHeader title={title} back={back} backLabel={backLabel} />
      <div className="grid flex-1 content-start gap-5 p-4">{children}</div>
    </main>
  )
}

function RolesList({ church }: { church: Church }) {
  const roles = useParticipations()
  const navigate = useNavigate()
  const { createRole } = useRoleActions()
  const [adding, setAdding] = useState(false)
  return (
    <Shell church={church} title="Participaciones" back="/ajustes" backLabel="Volver a ajustes">
      <p className="m-0 text-sm text-text-2">Quién toca de forma habitual y cómo rotan los turnos en cada rol. Se cargan al crear un servicio.</p>
      {roles.isPending && <p role="status" className="m-0 text-sm text-text-3">Cargando roles…</p>}
      {roles.error && <Notice tone="warn" icon="alert" role="alert">No se pudieron cargar las participaciones. Inténtalo de nuevo más tarde.</Notice>}
      {roles.data && (
        <>
          {roles.data.length === 0 && <p className="m-0 text-sm text-text-3">Esta iglesia no tiene roles musicales.</p>}
          <ul aria-label="Roles" className={`m-0 grid list-none p-0 ${roles.data.length > 0 ? card : ''}`}>
            {roles.data.map((role) => {
              const lines = summary(role)
              return (
                <li key={role.roleId} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => void navigate(`/participaciones/${encodeURIComponent(role.roleId)}`)}
                    className="flex min-h-16 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left hover:bg-surface-2">
                    <span className="flex-1">
                      <b className="block font-semibold">{role.name}</b>
                      {lines.length > 0 ? lines.map((line) => <small key={line} className="block text-[0.8125rem] text-text-2">{line}</small>)
                        : <small className="block text-[0.8125rem] text-text-3">Sin configurar</small>}
                    </span>
                    <Icon name="right" className="text-text-3" />
                  </button>
                </li>
              )
            })}
          </ul>
          {church.canConfigure && <Button variant="secondary" block onClick={() => setAdding(true)}><Icon name="plus" />Agregar rol</Button>}
        </>
      )}
      <p className="m-0 text-[0.8125rem] text-text-3">
        Una persona puede tener varios roles en un servicio, salvo las combinaciones que la iglesia no permite (se definen en Ajustes).
        Cantar mientras toca piano o guitarra no requiere asignarla también a voces.
      </p>
      <NewRoleSheet open={adding} existing={(roles.data ?? []).map((role) => ({ id: role.roleId, name: role.name }))} onClose={() => setAdding(false)} onCreate={createRole} />
    </Shell>
  )
}

type Target = { kind: 'habitual' } | { kind: 'sequence'; weekday: number | null }
const sameKey = (a: number | null, b: number | null) => a === b

function RoleDetail({ church, roleId }: { church: Church; roleId: string }) {
  const roles = useParticipations()
  const people = usePeople(true)
  const save = useSaveParticipation()
  const navigate = useNavigate()
  const { removeRole } = useRoleActions()
  const [params] = useSearchParams()
  const [picking, setPicking] = useState<Target | null>(null)
  const [removing, setRemoving] = useState(false)
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  const role = roles.data?.find((item) => item.roleId === roleId)
  const editable = church.canEdit

  if (roles.isPending) return <Shell church={church} title="Rol" back="/participaciones" backLabel="Volver a participaciones"><p role="status" className="m-0 text-sm text-text-3">Cargando rol…</p></Shell>
  if (roles.error || !role) {
    return (
      <Shell church={church} title="Rol" back="/participaciones" backLabel="Volver a participaciones">
        <Notice tone="warn" icon="alert" role="alert">{roles.error ? 'No se pudo cargar este rol. Inténtalo de nuevo más tarde.' : 'Este rol no existe en tu iglesia.'}</Notice>
      </Shell>
    )
  }

  const { rotation } = role
  const sequenceOf = (weekday: number | null): Sequence => rotation.sequences.find((sequence) => sameKey(sequence.weekday, weekday)) ?? { weekday, people: [] }
  const serviceWeekdays = [...new Set(church.days.map((day) => day.weekday))].sort((a, b) => a - b)
  const inRotation = (id: string) => rotation.sequences.some((sequence) => sequence.people.some((person) => person.id === id))
  const withSequence = (weekday: number | null, change: (list: Who[]) => Who[]): RoleParticipation => {
    const next = { ...sequenceOf(weekday), people: change(sequenceOf(weekday).people) }
    const others = rotation.sequences.filter((sequence) => !sameKey(sequence.weekday, weekday))
    return { ...role, rotation: { ...rotation, sequences: [...others, next] } }
  }

  async function apply(next: RoleParticipation) {
    setBusy(true)
    setFailure('')
    try {
      await save(roleId, toBody(next))
    } catch (caught) {
      setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar las participaciones.' : 'No se pudo guardar el cambio. Revisa que la persona siga en el directorio e inténtalo de nuevo.')
    } finally { setBusy(false) }
  }
  const move = (weekday: number | null, from: number, to: number) => apply(withSequence(weekday, (list) => {
    const copy = [...list]
    ;[copy[from], copy[to]] = [copy[to]!, copy[from]!]
    return copy
  }))

  // Quien ya está en la otra lista del mismo rol no se ofrece: habitual y rotación son excluyentes.
  const candidates = (people.data ?? []).filter((person) => {
    if (!picking) return false
    if (picking.kind === 'habitual') return !role.habitual.some((item) => item.id === person.id) && !inRotation(person.id)
    return !role.habitual.some((item) => item.id === person.id) && !sequenceOf(picking.weekday).people.some((item) => item.id === person.id)
  })
  const pick = (person: Who) => {
    if (!picking) return
    void apply(picking.kind === 'habitual' ? { ...role, habitual: [...role.habitual, person] } : withSequence(picking.weekday, (list) => [...list, person]))
    setPicking(null)
  }
  const sheetTitle = picking?.kind === 'habitual' ? `Habitual de ${role.name.toLowerCase()}` : `Rotación de ${role.name.toLowerCase()}`
  const sheetHelp = picking?.kind === 'habitual' ? 'Entra en cada servicio sin turnos.'
    : picking?.kind === 'sequence' && picking.weekday !== null ? `Se añade al final de la secuencia del ${DAY_NAMES[picking.weekday]!.toLowerCase()}.` : 'Se añade al final de la secuencia.'

  const rotationCard = (weekday: number | null, title: string) => {
    const list = sequenceOf(weekday).people
    return (
      <section key={title} aria-label={`Rotación · ${title}`} className={card}>
        <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
          <h3 className="m-0 text-[0.9375rem] font-semibold">{title}</h3>
          <small className="text-[0.8125rem] text-text-3">{list.length > 0 ? count(list.length) : 'Sin turnos'}</small>
        </div>
        <div className="grid gap-1 p-2">
          {list.length === 0 && <p className="m-0 px-1 text-[0.8125rem] text-text-3">{weekday === null ? 'Nadie en esta secuencia.' : 'Nadie en esta secuencia: este día solo lleva habituales.'}</p>}
          {list.map((person, index) => (
            <PersonRow key={person.id} person={person} number={index + 1} editable={editable} busy={busy}
              onUp={index > 0 ? () => void move(weekday, index, index - 1) : undefined}
              onDown={index < list.length - 1 ? () => void move(weekday, index, index + 1) : undefined}
              onRemove={() => void apply(withSequence(weekday, (items) => items.filter((item) => item.id !== person.id)))} />
          ))}
          {editable && <AddButton onClick={() => setPicking({ kind: 'sequence', weekday })}>Agregar a la rotación</AddButton>}
        </div>
      </section>
    )
  }

  return (
    <Shell church={church} title={role.name} back="/participaciones" backLabel="Volver a participaciones">
      <p className="m-0 text-sm text-text-2">Participaciones de {role.name.toLowerCase()} en {church.name}.</p>
      {!editable && <Notice title="Solo lectura">Cambiar las participaciones requiere ser editor o administrador de tu iglesia.</Notice>}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}

      <section aria-labelledby="habitual" className="grid gap-2">
        <h2 id="habitual" className="m-0 text-sm font-semibold">Habitual</h2>
        <div className={`${card} grid gap-1 p-2`}>
          {role.habitual.length === 0 && <p className="m-0 px-1 text-[0.8125rem] text-text-3">Nadie fijo en este rol.</p>}
          {role.habitual.map((person) => (
            <PersonRow key={person.id} person={person} editable={editable} busy={busy}
              onRemove={() => void apply({ ...role, habitual: role.habitual.filter((item) => item.id !== person.id) })} />
          ))}
          {editable && <AddButton onClick={() => setPicking({ kind: 'habitual' })}>{role.habitual.length > 0 ? 'Agregar otra persona' : 'Elegir persona'}</AddButton>}
        </div>
        <p className="m-0 text-[0.8125rem] text-text-3">Los habituales entran en todos los servicios nuevos. Puede haber varios, por ejemplo varias voces.</p>
      </section>

      <section aria-labelledby="rotation" className="grid gap-3">
        <h2 id="rotation" className="m-0 text-sm font-semibold">Rotación</h2>
        <div className={`${card} p-3`}>
          <Switch checked={rotation.enabled} disabled={!editable || busy} label="Rotar turnos"
            description="Una persona distinta cada servicio, en orden y de forma cíclica."
            onCheckedChange={(on) => void apply({ ...role, rotation: { ...rotation, enabled: on, startsOn: on ? (params.get('desde') ?? todayIn()) : rotation.startsOn } })} />
        </div>
        {rotation.enabled && (
          <>
            <div className="grid gap-1.5">
              {editable ? (
                <Segmented<Mode> label="Modalidad" value={rotation.mode} onChange={(mode) => void apply({ ...role, rotation: { ...rotation, mode } })}
                  options={[{ value: 'BY_DAY', label: 'Por día' }, { value: 'SHARED', label: 'Entre todos' }]} />
              ) : (
                <p className="m-0 text-sm font-semibold">Modalidad: {rotation.mode === 'BY_DAY' ? 'por día' : 'entre todos'}</p>
              )}
              <p className="m-0 text-[0.8125rem] text-text-3">
                {rotation.mode === 'BY_DAY' ? 'Cada día de la semana tiene su propia secuencia: un domingo no adelanta los turnos del viernes.' : 'Una sola secuencia para todos los servicios, sin importar el día.'}
              </p>
            </div>
            <TextField label="Primer turno desde" type="date" value={rotation.startsOn ?? ''} disabled={!editable || busy}
              help="Fecha de referencia: los servicios anteriores no reciben turno. Cambiarla reinicia la rotación desde la primera persona."
              onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) void apply({ ...role, rotation: { ...rotation, startsOn: event.target.value } }) }} />
            {rotation.mode === 'SHARED' ? rotationCard(null, 'Todos los servicios') : serviceWeekdays.map((weekday) => rotationCard(weekday, DAY_NAMES[weekday]!))}
          </>
        )}
      </section>

      <section aria-labelledby="preview" className="grid gap-2">
        <h2 id="preview" className="m-0 text-sm font-semibold">Próximos servicios</h2>
        <p className="m-0 text-[0.8125rem] text-text-3">Así quedaría este rol. No cambia los servicios que ya existen.</p>
        <ul aria-labelledby="preview" className={`m-0 grid list-none p-0 ${role.preview.length > 0 ? card : ''}`}>
          {role.preview.map((row) => (
            <li key={`${row.date}-${row.slot}`} className="grid grid-cols-[88px_1fr] gap-2 border-b border-line px-3 py-2 text-sm last:border-b-0">
              <b className="font-semibold">{formatDay(row.date)}{row.slot === 'MORNING' ? ' · mañana' : row.slot === 'AFTERNOON' ? ' · tarde' : ''}</b>
              <span>
                {row.rotation && <><strong>{row.rotation.name}</strong> <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-soft-text">Turno</span></>}
                {row.rotation && row.habitual.length > 0 && ' · '}
                {row.habitual.map((person) => person.name).join(', ')}
                {!row.rotation && row.habitual.length === 0 && <span className="text-text-3">Sin asignar</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {church.canConfigure && <Button variant="danger" block onClick={() => setRemoving(true)}>Eliminar rol</Button>}

      <PeopleSheet open={picking !== null} title={sheetTitle} subtitle={sheetHelp} people={candidates} onPick={pick} onClose={() => setPicking(null)} />
      <RemoveRoleSheet role={removing ? { id: role.roleId, name: role.name } : null} onClose={() => setRemoving(false)}
        onRemove={async (id, confirmed) => { await removeRole(id, confirmed); void navigate('/participaciones') }} />
    </Shell>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-touch-lg w-full cursor-pointer items-center justify-between rounded-md border border-dashed border-line-strong bg-transparent px-3 text-[0.9375rem] font-semibold text-accent hover:bg-accent-soft">
      <span>{children}</span><Icon name="plus" />
    </button>
  )
}

function PersonRow({ person, number, editable, busy, onUp, onDown, onRemove }: {
  person: Who; number?: number; editable: boolean; busy: boolean; onUp?: () => void; onDown?: () => void; onRemove: () => void
}) {
  return (
    <div className="flex min-h-touch-lg items-center gap-2 px-1">
      {number !== undefined && <span className="w-5 text-center font-mono text-sm text-text-3">{number}</span>}
      <Avatar name={person.name} />
      <span className="flex-1 text-[0.9375rem] font-medium">{person.name}</span>
      {editable && number !== undefined && (
        <>
          <Button variant="quiet" icon aria-label={`Subir a ${person.name}`} disabled={!onUp || busy} onClick={onUp}><Icon name="down" className="rotate-180" /></Button>
          <Button variant="quiet" icon aria-label={`Bajar a ${person.name}`} disabled={!onDown || busy} onClick={onDown}><Icon name="down" /></Button>
        </>
      )}
      {editable && <Button variant="quiet" icon aria-label={`Quitar a ${person.name}`} disabled={busy} onClick={onRemove}><Icon name="x" /></Button>}
    </div>
  )
}
