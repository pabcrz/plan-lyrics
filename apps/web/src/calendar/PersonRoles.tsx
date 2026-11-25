import { Switch } from '../ui'

export type RoleFlags = { canDirect: boolean; canPreach: boolean; canPlay: boolean }

/**
 * A qué grupos de la iglesia pertenece la persona: son independientes (puede estar en uno, en varios o en ninguno).
 * El grupo de alabanza es el único que permite asignarle roles musicales; «Predica» solo existe si la iglesia usa predicación.
 */
export function PersonRoles({ value, onChange, showPreach, disabled }: {
  value: RoleFlags; onChange: (next: RoleFlags) => void; showPreach: boolean; disabled?: boolean
}) {
  return (
    <div className="grid gap-3">
      <Switch checked={value.canPlay} disabled={disabled} onCheckedChange={(canPlay) => onChange({ ...value, canPlay })}
        label="Grupo de alabanza" description="Toca o canta en el grupo: solo así se le pueden asignar roles como batería, guitarra o voces." />
      <Switch checked={value.canDirect} disabled={disabled} onCheckedChange={(canDirect) => onChange({ ...value, canDirect })}
        label="Dirige alabanza" description="Aparece al elegir quién dirige un servicio." />
      {showPreach && (
        <Switch checked={value.canPreach} disabled={disabled} onCheckedChange={(canPreach) => onChange({ ...value, canPreach })}
          label="Predica" description="Aparece al elegir quién predica." />
      )}
    </div>
  )
}

/** Etiqueta corta de los grupos, para las listas. */
export const rolesText = (roles: RoleFlags, showPreach: boolean) =>
  [roles.canPlay ? 'Alabanza' : '', roles.canDirect ? 'Dirige' : '', showPreach && roles.canPreach ? 'Predica' : ''].filter(Boolean).join(' · ')
