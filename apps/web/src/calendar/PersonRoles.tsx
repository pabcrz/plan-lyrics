import { Switch } from '../ui'

export type RoleFlags = { canDirect: boolean; canPreach: boolean }

/** Para qué trabajos se ofrece a la persona en los selectores. «Predica» solo existe si la iglesia usa predicación. */
export function PersonRoles({ value, onChange, showPreach, disabled }: {
  value: RoleFlags; onChange: (next: RoleFlags) => void; showPreach: boolean; disabled?: boolean
}) {
  return (
    <div className="grid gap-3">
      <Switch checked={value.canDirect} disabled={disabled} onCheckedChange={(canDirect) => onChange({ ...value, canDirect })}
        label="Dirige alabanza" description="Aparece al elegir quién dirige un servicio." />
      {showPreach && (
        <Switch checked={value.canPreach} disabled={disabled} onCheckedChange={(canPreach) => onChange({ ...value, canPreach })}
          label="Predica" description="Aparece al elegir quién predica." />
      )}
    </div>
  )
}

/** Etiqueta corta de los roles, para las listas. */
export const rolesText = (roles: RoleFlags, showPreach: boolean) =>
  [roles.canDirect ? 'Dirige' : '', showPreach && roles.canPreach ? 'Predica' : ''].filter(Boolean).join(' · ')
