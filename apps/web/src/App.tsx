import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppearanceSheet, Button, Icon, type IconName } from './ui'
import { apiUrl } from './api-url'

async function checkApi() {
  const response = await fetch(apiUrl('/api/health'))
  if (!response.ok) throw new Error('La API no respondió correctamente')

  const body = await response.json()
  if (body.status !== 'ok' || body.service !== 'plan-lyrics-api') {
    throw new Error('Respuesta de API inesperada')
  }
  return body
}

const features: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
  { icon: 'calendar', title: 'Quién dirige cada domingo', text: 'Crea el mes completo de una vez. Los directores y los equipos se turnan solos, y puedes ajustar cualquier fecha.' },
  { icon: 'music', title: 'Setlist y letras en un solo lugar', text: 'Ordena los cantos arrastrándolos, anota el tono de cada servicio y guarda la letra por secciones.' },
  { icon: 'share', title: 'Un enlace, no veinte mensajes', text: 'Comparte el rol del equipo o las letras para la congregación. Cualquiera lo abre sin cuenta.' },
]

/** Una hoja de servicio de muestra: datos ficticios que enseñan lo que se arma aquí. */
function SampleSheet() {
  const songs = [['Hoy volvemos a casa', 'G'], ['Tu fidelidad no cambia', 'D'], ['Santo y digno', 'Em'], ['Con el corazón abierto', 'A']]
  return (
    <figure aria-label="Ejemplo de setlist" className="m-0 w-full max-w-sm rounded-lg border border-line bg-surface shadow-2">
      <div className="relative px-5 pt-5 pb-4">
        <div aria-hidden="true" className="pointer-events-none absolute top-5 right-0 h-[25px] w-[120px] bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_1px,transparent_1px_6px)] mask-[linear-gradient(to_right,transparent,#000)]" />
        <p className="m-0 text-sm font-semibold text-accent">Domingo · 10:00 a. m.</p>
        <p className="m-0 mt-1 font-display text-2xl leading-tight font-bold tracking-tight">Servicio dominical</p>
        <p className="m-0 mt-1 text-[0.9375rem] text-text-2">Dirige <b className="font-semibold text-text">Ana Ramírez</b></p>
      </div>
      <ol className="m-0 list-none border-t border-line p-0">
        {songs.map(([title, key], index) => (
          <li key={title} className="grid min-h-14 grid-cols-[2rem_1fr_auto] items-center gap-2 border-b border-line px-5 last:border-b-0">
            <span className="font-mono text-[0.8125rem] text-text-3 tabular-nums">{index + 1}</span>
            <span className="text-[0.9375rem] font-semibold">{title}</span>
            <span className="rounded-sm bg-accent-soft px-2 py-0.5 font-mono text-[0.8125rem] font-medium text-accent-soft-text">{key}</span>
          </li>
        ))}
      </ol>
      <figcaption className="px-5 py-3 text-[0.8125rem] text-text-3">Ejemplo con datos ficticios.</figcaption>
    </figure>
  )
}

/** Página principal: lo que ve quien aún no inició sesión. `authentication` es el botón de entrada (o el aviso de configuración). */
export function App({ authentication }: { authentication?: ReactNode }) {
  const api = useQuery({ queryKey: ['local-api-health'], queryFn: checkApi, retry: false })
  const [looking, setLooking] = useState(false)

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex min-h-16 max-w-5xl items-center gap-3 px-4">
        <span className="grid size-9 place-items-center rounded-md bg-accent font-display text-lg font-bold text-on-accent" aria-hidden="true">P</span>
        <span className="flex-1 font-display text-lg font-bold tracking-tight">Plan &amp; Lyrics</span>
        <Button variant="quiet" onClick={() => setLooking(true)}><Icon name="palette" />Apariencia</Button>
      </header>
      <AppearanceSheet open={looking} onClose={() => setLooking(false)} />

      <main>
        <section className="mx-auto grid max-w-5xl gap-10 px-4 pt-8 pb-14 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-16 md:pb-20">
          <div className="grid content-start gap-5">
            <h1 className="m-0 max-w-[14ch] font-display text-[2.75rem] leading-[1.02] font-extrabold tracking-tight md:text-6xl">El servicio del domingo, en una sola hoja.</h1>
            <p className="m-0 max-w-[46ch] text-lg text-text-2">Calendario, directores, setlists y letras para el equipo de alabanza de tu iglesia. Pensado para abrirse en el teléfono.</p>
            <div className="grid justify-items-start gap-2">{authentication}</div>
            <p className="m-0 text-sm text-text-3">El acceso es por invitación: entra con el correo con el que te invitaron.</p>
          </div>
          <div className="grid justify-items-center md:justify-items-end"><SampleSheet /></div>
        </section>

        <section aria-label="Qué puedes hacer" className="border-t border-line bg-surface">
          <ul className="mx-auto m-0 grid max-w-5xl list-none gap-8 p-0 px-4 py-12 md:grid-cols-3">
            {features.map((feature) => (
              <li key={feature.title} className="grid content-start gap-2">
                <span className="grid size-10 place-items-center rounded-md bg-accent-soft text-accent-soft-text"><Icon name={feature.icon} /></span>
                <h2 className="m-0 mt-1 font-display text-xl font-bold tracking-tight">{feature.title}</h2>
                <p className="m-0 max-w-[40ch] text-[0.9375rem] text-text-2">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-[0.8125rem] text-text-3">
        <p role="status" className="m-0">{api.isPending ? 'Comprobando API…' : api.isError ? 'API no disponible' : 'API disponible'}</p>
      </footer>
    </div>
  )
}
