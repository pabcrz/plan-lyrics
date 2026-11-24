import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { UserButton } from '@clerk/react'
import { useQueryClient } from '@tanstack/react-query'
import { AppearanceSheet, Button, Icon, Notice, Sheet, TextField } from '../ui'
import { AccountsLink } from '../access/AccessLinks'
import { useAccess } from '../access/access-api'
import { ApiError, useApiFetch, useChurch, useMyChurches, useSwitchChurch } from './api'
import type { Church } from './model'

/** Lista de iglesias de la cuenta; al elegir una pasa a ser la activa de este dispositivo. */
function ChurchList({ activeId, onPick }: { activeId?: string; onPick?: () => void }) {
  const churches = useMyChurches()
  const switchTo = useSwitchChurch()
  if (!churches.data) return <p role="status" className="m-0 text-text-3">{churches.isError ? 'No se pudo cargar tus iglesias.' : 'Cargando tus iglesias…'}</p>
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {churches.data.map((item) => (
        <button key={item.id} type="button" aria-current={item.id === activeId ? 'true' : undefined} onClick={() => { switchTo(item.id); onPick?.() }}
          className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left font-semibold last:border-b-0 hover:bg-surface-2">
          {item.name}{item.id === activeId && <Icon name="check" />}
        </button>
      ))}
    </div>
  )
}

/** Nombre de la iglesia activa; con varias iglesias es el botón que abre el cambio de iglesia. */
export function ChurchName({ name, className }: { name?: string; className: string }) {
  const churches = useMyChurches()
  const activeId = useChurch().data?.id
  const [open, setOpen] = useState(false)
  const label = name ?? 'Plan & Lyrics'
  if (!churches.data || churches.data.length < 2) return <span className={className}>{label}</span>
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`${label}. Cambiar de iglesia`} className={`${className} cursor-pointer border-0 bg-transparent p-0 text-left text-text`}>{label}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Cambiar de iglesia"><ChurchList activeId={activeId} onPick={() => setOpen(false)} /></Sheet>
    </>
  )
}

/** Encabezado común: iglesia activa y cuenta. */
export function TopBar({ name, settings, share }: { name?: string; settings?: boolean; share?: boolean }) {
  const navigate = useNavigate()
  const [looking, setLooking] = useState(false)
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-line px-4 lg:group-data-[frame]/app:hidden">
      <span className="grid size-8 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden="true">
        {name?.charAt(0).toUpperCase() ?? ''}
      </span>
      <ChurchName name={name} className="min-w-0 flex-1 truncate font-semibold" />
      {share && <Button variant="quiet" icon aria-label="Compartir" onClick={() => void navigate('/compartir')}><Icon name="share" /></Button>}
      {settings && <Button variant="quiet" icon aria-label="Ajustes" onClick={() => void navigate('/ajustes')}><Icon name="settings" /></Button>}
      <Button variant="quiet" icon aria-label="Apariencia" onClick={() => setLooking(true)}><Icon name="palette" /></Button>
      <UserButton />
      <AppearanceSheet open={looking} onClose={() => setLooking(false)} />
    </div>
  )
}

/** Encabezado de una pantalla secundaria; vuelve al inicio salvo que se indique otro destino. */
export function PageHeader({ title, back = '/', backLabel = 'Volver al inicio' }: { title: string; back?: string; backLabel?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-14 items-center gap-1 border-b border-line px-2">
      <Button variant="quiet" icon aria-label={backLabel} onClick={() => void navigate(back)}><Icon name="right" className="-scale-x-100" /></Button>
      <h1 className="m-0 font-display text-lg font-bold">{title}</h1>
    </div>
  )
}

/** Alta de la primera iglesia: solo la ofrece la pantalla vacía al superadministrador (la API lo vuelve a comprobar). */
function CreateChurch() {
  const api = useApiFetch()
  const client = useQueryClient()
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setFailure('')
    try {
      await api('/api/churches', { method: 'POST', body: { name: name.trim() } })
      await client.invalidateQueries({ queryKey: ['church'] })
    } catch {
      setFailure('No se pudo crear la iglesia. Inténtalo de nuevo.')
      setSending(false)
    }
  }
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
      <TextField label="Nombre de la iglesia" value={name} maxLength={120} autoComplete="off" onChange={(event) => setName(event.target.value)} />
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
      <Button type="submit" variant="primary" block loading={sending} disabled={!name.trim()}>Crear iglesia</Button>
    </form>
  )
}

/** Resuelve la iglesia activa (la decide el servidor) y muestra carga, vacío o error antes del contenido. */
export function ChurchGate({ children }: { children: (church: Church) => ReactNode }) {
  const church = useChurch()
  const access = useAccess()
  if (church.data) return <>{children(church.data)}</>
  const status = church.error instanceof ApiError ? church.error.status : 0
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] lg:max-w-[720px]">
      <TopBar />
      <div className="grid gap-4 p-4">
        {church.isPending && <p role="status">Cargando tu iglesia…</p>}
        {status === 404 && access.data?.owner && <Notice title="Aún no hay iglesias">Como superadministrador, crea la primera: serás su administrador.</Notice>}
        {status === 404 && access.data?.owner && <CreateChurch />}
        {status === 404 && !access.data?.owner && <Notice title="Sin iglesia asignada">Tu cuenta todavía no pertenece a ninguna iglesia. Pide acceso a quien la administra.</Notice>}
        {status === 404 && <AccountsLink />}
        {status === 409 && <Notice title="Elige una iglesia">Tu cuenta pertenece a más de una iglesia. Elige con cuál trabajar; puedes cambiarla después desde el nombre de la iglesia.</Notice>}
        {status === 409 && <ChurchList />}
        {church.isError && status !== 404 && status !== 409 && (
          <>
            <Notice tone="warn" icon="alert" role="alert" title="No se pudo cargar tu iglesia">Revisa tu conexión e inténtalo de nuevo.</Notice>
            <Button variant="secondary" onClick={() => void church.refetch()}>Reintentar</Button>
          </>
        )}
      </div>
    </main>
  )
}
