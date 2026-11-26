import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { UserButton } from '@clerk/react'
import { Button, Icon } from '../ui'
import { cx } from '../ui/cx'
import { NewSheet, extras, sections, type Section } from './AppShell'
import { useChurch } from './api'
import { InstallBar } from '../InstallBar'
import { StatusBars } from '../StatusBars'
import { ChurchName } from './ChurchGate'
import { ChurchAccentSync, ChurchAppearanceSheet, ChurchBadge } from './church-identity'
import { clearActiveChurch } from './active-church'

/** Sección del menú a la que pertenece una ruta; las pantallas de crear servicio cuelgan de Inicio y las de configuración, de «Más». */
const sectionOf = (pathname: string): Section | null =>
  pathname === '/' || pathname.startsWith('/servicios') ? 'home'
    : pathname.startsWith('/canciones') ? 'songs'
      : pathname.startsWith('/predicaciones') ? 'preaching'
        : pathname.startsWith('/personas') ? 'people' : null
const SETTINGS = ['/ajustes', '/accesos', '/cuentas', '/todas-las-personas']

/**
 * Marco común de todas las pantallas de la aplicación en escritorio (≥1024 px, la frontera de `lg:`): la barra lateral con las secciones,
 * «Nuevo servicio» y «Más» está en cada pantalla, también en las secundarias. Móvil no cambia: cada pantalla pone sus propias barras.
 * Sin iglesia cargada (o con error) no hay barra lateral y cada pantalla explica qué pasa.
 */
export function ShellLayout() {
  const church = useChurch().data
  const { pathname } = useLocation()
  const [creating, setCreating] = useState(false)
  const [looking, setLooking] = useState(false)
  const navigate = useNavigate()
  const client = useQueryClient()
  function leaveSupport() {
    clearActiveChurch()
    void client.resetQueries({ predicate: (query) => query.queryKey[0] !== 'my-churches' })
    void navigate('/iglesias')
  }
  const current = sectionOf(pathname)
  const extra = church ? extras(church) : []
  const link = 'flex min-h-11 items-center gap-3 rounded-md px-3 font-medium no-underline hover:bg-surface-2 hover:text-text'
  const item = (active: boolean) => cx(link, active ? 'bg-accent-soft text-accent-soft-text' : 'text-text-2')
  return (
    <>
    <ChurchAccentSync />
    <StatusBars />
    <InstallBar />
    {church?.support && (
      <div role="status" className="flex min-h-11 items-center gap-3 bg-accent-soft px-4 text-sm text-accent-soft-text">
        <span className="min-w-0 flex-1 truncate font-semibold">Modo soporte · {church.name}</span>
        <Button variant="quiet" onClick={leaveSupport}>Salir</Button>
      </div>
    )}
    <div className={cx('group/app', church && 'lg:grid lg:grid-cols-[248px_minmax(0,1fr)]')} data-frame={church ? '' : undefined}>
      {church && (
        <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface p-4 lg:flex">
          <div className="flex items-center gap-3 px-2 pb-4">
            <ChurchBadge name={church.name} />
            <ChurchName name={church.name} className="font-display text-lg font-bold" />
          </div>
          {church.canEdit && <Button variant="primary" block onClick={() => setCreating(true)}><Icon name="plus" />Nuevo servicio</Button>}
          <nav aria-label="Secciones" className="grid gap-1 pt-3">
            {(church ? sections(church) : []).map((section) => (
              <Link key={section.id} to={section.path} aria-current={section.id === current ? 'page' : undefined} className={item(section.id === current)}>
                <Icon name={section.icon} />{section.label}
              </Link>
            ))}
            {extra.length > 0 && <p className="m-0 px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-text-3">Más</p>}
            {extra.map((entry) => {
              const active = entry.path === '/ajustes' ? SETTINGS.includes(pathname) : pathname === entry.path || pathname.startsWith(`${entry.path}/`)
              return <Link key={entry.path} to={entry.path} aria-current={active ? 'page' : undefined} className={item(active)}>{entry.label}</Link>
            })}
          </nav>
          <div className="mt-auto flex items-center gap-3 border-t border-line px-2 pt-3 text-sm text-text-2">
            <UserButton /><span className="flex-1">Cuenta</span>
            <Button variant="quiet" icon aria-label="Apariencia" title="Apariencia" onClick={() => setLooking(true)}><Icon name="palette" /></Button>
          </div>
          <ChurchAppearanceSheet open={looking} onClose={() => setLooking(false)} />
          <NewSheet open={creating} onClose={() => setCreating(false)} />
        </aside>
      )}
      <div className="min-w-0"><Outlet /></div>
    </div>
    </>
  )
}
