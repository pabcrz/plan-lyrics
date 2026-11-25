import { addDays, weekdayOf } from './dates'

export type Slot = 'SINGLE' | 'MORNING' | 'AFTERNOON'
export type Status = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'
export type HabitualDay = { weekday: number; slot: Slot; time: string; title: string }
export type Church = {
  id: string; name: string; sundayDouble: boolean; usesPreaching: boolean; usesRotation: boolean; congregationShowsPreacher: boolean; canEdit: boolean; canConfigure: boolean
  /** Regla estricta de repetición de canciones: cuántas semanas o cultos deben pasar antes de repetir una; `null` si está apagada. */
  songRepeat?: SongRepeat | null
  /** El superadministrador entró a una iglesia a la que no pertenece. */
  support?: boolean
  timeZone: string; days: HabitualDay[]
}
export type SongRepeat = { unit: 'WEEKS' | 'SERVICES'; amount: number }
export type ChurchSettings = Pick<Church, 'name' | 'sundayDouble' | 'usesPreaching' | 'usesRotation' | 'days'> & { songRepeat?: SongRepeat | null }
export type Service = {
  id: string; title: string; date: string; slot: Slot; time: string | null; status: Status
  /** Un servicio puede tener solo predicación: la dirección se asigna después. */
  director: { id: string; name: string } | null
  /** Canciones del setlist (sin contar los momentos). */
  songCount: number
  /** Quién predica y el tema, solo si la iglesia usa predicación (nunca las notas ni las citas). */
  preaching?: { topic: string; preacher: { id: string; name: string } | null } | null
}

/** Persona del directorio de la iglesia activa (lista). */
export type Person = {
  id: string; name: string; hasAccount: boolean; isYou: boolean
  /** Roles musicales que puede tener en esta iglesia (los fija un administrador). */
  roleIds: string[]
  /** Si los selectores de dirección y de predicación la ofrecen. */
  canDirect: boolean; canPreach: boolean
}
/** Ficha: datos personales generales y lo que el servidor sabe de ella en esta iglesia. */
export type PersonDetail = Person & { phone: string | null; email: string | null; sharedWithOtherChurches: boolean; upcomingServices: number }

/** Fecha «No hay culto»: no es un servicio; `reason` es un motivo breve opcional. */
export type ClosedDate = { date: string; reason: string | null }

const SLOT_RANK: Record<Slot, number> = { SINGLE: 0, MORNING: 1, AFTERNOON: 2 }

/** Orden de las franjas dentro de un día: la mañana va antes que la tarde (no el orden alfabético de sus nombres). */
export const compareSlots = (a: Slot, b: Slot) => SLOT_RANK[a] - SLOT_RANK[b]

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
