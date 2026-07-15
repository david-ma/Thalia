import { describe, expect, test } from 'bun:test'
import { IpRateLimiter } from '../../server/util/rate-limit.js'

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
