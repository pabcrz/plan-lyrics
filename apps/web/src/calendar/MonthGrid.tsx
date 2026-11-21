import { Icon, type IconName, type ServiceStatus } from '../ui'
import { formatLongDay, monthCells, monthTitle } from './dates'
import { status, statusText } from './service-ui'
import type { ClosedDate, Service } from './model'

const markerIcon: Record<ServiceStatus, IconName> = { draft: 'dash', published: 'dot', completed: 'check', cancelled: 'x' }
const markerColor: Record<ServiceStatus, string> = { draft: 'text-draft-fg', published: 'text-pub-fg', completed: 'text-done-fg', cancelled: 'text-cancel-fg' }

export const closedOn = (closed: ClosedDate[], date: string) => closed.find((item) => item.date === date)
const closedText = (item: ClosedDate) => (item.reason ? `No hay culto, ${item.reason}` : 'No hay culto')

/** Cuadrícula del mes: cada día dice su estado en el nombre accesible, no solo en el color. */
export function MonthGrid({ month, today, services, closed, canEdit, onOpen, onOpenDate }: {
  month: string; today: string; services: Service[]; closed: ClosedDate[]; canEdit: boolean
  onOpen: (id: string) => void; onOpenDate: (date: string) => void
}) {
  return (
    <div className="px-2">
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs font-semibold text-text-3">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((letter, index) => <span key={index} className="py-1">{letter}</span>)}
      </div>
      <div role="group" aria-label={`Días de ${monthTitle(month)}`} className="grid grid-cols-7 gap-px">
        {monthCells(month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const day = services.filter((service) => service.date === date)
          const off = closedOn(closed, date)
          const body = (
            <>
              <span className={date === today ? 'grid size-6 place-items-center rounded-full bg-accent text-on-accent' : ''}>{Number(date.slice(8))}</span>
              <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
                {off && <Icon name="ban" width={14} height={14} strokeWidth={2.25} className="text-text-2" />}
                {day.map((service) => <Icon key={service.id} name={markerIcon[status(service.status)]} width={14} height={14} strokeWidth={2.25} className={markerColor[status(service.status)]} />)}
              </span>
            </>
          )
          const cell = 'flex min-h-12 flex-col items-center justify-start gap-0.5 rounded-md pt-1 text-sm'
          // Fecha sin culto: su estado va en el nombre accesible y en el icono, no solo en el color.
          if (off) {
            return (
              <button key={date} type="button" aria-current={date === today ? 'date' : undefined} onClick={() => onOpenDate(date)}
                aria-label={`${formatLongDay(date)}: ${closedText(off)}`}
                className={`${cell} cursor-pointer border border-dashed border-line-strong bg-surface hover:bg-accent-soft`}>{body}</button>
            )
          }
          // Solo se puede marcar una fecha libre desde hoy: la API vuelve a comprobarlo.
          if (day.length === 0 && canEdit && date >= today) {
            return (
              <button key={date} type="button" aria-current={date === today ? 'date' : undefined} onClick={() => onOpenDate(date)}
                aria-label={`${formatLongDay(date)}: sin servicio`} className={`${cell} cursor-pointer border-0 bg-transparent text-text-2 hover:bg-accent-soft`}>{body}</button>
            )
          }
          return day.length > 0 ? (
            <button key={date} type="button" aria-current={date === today ? 'date' : undefined} onClick={() => onOpen(day[0].id)}
              aria-label={`${formatLongDay(date)}: ${day.map((service) => `${service.title}, ${statusText[status(service.status)]}`).join('; ')}`}
              className={`${cell} cursor-pointer border-0 bg-surface-2 hover:bg-accent-soft`}>{body}</button>
          ) : (
            <div key={date} aria-current={date === today ? 'date' : undefined} className={`${cell} text-text-2`}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}
