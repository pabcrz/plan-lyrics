import { addDays, formatDay, monthTitle } from '../calendar/dates'

export type Version = 'PRAISE' | 'PREACHING' | 'FULL' | 'CONGREGATION'
export type Blocks = { keys: boolean; notes: boolean; people: boolean }
export type LinkStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED'
export type Scope = { kind: 'service'; serviceId: string; date: string } | { kind: 'range'; from: string; to: string }
/** Enlace del ministerio tal como lo ve quien los gestiona; `path` solo existe mientras el enlace funciona. */
export type ShareLink = {
  id: string; version: Version; scope: Scope; blocks: Blocks; status: LinkStatus; activeUntil: string
  reactivated: boolean; canReactivate: boolean; createdAt: string; path: string | null
}
export type NewLink = { version: Version; scope: { kind: 'service'; serviceId: string } | { kind: 'range'; from: string; to: string }; blocks: Blocks }

/** Cuántos días dura un enlace después de su último servicio; la API es quien decide, esto solo lo anticipa. */
export const LINK_DAYS = 30

export const versionLabel: Record<Version, string> = { PRAISE: 'Alabanza', PREACHING: 'Predicación', FULL: 'Servicio completo', CONGREGATION: 'Congregantes' }
export const versionHelp: Record<Version, string> = {
  PRAISE: 'Fechas, quién dirige y setlists.',
  PREACHING: 'Fechas, predicador, tema, citas y notas.',
  FULL: 'Ambas, con horario y orden de los cantos.',
  CONGREGATION: 'El setlist de la alabanza, sin directores ni equipos.',
}

/** «3 dic 2026». */
export function formatFull(date: string) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`)).replace(/[.,]/g, '').replace(' de ', ' ')
}

const lastDayOf = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()

/** Último día de un mes `YYYY-MM`, como `YYYY-MM-DD`. */
export const lastDateOf = (month: string) => `${month}-${String(lastDayOf(month)).padStart(2, '0')}`

/** Un mes completo se nombra por el mes; cualquier otro rango, por sus dos fechas. */
export function scopeLabel(scope: Scope): string {
  if (scope.kind === 'service') return formatDay(scope.date)
  const month = scope.from.slice(0, 7)
  if (scope.from === `${month}-01` && scope.to === `${month}-${String(lastDayOf(month)).padStart(2, '0')}`) return monthTitle(month)
  return `${formatDay(scope.from)} a ${formatDay(scope.to)}`
}

export function expiryNote(link: Pick<ShareLink, 'status' | 'activeUntil'>): string {
  if (link.status === 'ACTIVE') return `Activo hasta ${formatFull(link.activeUntil)}`
  if (link.status === 'REVOKED') return 'Revocado a mano'
  // El último día válido es `activeUntil`: venció al día siguiente.
  return `Venció el ${formatFull(addDays(link.activeUntil, 1))}`
}

type Dated = { id: string; date: string; status: string }

/**
 * Lo que abarcaría un enlace nuevo, para avisarlo antes de crearlo: cuántos servicios (sin los cancelados) y hasta
 * cuándo estaría activo. Es una estimación; la API vuelve a calcularlo.
 */
export function estimate(services: ReadonlyArray<Dated>, scope: NewLink['scope']): { count: number; activeUntil: string } | null {
  const inScope = services.filter((service) => service.status !== 'CANCELLED' && (scope.kind === 'service'
    ? service.id === scope.serviceId
    : service.date >= scope.from && service.date <= scope.to))
  if (inScope.length === 0) return null
  const last = inScope.reduce((latest, service) => (service.date > latest ? service.date : latest), '')
  return { count: inScope.length, activeUntil: addDays(last, LINK_DAYS) }
}

/** Meses (`YYYY-MM`) que toca un rango, con un tope para no pedir años enteros. */
export function monthsBetween(from: string, to: string, cap = 13): string[] {
  const valid = /^\d{4}-\d{2}-\d{2}$/
  if (!valid.test(from) || !valid.test(to) || from > to) return []
  const months: string[] = []
  let [year, month] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))]
  const end = to.slice(0, 7)
  while (months.length < cap) {
    const current = `${year}-${String(month).padStart(2, '0')}`
    months.push(current)
    if (current >= end) break
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months
}

/** La dirección completa se arma con el origen de esta página: la API solo entrega la ruta. */
export const absoluteUrl = (origin: string, path: string) => `${origin}${path}`
