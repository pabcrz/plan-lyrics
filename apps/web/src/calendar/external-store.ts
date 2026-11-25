import { useSyncExternalStore } from 'react'

/** Un valor pequeño guardado en el dispositivo que varias pantallas leen a la vez y se actualizan juntas (también entre pestañas). */
export function localStore<T>(key: string, parse: (raw: string | null) => T, serialize: (value: T) => string | null) {
  const listeners = new Set<() => void>()
  let snapshot: T = parse(read())
  function read() { try { return localStorage.getItem(key) } catch { return null } }
  const notify = () => { snapshot = parse(read()); listeners.forEach((listener) => listener()) }
  if (typeof window !== 'undefined') window.addEventListener('storage', (event) => { if (event.key === key) notify() })
  return {
    get: () => snapshot,
    set(value: T) {
      try {
        const raw = serialize(value)
        if (raw === null) localStorage.removeItem(key)
        else localStorage.setItem(key, raw)
      } catch { /* sin almacenamiento: queda solo en esta sesión */ }
      snapshot = value
      listeners.forEach((listener) => listener())
    },
    use: () => useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => snapshot),
    /** Vuelve a leer lo guardado (pruebas, o cuando otro código lo cambió). */
    refresh: notify,
  }
}
