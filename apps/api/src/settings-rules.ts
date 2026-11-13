import { z } from 'zod'

const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/

// La iglesia nunca forma parte del cuerpo: siempre es la iglesia activa de quien llama.
const settingsBody = z.strictObject({
  name: z.string().trim().min(1).max(120),
  sundayDouble: z.boolean(),
  usesPreaching: z.boolean(),
  days: z.array(z.strictObject({
    weekday: z.number().int().min(0).max(6),
    slot: z.enum(['SINGLE', 'MORNING', 'AFTERNOON']),
    time: z.string().regex(hhmm),
    title: z.string().trim().min(1).max(120),
  })).max(14),
})
export type ChurchSettings = z.infer<typeof settingsBody>

/** `issues` nombra los campos con error (`name`, `days`, `days.<día>.<franja>.time|title`) para mostrarlos junto al campo. */
export function checkSettings(input: unknown): { data: ChurchSettings } | { issues: string[] } {
  const parsed = settingsBody.safeParse(input)
  if (!parsed.success) {
    const keys = new Set(parsed.error.issues.map(issue => {
      const [field, index, key] = issue.path
      const day = field === 'days' && typeof index === 'number' ? (input as { days?: Array<{ weekday?: unknown; slot?: unknown }> }).days?.[index] : undefined
      return day && (key === 'title' || key === 'time') ? `days.${String(day.weekday)}.${String(day.slot)}.${key}` : field === 'days' || field === 'name' || field === 'sundayDouble' ? String(field) : 'body'
    }))
    return { issues: [...keys] }
  }
  const { days, sundayDouble } = parsed.data
  const issues: string[] = []
  if (days.length === 0) return { issues: ['days'] }
  if (new Set(days.map(day => `${day.weekday}.${day.slot}`)).size !== days.length) issues.push('days')
  const sunday = days.filter(day => day.weekday === 0)
  // Solo el domingo con la opción activa lleva mañana y tarde; todo lo demás es una franja única.
  const shape = days.every(day => (day.weekday === 0 && sundayDouble ? day.slot !== 'SINGLE' : day.slot === 'SINGLE'))
  if (!shape || (sundayDouble && sunday.length > 0 && sunday.length !== 2)) {
    if (!issues.includes('days')) issues.push('days')
  } else if (sundayDouble && sunday.length === 0) issues.push('sundayDouble')
  for (const day of days) {
    const base = `days.${day.weekday}.${day.slot}`
    if (Number(day.time.slice(3)) % 15 !== 0) issues.push(`${base}.time`)
    else if (day.slot === 'MORNING' && day.time >= '12:00') issues.push(`${base}.time`)
    else if (day.slot === 'AFTERNOON' && day.time < '12:00') issues.push(`${base}.time`)
  }
  return issues.length > 0 ? { issues } : { data: parsed.data }
}
