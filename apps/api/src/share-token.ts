import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Link tokens. The database stores a random `nonce` and the SHA-256 hash of the token, never the token. The token
 * is the HMAC of the nonce under a server secret (`SHARE_LINK_SECRET`), so people who manage links can copy an
 * existing link again, while a copy of the database alone reveals no usable link. Rotating the secret
 * invalidates every link.
 */

const SECRET_MIN = 32
const SHAPE = /^[A-Za-z0-9_-]{43}$/

export const secretIsUsable = (secret: string | undefined): secret is string => typeof secret === 'string' && secret.length >= SECRET_MIN
export const newNonce = () => randomBytes(16).toString('base64url')
/** 256 bits as 43 URL-safe characters. */
export const tokenFor = (secret: string, nonce: string) => createHmac('sha256', secret).update(`share-link:${nonce}`).digest('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
/** Cheap check before touching the database: anything else cannot be a token. */
export const isTokenShape = (value: string) => SHAPE.test(value)
