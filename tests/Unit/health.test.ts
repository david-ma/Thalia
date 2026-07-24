import { describe, expect, test } from 'bun:test'
import type { IncomingMessage } from 'node:http'
import { mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import {
  buildWebsiteHealth,
  evaluateHealthTokenGate,
  extractHealthToken,
  healthTokensEqual,
  thaliaHealthTokenFromEnv,
} from '../../server/health.js'
import type { Machine, MachineReport } from '../../server/types.js'
import type { Website } from '../../server/website.js'

const stubTable = mysqlTable('health_stub', {
  id: varchar('id', { length: 1 }),
})

function fakeReq(headers: Record<string, string | string[] | undefined>): IncomingMessage {
  return { headers } as IncomingMessage
}

describe('thaliaHealthTokenFromEnv', () => {
  test('null when unset or blank', () => {
    expect(thaliaHealthTokenFromEnv({})).toBeNull()
    expect(thaliaHealthTokenFromEnv({ THALIA_HEALTH_TOKEN: '' })).toBeNull()
    expect(thaliaHealthTokenFromEnv({ THALIA_HEALTH_TOKEN: '   ' })).toBeNull()
  })

  test('trims configured token', () => {
    expect(thaliaHealthTokenFromEnv({ THALIA_HEALTH_TOKEN: '  secret  ' })).toBe('secret')
  })
})

describe('extractHealthToken', () => {
  test('reads Bearer authorization', () => {
    expect(extractHealthToken(fakeReq({ authorization: 'Bearer abc' }))).toBe('abc')
    expect(extractHealthToken(fakeReq({ authorization: 'bearer xyz' }))).toBe('xyz')
  })

  test('reads X-Thalia-Health-Token', () => {
    expect(extractHealthToken(fakeReq({ 'x-thalia-health-token': 'hdr' }))).toBe('hdr')
  })

  test('prefers header over Bearer when both set', () => {
    expect(
      extractHealthToken(
        fakeReq({
          authorization: 'Bearer from-auth',
          'x-thalia-health-token': 'from-header',
        }),
      ),
    ).toBe('from-header')
  })
})

describe('healthTokensEqual', () => {
  test('matches equal tokens', () => {
    expect(healthTokensEqual('a', 'a')).toBe(true)
  })

  test('rejects different length or value', () => {
    expect(healthTokensEqual('ab', 'a')).toBe(false)
    expect(healthTokensEqual('ab', 'ac')).toBe(false)
  })
})

describe('evaluateHealthTokenGate', () => {
  test('disabled when env token missing', () => {
    expect(evaluateHealthTokenGate(fakeReq({}), {})).toBe('disabled')
  })

  test('unauthorized when token missing or wrong', () => {
    const env = { THALIA_HEALTH_TOKEN: 'correct' }
    expect(evaluateHealthTokenGate(fakeReq({}), env)).toBe('unauthorized')
    expect(
      evaluateHealthTokenGate(fakeReq({ authorization: 'Bearer wrong' }), env),
    ).toBe('unauthorized')
  })

  test('ok when Bearer matches', () => {
    const env = { THALIA_HEALTH_TOKEN: 'correct' }
    expect(
      evaluateHealthTokenGate(fakeReq({ authorization: 'Bearer correct' }), env),
    ).toBe('ok')
  })
})

describe('buildWebsiteHealth', () => {
  test('aggregates machine health and db down without drizzle', async () => {
    const machine: Machine = {
      table: stubTable,
      controller: () => {},
      async init(_w, name): Promise<MachineReport> {
        return { name, status: 'ok' }
      },
      async health(): Promise<MachineReport> {
        return { name: 'm1', status: 'ok', detail: 'ready' }
      },
    }

    const website = {
      name: 'demo',
      db: {
        machines: { m1: machine },
        lastInitReport: {
          website: 'demo',
          wallMs: 12,
          machines: [{ name: 'm1', status: 'ok', durationMs: 5 }],
        },
      },
    } as unknown as Website

    const snap = await buildWebsiteHealth(website)
    expect(snap.website).toBe('demo')
    expect(snap.db.connected).toBe(false)
    expect(snap.ok).toBe(false)
    expect(snap.machines).toEqual([{ name: 'm1', status: 'ok', detail: 'ready' }])
    expect(snap.lastInit?.wallMs).toBe(12)
  })
})
