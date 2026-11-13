import { useState, type ReactNode } from 'react'
import {
  Button, Notice, PersonPicker, Segmented, Sheet, StatusChip, Switch, Tabbar, TextField, TimeWheel, Toast,
  format12h, type Person, type ServiceStatus, type Time12,
} from '.'

// Datos ficticios solo para la página de referencia.
const PEOPLE: Person[] = [
  { id: '1', name: 'Ricardo Mena', detail: 'Guitarra' },
  { id: '2', name: 'Ricardo Soto', detail: 'Piano' },
  { id: '3', name: 'Marta Díaz', detail: 'Voces' },
]
const STATUSES: ServiceStatus[] = ['draft', 'published', 'completed', 'cancelled']

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">{children}</div>
    </section>
  )
}

/** Página interna de desarrollo (`/dev/ui`): muestra el sistema visual con datos ficticios. */
export default function Reference() {
  const [accent, setAccent] = useState('salvia')
  const [mode, setMode] = useState('light')
  const [query, setQuery] = useState('Ric')
  const [picked, setPicked] = useState<Person | null>(null)
  const [on, setOn] = useState(true)
  const [seg, setSeg] = useState('solo')
  const [tab, setTab] = useState('calendar')
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState(false)
  const [time, setTime] = useState<Time12>({ hour: 7, minute: 30, meridiem: 'pm' })

  function apply(attr: 'accent' | 'mode', value: string) {
    document.documentElement.dataset[attr] = value
    if (attr === 'accent') setAccent(value)
    else setMode(value)
  }
  const matches = PEOPLE.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <main className="mx-auto grid max-w-md gap-6 px-4 pt-6 pb-28">
      <h1 className="font-display text-3xl leading-none font-bold tracking-tight">Sistema visual</h1>
      <div className="grid gap-2">
        <Segmented label="Acento" value={accent} onChange={(v) => apply('accent', v)}
          options={[{ value: 'salvia', label: 'Salvia' }, { value: 'indigo', label: 'Índigo' }, { value: 'ocre', label: 'Ocre' }]} />
        <Segmented label="Modo" value={mode} onChange={(v) => apply('mode', v)}
          options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }]} />
      </div>

      <Block title="Botones">
        <Button block>Preparar setlist</Button>
        <Button block variant="secondary">Editar servicio</Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="quiet">Discreto</Button>
          <Button variant="danger">Cancelar servicio</Button>
          <Button variant="secondary" icon aria-label="Más acciones">⋯</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button loading>Creando…</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
      </Block>

      <Block title="Campos">
        <TextField label="Título del servicio" defaultValue="Servicio de oración" help="Visible para integrantes cuando se publique." />
        <TextField label="Hora de inicio (opcional)" defaultValue="25:70" error="Escribe una hora válida, por ejemplo 19:30." />
      </Block>

      <Block title="Estado del servicio">
        <div className="flex flex-wrap gap-2">{STATUSES.map((s) => <StatusChip key={s} status={s} />)}</div>
      </Block>

      <Block title="Avisos">
        <Notice title="Se crearán 3 de 4 servicios">El viernes 27 queda sin programar.</Notice>
        <Notice tone="warn" icon="alert" title="Intercambio">Vie 6 pasa a Pedro · Vie 13 pasa a Luis.</Notice>
      </Block>

      <Block title="Selector de persona">
        <PersonPicker label="Director" query={query} onQueryChange={(q) => { setQuery(q); setPicked(null) }}
          people={matches} onSelect={(p) => { setPicked(p); setQuery(p.name) }} onAddNew={(n) => setQuery(n)} />
        {picked && <p className="m-0 text-sm text-text-2">Elegido: {picked.name}</p>}
      </Block>

      <Block title="Interruptor y segmentado">
        <Switch checked={on} onCheckedChange={setOn} label="Dos servicios los domingos" description="Uno por la mañana y otro por la tarde." />
        <Segmented label="Tipo de cambio" value={seg} onChange={setSeg}
          options={[{ value: 'solo', label: 'Solo este servicio' }, { value: 'swap', label: 'Intercambiar turnos' }]} />
      </Block>

      <Block title="Hora">
        <p className="m-0 text-sm text-text-2">Elegida: {format12h(time)}</p>
        <TimeWheel value={time} onChange={setTime} />
      </Block>

      <Block title="Hoja inferior y aviso breve">
        <Button variant="secondary" onClick={() => setSheet(true)}>Abrir hoja</Button>
        <Button variant="secondary" onClick={() => setToast(true)}>Mostrar aviso</Button>
        {toast && <Toast message="Se crearon 3 servicios" onUndo={() => undefined} onDismiss={() => setToast(false)} />}
      </Block>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Nuevo">
        <div className="grid gap-2">
          <Button variant="secondary" block>Servicio individual</Button>
          <Button variant="secondary" block onClick={() => setSheet(false)}>Cerrar</Button>
        </div>
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md">
        <Tabbar label="Principal" current={tab} onSelect={setTab}
          items={[{ id: 'calendar', label: 'Calendario', icon: 'calendar' }, { id: 'people', label: 'Personas', icon: 'users' }]}
          action={{ label: 'Nuevo', icon: 'plus', onAction: () => setSheet(true) }} />
      </div>
    </main>
  )
}
