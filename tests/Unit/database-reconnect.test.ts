import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  DEFAULT_DB_RETRY_DELAYS_SECONDS,
  resolveDbRetryDelaysSeconds,
  setDbBootSleepForTests,
} from '../../server/database-boot.js'
import { ThaliaDatabase } from '../../server/database.js'
import { DatabaseError } from '../../server/errors.js'
import { buildWebsiteHealth } from '../../server/health.js'
import { Website } from '../../server/website.js'

describe('resolveDbRetryDelaysSeconds', () => {
  test('defaults to framework schedule', () => {
    expect(resolveDbRetryDelaysSeconds(undefined, {})).toEqual([...DEFAULT_DB_RETRY_DELAYS_SECONDS])
  })

  test('prefers config over default', () => {
    expect(resolveDbRetryDelaysSeconds({ retryDelaysSeconds: [1, 2, 3] }, {})).toEqual([1, 2, 3])
  })

  test('prefers env over config', () => {
    expect(
      resolveDbRetryDelaysSeconds(
        { retryDelaysSeconds: [1, 2] },
        { THALIA_DB_RETRY_DELAYS: '0,0.5,1' },
      ),
    ).toEqual([0, 0.5, 1])
  })

  test('ignores invalid env and falls through', () => {
    expect(
      resolveDbRetryDelaysSeconds(
        { retryDelaysSeconds: [7] },
        { THALIA_DB_RETRY_DELAYS: 'nope' },
      ),
    ).toEqual([7])
  })
})

describe('Website database reconnect', () => {
  const tmpRoots: string[] = []
  let initSpy: ReturnType<typeof spyOn> | undefined

  afterEach(async () => {
    setDbBootSleepForTests(null)
    initSpy?.mockRestore()
    initSpy = undefined
    while (tmpRoots.length > 0) {
      const root = tmpRoots.pop()
      if (root) fs.rmSync(root, { recursive: true, force: true })
    }
  })

  function writeSite(opts?: { retryDelaysSeconds?: number[] }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-db-reconnect-'))
    tmpRoots.push(root)
    fs.mkdirSync(path.join(root, 'config'), { recursive: true })
    const delays = opts?.retryDelaysSeconds
    const boot =
      delays != null
        ? `boot: { retryDelaysSeconds: ${JSON.stringify(delays)} },`
        : ''
    fs.writeFileSync(
      path.join(root, 'config', 'config.ts'),
      `export const config = {
        domains: ['localhost'],
        database: {
          schemas: {},
          ${boot}
        },
      }
`,
    )
    fs.writeFileSync(
      path.join(root, 'drizzle.config.ts'),
      `export default {
        dialect: 'mysql',
        dbCredentials: { url: 'mysql://unused:unused@127.0.0.1:3306/unused' },
      }
`,
    )
    return root
  }

  test('fail then succeed attaches db without process restart', async () => {
    const root = writeSite({ retryDelaysSeconds: [0, 0] })
    const sleeps: number[] = []
    setDbBootSleepForTests(async (ms) => {
      sleeps.push(ms)
    })

    let calls = 0
    initSpy = spyOn(ThaliaDatabase.prototype, 'init').mockImplementation(async function (
      this: ThaliaDatabase,
    ) {
      calls += 1
      if (calls < 3) {
        throw new DatabaseError(`fail #${calls}`, { website: 'db-reconnect-test', originalError: 'down' })
      }
      ;(this as { drizzle: unknown }).drizzle = {
        execute: async () => [[]],
      }
      return this
    })

    const website = await Website.create({
      name: 'db-reconnect-test',
      rootPath: root,
      mode: 'standalone',
      port: 0,
    })

    expect(website.db?.drizzle).toBeFalsy()
    expect(website.getDatabaseReconnectStatus().reconnecting).toBe(true)

    // Wait for schedule: two zero-delay retries after immediate fail → success on call 3
    for (let i = 0; i < 40 && !website.db?.drizzle; i++) {
      await Bun.sleep(10)
    }

    expect(calls).toBeGreaterThanOrEqual(3)
    expect(website.db?.drizzle).toBeTruthy()
    expect(website.getDatabaseReconnectStatus()).toEqual({
      reconnecting: false,
      attemptIndex: 0,
      nextAttemptAt: null,
      scheduleExhausted: false,
    })
    expect(sleeps.length).toBeGreaterThanOrEqual(1)

    const snap = await buildWebsiteHealth(website)
    expect(snap.db.connected).toBe(true)
    expect(snap.db.reconnecting).toBe(false)

    await website.closeDatabase()
  })

  test('reloadDatabase is a no-op when already connected', async () => {
    const root = writeSite({ retryDelaysSeconds: [] })
    initSpy = spyOn(ThaliaDatabase.prototype, 'init').mockImplementation(async function (
      this: ThaliaDatabase,
    ) {
      ;(this as { drizzle: unknown }).drizzle = {
        execute: async () => [[]],
      }
      return this
    })

    const website = await Website.create({
      name: 'db-already-up',
      rootPath: root,
      mode: 'standalone',
      port: 0,
    })

    expect(website.db?.drizzle).toBeTruthy()
    const callsBefore = initSpy.mock.calls.length
    expect(await website.reloadDatabase()).toBe(true)
    expect(initSpy.mock.calls.length).toBe(callsBefore)
    expect(website.getDatabaseReconnectStatus().reconnecting).toBe(false)

    await website.closeDatabase()
  })

  test('schedule exhaustion leaves db null and marks status', async () => {
    const root = writeSite({ retryDelaysSeconds: [0] })
    setDbBootSleepForTests(async () => {})

    initSpy = spyOn(ThaliaDatabase.prototype, 'init').mockImplementation(async function () {
      throw new DatabaseError('always down', { website: 'db-exhaust', originalError: 'down' })
    })

    const website = await Website.create({
      name: 'db-exhaust',
      rootPath: root,
      mode: 'standalone',
      port: 0,
    })

    for (let i = 0; i < 40 && !website.getDatabaseReconnectStatus().scheduleExhausted; i++) {
      await Bun.sleep(10)
    }

    expect(website.db?.drizzle).toBeFalsy()
    const status = website.getDatabaseReconnectStatus()
    expect(status.reconnecting).toBe(false)
    expect(status.scheduleExhausted).toBe(true)
    expect(status.attemptIndex).toBe(1)

    const snap = await buildWebsiteHealth(website)
    expect(snap.db.connected).toBe(false)
    expect(snap.db.scheduleExhausted).toBe(true)
    expect(snap.ok).toBe(false)

    await website.closeDatabase()
  })

  test('closeDatabase interrupts hung backoff without waiting for sleep', async () => {
    const root = writeSite({ retryDelaysSeconds: [60] })
    setDbBootSleepForTests(() => new Promise(() => {})) // never resolves on its own

    initSpy = spyOn(ThaliaDatabase.prototype, 'init').mockImplementation(async function () {
      throw new DatabaseError('always down', { website: 'db-close-sleep', originalError: 'down' })
    })

    const website = await Website.create({
      name: 'db-close-sleep',
      rootPath: root,
      mode: 'standalone',
      port: 0,
    })

    expect(website.getDatabaseReconnectStatus().reconnecting).toBe(true)

    const t0 = performance.now()
    await website.closeDatabase()
    expect(performance.now() - t0).toBeLessThan(500)
    expect(website.getDatabaseReconnectStatus().reconnecting).toBe(false)
    expect(await website.reloadDatabase()).toBe(false)
  })

  test('closeDatabase discards a late successful reconnect and closes its pool', async () => {
    const root = writeSite({ retryDelaysSeconds: [0] })
    setDbBootSleepForTests(async () => {})

    let releaseInit!: () => void
    const initGate = new Promise<void>((resolve) => {
      releaseInit = resolve
    })
    let calls = 0
    let poolsClosed = 0

    initSpy = spyOn(ThaliaDatabase.prototype, 'init').mockImplementation(async function (
      this: ThaliaDatabase,
    ) {
      calls += 1
      if (calls === 1) {
        throw new DatabaseError('fail first', { website: 'db-late', originalError: 'down' })
      }
      await initGate
      ;(this as { drizzle: unknown }).drizzle = {
        execute: async () => [[]],
      }
      return this
    })

    const closeSpy = spyOn(ThaliaDatabase.prototype, 'closeMysqlPool').mockImplementation(
      async function () {
        poolsClosed += 1
      },
    )

    try {
      const website = await Website.create({
        name: 'db-late',
        rootPath: root,
        mode: 'standalone',
        port: 0,
      })

      for (let i = 0; i < 40 && calls < 2; i++) {
        await Bun.sleep(10)
      }
      expect(calls).toBe(2)

      const closing = website.closeDatabase()
      releaseInit()
      await closing

      expect(website.db?.drizzle).toBeFalsy()
      expect(poolsClosed).toBeGreaterThan(0)
      expect(await website.reloadDatabase()).toBe(false)
    } finally {
      closeSpy.mockRestore()
    }
  })
})
