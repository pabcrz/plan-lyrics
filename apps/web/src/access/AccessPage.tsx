import { useState } from 'react'
import { Avatar, Button, Icon, Notice, Segmented, Sheet, Toast } from '../ui'
import { ChurchGate, PageHeader, TopBar } from '../calendar/ChurchGate'
import type { Church } from '../calendar/model'
import { useMemberActions, useMembers, type Candidate, type Member, type Role } from './access-api'
import { memberFailure, ROLES, ROLE_HELP, ROLE_LABEL, ROLE_SHORT } from './access-model'

const chip = 'rounded-full border border-line-strong bg-surface-2 px-2.5 text-[0.8125rem] font-medium text-text-2'
const nameOf = (member: Member) => member.person?.name ?? 'Cuenta sin persona vinculada'

/** «Accesos»: quién entra a la iglesia activa y con qué rol. La iglesia la decide la sesión, nunca esta pantalla. */
export function AccessPage() {
  return <ChurchGate>{(church) => (church.canConfigure ? <Members church={church} /> : <ReadOnly church={church} />)}</ChurchGate>
}

function ReadOnly({ church }: { church: Church }) {
  return (
    <main className="mx-auto min-h-dvh max-w-[480px]">
      <TopBar name={church.name} />
      <PageHeader title="Accesos" back="/ajustes" backLabel="Volver a ajustes" />
      <div className="p-4">
        <Notice title="Solo administradores">Gestionar los accesos de {church.name} requiere ser administrador de la iglesia.</Notice>
      </div>
    </main>
  )
}

function Members({ church }: { church: Church }) {
  const list = useMembers(true)
  const [editing, setEditing] = useState<Member | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState('')

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar name={church.name} settings />
      <PageHeader title="Accesos" back="/ajustes" backLabel="Volver a ajustes" />
      <div className="grid flex-1 content-start gap-4 p-4">
        <Notice>Elige quién entra a {church.name} y con qué rol. Iniciar sesión no da acceso por sí solo; las cuentas las crea quien gestiona las cuentas.</Notice>
        {list.isPending && <p role="status">Cargando accesos…</p>}
        {list.isError && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar la lista de accesos">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void list.refetch()}>Reintentar</Button>
          </>
        )}
        {list.data && (
          <>
            <div className="flex items-center gap-3">
              <h2 className="m-0 flex-1 font-display text-lg font-bold">Miembros</h2>
              <Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" />Agregar miembro</Button>
            </div>
            <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
              {list.data.members.map((member) => (
                <li key={member.userId} className="border-b border-line last:border-b-0">
                  {member.protected ? (
                    <div className="flex min-h-14 items-center gap-3 px-3">
                      <Avatar name={nameOf(member)} />
                      <span className="flex-1"><b className="block text-[0.9375rem] font-semibold">{nameOf(member)}</b><small className="text-[0.8125rem] text-text-3">Cuenta protegida</small></span>
                      <span className={chip}>Superadministrador</span>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setEditing(member)}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2">
                      <Avatar name={nameOf(member)} />
                      <span className="flex flex-1 flex-wrap items-center gap-x-2">
                        <b className="text-[0.9375rem] font-semibold">{nameOf(member)}</b>
                        {member.self && <span className="text-[0.8125rem] text-text-3">Tú</span>}
                      </span>
                      <span className={chip}>{ROLE_LABEL[member.role]}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {toast !== '' && <div className="sticky bottom-0 px-4 pb-4"><Toast message={toast} onDismiss={() => setToast('')} /></div>}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Acceso de ${nameOf(editing)}` : 'Acceso'}>
        {editing && <RoleForm key={editing.userId} church={church} member={editing} onDone={(message) => { setEditing(null); setToast(message) }} />}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Agregar miembro">
        {list.data && <GrantForm church={church} candidates={list.data.candidates} onDone={(message) => { setAdding(false); setToast(message) }} />}
      </Sheet>
    </main>
  )
}

function RoleForm({ church, member, onDone }: { church: Church; member: Member; onDone: (message: string) => void }) {
  const { changeRole, remove } = useMemberActions()
  const [role, setRole] = useState<Role>(member.role)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')

  async function perform(action: () => Promise<unknown>, message: string) {
    setSending(true)
    setFailure('')
    try {
      await action()
      onDone(message)
    } catch (caught) {
      setConfirming(false)
      setFailure(memberFailure(caught))
      setSending(false)
    }
  }

  if (confirming) {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-[0.9375rem] text-text-2">
          {nameOf(member)} seguirá en el directorio de personas y conservará su cuenta, pero dejará de entrar a {church.name}.
        </p>
        <Button variant="danger" block loading={sending} onClick={() => void perform(() => remove(member.userId), `${nameOf(member)} ya no tiene acceso a ${church.name}`)}>Sí, quitar acceso</Button>
        <Button variant="quiet" block onClick={() => setConfirming(false)}>Cancelar</Button>
      </div>
    )
  }
  return (
    <div className="grid gap-3">
      <Segmented label={`Rol en ${church.name}`} options={ROLES.map((value) => ({ value, label: ROLE_SHORT[value] }))} value={role} onChange={setRole} />
      <p className="m-0 text-[0.9375rem] text-text-2">{ROLE_HELP[role]}</p>
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button variant="primary" block loading={sending} disabled={role === member.role}
        onClick={() => void perform(() => changeRole(member.userId, role), `Rol de ${nameOf(member)}: ${ROLE_LABEL[role]}`)}>Guardar rol</Button>
      <Button variant="danger" block onClick={() => setConfirming(true)}>Quitar de {church.name}</Button>
    </div>
  )
}

function GrantForm({ church, candidates, onDone }: { church: Church; candidates: Candidate[]; onDone: (message: string) => void }) {
  const { grant } = useMemberActions()
  const [chosen, setChosen] = useState<Candidate | null>(null)
  const [role, setRole] = useState<Role>('MEMBER')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')

  if (candidates.length === 0) {
    return (
      <Notice title="Nadie por agregar">
        Solo se da acceso a personas del directorio que ya tienen una cuenta vinculada. Crear cuentas, invitar y vincularlas lo hace el superadministrador o un gestor de cuentas.
      </Notice>
    )
  }
  async function submit() {
    if (!chosen) return
    setSending(true)
    setFailure('')
    try {
      await grant(chosen.personId, role)
      onDone(`${chosen.name} ahora tiene acceso a ${church.name}`)
    } catch (caught) {
      setFailure(memberFailure(caught))
      setSending(false)
    }
  }
  return (
    <div className="grid gap-3">
      <p className="m-0 text-[0.9375rem] text-text-2">Personas de {church.name} con cuenta y sin acceso todavía.</p>
      <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
        {candidates.map((candidate) => (
          <li key={candidate.personId} className="border-b border-line last:border-b-0">
            <button type="button" aria-pressed={chosen?.personId === candidate.personId} onClick={() => setChosen(candidate)}
              className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft">
              <Avatar name={candidate.name} />
              <b className="flex-1 text-[0.9375rem] font-semibold">{candidate.name}</b>
              {chosen?.personId === candidate.personId && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
      <Segmented label="Rol" options={ROLES.map((value) => ({ value, label: ROLE_SHORT[value] }))} value={role} onChange={setRole} />
      <p className="m-0 text-[0.9375rem] text-text-2">{ROLE_HELP[role]}</p>
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button variant="primary" block loading={sending} disabled={!chosen} onClick={() => void submit()}>Dar acceso</Button>
    </div>
  )
}
