import { useEffect } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Button, Icon, Notice, format12h, from24h } from '../ui'
import { formatLongDay } from '../calendar/dates'
import { Notes } from '../calendar/PreachingSection'
import { fetchPublicLink, PublicLinkError, type PublicService, type PublicView } from './share-api'
import { formatFull, versionLabel } from './share-model'

/** Lo que se lee en el encabezado: la congregación ve «Setlist», no el nombre interno de la versión. */
const heading = (version: PublicView['version']) => (version === 'CONGREGATION' ? 'Setlist' : versionLabel[version])
const slotText = { SINGLE: '', MORNING: 'Mañana', AFTERNOON: 'Tarde' } as const

/** Esta página no se indexa ni cita su origen: se pide a los buscadores y al navegador desde la propia página. */
function useDiscreet(title: string) {
  useEffect(() => {
    const previous = document.title
    const metas = [['robots', 'noindex, nofollow, noarchive'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta')
      meta.name = name!
      meta.content = content!
      document.head.append(meta)
      return meta
    })
    document.title = title
    return () => { metas.forEach((meta) => meta.remove()); document.title = previous }
  }, [title])
}

function ServiceCard({ service, congregation }: { service: PublicService; congregation: boolean }) {
  const showSetlist = service.setlist !== undefined
  const preaching = service.preaching
  return (
    <li className="grid gap-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h3 className="m-0 text-base font-semibold first-letter:uppercase">{formatLongDay(service.date)}</h3>
        <p className="m-0 text-[0.8125rem] text-text-2">
          {[service.time ? format12h(from24h(service.time)) : null, slotText[service.slot] || null].filter(Boolean).join(' · ')}
        </p>
      </div>
      {service.director && <p className="m-0 text-[0.9375rem]"><span className="text-text-2">Dirige: </span><b>{service.director}</b></p>}
      {showSetlist && (service.setlist!.length === 0
        ? <p className="m-0 text-[0.9375rem] text-text-2">El setlist aún no está listo.</p>
        : (
          <ol aria-label="Setlist" className="m-0 grid list-none gap-1.5 p-0">
            {service.setlist!.map((entry, index) => (
              <li key={index} className="grid grid-cols-[1.75rem_1fr] gap-2 text-[0.9375rem]">
                <span className="text-text-3 tabular-nums">{index + 1}</span>
                {entry.kind === 'SONG'
                  ? <span>{entry.title} <span className="text-text-2">({entry.author})</span>{entry.key && <span className="ml-2 rounded border border-line-strong px-1.5 text-[0.8125rem] font-medium">{entry.key}</span>}</span>
                  : <span className="italic text-text-2">{entry.name}</span>}
              </li>
            ))}
          </ol>
        ))}
      {preaching !== undefined && (
        <section aria-label="Predicación" className="grid gap-1.5 border-t border-line pt-3">
          {preaching === null || (!preaching.topic && !preaching.preacher && !preaching.passages?.length && !preaching.notes)
            ? <p className="m-0 text-[0.9375rem] text-text-2">{congregation ? 'Predicador por confirmar.' : 'Sin predicación asignada.'}</p>
            : (
              <>
                {preaching.preacher && <p className="m-0 text-[0.9375rem]"><span className="text-text-2">Predica: </span><b>{preaching.preacher}</b></p>}
                {preaching.topic && <p className="m-0 font-semibold">{preaching.topic}</p>}
                {!!preaching.passages?.length && (
                  <ul aria-label="Citas" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {preaching.passages.map((passage) => <li key={passage} className="rounded-full border border-line-strong bg-surface-2 px-2.5 py-0.5 text-[0.8125rem]">{passage}</li>)}
                  </ul>
                )}
                {preaching.notes && <div><h4 className="m-0 mb-1 text-[0.8125rem] font-semibold text-text-2">Puntos a considerar</h4><Notes notes={preaching.notes} /></div>}
              </>
            )}
        </section>
      )}
    </li>
  )
}

function Closed({ date, reason }: { date: string; reason: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
      <Icon name="ban" />
      <span><b className="block first-letter:uppercase">{formatLongDay(date)}</b><span className="block text-[0.9375rem] text-text-2">No hay culto{reason ? ` · ${reason}` : ''}</span></span>
    </li>
  )
}

/** Vista de solo lectura de un enlace del ministerio. Cualquier fallo de acceso se ve igual: el enlace no está disponible. */
export function PublicLinkPage() {
  const { token = '' } = useParams()
  const view = useQuery({ queryKey: ['public-link', token], queryFn: ({ signal }) => fetchPublicLink(token, signal), retry: false })
  const data = view.data
  useDiscreet(data ? `${heading(data.version)} · ${data.church}` : 'Servicios compartidos')
  const status = view.error instanceof PublicLinkError ? view.error.status : 0

  const rows = data
    ? [...data.services.map((service) => ({ date: service.date, slot: service.slot, node: <ServiceCard key={`${service.date}-${service.slot}`} service={service} congregation={data.version === 'CONGREGATION'} /> })),
      ...data.closedDates.map((item) => ({ date: item.date, slot: 'SINGLE', node: <Closed key={`closed-${item.date}`} date={item.date} reason={item.reason} /> }))]
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
    : []
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-4 pt-6 pb-10">
      {view.isPending && <p role="status" className="text-text-2">Cargando…</p>}
      {view.isError && status === 429 && (
        <div className="grid gap-3">
          <Notice tone="warn" icon="alert" role="alert" title="Demasiadas consultas">Espera un minuto e inténtalo de nuevo.</Notice>
          <Button variant="secondary" onClick={() => void view.refetch()}>Reintentar</Button>
        </div>
      )}
      {view.isError && status !== 429 && (status === 404 || status === 0 ? (
        <Notice icon="lock" title="Este enlace no está disponible">Puede haber vencido o haber sido revocado. Pide uno nuevo a quien te lo compartió.</Notice>
      ) : (
        <div className="grid gap-3">
          <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar">Revisa tu conexión e inténtalo de nuevo.</Notice>
          <Button variant="secondary" onClick={() => void view.refetch()}>Reintentar</Button>
        </div>
      ))}
      {data && (
        <div className="grid gap-4">
          <header>
            <p className="m-0 text-sm font-semibold text-text-2">{data.church}</p>
            <h1 className="m-0 font-display text-2xl leading-tight font-bold tracking-tight">{heading(data.version)}</h1>
            <p className="m-0 mt-1 text-[0.8125rem] text-text-3">Solo lectura · disponible hasta el {formatFull(data.activeUntil)}</p>
          </header>
          {rows.length === 0
            ? <Notice title="Sin servicios por ahora">Cuando haya fechas, aparecerán aquí.</Notice>
            : <ul className="m-0 grid list-none gap-3 p-0">{rows.map((row) => row.node)}</ul>}
        </div>
      )}
    </main>
  )
}
