import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button, Notice, Segmented, Switch, TextField } from '../ui'
import { ROLE_HELP, ROLE_SHORT, ROLES, looksLikeEmail, memberFailure } from '../access/access-model'
import { useMemberActions, type Role } from '../access/access-api'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import { ApiError, usePersonActions } from '../calendar/api'
import type { Church } from '../calendar/model'
import { PersonRoles, type RoleFlags } from '../calendar/PersonRoles'
import { PhoneField, phoneError, phoneStored } from './phone'

export function NewPersonPage() {
  return <ChurchGate>{(church) => (church.canEdit ? <Form church={church} /> : <ReadOnly church={church} />)}</ChurchGate>
}

function ReadOnly({ church }: { church: Church }) {
  return (
    <main className="mx-auto max-w-[480px] lg:max-w-[720px]">
      <TopBar name={church.name} />
      <PageHeader title="Persona nueva" back="/personas" backLabel="Volver a personas" />
      <div className="p-4"><Notice title="Solo lectura">Agregar personas requiere ser editor o administrador de tu iglesia.</Notice></div>
    </main>
  )
}

function Form({ church }: { church: Church }) {
  const navigate = useNavigate()
  const { create } = usePersonActions()
  const { invite } = useMemberActions()
  const [inviting, setInviting] = useState(false)
  const [role, setRole] = useState<Role>('MEMBER')
  const [created, setCreated] = useState<string | null>(null)
  const [name, setName] = useState((useLocation().state as { name?: string } | null)?.name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [jobs, setJobs] = useState<RoleFlags>({ canDirect: false, canPreach: false, canPlay: false })
  const [phoneProblem, setPhoneError] = useState('')
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || (inviting && !looksLikeEmail(email))) return
    const invalid = phoneError(phone)
    setPhoneError(invalid)
    if (invalid) return
    setSending(true)
    setExisting(null)
    setFailure('')
    try {
      const person = created ? { id: created } : await create({ name: name.trim(), ...(phone ? { phone: phoneStored(phone) as string } : {}), ...(email.trim() ? { email: email.trim() } : {}), ...jobs })
      if (inviting) {
        setCreated(person.id)
        try { await invite(person.id, role) } catch (caught) { setFailure(`${memberFailure(caught)} La persona ya quedó registrada: puedes reintentar o abrir su ficha.`); setSending(false); return }
      }
      void navigate(`/personas/${encodeURIComponent(person.id)}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.existing) setExisting(caught.existing)
      else setFailure(caught instanceof ApiError && caught.status === 400 ? 'Revisa el nombre, el teléfono y el correo.' : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para agregar personas.' : 'No se pudo agregar a la persona. Inténtalo de nuevo.')
      setSending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] lg:max-w-[720px] flex-col">
      <TopBar name={church.name} settings={church.canConfigure} />
      <PageHeader title="Persona nueva" back="/personas" backLabel="Volver a personas" />
      <form onSubmit={(event) => void submit(event)} noValidate className="grid flex-1 content-start gap-4 p-4">
        <div>
          <h2 className="m-0 font-display text-xl font-bold">Agregar a {church.name}</h2>
          <p className="m-0 mt-1 text-[0.9375rem] text-text-2">No necesita una cuenta de acceso para figurar en los servicios.</p>
        </div>
        <TextField label="Nombre completo" value={name} maxLength={120} autoComplete="off"
          onChange={(event) => { setName(event.target.value); setExisting(null) }}
          help="Con nombre y apellidos, por ejemplo «Juan Pérez Rodríguez». Búscala antes en la lista para no duplicarla."
          error={existing ? 'Ya hay una persona con ese nombre.' : undefined} />
        {existing && (
          <Notice tone="warn" icon="alert" role="alert" title={`Ya existe «${existing.name}»`}>
            Completa el nombre para distinguirla, o <Link className="font-semibold underline" to={`/personas/${encodeURIComponent(existing.id)}`}>abre su ficha</Link>.
          </Notice>
        )}
        <PhoneField value={phone} error={phoneProblem || undefined} onChange={(digits) => { setPhone(digits); setPhoneError('') }} />
        <TextField label={inviting ? 'Correo (con el que entrará a la app)' : 'Correo (opcional)'} type="email" inputMode="email" autoComplete="off" value={email} maxLength={254} onChange={(event) => setEmail(event.target.value)} />
        <PersonRoles value={jobs} onChange={setJobs} showPreach={church.usesPreaching} />
        <p className="m-0 text-[0.8125rem] text-text-3">El nombre, el teléfono y el correo son información general: se ven en todas las iglesias donde participe. Sus roles y turnos se configuran en cada iglesia.</p>
        {church.canConfigure && (
          <div className="grid gap-3 rounded-lg border border-line p-3">
            <Switch checked={inviting} onCheckedChange={setInviting} disabled={created !== null} label="Invitar a la app"
              description="Crea su cuenta, le envía la invitación al correo de arriba y le da su rol en esta iglesia." />
            {inviting && (
              <>
                {!looksLikeEmail(email) && <p className="m-0 text-[0.8125rem] text-text-3">Escribe su correo arriba para poder invitarla.</p>}
                <Segmented<Role> label="Rol en esta iglesia" value={role} onChange={setRole} options={ROLES.map((value) => ({ value, label: ROLE_SHORT[value] }))} />
                <p className="m-0 text-[0.8125rem] text-text-3">{ROLE_HELP[role]}</p>
              </>
            )}
          </div>
        )}
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        {created && <Link className="font-semibold underline" to={`/personas/${encodeURIComponent(created)}`}>Abrir su ficha</Link>}
        <Button type="submit" variant="primary" block loading={sending} disabled={!name.trim() || (inviting && !looksLikeEmail(email))}>{inviting ? 'Agregar e invitar' : 'Agregar persona'}</Button>
      </form>
    </main>
  )
}
