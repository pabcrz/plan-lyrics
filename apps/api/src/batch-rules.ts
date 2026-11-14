import { z } from 'zod'
import { dateCapacity, hhmm, isoDate, monthQuery, planSlot, weekdayOf, type SlotName } from './service-rules.js'

/** Pure rules of the monthly batch; the endpoint only adds access and persistence around them. */

const id = z.string().trim().min(1).max(64)

// The church is never part of the body. The client sends its final, reviewed assignment.
export const batchBody = z.strictObject({
  month: monthQuery,
  // The ordered list used for the batch; it is stored to continue in the next month.
  directorIds: z.array(id).min(1).max(50).refine(ids => new Set(ids).size === ids.length),
  entries: z.array(z.strictObject({
    date: isoDate,
    slot: z.enum(['MORNING', 'AFTERNOON']).optional(),
    title: z.string().trim().min(1).max(120),
    time: z.string().regex(hhmm),
    directorId: id,
    // Optional preacher of the date: a directory person, who may also be its director.
    preacherId: id.optional(),
  })).min(1).max(40),
})
export type BatchBody = z.infer<typeof batchBody>

/** «0,5» → [0, 5]; one to three distinct weekdays (0 = Sunday), otherwise null. */
export function parseWeekdays(text: string): number[] | null {
  if (!/^[0-6](,[0-6]){0,2}$/.test(text)) return null
  const days = text.split(',').map(Number)
  return new Set(days).size === days.length ? days.sort((a, b) => a - b) : null
}

export type Occupant = { date: string; slot: SlotName; title: string; director: string }
export type Lock = { kind: 'closed'; reason: string | null } | { kind: 'service'; title: string; director: string }
export type PeriodEntry = { date: string; slot: SlotName; lock: Lock | null }

const slotRank: Record<SlotName, number> = { SINGLE: 0, MORNING: 0, AFTERNOON: 1 }
const byDateAndSlot = (a: { date: string; slot: SlotName }, b: { date: string; slot: SlotName }) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : slotRank[a.slot] - slotRank[b.slot]

/**
 * Dates of the chosen weekdays in the month: from today inclusive in the current month, all of them in a
 * later one, none in a past one. A double Sunday yields a morning and an afternoon entry. Locked entries
 * (full dates and «No hay culto») stay in place so the interface can show them; they are never assigned.
 */
export function batchEntries(input: {
  month: string; weekdays: ReadonlyArray<number>; today: string; sundayDouble: boolean
  services: ReadonlyArray<Occupant>; closed: ReadonlyArray<{ date: string; reason: string | null }>
}): PeriodEntry[] {
  const [year, number] = input.month.split('-').map(Number)
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate()
  const entries: PeriodEntry[] = []
  for (let day = 1; day <= length; day += 1) {
    const date = `${input.month}-${String(day).padStart(2, '0')}`
    if (date < input.today || !input.weekdays.includes(weekdayOf(date))) continue
    const closed = input.closed.find(item => item.date === date)
    const taken = input.services.filter(item => item.date === date)
    const full = taken.length >= dateCapacity(date, input.sundayDouble)
    const slots: SlotName[] = input.sundayDouble && weekdayOf(date) === 0 ? ['MORNING', 'AFTERNOON'] : ['SINGLE']
    for (const slot of slots) {
      const occupant = taken.find(item => item.slot === slot) ?? (full ? taken[0] : undefined)
      const lock: Lock | null = closed ? { kind: 'closed', reason: closed.reason }
        : occupant ? { kind: 'service', title: occupant.title, director: occupant.director } : null
      entries.push({ date, slot, lock })
    }
  }
  return entries
}

export type PlannedEntry = { date: string; slot: SlotName; title: string; time: string; directorId: string; preacherId?: string }

/** Validates a reviewed batch and resolves each slot with the same rule as an individual service. */
export function checkBatch(body: BatchBody, context: { today: string; sundayDouble: boolean }):
  { entries: PlannedEntry[] } | { error: 'Invalid request' | 'Date in the past' } {
  if (body.month < context.today.slice(0, 7)) return { error: 'Date in the past' }
  const planned: PlannedEntry[] = []
  for (const item of body.entries) {
    if (item.date < context.today) return { error: 'Date in the past' }
    if (!item.date.startsWith(body.month)) return { error: 'Invalid request' }
    const plan = planSlot({ date: item.date, sundayDouble: context.sundayDouble, slot: item.slot, time: item.time })
    if ('error' in plan) return { error: plan.error }
    planned.push({ date: item.date, slot: plan.slot, title: item.title, time: item.time, directorId: item.directorId, ...(item.preacherId ? { preacherId: item.preacherId } : {}) })
  }
  const keys = planned.map(item => `${item.date}/${item.slot}`)
  if (new Set(keys).size !== keys.length) return { error: 'Invalid request' }
  if (new Set(planned.map(item => weekdayOf(item.date))).size > 3) return { error: 'Invalid request' }
  return { entries: planned.sort(byDateAndSlot) }
}

/** Who the next batch continues after: the director of the last service of the sequence. */
export function lastDirectorOf(entries: ReadonlyArray<PlannedEntry>): string {
  return [...entries].sort(byDateAndSlot)[entries.length - 1]!.directorId
}
