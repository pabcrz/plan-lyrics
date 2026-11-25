import { useState } from 'react'
import { Notice, Sheet, Switch } from '../ui'
import { ApiError, usePersonActions } from '../calendar/api'
import { useRoles } from '../calendar/roles-api'
import type { Church, Person } from '../calendar/model'
import { RoleChips, toggled } from './RoleChips'

export type Group = 'play' | 'direct' | 'preach'

/** Título de la hoja y nombre del botón que la abre, por grupo. */
export const MANAGE: Record<Group, { title: string; flag: 'canPlay' | 'canDirect' | 'canPreach' }> = {
  play: { title: 'Gestionar grupo de alabanza', flag: 'canPlay' },
  direct: { title: 'Gestionar directores', flag: 'canDirect' },
  preach: { title: 'Gestionar predicadores', flag: 'canPreach' },
}

/** Hoja para agregar y quitar personas de un grupo; en alabanza, quien administra también marca los roles de cada integrante. */
export function ManageGroup({ church, group, people, onClose }: { church: Church; group: Group; people: Person[]; onClose: () => void }) {
  const { update, setRoles } = usePersonActions()
  const roles = useRoles()
  const { title, flag } = MANAGE[group]
  const [member, setMember] = useState<Record<string, boolean>>({})
  const [chosen, setChosen] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState<string[]>([])
  const [failure, setFailure] = useState('')
  const catalog = roles.data ?? []
  const inGroup = (person: Person) => member[person.id] ?? person[flag]
  const rolesOf = (person: Person) => chosen[person.id] ?? person.roleIds
  const run = (id: string, work: () => Promise<unknown>, revert: () => void, message: (caught: unknown) => string) => {
    setBusy((current) => [...current, id])
    setFailure('')
    return work().catch((caught: unknown) => { revert(); setFailure(message(caught)) }).finally(() => setBusy((current) => current.filter((item) => item !== id)))
  }

  function change(person: Person, next: boolean) {
    setMember((current) => ({ ...current, [person.id]: next }))
    void run(person.id, () => update(person.id, { [flag]: next }), () => setMember((current) => ({ ...current, [person.id]: !next })),
      (caught) => caught instanceof ApiError && caught.code === 'In use'
        ? 'Sigue como habitual o en una rotación de un rol: quítala primero de ahí, en Participaciones, y luego sácala del grupo de alabanza.'
        : 'No se pudo cambiar el grupo. Inténtalo de nuevo.')
  }
  function toggleRole(person: Person, roleId: string) {
    const previous = rolesOf(person)
    const next = toggled(previous, roleId)
    setChosen((current) => ({ ...current, [person.id]: next }))
    void run(person.id, () => setRoles(person.id, next), () => setChosen((current) => ({ ...current, [person.id]: previous })), () => 'No se pudieron guardar los roles. Inténtalo de nuevo.')
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="grid gap-4">
        {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
        {people.length === 0 && <p className="m-0 text-text-2">Aún no hay personas. Agrégalas desde «Agregar persona».</p>}
        <ul className="m-0 grid list-none gap-4 p-0">
          {people.map((person) => (
            <li key={person.id} className="grid gap-2">
              <Switch checked={inGroup(person)} disabled={busy.includes(person.id)} onCheckedChange={(next) => change(person, next)} label={person.name} />
              {group === 'play' && inGroup(person) && church.canConfigure && catalog.length > 0 && (
                <RoleChips roles={catalog} chosen={rolesOf(person)} onToggle={(id) => toggleRole(person, id)} label={`Roles de ${person.name}`} disabled={busy.includes(person.id)} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
