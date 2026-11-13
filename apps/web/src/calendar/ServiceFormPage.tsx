import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  Button, Icon, Notice, PersonPicker, Segmented, Sheet, TextField, TimeWheel, Field, inputClass,
  format12h, from24h, to24h, type Person, type Time12,
} from '../ui'
import { ChurchGate, TopBar } from './ChurchGate'
import { ApiError, useClosedDates, useCreateService, usePeople, useServices } from './api'
import { formatDay, formatLongDay, monthOf, todayIn, weekdayOf } from './dates'
import { freeSlots, habitualFor, upcomingDates, type Church, type Slot } from './model'

const timeText = (time: string | null) => (time ? format12h(from24h(time)) : 'Sin hora fija')
const slotName = { SINGLE: '', MORNING: 'Mañana', AFTERNOON: 'Tarde' } as const

export function ServiceFormPage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Form church={church} /> : <ReadOnly />)}</ChurchGate>
}

function Header() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-14 items-center gap-1 border-b border-line px-2">
      <Button variant="quiet" icon aria-label="Volver al calendario" onClick={() => void navigate('/')}><Icon name="right" className="-scale-x-100" /></Button>
      <h1 className="m-0 font-display text-lg font-bold">Nuevo servicio</h1>
    </div>
  )
}

function ReadOnly() {
  return (
    <main className="mx-auto max-w-[480px]">
      <TopBar />
      <Header />
      <div className="p-4"><Notice title="Solo lectura">Crear servicios requiere ser editor o administrador de tu iglesia.</Notice></div>
    </main>
  )
}

function Form({ church }: { church: Church }) {
  const navigate = useNavigate()
  const create = useCreateService()
  const today = todayIn()
  const options = upcomingDates(church, today, 4)
  const [choice, setChoice] = useState('') // una fecha habitual, «other» o vacío
  const [other, setOther] = useState('')
  const [slot, setSlot] = useState<Slot | ''>('')
  const [title, setTitle] = useState('')
  const [time, setTime] = useState<string | null>(null)
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [query, setQuery] = useState('')
  const [director, setDirector] = useState<Person | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [wheel, setWheel] = useState<Time12 | null>(null)

  const date = choice === 'other' ? other : choice
  const validOther = /^\d{4}-\d{2}-\d{2}$/.test(other)
  const months = [...new Set([...options.map(monthOf), ...(choice === 'other' && validOther ? [monthOf(other)] : [])])]
  const monthServices = useServices(months)
  const monthClosed = useClosedDates(months)
  const { services } = monthServices
  const loading = monthServices.loading || monthClosed.loading
  const error = monthServices.error ?? monthClosed.error
  const isClosed = (target: string) => monthClosed.closed.some((item) => item.date === target)
  const people = usePeople(true)
  const slots = date ? freeSlots(church, date, services) : []
  const past = Boolean(date) && date < today
  const closed = Boolean(date) && !loading && isClosed(date)
  const full = Boolean(date) && !loading && !closed && slots.length === 0
  const doubleDay = church.sundayDouble && Boolean(date) && weekdayOf(date) === 0
  const matches = (people.data ?? []).filter((person) => person.name.toLowerCase().includes(query.trim().toLowerCase()))

  /** Elegir fecha o franja precarga título y hora habituales; un día no habitual queda sin precarga. */
  function prefill(target: string, chosen: Slot | '') {
    const habitual = chosen ? habitualFor(church, target, chosen) : undefined
    setTitle(habitual?.title ?? '')
    setTime(habitual?.time ?? null)
  }
  function pickDate(target: string, from: string) {
    setChoice(from)
    if (from === 'other') setOther(target)
    const free = freeSlots(church, target, services)
    const first = free[0] ?? ''
    setSlot(first)
    prefill(target, first)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    setFailure('')
    if (!date || past || closed || full || !slot || !title.trim() || !director) return
    setSending(true)
    try {
      await create({
        title: title.trim(), date, status, directorId: director.id, time,
        ...(slot === 'SINGLE' ? {} : { slot }),
      })
      void navigate({ pathname: '/', search: monthOf(date) === monthOf(today) ? '' : `?mes=${monthOf(date)}` }, { state: { created: true } })
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.status : 0
      setFailure(caught instanceof ApiError && caught.code === 'Date closed' ? 'Esa fecha está marcada como «No hay culto». Elige otra.' : code === 409 ? 'Esa fecha ya está completa. Elige otra.' : code === 403 ? 'No tienes permiso para crear servicios.' : 'No se pudo crear el servicio. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  const meridiems = slot === 'MORNING' ? (['am'] as const) : slot === 'AFTERNOON' ? (['pm'] as const) : (['am', 'pm'] as const)
  const initialTime = time ?? (slot === 'AFTERNOON' ? '17:00' : slot === 'MORNING' ? '09:00' : '10:00')

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} />
      <Header />
      <form onSubmit={(event) => void submit(event)} noValidate className="grid flex-1 content-start gap-5 p-4">
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Fecha</legend>
          {error && <Notice tone="warn" icon="alert" role="alert">No se pudo comprobar qué fechas están ocupadas.</Notice>}
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => {
              const off = !loading && isClosed(option)
              const busy = off || (!loading && freeSlots(church, option, services).length === 0)
              const habitual = church.days.filter((day) => day.weekday === weekdayOf(option))
              return (
                <button key={option} type="button" disabled={loading || busy} aria-pressed={choice === option} onClick={() => pickDate(option, option)}
                  className={`grid min-h-16 cursor-pointer content-center justify-items-start rounded-md border px-3 text-left aria-pressed:border-accent aria-pressed:bg-accent-soft ${busy ? 'cursor-not-allowed border-dashed border-line-strong text-text-3 line-through' : 'border-line-strong bg-surface'}`}>
                  <span className="font-semibold">{formatDay(option)}</span>
                  <span className="text-[0.8125rem] text-text-2">{off ? 'No hay culto' : busy ? 'Completo' : habitual.map((day) => format12h(from24h(day.time))).join(' · ')}</span>
                </button>
              )
            })}
            <button type="button" aria-pressed={choice === 'other'} onClick={() => { setChoice('other'); setOther(''); setSlot(''); prefill('', '') }}
              className="min-h-16 cursor-pointer rounded-md border border-line-strong bg-surface px-3 text-left font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft">
              Otra fecha
              <span className="block text-[0.8125rem] font-normal text-text-2">Servicio especial</span>
            </button>
          </div>
          {choice === 'other' && (
            <TextField label="Día del servicio" type="date" min={today} value={other} onChange={(event) => pickDate(event.target.value, 'other')}
              error={other && other < today ? 'No se pueden crear servicios en fechas pasadas.' : undefined} />
          )}
          {attempted && !date && <p role="alert" className="m-0 text-[0.8125rem] font-medium text-cancel-fg">Elige una fecha.</p>}
          {date && <p className="m-0 text-[0.8125rem] text-text-2">{formatLongDay(date)}</p>}
          {closed && <Notice tone="warn" icon="ban" role="status" title="No hay culto">Esa fecha está marcada sin reunión. Elige otra o desmárcala en el calendario.</Notice>}
          {full && <Notice tone="warn" icon="alert" role="status" title="Fecha completa">Esa fecha ya tiene {doubleDay ? 'sus dos servicios' : 'un servicio'}. Elige otra.</Notice>}
        </fieldset>

        {doubleDay && !full && (
          <Segmented label="Franja del domingo" value={slot || 'MORNING'} onChange={(next) => { setSlot(next); prefill(date, next) }}
            options={(['MORNING', 'AFTERNOON'] as const).map((value) => {
              const habitual = habitualFor(church, date, value)
              return { value, label: `${slotName[value]}${habitual ? ` ${format12h(from24h(habitual.time))}` : ''}`, disabled: !slots.includes(value) }
            })} />
        )}

        <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
          error={attempted && !title.trim() ? 'Escribe un título.' : undefined} />

        <Field label="Hora de inicio" help={choice === 'other' && !time ? 'Un servicio especial no tiene hora precargada.' : undefined}>
          {(control) => (
            <button type="button" {...control} aria-label={`Hora de inicio: ${timeText(time)}`} className={`${inputClass} cursor-pointer text-left`} onClick={() => setWheel(from24h(initialTime))}>
              {timeText(time)}
            </button>
          )}
        </Field>

        <Segmented label="Estado" value={status} onChange={setStatus}
          options={[{ value: 'DRAFT', label: 'Borrador' }, { value: 'PUBLISHED', label: 'Publicado' }]} />

        <PersonPicker label="Dirección" query={query} onQueryChange={(next) => { setQuery(next); setDirector(null) }} people={matches}
          onSelect={(person) => { setDirector(person); setQuery(person.name) }}
          help={people.isError ? undefined : 'Obligatoria: elige a quien dirige.'}
          error={people.isError ? 'No se pudo cargar el directorio.' : attempted && !director ? 'Elige quién dirige el servicio.' : undefined} />

        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending} disabled={full || past || closed}>Crear servicio</Button>
      </form>

      <Sheet open={Boolean(wheel)} onClose={() => setWheel(null)} title="Hora de inicio">
        {wheel && (
          <div className="grid gap-3">
            <TimeWheel value={wheel} onChange={setWheel} meridiems={meridiems} />
            <Button variant="primary" block onClick={() => { setTime(to24h(wheel)); setWheel(null) }}>Listo</Button>
            <Button variant="quiet" block onClick={() => { setTime(null); setWheel(null) }}>Sin hora fija</Button>
          </div>
        )}
      </Sheet>
    </main>
  )
}
