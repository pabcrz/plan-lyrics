import { addDays, weekdayOf } from './dates'

export type Slot = 'SINGLE' | 'MORNING' | 'AFTERNOON'
export type Status = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
export type HabitualDay = { weekday: number; slot: Slot; time: string; title: string }
export type Church = {
  id: string; name: string; sundayDouble: boolean; usesPreaching: boolean; congregationShowsPreacher: boolean; canEdit: boolean; canConfigure: boolean
  timeZone: string; days: HabitualDay[]
}
export type ChurchSettings = Pick<Church, 'name' | 'sundayDouble' | 'usesPreaching' | 'days'>
export type Service = {
  id: string; title: string; date: string; slot: Slot; time: string | null; status: Status
  director: { id: string; name: string }
}

/** Persona del directorio de la iglesia activa (lista). */
export type Person = { id: string; name: string; hasAccount: boolean }
/** Ficha: datos personales generales y lo que el servidor sabe de ella en esta iglesia. */
export type PersonDetail = Person & { phone: string | null; sharedWithOtherChurches: boolean; upcomingServices: number }

/** Fecha «No hay culto»: no es un servicio; `reason` es un motivo breve opcional. */
export type ClosedDate = { date: string; reason: string | null }

const isDoubleDay = (church: Pick<Church, 'sundayDouble'>, date: string) => church.sundayDouble && weekdayOf(date) === 0

/** Franjas que aún se pueden crear en la fecha; vacío = fecha completa (la API lo vuelve a comprobar). */
export function freeSlots(church: Pick<Church, 'sundayDouble'>, date: string, services: ReadonlyArray<Service>): Slot[] {
  const taken = services.filter((service) => service.date === date)
  if (!isDoubleDay(church, date)) return taken.length === 0 ? ['SINGLE'] : []
  if (taken.length >= 2) return []
  return (['MORNING', 'AFTERNOON'] as const).filter((slot) => !taken.some((service) => service.slot === slot))
}

/** Hora y título habituales; un día no habitual es un servicio especial y no precarga nada. */
export function habitualFor(church: Pick<Church, 'days'>, date: string, slot: Slot) {
  return church.days.find((day) => day.weekday === weekdayOf(date) && day.slot === slot)
}

/** Próximas fechas habituales, empezando mañana: incluir hoy sigue pendiente en producto. */
export function upcomingDates(church: Pick<Church, 'days'>, today: string, count: number): string[] {
  const weekdays = new Set(church.days.map((day) => day.weekday))
  const dates: string[] = []
  for (let offset = 1; dates.length < count && offset <= 60 && weekdays.size > 0; offset += 1) {
    const date = addDays(today, offset)
    if (weekdays.has(weekdayOf(date))) dates.push(date)
  }
  return dates
}
