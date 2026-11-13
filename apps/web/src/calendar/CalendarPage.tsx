import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Avatar, Button, Icon, Notice, Sheet, StatusChip, Tabbar, Toast, format12h, from24h, type IconName, type ServiceStatus } from '../ui'
import { ChurchGate, TopBar } from './ChurchGate'
import { useServices } from './api'
import { formatDay, formatLongDay, monthCells, monthOf, monthTitle, shiftMonth, todayIn } from './dates'
import type { Church, Service, Status } from './model'

const status = (value: Status) => value.toLowerCase() as ServiceStatus
const statusText: Record<ServiceStatus, string> = { draft: 'Borrador', published: 'Publicado', completed: 'Completado', cancelled: 'Cancelado' }
const markerIcon: Record<ServiceStatus, IconName> = { draft: 'dash', published: 'dot', completed: 'check', cancelled: 'x' }
const markerColor: Record<ServiceStatus, string> = { draft: 'text-draft-fg', published: 'text-pub-fg', completed: 'text-done-fg', cancelled: 'text-cancel-fg' }
const timeText = (time: string | null) => (time ? format12h(from24h(time)) : 'Sin hora fija')
const slotText = { SINGLE: '', MORNING: ' · Mañana', AFTERNOON: ' · Tarde' } as const

export function CalendarPage() {
  return <ChurchGate>{(church) => <Calendar church={church} />}</ChurchGate>
}

function Calendar({ church }: { church: Church }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const created = Boolean((useLocation().state as { created?: boolean } | null)?.created)
  const [toast, setToast] = useState(created)
  const [openId, setOpenId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const today = todayIn()
  const requested = params.get('mes') ?? ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : monthOf(today)
  const { services, loading, error } = useServices([month])
  const go = (target: string) => setParams(target === monthOf(today) ? {} : { mes: target })
  const upcoming = services.filter((service) => service.date >= today)
  const past = services.filter((service) => service.date < today)
  const open = services.find((service) => service.id === openId)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} />
      <main className="flex-1 pb-4">
        <div className="flex items-center gap-1 px-4 py-3">
          <h1 className="m-0 flex-1 font-display text-xl font-bold">{monthTitle(month)}</h1>
          <Button variant="quiet" onClick={() => go(monthOf(today))}>Hoy</Button>
          <Button variant="quiet" icon aria-label="Mes anterior" onClick={() => go(shiftMonth(month, -1))}><Icon name="right" className="-scale-x-100" /></Button>
          <Button variant="quiet" icon aria-label="Mes siguiente" onClick={() => go(shiftMonth(month, 1))}><Icon name="right" /></Button>
        </div>
        <MonthGrid month={month} today={today} services={services} onOpen={setOpenId} />
        {error ? (
          <div className="p-4"><Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el mes">Revisa tu conexión e inténtalo de nuevo.</Notice></div>
        ) : loading ? (
          <p role="status" className="p-4 text-text-2">Cargando servicios…</p>
        ) : (
          <>
            <section aria-labelledby="agenda" className="px-4 pt-4">
              <div className="flex items-center justify-between">
                <h2 id="agenda" className="m-0 text-base font-semibold">{month === monthOf(today) ? 'Próximos servicios' : 'Servicios del mes'}</h2>
                {past.length > 0 && <Button variant="quiet" onClick={() => setShowPast(!showPast)}>{showPast ? 'Ocultar anteriores' : `Ver anteriores (${past.length})`}</Button>}
              </div>
              {services.length === 0 && <p className="text-text-2">No hay servicios en {monthTitle(month).toLowerCase()}.</p>}
              <ul className="m-0 grid list-none gap-2 p-0 pt-2">
                {(showPast ? services : upcoming).map((service) => <AgendaRow key={service.id} service={service} onOpen={() => setOpenId(service.id)} />)}
              </ul>
              {services.length > 0 && upcoming.length === 0 && !showPast && <p className="text-text-2">No quedan servicios próximos este mes.</p>}
            </section>
          </>
        )}
      </main>
      {toast && <div className="px-4 pb-2"><Toast message="Servicio creado" onDismiss={() => setToast(false)} /></div>}
      <Tabbar label="Principal" items={[{ id: 'calendar', label: 'Calendario', icon: 'calendar' }]} current="calendar" onSelect={() => {}}
        action={church.canEdit ? { label: 'Nuevo', icon: 'plus', onAction: () => void navigate('/servicios/nuevo') } : undefined} />
      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.title ?? 'Servicio'}>
        {open && <Detail service={open} />}
      </Sheet>
    </div>
  )
}

function MonthGrid({ month, today, services, onOpen }: { month: string; today: string; services: Service[]; onOpen: (id: string) => void }) {
  return (
    <div className="px-2">
      <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs font-semibold text-text-3">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((letter, index) => <span key={index} className="py-1">{letter}</span>)}
      </div>
      <div role="group" aria-label={`Días de ${monthTitle(month)}`} className="grid grid-cols-7 gap-px">
        {monthCells(month).map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />
          const day = services.filter((service) => service.date === date)
          const body = (
            <>
              <span className={date === today ? 'grid size-6 place-items-center rounded-full bg-accent text-on-accent' : ''}>{Number(date.slice(8))}</span>
              <span className="flex h-4 items-center gap-0.5" aria-hidden="true">
                {day.map((service) => <Icon key={service.id} name={markerIcon[status(service.status)]} width={14} height={14} strokeWidth={2.25} className={markerColor[status(service.status)]} />)}
              </span>
            </>
          )
          const cell = 'flex min-h-12 flex-col items-center justify-start gap-0.5 rounded-md pt-1 text-sm'
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

function AgendaRow({ service, onOpen }: { service: Service; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="grid min-h-16 w-full cursor-pointer grid-cols-[64px_1fr] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left">
        <span className="text-sm font-semibold">{formatDay(service.date)}</span>
        <span className="grid gap-1">
          <span className={status(service.status) === 'cancelled' ? 'font-semibold line-through' : 'font-semibold'}>{service.title}</span>
          <span className="text-[0.8125rem] text-text-2">{timeText(service.time)}{slotText[service.slot]} · {service.director.name}</span>
          <StatusChip status={status(service.status)} className="w-fit" />
        </span>
      </button>
    </li>
  )
}

function Detail({ service }: { service: Service }) {
  return (
    <div className="grid gap-4">
      <StatusChip status={status(service.status)} className="w-fit" />
      <p className="m-0 text-text-2">{formatLongDay(service.date)} · {timeText(service.time)}{slotText[service.slot]}</p>
      <section aria-labelledby="direction" className="grid gap-2">
        <h3 id="direction" className="m-0 text-sm font-semibold text-text-2">Dirección</h3>
        <div className="flex items-center gap-3">
          <Avatar name={service.director.name} />
          <span className="font-semibold">{service.director.name}</span>
        </div>
      </section>
    </div>
  )
}
