import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Avatar, Button, Icon, Notice, Toast, fold, inputClass } from '../ui'
import { cx } from '../ui/cx'
import { AppShell } from '../calendar/AppShell'
import { ChurchGate } from '../calendar/ChurchGate'
import { usePeople } from '../calendar/api'
import { useRoles } from '../calendar/roles-api'
import type { Church, Person } from '../calendar/model'

export function PeoplePage() {
  return <ChurchGate>{(church) => <Directory church={church} />}</ChurchGate>
}

type Group = 'all' | 'play' | 'direct' | 'preach'
const GROUPS: ReadonlyArray<{ value: Group; label: string }> = [{ value: 'all', label: 'Todas' }, { value: 'play', label: 'Alabanza' }, { value: 'direct', label: 'Dirección' }, { value: 'preach', label: 'Predicación' }]

/** Lista alfabética (el servidor ya la ordena) con búsqueda por nombre sin distinguir acentos. */
function Directory({ church }: { church: Church }) {
  const navigate = useNavigate()
  const removed = (useLocation().state as { removed?: string } | null)?.removed
  const people = usePeople(true)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<Group>('all')
  const roles = useRoles()
  const [toast, setToast] = useState(removed ? `${removed} ya no figura en ${church.name}` : '')
  const everyone = people.data ?? []
  const inGroup = (person: Person, value: Group) => value === 'all' || (value === 'play' ? person.canPlay : value === 'direct' ? person.canDirect : person.canPreach)
  const groups = GROUPS.filter((item) => item.value !== 'preach' || church.usesPreaching)
  const found = everyone.filter((person) => inGroup(person, group) && fold(person.name).includes(fold(query)))
  const roleNames = new Map((roles.data ?? []).map((role) => [role.id, role.name]))
  // Lo que dice cada fila: los roles musicales si está en el grupo de alabanza (o «Alabanza» si aún no tiene) y las demás funciones.
  const detail = (person: Person) => [
    person.canPlay ? (person.roleIds.map((id) => roleNames.get(id)).filter(Boolean).join(', ') || 'Alabanza') : '',
    person.canDirect ? 'Dirige' : '', church.usesPreaching && person.canPreach ? 'Predica' : '',
  ].filter(Boolean).join(' · ')
  const add = () => void navigate('/personas/nueva', { state: { name: query.trim() } })

  return (
    <AppShell church={church} current="people" action={church.canEdit ? { label: 'Agregar persona', onAction: add } : undefined}>
        <main className="grid flex-1 content-start gap-3 p-4">
          <div className="flex items-center gap-3">
            <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Personas</h1>
            {church.canEdit && <Button variant="primary" onClick={add} className="max-lg:hidden"><Icon name="plus" />Agregar</Button>}
          </div>
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
            <input type="search" autoComplete="off" placeholder="Buscar por nombre" aria-label="Buscar personas por nombre"
              value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-10`} />
          </div>
          {everyone.length > 0 && (
            <div role="group" aria-label="Filtrar por grupo" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
              {groups.map((item) => {
                const count = everyone.filter((person) => inGroup(person, item.value)).length
                return (
                  <button key={item.value} type="button" aria-pressed={group === item.value} onClick={() => setGroup(item.value)}
                    className={cx('min-h-11 flex-none cursor-pointer rounded-full border px-3.5 text-sm font-medium whitespace-nowrap', group === item.value ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-text hover:bg-surface-2')}>
                    {item.label} <span className={cx('[font-variant-numeric:tabular-nums]', group === item.value ? 'text-on-accent' : 'text-text-3')}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}
          {people.isPending && <p role="status">Cargando personas…</p>}
          {people.isError && (
            <>
              <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el directorio">Revisa tu conexión e inténtalo de nuevo.</Notice>
              <Button variant="secondary" onClick={() => void people.refetch()}>Reintentar</Button>
            </>
          )}
          {people.data && people.data.length === 0 && (
            <Notice title="Aún no hay personas">{church.canEdit ? 'Agrega a la primera con «Agregar»: no necesita una cuenta.' : 'Quien edita la iglesia puede agregarlas.'}</Notice>
          )}
          {people.data && people.data.length > 0 && (
            <p aria-live="polite" className="m-0 text-[0.8125rem] text-text-2">
              {found.length === people.data.length ? `${found.length} ${found.length === 1 ? 'persona' : 'personas'}` : `${found.length} de ${people.data.length}`}
            </p>
          )}
          {found.length > 0 && (
            <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
              {found.map((person) => (
                <li key={person.id} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => void navigate(`/personas/${encodeURIComponent(person.id)}`)}
                    className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2">
                    <Avatar name={person.name} />
                    <span className="grid flex-1">
                      <b className="text-[0.9375rem] font-semibold">{person.name}{person.isYou && <span className="ml-2 rounded-full border border-line-strong bg-surface-2 px-2 text-[0.8125rem] font-medium text-text-2">Tú</span>}</b>
                      {detail(person) && <small className="text-[0.8125rem] text-text-3">{detail(person)}</small>}
                    </span>
                    {person.hasAccount && <span className="rounded-full border border-pub-bd bg-pub-bg px-2.5 text-[0.8125rem] font-medium text-pub-fg">Con cuenta</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {people.data && people.data.length > 0 && found.length === 0 && (
            <div className="grid justify-items-center gap-2 py-6 text-center">
              <h2 className="m-0 font-display text-lg font-bold">Sin resultados</h2>
              <p className="m-0 text-text-2">{query.trim() ? `Nadie coincide con «${query.trim()}».` : `Nadie está en ${group === 'play' ? 'el grupo de alabanza' : group === 'direct' ? 'dirección' : 'predicación'} todavía. Se marca en la ficha de cada persona.`}</p>
              {church.canEdit && query.trim() && <Button variant="secondary" onClick={add}>Agregar «{query.trim()}»</Button>}
            </div>
          )}
        </main>
        {toast !== '' && <div className="px-4 pb-2"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
    </AppShell>
  )
}
