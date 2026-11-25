import { localStore } from './external-store'

/**
 * Qué muestra el inicio de quien está en varias iglesias: «Todas» (true) o una sola, que es la iglesia activa (false). Sin elegir (null)
 * empieza en «Todas». Se guarda en el dispositivo; elegir una iglesia, aquí o en el menú de iglesias, deja de ser «Todas».
 */
export const homeAll = localStore<boolean | null>('plan-lyrics.homeAll', (raw) => (raw === '1' ? true : raw === '0' ? false : null), (value) => (value === null ? null : value ? '1' : '0'))
