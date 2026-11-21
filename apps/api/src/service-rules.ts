import { z } from 'zod'

export const hhmm =/^([01]\d|2[0-3]):[0-5]\d$/
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
// Correcting a service: any subset of its own fields (the church never travels in the body). `time: null` clears the hour.
export const servicePatch = z.strictObject({
  title: z.string().trim().min(1).max(120).optional(),
  date: isoDate.optional(),
  slot: z.enum(['MORNING', 'AFTERNOON']).optional(),
  time: z.string().regex(hhmm).nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']).optional(),
  directorId: z.string().trim().min(1).max(64).optional(),
}).refine(body => Object.keys(body).length > 0)
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

/**
 * The date, slot and time a service ends up with after an edit. A slot is only meaningful on an enabled double Sunday:
 * moving away from it drops the slot, moving onto it keeps the current one when there is one, and asking for a slot
 * anywhere else is refused.
 */
export function planEdit(current: { date: string; slot: SlotName; time: string | null }, patch: { date?: string; slot?: 'MORNING' | 'AFTERNOON'; time?: string | null }, sundayDouble: boolean):
  { date: string; slot: SlotName; time: string | null } | { error: 'Invalid request' } {
  const date = patch.date ?? current.date
  const time = patch.time === undefined ? current.time : patch.time
  const doubleDay = sundayDouble && weekdayOf(date) === 0
  if (patch.slot && !doubleDay) return { error: 'Invalid request' }
  const slot = doubleDay ? (patch.slot ?? (current.slot === 'SINGLE' ? undefined : current.slot)) : undefined
  const plan = planSlot({ date, sundayDouble, slot, time })
  return 'error' in plan ? plan : { date, time, slot: plan.slot }
}

/** A date holds one service, or two on an enabled double Sunday. */
export function dateCapacity(date: string, sundayDouble: boolean) {
  return sundayDouble && weekdayOf(date) === 0 ? 2 : 1
}

/** Día de calendario actual en Ciudad de México; hoy es válido durante todo el día. */
export function todayInZone(now: Date, zone = 'America/Mexico_City') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
