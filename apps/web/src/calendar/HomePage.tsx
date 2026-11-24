import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { saveUpcoming } from '../offline-cache'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button, Icon, Notice, Sheet, StatusChip, Toast } from '../ui'
import { cx } from '../ui/cx'
import { AppShell, NewServiceButton } from './AppShell'
import { ChurchGate } from './ChurchGate'
import { DaySheet } from './DaySheet'
import { MonthGrid, closedOn } from './MonthGrid'
import { useAgenda, useApiFetch, useClosedDates, useMyChurches, useServices, useSwitchChurch, type AgendaService } from './api'
import { formatDay, formatLongDay, monthOf, monthTitle, shiftMonth, todayIn } from './dates'
import { slotText, status, timeText } from './service-ui'
import type { Church, ClosedDate, Service } from './model'

// Cuántos servicios próximos muestra el panel del mes en curso; el calendario llega a cualquier otro mes.
const SHOWN = 6
const DESKTOP = '(min-width: 1024px)'

type Item = { kind: 'service'; date: string; service: Service } | { kind: 'closed'; date: string; closed: ClosedDate }

export function HomePage() {
  return <ChurchGate>{(church) => <Home church={church} />}</ChurchGate>
}

/**
 * Inicio: el calendario del mes (plegable en móvil, fijo a la derecha en escritorio) y, debajo, los servicios como tarjetas;
 * tocar una tarjeta o un día con servicio abre la pantalla del servicio. Sin `?mes=` muestra lo que viene este mes y el siguiente.
 */
function Home({ church }: { church: Church }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const created = Boolean((useLocation().state as { created?: boolean } | null)?.created)
  const [toast, setToast] = useState(created ? 'Servicio creado' : '')
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [expanded, setExpanded] = useState(() => window.matchMedia?.(DESKTOP).matches ?? false)
  const today = todayIn()
  const requested = params.get('mes') ?? ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : monthOf(today)
  const current = month === monthOf(today)
  const loaded = current ? [month, shiftMonth(month, 1)] : [month]
  const monthServices = useServices(loaded)
  const monthClosed = useClosedDates(loaded)
  const loading = monthServices.loading || monthClosed.loading
  const error = monthServices.error ?? monthClosed.error
  const go = (target: string) => setParams(target === monthOf(today) ? {} : { mes: target })
  const inMonth = (date: string) => monthOf(date) === month
  const gridServices = monthServices.services.filter((service) => inMonth(service.date))
  const gridClosed = monthClosed.closed.filter((item) => inMonth(item.date))
  const all: Item[] = [
    ...monthServices.services.map((service): Item => ({ kind: 'service', date: service.date, service })),
    ...monthClosed.closed.map((item): Item => ({ kind: 'closed', date: item.date, closed: item })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  // Mes en curso: lo que viene (y, a petición, lo que ya pasó de este mes). Otro mes: el mes completo.
  const upcoming = all.filter((item) => (current ? item.date >= today : inMonth(item.date))).slice(0, current ? SHOWN : undefined)
  // Con conexión, deja leíbles sin red el setlist y las letras de lo que viene.
  const api = useApiFetch()
  const queryClient = useQueryClient()
  const offlineIds = upcoming.flatMap((item) => (item.kind === 'service' && item.service.status !== 'CANCELLED' ? [item.service.id] : [])).join(',')
  useEffect(() => { if (offlineIds && navigator.onLine) void saveUpcoming(queryClient, api, offlineIds.split(',')) }, [offlineIds, api, queryClient])
  const past = current ? all.filter((item) => inMonth(item.date) && item.date < today) : []
  const items = showPast ? [...past, ...upcoming] : upcoming
  const count = gridServices.length
  // Con dos o más iglesias, «Próximos servicios» reúne las de todas; el calendario sigue siendo el de la iglesia activa.
  const several = (useMyChurches().data?.filter((item) => item.role).length ?? 0) >= 2
  const agenda = useAgenda(several && current)
  const switchTo = useSwitchChurch()
  const united = several && current

  const calendar = (
    <section aria-label="Calendario" className="rounded-lg border border-line bg-surface lg:sticky lg:top-4">
      <div className="flex items-center gap-1 py-1 pr-2 pl-1">
        <button type="button" aria-expanded={expanded} aria-controls="calendar-body" onClick={() => setExpanded(!expanded)}
          className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left font-semibold hover:bg-surface-2">
          <Icon name="calendar" />
          <span className="flex-1"><span className="block">{monthTitle(month)}</span><small className="block font-normal text-text-2">{count === 0 ? 'Sin servicios' : `${count} ${count === 1 ? 'servicio' : 'servicios'}`}</small></span>
          <Icon name="down" className={cx('transition-transform duration-(--t-base) ease-out motion-reduce:transition-none', expanded && 'rotate-180')} />
        </button>
        {expanded && (
          <>
            {!current && <Button variant="quiet" onClick={() => go(monthOf(today))}>Hoy</Button>}
            <Button variant="quiet" icon aria-label="Mes anterior" onClick={() => go(shiftMonth(month, -1))}><Icon name="right" className="-scale-x-100" /></Button>
            <Button variant="quiet" icon aria-label="Mes siguiente" onClick={() => go(shiftMonth(month, 1))}><Icon name="right" /></Button>
          </>
        )}
      </div>
      <div id="calendar-body" inert={!expanded} className={cx('grid transition-[grid-template-rows] duration-(--t-base) ease-out motion-reduce:transition-none', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div className="pb-3">
            <MonthGrid month={month} today={today} services={gridServices} closed={gridClosed} canEdit={church.canEdit}
              onOpen={(id) => void navigate(`/servicios/${id}`)} onOpenDate={setOpenDate} />
          </div>
        </div>
      </div>
    </section>
  )

  return (
    <AppShell church={church} current="home" wide>
      <main className="grid flex-1 content-start gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-6 lg:px-6">
        <div className="flex items-center gap-3 lg:col-start-1">
          <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Inicio</h1>
          <NewServiceButton church={church} />
        </div>
        <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">{calendar}</div>
        <div className="flex items-center gap-2 lg:col-start-1">
          <h2 className="m-0 flex-1 text-base font-semibold text-text-2">{current ? 'Próximos servicios' : `Servicios de ${monthTitle(month).split(' ')[0].toLowerCase()}`}</h2>
          {past.length > 0 && <Button variant="quiet" onClick={() => setShowPast(!showPast)}>{showPast ? 'Ocultar anteriores' : `Ver anteriores (${past.length})`}</Button>}
        </div>
        <div className="lg:col-start-1">
          {united ? (
            agenda.isError ? <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los servicios">Revisa tu conexión e inténtalo de nuevo.</Notice>
              : !agenda.data ? <p role="status" className="m-0 text-text-2">Cargando servicios…</p>
                : agenda.data.length === 0 ? <p className="m-0 py-6 text-center text-text-2">No hay servicios próximos en tus iglesias.</p>
                  : <ul className="m-0 grid list-none gap-3 p-0">{agenda.data.map((item: AgendaService) => <li key={item.id}><ServiceCard service={item} church={{ id: item.churchId, name: item.churchName, open: () => switchTo(item.churchId) }} /></li>)}</ul>
          ) : error ? (
            <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los servicios">Revisa tu conexión e inténtalo de nuevo.</Notice>
          ) : loading ? (
            <p role="status" className="m-0 text-text-2">Cargando servicios…</p>
          ) : items.length === 0 ? (
            <div className="grid justify-items-center gap-2 py-6 text-center">
              <h3 className="m-0 font-display text-lg font-bold">{current ? 'No hay servicios próximos' : `No hay servicios en ${monthTitle(month).toLowerCase()}`}</h3>
              <p className="m-0 text-text-2">{church.canEdit ? 'Crea uno para que el equipo lo vea aquí.' : 'Cuando se programe uno, aparecerá aquí.'}</p>
              {church.canEdit && <Button variant="secondary" onClick={() => void navigate('/servicios/nuevo')}>Crear servicio</Button>}
            </div>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {items.map((item) => (
                <li key={item.kind === 'service' ? item.service.id : `closed-${item.date}`}>
                  {item.kind === 'service' ? <ServiceCard service={item.service} /> : <ClosedCard item={item.closed} onOpen={() => setOpenDate(item.date)} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      {toast !== '' && <div className="px-4 pb-2"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
      <Sheet open={openDate !== null} onClose={() => setOpenDate(null)} title={openDate && closedOn(monthClosed.closed, openDate) ? 'No hay culto' : openDate ? formatLongDay(openDate) : 'Fecha'}>
        {openDate && <DaySheet key={openDate} date={openDate} item={closedOn(monthClosed.closed, openDate)} canEdit={church.canEdit}
          onDone={(message) => { setOpenDate(null); setToast(message) }} />}
      </Sheet>
    </AppShell>
  )
}

/** Día y mes en un bloque; el nombre completo del día va en el texto accesible de la tarjeta. */
function DateTile({ date, muted = false }: { date: string; muted?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid h-16 w-14 flex-none content-center justify-items-center rounded-md leading-tight ${muted ? 'bg-surface-2 text-text-2' : 'bg-accent-soft text-accent-soft-text'}`}>
      <b className="font-display text-2xl">{Number(date.slice(8))}</b>
      <span className="text-xs font-semibold">{formatDay(date).split(' ').pop()}</span>
    </span>
  )
}

/** Tono propio de cada iglesia, estable por su id; el nombre siempre acompaña al color. */
const hueOf = (id: string) => [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7)

function ServiceCard({ service, church }: { service: Service; church?: { id: string; name: string; open: () => void } }) {
  return (
    <Link to={`/servicios/${service.id}`} onClick={church?.open} aria-label={`${service.title}, ${formatLongDay(service.date)}${church ? `, ${church.name}` : ''}`}
      style={church ? { borderLeftColor: `oklch(0.62 0.09 ${hueOf(church.id)})` } : undefined}
      className={cx('flex items-center gap-4 rounded-lg border border-line bg-surface p-4 text-text no-underline shadow-1 hover:border-line-strong hover:bg-surface-2', church && 'border-l-[6px]')}>
      <DateTile date={service.date} />
      <span className="grid min-w-0 flex-1 content-start gap-0.5">
        {church && <span className="text-sm font-semibold text-text-2">{church.name}</span>}
        <b className="font-display text-[1.0625rem] leading-snug">{service.title}</b>
        <span className="text-sm text-text-2">{timeText(service.time)}{slotText[service.slot]} · {service.director ? <>Dirige <b className="font-semibold text-text">{service.director.name}</b></> : 'Sin director'}</span>
        <span className="text-sm text-text-2">{service.songCount === 0 ? 'Setlist sin preparar' : `${service.songCount} ${service.songCount === 1 ? 'canción' : 'canciones'} en el setlist`}</span>
        <StatusChip status={status(service.status)} className="mt-1.5 w-fit" />
      </span>
      <Icon name="right" className="flex-none text-text-3" />
    </Link>
  )
}

function ClosedCard({ item, onOpen }: { item: ClosedDate; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} aria-label={`No hay culto, ${formatLongDay(item.date)}${item.reason ? `, ${item.reason}` : ''}`}
      className="flex w-full cursor-pointer items-center gap-4 rounded-lg border border-dashed border-line-strong bg-transparent p-4 text-left text-text">
      <DateTile date={item.date} muted />
      <span className="grid gap-0.5">
        <b className="font-display text-[1.0625rem]">No hay culto</b>
        {item.reason && <span className="text-sm text-text-2">{item.reason}</span>}
      </span>
    </button>
  )
}
