import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Field, Notice, Segmented, Switch, TextField, inputClass } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, useServices } from '../calendar/api'
import { formatDay, monthOf, shiftMonth, todayIn } from '../calendar/dates'
import type { Church } from '../calendar/model'
import { CreatedSheet } from './LinkSheets'
import { useShareLinkActions } from './share-api'
import { estimate, formatFull, monthsBetween, versionHelp, versionLabel, type Blocks, type NewLink, type ShareLink, type Version } from './share-model'

const lastDayOfMonth = (month: string) => `${month}-${String(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()).padStart(2, '0')}`

const failureText = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : ''
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para crear enlaces.'
  if (code === 'No services in scope') return 'No hay servicios en esas fechas. Elige otro rango.'
  if (code === 'Scope in the past') return 'Esas fechas ya pasaron: el enlace nacería vencido. Elige fechas próximas.'
  if (code === 'Preaching disabled') return 'Tu iglesia no usa la predicación. Actívala en Ajustes para compartirla.'
  if (code === 'Sharing unavailable') return 'El servidor no tiene configurados los enlaces todavía. Avisa a quien administra la plataforma.'
  if (error instanceof ApiError && error.status === 404) return 'Ese servicio ya no existe. Elige otro.'
  return 'No se pudo crear el enlace. Revisa los datos e inténtalo de nuevo.'
}

export function NewLinkPage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Form church={church} /> : (
    <main className="mx-auto max-w-[480px]">
      <TopBar name={church.name} />
      <PageHeader title="Enlace del ministerio" back="/compartir" backLabel="Volver a compartir" />
      <div className="p-4"><Notice title="Solo para quien edita">Crear enlaces requiere administrar o editar servicios en tu iglesia.</Notice></div>
    </main>
  ))}</ChurchGate>
}

function Form({ church }: { church: Church }) {
  const navigate = useNavigate()
  const { create } = useShareLinkActions()
  const today = todayIn()
  const [kind, setKind] = useState<'range' | 'service'>('range')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(lastDayOfMonth(monthOf(today)))
  const [serviceId, setServiceId] = useState('')
  const [version, setVersion] = useState<Version>(church.usesPreaching ? 'FULL' : 'PRAISE')
  // Nada se comparte de más: tonos apagados; notas encendidas como en el diseño aprobado.
  const [blocks, setBlocks] = useState<Blocks>({ keys: false, notes: true, people: true })
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [created, setCreated] = useState<ShareLink | null>(null)

  const months = kind === 'range' ? monthsBetween(from, to) : [monthOf(today), shiftMonth(monthOf(today), 1), shiftMonth(monthOf(today), 2)]
  const { services, loading, error } = useServices(months)
  const options = services.filter((service) => service.status !== 'CANCELLED' && service.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
  const chosen = options.find((service) => service.id === serviceId) ?? options[0]
  const scope: NewLink['scope'] = kind === 'service' ? { kind: 'service', serviceId: chosen?.id ?? '' } : { kind: 'range', from, to }
  const reversed = kind === 'range' && from > to
  const summary = reversed || (kind === 'service' && !chosen) ? null : estimate(services, scope)

  const showKeys = version !== 'PREACHING'
  const showNotes = version !== 'PRAISE' && church.usesPreaching
  const set = <K extends keyof Blocks>(key: K, value: boolean) => { setBlocks((prev) => ({ ...prev, [key]: value })); setFailure('') }

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      setCreated(await create({ version, scope, blocks: { keys: showKeys && blocks.keys, notes: showNotes && blocks.notes, people: blocks.people } }))
    } catch (caught) { setFailure(failureText(caught)) } finally { setSending(false) }
  }

  const versions = (['PRAISE', 'PREACHING', 'FULL'] as const).filter((item) => item !== 'PREACHING' || church.usesPreaching)
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Enlace del ministerio" back="/compartir" backLabel="Volver a compartir" />
      <form onSubmit={(event) => { event.preventDefault(); if (summary) void submit() }} noValidate className="grid flex-1 content-start gap-5 p-4">
        <p className="m-0 text-text-2">Solo lectura. Lo ve quien lo reciba, sin iniciar sesión.</p>

        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Qué cubre</legend>
          <Segmented label="Alcance" value={kind} onChange={(value) => { setKind(value); setFailure('') }}
            options={[{ value: 'service', label: 'Un servicio' }, { value: 'range', label: 'Rango de fechas' }]} />
          {kind === 'service' ? (
            <Field label="Servicio" error={!loading && !error && options.length === 0 ? 'No hay servicios próximos.' : undefined}>
              {(control) => (
                <select {...control} className={inputClass} value={chosen?.id ?? ''} onChange={(event) => { setServiceId(event.target.value); setFailure('') }} disabled={options.length === 0}>
                  {options.map((service) => <option key={service.id} value={service.id}>{formatDay(service.date)} · {service.title}</option>)}
                </select>
              )}
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Desde" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setFailure('') }} />
              <TextField label="Hasta" type="date" value={to} onChange={(event) => { setTo(event.target.value); setFailure('') }} error={reversed ? 'Debe ser posterior a «Desde».' : undefined} />
            </div>
          )}
        </fieldset>

        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Versión</legend>
          <div role="radiogroup" aria-label="Versión" className="grid gap-2">
            {versions.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={version === item} onClick={() => { setVersion(item); setFailure('') }}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2 text-left aria-checked:border-accent aria-checked:bg-accent-soft">
                <span className="flex-1 font-semibold">{versionLabel[item]}<small className="block font-normal text-text-3">{versionHelp[item]}</small></span>
                <span aria-hidden="true" className={`size-5 rounded-full border-2 ${version === item ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_var(--surface)]' : 'border-line-strong'}`} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Qué incluye</legend>
          {showKeys && <Switch checked={blocks.keys} onCheckedChange={(on) => set('keys', on)} label="Tonos y BPM" description="Por defecto no se muestran; actívalos, por ejemplo, para un músico." />}
          {showNotes && <Switch checked={blocks.notes} onCheckedChange={(on) => set('notes', on)} label="Notas de predicación" description="Los puntos a considerar de cada tema." />}
          <Switch checked={blocks.people} onCheckedChange={(on) => set('people', on)} label="Quién dirige y predica" description="Los nombres de cada fecha." />
        </fieldset>

        <div aria-live="polite" className="grid gap-3">
          {loading && !reversed && <p role="status" className="m-0 text-text-2">Buscando servicios…</p>}
          {!loading && error && <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar los servicios">Revisa tu conexión e inténtalo de nuevo.</Notice>}
          {!loading && !error && summary && (
            <Notice title={`${summary.count} ${summary.count === 1 ? 'servicio' : 'servicios'} · activo hasta ${formatFull(summary.activeUntil)}`}>
              30 días después del último servicio que incluye. Quien lo tenga ve los nombres{showNotes && blocks.notes ? ' y las notas' : ''}: compártelo solo con quien corresponde.
            </Notice>
          )}
          {!loading && !error && !summary && !reversed && <Notice tone="warn" icon="alert" title="No hay servicios en estas fechas">Elige otro rango.</Notice>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        </div>

        <div className="sticky bottom-0 -mx-4 mt-auto border-t border-line bg-bg px-4 py-3">
          <Button type="submit" block loading={sending} disabled={!summary || loading}>Crear enlace</Button>
        </div>
      </form>
      <CreatedSheet link={created} onDone={() => void navigate('/compartir')} />
    </div>
  )
}
