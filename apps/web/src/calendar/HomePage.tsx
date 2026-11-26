import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { saveUpcoming } from '../offline-cache'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Button, Icon, Notice, Sheet, StatusChip, Toast } from '../ui'
import { cx } from '../ui/cx'
import { AppShell, NewSheet } from './AppShell'
import { ChurchGate } from './ChurchGate'
import { DaySheet } from './DaySheet'
import { MonthGrid, closedOn } from './MonthGrid'
import { useAgenda, useApiFetch, useClosedDates, useMyChurches, useServices, useSwitchChurch, type AgendaService } from './api'
import { formatDay, formatLongDay, monthOf, monthTitle, shiftMonth, todayIn } from './dates'
import { serviceSummary, type Profile } from './service-summary'
import { ChurchFilter, SwitchNotice, useSwitchNotice } from './ChurchFilter'
import { ChurchColorNotice } from './church-identity'
import { useChurchColors } from './church-colors'
import { homeAll } from './home-filter'
import { allWindowEnd, churchWindowEnd } from './home-window'
import { useViewProfile } from './profile'
import type { Church, ClosedDate, Service } from './model'

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
  const [creating, setCreating] = useState(false)
  const profile = useViewProfile(church)
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
  // Mes en curso: lo que queda del mes (y la semana siguiente desde la última semana del mes); a petición, lo que ya pasó de este mes. Otro mes: el mes completo.
  const windowEnd = churchWindowEnd(today)
  const upcoming = all.filter((item) => (current ? item.date >= today && item.date <= windowEnd : inMonth(item.date)))
  const past = current ? all.filter((item) => inMonth(item.date) && item.date < today) : []
  const items = showPast ? [...past, ...upcoming] : upcoming
  const count = gridServices.length
  // Con dos o más iglesias el inicio tiene un filtro: «Todas» (esta semana y la siguiente de todas, en orden) o una iglesia, que pasa a ser la activa.
  const churches = useMyChurches().data?.filter((item) => item.role) ?? []
  const several = churches.length >= 2
  const stored = homeAll.use()
  const united = several && (stored ?? true)
  const agenda = useAgenda(several)
  const switchTo = useSwitchChurch()
  const colors = useChurchColors(churches.map((item) => item.id))
  const notice = useSwitchNotice()
  const pickChurch = (id: string) => {
    notice.announce()
    if (id === church.id) homeAll.set(false)
    else switchTo(id)
  }
  const weekEnd = allWindowEnd(today)
  const agendaShown = (agenda.data ?? []).filter((item) => item.date <= weekEnd)
  // Con conexión, deja leíbles sin red el setlist y las letras de lo que viene, de todas las iglesias.
  const api = useApiFetch()
  const queryClient = useQueryClient()
  const offline = new Map<string, string>()
  for (const item of several ? agendaShown : []) if (item.status !== 'CANCELLED') offline.set(item.id, item.churchId)
  for (const item of upcoming) if (item.kind === 'service' && item.service.status !== 'CANCELLED' && !offline.has(item.service.id)) offline.set(item.service.id, church.id)
  const offlineList = [...offline].map(([id, owner]) => `${id} ${owner}`).join(',')
  useEffect(() => {
    if (offlineList && navigator.onLine) void saveUpcoming(queryClient, api, offlineList.split(',').map((pair) => { const [id = '', owner] = pair.split(' '); return { id, church: owner } }))
  }, [offlineList, api, queryClient])

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
    <AppShell church={church} current="home" wide action={church.canEdit ? { label: 'Nuevo servicio', onAction: () => setCreating(true) } : undefined}>
      <main className={cx('grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 p-4 lg:gap-x-6 lg:px-6', !united && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="flex items-center gap-3 lg:col-start-1">
          <h1 className="m-0 flex-1 font-display text-2xl font-bold tracking-tight">Inicio</h1>
        </div>
        {several && (
          <div className="grid min-w-0 gap-2 lg:col-start-1">
            <ChurchFilter churches={churches} activeId={church.id} all={united} onAll={() => homeAll.set(true)} onPick={pickChurch} />
            {notice.shown && !united && <SwitchNotice name={church.name} onClose={notice.dismiss} />}
            <ChurchColorNotice />
          </div>
        )}
        {!united && <div className="lg:col-start-2 lg:row-span-4 lg:row-start-1">{calendar}</div>}
        <div className="flex items-center gap-2 lg:col-start-1">
          <h2 className="m-0 flex-1 text-base font-semibold text-text-2">{united ? 'Esta semana y la siguiente' : current ? 'Próximos servicios' : `Servicios de ${monthTitle(month).split(' ')[0].toLowerCase()}`}</h2>
          {!united && past.length > 0 && <Button variant="quiet" onClick={() => setShowPast(!showPast)}>{showPast ? 'Ocultar anteriores' : `Ver anteriores (${past.length})`}</Button>}
        </div>
        <div className="lg:col-start-1">
          {united ? (
            agenda.isError && !agenda.data ? <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los servicios">Revisa tu conexión e inténtalo de nuevo.</Notice>
              : !agenda.data ? <p role="status" className="m-0 text-text-2">Cargando servicios…</p>
                : agendaShown.length === 0 ? <p className="m-0 py-6 text-center text-text-2">No hay servicios esta semana ni la siguiente en tus iglesias.</p>
                  : <ul className="m-0 grid list-none gap-3 p-0">{agendaShown.map((item: AgendaService) => <li key={item.id}><ServiceCard service={item} profile="full" church={{ id: item.churchId, name: item.churchName, tone: colors.style(item.churchId), open: () => switchTo(item.churchId) }} /></li>)}</ul>
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
                  {item.kind === 'service' ? <ServiceCard service={item.service} profile={profile} /> : <ClosedCard item={item.closed} onOpen={() => setOpenDate(item.date)} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <NewSheet open={creating} onClose={() => setCreating(false)} />
      {toast !== '' && <div className="px-4 pb-2"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
      <Sheet open={openDate !== null} onClose={() => setOpenDate(null)} title={openDate && closedOn(monthClosed.closed, openDate) ? 'No hay culto' : openDate ? formatLongDay(openDate) : 'Fecha'}>
        {openDate && <DaySheet key={openDate} date={openDate} item={closedOn(monthClosed.closed, openDate)} canEdit={church.canEdit}
          onDone={(message) => { setOpenDate(null); setToast(message) }} />}
      </Sheet>
    </AppShell>
  )
}

/** Día y mes en un bloque; el nombre completo del día va en el texto accesible de la tarjeta. */
function DateTile({ date, muted = false, tone }: { date: string; muted?: boolean; tone?: React.CSSProperties }) {
  // En «Todas» la fecha toma el tono de su iglesia (uno de los temas de la aplicación); en el resto, el acento de siempre.
  const look = muted ? 'bg-surface-2 text-text-2' : tone ? 'tone bg-[var(--tone-bg)] text-[var(--tone-fg)]' : 'bg-accent-soft text-accent-soft-text'
  return (
    <span aria-hidden="true" style={tone} className={`grid h-16 w-14 flex-none content-center justify-items-center rounded-md leading-tight ${look}`}>
      <b className="font-display text-2xl">{Number(date.slice(8))}</b>
      <span className="text-xs font-semibold">{formatDay(date).split(' ').pop()}</span>
    </span>
  )
}

function ServiceCard({ service, profile, church }: { service: Service; profile: Profile; church?: { id: string; name: string; tone: React.CSSProperties; open: () => void } }) {
  // Lo que se resalta depende de quién mira: administración ve todo, la alabanza ve quién dirige y el setlist, la predicación ve el tema y quién predica.
  const { headline, details } = serviceSummary(service, profile)
  return (
    <Link to={`/servicios/${service.id}`} onClick={church?.open} aria-label={`${headline}, ${formatLongDay(service.date)}${church ? `, ${church.name}` : ''}`}
      className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4 text-text no-underline shadow-1 hover:border-line-strong hover:bg-surface-2">
      <DateTile date={service.date} tone={church?.tone} />
      <span className="grid min-w-0 flex-1 content-start gap-0.5">
        {church && <span className="tone text-sm font-semibold text-[var(--tone-ink)]" style={church.tone}>{church.name}</span>}
        <b className="font-display text-[1.0625rem] leading-snug [overflow-wrap:anywhere]">{headline}</b>
        {details.map((line) => <span key={line} className="text-sm text-text-2">{line}</span>)}
        {service.status === 'CANCELLED' && <StatusChip status="cancelled" className="mt-1.5 w-fit" />}
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
