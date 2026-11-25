import type { Slot } from './model'

/** Primer nombre de una persona («Jairo León» → «Jairo»). */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

/**
 * El nombre de un servicio se genera solo, nunca se escribe: «Viernes 27 - Jairo». Lleva la franja cuando el domingo tiene dos
 * («Domingo 29 mañana - Jairo»), el nombre de quien dirige (o, si no hay dirección, de quien predica) y, sin ninguno, solo la fecha.
 */
export function serviceTitle({ date, slot = 'SINGLE', who }: { date: string; slot?: Slot; who?: string | null }): string {
  const day = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  const label = day.charAt(0).toUpperCase() + day.slice(1)
  const part = slot === 'MORNING' ? ' mañana' : slot === 'AFTERNOON' ? ' tarde' : ''
  const name = who ? firstName(who) : ''
  return `${label}${part}${name ? ` - ${name}` : ''}`
}
