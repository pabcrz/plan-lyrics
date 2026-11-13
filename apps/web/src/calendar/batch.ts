import type { Church, Slot } from './model'

/** Entrada del período de un lote: una fecha (o una franja del domingo doble), libre o bloqueada. */
export type PeriodEntry = {
  date: string; slot: Slot
  lock: null | { kind: 'closed'; reason: string | null } | { kind: 'service'; title: string; director: string }
}
/** Lo que dejó el lote anterior: su lista de directores y quién quedó al final. */
export type Previous = { directorIds: string[]; lastDirectorId: string | null }
export type Period = { month: string; entries: PeriodEntry[]; previous: Previous | null }
/** Director por fecha y franja (`entryKey`); una fecha sin clave queda sin programar. */
export type Assignment = Record<string, string>

export const entryKey = (entry: Pick<PeriodEntry, 'date' | 'slot'>) => `${entry.date}/${entry.slot}`

export type Sequence = { repeat: boolean; previousLast: string | null }

/**
 * Director de cada fecha libre, en orden. La lista se repite cíclicamente (o solo cubre las primeras
 * fechas) y arranca después de quien cerró el lote anterior, si todavía está en la lista.
 */
export function assignDirectors(count: number, list: ReadonlyArray<string>, { repeat, previousLast }: Sequence): Array<string | null> {
  const last = previousLast === null ? -1 : list.indexOf(previousLast)
  const start = list.length > 0 && last > -1 ? (last + 1) % list.length : 0
  return Array.from({ length: count }, (_, index) => (list.length > 0 && (repeat || index < list.length) ? list[(start + index) % list.length]! : null))
}

/** Asigna solo a las fechas libres: las bloqueadas no entran en la secuencia. */
export function assignmentFor(entries: ReadonlyArray<PeriodEntry>, list: ReadonlyArray<string>, sequence: Sequence): Assignment {
  const free = entries.filter((entry) => !entry.lock)
  const directors = assignDirectors(free.length, list, sequence)
  const assignment: Assignment = {}
  free.forEach((entry, index) => {
    const director = directors[index]
    if (director) assignment[entryKey(entry)] = director
  })
  return assignment
}

/** Intercambia a quienes dirigen dos fechas; las demás no cambian y no se muta el original. */
export function swapDirectors(assignment: Assignment, first: string, second: string): Assignment {
  const a = assignment[first]
  const b = assignment[second]
  return a && b ? { ...assignment, [first]: b, [second]: a } : assignment
}

export const changeDirector = (assignment: Assignment, key: string, director: string): Assignment => ({ ...assignment, [key]: director })

/** La mañana va antes de las 12:00 y la tarde desde las 12:00 (mismas franjas que el servicio individual). */
export const sundayHoursOk = (morning: string, afternoon: string) => Boolean(morning) && Boolean(afternoon) && morning < '12:00' && afternoon >= '12:00'

/** Nombre y hora de un día elegido en el lote; la tarde solo existe en un domingo doble. */
export type DayConfig = { title: string; time: string; time2: string }

/** Precarga con el día habitual de la iglesia; un día no habitual empieza vacío y se completa a mano. */
export function defaultDayConfig(church: Pick<Church, 'days' | 'sundayDouble'>, weekday: number): DayConfig {
  const days = church.days.filter((day) => day.weekday === weekday)
  const find = (slot: Slot) => days.find((day) => day.slot === slot)
  const first = find('SINGLE') ?? find('MORNING') ?? days[0]
  const double = church.sundayDouble && weekday === 0
  return { title: first?.title ?? '', time: (double ? find('MORNING')?.time : first?.time) ?? '', time2: find('AFTERNOON')?.time ?? '' }
}
