import { useId, useState, type ReactNode } from 'react'
import { cx } from './cx'
import { Field, inputClass } from './Field'
import { Icon } from './Icon'

export type Person = { id: string; name: string; detail?: string }

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid size-8 flex-none place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-text',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

/** Fila del listado. Úsala dentro de `PersonPicker`, que aporta `id` y el estado activo. */
export function PersonOption({
  id,
  active,
  onSelect,
  children,
  add,
}: {
  id: string
  active: boolean
  onSelect: () => void
  children: ReactNode
  add?: boolean
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      // mouseDown evita que el campo pierda el foco antes de elegir.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cx(
        'flex min-h-14 w-full cursor-pointer items-center gap-3 border-b border-line px-3 text-left last:border-b-0 hover:bg-surface-2',
        active && 'bg-surface-2',
        add && 'font-semibold text-accent',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Selector de personas (combobox con listbox). El filtrado lo decide quien lo usa:
 * recibe las `people` ya filtradas. Con `onAddNew` ofrece guardar el texto como persona nueva.
 */
export function PersonPicker({
  label,
  query,
  onQueryChange,
  people,
  onSelect,
  onAddNew,
  help,
  error,
}: {
  label: string
  query: string
  onQueryChange: (query: string) => void
  people: ReadonlyArray<Person>
  onSelect: (person: Person) => void
  onAddNew?: (name: string) => void
  help?: ReactNode
  error?: ReactNode
}) {
  const base = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const name = query.trim()
  const canAdd = Boolean(onAddNew) && name.length > 0 && !people.some((p) => p.name.toLowerCase() === name.toLowerCase())
  const count = people.length + (canAdd ? 1 : 0)
  const showList = open && count > 0
  const optionId = (index: number) => `${base}-o${index}`

  function choose(index: number) {
    const person = people[index]
    if (person) onSelect(person)
    else if (canAdd) onAddNew?.(name)
    setOpen(false)
  }

  return (
    <div className="grid gap-2">
      <Field label={label} help={help} error={error}>
        {(control) => (
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
            <input
              {...control}
              role="combobox"
              aria-expanded={showList}
              aria-controls={`${base}-list`}
              aria-autocomplete="list"
              aria-activedescendant={showList ? optionId(active) : undefined}
              autoComplete="off"
              value={query}
              className={cx(inputClass, 'pl-10')}
              onChange={(event) => {
                onQueryChange(event.target.value)
                setActive(0)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
                else if (event.key === 'ArrowDown' && count > 0) {
                  event.preventDefault()
                  setOpen(true)
                  setActive((active + 1) % count)
                } else if (event.key === 'ArrowUp' && count > 0) {
                  event.preventDefault()
                  setActive((active - 1 + count) % count)
                } else if (event.key === 'Enter' && showList) {
                  event.preventDefault()
                  choose(active)
                }
              }}
            />
          </div>
        )}
      </Field>
      {showList && (
        <div
          role="listbox"
          id={`${base}-list`}
          aria-label={`${label}: resultados`}
          className="overflow-hidden rounded-md border border-line bg-surface shadow-2"
        >
          {people.map((person, index) => (
            <PersonOption key={person.id} id={optionId(index)} active={index === active} onSelect={() => choose(index)}>
              <Avatar name={person.name} />
              <span>
                <b className="block text-[0.9375rem] leading-tight font-semibold">{person.name}</b>
                {person.detail && <small className="text-[0.8125rem] text-text-3">{person.detail}</small>}
              </span>
            </PersonOption>
          ))}
          {canAdd && (
            <PersonOption id={optionId(people.length)} active={active === people.length} onSelect={() => choose(people.length)} add>
              <span className="grid size-8 place-items-center rounded-full border-[1.5px] border-dashed border-accent">
                <Icon name="plus" />
              </span>
              <span>Agregar «{name}» como persona nueva</span>
            </PersonOption>
          )}
        </div>
      )}
    </div>
  )
}
