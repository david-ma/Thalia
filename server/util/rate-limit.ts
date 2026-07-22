/**
 * HTTP rate limiting primitives (`thalia/util`).
 *
 * ## Which tool should I use?
 *
 * | Need | Use |
 * | ---- | --- |
 * | Public form / API spam backstop (contact, search, webhooks) | **`IpRateLimiter`** — in-memory, returns 429 + `Retry-After` |
 * | Auth lockout (logon, forgot/reset password, setup, signup) | **`thalia/security`** `login-throttle` — DB-backed, 6h ban, action keys |
 *
 * Shared sliding-window math lives here so we do not invent a third copy.
 * Auth throttle imports `pruneSlidingWindowTimestamps` / `recordSlidingWindowHit`.
 *
 * ## Where to call it
 *
 * **Controller level (recommended):** one module-scoped `new IpRateLimiter({…})`, then
 * `limiter.check(requestInfo.ip)` at the top of the POST handler (see UBC `contactUbcController`).
 *
 * **Route guard:** not wired today. Possible later via optional `RouteRule` fields, but auth
 * needs “count failures only” / “clear on success”, which belongs in the controller.
 * Prefer controllers for site-specific limits.
 *
 * @see `server/security/login-throttle.ts` for persistent auth lockouts
 */

export type IpRateLimitOptions = {
  /** Max requests allowed within `windowMs`. */
  maxRequests: number
  /** Sliding window size in milliseconds. */
  windowMs: number
  /** Injectable clock for tests. Defaults to `Date.now`. */
  now?: () => number
}

export type IpRateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number }

/** Drop hits at or before `nowMs - windowMs`. Input/output are epoch milliseconds. */
export function pruneSlidingWindowTimestamps(
  timestampsMs: readonly number[],
  nowMs: number,
  windowMs: number,
): number[] {
  const cutoff = nowMs - windowMs
  return timestampsMs.filter((t) => t > cutoff && t <= nowMs)
}

/**
 * If already at capacity, return blocked + retry delay.
 * Otherwise append `nowMs` and return the new window (caller stores it).
 */
export function recordSlidingWindowHit(
  timestampsMs: readonly number[],
  nowMs: number,
  windowMs: number,
  maxRequests: number,
): { allowed: true; timestampsMs: number[] } | { allowed: false; retryAfterMs: number; timestampsMs: number[] } {
  const pruned = pruneSlidingWindowTimestamps(timestampsMs, nowMs, windowMs)
  if (pruned.length >= maxRequests) {
    const oldest = pruned[0] ?? nowMs
    return {
      allowed: false,
      retryAfterMs: Math.max(1, oldest + windowMs - nowMs),
      timestampsMs: pruned,
    }
  }
  const next = [...pruned, nowMs]
  return { allowed: true, timestampsMs: next }
}

/**
 * In-memory sliding-window rate limiter keyed by caller-supplied string (typically client IP).
 * Suitable for single-process Thalia sites; use Redis or edge rules when horizontally scaled.
 *
 * Exported via `thalia/util`.
 *
 * @example
 * ```ts
 * import { IpRateLimiter } from 'thalia/util'
 * const limiter = new IpRateLimiter({ maxRequests: 5, windowMs: 15 * 60 * 1000 })
 * const result = limiter.check(requestInfo.ip)
 * if (!result.allowed) {
 *   res.writeHead(429, { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) })
 *   res.end('Too many submissions. Please try again later.')
 *   return
 * }
 * ```
 */
export class IpRateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly hits = new Map<string, number[]>()

  constructor(options: IpRateLimitOptions) {
    this.maxRequests = options.maxRequests
    this.windowMs = options.windowMs
    this.now = options.now ?? Date.now
  }

  check(key: string): IpRateLimitResult {
    const now = this.now()
    const current = this.hits.get(key) ?? []
    const result = recordSlidingWindowHit(current, now, this.windowMs, this.maxRequests)
    if (!result.allowed) {
      this.hits.set(key, result.timestampsMs)
      return { allowed: false, retryAfterMs: result.retryAfterMs }
    }
    this.hits.set(key, result.timestampsMs)
    return { allowed: true }
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.hits.clear()
      return
    }
    this.hits.delete(key)
  }
}
