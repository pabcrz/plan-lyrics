import { slotText, timeText } from './service-ui'
import type { Service } from './model'

/** Qué mira cada quien: quien administra o edita ve todo; quien solo toca o dirige ve la alabanza; quien solo predica ve la predicación. */
export type Profile = 'full' | 'worship' | 'preacher'

const songsText = (count: number) => (count === 0 ? 'Setlist sin preparar' : `${count} ${count === 1 ? 'canción' : 'canciones'} en el setlist`)

/**
 * El encabezado y los datos de la tarjeta de un servicio, según el perfil de quien mira:
 * - alabanza: quién dirige, la hora y el setlist;
 * - predicación: el tema, quién predica y la hora;
 * - completo: el tema (o la fecha), quién dirige, quién predica, la hora y el setlist.
 */
export function serviceSummary(service: Service, profile: Profile): { headline: string; details: string[] } {
  const when = `${timeText(service.time)}${slotText[service.slot]}`
  const director = service.director?.name
  const preacher = service.preaching?.preacher?.name
  const topic = service.preaching?.topic?.trim()
  if (profile === 'worship') return { headline: director ? `Dirige ${director}` : 'Sin director asignado', details: [when, songsText(service.songCount)] }
  if (profile === 'preacher') return { headline: topic || 'Sin tema todavía', details: [preacher ? `Predica ${preacher}` : 'Sin predicador asignado', when] }
  const who = [director ? `Dirige ${director}` : 'Sin director', service.preaching ? (preacher ? `Predica ${preacher}` : 'Sin predicador') : ''].filter(Boolean).join(' · ')
  return { headline: topic || service.title, details: [who, `${when} · ${songsText(service.songCount)}`] }
}
