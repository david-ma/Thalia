/**
 * Persistent failed-password throttle (IP-keyed).
 *
 * Five failures in a rolling 15-minute window temporarily block that client IP
 * for six hours. Manual account locking remains `users.locked` — an attacker
 * cannot lock a victim's account by spraying their email from another IP.
 */
import crypto from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { normaliseClientIp } from '../client-ip.js'
import { authLoginThrottles } from '../../models/security-models.js'

export const MAX_BAD_PASSWORD_ATTEMPTS = 5
export const BAD_PASSWORD_WINDOW_MS = 15 * 60 * 1000
export const TEMPORARY_LOCK_MS = 6 * 60 * 60 * 1000

/** Timing-safe stand-in when the email is unknown (still run bcrypt). */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$V2A3ITlNGh7CjFv.NLE7vOYSiQ8dHb/hPvAuSL/pwOvjauOzZ5eUq'

/** Row key in `auth_login_throttles.identity_hash` (sha256 hex of normalised IP). */
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

/** Normalise client IP then sha256 — stored as `identity_hash`. */
export function loginThrottleKeyHash(clientIp: string): string {
  const ip = normaliseClientIp(clientIp || 'unknown-ip') || 'unknown-ip'
  return crypto.createHash('sha256').update(ip).digest('hex')
}

export function pruneFailureTimestamps(timestamps: readonly Date[], now: Date): Date[] {
  const cutoff = now.getTime() - BAD_PASSWORD_WINDOW_MS
  return timestamps.filter((stamp) => stamp.getTime() > cutoff && stamp.getTime() <= now.getTime())
}

export function isTemporarilyLocked(state: LoginThrottleState | null, now: Date): boolean {
  return Boolean(state?.lockedUntil && state.lockedUntil.getTime() > now.getTime())
}

export function nextFailureState(
  identityHash: string,
  current: LoginThrottleState | null,
  now: Date,
): LoginThrottleState {
  if (isTemporarilyLocked(current, now)) return { ...current! }

  const failureTimestamps = [
    ...pruneFailureTimestamps(current?.failureTimestamps ?? [], now),
    now,
  ].slice(-MAX_BAD_PASSWORD_ATTEMPTS)
  const lockedUntil =
    failureTimestamps.length >= MAX_BAD_PASSWORD_ATTEMPTS
      ? new Date(now.getTime() + TEMPORARY_LOCK_MS)
      : null

  return { identityHash, failureTimestamps, lockedUntil }
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
