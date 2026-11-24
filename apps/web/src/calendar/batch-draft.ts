import type { Person } from '../ui'
import type { Assignment, DayConfig } from './batch'

export type DraftStep = 'period' | 'directors' | 'preachers' | 'review'
/** Todo lo que la persona ha armado en el lote antes de crearlo (la creación es una sola operación atómica). */
export type BatchDraft = {
  version: 1; savedAt: string; step: DraftStep; month: string; weekdays: number[]; configs: Record<number, DayConfig>
  list: Person[] | null; repeat: boolean; continues: boolean
  review: { assignment: Assignment; removed: string[]; preachers: Assignment }
  preachers: Person[]; repeatPreachers: boolean
}

const isObject = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isReview = (value: unknown) => isObject(value) && isObject((value as BatchDraft['review']).assignment) && isObject((value as BatchDraft['review']).preachers) && Array.isArray((value as BatchDraft['review']).removed)
const STEPS: readonly string[] = ['period', 'directors', 'preachers', 'review']
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const key = (churchId: string) => `plan-lyrics:batch-draft:${churchId}`

/** Guarda el borrador en este dispositivo; si el almacenamiento no está disponible no pasa nada (solo no se podrá retomar). */
export function saveBatchDraft(churchId: string, draft: BatchDraft) {
  try { localStorage.setItem(key(churchId), JSON.stringify(draft)) } catch { /* sin almacenamiento: el lote sigue funcionando */ }
}

export function clearBatchDraft(churchId: string) {
  try { localStorage.removeItem(key(churchId)) } catch { /* ídem */ }
}

/** El borrador guardado, o `null` si no hay, está dañado, es de otra versión o tiene más de 14 días. */
export function loadBatchDraft(churchId: string, now = Date.now()): BatchDraft | null {
  try {
    const raw = localStorage.getItem(key(churchId))
    if (!raw) return null
    const draft = JSON.parse(raw) as Partial<BatchDraft> | null
    const savedAt = draft?.savedAt ? Date.parse(draft.savedAt) : NaN
    const valid = draft?.version === 1 && STEPS.includes(draft.step ?? '') && typeof draft.month === 'string' && /^\d{4}-\d{2}$/.test(draft.month)
      && Array.isArray(draft.weekdays) && typeof draft.configs === 'object' && draft.configs !== null && isReview(draft.review)
      && Array.isArray(draft.preachers) && (draft.list === null || Array.isArray(draft.list)) && Number.isFinite(savedAt) && now - savedAt <= MAX_AGE_MS
    return valid ? (draft as BatchDraft) : null
  } catch {
    return null
  }
}
