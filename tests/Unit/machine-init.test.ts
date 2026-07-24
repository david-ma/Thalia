import { describe, expect, test } from 'bun:test'
import { mysqlTable, varchar } from 'drizzle-orm/mysql-core'
import { initialiseMachines } from '../../server/database.js'
import { DatabaseError } from '../../server/errors.js'
import type { Machine, MachineReport } from '../../server/types.js'
import type { Website } from '../../server/website.js'

const stubTable = mysqlTable('stub', {
  id: varchar('id', { length: 1 }),
})

function fakeWebsite(name = 'test-site'): Website {
  return { name } as Website
}

function okMachine(delayMs = 0): Machine {
  return {
    table: stubTable,
    controller: () => {},
    async init(_website, name): Promise<MachineReport> {
      if (delayMs > 0) await Bun.sleep(delayMs)
      return { name, status: 'ok', detail: 'ready' }
    },
    async health(): Promise<MachineReport> {
      return { name: 'ok', status: 'ok', detail: 'ready' }
    },
  }
}

function errorMachine(): Machine {
  return {
    table: stubTable,
    controller: () => {},
    async init(_website, name): Promise<MachineReport> {
      return { name, status: 'error', error: 'boom' }
    },
    async health(): Promise<MachineReport> {
      return { name: 'err', status: 'error', error: 'boom' }
    },
  }
}

function degradedMachine(): Machine {
  return {
    table: stubTable,
    controller: () => {},
    async init(_website, name): Promise<MachineReport> {
      return { name, status: 'degraded', detail: 'fallback adapter' }
    },
    async health(): Promise<MachineReport> {
      return { name: 'deg', status: 'degraded', detail: 'fallback adapter' }
    },
  }
}

describe('initialiseMachines', () => {
  test('waits for slow async machines before resolving', async () => {
    const slow = okMachine(80)
    const fast = okMachine(0)
    const t0 = performance.now()
    const report = await initialiseMachines(fakeWebsite(), { slow, fast })
    const elapsed = performance.now() - t0

    expect(elapsed).toBeGreaterThanOrEqual(70)
    expect(report.machines).toHaveLength(2)
    expect(report.machines.every((m) => m.status === 'ok')).toBe(true)
    expect(report.wallMs).toBeGreaterThanOrEqual(70)
    // Parallel: wall time should be closer to slow machine than sum of both
    expect(report.wallMs).toBeLessThan(200)
  })

  test('fails loud when a machine reports error', async () => {
    await expect(
      initialiseMachines(fakeWebsite(), {
        ok: okMachine(),
        bad: errorMachine(),
      }),
    ).rejects.toBeInstanceOf(DatabaseError)
  })

  test('allows degraded machines and records them', async () => {
    const report = await initialiseMachines(fakeWebsite(), {
      ok: okMachine(),
      soft: degradedMachine(),
    })
    expect(report.machines.find((m) => m.name === 'soft')?.status).toBe('degraded')
    expect(report.machines.find((m) => m.name === 'ok')?.status).toBe('ok')
  })
})
