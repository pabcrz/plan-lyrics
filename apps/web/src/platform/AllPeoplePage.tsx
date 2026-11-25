import { useState, type FormEvent } from 'react'
import { Avatar, Button, Icon, Notice, Sheet, Switch, TextField, fold, inputClass } from '../ui'
import { PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError } from '../calendar/api'
import { PersonRoles } from '../calendar/PersonRoles'
import { useAccess } from '../access/access-api'
import { PhoneField, phoneDigits, phoneError, phoneStored } from '../people/phone'
import { RoleChips, toggled } from '../people/RoleChips'
import { usePlatformActions, usePlatformChurches, usePlatformPeople, type Flags, type PlatformChurch, type PlatformPerson } from './platform-api'

const NONE: Flags = { canPlay: false, canDirect: false, canPreach: false, roleIds: [] }

/** «Todas las personas»: el directorio de toda la plataforma, solo para el superadministrador. */
export function AllPeoplePage() {
  const access = useAccess()
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col lg:max-w-[720px]">
      <TopBar />
      <PageHeader title="Todas las personas" />
      <div className="grid flex-1 content-start gap-4 p-4">
        {access.isPending && <p role="status">Comprobando tu acceso…</p>}
        {access.isError && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo comprobar tu acceso">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void access.refetch()}>Reintentar</Button>
          </>
        )}
        {access.data && !access.data.owner && <Notice title="Sin permiso">Ver y asignar a todas las personas lo hace el superadministrador.</Notice>}
        {access.data?.owner && <Directory />}
      </div>
    </main>
  )
}

function Directory() {
  const people = usePlatformPeople(true)
  const churches = usePlatformChurches(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const everyone = people.data ?? []
  const churchNames = new Map((churches.data ?? []).map((church) => [church.id, church.name]))
  const found = everyone.filter((person) => fold(person.name).includes(fold(query)))
  const opened = everyone.find((person) => person.id === open)

  return (
    <>
      <div className="flex items-center gap-3">
        <p aria-live="polite" className="m-0 flex-1 text-[0.8125rem] text-text-2">
          {people.data ? (found.length === everyone.length ? `${found.length} ${found.length === 1 ? 'persona' : 'personas'}` : `${found.length} de ${everyone.length}`) : ''}
        </p>
        <Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" />Agregar persona</Button>
      </div>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-3.5 left-3 text-text-3" />
        <input type="search" autoComplete="off" placeholder="Buscar por nombre" aria-label="Buscar personas por nombre"
          value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-10`} />
      </div>
      {(people.isPending || churches.isPending) && <p role="status">Cargando personas…</p>}
      {(people.isError || churches.isError) && (
        <>
          <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar las personas">Revisa tu conexión e inténtalo de nuevo.</Notice>
          <Button variant="secondary" onClick={() => { void people.refetch(); void churches.refetch() }}>Reintentar</Button>
        </>
      )}
      {people.data && everyone.length === 0 && <Notice title="Aún no hay personas">Agrega a la primera con «Agregar persona»: puede quedar sin iglesia y asignarla después.</Notice>}
      {found.length > 0 && (
        <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
          {found.map((person) => (
            <li key={person.id} className="border-b border-line last:border-b-0">
              <button type="button" onClick={() => setOpen(person.id)}
                className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2">
                <Avatar name={person.name} />
                <span className="grid flex-1">
                  <b className="text-[0.9375rem] font-semibold">{person.name}</b>
                  <small className="text-[0.8125rem] text-text-3">{person.churches.map((link) => churchNames.get(link.id)).filter(Boolean).join(' · ') || 'Sin iglesia'}</small>
                </span>
                {person.hasAccount && <span className="rounded-full border border-pub-bd bg-pub-bg px-2.5 text-[0.8125rem] font-medium text-pub-fg">Con cuenta</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {people.data && everyone.length > 0 && found.length === 0 && <p className="m-0 text-text-2">Nadie coincide con «{query.trim()}».</p>}
      {adding && <NewPerson onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); setOpen(id) }} onExisting={(id) => { setAdding(false); setOpen(id) }} />}
      {opened && churches.data && <PersonSheet key={opened.id} person={opened} churches={churches.data} onClose={() => setOpen(null)} />}
    </>
  )
}

function NewPerson({ onClose, onCreated, onExisting }: { onClose: () => void; onCreated: (id: string) => void; onExisting: (id: string) => void }) {
  const { create } = usePlatformActions()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [phoneProblem, setPhoneProblem] = useState('')
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const invalid = phoneError(phone)
    setPhoneProblem(invalid)
    if (!name.trim() || invalid) return
    setSending(true)
    setExisting(null)
    setFailure('')
    try {
      const person = await create({ name: name.trim(), ...(phone ? { phone: phoneStored(phone) as string } : {}), ...(email.trim() ? { email: email.trim() } : {}) })
      onCreated(person.id)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.existing) setExisting(caught.existing)
      else setFailure(caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre, el teléfono y el correo.' : 'No se pudo agregar a la persona. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="Agregar persona">
      <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
        <p className="m-0 text-[0.9375rem] text-text-2">Queda sin iglesia: la asignas después desde su ficha.</p>
        <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off" onChange={(event) => { setName(event.target.value); setExisting(null) }}
          error={existing ? 'Ya hay una persona con ese nombre.' : undefined} />
        {existing && (
          <Notice tone="warn" icon="alert" role="alert" title={`Ya existe «${existing.name}»`}>
            Completa el nombre para distinguirla, o <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold underline" onClick={() => onExisting(existing.id)}>abre su ficha</button>.
          </Notice>
        )}
        <PhoneField value={phone} error={phoneProblem || undefined} onChange={(digits) => { setPhone(digits); setPhoneProblem('') }} />
        <TextField label="Correo (opcional)" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        <Button type="submit" variant="primary" block loading={sending} disabled={!name.trim()}>Agregar persona</Button>
      </form>
    </Sheet>
  )
}

function PersonSheet({ person, churches, onClose }: { person: PlatformPerson; churches: PlatformChurch[]; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={person.name}>
      <div className="grid gap-6">
        <Personal person={person} />
        <section className="grid gap-3" aria-labelledby="churches">
          <h2 id="churches" className="m-0 font-display text-lg font-bold">Iglesias</h2>
          {churches.length === 0 && <p className="m-0 text-text-2">Aún no hay iglesias.</p>}
          {churches.map((church) => <ChurchRow key={church.id} person={person} church={church} />)}
        </section>
      </div>
    </Sheet>
  )
}

/** Nombre, teléfono y correo: datos generales, iguales en todas las iglesias de la persona. */
function Personal({ person }: { person: PlatformPerson }) {
  const { update } = usePlatformActions()
  const saved = { name: person.name, phone: phoneDigits(person.phone), email: person.email ?? '' }
  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.phone)
  const [email, setEmail] = useState(saved.email)
  const [nameError, setNameError] = useState('')
  const [phoneProblem, setPhoneProblem] = useState('')
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const dirty = name.trim() !== saved.name || phone !== saved.phone || email.trim() !== saved.email

  async function save() {
    if (!name.trim()) return setNameError('Escribe el nombre de la persona.')
    const invalid = phone !== saved.phone ? phoneError(phone) : ''
    setPhoneProblem(invalid)
    if (invalid) return
    setSending(true)
    setNameError('')
    setFailure('')
    try {
      await update(person.id, {
        ...(name.trim() !== saved.name ? { name: name.trim() } : {}),
        ...(phone !== saved.phone ? { phone: phoneStored(phone) } : {}),
        ...(email.trim() !== saved.email ? { email: email.trim() || null } : {}),
      })
      setDone(true)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) setNameError(`Ya hay una persona llamada «${caught.existing?.name ?? name.trim()}». Completa el nombre para distinguirlas.`)
      else setFailure(caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre, el teléfono y el correo.' : 'No se pudo guardar. Inténtalo de nuevo.')
    }
    setSending(false)
  }

  return (
    <section className="grid gap-3" aria-labelledby="personal">
      <h2 id="personal" className="m-0 font-display text-lg font-bold">Datos generales</h2>
      <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off" error={nameError || undefined} onChange={(event) => { setName(event.target.value); setNameError(''); setDone(false) }} />
      <PhoneField value={phone} error={phoneProblem || undefined} onChange={(digits) => { setPhone(digits); setPhoneProblem(''); setDone(false) }} />
      <TextField label="Correo (opcional)" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setDone(false) }} />
      <p className="m-0 text-[0.8125rem] text-text-3">Se ven en todas las iglesias donde participa.</p>
      {done && !dirty && <p role="status" className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-medium text-pub-fg"><Icon name="check" width={16} height={16} />Datos guardados</p>}
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      {dirty && <Button variant="primary" block loading={sending} onClick={() => void save()}>Guardar datos</Button>}
    </section>
  )
}

/** Una iglesia: el interruptor asigna o quita; asignada o por asignar, se eligen sus grupos y, en alabanza, sus roles. */
function ChurchRow({ person, church }: { person: PlatformPerson; church: PlatformChurch }) {
  const { assign, unassign } = usePlatformActions()
  const link = person.churches.find((item) => item.id === church.id)
  const [draft, setDraft] = useState<Flags>(link ?? NONE)
  const [adding, setAdding] = useState(false)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const shown = link !== undefined || adding
  const same = link !== undefined && link.canPlay === draft.canPlay && link.canDirect === draft.canDirect && link.canPreach === draft.canPreach
    && link.roleIds.length === draft.roleIds.length && link.roleIds.every((id) => draft.roleIds.includes(id))

  async function change(next: boolean) {
    setFailure('')
    if (next) { setAdding(true); return }
    if (!link) { setAdding(false); setDraft(NONE); return }
    setSending(true)
    try {
      await unassign(person.id, church.id)
      setDraft(NONE)
    } catch { setFailure('No se pudo quitar de la iglesia. Inténtalo de nuevo.') }
    setSending(false)
  }
  async function save() {
    setSending(true)
    setFailure('')
    try {
      await assign(person.id, church.id, draft)
      setAdding(false)
    } catch (caught) {
      setFailure(caught instanceof ApiError && caught.code === 'In use'
        ? 'Sigue como habitual o en una rotación de un rol: quítala primero de ahí, en Participaciones de esa iglesia, y luego sácala del grupo de alabanza.'
        : 'No se pudo guardar. Inténtalo de nuevo.')
    }
    setSending(false)
  }

  return (
    <section aria-label={`Iglesia ${church.name}`} className="grid gap-3 rounded-lg border border-line p-3">
      <Switch checked={shown} disabled={sending} onCheckedChange={(next) => void change(next)} label={`En ${church.name}`} />
      {shown && (
        <>
          <PersonRoles value={draft} showPreach={church.usesPreaching} disabled={sending}
            onChange={(next) => setDraft({ ...next, roleIds: next.canPlay ? draft.roleIds : [] })} />
          {draft.canPlay && church.roles.length > 0 && (
            <RoleChips roles={church.roles} chosen={draft.roleIds} label={`Roles en ${church.name}`} disabled={sending}
              onToggle={(id) => setDraft({ ...draft, roleIds: toggled(draft.roleIds, id) })} />
          )}
          {draft.canPlay && church.roles.length === 0 && <p className="m-0 text-[0.8125rem] text-text-3">Esta iglesia aún no tiene roles musicales.</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          {(!link || !same) && <Button variant="primary" block loading={sending} onClick={() => void save()}>{link ? 'Guardar cambios' : `Asignar a ${church.name}`}</Button>}
        </>
      )}
      {!shown && failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
    </section>
  )
}
