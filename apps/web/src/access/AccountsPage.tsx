import { useState, type FormEvent } from 'react'
import { Avatar, Button, Notice, Sheet, Switch, TextField, Toast, fold, inputClass } from '../ui'
import { PageHeader, TopBar } from '../calendar/ChurchGate'
import { useAccess, useAccountActions, useAccounts, type Account, type Accounts } from './access-api'
import { accountFailure, looksLikeEmail } from './access-model'

const chip = 'rounded-full border border-line-strong bg-surface-2 px-2.5 text-[0.8125rem] font-medium text-text-2'
const labelOf = (account: Account) => account.person?.name ?? account.email ?? 'Cuenta sin correo'

/** «Cuentas»: invitar, vincular personas y capacidades globales. Solo el superadministrador y los gestores de cuentas. */
export function AccountsPage() {
  const access = useAccess()
  const allowed = Boolean(access.data?.owner || access.data?.accountManager)
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <TopBar />
      <PageHeader title="Cuentas" />
      <div className="grid flex-1 content-start gap-5 p-4">
        {access.isPending && <p role="status">Comprobando tu acceso…</p>}
        {access.isError && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo comprobar tu acceso">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void access.refetch()}>Reintentar</Button>
          </>
        )}
        {access.data && !allowed && <Notice title="Sin permiso para gestionar cuentas">Crear cuentas, invitar y vincular personas lo hacen el superadministrador y los gestores de cuentas que él designa.</Notice>}
        {allowed && <Manager />}
      </div>
    </main>
  )
}

function Manager() {
  const accounts = useAccounts(true)
  const [toast, setToast] = useState('')
  const [open, setOpen] = useState<Account | null>(null)

  return (
    <>
      <Invite onSent={(email) => setToast(`Invitación enviada a ${email}`)} />
      <section className="grid gap-3" aria-labelledby="accounts-list">
        <h2 id="accounts-list" className="m-0 font-display text-lg font-bold">Cuentas</h2>
        {accounts.isPending && <p role="status">Cargando cuentas…</p>}
        {accounts.isError && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar las cuentas">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void accounts.refetch()}>Reintentar</Button>
          </>
        )}
        {accounts.data && accounts.data.accounts.length === 0 && <Notice title="Aún no hay cuentas">Invita a la primera con su correo.</Notice>}
        {accounts.data && accounts.data.accounts.length > 0 && (
          <ul className="m-0 list-none overflow-hidden rounded-md border border-line bg-surface p-0">
            {accounts.data.accounts.map((account) => {
              const body = (
                <>
                  <Avatar name={labelOf(account)} />
                  <span className="grid flex-1 gap-0.5">
                    <b className="text-[0.9375rem] font-semibold">{labelOf(account)}</b>
                    <small className="text-[0.8125rem] text-text-3">{account.person ? (account.email ?? 'Sin correo') : 'Sin persona vinculada'}</small>
                    {(account.owner || account.accountManager || account.libraryEditor) && (
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {account.owner && <span className={chip}>Superadministrador</span>}
                        {account.accountManager && <span className={chip}>Gestor de cuentas</span>}
                        {account.libraryEditor && <span className={chip}>Editor de biblioteca</span>}
                      </span>
                    )}
                  </span>
                </>
              )
              const protectedFromManager = account.owner && !accounts.data.viewer.owner
              return (
                <li key={account.id} className="border-b border-line last:border-b-0">
                  {protectedFromManager ? (
                    <div className="flex min-h-14 items-center gap-3 px-3 py-2">{body}</div>
                  ) : (
                    <button type="button" onClick={() => setOpen(account)}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 py-2 text-left hover:bg-surface-2">{body}</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {toast !== '' && <div className="sticky bottom-0"><Toast message={toast} onDismiss={() => setToast('')} /></div>}
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open ? `Cuenta de ${labelOf(open)}` : 'Cuenta'}>
        {open && accounts.data && (
          <AccountForm key={open.id} account={accounts.data.accounts.find((item) => item.id === open.id) ?? open} data={accounts.data}
            onDone={(message) => { setOpen(null); setToast(message) }} />
        )}
      </Sheet>
    </>
  )
}

function Invite({ onSent }: { onSent: (email: string) => void }) {
  const { invite } = useAccountActions()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setFailure('')
    if (!looksLikeEmail(email)) return setError('Escribe un correo válido.')
    setError('')
    setSending(true)
    try {
      await invite(email.trim())
      onSent(email.trim())
      setEmail('')
    } catch (caught) {
      setFailure(accountFailure(caught))
    }
    setSending(false)
  }
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-3" aria-label="Invitar a una persona">
      <h2 className="m-0 font-display text-lg font-bold">Invitar</h2>
      <TextField label="Correo electrónico" type="email" inputMode="email" autoComplete="off" maxLength={254} value={email} error={error || undefined}
        help="Se crea la cuenta y recibe la invitación por correo. No se registra nadie por su cuenta."
        onChange={(event) => { setEmail(event.target.value); setError('') }} />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button type="submit" variant="primary" block loading={sending}>Enviar invitación</Button>
    </form>
  )
}

function AccountForm({ account, data, onDone }: { account: Account; data: Accounts; onDone: (message: string) => void }) {
  const actions = useAccountActions()
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  const [saved, setSaved] = useState('')
  const [flags, setFlags] = useState({ accountManager: account.accountManager, libraryEditor: account.libraryEditor })
  const free = data.people.filter((person) => fold(person.name).includes(fold(query)))

  async function perform(action: () => Promise<unknown>, message?: string) {
    setSending(true)
    setFailure('')
    setSaved('')
    try {
      await action()
      if (message) onDone(message)
      return true
    } catch (caught) {
      setConfirming(false)
      setFailure(accountFailure(caught))
      return false
    } finally {
      setSending(false)
    }
  }
  async function toggle(key: 'accountManager' | 'libraryEditor', enabled: boolean) {
    const ok = await perform(() => (key === 'accountManager' ? actions.setAccountManager(account.id, enabled) : actions.setLibraryEditor(account.id, enabled)))
    if (ok) {
      setFlags((prev) => ({ ...prev, [key]: enabled }))
      setSaved('Cambio guardado')
    }
  }

  if (account.owner) {
    return <Notice title="Cuenta protegida">El superadministrador es único y conserva todo el acceso. Sus permisos no se cambian desde aquí.</Notice>
  }
  if (confirming && account.person) {
    return (
      <div className="grid gap-3">
        <p className="m-0 text-[0.9375rem] text-text-2">
          La cuenta dejará de representar a {account.person.name} en todas sus iglesias. Sus accesos a iglesias no cambian y la persona sigue en el directorio.
        </p>
        <Button variant="danger" block loading={sending} onClick={() => void perform(() => actions.unlink(account.id), `Cuenta desvinculada de ${account.person?.name ?? 'la persona'}`)}>Sí, desvincular</Button>
        <Button variant="quiet" block onClick={() => setConfirming(false)}>Cancelar</Button>
      </div>
    )
  }
  return (
    <div className="grid gap-5">
      <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Correo: </span><b>{account.email ?? 'Sin correo'}</b></p>

      <section className="grid gap-3" aria-labelledby="person-link">
        <h3 id="person-link" className="m-0 font-display text-base font-bold">Persona</h3>
        {account.person ? (
          <>
            <p className="m-0 text-[0.9375rem]"><span className="text-text-3">Vinculada a: </span><b>{account.person.name}</b></p>
            <Button variant="secondary" block onClick={() => setConfirming(true)}>Desvincular persona</Button>
          </>
        ) : (
          <>
            <p className="m-0 text-[0.9375rem] text-text-2">Vincula esta cuenta a la persona del directorio que la usa. Vincular no da acceso a ninguna iglesia.</p>
            {data.people.length === 0 ? <Notice>No hay personas sin cuenta para vincular.</Notice> : (
              <>
                <input type="search" autoComplete="off" aria-label="Buscar persona sin cuenta" placeholder="Buscar por nombre" value={query}
                  onChange={(event) => setQuery(event.target.value)} className={inputClass} />
                <ul className="m-0 max-h-56 list-none overflow-auto rounded-md border border-line bg-surface p-0">
                  {free.map((person) => (
                    <li key={person.id} className="border-b border-line last:border-b-0">
                      <button type="button" aria-pressed={chosen?.id === person.id} onClick={() => setChosen(person)}
                        className="flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft">
                        <Avatar name={person.name} /><b className="flex-1 text-[0.9375rem] font-semibold">{person.name}</b>
                      </button>
                    </li>
                  ))}
                </ul>
                <Button variant="primary" block loading={sending} disabled={!chosen}
                  onClick={() => chosen && void perform(() => actions.link(account.id, chosen.id), `Cuenta vinculada a ${chosen.name}`)}>Vincular persona</Button>
              </>
            )}
          </>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="capabilities">
        <h3 id="capabilities" className="m-0 font-display text-base font-bold">Capacidades globales</h3>
        {data.viewer.owner ? (
          <>
            <Switch checked={flags.accountManager} disabled={sending} onCheckedChange={(on) => void toggle('accountManager', on)} label="Gestor de cuentas"
              description="Crea cuentas, invita y vincula personas. No concede acceso a iglesias." />
            <Switch checked={flags.libraryEditor} disabled={sending} onCheckedChange={(on) => void toggle('libraryEditor', on)} label="Editor de biblioteca"
              description="Edita canciones, letras y acordes compartidos. No da acceso a ninguna iglesia." />
          </>
        ) : (
          <>
          <dl className="m-0 grid gap-1 text-[0.9375rem]">
            <div><dt className="text-[0.8125rem] text-text-3">Gestor de cuentas</dt><dd className="m-0">{flags.accountManager ? 'Sí' : 'No'}</dd></div>
            <div><dt className="text-[0.8125rem] text-text-3">Editor de biblioteca</dt><dd className="m-0">{flags.libraryEditor ? 'Sí' : 'No'}</dd></div>
          </dl>
          <p className="m-0 text-[0.8125rem] text-text-3">Solo el superadministrador cambia estas capacidades.</p>
          </>
        )}
        {saved && <p role="status" className="m-0 text-[0.8125rem] font-medium text-pub-fg">{saved}</p>}
      </section>
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
    </div>
  )
}
