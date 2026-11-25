import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Avatar, Button, Icon, Notice, Sheet, TextField } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, usePerson, usePersonActions } from '../calendar/api'
import { useRoles } from '../calendar/roles-api'
import type { Church, PersonDetail } from '../calendar/model'
import { PersonRoles, rolesText, type RoleFlags } from '../calendar/PersonRoles'
import { AccessSection } from './AccessSection'
import { PhoneField, phoneDigits, phoneError, phoneStored } from './phone'

export function PersonPage() {
  return <ChurchGate>{(church) => <Loader church={church} />}</ChurchGate>
}

function Loader({ church }: { church: Church }) {
  const { personId = '' } = useParams()
  const person = usePerson(personId)
  const missing = person.error instanceof ApiError && person.error.status === 404
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] lg:max-w-[720px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Persona" back="/personas" backLabel="Volver a personas" />
      {person.isPending && <p role="status" className="p-4">Cargando persona…</p>}
      {missing && <div className="p-4"><Notice title="No encontramos a esta persona">Puede haberse quitado de la iglesia.</Notice></div>}
      {person.isError && !missing && (
        <div className="grid gap-4 p-4">
          <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la ficha">Revisa tu conexión e inténtalo de nuevo.</Notice>
          <Button variant="secondary" onClick={() => void person.refetch()}>Reintentar</Button>
        </div>
      )}
      {person.data && <Record key={person.data.id} church={church} person={person.data} />}
    </main>
  )
}

const shownPhone = (digits: string) => (digits.length === 10 ? `+52 ${digits}` : digits || 'Sin teléfono')
const YouBadge = () => <span className="w-fit rounded-full border border-line-strong bg-surface-2 px-2.5 text-[0.8125rem] font-medium text-text-2">Tú</span>

/** Vista de quien no administra: solo cómo contactar a la persona. */
function Contact({ name, phone, isYou }: { name: string; phone: string; isYou: boolean }) {
  return (
    <div className="grid flex-1 content-start gap-5 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} className="size-12 text-base" />
        <div className="grid gap-1">
          <h1 className="m-0 font-display text-xl font-bold tracking-tight">{name}</h1>
          {isYou && <YouBadge />}
        </div>
      </div>
      <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Teléfono: </span>{shownPhone(phone)}</p>
      {phone.length === 10 && !isYou && (
        <a href={`https://wa.me/52${phone}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-touch-lg w-full items-center justify-center rounded-md border border-transparent bg-accent px-6 text-[0.9375rem] font-semibold text-on-accent no-underline hover:bg-accent-hover">
          Contactar por WhatsApp
        </a>
      )}
      {isYou && <Notice>Este es tu perfil. Tu nombre y tu teléfono los gestiona el administrador de tu iglesia.</Notice>}
    </div>
  )
}

function Record({ church, person }: { church: Church; person: PersonDetail }) {
  const navigate = useNavigate()
  const { update, remove } = usePersonActions()
  const [name, setName] = useState(person.name)
  const [phone, setPhone] = useState(phoneDigits(person.phone))
  const [email, setEmail] = useState(person.email ?? '')
  const [saved, setSaved] = useState({ name: person.name, phone: phoneDigits(person.phone), email: person.email ?? '' })
  const [nameError, setNameError] = useState('')
  const [phoneProblem, setPhoneProblem] = useState('')
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const dirty = name.trim() !== saved.name || phone !== saved.phone || email.trim() !== saved.email
  const edit = church.canEdit
  // «Cambiar correo» desde Acceso lleva a este campo: se desplaza hasta él, lo enfoca y lo resalta un momento.
  const emailBox = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState(false)
  function goToEmail() {
    emailBox.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    emailBox.current?.querySelector('input')?.focus({ preventScroll: true })
    setHighlight(true)
    setTimeout(() => setHighlight(false), 2600)
  }

  async function save() {
    if (!name.trim()) return setNameError('Escribe el nombre de la persona.')
    const invalid = phone !== saved.phone ? phoneError(phone) : ''
    setPhoneProblem(invalid)
    if (invalid) return
    setSending(true)
    setNameError('')
    setFailure('')
    setDone(false)
    try {
      // Solo lo que cambió: un teléfono anterior sin formato no bloquea corregir el nombre.
      const result = await update(person.id, {
        ...(name.trim() !== saved.name ? { name: name.trim() } : {}),
        ...(phone !== saved.phone ? { phone: phoneStored(phone) } : {}),
        ...(email.trim() !== saved.email ? { email: email.trim() || null } : {}),
      })
      setSaved({ name: result.name, phone: phoneDigits(result.phone), email: result.email ?? '' })
      setName(result.name)
      setPhone(phoneDigits(result.phone))
      setEmail(result.email ?? '')
      setDone(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setNameError(`Ya hay una persona llamada «${caught.existing?.name ?? name.trim()}». Completa el nombre para distinguirlas.`)
      else setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para editar personas.' : caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre, el teléfono y el correo.' : 'No se pudo guardar. Inténtalo de nuevo.')
    }
    setSending(false)
  }
  function discard() {
    setName(saved.name)
    setPhone(saved.phone)
    setEmail(saved.email)
    setNameError('')
    setPhoneProblem('')
    setFailure('')
  }
  async function confirmRemoval() {
    setSending(true)
    try {
      await remove(person.id)
      void navigate('/personas', { replace: true, state: { removed: saved.name } })
    } catch {
      setConfirming(false)
      setFailure('No se pudo quitar a la persona. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  if (!edit) return <Contact name={saved.name} phone={saved.phone} isYou={person.isYou} />

  return (
    <>
      <div className="grid flex-1 content-start gap-5 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={saved.name} className="size-12 text-base" />
          <div className="grid gap-1">
            <h1 className="m-0 font-display text-xl font-bold tracking-tight">{saved.name}</h1>
            {person.isYou && <YouBadge />}
            {person.hasAccount && <span className="w-fit rounded-full border border-pub-bd bg-pub-bg px-2.5 text-[0.8125rem] font-medium text-pub-fg">Con cuenta</span>}
          </div>
        </div>

        <section className="grid gap-3" aria-labelledby="personal">
          <h2 id="personal" className="m-0 font-display text-lg font-bold">Información personal</h2>
          {edit ? (
            <>
              <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off" error={nameError || undefined}
                onChange={(event) => { setName(event.target.value); setNameError(''); setDone(false) }} />
              <PhoneField value={phone} error={phoneProblem || undefined} onChange={(digits) => { setPhone(digits); setPhoneProblem(''); setDone(false) }} />
              <div ref={emailBox} className={highlight ? 'rounded-lg bg-accent-soft p-2 ring-2 ring-accent transition-shadow motion-reduce:transition-none -m-2' : '-m-2 p-2'}>
                <TextField label="Correo" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email}
                  help="Con este correo entra a la app si la invitas; no hace falta invitarla para guardarlo."
                  onChange={(event) => { setEmail(event.target.value); setDone(false) }} />
              </div>
            </>
          ) : (
            <dl className="m-0 grid gap-1 text-[0.9375rem]">
              <div><dt className="text-[0.8125rem] text-text-3">Nombre completo</dt><dd className="m-0">{saved.name}</dd></div>
              <div><dt className="text-[0.8125rem] text-text-3">Teléfono</dt><dd className="m-0">{shownPhone(saved.phone)}</dd></div>
              <div><dt className="text-[0.8125rem] text-text-3">Correo</dt><dd className="m-0">{saved.email || 'Sin correo'}</dd></div>
            </dl>
          )}
          <Notice>
            {person.sharedWithOtherChurches
              ? 'Esta información es general: si la cambias, se ve igual en las demás iglesias donde participa. Sus roles y turnos no se comparten.'
              : 'Esta información es general: se vería igual en cualquier otra iglesia donde participe. Sus roles y turnos son solo de esta iglesia.'}
          </Notice>
          {done && <p role="status" className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={16} height={16} />Cambios guardados</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          {edit && dirty && (
            <div className="grid gap-2">
              <Button variant="primary" block loading={sending} onClick={() => void save()}>Guardar cambios</Button>
              <Button variant="quiet" block onClick={discard}>Descartar cambios</Button>
            </div>
          )}
        </section>

        <JobsSection church={church} person={person} />

        <RolesSection church={church} person={person} />

        <AccessSection church={church} person={person} unsavedEmail={email.trim() !== saved.email} onEditEmail={goToEmail} />

        {church.canConfigure && <Button variant="danger" block onClick={() => setConfirming(true)}>Quitar de {church.name}</Button>}
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title={`¿Quitar a ${saved.name} de ${church.name}?`}>
        <div className="grid gap-3">
          {person.upcomingServices > 0 && (
            <Notice tone="warn" icon="alert" role="status">
              Tiene {person.upcomingServices} {person.upcomingServices === 1 ? 'servicio próximo' : 'servicios próximos'} a su cargo. Conviene revisar quién dirige {person.upcomingServices === 1 ? 'ese servicio' : 'esos servicios'}.
            </Notice>
          )}
          <p className="m-0 text-[0.9375rem] text-text-2">
            Dejará de aparecer al buscar personas y al elegir quién dirige en {church.name}. Los servicios pasados conservan su nombre y sus datos personales se mantienen para sus otras iglesias.
          </p>
          <Button variant="danger" block loading={sending} onClick={() => void confirmRemoval()}>Quitar de {church.name}</Button>
          <Button variant="quiet" block onClick={() => setConfirming(false)}>Cancelar</Button>
        </div>
      </Sheet>
    </>
  )
}

/** Roles musicales que la persona puede tener en esta iglesia: solo quien administra los cambia. */
function RolesSection({ church, person }: { church: Church; person: PersonDetail }) {
  const roles = useRoles()
  const { setRoles } = usePersonActions()
  const [saved, setSaved] = useState(person.roleIds)
  const [chosen, setChosen] = useState(person.roleIds)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const catalog = roles.data ?? []
  const dirty = chosen.length !== saved.length || chosen.some((id) => !saved.includes(id))
  const toggle = (id: string) => { setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])); setDone(false) }

  async function save() {
    setSending(true)
    setFailure('')
    try {
      const result = await setRoles(person.id, chosen)
      setSaved(result.roleIds)
      setChosen(result.roleIds)
      setDone(true)
    } catch (caught) {
      setFailure(caught instanceof ApiError && caught.status === 403 ? 'Solo un administrador puede cambiar los roles.' : 'No se pudieron guardar los roles. Inténtalo de nuevo.')
    }
    setSending(false)
  }

  return (
    <section className="grid gap-3" aria-labelledby="roles">
      <h2 id="roles" className="m-0 font-display text-lg font-bold">Roles en {church.name}</h2>
      {roles.isPending && <p role="status" className="m-0 text-[0.9375rem] text-text-2">Cargando roles…</p>}
      {roles.isError && <Notice tone="warn" icon="alert" role="alert">No se pudieron cargar los roles.</Notice>}
      {roles.data && catalog.length === 0 && <p className="m-0 text-[0.9375rem] text-text-2">La iglesia aún no tiene roles musicales.</p>}
      {roles.data && catalog.length > 0 && (church.canConfigure ? (
        <>
          <div role="group" aria-label="Roles de la persona" className="flex flex-wrap gap-2">
            {catalog.map((role) => (
              <button key={role.id} type="button" aria-pressed={chosen.includes(role.id)} onClick={() => toggle(role.id)}
                className="min-h-touch cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-[0.9375rem] font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent">
                {role.name}
              </button>
            ))}
          </div>
          <p className="m-0 text-[0.8125rem] text-text-3">Solo puede tener, o recibir en un servicio, los roles marcados. Dirigir no depende de esto.</p>
          {done && <p role="status" className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={16} height={16} />Roles guardados</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          {dirty && <Button variant="primary" block loading={sending} onClick={() => void save()}>Guardar roles</Button>}
        </>
      ) : (
        <p className="m-0 text-[0.9375rem]">{catalog.filter((role) => saved.includes(role.id)).map((role) => role.name).join(', ') || 'Sin roles asignados.'}</p>
      ))}
    </section>
  )
}

/** Para qué trabajos aparece la persona en los selectores (dirección y predicación); quien edita los cambia al instante. */
function JobsSection({ church, person }: { church: Church; person: PersonDetail }) {
  const { update } = usePersonActions()
  const [jobs, setJobs] = useState<RoleFlags>({ canDirect: person.canDirect, canPreach: person.canPreach })
  const [failure, setFailure] = useState('')
  /** Cada interruptor se guarda al cambiarlo; si el servidor lo rechaza, vuelve a como estaba. */
  async function change(next: RoleFlags) {
    const previous = jobs
    setJobs(next)
    setFailure('')
    try {
      await update(person.id, next)
    } catch {
      setJobs(previous)
      setFailure('No se pudo cambiar el rol. Inténtalo de nuevo.')
    }
  }
  return (
    <section className="grid gap-2" aria-labelledby="jobs">
      <h2 id="jobs" className="m-0 font-display text-lg font-bold">Dirección y predicación</h2>
      {church.canEdit ? <PersonRoles value={jobs} onChange={(next) => void change(next)} showPreach={church.usesPreaching} />
        : <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Roles: </span><b>{rolesText(jobs, church.usesPreaching) || 'Ninguno'}</b></p>}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
    </section>
  )
}
