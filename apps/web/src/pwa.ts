import { useSyncExternalStore } from 'react'

let waiting: ServiceWorker | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** Registra el service worker (solo en producción) y avisa cuando hay una versión nueva esperando. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const watch = (worker: ServiceWorker | null) => worker?.addEventListener('statechange', () => {
        // Con un controlador activo, «installed» significa que es una actualización (no la primera visita).
        if (worker.state === 'installed' && navigator.serviceWorker.controller) { waiting = worker; notify() }
      })
      if (registration.waiting && navigator.serviceWorker.controller) { waiting = registration.waiting; notify() }
      watch(registration.installing)
      registration.addEventListener('updatefound', () => watch(registration.installing))
    })
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; window.location.reload() } })
  })
}

/** Hay una versión nueva lista; `update` la activa y recarga. */
export function useUpdate() {
  const worker = useSyncExternalStore(subscribe, () => waiting)
  return { available: worker !== null, update: () => worker?.postMessage('SKIP_WAITING') }
}

/** Si el dispositivo tiene conexión (el navegador avisa al perderla o recuperarla). */
export function useOnline() {
  return useSyncExternalStore(
    (listener) => { window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener) } },
    () => navigator.onLine,
  )
}

let switchBlocked = false
const blockedListeners = new Set<() => void>()
const setSwitchBlocked = (value: boolean) => { switchBlocked = value; blockedListeners.forEach((listener) => listener()) }
if (typeof window !== 'undefined') window.addEventListener('online', () => setSwitchBlocked(false))
/** Alguien intentó cambiar de iglesia sin conexión: la barra de aviso explica por qué no cambió. */
export const blockSwitch = () => setSwitchBlocked(true)
export function useSwitchBlocked() {
  return useSyncExternalStore((listener) => { blockedListeners.add(listener); return () => { blockedListeners.delete(listener) } }, () => switchBlocked)
}
