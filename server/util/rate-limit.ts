export type IpRateLimitOptions = {
  /** Max requests allowed within `windowMs`. */
  maxRequests: number
  /** Sliding window size in milliseconds. */
  windowMs: number
  /** Injectable clock for tests. Defaults to `Date.now`. */
  now?: () => number
}

export type IpRateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number }

/**
 * In-memory sliding-window rate limiter keyed by caller-supplied string (typically client IP).
 * Suitable for single-process Thalia sites; use Redis or edge rules when horizontally scaled.
 *
 * Exported via `thalia/util` — general HTTP primitive, not part of the auth/security subsystem.
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
    const timestamps = this.prune(key, now)

    if (timestamps.length >= this.maxRequests) {
      const retryAfterMs = Math.max(1, timestamps[0]! + this.windowMs - now)
      return { allowed: false, retryAfterMs }
    }

    timestamps.push(now)
    this.hits.set(key, timestamps)
    return { allowed: true }
  }

  reset(key?: string): void {
    if (key === undefined) {
      this.hits.clear()
      return
    }
    this.hits.delete(key)
  }

  private prune(key: string, now: number): number[] {
    const windowStart = now - this.windowMs
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart)
    if (timestamps.length === 0) {
      this.hits.delete(key)
    } else {
      this.hits.set(key, timestamps)
    }
    return timestamps
  }
}
