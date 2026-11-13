import { useEffect, useRef, type KeyboardEvent } from 'react'
import { cx } from './cx'
import { HOURS, MINUTES, type Meridiem, type Time12 } from './time'

const ITEM = 44

function Column<T extends number | string>({
  label,
  items,
  value,
  text,
  onPick,
}: {
  label: string
  items: ReadonlyArray<T>
  value: T
  text: (item: T) => string
  onPick: (item: T) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const index = Math.max(0, items.indexOf(value))

  useEffect(() => {
    if (ref.current && Math.round(ref.current.scrollTop / ITEM) !== index) ref.current.scrollTop = index * ITEM
    return () => clearTimeout(timer.current)
  }, [index])

  function move(to: number) {
    const next = Math.max(0, Math.min(items.length - 1, to))
    const item = items[next]
    if (item !== undefined && item !== value) onPick(item)
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    move(index + (event.key === 'ArrowDown' ? 1 : -1))
  }

  return (
    <div
      ref={ref}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      onKeyDown={onKeyDown}
      onScroll={(event) => {
        const el = event.currentTarget
        clearTimeout(timer.current)
        timer.current = setTimeout(() => move(Math.round(el.scrollTop / ITEM)), 60)
      }}
      className={cx(
        'h-[220px] snap-y snap-mandatory overscroll-contain rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        '[mask-image:linear-gradient(transparent,#000_32%,#000_68%,transparent)] -outline-offset-2',
        items.length < 2 ? 'overflow-hidden' : 'overflow-y-auto',
      )}
    >
      <div aria-hidden="true" className="h-[88px]" />
      {items.map((item, i) => (
        <div
          key={item}
          role="option"
          aria-selected={i === index}
          onClick={() => {
            move(i)
            ref.current?.scrollTo?.({ top: i * ITEM, behavior: 'smooth' })
          }}
          className={cx(
            'flex h-11 cursor-pointer snap-center items-center justify-center text-[1.375rem] tabular-nums select-none',
            i === index ? 'font-semibold text-text' : 'font-medium text-text-3',
          )}
        >
          {text(item)}
        </div>
      ))}
      <div aria-hidden="true" className="h-[88px]" />
    </div>
  )
}

const meridiemText = (m: Meridiem) => (m === 'am' ? 'a.m.' : 'p.m.')

/**
 * Rueda de hora: horas, minutos cada 15 y a.m./p.m. (12 antes de la 1). Controlada.
 * `hours` y `meridiems` permiten restringir, p. ej. la mañana de un domingo con dos servicios.
 */
export function TimeWheel({
  value,
  onChange,
  hours = HOURS,
  meridiems = ['am', 'pm'],
}: {
  value: Time12
  onChange: (value: Time12) => void
  hours?: ReadonlyArray<number>
  meridiems?: ReadonlyArray<Meridiem>
}) {
  return (
    <div
      role="group"
      aria-label="Hora"
      className="relative my-2 mb-4 grid grid-cols-[1fr_16px_1fr_1fr] items-center before:pointer-events-none before:absolute before:inset-x-0 before:top-[88px] before:h-11 before:border-y-2 before:border-accent before:opacity-55 before:content-['']"
    >
      <Column label="Hora" items={hours} value={value.hour} text={String} onPick={(hour) => onChange({ ...value, hour })} />
      <span aria-hidden="true" className="text-center text-xl font-semibold text-text-3">
        :
      </span>
      <Column
        label="Minutos"
        items={MINUTES}
        value={value.minute}
        text={(m) => String(m).padStart(2, '0')}
        onPick={(minute) => onChange({ ...value, minute })}
      />
      <Column
        label="a.m. o p.m."
        items={meridiems}
        value={value.meridiem}
        text={meridiemText}
        onPick={(meridiem) => onChange({ ...value, meridiem })}
      />
    </div>
  )
}
