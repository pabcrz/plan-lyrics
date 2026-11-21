import { format12h, from24h, type ServiceStatus } from '../ui'
import type { Status } from './model'

export const status = (value: Status) => value.toLowerCase() as ServiceStatus
export const statusText: Record<ServiceStatus, string> = { draft: 'Borrador', published: 'Publicado', completed: 'Completado', cancelled: 'Cancelado' }
export const timeText = (time: string | null) => (time ? format12h(from24h(time)) : 'Sin hora fija')
export const slotText = { SINGLE: '', MORNING: ' · Mañana', AFTERNOON: ' · Tarde' } as const
