import type { Slot } from './model'

/**
 * El nombre de un servicio se genera solo con la fecha: «Viernes 27» (con dos servicios el domingo, «Domingo 29 mañana»). No lleva a nadie:
 * quién dirige, quién predica y el tema se muestran aparte y según quién mira (ver `service-summary.ts`), así que el nombre nunca queda viejo.
 */
export function serviceTitle({ date, slot = 'SINGLE' }: { date: string; slot?: Slot }): string {
  const day = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  const label = day.charAt(0).toUpperCase() + day.slice(1)
  return `${label}${slot === 'MORNING' ? ' mañana' : slot === 'AFTERNOON' ? ' tarde' : ''}`
}
