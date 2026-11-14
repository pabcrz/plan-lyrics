/**
 * Fixed-window limiter kept in memory, per process. It slows down guessing and scraping of public links; it is not
 * shared between instances, which is enough while the API runs as one process.
 */
export function createLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }) {
  const windows = new Map<string, { start: number; count: number }>()
  const allow = (key: string) => {
    const at = now()
    if (windows.size >= maxKeys) for (const [name, window] of windows) if (at - window.start >= windowMs) windows.delete(name)
    const window = windows.get(key)
    if (!window || at - window.start >= windowMs) { windows.set(key, { start: at, count: 1 }); return true }
    window.count += 1
    return window.count <= limit
  }
  allow.size = () => windows.size
  return allow
}
export type Limiter = ReturnType<typeof createLimiter>
