import type { IncomingMessage } from 'http'

/**
 * CSRF check for cookie-authenticated mutations (POST/PUT/PATCH/DELETE).
 * Browsers send `Origin` (or `Referer`) on cross-site requests; require the host
 * to match `requestInfo.host` / `Host`. Reject when both headers are absent.
 */
export function assertSameOriginMutation(
  req: IncomingMessage,
  requestInfo: { host?: string },
): boolean {
  const host = (requestInfo.host ?? req.headers.host ?? '').toString().toLowerCase()
  if (!host) return false
  const origin = (req.headers.origin ?? '').toString()
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host
    } catch {
      return false
    }
  }
  const referer = (req.headers.referer ?? '').toString()
  if (referer) {
    try {
      return new URL(referer).host.toLowerCase() === host
    } catch {
      return false
    }
  }
  return false
}
