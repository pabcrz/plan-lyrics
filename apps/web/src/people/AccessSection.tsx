import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Notice, Segmented, TextField } from '../ui'
import { ROLE_HELP, ROLE_LABEL, ROLE_SHORT, ROLES, looksLikeEmail, memberFailure } from '../access/access-model'
import { useMemberActions, useMembers, type Role } from '../access/access-api'
import type { Church, PersonDetail } from '../calendar/model'

const roleOptions = ROLES.map((value) => ({ value, label: ROLE_SHORT[value] }))

/** Acceso a la app desde la ficha: invitar (crea la cuenta, la vincula y da el rol) o dar el rol si ya tiene cuenta. Solo lo gestiona quien administra. */
export function AccessSection({ church, person }: { church: Church; person: PersonDetail }) {
  const members = useMembers(church.canConfigure)
  const { invite } = useMemberActions()
  const [role, setRole] = useState<Role>('MEMBER')
  const [email, setEmail] = useState(person.email ?? '')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [sent, setSent] = useState('')
  const member = members.data?.members.find((item) => item.person?.id === person.id)
  const needsEmail = !person.hasAccount

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      const result = await invite(person.id, role, needsEmail && email.trim() !== (person.email ?? '') ? email.trim() : undefined)
      setSent(result.invited ? `Invitación enviada a ${email.trim() || person.email}.` : 'Acceso otorgado.')
    } catch (caught) {
      setFailure(memberFailure(caught))
    }
    setSending(false)
  }

  return (
    <section className="grid gap-3" aria-labelledby="account">
      <h2 id="account" className="m-0 font-display text-lg font-bold">Acceso a la app</h2>
      {!church.canConfigure ? (
        <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Estado: </span><b>{person.hasAccount ? 'Con cuenta' : 'Sin cuenta'}</b>. Quien administra {church.name} da el acceso.</p>
      ) : member ? (
        <>
          <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Tiene acceso: </span><b>{ROLE_LABEL[member.role]}</b></p>
          <Link to="/accesos" className="font-semibold">Cambiar el rol o quitar el acceso</Link>
        </>
      ) : (
        <>
          <p className="m-0 text-[0.9375rem] text-text-2">{needsEmail ? 'Todavía no tiene cuenta. Al invitarla se crea su cuenta, se vincula a esta persona y recibe el rol que elijas.' : 'Ya tiene cuenta; falta darle acceso a esta iglesia.'}</p>
          {needsEmail && <TextField label="Correo para la invitación" type="email" inputMode="email" autoComplete="off" value={email} maxLength={254} onChange={(event) => { setEmail(event.target.value); setSent('') }} />}
          <Segmented<Role> label="Rol en esta iglesia" value={role} onChange={setRole} options={roleOptions} />
          <p className="m-0 text-[0.8125rem] text-text-3">{ROLE_HELP[role]}</p>
          {sent && <p role="status" className="m-0 text-[0.9375rem] font-medium text-pub-fg">{sent}</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          <Button variant="primary" block loading={sending} disabled={needsEmail && !looksLikeEmail(email)} onClick={() => void submit()}>{needsEmail ? 'Invitar a la app' : 'Dar acceso'}</Button>
        </>
      )}
    </section>
  )
}
