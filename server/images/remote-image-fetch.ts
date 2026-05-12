/**
 * HTTPS image fetch for UploadThing-style JSON → Thalia → SmugMug (Phase D `4a`).
 * Manual redirect handling so each hop stays on **https** and passes SSRF guards.
 */

import { SMUGMUG_REMOTE_FETCH_TIMEOUT_MS } from './constants.js'
import { smugmugLogLine } from './log.js'

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024
const DEFAULT_MAX_REDIRECTS = 8

async function discardResponseBody(res: Response): Promise<void> {
  try {
    await res.arrayBuffer()
  } catch {
    /* ignore */
  }
}

/** Best-effort block of loopback / private / link-local IPv4 literals in URL host positions. */
function isBlockedIpv4Host(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!m) return false
  const parts = [1, 2, 3, 4].map((i) => Number(m[i]))
  if (parts.some((n) => n > 255)) return true
  const [a, b] = parts
  if (a === 0) return true
  if (a === 127) return true
  if (a === 10) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isBlockedIpv6Host(host: string): boolean {
  const inner = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host
  const h = inner.toLowerCase()
  if (h === '::1') return true
  if (h.startsWith('fe80:')) return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  return false
}

/**
 * Throws if the URL is not a safe **https** image fetch target (basic SSRF guard).
 * Returns a normalised absolute `URL`.
 */
export function assertSafeHttpsImageFetchUrl(candidate: string): URL {
  let u: URL
  try {
    u = new URL(candidate)
  } catch {
    throw new Error('Invalid image URL')
  }
  if (u.protocol !== 'https:') {
    throw new Error('Only https image URLs are allowed')
  }
  if (u.username || u.password) {
    throw new Error('Image URL must not embed credentials')
  }
  const host = u.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local')) {
    throw new Error('Image host is not allowed')
  }
  if (isBlockedIpv4Host(host) || isBlockedIpv6Host(host)) {
    throw new Error('Image host is not allowed')
  }
  return u
}

/** Reads first non-empty string from common UploadThing-style field names. */
export function pickRemoteFileUrl(body: Record<string, unknown>): string | undefined {
  const keys = ['uploadThingUrl', 'fileUrl', 'url'] as const
  for (const k of keys) {
    const v = body[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export type FetchedHttpsImage = {
  buffer: Buffer
  contentType: string | undefined
}

export async function fetchRemoteHttpsImageBytes(
  urlString: string,
  options?: { maxBytes?: number; maxRedirects?: number; log?: { website?: string } },
): Promise<FetchedHttpsImage> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  const log = options?.log
  const t0 = Date.now()

  let current: URL | undefined
  try {
    current = assertSafeHttpsImageFetchUrl(urlString)

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const res = await fetch(current.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(SMUGMUG_REMOTE_FETCH_TIMEOUT_MS),
      })

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        await discardResponseBody(res)
        const loc = res.headers.get('location')
        if (!loc) {
          throw new Error('Remote image redirect missing Location header')
        }
        current = assertSafeHttpsImageFetchUrl(new URL(loc, current).href)
        continue
      }

      if (!res.ok) {
        throw new Error(`Remote image fetch failed (${res.status})`)
      }

      const cl = res.headers.get('content-length')
      if (cl) {
        const n = Number(cl)
        if (Number.isFinite(n) && n > maxBytes) {
          throw new Error('Remote image too large')
        }
      }

      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length > maxBytes) {
        throw new Error('Remote image too large')
      }

      const ct = res.headers.get('content-type')?.split(';')[0]?.trim()

      if (log) {
        smugmugLogLine({
          service: 'smugmug',
          level: 'info',
          operation: 'remote_image_fetch',
          website: log.website,
          hostname: current.hostname,
          method: 'GET',
          durationMs: Date.now() - t0,
          httpStatus: res.status,
          byteLength: buffer.length,
        })
      }

      return { buffer, contentType: ct }
    }

    throw new Error('Too many redirects when fetching remote image')
  } catch (e: unknown) {
    if (log) {
      smugmugLogLine({
        service: 'smugmug',
        level: 'error',
        operation: 'remote_image_fetch',
        website: log.website,
        hostname: current?.hostname,
        method: 'GET',
        durationMs: Date.now() - t0,
        msg: e instanceof Error ? e.message : String(e),
      })
    }
    throw e
  }
}
