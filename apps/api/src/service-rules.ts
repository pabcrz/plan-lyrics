import { z } from 'zod'

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) }, { abort: true })

// The church is never part of the body: it is always the caller's active church.
export const newServiceBody = z.strictObject({
  title: z.string().trim().min(1).max(120),
  date: isoDate,
  slot: z.enum(['MORNING', 'AFTERNOON']).optional(),
  time: z.string().regex(hhmm).nullish(),
  status: z.enum(['DRAFT', 'PUBLISHED']),
  directorId: z.string().trim().min(1).max(64),
})
// The church is never part of the body either; the date comes from the path.
export const closedDateBody = z.strictObject({ reason: z.string().trim().min(1).max(120).optional() })
export const monthQuery = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export type SlotName = 'SINGLE' | 'MORNING' | 'AFTERNOON'

// Calendar dates carry no time zone: the weekday is a property of the date itself.
export function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** Chooses the slot a service takes; only a double Sunday has MORNING/AFTERNOON (before/after 12:00). */
export function planSlot(input: { date: string; sundayDouble: boolean; slot?: 'MORNING' | 'AFTERNOON'; time?: string | null }):
  { slot: SlotName } | { error: 'Invalid request' } {
  const doubleDay = input.sundayDouble && weekdayOf(input.date) === 0
  if (!doubleDay) return input.slot ? { error: 'Invalid request' } : { slot: 'SINGLE' }
  if (!input.slot) return { error: 'Invalid request' }
  if (input.time && (input.time < '12:00') !== (input.slot === 'MORNING')) return { error: 'Invalid request' }
  return { slot: input.slot }
}

/** A date holds one service, or two on an enabled double Sunday. */
export function dateCapacity(date: string, sundayDouble: boolean) {
  return sundayDouble && weekdayOf(date) === 0 ? 2 : 1
}

/** Día de calendario actual en Ciudad de México; hoy es válido durante todo el día. */
export function todayInZone(now: Date, zone = 'America/Mexico_City') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
