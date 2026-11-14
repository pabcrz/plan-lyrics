import { useState } from 'react'
import { Avatar, Button, Sheet, TextField, fold } from '../ui'
import type { Person } from './model'

/** Búsqueda y lista de personas del directorio. Con `selectedId` marca la elegida; sin él, elegir es inmediato. */
export function PersonList({ people, selectedId, onSelect, empty, detail }: {
  people: ReadonlyArray<Person>; selectedId?: string | null; onSelect: (person: Person) => void; empty: string; detail?: (person: Person) => string | undefined
}) {
  const [query, setQuery] = useState('')
  const shown = people.filter((person) => !query.trim() || fold(person.name).includes(fold(query))).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return (
    <div className="grid gap-2">
      <TextField label="Buscar persona" type="search" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} />
      {shown.length === 0 ? (
        <p className="m-0 py-2 text-[0.8125rem] text-text-3">{people.length === 0 ? empty : 'Nadie coincide con esa búsqueda.'}</p>
      ) : (
        <ul aria-label="Personas" className="m-0 max-h-[40dvh] list-none overflow-y-auto rounded-md border border-line bg-surface p-0">
          {shown.map((person) => (
            <li key={person.id}>
              <button type="button" aria-pressed={selectedId === undefined ? undefined : selectedId === person.id} onClick={() => onSelect(person)}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent px-3 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft">
                <Avatar name={person.name} />
                <span>
                  <b className="block text-[0.9375rem] leading-tight font-semibold">{person.name}</b>
                  {detail?.(person) && <small className="text-[0.8125rem] text-text-3">{detail(person)}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Hoja para elegir una persona y agregarla a una lista (habituales o secuencia de rotación). */
export function PeopleSheet({ open, title, subtitle, people, onPick, onClose }: {
  open: boolean; title: string; subtitle: string; people: ReadonlyArray<Person>; onPick: (person: Person) => void; onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-3">
        <p className="m-0 text-sm text-text-2">{subtitle}</p>
        <PersonList people={people} onSelect={onPick} empty="No hay más personas para agregar. Las personas nuevas se dan de alta en Personas." />
        <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
      </div>
    </Sheet>
  )
}
