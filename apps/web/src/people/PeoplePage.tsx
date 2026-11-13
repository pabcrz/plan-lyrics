import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Avatar, Button, Icon, Notice, Toast, fold, inputClass } from '../ui'
import { ChurchGate, MainTabbar, TopBar } from '../calendar/ChurchGate'
import { usePeople } from '../calendar/api'
import type { Church } from '../calendar/model'

export function PeoplePage() {
  return <ChurchGate>{(church) => <Directory church={church} />}</ChurchGate>
}

/** Lista alfabética (el servidor ya la ordena) con búsqueda por nombre sin distinguir acentos. */
function Directory({ church }: { church: Church }) {
  const navigate = useNavigate()
  const removed = (useLocation().state as { removed?: string } | null)?.removed
  const people = usePeople(true)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState(removed ? `${removed} ya no figura en ${church.name}` : '')
  const found = (people.data ?? []).filter((person) => fold(person.name).includes(fold(query)))
  const add = () => void navigate('/personas/nueva', { state: { name: query.trim() } })

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <main className="grid flex-1 content-start gap-3 p-4">
        <div className="flex items-center gap-3">
          <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Personas</h1>
          {church.canEdit && <Button variant="primary" onClick={add}><Icon name="plus" />Agregar</Button>}
        </div>
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
          <input type="search" autoComplete="off" placeholder="Buscar por nombre" aria-label="Buscar personas por nombre"
            value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-10`} />
        </div>
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
                  <b className="flex-1 text-[0.9375rem] font-semibold">{person.name}</b>
                  {person.hasAccount && <span className="rounded-full border border-pub-bd bg-pub-bg px-2.5 text-[0.8125rem] font-medium text-pub-fg">Con cuenta</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {people.data && people.data.length > 0 && found.length === 0 && (
          <div className="grid justify-items-center gap-2 py-6 text-center">
            <h2 className="m-0 font-display text-lg font-bold">Sin resultados</h2>
            <p className="m-0 text-text-2">Nadie coincide con «{query.trim()}».</p>
            {church.canEdit && <Button variant="secondary" onClick={add}>Agregar «{query.trim()}»</Button>}
          </div>
        )}
      </main>
      {toast !== '' && <div className="px-4 pb-2"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
      <MainTabbar church={church} current="people" />
    </div>
  )
}
