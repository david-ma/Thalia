import { describe, expect, test } from 'bun:test'
import type { IncomingMessage, ServerResponse } from 'http'
import { sessions } from '../../models/security-models.js'
import { assertSameOriginMutation } from '../../server/security/same-origin.js'
import { revokeOtherSessionsForUser } from '../../server/security/session-revoke.js'
import {
  createProfilePasswordController,
  profilePasswordControllerTree,
} from '../../server/security/profile-password.js'
import { createMemoryLoginThrottleRepository } from '../../server/security/login-throttle.js'
import { ThaliaSecurity } from '../../server/security/thalia-security.js'
import type { RoleRouteRule } from '../../server/route-guard.js'
import { config } from '../../websites/example-auth/config/config.js'

function makeRes() {
  let body = ''
  const res: any = {
    statusCode: 200,
    headersSent: false,
    setHeader() {},
    writeHead(code: number) {
      this.statusCode = code
    },
    end(chunk?: string) {
      if (chunk) body = chunk
      this.headersSent = true
    },
    getBody: () => body,
    json() {
      return JSON.parse(body || '{}')
    },
  }
  return res as ServerResponse & { json: () => any; getBody: () => string; statusCode: number }
}

function makeReq(body: unknown, origin = 'http://localhost:1337'): IncomingMessage {
  const chunks = Buffer.from(JSON.stringify(body))
  const req = {
    method: 'POST',
    headers: { host: 'localhost:1337', origin },
    async *[Symbol.asyncIterator]() {
      yield chunks
    },
    on(event: string, cb: Function) {
      if (event === 'data') queueMicrotask(() => cb(chunks))
      if (event === 'end') queueMicrotask(() => cb())
      return req
    },
    off() {},
  }
  return req as unknown as IncomingMessage
}

describe('assertSameOriginMutation', () => {
  test('allows matching Origin host', () => {
    const req = {
      headers: { host: 'example.test:3000', origin: 'https://example.test:3000' },
    } as IncomingMessage
    expect(assertSameOriginMutation(req, { host: 'example.test:3000' })).toBe(true)
  })
  test('rejects mismatched Origin and missing Origin+Referer', () => {
    const bad = { headers: { host: 'a.test', origin: 'https://evil.test' } } as IncomingMessage
    expect(assertSameOriginMutation(bad, { host: 'a.test' })).toBe(false)
    const bare = { headers: { host: 'a.test' } } as IncomingMessage
    expect(assertSameOriginMutation(bare, { host: 'a.test' })).toBe(false)
  })
})

describe('revokeOtherSessionsForUser', () => {
  test('UPDATE loggedOut for other sessions', async () => {
    let sawLoggedOut = false
    const drizzle = {
      update() {
        return {
          set(values: { loggedOut: boolean }) {
            expect(values).toEqual({ loggedOut: true })
            sawLoggedOut = true
            return {
              where() {
                return Promise.resolve()
              },
            }
          },
        }
      },
    }
    await revokeOtherSessionsForUser(drizzle as never, sessions as never, 7, 'keep-me')
    expect(sawLoggedOut).toBe(true)
  })
})

describe('profile password API', () => {
  test('securityConfig registers controller and /api/profile route by default', () => {
    const cfg = new ThaliaSecurity().securityConfig()
    expect(typeof (cfg.controllers as any)?.api?.profile?.password).toBe('function')
    const route = (cfg.routes ?? []).find((r) => r.path === '/api/profile') as RoleRouteRule | undefined
    expect(route?.permissions?.user).toEqual(expect.arrayContaining(['create', 'update', 'read']))
    expect(route?.permissions?.guest).toBeUndefined()
  })

  test('disablePasswordChange omits controller and route', () => {
    const cfg = new ThaliaSecurity({ disablePasswordChange: true }).securityConfig()
    expect((cfg.controllers as any)?.api?.profile?.password).toBeUndefined()
    expect((cfg.routes ?? []).some((r) => r.path === '/api/profile')).toBe(false)
  })

  test('example-auth inherits password API from securityConfig (no site re-wire)', () => {
    expect(typeof (config.controllers as any)?.api?.profile?.password).toBe('function')
    const route = (config.routes ?? []).find((r) => r.path === '/api/profile') as RoleRouteRule | undefined
    expect(route?.permissions?.user).toEqual(expect.arrayContaining(['create', 'update', 'read']))
  })

  test('profilePasswordControllerTree nests under api.profile.password', () => {
    const controller = createProfilePasswordController()
    const tree = profilePasswordControllerTree(controller)
    expect(tree.api.profile.password).toBe(controller)
  })

  test('requires auth; rejects identity spoof; updates and soft-revokes others', async () => {
    const hashes = new Map<string, string>([['hash-old', 'old-secret']])
    let updatedPassword: string | null = null
    let otherRevokeCalled = false
    const throttle = createMemoryLoginThrottleRepository()

    const usersTable = { id: 'id' }
    const sessionsTable = { userId: 'userId', sid: 'sid', loggedOut: 'loggedOut' }
    const website: any = {
      db: {
        machines: { users: { table: usersTable }, sessions: { table: sessionsTable } },
        drizzle: {
          select() {
            return {
              from() {
                return {
                  where() {
                    return {
                      limit() {
                        return Promise.resolve([
                          { id: 7, email: 'jenny@example.test', password: 'hash-old', locked: false },
                        ])
                      },
                    }
                  },
                }
              },
            }
          },
          update(table: unknown) {
            return {
              set(values: Record<string, unknown>) {
                if (table === sessionsTable || values.loggedOut === true) {
                  otherRevokeCalled = true
                }
                if (typeof values.password === 'string') {
                  updatedPassword = values.password
                }
                return {
                  where() {
                    return Promise.resolve()
                  },
                }
              },
            }
          },
        },
      },
    }

    const controller = createProfilePasswordController({
      verifyPassword: async (password, hash) => hashes.get(hash) === password,
      hashPassword: async (p) => `hashed:${p}`,
      getThrottleRepository: () => throttle,
      writeAudit: async () => {},
    })

    const guest = makeRes()
    await controller(guest, makeReq({}), website, { pathname: '/api/profile/password' } as any)
    expect(guest.statusCode).toBe(401)

    const wrong = makeRes()
    await controller(
      wrong,
      makeReq({
        currentPassword: 'nope',
        newPassword: 'new-secret1',
        confirmPassword: 'new-secret1',
      }),
      website,
      {
        pathname: '/api/profile/password',
        host: 'localhost:1337',
        ip: '127.0.0.1',
        userAuth: { role: 'user', userId: 7, name: 'jenny', sessionId: 'sess-a' },
      } as any,
    )
    expect(wrong.statusCode).toBe(403)
    expect(wrong.json().code).toBe('CURRENT_PASSWORD_WRONG')

    const spoof = makeRes()
    await controller(
      spoof,
      makeReq({
        email: 'admin@example.test',
        userId: 1,
        currentPassword: 'old-secret',
        newPassword: 'new-secret1',
        confirmPassword: 'new-secret1',
      }),
      website,
      {
        pathname: '/api/profile/password',
        host: 'localhost:1337',
        userAuth: { role: 'user', userId: 7, name: 'jenny', sessionId: 'sess-a' },
      } as any,
    )
    expect(spoof.statusCode).toBe(400)
    expect(spoof.json().code).toBe('IDENTITY_NOT_ALLOWED')
    expect(updatedPassword).toBe(null)

    const ok = makeRes()
    await controller(
      ok,
      makeReq({
        currentPassword: 'old-secret',
        newPassword: 'new-secret1',
        confirmPassword: 'new-secret1',
      }),
      website,
      {
        pathname: '/api/profile/password',
        host: 'localhost:1337',
        ip: '127.0.0.1',
        userAuth: { role: 'user', userId: 7, name: 'jenny', sessionId: 'sess-a' },
      } as any,
    )
    expect(ok.statusCode).toBe(200)
    expect(ok.json().ok).toBe(true)
    expect(ok.json().otherSessionsRevoked).toBe(true)
    expect(updatedPassword as string | null).toBe('hashed:new-secret1')
    expect(otherRevokeCalled).toBe(true)

    updatedPassword = null
    website.db.drizzle.update = (table: unknown) => ({
      set(values: Record<string, unknown>) {
        if (typeof values.password === 'string') {
          updatedPassword = values.password
        }
        return {
          where() {
            if (table === sessionsTable || values.loggedOut === true) {
              return Promise.reject(new Error('Failed query: update sessions'))
            }
            return Promise.resolve()
          },
        }
      },
    })
    const revokeFail = makeRes()
    await controller(
      revokeFail,
      makeReq({
        currentPassword: 'old-secret',
        newPassword: 'new-secret2',
        confirmPassword: 'new-secret2',
      }),
      website,
      {
        pathname: '/api/profile/password',
        host: 'localhost:1337',
        userAuth: { role: 'user', userId: 7, name: 'jenny', sessionId: 'sess-a' },
      } as any,
    )
    expect(revokeFail.statusCode).toBe(200)
    expect(revokeFail.json()).toEqual({ ok: true, otherSessionsRevoked: false })
    expect(updatedPassword as string | null).toBe('hashed:new-secret2')
  })
})
