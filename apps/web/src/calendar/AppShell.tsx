import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { UserButton } from '@clerk/react'
import { Button, Icon, Sheet, Tabbar, type IconName } from '../ui'
import { cx } from '../ui/cx'
import { TopBar } from './ChurchGate'
import type { Church } from './model'

export type Section = 'home' | 'songs' | 'people'
const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: IconName; path: string }> = [
  { id: 'home', label: 'Inicio', icon: 'home', path: '/' },
  { id: 'songs', label: 'Canciones', icon: 'music', path: '/canciones' },
  { id: 'people', label: 'Personas', icon: 'users', path: '/personas' },
]
/** Secciones secundarias («Más»): el mismo menú para todos los roles; solo cambia lo que cada quien puede abrir. */
const extras = (church: Pick<Church, 'canEdit' | 'canConfigure'>) => [
  ...(church.canEdit ? [{ label: 'Compartir', path: '/compartir' }] : []),
  ...(church.canConfigure ? [{ label: 'Participaciones', path: '/participaciones' }, { label: 'Ajustes', path: '/ajustes' }] : []),
]

/** Hoja «Nuevo»: servicio individual o lote mensual. */
function NewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const option = (label: string, hint: string, path: string) => (
    <button type="button" onClick={() => void navigate(path)}
      className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left last:border-b-0 hover:bg-surface-2">
      <span className="font-semibold">{label}<small className="block font-normal text-text-3">{hint}</small></span>
      <Icon name="right" />
    </button>
  )
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo">
      <div className="overflow-hidden rounded-lg border border-line">
        {option('Servicio individual', 'Una fecha, con su director.', '/servicios/nuevo')}
        {option('Lote mensual', 'Varios servicios de un mes con una lista de directores.', '/servicios/lote')}
      </div>
    </Sheet>
  )
}

/** Acción principal en móvil: va en el encabezado de la sección (en escritorio vive en la barra lateral). Solo para quien edita. */
export function NewServiceButton({ church }: { church: Pick<Church, 'canEdit'> }) {
  const [open, setOpen] = useState(false)
  if (!church.canEdit) return null
  return (
    <span className="lg:hidden">
      <Button variant="primary" onClick={() => setOpen(true)}><Icon name="plus" />Nuevo</Button>
      <NewSheet open={open} onClose={() => setOpen(false)} />
    </span>
  )
}

/**
 * Marco de las secciones principales. Móvil: barra superior con la iglesia y la cuenta, y barra inferior con cuatro secciones y «Más»
 * (solo si hay algo dentro). Escritorio (≥1024 px, la frontera de `lg:`): barra lateral con las mismas secciones, «Nuevo servicio» y «Más».
 */
export function AppShell({ church, current, wide = false, focus = false, children }: {
  church: Church; current: Section; wide?: boolean; /** En móvil, pantalla completa sin barras (un formulario con su propio regreso). */ focus?: boolean; children: ReactNode
}) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [more, setMore] = useState(false)
  const extra = extras(church)
  const link = 'flex min-h-11 items-center gap-3 rounded-md px-3 font-medium no-underline hover:bg-surface-2 hover:text-text'
  return (
    <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface p-4 lg:flex">
        <div className="flex items-center gap-3 px-2 pb-4">
          <span className="grid size-8 place-items-center rounded-md bg-accent text-sm font-bold text-on-accent" aria-hidden="true">{church.name.charAt(0).toUpperCase()}</span>
          <span className="font-display text-lg font-bold">{church.name}</span>
        </div>
        {church.canEdit && <Button variant="primary" block onClick={() => setCreating(true)}><Icon name="plus" />Nuevo servicio</Button>}
        <nav aria-label="Secciones" className="grid gap-1 pt-3">
          {SECTIONS.map((section) => (
            <Link key={section.id} to={section.path} aria-current={section.id === current ? 'page' : undefined}
              className={cx(link, section.id === current ? 'bg-accent-soft text-accent-soft-text' : 'text-text-2')}>
              <Icon name={section.icon} />{section.label}
            </Link>
          ))}
          {extra.length > 0 && <p className="m-0 px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-text-3">Más</p>}
          {extra.map((item) => <Link key={item.path} to={item.path} className={cx(link, 'text-text-2')}>{item.label}</Link>)}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-line px-2 pt-3 text-sm text-text-2"><UserButton />Cuenta</div>
        <NewSheet open={creating} onClose={() => setCreating(false)} />
      </aside>
      <div className={cx('mx-auto flex min-h-dvh w-full min-w-0 flex-col max-w-[480px]', wide ? 'lg:max-w-[1040px]' : 'lg:max-w-[880px]')}>
        <div className="lg:hidden">{!focus && <TopBar name={church.name} />}</div>
        {children}
        <div className={cx('sticky bottom-0 lg:hidden', focus && 'hidden')}>
          <Tabbar label="Principal" current={current} items={[...SECTIONS, ...(extra.length > 0 ? [{ id: 'more', label: 'Más', icon: 'more' as const }] : [])]}
            onSelect={(id) => (id === 'more' ? setMore(true) : void navigate(SECTIONS.find((section) => section.id === id)?.path ?? '/'))} />
          <Sheet open={more} onClose={() => setMore(false)} title="Más">
            <div className="overflow-hidden rounded-lg border border-line">
              {extra.map((item) => (
                <button key={item.path} type="button" onClick={() => void navigate(item.path)}
                  className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 border-0 border-b border-line bg-transparent px-4 text-left font-semibold last:border-b-0 hover:bg-surface-2">
                  {item.label}<Icon name="right" />
                </button>
              ))}
            </div>
          </Sheet>
        </div>
      </div>
    </div>
  )
}
