import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Field, Icon, Notice, Sheet, Switch, TextField, TimeWheel, Toast, format12h, from24h, inputClass, to24h, type Time12 } from '../ui'
import { AccessLink, AccountsLink } from '../access/AccessLinks'
import { ChurchGate, PageHeader, TopBar } from './ChurchGate'
import { ApiError, useSaveChurch } from './api'
import type { Church, ChurchSettings, Slot } from './model'
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
type Form = { name: string; sundayDouble: boolean; usesPreaching: boolean; selected: number[]; entries: Record<string, Entry> }

const keyOf = (weekday: number, slot: Slot) => `${weekday}.${slot}`
const slotsOf = (weekday: number, double: boolean): Slot[] => (weekday === 0 && double ? ['MORNING', 'AFTERNOON'] : ['SINGLE'])

function toForm(church: ChurchSettings): Form {
  return {
    name: church.name, sundayDouble: church.sundayDouble, usesPreaching: church.usesPreaching,
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
  return { name: form.name.trim(), sundayDouble: form.sundayDouble, usesPreaching: form.usesPreaching, days }
}

const slotOrder: Record<Slot, number> = { SINGLE: 0, MORNING: 1, AFTERNOON: 2 }
/** Forma comparable de lo guardado: mismo orden y mismos campos que `toSettings`. */
const comparable = (settings: ChurchSettings): ChurchSettings => ({
  name: settings.name, sundayDouble: settings.sundayDouble, usesPreaching: settings.usesPreaching,
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
    <main className="mx-auto max-w-[480px]">
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
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings />
      <PageHeader title="Ajustes de la iglesia" />
      <form onSubmit={(event) => { event.preventDefault(); void submit() }} noValidate className="grid flex-1 content-start gap-5 p-4">
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

        <ParticipationsLink />
        <AccessLink />
        <AccountsLink />
        <RolesSettings editable />

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
