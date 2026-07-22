import { describe, expect, test } from 'bun:test'
import {
  IpRateLimiter,
  pruneSlidingWindowTimestamps,
  recordSlidingWindowHit,
} from '../../server/util/rate-limit.js'

describe('sliding window helpers (shared with auth throttle)', () => {
  test('pruneSlidingWindowTimestamps drops hits outside the window', () => {
    const now = 100_000
    expect(pruneSlidingWindowTimestamps([10_000, 50_000, 90_000], now, 60_000)).toEqual([
      50_000, 90_000,
    ])
  })

  test('recordSlidingWindowHit allows under the limit and blocks at capacity', () => {
    const windowMs = 60_000
    const max = 2
    const first = recordSlidingWindowHit([], 1_000, windowMs, max)
    expect(first.allowed).toBe(true)
    if (!first.allowed) throw new Error('expected allow')
    const second = recordSlidingWindowHit(first.timestampsMs, 2_000, windowMs, max)
    expect(second.allowed).toBe(true)
    if (!second.allowed) throw new Error('expected allow')
    const third = recordSlidingWindowHit(second.timestampsMs, 3_000, windowMs, max)
    expect(third.allowed).toBe(false)
    if (third.allowed) throw new Error('expected block')
    expect(third.retryAfterMs).toBeGreaterThan(0)
    expect(third.timestampsMs).toHaveLength(2)
  })
})

describe('IpRateLimiter', () => {
  test('allows requests under the limit', () => {
    const limiter = new IpRateLimiter({ maxRequests: 3, windowMs: 60_000 })
    expect(limiter.check('1.2.3.4')).toEqual({ allowed: true })
    expect(limiter.check('1.2.3.4')).toEqual({ allowed: true })
    expect(limiter.check('1.2.3.4')).toEqual({ allowed: true })
  })

  test('blocks when the limit is exceeded', () => {
    const limiter = new IpRateLimiter({ maxRequests: 2, windowMs: 60_000 })
    limiter.check('1.2.3.4')
    limiter.check('1.2.3.4')
    const blocked = limiter.check('1.2.3.4')
    expect(blocked.allowed).toBe(false)
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0)
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000)
    }
  })

  test('tracks keys independently', () => {
    const limiter = new IpRateLimiter({ maxRequests: 1, windowMs: 60_000 })
    expect(limiter.check('1.2.3.4').allowed).toBe(true)
    expect(limiter.check('5.6.7.8').allowed).toBe(true)
    expect(limiter.check('1.2.3.4').allowed).toBe(false)
    expect(limiter.check('5.6.7.8').allowed).toBe(false)
  })

  test('reset clears one key or all keys', () => {
    const limiter = new IpRateLimiter({ maxRequests: 1, windowMs: 60_000 })
    limiter.check('1.2.3.4')
    expect(limiter.check('1.2.3.4').allowed).toBe(false)

    limiter.reset('1.2.3.4')
    expect(limiter.check('1.2.3.4').allowed).toBe(true)

    limiter.check('5.6.7.8')
    limiter.reset()
    expect(limiter.check('5.6.7.8').allowed).toBe(true)
  })

  test('supports injectable clock for deterministic window tests', () => {
    let clock = 1_000_000
    const limiter = new IpRateLimiter({
      maxRequests: 1,
      windowMs: 60_000,
      now: () => clock,
    })

    expect(limiter.check('1.2.3.4').allowed).toBe(true)
    expect(limiter.check('1.2.3.4').allowed).toBe(false)

    clock += 30_000
    expect(limiter.check('1.2.3.4').allowed).toBe(false)

    clock += 31_000
    expect(limiter.check('1.2.3.4').allowed).toBe(true)
  })
})
