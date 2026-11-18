const loopback = new Set(['127.0.0.1', 'localhost', '[::1]'])

function exactOrigin(value: string) {
  try {
    const url = new URL(value)
    if (url.origin !== value || url.hostname.includes('*')) return undefined
    if (url.protocol === 'https:' || (url.protocol === 'http:' && loopback.has(url.hostname))) return url.origin
  } catch { /* not a URL */ }
  return undefined
}

/**
 * `WEB_ORIGIN`: one or more exact web origins separated by commas. No wildcards, paths or plain http outside loopback.
 * Invalid entries are dropped and counted, never widened: an empty result means no cross-origin access at all.
 */
export function parseWebOrigins(value: string | undefined) {
  const origins: string[] = []
  let rejected = 0
  for (const entry of (value ?? '').split(',').map(part => part.trim()).filter(Boolean)) {
    const origin = exactOrigin(entry)
    if (origin) origins.push(origin)
    else rejected += 1
  }
  return { origins, rejected }
}
