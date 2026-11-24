import { useState, useSyncExternalStore } from 'react'

/** Evento no estándar de Chrome/Edge/Android que permite ofrecer la instalación cuando la persona quiera. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const KEY = 'plan-lyrics.installSnooze'
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
let watching = false

/** Se llama al arrancar: el navegador puede avisar antes de que React monte, así que el evento se guarda aquí. */
export function watchInstall() {
  if (watching) return
  watching = true
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferred = event as InstallEvent; notify() })
  window.addEventListener('appinstalled', () => { deferred = null; notify() })
}

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
// Safari en iPhone y iPad no lanza el evento: ahí solo se puede explicar el paso manual.
const onIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const snoozed = () => { try { return Date.now() - Number(localStorage.getItem(KEY)) < SNOOZE_MS } catch { return false } }

/** Qué ofrecer: instalar con un toque, explicar el paso manual de iOS o nada (ya instalada, pospuesta o sin soporte). */
export function useInstall() {
  const event = useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => deferred)
  const [later, setLater] = useState(snoozed)
  const offer: 'prompt' | 'ios' | null = standalone() || later ? null : event ? 'prompt' : onIos() ? 'ios' : null
  return {
    offer,
    async install() {
      if (!event) return
      await event.prompt()
      await event.userChoice
      deferred = null
      notify()
    },
    postpone() {
      try { localStorage.setItem(KEY, String(Date.now())) } catch { /* sin almacenamiento: se ofrece de nuevo la próxima vez */ }
      setLater(true)
    },
  }
}
