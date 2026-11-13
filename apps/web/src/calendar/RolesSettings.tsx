import { useState } from 'react'
import { Button, Icon, Notice, Sheet, TextField, fold } from '../ui'
import { ApiError } from './api'
import { DIRECTOR_KEY, useRoleActions, useRoleRestrictions, useRoles, type MusicalRole, type RoleRestriction } from './roles-api'

const DIRECTOR_NAME = 'Dirigir'
type Dialog = { kind: 'role' } | { kind: 'restriction' } | { kind: 'remove'; role: MusicalRole } | null

/** Dirigir va primero y el resto en orden alfabético, como en el resto de la app. */
const byName = (a: string, b: string) => (a === DIRECTOR_NAME ? -1 : b === DIRECTOR_NAME ? 1 : a.localeCompare(b, 'es'))
const samePair = (a: Pick<RoleRestriction, 'first' | 'second'>, b: Pick<RoleRestriction, 'first' | 'second'>) =>
  (a.first === b.first && a.second === b.second) || (a.first === b.second && a.second === b.first)

/**
 * Roles musicales de la iglesia y combinaciones no permitidas. Cada cambio se aplica al momento
 * (no espera a «Guardar cambios»); quien no administra la iglesia solo lo lee.
 */
export function RolesSettings({ editable }: { editable: boolean }) {
  const roles = useRoles()
  const restrictions = useRoleRestrictions()
  const actions = useRoleActions()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [failure, setFailure] = useState('')

  if (roles.isPending || restrictions.isPending) return <p role="status" className="m-0 text-sm text-text-3">Cargando roles…</p>
  if (roles.error || restrictions.error) return <Notice tone="warn" icon="alert" role="alert">No se pudieron cargar los roles. Inténtalo de nuevo más tarde.</Notice>

  const catalog = roles.data
  const nameOf = (key: string) => (key === DIRECTOR_KEY ? DIRECTOR_NAME : catalog.find((role) => role.id === key)?.name ?? '')
  const rows = restrictions.data
    .map((row) => ({ row, names: [nameOf(row.first), nameOf(row.second)].sort(byName) }))
    .sort((a, b) => byName(a.names[0], b.names[0]) || byName(a.names[1], b.names[1]))

  async function perform(action: () => Promise<unknown>) {
    setFailure('')
    try {
      await action()
      return true
    } catch (caught) {
      setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar los roles.' : 'No se pudo aplicar el cambio. Inténtalo de nuevo.')
      return false
    }
  }

  return (
    <>
      <section aria-labelledby="roles-title" className="grid gap-2">
        <h2 id="roles-title" className="m-0 text-sm font-semibold">Roles musicales</h2>
        <p className="m-0 text-[0.8125rem] text-text-3">Dirigir es un rol fijo del servicio y no se configura aquí. Los cambios de roles se aplican al momento.</p>
        {catalog.length > 0 ? (
          <ul aria-labelledby="roles-title" className="m-0 grid list-none rounded-lg border border-line bg-surface p-0">
            {catalog.map((role) => (
              <li key={role.id} className="flex min-h-[52px] items-center gap-2 border-b border-line pl-3 last:border-b-0">
                <span className="flex-1 font-semibold">{role.name}</span>
                {editable && (
                  <Button variant="quiet" icon aria-label={`Quitar el rol ${role.name}`} onClick={() => setDialog({ kind: 'remove', role })}><Icon name="x" /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[0.8125rem] text-text-3">Esta iglesia no tiene roles musicales.</p>
        )}
        {editable && <Button variant="secondary" block onClick={() => setDialog({ kind: 'role' })}><Icon name="plus" />Agregar rol</Button>}
      </section>

      <section aria-labelledby="combos-title" className="grid gap-2">
        <h2 id="combos-title" className="m-0 text-sm font-semibold">Roles que no se pueden combinar</h2>
        <p className="m-0 text-[0.8125rem] text-text-3">
          Una persona puede tener varios roles en un mismo servicio. Estas combinaciones no se permiten. La predicación no es un rol musical y no entra aquí.
        </p>
        {rows.length > 0 ? (
          <ul aria-labelledby="combos-title" className="m-0 grid list-none rounded-lg border border-line bg-surface p-0">
            {rows.map(({ row, names }) => (
              <li key={row.id} className="flex min-h-[52px] items-center gap-2 border-b border-line pl-3 last:border-b-0">
                <span className="flex-1 font-semibold">
                  {names[0]} + {names[1]}
                  <small className="block text-[0.8125rem] font-normal text-text-3">No a la vez en el mismo servicio</small>
                </span>
                {editable && (
                  <Button variant="quiet" icon aria-label={`Quitar la restricción ${names[0]} y ${names[1]}`}
                    onClick={() => void perform(() => actions.removeRestriction(row.id))}><Icon name="x" /></Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[0.8125rem] text-text-3">Sin restricciones: una persona puede combinar cualquier rol.</p>
        )}
        {editable && <Button variant="secondary" block onClick={() => setDialog({ kind: 'restriction' })}><Icon name="plus" />Agregar restricción</Button>}
      </section>
      {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}

      <NewRoleSheet open={dialog?.kind === 'role'} existing={catalog} onClose={() => setDialog(null)}
        onCreate={async (name) => { setFailure(''); return actions.createRole(name) }} />
      <NewRestrictionSheet open={dialog?.kind === 'restriction'} catalog={catalog} existing={restrictions.data} onClose={() => setDialog(null)}
        onAdd={(first, second) => actions.addRestriction(first, second)} />
      <Sheet open={dialog?.kind === 'remove'} onClose={() => setDialog(null)} title={dialog?.kind === 'remove' ? `¿Quitar el rol ${dialog.role.name}?` : ''}>
        {dialog?.kind === 'remove' && (
          <div className="grid gap-3">
            <p className="m-0 text-sm text-text-2">También se quitarán las restricciones que incluyan este rol. Podrás volver a crearlo cuando quieras.</p>
            <Button variant="danger" block onClick={() => { const { role } = dialog; setDialog(null); void perform(() => actions.removeRole(role.id)) }}>Quitar rol</Button>
            <Button variant="quiet" block onClick={() => setDialog(null)}>Cancelar</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

function NewRoleSheet({ open, existing, onClose, onCreate }: {
  open: boolean; existing: MusicalRole[]; onClose: () => void; onCreate: (name: string) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const close = () => { setName(''); setError(''); onClose() }

  async function submit() {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!trimmed) return setError('Escribe el nombre del rol.')
    if (fold(trimmed) === fold(DIRECTOR_NAME) || existing.some((role) => fold(role.name) === fold(trimmed))) return setError('Ya existe un rol con ese nombre.')
    setSending(true)
    try {
      await onCreate(trimmed)
      close()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'Ya existe un rol con ese nombre.' : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar los roles.' : 'No se pudo crear el rol. Inténtalo de nuevo.')
    } finally { setSending(false) }
  }

  return (
    <Sheet open={open} onClose={close} title="Nuevo rol">
      <form noValidate onSubmit={(event) => { event.preventDefault(); void submit() }} className="grid gap-3">
        <TextField label="Nombre del rol" value={name} maxLength={40} error={error} onChange={(event) => { setName(event.target.value); setError('') }} />
        <Button type="submit" variant="primary" block loading={sending}>Agregar rol</Button>
        <Button variant="quiet" block onClick={close}>Cancelar</Button>
      </form>
    </Sheet>
  )
}

function NewRestrictionSheet({ open, catalog, existing, onClose, onAdd }: {
  open: boolean; catalog: MusicalRole[]; existing: RoleRestriction[]; onClose: () => void; onAdd: (first: string, second: string) => Promise<unknown>
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const close = () => { setPicked([]); setError(''); onClose() }
  const options = [{ key: DIRECTOR_KEY, name: DIRECTOR_NAME }, ...catalog.map((role) => ({ key: role.id, name: role.name }))]
  const nameOf = (key: string) => options.find((option) => option.key === key)?.name ?? ''

  const duplicate = picked.length === 2 && existing.some((row) => samePair(row, { first: picked[0], second: picked[1] }))
  const hint = duplicate ? 'Esa restricción ya existe.'
    : picked.length < 2 ? `Elige ${2 - picked.length} ${picked.length === 1 ? 'rol más' : 'roles'}.`
      : `${nameOf(picked[0])} y ${nameOf(picked[1])} no podrán combinarse.`

  async function submit() {
    if (picked.length !== 2 || duplicate) return
    setSending(true)
    try {
      await onAdd(picked[0], picked[1])
      close()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? 'Esa restricción ya existe.' : caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar los roles.' : 'No se pudo agregar la restricción. Inténtalo de nuevo.')
    } finally { setSending(false) }
  }

  return (
    <Sheet open={open} onClose={close} title="Nueva restricción">
      <div className="grid gap-3">
        <p className="m-0 text-sm text-text-2">Elige los dos roles que una misma persona no podrá tener a la vez en un servicio.</p>
        <div role="group" aria-label="Roles" className="flex flex-wrap gap-2">
          {options.map((option) => {
            const on = picked.includes(option.key)
            return (
              <button key={option.key} type="button" aria-pressed={on} disabled={!on && picked.length >= 2}
                onClick={() => { setError(''); setPicked((prev) => (on ? prev.filter((key) => key !== option.key) : [...prev, option.key])) }}
                className="min-h-touch-lg cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-[0.9375rem] font-semibold aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-text-3">
                {option.name}
              </button>
            )
          })}
        </div>
        <p aria-live="polite" className="m-0 text-[0.8125rem] text-text-3">{hint}</p>
        {error && <Notice tone="warn" icon="alert" role="alert">{error}</Notice>}
        <Button variant="primary" block loading={sending} disabled={picked.length !== 2 || duplicate} onClick={() => void submit()}>Agregar restricción</Button>
        <Button variant="quiet" block onClick={close}>Cancelar</Button>
      </div>
    </Sheet>
  )
}
