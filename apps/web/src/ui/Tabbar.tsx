import { cx } from './cx'
import { Icon, type IconName } from './Icon'

export type TabItem = { id: string; label: string; icon: IconName }

/**
 * Navegación inferior. Con `action` aparece al centro (p. ej. «Nuevo»); sin él,
 * los destinos se reparten el ancho (el integrante, que solo consulta).
 */
export function Tabbar({
  label,
  items,
  current,
  onSelect,
  action,
}: {
  label: string
  items: ReadonlyArray<TabItem>
  current: string
  onSelect: (id: string) => void
  action?: { label: string; icon: IconName; onAction: () => void }
}) {
  const tab =
    'relative flex min-h-16 flex-col items-center justify-start gap-0.5 rounded-md border-0 bg-transparent pt-0.5 ' +
    'text-xs leading-tight font-medium cursor-pointer'
  const [first, ...rest] = items
  const destination = (item: TabItem) => (
    <button
      key={item.id}
      type="button"
      aria-current={item.id === current ? 'page' : undefined}
      onClick={() => onSelect(item.id)}
      className={cx(
        tab,
        item.id === current
          ? 'text-accent before:absolute before:-top-[5px] before:h-[3px] before:w-6 before:rounded-b-[3px] before:bg-accent before:content-[""]'
          : 'text-text-3 hover:text-text',
      )}
    >
      <span className="grid h-10 place-items-center">
        <Icon name={item.icon} />
      </span>
      {item.label}
    </button>
  )
  return (
    <nav
      aria-label={label}
      className={cx(
        'grid border-t border-line bg-surface px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]',
        action ? 'grid-cols-[1fr_76px_1fr]' : 'auto-cols-fr grid-flow-col',
      )}
    >
      {first && destination(first)}
      {action && (
        <button
          type="button"
          onClick={action.onAction}
          className={cx(tab, 'text-text-3 hover:[&_.fab]:bg-accent-hover')}
        >
          <span className="grid h-10 place-items-center">
            <span className="fab grid size-10 place-items-center rounded-[13px] bg-accent text-on-accent shadow-1">
              <Icon name={action.icon} />
            </span>
          </span>
          {action.label}
        </button>
      )}
      {rest.map(destination)}
    </nav>
  )
}
