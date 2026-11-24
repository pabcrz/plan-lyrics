import { useNavigate } from 'react-router'
import { Button, Notice } from '../ui'
import { useAccess } from '../access/access-api'
import { CreateChurch, PageHeader, TopBar } from './ChurchGate'
import { useMyChurches, useSwitchChurch } from './api'

const ROLE = { ADMIN: 'Administrador', EDITOR: 'Editor', MEMBER: 'Integrante' } as const

/** Mis iglesias y, para el superadministrador, las demás (modo soporte) y el alta de iglesias. */
export function ChurchesPage() {
  const churches = useMyChurches()
  const owner = useAccess().data?.owner
  const switchTo = useSwitchChurch()
  const navigate = useNavigate()
  const open = (id: string) => { switchTo(id); void navigate('/') }
  const row = (item: { id: string; name: string; role: keyof typeof ROLE | null }) => (
    <li key={item.id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 last:border-b-0">
      <span className="min-w-0 flex-1 font-semibold">{item.name}<small className="block font-normal text-text-3">{item.role ? ROLE[item.role] : 'Sin membresía · modo soporte'}</small></span>
      <Button variant="secondary" aria-label={`Abrir ${item.name}`} onClick={() => open(item.id)}>Abrir</Button>
    </li>
  )
  const mine = churches.data?.filter((item) => item.role) ?? []
  const others = churches.data?.filter((item) => !item.role) ?? []
  return (
    <main className="mx-auto min-h-dvh max-w-[480px] lg:max-w-[720px]">
      <TopBar />
      <PageHeader title="Iglesias" />
      <div className="grid gap-5 p-4">
        {churches.isPending && <p role="status">Cargando tus iglesias…</p>}
        {churches.isError && <Notice tone="warn" icon="alert" role="alert" title="No se pudieron cargar tus iglesias">Inténtalo de nuevo en un momento.</Notice>}
        {mine.length > 0 && <section aria-label="Mis iglesias"><h2 className="m-0 mb-2 font-display text-lg font-bold">Mis iglesias</h2><ul className="m-0 list-none overflow-hidden rounded-lg border border-line p-0">{mine.map(row)}</ul></section>}
        {others.length > 0 && <section aria-label="Otras iglesias"><h2 className="m-0 mb-2 font-display text-lg font-bold">Otras iglesias</h2><ul className="m-0 list-none overflow-hidden rounded-lg border border-line p-0">{others.map(row)}</ul></section>}
        {owner && <section aria-label="Crear iglesia"><h2 className="m-0 mb-2 font-display text-lg font-bold">Crear iglesia</h2><CreateChurch offerMembership /></section>}
      </div>
    </main>
  )
}
