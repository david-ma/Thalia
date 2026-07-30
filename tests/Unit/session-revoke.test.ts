import { describe, expect, test } from 'bun:test'
import { sessions } from '../../models/security-models.js'
import {
  revokeSessionBySid,
  revokeSessionsForUser,
  type SessionRevokeDrizzle,
} from '../../server/security/session-revoke.js'

/**
 * Mock drizzle that records soft-revoke UPDATEs.
 * Also exposes DELETE that rejects with errno 1451 when audits are “linked”
 * (documents why hard-DELETE must not be used).
 */
function createMockDrizzle(auditLinked: boolean) {
  const updates: Array<{ loggedOut: boolean }> = []
  let deleteAttempts = 0

  const drizzle: SessionRevokeDrizzle & {
    delete: (table: unknown) => { where: (c: unknown) => Promise<unknown> }
  } = {
    update(_table) {
      return {
        set(values: { loggedOut: boolean }) {
          return {
            where(_condition: unknown) {
              updates.push(values)
              return Promise.resolve([{ affectedRows: 1 }])
            },
          }
        },
      }
    },
    delete(_table) {
      deleteAttempts += 1
      return {
        where(_condition: unknown) {
          if (auditLinked) {
            return Promise.reject(
              Object.assign(new Error('foreign key constraint fails'), {
                errno: 1451,
                code: 'ER_ROW_IS_REFERENCED_2',
              }),
            )
          }
          return Promise.resolve([{ affectedRows: 1 }])
        },
      }
    },
  }

  return { drizzle, updates, getDeleteAttempts: () => deleteAttempts }
}

describe('session soft-revoke (logged_out)', () => {
  test('revokeSessionBySid UPDATEs loggedOut and never DELETEs', async () => {
    const { drizzle, updates, getDeleteAttempts } = createMockDrizzle(true)
    await revokeSessionBySid(drizzle, sessions as never, 'abc123')
    expect(getDeleteAttempts()).toBe(0)
    expect(updates).toEqual([{ loggedOut: true }])
  })

  test('revokeSessionsForUser UPDATEs loggedOut and never DELETEs', async () => {
    const { drizzle, updates, getDeleteAttempts } = createMockDrizzle(true)
    await revokeSessionsForUser(drizzle, sessions as never, 42)
    expect(getDeleteAttempts()).toBe(0)
    expect(updates).toEqual([{ loggedOut: true }])
  })

  test('hard DELETE of audit-linked session fails with errno 1451 (fixture)', async () => {
    const { drizzle, getDeleteAttempts } = createMockDrizzle(true)
    await expect(drizzle.delete(sessions).where({} as never)).rejects.toMatchObject({ errno: 1451 })
    expect(getDeleteAttempts()).toBe(1)
  })
})
