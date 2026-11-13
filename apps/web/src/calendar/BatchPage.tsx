import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Avatar, Button, Icon, Notice, PersonPicker, Sheet, Switch, TextField, fold, format12h, from24h, type Person } from '../ui'
import { ChurchGate, TopBar } from './ChurchGate'
import { ApiError, usePeople, usePersonActions } from './api'
import {
  assignmentFor, changeDirector, defaultDayConfig, entryKey, sundayHoursOk, swapDirectors,
  type Assignment, type DayConfig, type PeriodEntry,
} from './batch'
import { useBatchPeriod, useCreateBatch } from './batch-api'
import { formatDay, formatLongDay, monthOf, monthTitle, shiftMonth, todayIn, weekdayOf } from './dates'
import type { Church, Service } from './model'

type Step = 'period' | 'directors' | 'review' | 'done'
type Panel =
  | { kind: 'actions'; key: string; mode: 'menu' | 'pick' | 'confirm'; other?: string }
  | { kind: 'picker'; target: 'add' | string } // `add`: al final de la lista; otro valor: la fecha (clave) a cambiar
  | { kind: 'partial' }

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const plural = (weekday: number) => (WEEKDAYS[weekday]!.endsWith('s') ? WEEKDAYS[weekday]! : `${WEEKDAYS[weekday]}s`)
const slotName = { SINGLE: '', MORNING: 'Mañana', AFTERNOON: 'Tarde' } as const
const timeText = (time: string) => format12h(from24h(time))
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const joinWords = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}` : (words[0] ?? ''))

export function BatchPage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Batch church={church} /> : <ReadOnly />)}</ChurchGate>
}

function ReadOnly() {
  return (
    <main className="mx-auto max-w-[480px]">
      <TopBar />
      <Header title="Lote mensual" back="/" label="Volver al calendario" />
      <div className="p-4"><Notice title="Solo lectura">Crear servicios requiere ser editor o administrador de tu iglesia.</Notice></div>
    </main>
  )
}

function Header({ title, back, label, step, onBack }: { title: string; back?: string; label: string; step?: string; onBack?: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-14 items-center gap-1 border-b border-line px-2">
      <Button variant="quiet" icon aria-label={label} onClick={() => (onBack ? onBack() : void navigate(back ?? '/'))}><Icon name="right" className="-scale-x-100" /></Button>
      <h1 className="m-0 flex-1 font-display text-lg font-bold">{title}</h1>
      {step && <span className="px-3 font-mono text-xs text-text-3" aria-label={`Paso ${step}`}>{step}</span>}
    </div>
  )
}

function Batch({ church }: { church: Church }) {
  const navigate = useNavigate()
  const createBatch = useCreateBatch()
  const today = todayIn()
  const months = [monthOf(today), shiftMonth(monthOf(today), 1), shiftMonth(monthOf(today), 2)]
  const [step, setStep] = useState<Step>('period')
  const [month, setMonth] = useState(months[0]!)
  const [weekdays, setWeekdays] = useState<number[]>(church.days[0] ? [church.days[0].weekday] : [])
  const [configs, setConfigs] = useState<Record<number, DayConfig>>({})
  const [attempted, setAttempted] = useState(false)
  const [list, setList] = useState<Person[] | null>(null) // null: todavía la del lote anterior
  const [repeat, setRepeat] = useState(true)
  const [continues, setContinues] = useState(true)
  const [review, setReview] = useState<{ assignment: Assignment; removed: string[] }>({ assignment: {}, removed: [] })
  const [panel, setPanel] = useState<Panel | null>(null)
  const [query, setQuery] = useState('')
  const [personFailure, setPersonFailure] = useState('')
  const [added, setAdded] = useState<Person[]>([])
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [created, setCreated] = useState<Service[]>([])

  const periodQuery = useBatchPeriod(month, weekdays, true)
  const period = periodQuery.data
  const entries = period?.entries ?? []
  const free = entries.filter((entry) => !entry.lock)
  const people = usePeople(true)
  const { create: createPerson } = usePersonActions()

  const everyone = useMemo(() => new Map([...(people.data ?? []), ...added].map((person) => [person.id, person])), [people.data, added])
  const previous = period?.previous ?? null
  const directors: Person[] = list ?? (previous?.directorIds ?? []).flatMap((id) => (everyone.get(id) ? [everyone.get(id)!] : []))
  const nameOf = (id: string) => everyone.get(id)?.name ?? 'Persona'
  const previousLast = continues && previous?.lastDirectorId ? previous.lastDirectorId : null
  const hasPrevious = Boolean(previous && previous.directorIds.length > 0)
  const plan = assignmentFor(entries, directors.map((person) => person.id), { repeat, previousLast })

  const config = (weekday: number): DayConfig => configs[weekday] ?? defaultDayConfig(church, weekday)
  const double = (weekday: number) => church.sundayDouble && weekday === 0
  const configIssue = (weekday: number) => {
    const item = config(weekday)
    if (!item.title.trim()) return 'Escribe el nombre del servicio.'
    if (double(weekday)) return sundayHoursOk(item.time, item.time2) ? '' : 'Pon la hora de la mañana antes de las 12:00 y la de la tarde desde las 12:00.'
    return item.time ? '' : 'Elige la hora.'
  }
  const timeOf = (entry: PeriodEntry) => (entry.slot === 'AFTERNOON' ? config(weekdayOf(entry.date)).time2 : config(weekdayOf(entry.date)).time)
  const label = (entry: PeriodEntry) => `${formatDay(entry.date)}${entry.slot === 'SINGLE' ? '' : ` · ${slotName[entry.slot]}`} · ${timeText(timeOf(entry))}`
  const longLabel = (entry: PeriodEntry) => `${formatLongDay(entry.date)}${entry.slot === 'SINGLE' ? '' : ` · ${slotName[entry.slot]}`}`

  const isIncluded = (key: string) => Boolean(review.assignment[key]) && !review.removed.includes(key)
  const included = free.filter((entry) => isIncluded(entryKey(entry)))
  const pending = free.filter((entry) => !isIncluded(entryKey(entry)))

  function editConfig(weekday: number, patch: Partial<DayConfig>) {
    setConfigs({ ...configs, [weekday]: { ...config(weekday), ...patch } })
    setAttempted(false)
  }
  function toggleWeekday(weekday: number) {
    setWeekdays(weekdays.includes(weekday) ? weekdays.filter((item) => item !== weekday) : weekdays.length < 3 ? [...weekdays, weekday].sort((a, b) => a - b) : weekdays)
    setList(null)
  }
  function toDirectors() {
    setAttempted(true)
    if (weekdays.some((weekday) => configIssue(weekday)) || free.length === 0) return
    setStep('directors')
  }
  function toReview() {
    setReview({ assignment: plan, removed: [] })
    setFailure('')
    setStep('review')
  }
  function restart() {
    setStep('period')
    setList(null)
    setReview({ assignment: {}, removed: [] })
    setCreated([])
    setFailure('')
    setAttempted(false)
  }

  /** Alta desde el selector: el servidor aplica la regla del nombre completo; la persona queda en el directorio. */
  async function addPerson(name: string) {
    setPersonFailure('')
    try {
      const person = await createPerson({ name })
      setAdded((current) => [...current, person])
      choose(person)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.existing) {
        setPersonFailure(`Ya existe «${caught.existing.name}». Elígela de la lista o completa el nombre.`)
      } else setPersonFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para agregar personas.' : 'No se pudo agregar a la persona. Inténtalo de nuevo.')
    }
  }
  function choose(person: Person) {
    if (panel?.kind === 'picker') {
      if (panel.target === 'add') setList([...directors, person])
      else setReview({ ...review, assignment: changeDirector(review.assignment, panel.target, person.id) })
    }
    closePanel()
  }
  function closePanel() {
    setPanel(null)
    setQuery('')
    setPersonFailure('')
  }
  function moveUp(index: number) {
    const next = [...directors]
    ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
    setList(next)
  }

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      const result = await createBatch({
        month, directorIds: directors.map((person) => person.id),
        entries: included.map((entry) => ({
          date: entry.date, title: config(weekdayOf(entry.date)).title.trim(), time: timeOf(entry), directorId: review.assignment[entryKey(entry)]!,
          ...(entry.slot === 'SINGLE' ? {} : { slot: entry.slot }),
        })),
      })
      setCreated(result.services)
      setStep('done')
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : ''
      setFailure(code === 'Date full' || code === 'Date closed'
        ? 'Una fecha se ocupó o se marcó «No hay culto» mientras revisabas. No se creó ningún servicio: vuelve al período y revisa de nuevo.'
        : code === 'Date in the past' ? 'Una de las fechas ya pasó. No se creó ningún servicio.'
          : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para crear servicios.' : 'No se pudo crear el lote. No se creó ningún servicio; inténtalo de nuevo.')
    } finally {
      setSending(false)
      setPanel(null)
    }
  }
  function create() {
    if (pending.length > 0) setPanel({ kind: 'partial' })
    else void submit()
  }

  const back = step === 'directors' ? () => setStep('period') : step === 'review' ? () => setStep('directors') : undefined
  const stepNumber = step === 'period' ? '1/3' : step === 'directors' ? '2/3' : step === 'review' ? '3/3' : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <Header title="Lote mensual" label={back ? (step === 'directors' ? 'Volver al período' : 'Volver a directores') : 'Volver al calendario'} step={stepNumber} onBack={back} />
      <div className="grid flex-1 content-start gap-5 p-4">
        {step === 'period' && (
          <>
            <p className="m-0 text-[0.9375rem] text-text-2">Elige el mes y hasta 3 días de la semana. Después armas la lista de directores.</p>
            <div role="radiogroup" aria-label="Mes" className="grid overflow-hidden rounded-lg border border-line bg-surface">
              {months.map((item, index) => (
                <button key={item} type="button" role="radio" aria-checked={item === month} onClick={() => { setMonth(item); setList(null) }}
                  className="flex min-h-14 cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left last:border-b-0 aria-checked:bg-accent-soft">
                  <span className="font-semibold">{monthTitle(item)}<small className="block font-normal text-text-3">{index === 0 ? 'Desde hoy, inclusive' : 'Todas las fechas del mes'}</small></span>
                  {item === month && <Icon name="check" />}
                </button>
              ))}
            </div>
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-1.5 text-sm font-semibold">Días de la semana</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((name, weekday) => (
                  <button key={name} type="button" aria-label={name} aria-pressed={weekdays.includes(weekday)} disabled={weekdays.length >= 3 && !weekdays.includes(weekday)}
                    onClick={() => toggleWeekday(weekday)}
                    className="min-h-12 cursor-pointer rounded-md border border-line-strong bg-surface font-semibold uppercase aria-pressed:border-accent aria-pressed:bg-accent-soft disabled:cursor-not-allowed disabled:text-text-3">
                    {name.charAt(0)}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[0.8125rem] text-text-3">{weekdays.length >= 3 ? 'Máximo 3 días. Quita uno para elegir otro.' : 'Puedes elegir hasta 3 días.'}</p>
            </fieldset>
            {weekdays.map((weekday) => (
              <DayFields key={weekday} weekday={weekday} double={double(weekday)} value={config(weekday)} issue={attempted ? configIssue(weekday) : ''} onChange={(patch) => editConfig(weekday, patch)} />
            ))}
            <Availability pending={periodQuery.isPending && weekdays.length > 0} failed={periodQuery.isError} entries={entries} weekdays={weekdays} month={month} />
            <Button variant="primary" block disabled={weekdays.length === 0 || periodQuery.isPending || periodQuery.isError || free.length === 0} onClick={toDirectors}>Continuar con directores</Button>
          </>
        )}

        {step === 'directors' && (
          <>
            <p className="m-0 text-[0.9375rem] text-text-2">
              {directors.length > 0 ? `${Object.keys(plan).length} de ${free.length} ${free.length === 1 ? 'fecha con director' : 'fechas con director'}.` : 'Agrega al menos un director para continuar.'}
            </p>
            <section aria-label="Lista de directores, en orden" className="grid gap-2">
              <h2 className="m-0 text-sm font-semibold">Lista, en orden</h2>
              {directors.length > 0 ? (
                <ol className="m-0 grid list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
                  {directors.map((person, index) => (
                    <li key={person.id} className="flex min-h-14 items-center gap-2 border-b border-line px-3 last:border-b-0">
                      <span aria-hidden="true" className="w-5 font-mono text-xs text-text-3">{index + 1}</span>
                      <Avatar name={person.name} />
                      <span className="flex-1 font-semibold">{person.name}</span>
                      {index > 0 && <Button variant="quiet" icon aria-label={`Subir a ${person.name}`} onClick={() => moveUp(index)}><Icon name="down" className="rotate-180" /></Button>}
                      <Button variant="quiet" icon aria-label={`Quitar a ${person.name} de la lista`} onClick={() => setList(directors.filter((item) => item.id !== person.id))}><Icon name="x" /></Button>
                    </li>
                  ))}
                </ol>
              ) : <p className="m-0 text-sm text-text-3">La lista está vacía.</p>}
              <Button variant="secondary" block onClick={() => setPanel({ kind: 'picker', target: 'add' })}>Agregar director</Button>
              {people.isError && <Notice tone="warn" icon="alert" role="alert">No se pudo cargar el directorio.</Notice>}
            </section>
            <div className="grid gap-4 rounded-lg border border-line bg-surface p-4">
              <Switch checked={repeat} onCheckedChange={setRepeat} label="Repetir la lista hasta cubrir todas las fechas"
                description={directors.length === 0 ? undefined : repeat
                  ? (directors.length < free.length ? `Con ${count(directors.length, 'persona', 'personas')} y ${free.length} fechas, la fecha ${directors.length + 1} la toma ${nameOf(plan[entryKey(free[directors.length]!)] ?? '')}.` : 'La lista alcanza para todas las fechas.')
                  : (directors.length < free.length ? `Solo se programan las primeras ${directors.length} fechas; el resto queda sin programar.` : 'La lista alcanza para todas las fechas.')} />
              <Switch checked={continues && hasPrevious} disabled={!hasPrevious} onCheckedChange={setContinues} label="Continuar desde el lote anterior"
                description={!hasPrevious ? 'Todavía no hay un lote anterior.' : !continues ? 'Empieza desde el primero de la lista.'
                  : previousLast && directors.some((person) => person.id === previousLast) ? `El lote anterior terminó con ${nameOf(previousLast)}; este empieza con la siguiente persona de la lista.`
                    : 'Quien cerró el lote anterior ya no está en la lista; empieza el primero.'} />
            </div>
            <section aria-label="Así quedan las fechas" className="grid gap-2">
              <h2 className="m-0 text-sm font-semibold">Así quedan las fechas</h2>
              <ul className="m-0 grid list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
                {entries.map((entry) => (
                  <Row key={entryKey(entry)} date={label(entry)} value={entry.lock ? <Locked entry={entry} /> : (plan[entryKey(entry)] ? nameOf(plan[entryKey(entry)]!) : 'Sin programar')} muted={Boolean(entry.lock) || !plan[entryKey(entry)]} />
                ))}
              </ul>
            </section>
            <Button variant="primary" block disabled={Object.keys(plan).length === 0} onClick={toReview}>Revisar</Button>
          </>
        )}

        {step === 'review' && (
          <>
            <p className="m-0 text-[0.9375rem] text-text-2">{monthTitle(month)} · {joinWords(weekdays.map(plural))}</p>
            <p className="m-0 text-[0.8125rem] text-text-3">Toca una fecha para cambiar su director, intercambiarla o quitarla.</p>
            {included.length < free.length
              ? <Notice tone="warn" icon="info" role="status" title={`Se crearán ${included.length} de ${free.length} servicios`}>{pending.length > 0 && review.removed.length === 0 ? `En las primeras ${included.length} fechas, en el orden ingresado.` : 'Las demás fechas quedan sin programar.'}</Notice>
              : <Notice icon="check" role="status" title={`Se crearán ${included.length} de ${free.length} servicios`}>Uno por cada fecha disponible.</Notice>}
            <ul className="m-0 grid list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
              {free.map((entry) => {
                const key = entryKey(entry)
                const director = review.assignment[key]
                if (!director) return <Row key={key} date={label(entry)} value="Sin programar" muted />
                const removed = review.removed.includes(key)
                return (
                  <li key={key} className="border-b border-line last:border-b-0">
                    <button type="button" aria-label={`${longLabel(entry)}, ${removed ? 'quitada del lote' : nameOf(director)}. Opciones`} onClick={() => setPanel({ kind: 'actions', key, mode: 'menu' })}
                      className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 text-left ${removed ? 'text-text-3' : ''}`}>
                      <span className="font-mono text-[0.8125rem]">{label(entry)}</span>
                      <span className="flex items-center gap-1 font-semibold">{removed ? 'Quitada del lote' : nameOf(director)}<Icon name="more" /></span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {pending.length > 0 && (
              <Notice icon="info" title="Sin programar">
                {pending.map(label).join(', ')}. No se crea servicio ni participaciones para {pending.length === 1 ? 'esta fecha' : 'estas fechas'}; las resuelves después.
              </Notice>
            )}
            {entries.length > free.length && <p className="m-0 text-[0.8125rem] text-text-3">{count(entries.length - free.length, 'fecha se saltó', 'fechas se saltaron')}: ya tienen servicio o no hay culto.</p>}
            <p className="m-0 text-[0.8125rem] text-text-3">Cada servicio se crea como borrador con su director. Las participaciones habituales, la rotación y el setlist llegan después y se agregan a mano.</p>
            {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
            <Button variant="primary" block loading={sending} disabled={included.length === 0} onClick={create}>
              {included.length > 0 ? `Crear ${count(included.length, 'servicio', 'servicios')}` : 'Sin servicios para crear'}
            </Button>
            <Button variant="quiet" block onClick={() => setStep('directors')}>Corregir directores</Button>
          </>
        )}

        {step === 'done' && (
          <>
            <div role="status" className="grid justify-items-center gap-1 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent"><Icon name="check" /></span>
              <h2 className="m-0 font-display text-xl font-bold">{count(created.length, 'servicio creado', 'servicios creados')}</h2>
              <p className="m-0 text-[0.9375rem] text-text-2">Quedaron como borrador. Las participaciones habituales y el setlist se agregan después.</p>
            </div>
            <ul className="m-0 grid list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
              {created.map((service) => <Row key={`${service.date}/${service.slot}`} date={`${formatDay(service.date)}${service.slot === 'SINGLE' ? '' : ` · ${slotName[service.slot]}`}${service.time ? ` · ${timeText(service.time)}` : ''}`} value={service.director.name} />)}
            </ul>
            {pending.length > 0 && <Notice icon="info" title="Sin programar">{pending.map((entry) => formatDay(entry.date) + (entry.slot === 'SINGLE' ? '' : ` · ${slotName[entry.slot]}`)).join(', ')}. Quedan para resolver después.</Notice>}
            <Button variant="primary" block onClick={() => void navigate({ pathname: '/', search: month === monthOf(today) ? '' : `?mes=${month}` }, { state: { created: true } })}>Ver en el calendario</Button>
            <Button variant="quiet" block onClick={restart}>Programar otro lote</Button>
          </>
        )}
      </div>

      <Sheet open={panel?.kind === 'picker'} onClose={closePanel} title={panel?.kind === 'picker' && panel.target !== 'add' ? 'Cambiar director' : 'Agregar director'}>
        {panel?.kind === 'picker' && (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-text-2">{panel.target === 'add' ? 'Se suma al final de la lista.' : 'Solo cambia esta fecha; las demás no cambian.'}</p>
            <PersonPicker label="Buscar persona" query={query} onQueryChange={(next) => { setQuery(next); setPersonFailure('') }}
              people={(people.data ?? []).filter((person) => (panel.target !== 'add' || !directors.some((item) => item.id === person.id)) && fold(person.name).includes(fold(query)))}
              onSelect={choose} onAddNew={(name) => void addPerson(name)}
              help="Elige a alguien del directorio o agrega a una persona nueva con su nombre completo (se guarda en el directorio)." />
            {personFailure && <Notice tone="warn" icon="alert" role="alert">{personFailure}</Notice>}
            <Button variant="quiet" block onClick={closePanel}>Cancelar</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={panel?.kind === 'actions'} onClose={closePanel} title={panel?.kind === 'actions' ? longLabel(free.find((entry) => entryKey(entry) === panel.key) ?? { date: panel.key.slice(0, 10), slot: 'SINGLE', lock: null }) : 'Fecha'}>
        {panel?.kind === 'actions' && (
          <Actions panel={panel} free={free} review={review} nameOf={nameOf} label={label}
            onPanel={setPanel} onClose={closePanel}
            onReview={(next) => { setReview(next); closePanel() }} />
        )}
      </Sheet>

      <Sheet open={panel?.kind === 'partial'} onClose={closePanel} title={`Se crearán ${included.length} de ${free.length} servicios`}>
        <div className="grid gap-3">
          <p className="m-0 text-[0.9375rem] text-text-2">
            No se crea ningún servicio sin director. {pending.length === 1 ? 'Esta fecha queda' : 'Estas fechas quedan'} sin programar para resolver{pending.length === 1 ? 'la' : 'las'} después: {pending.map(label).join(', ')}.
          </p>
          <Button variant="primary" block loading={sending} onClick={() => void submit()}>Confirmar y crear</Button>
          <Button variant="quiet" block onClick={closePanel}>Volver a la revisión</Button>
        </div>
      </Sheet>
    </main>
  )
}

function Row({ date, value, muted }: { date: string; value: ReactNode; muted?: boolean }) {
  return (
    <li className={`flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0 ${muted ? 'text-text-3' : ''}`}>
      <span className="font-mono text-[0.8125rem]">{date}</span>
      <span className="text-right font-semibold">{value}</span>
    </li>
  )
}

function Locked({ entry }: { entry: PeriodEntry }) {
  if (!entry.lock) return null
  return entry.lock.kind === 'closed'
    ? <>Sin culto{entry.lock.reason ? ` · ${entry.lock.reason}` : ''}</>
    : <>Ya tiene servicio · {entry.lock.title} · {entry.lock.director}</>
}

/** Fechas del período: libres y bloqueadas (con el servicio existente o el motivo), antes de elegir directores. */
function Availability({ pending, failed, entries, weekdays, month }: { pending: boolean; failed: boolean; entries: PeriodEntry[]; weekdays: number[]; month: string }) {
  if (weekdays.length === 0) return <p className="m-0 text-sm text-text-3">Elige al menos un día de la semana.</p>
  if (failed) return <Notice tone="warn" icon="alert" role="alert">No se pudieron comprobar las fechas del mes. Revisa tu conexión e inténtalo de nuevo.</Notice>
  if (pending) return <p role="status" className="m-0 text-sm text-text-3">Buscando fechas…</p>
  const free = entries.filter((entry) => !entry.lock)
  return (
    <section aria-label="Fechas del período" className="grid gap-2">
      <h2 className="m-0 text-sm font-semibold">
        {free.length === 0 ? 'Sin fechas disponibles' : `${count(free.length, 'fecha disponible', 'fechas disponibles')} · ${joinWords(weekdays.map(plural))}`}
      </h2>
      {free.length === 0 && <p className="m-0 text-sm text-text-2">No hay {joinWords(weekdays.map(plural))} libres en {monthTitle(month)}. Prueba con otro mes o día.</p>}
      {entries.length > 0 && (
        <ul className="m-0 grid list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
          {entries.map((entry) => (
            <Row key={entryKey(entry)} date={`${formatDay(entry.date)}${entry.slot === 'SINGLE' ? '' : ` · ${slotName[entry.slot]}`}`}
              value={entry.lock ? <Locked entry={entry} /> : 'Libre'} muted={Boolean(entry.lock)} />
          ))}
        </ul>
      )}
      {entries.length > free.length && <p className="m-0 text-[0.8125rem] text-text-3">Ya tienen servicio o no hay culto: no se tocan.</p>}
    </section>
  )
}

function DayFields({ weekday, double, value, issue, onChange }: { weekday: number; double: boolean; value: DayConfig; issue: string; onChange: (patch: Partial<DayConfig>) => void }) {
  const name = WEEKDAYS[weekday]!.replace(/^./, (letter) => letter.toUpperCase())
  return (
    <fieldset className="m-0 grid gap-3 rounded-lg border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-semibold">{double ? 'Domingo · dos servicios' : name}</legend>
      <TextField label={`Nombre del servicio (${WEEKDAYS[weekday]})`} value={value.title} maxLength={120} onChange={(event) => onChange({ title: event.target.value })} />
      <div className={double ? 'grid grid-cols-2 gap-3' : ''}>
        <TextField label={double ? 'Hora de la mañana' : `Hora (${WEEKDAYS[weekday]})`} type="time" value={value.time} onChange={(event) => onChange({ time: event.target.value })} />
        {double && <TextField label="Hora de la tarde" type="time" value={value.time2} onChange={(event) => onChange({ time2: event.target.value })} />}
      </div>
      {double && <p className="m-0 text-[0.8125rem] text-text-3">Tu iglesia tiene dos servicios los domingos: la mañana va antes de las 12:00 y la tarde desde las 12:00. Cada uno lleva su director.</p>}
      {issue && <p role="alert" className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-cancel-fg"><Icon name="alert" width={16} height={16} />{issue}</p>}
    </fieldset>
  )
}

/** Acciones de una fecha de la revisión: cambiar director, intercambiar (mostrando ambas) o quitar del lote. */
function Actions({ panel, free, review, nameOf, label, onPanel, onClose, onReview }: {
  panel: Extract<Panel, { kind: 'actions' }>; free: PeriodEntry[]; review: { assignment: Assignment; removed: string[] }
  nameOf: (id: string) => string; label: (entry: PeriodEntry) => string
  onPanel: (panel: Panel) => void; onClose: () => void; onReview: (review: { assignment: Assignment; removed: string[] }) => void
}) {
  const entry = free.find((item) => entryKey(item) === panel.key)
  const director = review.assignment[panel.key]
  if (!entry || !director) return null
  const removed = review.removed.includes(panel.key)
  const option = (text: string, hint: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left last:border-b-0 hover:bg-surface-2">
      <span className="font-semibold">{text}<small className="block font-normal text-text-3">{hint}</small></span>
      <Icon name="right" />
    </button>
  )

  if (panel.mode === 'menu') {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-sm text-text-2">{removed ? `Quitada del lote. Director anterior: ${nameOf(director)}.` : `Director: ${nameOf(director)}`}</p>
        <div className="overflow-hidden rounded-lg border border-line">
          {removed
            ? option('Volver a incluir en el lote', `Con ${nameOf(director)} como director.`, () => onReview({ ...review, removed: review.removed.filter((key) => key !== panel.key) }))
            : <>
              {option('Cambiar director', 'Solo en esta fecha; las demás no cambian.', () => onPanel({ kind: 'picker', target: panel.key }))}
              {option('Intercambiar con otra fecha', 'Se muestran ambas fechas antes de confirmar.', () => onPanel({ ...panel, mode: 'pick' }))}
              {option('Quitar de este lote', 'Queda sin programar.', () => onReview({ ...review, removed: [...review.removed, panel.key] }))}
            </>}
        </div>
        <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
      </div>
    )
  }
  const candidates = free.filter((item) => {
    const key = entryKey(item)
    const other = review.assignment[key]
    return key !== panel.key && other && !review.removed.includes(key) && other !== director
  })
  if (panel.mode === 'pick') {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-sm text-text-2">Elige la fecha con la que intercambiar a {nameOf(director)}.</p>
        {candidates.length > 0
          ? <div className="overflow-hidden rounded-lg border border-line">{candidates.map((item) => option(label(item), nameOf(review.assignment[entryKey(item)]!), () => onPanel({ ...panel, mode: 'confirm', other: entryKey(item) })))}</div>
          : <p className="m-0 text-sm text-text-3">No hay otra fecha con un director distinto.</p>}
        <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
      </div>
    )
  }
  const otherEntry = free.find((item) => entryKey(item) === panel.other)
  const otherDirector = panel.other ? review.assignment[panel.other] : undefined
  if (!otherEntry || !otherDirector) return null
  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm text-text-2">Revisa los dos cambios antes de confirmar.</p>
      <ul className="m-0 grid list-none overflow-hidden rounded-lg border border-line p-0">
        <Row date={label(entry)} value={`${nameOf(director)} → ${nameOf(otherDirector)}`} />
        <Row date={label(otherEntry)} value={`${nameOf(otherDirector)} → ${nameOf(director)}`} />
      </ul>
      <p className="m-0 text-[0.8125rem] text-text-3">Las fechas intermedias no cambian.</p>
      <Button variant="primary" block onClick={() => onReview({ ...review, assignment: swapDirectors(review.assignment, panel.key, panel.other!) })}>Confirmar intercambio</Button>
      <Button variant="quiet" block onClick={() => onPanel({ ...panel, mode: 'pick', other: undefined })}>Elegir otra fecha</Button>
    </div>
  )
}
