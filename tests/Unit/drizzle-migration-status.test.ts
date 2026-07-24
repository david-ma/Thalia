import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  compareDrizzleMigrationCounts,
  countMigrationSqlFiles,
  migrationsFailHealth,
  probeWebsiteMigrations,
  resolveMigrationsOutDir,
} from '../../server/drizzle-migration-status.js'

describe('compareDrizzleMigrationCounts', () => {
  test('missing migrations table → all pending', () => {
    const cmp = compareDrizzleMigrationCounts(3, null)
    expect(cmp).toEqual({
      expected: 3,
      applied: 0,
      pending: 3,
      migrationsTable: false,
      upToDate: false,
      ledgerAhead: false,
    })
  })

  test('empty ledger → all pending', () => {
    const cmp = compareDrizzleMigrationCounts(3, 0)
    expect(cmp.pending).toBe(3)
    expect(cmp.migrationsTable).toBe(true)
    expect(cmp.upToDate).toBe(false)
  })

  test('partial apply', () => {
    const cmp = compareDrizzleMigrationCounts(3, 1)
    expect(cmp.pending).toBe(2)
    expect(cmp.upToDate).toBe(false)
  })

  test('in sync', () => {
    const cmp = compareDrizzleMigrationCounts(3, 3)
    expect(cmp.pending).toBe(0)
    expect(cmp.upToDate).toBe(true)
  })

  test('vacuous no sql and no table is up to date', () => {
    const cmp = compareDrizzleMigrationCounts(0, null)
    expect(cmp.upToDate).toBe(true)
    expect(cmp.pending).toBe(0)
  })

  test('ledger ahead of disk', () => {
    const cmp = compareDrizzleMigrationCounts(2, 5)
    expect(cmp.ledgerAhead).toBe(true)
    expect(cmp.upToDate).toBe(false)
    expect(cmp.pending).toBe(0)
  })
})

describe('migrationsFailHealth', () => {
  test('skipped no-drizzle does not fail', () => {
    expect(migrationsFailHealth({ checked: false, reason: 'no-drizzle-config' })).toBe(false)
    expect(migrationsFailHealth({ checked: false, reason: 'no-migrations-dir' })).toBe(false)
    expect(migrationsFailHealth({ checked: false, reason: 'no-db' })).toBe(false)
  })

  test('probe error fails', () => {
    expect(migrationsFailHealth({ checked: false, reason: 'error', error: 'boom' })).toBe(true)
  })

  test('pending fails', () => {
    expect(
      migrationsFailHealth({
        checked: true,
        expected: 2,
        applied: 0,
        pending: 2,
        migrationsTable: false,
        upToDate: false,
        ledgerAhead: false,
      }),
    ).toBe(true)
  })
})

describe('filesystem helpers', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true })
    }
  })

  function tmpSite(opts: { withConfig?: boolean; withSql?: number; out?: string } = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'thalia-mig-'))
    dirs.push(root)
    const outRel = opts.out ?? './drizzle'
    if (opts.withConfig) {
      fs.writeFileSync(
        path.join(root, 'drizzle.config.ts'),
        `export default { dialect: 'mysql', out: ${JSON.stringify(outRel)}, schema: './models.ts', dbCredentials: { url: 'mysql://x' } }\n`,
      )
    }
    if (opts.withSql != null) {
      const outDir = path.resolve(root, outRel)
      fs.mkdirSync(path.join(outDir, 'meta'), { recursive: true })
      for (let i = 0; i < opts.withSql; i++) {
        fs.writeFileSync(path.join(outDir, `${String(i).padStart(4, '0')}_m.sql`), '--')
      }
      fs.writeFileSync(path.join(outDir, 'meta', '_journal.json'), '{}')
    }
    return root
  }

  test('countMigrationSqlFiles ignores meta', () => {
    const root = tmpSite({ withSql: 2 })
    expect(countMigrationSqlFiles(path.join(root, 'drizzle'))).toBe(2)
  })

  test('resolveMigrationsOutDir skips when no config', async () => {
    const root = tmpSite()
    const r = await resolveMigrationsOutDir(root)
    expect(r).toEqual({ skipped: { checked: false, reason: 'no-drizzle-config' } })
  })

  test('resolveMigrationsOutDir finds out dir', async () => {
    const root = tmpSite({ withConfig: true, withSql: 1 })
    const r = await resolveMigrationsOutDir(root)
    expect('outDir' in r).toBe(true)
    if ('outDir' in r) expect(r.outDir).toBe(path.join(root, 'drizzle'))
  })

  test('probeWebsiteMigrations skips without db', async () => {
    const root = tmpSite({ withConfig: true, withSql: 1 })
    const status = await probeWebsiteMigrations({ rootPath: root, drizzle: null })
    expect(status).toEqual({ checked: false, reason: 'no-db' })
  })

  test('probeWebsiteMigrations reports pending when ledger missing', async () => {
    const root = tmpSite({ withConfig: true, withSql: 3 })
    const drizzle = {
      async execute() {
        throw new Error("Table 'x.__drizzle_migrations' doesn't exist")
      },
    }
    const status = await probeWebsiteMigrations({ rootPath: root, drizzle })
    expect(status.checked).toBe(true)
    if (status.checked) {
      expect(status.expected).toBe(3)
      expect(status.applied).toBe(0)
      expect(status.pending).toBe(3)
      expect(status.migrationsTable).toBe(false)
      expect(status.upToDate).toBe(false)
    }
  })

  test('probeWebsiteMigrations in sync', async () => {
    const root = tmpSite({ withConfig: true, withSql: 2 })
    const drizzle = {
      async execute() {
        return [[{ c: 2 }]]
      },
    }
    const status = await probeWebsiteMigrations({ rootPath: root, drizzle })
    expect(status.checked).toBe(true)
    if (status.checked) {
      expect(status.upToDate).toBe(true)
      expect(status.pending).toBe(0)
    }
  })
})
