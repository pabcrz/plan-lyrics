import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Field, Icon, Notice, Segmented, Sheet, Switch, TextField, TimeWheel, Toast, format12h, from24h, inputClass, to24h, type Time12 } from '../ui'
import { AccessLink, AccountsLink } from '../access/AccessLinks'
import { ChurchGate, PageHeader, TopBar } from './ChurchGate'
import { ApiError, useSaveChurch } from './api'
import type { Church, ChurchSettings, Slot, SongRepeat } from './model'
import { RolesSettings } from './RolesSettings'

/** Entrada a las participaciones habituales y la rotación de cada rol (las configura quien edita servicios). */
function ParticipationsLink() {
  const navigate = useNavigate()
  return (
    <Button variant="secondary" block onClick={() => void navigate('/participaciones')}>
      Participaciones y rotación<Icon name="right" />
    </Button>
  )
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const slotText = { SINGLE: '', MORNING: ' por la mañana', AFTERNOON: ' por la tarde' } as const
type Entry = { time: string; title: string }
type Form = { name: string; sundayDouble: boolean; usesPreaching: boolean; usesRotation: boolean; songRepeat: SongRepeat | null; selected: number[]; entries: Record<string, Entry> }

const keyOf = (weekday: number, slot: Slot) => `${weekday}.${slot}`
const slotsOf = (weekday: number, double: boolean): Slot[] => (weekday === 0 && double ? ['MORNING', 'AFTERNOON'] : ['SINGLE'])

function toForm(church: ChurchSettings): Form {
  return {
    name: church.name, sundayDouble: church.sundayDouble, usesPreaching: church.usesPreaching, usesRotation: church.usesRotation, songRepeat: church.songRepeat ?? null,
    selected: [...new Set(church.days.map((day) => day.weekday))].sort(),
    entries: Object.fromEntries(church.days.map((day) => [keyOf(day.weekday, day.slot), { time: day.time, title: day.title }])),
  }
}

/** Lo que se envía: solo las tarjetas visibles, en orden estable; también sirve para detectar cambios. */
function toSettings(form: Form): ChurchSettings {
  const days = [...form.selected].sort().flatMap((weekday) => slotsOf(weekday, form.sundayDouble).map((slot) => {
    const entry = form.entries[keyOf(weekday, slot)] ?? { time: '19:00', title: '' }
    return { weekday, slot, time: entry.time, title: entry.title.trim() }
  }))
  return { name: form.name.trim(), sundayDouble: form.sundayDouble, usesPreaching: form.usesPreaching, usesRotation: form.usesRotation, songRepeat: form.songRepeat, days }
}

const slotOrder: Record<Slot, number> = { SINGLE: 0, MORNING: 1, AFTERNOON: 2 }
/** Forma comparable de lo guardado: mismo orden y mismos campos que `toSettings`. */
const comparable = (settings: ChurchSettings): ChurchSettings => ({
  name: settings.name, sundayDouble: settings.sundayDouble, usesPreaching: settings.usesPreaching, usesRotation: settings.usesRotation, songRepeat: settings.songRepeat ?? null,
  days: settings.days.map(({ weekday, slot, time, title }) => ({ weekday, slot, time, title })).sort((a, b) => a.weekday - b.weekday || slotOrder[a.slot] - slotOrder[b.slot]),
})

/** Mismas reglas que el servidor, para avisar junto al campo; el servidor vuelve a validar todo. */
function validate(settings: ChurchSettings): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!settings.name) errors.name = 'Escribe el nombre de la iglesia.'
  if (settings.days.length === 0) errors.days = 'Elige al menos un día de servicio.'
  for (const day of settings.days) if (!day.title) errors[`days.${day.weekday}.${day.slot}.title`] = 'Escribe un título.'
  return errors
}

const serverMessages: Record<string, string> = {
  name: 'Escribe el nombre de la iglesia.', days: 'Revisa los días de servicio.', sundayDouble: 'Elige el domingo como día de servicio para tener dos servicios.',
}
const issueMessage = (issue: string) => serverMessages[issue] ?? (issue.endsWith('.title') ? 'Escribe un título.' : issue.endsWith('.time') ? 'La hora no es válida para esta franja.' : 'Revisa este dato.')

export function SettingsPage() {
  return <ChurchGate>{(church) => (church.canConfigure ? <Settings church={church} /> : <ReadOnly church={church} />)}</ChurchGate>
}

function ReadOnly({ church }: { church: Church }) {
  return (
    <main className="mx-auto max-w-[480px] lg:max-w-[720px]">
      <TopBar name={church.name} />
      <PageHeader title="Ajustes de la iglesia" />
      <div className="grid gap-5 p-4">
        <Notice title="Solo lectura">Cambiar los ajustes requiere ser administrador de tu iglesia.</Notice>
        <ParticipationsLink />
        <AccountsLink />
        <RolesSettings editable={false} />
      </div>
    </main>
  )
}

function Settings({ church }: { church: Church }) {
  const save = useSaveChurch()
  const [saved, setSaved] = useState<ChurchSettings>(church)
  const [form, setForm] = useState<Form>(() => toForm(church))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [toast, setToast] = useState(false)
  const [wheel, setWheel] = useState<{ weekday: number; slot: Slot; value: Time12 } | null>(null)

  const current = toSettings(form)
  const dirty = JSON.stringify(current) !== JSON.stringify(comparable(saved))
  const change = (update: (form: Form) => Form) => { setForm(update); setErrors({}); setFailure(''); setToast(false) }
  const setEntry = (weekday: number, slot: Slot, patch: Partial<Entry>) => change((prev) => ({
    ...prev, entries: { ...prev.entries, [keyOf(weekday, slot)]: { ...(prev.entries[keyOf(weekday, slot)] ?? { time: '19:00', title: '' }), ...patch } },
  }))

  function toggleDay(weekday: number) {
    change((prev) => {
      if (prev.selected.includes(weekday)) return { ...prev, selected: prev.selected.filter((day) => day !== weekday) }
      const entries = { ...prev.entries }
      for (const slot of slotsOf(weekday, prev.sundayDouble)) {
        entries[keyOf(weekday, slot)] ??= { time: weekday === 0 ? (slot === 'AFTERNOON' ? '17:00' : slot === 'MORNING' ? '09:00' : '10:00') : '19:00', title: `Servicio de ${DAY_NAMES[weekday]}` }
      }
      return { ...prev, selected: [...prev.selected, weekday].sort(), entries }
    })
  }

  /** Al activar el domingo doble, la mañana y la tarde nacen del servicio único si existe; al apagarlo vuelve lo que había. */
  function toggleDouble(on: boolean) {
    change((prev) => {
      const entries = { ...prev.entries }
      const single = entries[keyOf(0, 'SINGLE')]
      if (on) {
        entries[keyOf(0, 'MORNING')] ??= { time: single && single.time < '12:00' ? single.time : '09:00', title: single ? `${single.title} (mañana)` : 'Servicio dominical (mañana)' }
        entries[keyOf(0, 'AFTERNOON')] ??= { time: '17:00', title: single ? `${single.title} (tarde)` : 'Servicio dominical (tarde)' }
      } else {
        entries[keyOf(0, 'SINGLE')] ??= { time: entries[keyOf(0, 'MORNING')]?.time ?? '10:00', title: 'Servicio dominical' }
      }
      return { ...prev, sundayDouble: on, entries }
    })
  }

  async function submit() {
    const problems = validate(current)
    setErrors(problems)
    setFailure('')
    if (Object.keys(problems).length > 0) return
    setSending(true)
    try {
      const result = await save(current)
      setSaved(result)
      setForm(toForm(result))
      setToast(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.issues.length > 0) setErrors(Object.fromEntries(caught.issues.map((issue) => [issue, issueMessage(issue)])))
      setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar los ajustes.' : 'No se pudieron guardar los cambios. Revisa los datos e inténtalo de nuevo.')
    } finally { setSending(false) }
  }

  function discard() {
    setForm(toForm(saved))
    setErrors({})
    setFailure('')
  }

  const wheelSlot = wheel?.slot
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] lg:max-w-[720px] flex-col">
      <TopBar name={church.name} settings />
      <PageHeader title="Ajustes de la iglesia" />
      <form onSubmit={(event) => { event.preventDefault(); void submit() }} noValidate className="grid flex-1 content-start gap-5 p-4">
        <div className="grid gap-2">
          <ParticipationsLink />
          <AccessLink />
          <AccountsLink />
        </div>

        <TextField label="Nombre de la iglesia" value={form.name} maxLength={120} onChange={(event) => change((prev) => ({ ...prev, name: event.target.value }))} error={errors.name} />

        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-1.5 text-sm font-semibold">Días de servicio</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((label, weekday) => (
              <button key={label} type="button" aria-pressed={form.selected.includes(weekday)} aria-label={DAY_NAMES[weekday]} onClick={() => toggleDay(weekday)}
                className="min-h-touch-lg cursor-pointer rounded-md border border-line-strong bg-surface px-0 text-sm font-semibold aria-pressed:border-accent aria-pressed:bg-accent-soft">
                {label}
              </button>
            ))}
          </div>
          <p className="m-0 text-[0.8125rem] text-text-3">Solo precargan el formulario de servicio; no crean servicios solos.</p>
          {errors.days && <p role="alert" className="m-0 text-[0.8125rem] font-medium text-cancel-fg">{errors.days}</p>}
        </fieldset>

        {form.selected.map((weekday) => (
          <section key={weekday} aria-label={`Servicio del ${DAY_NAMES[weekday]}`} className="grid gap-3 rounded-lg border border-line bg-surface p-3">
            <h2 className="m-0 text-base font-semibold capitalize">{DAY_NAMES[weekday]}</h2>
            {weekday === 0 && (
              <Switch checked={form.sundayDouble} onCheckedChange={toggleDouble} label="Dos servicios los domingos"
                description="Mañana (antes de las 12:00 p.m.) y tarde (desde las 12:00 p.m.)." />
            )}
            {slotsOf(weekday, form.sundayDouble).map((slot) => {
              const entry = form.entries[keyOf(weekday, slot)] ?? { time: '19:00', title: '' }
              const name = `${DAY_NAMES[weekday]}${slotText[slot]}`
              return (
                <div key={slot} className="grid gap-3">
                  <TextField label={`Título · ${name}`} value={entry.title} maxLength={120} onChange={(event) => setEntry(weekday, slot, { title: event.target.value })} error={errors[`days.${weekday}.${slot}.title`]} />
                  <Field label={`Hora · ${name}`} error={errors[`days.${weekday}.${slot}.time`]}>
                    {(control) => (
                      <button type="button" {...control} className={`${inputClass} cursor-pointer text-left`} aria-label={`Hora ${name}: ${format12h(from24h(entry.time))}`}
                        onClick={() => setWheel({ weekday, slot, value: from24h(entry.time) })}>
                        {format12h(from24h(entry.time))}
                      </button>
                    )}
                  </Field>
                </div>
              )
            })}
          </section>
        ))}

        <Switch checked={form.usesPreaching} onCheckedChange={(on) => change((prev) => ({ ...prev, usesPreaching: on }))} label="Usa predicación"
          description={form.usesPreaching ? 'El servicio y el lote mensual muestran la predicación: predicador, tema, citas y notas.' : 'Sin predicación: la sección se oculta en el servicio y en el lote, y la API no acepta cambios.'} />

        <Switch checked={form.usesRotation} onCheckedChange={(on) => change((prev) => ({ ...prev, usesRotation: on }))} label="Usa rotación de turnos"
          description={form.usesRotation ? 'Cada rol puede rotar a sus personas entre servicios, en orden y de forma cíclica.' : 'Sin rotación: los servicios nuevos solo llevan a los habituales de cada rol. Lo ya configurado se conserva.'} />
        <RotationExample />

        <SongRepeatSetting value={form.songRepeat} weekdays={form.selected} onChange={(songRepeat) => change((prev) => ({ ...prev, songRepeat }))} />

        <details className="rounded-lg border border-line bg-surface">
          <summary className="min-h-touch-lg cursor-pointer px-3 py-3 font-semibold">Roles musicales y combinaciones</summary>
          <div className="grid gap-5 px-3 pb-4"><RolesSettings editable /></div>
        </details>

        <p className="m-0 text-[0.8125rem] text-text-3">Guardar no cambia los servicios ya creados; solo lo que se precarga a partir de ahora.</p>
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending} disabled={!dirty}>Guardar cambios</Button>
        <Button variant="quiet" block disabled={!dirty || sending} onClick={discard}>Descartar cambios</Button>
      </form>
      {toast && <div className="sticky bottom-0 px-4 pb-4"><Toast message="Cambios guardados" onDismiss={() => setToast(false)} /></div>}

      <Sheet open={Boolean(wheel)} onClose={() => setWheel(null)} title="Hora de inicio">
        {wheel && (
          <div className="grid gap-3">
            <TimeWheel value={wheel.value} onChange={(value) => setWheel({ ...wheel, value })}
              meridiems={wheelSlot === 'MORNING' ? ['am'] : wheelSlot === 'AFTERNOON' ? ['pm'] : ['am', 'pm']} />
            <Button variant="primary" block onClick={() => { setEntry(wheel.weekday, wheel.slot, { time: to24h(wheel.value) }); setWheel(null) }}>Listo</Button>
          </div>
        )}
      </Sheet>
    </main>
  )
}

/** Cómo rota un rol, con personas inventadas, para decidir si activarlo. */
function RotationExample() {
  return (
    <div className="grid gap-2 rounded-lg border border-line bg-surface p-3">
      <p className="m-0 text-sm font-semibold">Así funciona la rotación, con un ejemplo</p>
      <p className="m-0 text-[0.8125rem] text-text-2">En el rol «Voces», con Luis, Mariana y Juan en ese orden, cada servicio le toca a uno y, al terminar la lista, vuelve a empezar:</p>
      <ol aria-label="Ejemplo de rotación" className="m-0 grid list-none gap-1 p-0 text-sm">
        {['Servicio 1 · Luis', 'Servicio 2 · Mariana', 'Servicio 3 · Juan', 'Servicio 4 · Luis, otra vez'].map((line) => <li key={line}>{line}</li>)}
      </ol>
      <p className="m-0 text-[0.8125rem] text-text-3">Se activa aquí y se configura en cada rol. Puedes apagarla cuando quieras: los servicios que ya existen no cambian.</p>
    </div>
  )
}

const UNIT_OPTIONS = [{ value: 'WEEKS', label: 'Semanas' }, { value: 'SERVICES', label: 'Cultos' }] as const

type Step = { name: string; state: 'sung' | 'blocked' | 'free'; note: string }
const SHOWN = 4

/** Los pasos del ejemplo, uno por culto o por semana: la canción cantada, los que quedan bloqueados y el primero libre. Con números grandes se resumen. */
function exampleSteps(rule: SongRepeat, weekdays: number[]): { steps: Array<Step | { skipped: number }>; summary: string } {
  const days = weekdays.length > 0 ? [...weekdays].sort() : [0]
  const start = Math.max(0, days.indexOf(5)) // empieza en viernes si hay culto ese día; si no, en el primer día
  const dayOf = (index: number) => DAY_NAMES[days[(start + index) % days.length]!]!
  const name = (index: number) => dayOf(index).slice(0, 3).replace(/^./, (letter) => letter.toUpperCase())
  const word = rule.unit === 'WEEKS' ? 'semana' : 'culto'
  const label = (index: number) => (rule.unit === 'WEEKS' ? `Semana ${index + 1}` : index === 0 ? name(0) : `${name(index)}`)
  const blocked = rule.unit === 'WEEKS' ? rule.amount - 1 : rule.amount
  const sequence: Step[] = [
    { name: label(0), state: 'sung', note: 'la cantas' },
    ...Array.from({ length: blocked }, (_, i): Step => ({ name: label(i + 1), state: 'blocked', note: 'no' })),
    { name: label(blocked + 1), state: 'free', note: 'ya puedes' },
  ]
  const hidden = blocked - (SHOWN - 1)
  const steps: Array<Step | { skipped: number }> = blocked > SHOWN ? [...sequence.slice(0, SHOWN), { skipped: hidden }, sequence[sequence.length - 1]!] : sequence
  const free = rule.unit === 'WEEKS' ? `la semana ${blocked + 2}` : `el ${dayOf(blocked + 1)}`
  const summary = rule.unit === 'WEEKS'
    ? `Si la cantas en la semana 1, ${rule.amount === 1 ? 'esa misma semana no se repite' : `hasta la semana ${rule.amount} no se ofrece`}; desde ${free} ya sí. Se cuenta por fecha, no por hora.`
    : `Si la cantas el ${dayOf(0)}, ${rule.amount === 1 ? 'el culto siguiente no la ofrece' : `los ${rule.amount} cultos siguientes no la ofrecen`}; desde ${free} ya sí.`
  return { steps, summary }
}

/** Dibujo del ejemplo: una fila de cultos o semanas con la canción cantada, lo bloqueado y cuándo ya se puede. Cada paso lleva texto e ícono, no solo color. */
function RepeatExample({ rule, weekdays }: { rule: SongRepeat; weekdays: number[] }) {
  const { steps, summary } = exampleSteps(rule, weekdays)
  const chip = {
    sung: 'border-accent bg-accent text-on-accent',
    blocked: 'border-dashed border-line-strong bg-surface-2 text-text-3',
    free: 'border-accent bg-accent-soft text-accent-soft-text',
  } as const
  return (
    <div className="grid gap-2 rounded-md bg-surface-2 p-3" aria-label="Ejemplo de la regla">
      <p className="m-0 text-[0.8125rem] font-semibold text-text-2">Ejemplo</p>
      <ol className="m-0 flex list-none flex-wrap items-stretch gap-1.5 p-0">
        {steps.map((step, index) => 'skipped' in step ? (
          <li key={`skip-${index}`} className="grid min-w-9 place-items-center text-xs font-medium text-text-3" aria-label={`${step.skipped} más, también bloqueados`}>+{step.skipped}</li>
        ) : (
          <li key={`${step.name}-${index}`} className={`grid min-w-14 justify-items-center gap-0.5 rounded-md border px-2 py-1.5 text-center ${chip[step.state]}`}>
            <Icon name={step.state === 'sung' ? 'music' : step.state === 'blocked' ? 'lock' : 'check'} width={16} height={16} />
            <b className="text-sm leading-tight font-semibold">{step.name}</b>
            <small className="text-xs leading-tight">{step.note}</small>
          </li>
        ))}
      </ol>
      <p className="m-0 text-[0.8125rem] text-text-2">{summary}</p>
      <p className="m-0 text-[0.8125rem] text-text-3">También cuenta hacia adelante: si ya está programada en un servicio cercano, tampoco se ofrece para este.</p>
    </div>
  )
}

/** Regla estricta de repetición: una canción usada hace menos de N semanas, o dentro de los N cultos anteriores o siguientes, no se puede elegir. */
function SongRepeatSetting({ value, weekdays, onChange }: { value: SongRepeat | null; weekdays: number[]; onChange: (value: SongRepeat | null) => void }) {
  const set = (patch: Partial<SongRepeat>) => value && onChange({ ...value, ...patch })
  return (
    <section className="grid gap-3 rounded-lg border border-line bg-surface p-3" aria-label="Repetición de canciones">
      <Switch checked={value !== null} onCheckedChange={(on) => onChange(on ? { unit: 'WEEKS', amount: 2 } : null)} label="Evitar repetir canciones"
        description={value ? 'Al armar un setlist, las canciones que no cumplen la regla aparecen deshabilitadas y la API tampoco las acepta.' : 'Sin regla: cualquier canción se puede elegir; solo se muestra cuándo se usó por última vez.'} />
      {value && (
        <>
          <Segmented<SongRepeat['unit']> label="Contar en" value={value.unit} onChange={(unit) => set({ unit })} options={UNIT_OPTIONS} />
          <p className="m-0 text-[0.8125rem] text-text-3">
            {value.unit === 'WEEKS' ? 'Semanas: se cuenta el calendario, sin importar cuántos cultos haya en ellas.' : 'Cultos: se cuentan los servicios que haya, sin importar cuántos días pasen.'}
          </p>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[0.9375rem] font-semibold">Mínimo entre usos <small className="font-normal text-text-3">({value.unit === 'WEEKS' ? value.amount === 1 ? 'semana' : 'semanas' : value.amount === 1 ? 'culto' : 'cultos'})</small></span>
            <Button variant="secondary" icon aria-label="Menos" disabled={value.amount <= 1} onClick={() => set({ amount: value.amount - 1 })}><Icon name="minus" /></Button>
            <output aria-label="Mínimo entre usos" className="w-8 text-center font-display text-lg font-bold [font-variant-numeric:tabular-nums]">{value.amount}</output>
            <Button variant="secondary" icon aria-label="Más" disabled={value.amount >= 26} onClick={() => set({ amount: value.amount + 1 })}><Icon name="plus" /></Button>
          </div>
          <RepeatExample rule={value} weekdays={weekdays} />
        </>
      )}
    </section>
  )
}
