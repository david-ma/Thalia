/**
 * Persistent auth-endpoint throttle (IP + action keyed).
 *
 * Uses the same sliding-window prune helpers as `IpRateLimiter` in `thalia/util`
 * (`pruneSlidingWindowTimestamps`). Prefer that util for public forms; use this
 * module for auth lockouts (DB + `lockedUntil`).
 *
 * Five attempts in a rolling 15-minute window temporarily block that client IP
 * for that action for six hours. Manual account locking remains `users.locked`.
 * Login failures use action `logon`; other POSTs (forgot/reset/setup/signup)
 * count every submission so mail/token spam is limited without locking accounts.
 */
import crypto from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { normaliseClientIp } from '../client-ip.js'
import { pruneSlidingWindowTimestamps } from '../util/rate-limit.js'
import { authLoginThrottles } from '../../models/security-models.js'

export const MAX_BAD_PASSWORD_ATTEMPTS = 5
export const BAD_PASSWORD_WINDOW_MS = 15 * 60 * 1000
export const TEMPORARY_LOCK_MS = 6 * 60 * 60 * 1000

/** Timing-safe stand-in when the email is unknown (still run bcrypt). */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$V2A3ITlNGh7CjFv.NLE7vOYSiQ8dHb/hPvAuSL/pwOvjauOzZ5eUq'

export type AuthThrottleAction =
  | 'logon'
  | 'forgotPassword'
  | 'resetPassword'
  | 'setup'
  | 'createNewUser'

/** Row key in `auth_login_throttles.identity_hash` (sha256 hex of action + IP). */
export type LoginThrottleState = {
  identityHash: string
  failureTimestamps: Date[]
  lockedUntil: Date | null
}

export interface LoginThrottleRepository {
  get(identityHash: string): Promise<LoginThrottleState | null>
  recordFailure(identityHash: string, now: Date): Promise<LoginThrottleState>
  clear(identityHash: string): Promise<void>
}

/** Trim + lowercase for email lookup (not used as the throttle key). */
export function normaliseLoginIdentity(email: string): string {
  return email.trim().toLowerCase()
}

/** Hash of `action` + normalised IP — stored as `identity_hash`. */
export function authThrottleKeyHash(clientIp: string, action: AuthThrottleAction): string {
  const ip = normaliseClientIp(clientIp || 'unknown-ip') || 'unknown-ip'
  return crypto.createHash('sha256').update(`${action}\0${ip}`).digest('hex')
}

/** Logon bucket for this IP (same as `authThrottleKeyHash(ip, 'logon')`). */
export function loginThrottleKeyHash(clientIp: string): string {
  return authThrottleKeyHash(clientIp, 'logon')
}

export function isRequestAuthenticated(requestInfo: {
  userAuth?: { userId?: number; role?: string } | null
}): boolean {
  const auth = requestInfo.userAuth
  if (!auth) return false
  if (auth.userId != null) return true
  return Boolean(auth.role && auth.role !== 'guest')
}

/** Guest messages stay terse; signed-in operators get a clearer explanation. */
export function authRateLimitMessage(
  authenticated: boolean,
  action: AuthThrottleAction = 'logon',
): string {
  if (authenticated) {
    return 'Too many attempts from this network. Please wait a few hours and try again, or ask another administrator if you need help sooner.'
  }
  if (action === 'logon') {
    return 'Too many failed sign-in attempts. Try again later or reset your password.'
  }
  return 'Too many attempts. Try again later.'
}

/** @deprecated Prefer `pruneSlidingWindowTimestamps` from `thalia/util` for new code. */
export function pruneFailureTimestamps(timestamps: readonly Date[], now: Date): Date[] {
  return pruneSlidingWindowTimestamps(
    timestamps.map((stamp) => stamp.getTime()),
    now.getTime(),
    BAD_PASSWORD_WINDOW_MS,
  ).map((ms) => new Date(ms))
}

export function isTemporarilyLocked(state: LoginThrottleState | null, now: Date): boolean {
  return Boolean(state?.lockedUntil && state.lockedUntil.getTime() > now.getTime())
}

/**
 * Record one attempt, then hard-ban when the shared sliding window is full.
 * Same prune math as `IpRateLimiter` (`thalia/util`); auth always appends (unlike soft 429).
 */
export function nextFailureState(
  identityHash: string,
  current: LoginThrottleState | null,
  now: Date,
): LoginThrottleState {
  if (isTemporarilyLocked(current, now)) return { ...current! }

  const nowMs = now.getTime()
  const failureTimestampsMs = [
    ...pruneSlidingWindowTimestamps(
      (current?.failureTimestamps ?? []).map((stamp) => stamp.getTime()),
      nowMs,
      BAD_PASSWORD_WINDOW_MS,
    ),
    nowMs,
  ].slice(-MAX_BAD_PASSWORD_ATTEMPTS)

  const lockedUntil =
    failureTimestampsMs.length >= MAX_BAD_PASSWORD_ATTEMPTS
      ? new Date(nowMs + TEMPORARY_LOCK_MS)
      : null

  return {
    identityHash,
    failureTimestamps: failureTimestampsMs.map((ms) => new Date(ms)),
    lockedUntil,
  }
}

function mapThrottleRow(row: any): LoginThrottleState {
  return {
    identityHash: String(row.identityHash),
    failureTimestamps: Array.isArray(row.failureTimestamps)
      ? row.failureTimestamps
          .map((value: unknown) => new Date(String(value)))
          .filter((value: Date) => !Number.isNaN(value.getTime()))
      : [],
    lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
  }
}

/**
 * Drizzle implementation. Row creation + SELECT ... FOR UPDATE + update happen
 * in one transaction so simultaneous Nth failures cannot bypass the lock.
 */
export function createDrizzleLoginThrottleRepository(drizzle: any): LoginThrottleRepository {
  const table = authLoginThrottles as any

  return {
    async get(identityHash) {
      const rows = await drizzle
        .select()
        .from(table)
        .where(eq(table.identityHash, identityHash))
        .limit(1)
      return rows[0] ? mapThrottleRow(rows[0]) : null
    },

    async recordFailure(identityHash, now) {
      return drizzle.transaction(async (tx: any) => {
        await tx
          .insert(table)
          .values({
            identityHash,
            failureTimestamps: [],
            lockedUntil: null,
          })
          .onDuplicateKeyUpdate({
            set: { updatedAt: sql`CURRENT_TIMESTAMP` },
          })

        const rows = await tx
          .select()
          .from(table)
          .where(eq(table.identityHash, identityHash))
          .limit(1)
          .for('update')
        const current = rows[0] ? mapThrottleRow(rows[0]) : null
        const next = nextFailureState(identityHash, current, now)
        await tx
          .update(table)
          .set({
            failureTimestamps: next.failureTimestamps.map((stamp) => stamp.toISOString()),
            lockedUntil: next.lockedUntil,
          })
          .where(eq(table.identityHash, identityHash))
        return next
      })
    },

    async clear(identityHash) {
      await drizzle.delete(table).where(eq(table.identityHash, identityHash))
    },
  }
}

export function createMemoryLoginThrottleRepository(
  seed: LoginThrottleState[] = [],
): LoginThrottleRepository & { states: Map<string, LoginThrottleState> } {
  const states = new Map(
    seed.map((state) => [
      state.identityHash,
      {
        ...state,
        failureTimestamps: state.failureTimestamps.map((stamp) => new Date(stamp)),
        lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
      },
    ]),
  )

  return {
    states,
    async get(identityHash) {
      const state = states.get(identityHash)
      return state
        ? {
            ...state,
            failureTimestamps: state.failureTimestamps.map((stamp) => new Date(stamp)),
            lockedUntil: state.lockedUntil ? new Date(state.lockedUntil) : null,
          }
        : null
    },
    async recordFailure(identityHash, now) {
      const next = nextFailureState(identityHash, states.get(identityHash) ?? null, now)
      states.set(identityHash, next)
      return { ...next }
    },
    async clear(identityHash) {
      states.delete(identityHash)
    },
  }
}

/** Resolve a throttle repo from the website DB, or `null` if drizzle is unavailable. */
export function loginThrottleRepositoryForWebsite(website: {
  db?: { drizzle?: unknown } | null
}): LoginThrottleRepository | null {
  if (!website?.db?.drizzle) return null
  return createDrizzleLoginThrottleRepository(website.db.drizzle)
}

export type AuthThrottleRequestInfo = {
  ip?: string
  userAuth?: { userId?: number; role?: string } | null
}

/**
 * If this IP is already locked for `action`, return the user-facing error string.
 * Fail-open (null) when the throttle table is missing or errors.
 */
export async function checkAuthThrottleLimited(
  website: { db?: { drizzle?: unknown } | null },
  requestInfo: AuthThrottleRequestInfo,
  action: AuthThrottleAction,
  now = new Date(),
): Promise<string | null> {
  const repo = loginThrottleRepositoryForWebsite(website)
  if (!repo) return null
  try {
    const key = authThrottleKeyHash(String(requestInfo.ip ?? 'unknown-ip'), action)
    const current = await repo.get(key)
    if (!isTemporarilyLocked(current, now)) return null
    return authRateLimitMessage(isRequestAuthenticated(requestInfo), action)
  } catch (err) {
    console.error(`auth throttle check failed (${action}):`, err)
    return null
  }
}

/**
 * Record one attempt for `action`. Returns an error string if the IP is now locked
 * (including the attempt that crossed the threshold). Fail-open on repo errors.
 */
export async function recordAuthThrottleAttempt(
  website: { db?: { drizzle?: unknown } | null },
  requestInfo: AuthThrottleRequestInfo,
  action: AuthThrottleAction,
  now = new Date(),
): Promise<string | null> {
  const repo = loginThrottleRepositoryForWebsite(website)
  if (!repo) return null
  try {
    const key = authThrottleKeyHash(String(requestInfo.ip ?? 'unknown-ip'), action)
    const state = await repo.recordFailure(key, now)
    if (!isTemporarilyLocked(state, now)) return null
    return authRateLimitMessage(isRequestAuthenticated(requestInfo), action)
  } catch (err) {
    console.error(`auth throttle record failed (${action}):`, err)
    return null
  }
}

/** Clear a bucket after a successful action (typically logon). */
export async function clearAuthThrottle(
  website: { db?: { drizzle?: unknown } | null },
  clientIp: string,
  action: AuthThrottleAction,
): Promise<void> {
  const repo = loginThrottleRepositoryForWebsite(website)
  if (!repo) return
  try {
    await repo.clear(authThrottleKeyHash(clientIp, action))
  } catch (err) {
    console.error(`auth throttle clear failed (${action}):`, err)
  }
}
