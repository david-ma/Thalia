/**
 * Soft-revoke session credentials. Never hard-DELETE session rows:
 * `audits.session_id` references `sessions.sid` with ON DELETE NO ACTION.
 *
 * Auth validity (`RoleRouteGuard`) requires `logged_out = false` (+ unexpired).
 */
import { eq } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

/** Minimal Drizzle surface used by soft-revoke (avoids coupling to full DB type). */
export type SessionRevokeDrizzle = {
  update: (table: MySqlTableWithColumns<any>) => {
    set: (values: { loggedOut: boolean }) => {
      where: (condition: unknown) => PromiseLike<unknown>
    }
  }
}

/**
 * Soft-revoke one session by opaque `sid` (logout of the current cookie).
 * Sets `logged_out = true`; leaves the row for audit FK integrity.
 */
export function revokeSessionBySid(
  drizzle: SessionRevokeDrizzle,
  sessionsTbl: MySqlTableWithColumns<any>,
  sid: string,
): Promise<void> {
  return drizzle
    .update(sessionsTbl)
    .set({ loggedOut: true })
    .where(eq(sessionsTbl.sid, sid))
    .then((): void => {})
}

/**
 * Soft-revoke every session for a user (password reset / bulk revoke).
 * Sets `logged_out = true`; does not DELETE.
 */
export function revokeSessionsForUser(
  drizzle: SessionRevokeDrizzle,
  sessionsTbl: MySqlTableWithColumns<any>,
  userId: number,
): Promise<void> {
  return drizzle
    .update(sessionsTbl)
    .set({ loggedOut: true })
    .where(eq(sessionsTbl.userId, userId))
    .then((): void => {})
}
