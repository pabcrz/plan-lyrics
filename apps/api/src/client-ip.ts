import { isIP } from 'node:net'

const valid = (value: string | null | undefined) => {
  const candidate = value?.trim()
  return candidate && isIP(candidate) ? candidate : undefined
}

/**
 * Client address from the headers that Vercel's edge sets itself (it overwrites any value the client sends).
 * Only call this when the API really runs behind Vercel: anywhere else these headers are attacker controlled.
 * `x-forwarded-for` is read from the right, the entry appended by the nearest trusted hop.
 */
export function trustedClientIp(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for')?.split(',').at(-1)
  return valid(headers.get('x-vercel-forwarded-for')?.split(',').at(-1)) ?? valid(headers.get('x-real-ip')) ?? valid(forwarded)
}
