import { usePeople } from './api'
import type { Profile } from './service-summary'
import type { Church } from './model'

/**
 * El perfil de quien mira, para decidir qué se resalta en las tarjetas: administradores y editores ven todo; quien solo está en el
 * grupo de alabanza o dirige ve la alabanza; quien solo predica ve la predicación; las dos cosas, todo. Sin predicación en la iglesia, alabanza.
 */
export function useViewProfile(church: Pick<Church, 'canEdit' | 'usesPreaching'>): Profile {
  const needsPerson = !church.canEdit && church.usesPreaching
  const me = usePeople(needsPerson).data?.find((person) => person.isYou)
  if (church.canEdit) return 'full'
  if (!church.usesPreaching) return 'worship'
  if (!me) return 'full'
  const worship = me.canPlay || me.canDirect
  return me.canPreach && !worship ? 'preacher' : worship && !me.canPreach ? 'worship' : me.canPreach ? 'full' : 'worship'
}
