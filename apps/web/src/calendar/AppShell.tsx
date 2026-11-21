import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Sheet, Tabbar, type IconName } from '../ui'
import { cx } from '../ui/cx'
import { TopBar } from './ChurchGate'
import type { Church } from './model'

export type Section = 'home' | 'songs' | 'people'
export const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: IconName; path: string }> = [
  { id: 'home', label: 'Inicio', icon: 'home', path: '/' },
  { id: 'songs', label: 'Canciones', icon: 'music', path: '/canciones' },
  { id: 'people', label: 'Personas', icon: 'users', path: '/personas' },
]
/** Secciones secundarias («Más»): el mismo menú para todos los roles; solo cambia lo que cada quien puede abrir. */
export const extras = (church: Pick<Church, 'canEdit' | 'canConfigure'>) => [
  ...(church.canEdit ? [{ label: 'Compartir', path: '/compartir' }] : []),
  ...(church.canConfigure ? [{ label: 'Participaciones', path: '/participaciones' }, { label: 'Ajustes', path: '/ajustes' }] : []),
]

/** Hoja «Nuevo»: servicio individual o lote mensual. */
export function NewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
 * Marco móvil de las secciones principales: barra superior con la iglesia y la cuenta, y barra inferior con las secciones y «Más»
 * (solo si hay algo dentro). En escritorio (≥1024 px, la frontera de `lg:`) la navegación es la barra lateral de `ShellLayout`.
 */
export function AppShell({ church, current, wide = false, focus = false, children }: {
  church: Church; current: Section; wide?: boolean; /** En móvil, pantalla completa sin barras (un formulario con su propio regreso). */ focus?: boolean; children: ReactNode
}) {
  const navigate = useNavigate()
  const [more, setMore] = useState(false)
  const extra = extras(church)
  return (
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
  )
}
