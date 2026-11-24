import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Icon, Notice, Sheet } from '../ui'
import { ChurchGate, MainTabbar, TopBar } from './ChurchGate'
import { formatDay, monthOf, monthTitle, shiftMonth, todayIn } from './dates'
import type { Church, Service } from './model'
import { PreachingSection } from './PreachingSection'
import { usePreachingPlan, type PreachingPlanItem } from './preaching-api'

const slotText = { SINGLE: '', MORNING: ' · Mañana', AFTERNOON: ' · Tarde' } as const

/** Lugar propio de la predicación: fechas, predicador y tema de cada mes, sin pasar por el setlist. */
export function PreachingPlanPage() {
  return <ChurchGate>{(church) => <Plan church={church} />}</ChurchGate>
}

function Plan({ church }: { church: Church }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [openId, setOpenId] = useState<string | null>(null)
  const today = todayIn()
  const requested = params.get('mes') ?? ''
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : monthOf(today)
  const plan = usePreachingPlan(month, church.usesPreaching)
  const go = (target: string) => setParams(target === monthOf(today) ? {} : { mes: target })
  const open = plan.data?.find((item) => item.service.id === openId)

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} share={church.canEdit} />
      <main className="grid flex-1 content-start gap-3 pb-4">
        <div className="flex items-center gap-1 px-4 py-3">
          <h1 className="m-0 flex-1 font-display text-xl font-bold">Predicaciones · {monthTitle(month)}</h1>
          <Button variant="quiet" icon aria-label="Mes anterior" onClick={() => go(shiftMonth(month, -1))}><Icon name="right" className="-scale-x-100" /></Button>
          <Button variant="quiet" icon aria-label="Mes siguiente" onClick={() => go(shiftMonth(month, 1))}><Icon name="right" /></Button>
        </div>
        <div className="grid gap-3 px-4">
          {!church.usesPreaching && <Notice title="Tu iglesia no usa predicación">{church.canConfigure ? 'Actívala en Ajustes para planear predicadores y temas.' : 'Quien administra la iglesia puede activarla en Ajustes.'}</Notice>}
          {church.usesPreaching && plan.isPending && <p role="status" className="m-0 text-text-2">Cargando predicaciones…</p>}
          {plan.isError && (
            <>
              <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar el mes">Revisa tu conexión e inténtalo de nuevo.</Notice>
              <Button variant="secondary" onClick={() => void plan.refetch()}>Reintentar</Button>
            </>
          )}
          {church.canEdit && church.usesPreaching && <Button variant="primary" block onClick={() => void navigate('/servicios/nuevo')}>Nueva predicación</Button>}
          {plan.data?.length === 0 && <p className="m-0 text-text-2">No hay servicios en {monthTitle(month).toLowerCase()}. {church.canEdit ? 'Crea el primero con «Nueva predicación»: no necesita setlist ni director.' : ''}</p>}
          {plan.data && plan.data.length > 0 && <ul className="m-0 grid list-none gap-2 p-0">{plan.data.map((item) => <Row key={item.service.id} item={item} onOpen={() => setOpenId(item.service.id)} />)}</ul>}
        </div>
      </main>
      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.service.title ?? 'Predicación'}>
        {open && <PreachingSection service={{ ...open.service, director: null } satisfies Service} canEdit={church.canEdit} />}
      </Sheet>
      <MainTabbar church={church} current="preaching" />
    </div>
  )
}

function Row({ item, onOpen }: { item: PreachingPlanItem; onOpen: () => void }) {
  const { service, preaching } = item
  return (
    <li>
      <button type="button" onClick={onOpen} className="grid min-h-16 w-full cursor-pointer grid-cols-[64px_1fr] items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left">
        <span className="text-sm font-semibold">{formatDay(service.date)}</span>
        <span className="grid gap-0.5">
          <span className="font-semibold">{preaching?.preacher?.name ?? 'Sin predicador'}</span>
          <span className="text-[0.8125rem] text-text-2">{preaching?.topic || 'Sin tema'}</span>
          <span className="text-[0.8125rem] text-text-3">{service.title}{slotText[service.slot]}</span>
        </span>
      </button>
    </li>
  )
}
