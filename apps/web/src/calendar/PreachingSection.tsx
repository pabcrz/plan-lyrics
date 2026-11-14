import { useState, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Avatar, Button, Field, Icon, Notice, Sheet, TextField, inputClass } from '../ui'
import { ApiError, usePeople } from './api'
import { formatDay, todayIn } from './dates'
import type { Service } from './model'
import { PersonList } from './PeopleSheet'
import { formIssues, LIMITS, parseNotes, passagesText, textPassages, type NoteBlock, type PreachingForm } from './preaching'
import { usePreaching, usePreachingActions, usePreachingTurns, type Preaching } from './preaching-api'

const failureText = (error: unknown) => {
  const code = error instanceof ApiError ? error.code : ''
  if (code === 'Date in the past') return 'Los servicios pasados se conservan como registro y ya no se modifican.'
  if (code === 'Preaching disabled') return 'Tu iglesia ya no usa la predicación. Actívala en Ajustes para cambiarla.'
  if (error instanceof ApiError && error.status === 403) return 'No tienes permiso para cambiar la predicación.'
  if (error instanceof ApiError && error.status === 400) return 'Revisa los datos: el predicador debe estar en el directorio y los textos no pueden pasar de sus límites.'
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}

/** Las notas en su formato mínimo: viñetas, negritas y subrayado; todo lo demás es texto, nunca marcado. */
export function Notes({ notes }: { notes: string }) {
  const blocks = parseNotes(notes)
  const groups: Array<NoteBlock[]> = []
  for (const block of blocks) {
    const last = groups[groups.length - 1]
    if (block.kind === 'bullet' && last?.[0]?.kind === 'bullet') last.push(block)
    else groups.push([block])
  }
  const inline = (block: NoteBlock) => block.spans.map((span, index) => {
    let node: ReactNode = span.text
    if (span.bold) node = <strong>{node}</strong>
    if (span.underline) node = <u>{node}</u>
    return <span key={index}>{node}</span>
  })
  return (
    <div className="grid gap-1 text-[0.9375rem]">
      {groups.map((group, index) => group[0]!.kind === 'bullet'
        ? <ul key={index} className="m-0 grid list-disc gap-1 pl-5">{group.map((block, item) => <li key={item}>{inline(block)}</li>)}</ul>
        : group[0]!.kind === 'gap' ? <span key={index} aria-hidden="true" className="h-1" /> : <p key={index} className="m-0">{inline(group[0]!)}</p>)}
    </div>
  )
}

/** Predicación de un servicio: todos la leen, quien edita la cambia y las notas llegan solo a quien la API permite. */
export function PreachingSection({ service, canEdit }: { service: Service; canEdit: boolean }) {
  const preaching = usePreaching(service.id, true)
  const [editing, setEditing] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [done, setDone] = useState('')
  // Los servicios de fechas pasadas son un registro: la API tampoco los modifica.
  const editable = canEdit && service.date >= todayIn()
  const finish = (message: string) => { setEditing(false); setSwapping(false); setDone(message) }
  const data = preaching.data
  const empty = data && !data.preacher && !data.topic && data.passages.length === 0 && !data.notes

  return (
    <section aria-labelledby="preaching" className="grid gap-2">
      <h3 id="preaching" className="m-0 text-sm font-semibold text-text-2">Predicación</h3>
      {preaching.isPending && <p role="status" className="m-0 text-[0.8125rem] text-text-3">Cargando predicación…</p>}
      {preaching.error && <Notice tone="warn" icon="alert" role="alert">No se pudo cargar la predicación.</Notice>}
      {data && (
        <>
          {empty && <p className="m-0 text-[0.8125rem] text-text-3">Este servicio no tiene predicación cargada.</p>}
          {!empty && (
            <div className="grid gap-3 rounded-md border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                {data.preacher ? <Avatar name={data.preacher.name} /> : null}
                <span>
                  <small className="block text-[0.8125rem] text-text-3">Predicador</small>
                  {data.preacher ? <b className="font-semibold">{data.preacher.name}</b> : <span className="text-text-3">Sin predicador</span>}
                </span>
              </div>
              {data.topic && <p className="m-0"><small className="block text-[0.8125rem] text-text-3">Tema</small><b className="font-semibold">{data.topic}</b></p>}
              {data.passages.length > 0 && (
                <div>
                  <small className="block text-[0.8125rem] text-text-3">Citas bíblicas</small>
                  <ul aria-label="Citas bíblicas" className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                    {data.passages.map((passage, index) => <li key={index} className="rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-[0.8125rem] font-medium">{passage}</li>)}
                  </ul>
                </div>
              )}
              {data.canSeeNotes && data.notes && (
                <div>
                  <small className="block text-[0.8125rem] text-text-3">Notas internas</small>
                  <Notes notes={data.notes} />
                </div>
              )}
            </div>
          )}
          {done && <p role="status" className="m-0 text-[0.8125rem] font-medium text-text-2">{done}</p>}
          {editable && <Button variant="secondary" block onClick={() => { setDone(''); setEditing(true) }}>{empty ? 'Agregar predicación' : 'Editar predicación'}</Button>}
          {editable && data.preacher && <Button variant="quiet" block onClick={() => { setDone(''); setSwapping(true) }}>Intercambiar predicador con otra fecha</Button>}
        </>
      )}
      <Sheet open={editing} onClose={() => setEditing(false)} title="Predicación">
        {editing && data && <EditBody service={service} data={data} onClose={() => setEditing(false)} onDone={finish} />}
      </Sheet>
      <Sheet open={swapping} onClose={() => setSwapping(false)} title="Intercambiar predicador">
        {swapping && data?.preacher && <SwapBody service={service} current={data.preacher} onClose={() => setSwapping(false)} onDone={finish} />}
      </Sheet>
    </section>
  )
}

function TextArea({ label, help, error, rows, ...rest }: { label: string; help?: ReactNode; error?: string; rows: number } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'rows'>) {
  return (
    <Field label={label} help={help} error={error}>
      {(control) => <textarea {...rest} {...control} rows={rows} className={`${inputClass} resize-y py-2 leading-normal`} />}
    </Field>
  )
}

function EditBody({ service, data, onClose, onDone }: { service: Service; data: Preaching; onClose: () => void; onDone: (message: string) => void }) {
  const people = usePeople(true)
  const actions = usePreachingActions()
  const [form, setForm] = useState<PreachingForm>({ preacherId: data.preacher?.id ?? null, topic: data.topic, passages: passagesText(data.passages), notes: data.notes ?? '' })
  const [choosing, setChoosing] = useState(false)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const issues = formIssues(form)
  const invalid = Object.keys(issues).length > 0
  // Quien dejó el directorio sigue en su fecha: se muestra por el nombre que ya trae la sección.
  const preacherName = form.preacherId === null ? null : (people.data ?? []).find((person) => person.id === form.preacherId)?.name ?? (data.preacher?.id === form.preacherId ? data.preacher.name : 'Persona')
  const change = (patch: Partial<PreachingForm>) => { setForm({ ...form, ...patch }); setFailure('') }

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      await actions.save(service.id, { preacherId: form.preacherId, topic: form.topic.trim().replace(/\s+/g, ' '), passages: textPassages(form.passages), notes: form.notes })
      onDone('Predicación guardada')
    } catch (caught) {
      setFailure(failureText(caught))
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className="text-sm font-semibold">Predicador</span>
        <div className="flex min-h-14 items-center gap-3 rounded-md border border-line bg-surface px-3">
          {preacherName ? <Avatar name={preacherName} /> : null}
          <span className="flex-1 font-semibold">{preacherName ?? <span className="font-normal text-text-3">Sin predicador</span>}</span>
          <Button variant="quiet" onClick={() => setChoosing(!choosing)}>{choosing ? 'Cerrar lista' : preacherName ? 'Cambiar' : 'Elegir'}</Button>
        </div>
        {choosing && (
          <>
            <PersonList people={people.data ?? []} selectedId={form.preacherId} onSelect={(person) => { change({ preacherId: person.id }); setChoosing(false) }} empty="No hay personas en el directorio." />
            {form.preacherId && <Button variant="quiet" block onClick={() => { change({ preacherId: null }); setChoosing(false) }}>Dejar sin predicador</Button>}
          </>
        )}
        <p className="m-0 text-[0.8125rem] text-text-3">No hace falta que la persona tenga cuenta. Dirigir y predicar el mismo servicio está permitido.</p>
      </div>
      <TextField label="Tema" value={form.topic} maxLength={LIMITS.topic + 40} error={issues.topic} onChange={(event) => change({ topic: event.target.value })} />
      <TextArea label="Citas bíblicas" rows={3} value={form.passages} error={issues.passages} onChange={(event) => change({ passages: event.target.value })}
        help="Una cita por línea, por ejemplo «Hebreos 11:1-6». Se muestran tal como las escribes." />
      <TextArea label="Notas internas" rows={6} value={form.notes} error={issues.notes} onChange={(event) => change({ notes: event.target.value })}
        help="Puntos a considerar. Empieza una línea con «- » para una viñeta; usa **negrita** y __subrayado__. Solo las ven quienes administran o editan servicios y el predicador asignado con cuenta." />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button variant="primary" block loading={sending} disabled={invalid} onClick={() => void submit()}>Guardar predicación</Button>
      <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
    </div>
  )
}

function SwapBody({ service, current, onClose, onDone }: { service: Service; current: { id: string; name: string }; onClose: () => void; onDone: (message: string) => void }) {
  const turns = usePreachingTurns(true)
  const actions = usePreachingActions()
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const others = (turns.data ?? []).filter((turn) => turn.serviceId !== service.id && turn.person.id !== current.id)
  const turn = others.find((item) => item.serviceId === serviceId)

  async function confirm() {
    setSending(true)
    setFailure('')
    try {
      await actions.swap(service.id, turn!.serviceId)
      onDone('Predicadores intercambiados')
    } catch (caught) {
      setFailure(failureText(caught))
      setSending(false)
    }
  }

  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm text-text-2">Ahora: {current.name} · {formatDay(service.date)}. Solo se intercambian los predicadores: cada fecha conserva su tema, citas y notas.</p>
      {turns.isPending ? <p role="status" className="m-0 text-[0.8125rem] text-text-3">Cargando fechas…</p>
        : turns.error ? <Notice tone="warn" icon="alert" role="alert">No se pudieron cargar las fechas.</Notice>
          : others.length === 0 ? <p className="m-0 text-[0.8125rem] text-text-3">No hay otras fechas próximas con un predicador distinto.</p>
            : (
              <ul aria-label="Fechas con predicador" className="m-0 max-h-[40dvh] list-none overflow-y-auto rounded-md border border-line bg-surface p-0">
                {others.map((item) => (
                  <li key={item.serviceId}>
                    <button type="button" aria-pressed={item.serviceId === serviceId} onClick={() => { setServiceId(item.serviceId); setFailure('') }}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-b border-line bg-transparent px-3 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft">
                      <span className="font-semibold">{formatDay(item.date)}</span><span>{item.person.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
      {turn && (
        <Notice icon="info" title={`${current.name} ↔ ${turn.person.name}`}>
          {formatDay(service.date)} pasa a {turn.person.name} · {formatDay(turn.date)} pasa a {current.name}. Las demás fechas no cambian.
        </Notice>
      )}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button variant="primary" block loading={sending} disabled={!turn} onClick={() => void confirm()}><Icon name="check" />Confirmar intercambio</Button>
      <Button variant="quiet" block onClick={onClose}>Cancelar</Button>
    </div>
  )
}
