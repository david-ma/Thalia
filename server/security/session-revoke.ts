/**
 * Soft-revoke session credentials. Never hard-DELETE session rows:
 * `audits.session_id` references `sessions.sid` with ON DELETE NO ACTION.
 *
 * Auth validity (`RoleRouteGuard`) requires `logged_out = false` (+ unexpired).
 */
import { and, eq, ne, type SQL } from 'drizzle-orm'
import type { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'

/** Minimal Drizzle surface used by soft-revoke (avoids coupling to full DB type). */
export type SessionRevokeDrizzle = {
  update: (table: MySqlTableWithColumns<any>) => {
    set: (values: { loggedOut: boolean }) => {
      where: (condition: SQL<unknown> | undefined) => PromiseLike<unknown>
    }
  }
}

/**
 * Soft-revoke one session by opaque `sid` (logout of the current cookie).
 * Sets `logged_out = true`; leaves the row for audit FK integrity.
 */
export async function revokeSessionBySid(
  drizzle: SessionRevokeDrizzle,
  sessionsTbl: MySqlTableWithColumns<any>,
  sid: string,
): Promise<void> {
  await drizzle
    .update(sessionsTbl)
    .set({ loggedOut: true })
    .where(eq(sessionsTbl.sid, sid))
}

/**
 * Soft-revoke every session for a user (password reset / bulk revoke).
 * Sets `logged_out = true`; does not DELETE.
 */
export async function revokeSessionsForUser(
  drizzle: SessionRevokeDrizzle,
  sessionsTbl: MySqlTableWithColumns<any>,
  userId: number,
): Promise<void> {
  await drizzle
    .update(sessionsTbl)
    .set({ loggedOut: true })
    .where(eq(sessionsTbl.userId, userId))
}

/**
 * Soft-revoke every session for a user **except** `keepSid` (authenticated password change).
 * When `keepSid` is empty/missing, falls back to {@link revokeSessionsForUser}.
 */
export async function revokeOtherSessionsForUser(
  drizzle: SessionRevokeDrizzle,
  sessionsTbl: MySqlTableWithColumns<any>,
  userId: number,
  keepSid: string | undefined | null,
): Promise<void> {
  if (!keepSid) {
    return revokeSessionsForUser(drizzle, sessionsTbl, userId)
  }
  await drizzle
    .update(sessionsTbl)
    .set({ loggedOut: true })
    .where(and(eq(sessionsTbl.userId, userId), ne(sessionsTbl.sid, keepSid)))
}
