import { ApiError } from '../calendar/api'
import type { Role } from './access-api'

export const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrador', EDITOR: 'Editor de servicios', MEMBER: 'Integrante' }
/** Texto corto de los botones del selector de rol (el de la lista usa `ROLE_LABEL`). */
export const ROLE_SHORT: Record<Role, string> = { ADMIN: 'Administrador', EDITOR: 'Editor', MEMBER: 'Integrante' }
export const ROLE_HELP: Record<Role, string> = {
  ADMIN: 'Gestiona personas, servicios, asignaciones y ajustes de esta iglesia, y quién tiene acceso. No edita la biblioteca compartida.',
  EDITOR: 'Crea y edita servicios, participantes y setlists de esta iglesia. No gestiona miembros ni ajustes.',
  MEMBER: 'Consulta la información interna de esta iglesia, sin editar.',
}
export const ROLES: Role[] = ['MEMBER', 'EDITOR', 'ADMIN']

/** Mismo criterio que la API; ella vuelve a validar. */
export const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.trim().length <= 254

/** Mensaje en español de un fallo de la gestión de membresías; no se muestran textos del servidor. */
export function memberFailure(caught: unknown) {
  if (caught instanceof ApiError) {
    if (caught.code === 'Last administrator') return 'La iglesia debe conservar al menos un administrador. Nombra a otro antes de cambiar o quitar a esta persona.'
    if (caught.code === 'Protected account') return 'Esta cuenta es del superadministrador y no se cambia desde una iglesia.'
    if (caught.code === 'Account unavailable') return 'Esta cuenta ya pertenece a otra iglesia. Mientras no exista el selector de iglesia activa, una cuenta solo puede estar en una.'
    if (caught.code === 'Member exists') return 'Esta persona ya tiene acceso a la iglesia.'
    if (caught.code === 'No account') return 'Esta persona todavía no tiene una cuenta vinculada.'
    if (caught.status === 403) return 'No tienes permiso para gestionar los accesos de esta iglesia.'
    if (caught.status === 404) return 'Esta persona o membresía ya no existe. Actualiza la lista.'
    if (caught.status === 400) return 'Revisa los datos e inténtalo de nuevo.'
  }
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}

/** Mensaje de un fallo al invitar o administrar cuentas. */
export function accountFailure(caught: unknown) {
  if (caught instanceof ApiError) {
    if (caught.status === 503 && caught.code === 'Identity provider unavailable') return 'El envío de invitaciones todavía no está configurado en el servidor. No se creó ninguna cuenta.'
    if (caught.status === 502) return 'El proveedor de acceso no respondió. No se creó ninguna cuenta; inténtalo de nuevo en unos minutos.'
    if (caught.status === 409 && caught.code === 'Person linked') return 'Esa persona ya tiene una cuenta vinculada.'
    if (caught.status === 409 && caught.code === 'Account linked') return 'Esta cuenta ya tiene una persona vinculada.'
    if (caught.status === 409) return 'Ese correo ya pertenece a otra cuenta.'
    if (caught.status === 404) return 'No tienes permiso para este cambio o la cuenta ya no existe. Actualiza la lista.'
    if (caught.status === 400) return 'Revisa los datos e inténtalo de nuevo.'
  }
  return 'No se pudo aplicar el cambio. Inténtalo de nuevo.'
}
