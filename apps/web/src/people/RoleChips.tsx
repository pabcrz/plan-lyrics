import type { MusicalRole } from '../calendar/roles-api'

/** Agrega el id si no está y lo quita si está. */
export const toggled = (chosen: string[], id: string) => (chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id])

/** Un botón por rol musical; los marcados quedan presionados. */
export function RoleChips({ roles, chosen, onToggle, label, disabled }: {
  roles: MusicalRole[]; chosen: string[]; onToggle: (id: string) => void; label: string; disabled?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <button key={role.id} type="button" disabled={disabled} aria-pressed={chosen.includes(role.id)} onClick={() => onToggle(role.id)}
          className="min-h-touch cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-[0.9375rem] font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent disabled:cursor-default disabled:opacity-60">
          {role.name}
        </button>
      ))}
    </div>
  )
}
