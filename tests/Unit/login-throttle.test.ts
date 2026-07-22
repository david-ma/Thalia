import { describe, expect, test } from 'bun:test'
import {
  BAD_PASSWORD_WINDOW_MS,
  createMemoryLoginThrottleRepository,
  isTemporarilyLocked,
  loginThrottleKeyHash,
  MAX_BAD_PASSWORD_ATTEMPTS,
  nextFailureState,
  normaliseLoginIdentity,
  pruneFailureTimestamps,
  TEMPORARY_LOCK_MS,
} from '../../server/security/login-throttle.js'

describe('login throttle policy (IP-keyed)', () => {
  test('constants encode five failures / fifteen minutes / six hours', () => {
    expect(MAX_BAD_PASSWORD_ATTEMPTS).toBe(5)
    expect(BAD_PASSWORD_WINDOW_MS).toBe(15 * 60 * 1000)
    expect(TEMPORARY_LOCK_MS).toBe(6 * 60 * 60 * 1000)
  })

  test('normalises email for lookup; throttle key hashes IP', () => {
    expect(normaliseLoginIdentity(' Jenny@Example.TEST ')).toBe('jenny@example.test')
    const hash = loginThrottleKeyHash('203.0.113.10')
    expect(hash).toHaveLength(64)
    expect(hash).toBe(loginThrottleKeyHash('203.0.113.10'))
    expect(hash).toBe(loginThrottleKeyHash('::ffff:203.0.113.10'))
    expect(hash).not.toBe(loginThrottleKeyHash('203.0.113.11'))
    expect(hash).not.toContain('203')
  })

  test('fifth rolling-window failure creates a six-hour lock', async () => {
    const repo = createMemoryLoginThrottleRepository()
    const hash = loginThrottleKeyHash('203.0.113.10')
    const start = new Date('2026-07-17T00:00:00.000Z')

    for (let i = 0; i < 4; i++) {
      const state = await repo.recordFailure(hash, new Date(start.getTime() + i * 1_000))
      expect(state.lockedUntil).toBeNull()
    }
    const fifthAt = new Date(start.getTime() + 4_000)
    const fifth = await repo.recordFailure(hash, fifthAt)
    expect(fifth.failureTimestamps).toHaveLength(5)
    expect(fifth.lockedUntil?.getTime()).toBe(fifthAt.getTime() + TEMPORARY_LOCK_MS)
    expect(isTemporarilyLocked(fifth, fifthAt)).toBe(true)
    expect(isTemporarilyLocked(fifth, new Date(fifthAt.getTime() + TEMPORARY_LOCK_MS))).toBe(false)
  })

  test('failures against one IP do not lock another IP', async () => {
    const repo = createMemoryLoginThrottleRepository()
    const attacker = loginThrottleKeyHash('198.51.100.1')
    const victim = loginThrottleKeyHash('203.0.113.50')
    const start = new Date('2026-07-17T00:00:00.000Z')

    for (let i = 0; i < 5; i++) {
      await repo.recordFailure(attacker, new Date(start.getTime() + i * 1_000))
    }
    expect(isTemporarilyLocked(await repo.get(attacker), start)).toBe(true)
    expect(await repo.get(victim)).toBeNull()
    expect(isTemporarilyLocked(await repo.get(victim), start)).toBe(false)
  })

  test('failures outside rolling window are pruned', () => {
    const now = new Date('2026-07-17T01:00:00.000Z')
    const old = new Date(now.getTime() - BAD_PASSWORD_WINDOW_MS - 1)
    const recent = new Date(now.getTime() - BAD_PASSWORD_WINDOW_MS + 1)
    expect(pruneFailureTimestamps([old, recent], now)).toEqual([recent])

    const state = nextFailureState(
      'hash',
      { identityHash: 'hash', failureTimestamps: [old], lockedUntil: null },
      now,
    )
    expect(state.failureTimestamps).toEqual([now])
    expect(state.lockedUntil).toBeNull()
  })

  test('clear removes repository state', async () => {
    const repo = createMemoryLoginThrottleRepository()
    const hash = loginThrottleKeyHash('192.0.2.1')
    await repo.recordFailure(hash, new Date())
    expect((await repo.get(hash))?.failureTimestamps).toHaveLength(1)
    await repo.clear(hash)
    expect(await repo.get(hash)).toBeNull()
  })
})
