const KEY = 'plan-lyrics.activeChurch'

/** Iglesia que la persona eligió en este dispositivo; la API la valida siempre contra sus membresías. */
export function getActiveChurch(): string | undefined {
  try { return localStorage.getItem(KEY) ?? undefined } catch { return undefined }
}
export function setActiveChurch(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento: queda la iglesia única o se vuelve a elegir */ }
}
export function clearActiveChurch() {
  try { localStorage.removeItem(KEY) } catch { /* ídem */ }
}
