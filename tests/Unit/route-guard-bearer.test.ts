import { describe, expect, test } from 'bun:test'
import type { IncomingMessage } from 'http'
import {
  parseBearerAuthorizationHeader,
  resolveBearerUserAuthIfConfigured,
} from '../../server/route-guard.js'
import type { Website } from '../../server/website.js'
import type { RequestInfo } from '../../server/server.js'

function fakeReq(authorization?: string): IncomingMessage {
  return { headers: authorization ? { authorization } : {} } as IncomingMessage
}

function fakeInfo(pathname = '/david/json'): RequestInfo {
  return { pathname } as RequestInfo
}

describe('parseBearerAuthorizationHeader', () => {
  test('reads a Bearer token', () => {
    expect(parseBearerAuthorizationHeader('Bearer hlxt_abc')).toBe('hlxt_abc')
    expect(parseBearerAuthorizationHeader('bearer hlxt_abc')).toBe('hlxt_abc')
  })

  test('rejects missing or malformed values', () => {
    expect(parseBearerAuthorizationHeader(undefined)).toBe('')
    expect(parseBearerAuthorizationHeader('Basic abc')).toBe('')
    expect(parseBearerAuthorizationHeader('Bearer')).toBe('')
  })
})

describe('resolveBearerUserAuthIfConfigured', () => {
  test('returns user auth from the site hook', async () => {
    const website = {
      config: {
        resolveBearerUserAuth: async function (this: Website, token: string) {
          expect(token).toBe('hlxt_abc')
          return { role: 'user' as const, userId: 7, name: 'david' }
        },
      },
    } as unknown as Website

    const auth = await resolveBearerUserAuthIfConfigured(
      website,
      fakeReq('Bearer hlxt_abc'),
      fakeInfo(),
    )
    expect(auth?.role).toBe('user')
    expect(auth?.userId).toBe(7)
  })

  test('ignores guest results and missing hooks so cookies can still apply', async () => {
    expect(
      await resolveBearerUserAuthIfConfigured(
        { config: {} } as Website,
        fakeReq('Bearer hlxt_abc'),
        fakeInfo(),
      ),
    ).toBeNull()

    const website = {
      config: {
        resolveBearerUserAuth: async () => ({ role: 'guest' as const }),
      },
    } as unknown as Website
    expect(
      await resolveBearerUserAuthIfConfigured(website, fakeReq('Bearer hlxt_abc'), fakeInfo()),
    ).toBeNull()
  })

  test('hook errors fall through instead of crashing the request', async () => {
    const website = {
      config: {
        resolveBearerUserAuth: async () => {
          throw new Error('db down')
        },
      },
    } as unknown as Website
    expect(
      await resolveBearerUserAuthIfConfigured(website, fakeReq('Bearer hlxt_abc'), fakeInfo()),
    ).toBeNull()
  })
})
