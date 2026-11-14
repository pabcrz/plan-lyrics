import { useState } from 'react'
import { Button, Notice, Sheet, TextField, fold } from '../ui'
import { ApiError } from './api'
import type { MusicalRole } from './roles-api'

export const DIRECTOR_NAME = 'Dirigir'

/** Hoja para crear un rol: valida el nombre antes de enviar; el servidor vuelve a decidir duplicados y permisos. */
export function NewRoleSheet({ open, existing, onClose, onCreate }: {
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

/**
 * Quitar un rol. Si hay servicios futuros con asignaciones del rol, el servidor lo avisa antes de borrar nada:
 * aquí se explica y solo con una segunda confirmación quedan pendientes (sin persona); los pasados se conservan.
 */
export function RemoveRoleSheet({ role, onClose, onRemove }: {
  role: MusicalRole | null; onClose: () => void; onRemove: (id: string, confirmed: boolean) => Promise<unknown>
}) {
  const [ahead, setAhead] = useState<number | null>(null)
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const close = () => { setAhead(null); setFailure(''); onClose() }

  async function remove(confirmed: boolean) {
    if (!role) return
    setSending(true)
    setFailure('')
    try {
      await onRemove(role.id, confirmed)
      close()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'Future assignments') setAhead(caught.services ?? 0)
      else setFailure(caught instanceof ApiError && caught.status === 403 ? 'No tienes permiso para cambiar los roles.' : 'No se pudo quitar el rol. Inténtalo de nuevo.')
    } finally { setSending(false) }
  }

  return (
    <Sheet open={role !== null} onClose={close} title={role ? `¿Quitar el rol ${role.name}?` : ''}>
      {role && (
        <div className="grid gap-3">
          {ahead === null ? (
            <p className="m-0 text-sm text-text-2">También se quitarán las restricciones que incluyan este rol, sus habituales y su rotación. Podrás volver a crearlo cuando quieras.</p>
          ) : (
            <Notice tone="warn" icon="alert" title={`${ahead === 1 ? '1 servicio próximo tiene' : `${ahead} servicios próximos tienen`} asignaciones de ${role.name}`}>
              Si continúas, esas asignaciones quedan pendientes, sin persona, y habrá que resolverlas a mano. Los servicios pasados conservan su registro.
            </Notice>
          )}
          {failure && <Notice tone="warn" icon="alert" role="alert">{failure}</Notice>}
          <Button variant="danger" block loading={sending} onClick={() => void remove(ahead !== null)}>{ahead === null ? 'Quitar rol' : 'Quitar y dejar pendientes'}</Button>
          <Button variant="quiet" block onClick={close}>Cancelar</Button>
        </div>
      )}
    </Sheet>
  )
}
