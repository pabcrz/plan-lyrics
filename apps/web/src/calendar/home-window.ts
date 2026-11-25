import { addDays, monthOf, shiftMonth, weekdayOf } from './dates'

/** Las semanas van de domingo a sábado. */
const sundayOf = (date: string) => addDays(date, -weekdayOf(date))

/** «Todas»: hasta el sábado de la semana que viene (esta semana desde hoy y la siguiente completa). */
export const allWindowEnd = (today: string) => addDays(sundayOf(today), 13)

/**
 * Una sola iglesia: lo que queda del mes. Desde la última semana del mes (la que contiene su último día) se suma la semana siguiente,
 * para que el cambio de mes no deje la lista vacía; al entrar el mes nuevo se muestra ese mes completo.
 */
export function churchWindowEnd(today: string): string {
  const lastDay = addDays(`${shiftMonth(monthOf(today), 1)}-01`, -1)
  const lastWeek = sundayOf(lastDay)
  return today >= lastWeek ? addDays(lastWeek, 13) : lastDay
}
