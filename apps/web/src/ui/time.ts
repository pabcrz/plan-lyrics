export type Meridiem = 'am' | 'pm'
export type Time12 = { hour: number; minute: number; meridiem: Meridiem }

export const MINUTES = [0, 15, 30, 45] as const
/** 12 va antes que la 1, como en un reloj. */
export const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** "19:30" → 7:30 p.m.; los minutos se ajustan al cuarto de hora más cercano (máx. 45). */
export function from24h(value: string): Time12 {
  const [h = 0, m = 0] = value.split(':').map(Number)
  const minute = MINUTES.reduce((best, x) => (Math.abs(x - m) < Math.abs(best - m) ? x : best), 0 as number)
  return { hour: h % 12 || 12, minute, meridiem: h >= 12 ? 'pm' : 'am' }
}

/** 12:00 a.m. → "00:00"; 12:00 p.m. → "12:00". */
export function to24h({ hour, minute, meridiem }: Time12): string {
  return `${pad((hour % 12) + (meridiem === 'pm' ? 12 : 0))}:${pad(minute)}`
}

export function format12h(time: Time12): string {
  return `${time.hour}:${pad(time.minute)} ${time.meridiem === 'am' ? 'a.m.' : 'p.m.'}`
}
