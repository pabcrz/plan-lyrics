import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Sheet, Tabbar, type IconName } from '../ui'
import { cx } from '../ui/cx'
import { TopBar } from './ChurchGate'
import type { Church } from './model'

export type Section = 'home' | 'songs' | 'preaching' | 'people'
type SectionItem = { id: Section; label: string; icon: IconName; path: string }
const BASE: ReadonlyArray<SectionItem> = [
  { id: 'home', label: 'Inicio', icon: 'home', path: '/' },
  { id: 'songs', label: 'Canciones', icon: 'music', path: '/canciones' },
  { id: 'people', label: 'Personas', icon: 'users', path: '/personas' },
]
/** Las secciones del menú; «Predicaciones» solo existe si la iglesia usa predicación. */
export const sections = (church: Pick<Church, 'usesPreaching'>): ReadonlyArray<SectionItem> =>
  church.usesPreaching ? [BASE[0]!, BASE[1]!, { id: 'preaching', label: 'Predicaciones', icon: 'mic', path: '/predicaciones' }, BASE[2]!] : BASE
/** Secciones secundarias («Más»): el mismo menú para todos los roles; solo cambia lo que cada quien puede abrir. */
export const extras = (church: Pick<Church, 'canEdit' | 'canConfigure'>) => [
  ...(church.canEdit ? [{ label: 'Compartir', path: '/compartir' }] : []),
  ...(church.canConfigure ? [{ label: 'Participaciones', path: '/participaciones' }, { label: 'Ajustes', path: '/ajustes' }] : []),
]

/** Hoja «Nuevo»: servicio individual o lote mensual. */
export function NewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const option = (label: string, hint: string, path: string) => (
    <button type="button" onClick={() => { onClose(); void navigate(path) }}
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

/**
 * Marco móvil de las secciones principales: barra superior con la iglesia y la cuenta, y barra inferior con las secciones y «Más»
 * (solo si hay algo dentro). En escritorio (≥1024 px, la frontera de `lg:`) la navegación es la barra lateral de `ShellLayout`.
 */
export function AppShell({ church, current, wide = false, focus = false, action, children }: {
  church: Church; current: Section; wide?: boolean; /** En móvil, pantalla completa sin barras (un formulario con su propio regreso). */ focus?: boolean
  /** Acción principal de la sección en móvil: un botón flotante sobre la barra inferior (en escritorio vive en la pantalla o en la barra lateral). */
  action?: { label: string; onAction: () => void }; children: ReactNode
}) {
  const navigate = useNavigate()
  const [more, setMore] = useState(false)
  const extra = extras(church)
  return (
    <div className={cx('mx-auto flex min-h-dvh w-full min-w-0 flex-col max-w-[480px]', wide ? 'lg:max-w-[1040px]' : 'lg:max-w-[880px]')}>
      <div className="lg:hidden">{!focus && <TopBar name={church.name} />}</div>
      {children}
      <div className={cx('sticky bottom-0 lg:hidden', focus && 'hidden')}>
        {action && (
          <Button variant="primary" icon aria-label={action.label} onClick={action.onAction} className="absolute right-4 bottom-[calc(100%+1rem)] z-10 h-14! w-14! rounded-full! shadow-2">
            <Icon name="plus" />
          </Button>
        )}
        <Tabbar label="Principal" current={current} items={[...sections(church), ...(extra.length > 0 ? [{ id: 'more', label: 'Más', icon: 'more' as const }] : [])]}
          onSelect={(id) => (id === 'more' ? setMore(true) : void navigate(sections(church).find((section) => section.id === id)?.path ?? '/'))} />
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
