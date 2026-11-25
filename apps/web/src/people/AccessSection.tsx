import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Notice, Segmented } from '../ui'
import { ROLE_HELP, ROLE_LABEL, ROLE_SHORT, ROLES, looksLikeEmail, memberFailure } from '../access/access-model'
import { useMemberActions, useMembers, type Role } from '../access/access-api'
import type { Church, PersonDetail } from '../calendar/model'

const roleOptions = ROLES.map((value) => ({ value, label: ROLE_SHORT[value] }))

/**
 * Acceso a la app desde la ficha. El correo de la invitación es el de Información personal: aquí no se vuelve a escribir, solo se muestra y,
 * si hay que cambiarlo, `onEditEmail` lleva al campo. Con `unsavedEmail`, el correo del formulario aún no se guardó y la invitación saldría al anterior.
 */
export function AccessSection({ church, person, unsavedEmail = false, onEditEmail }: { church: Church; person: PersonDetail; unsavedEmail?: boolean; onEditEmail: () => void }) {
  const members = useMembers(church.canConfigure)
  const { invite } = useMemberActions()
  const [role, setRole] = useState<Role>('MEMBER')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [sent, setSent] = useState('')
  const member = members.data?.members.find((item) => item.person?.id === person.id)
  const needsEmail = !person.hasAccount
  const address = person.email?.trim() ?? ''

  async function submit() {
    setSending(true)
    setFailure('')
    try {
      const result = await invite(person.id, role)
      setSent(result.invited ? `Invitación enviada a ${address}.` : 'Acceso otorgado.')
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
          {needsEmail ? (
            address ? (
              <div className="grid gap-1 rounded-md bg-surface-2 p-3">
                <p className="m-0 text-[0.8125rem] text-text-3">La invitación se envía al correo de su información personal</p>
                <p className="m-0 flex flex-wrap items-center gap-x-3 text-[0.9375rem]"><b className="[overflow-wrap:anywhere]">{address}</b>
                  <Button variant="quiet" onClick={onEditEmail}>Cambiar correo</Button></p>
              </div>
            ) : (
              <Notice tone="warn" icon="alert" title="Falta su correo">
                Para invitarla necesita un correo en su información personal: es el mismo con el que entrará a la app.
                <div className="mt-3"><Button variant="secondary" onClick={onEditEmail}>Agregar su correo</Button></div>
              </Notice>
            )
          ) : <p className="m-0 text-[0.9375rem] text-text-2">Ya tiene cuenta; falta darle acceso a esta iglesia.</p>}
          <Segmented<Role> label="Rol en esta iglesia" value={role} onChange={setRole} options={roleOptions} />
          <p className="m-0 text-[0.8125rem] text-text-3">{ROLE_HELP[role]}</p>
          {unsavedEmail && needsEmail && <p className="m-0 text-[0.8125rem] font-medium text-text-2">Guarda los cambios de su correo antes de invitarla: la invitación sale al correo guardado.</p>}
          {sent && <p role="status" className="m-0 text-[0.9375rem] font-medium text-pub-fg">{sent}</p>}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          <Button variant="primary" block loading={sending} disabled={needsEmail && (!looksLikeEmail(address) || unsavedEmail)} onClick={() => void submit()}>{needsEmail ? 'Invitar a la app' : 'Dar acceso'}</Button>
        </>
      )}
    </section>
  )
}
