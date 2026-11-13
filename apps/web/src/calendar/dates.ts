// Las fechas del servicio son días de calendario (YYYY-MM-DD) sin hora ni zona propia.
export const ZONE = 'America/Mexico_City'

const atNoon = (date: string) => new Date(`${date}T12:00:00Z`)

/** Día de calendario actual en Ciudad de México (no el de UTC ni el del dispositivo). */
export function todayIn(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export const monthOf = (date: string) => date.slice(0, 7)

/** 0 = domingo: las semanas van de domingo a sábado. */
export const weekdayOf = (date: string) => atNoon(date).getUTCDay()

export function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, number - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

export function addDays(date: string, days: number): string {
  const moved = atNoon(date)
  moved.setUTCDate(moved.getUTCDate() + days)
  return moved.toISOString().slice(0, 10)
}

/** Casillas del mes en semanas completas de domingo a sábado; `null` rellena los huecos. */
export function monthCells(month: string): Array<string | null> {
  const first = `${month}-01`
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
  const cells: Array<string | null> = Array(weekdayOf(first)).fill(null)
  for (let day = 1; day <= days; day += 1) cells.push(`${month}-${String(day).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', ...options }).format(atNoon(date))

export function monthTitle(month: string): string {
  const text = format(`${month}-01`, { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «vie 13 nov». */
export const formatDay = (date: string) => format(date, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/[.,]/g, '').replace(' de ', ' ')

/** «viernes 13 de noviembre». */
export const formatLongDay = (date: string) => format(date, { weekday: 'long', day: 'numeric', month: 'long' })
