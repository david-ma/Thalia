/**
 * Read-only Drizzle migration lag for gated `/health` (v1: count compare only).
 *
 * expected = number of `*.sql` files in the migrations out folder (not meta/)
 * applied  = row count in `__drizzle_migrations` (0 if table missing)
 * pending  = max(0, expected - applied)
 *
 * Deliberately does not verify SHA-256 hashes, journal `when`, or live schema.
 * Prefer this in-process check over Nexus SSH probes for Thalia sites.
 */

import fs from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'

export type DrizzleMigrationCompare = {
  expected: number
  applied: number
  pending: number
  /** False when the migrations ledger table is missing. */
  migrationsTable: boolean
  upToDate: boolean
  /** True when applied > expected (ledger ahead of disk — odd, still fail). */
  ledgerAhead: boolean
}

/** Present when the site has a migrations folder worth checking. */
export type WebsiteHealthMigrationsChecked = DrizzleMigrationCompare & {
  checked: true
}

/** Present when we skip the check (no fail impact on /health ok). */
export type WebsiteHealthMigrationsSkipped = {
  checked: false
  reason: 'no-db' | 'no-drizzle-config' | 'no-migrations-dir' | 'error'
  error?: string
}

export type WebsiteHealthMigrationsStatus =
  | WebsiteHealthMigrationsChecked
  | WebsiteHealthMigrationsSkipped

/**
 * @param sqlFileCount count of `*.sql` under the migrations folder (not meta/)
 * @param appliedRowCount `null` means `__drizzle_migrations` does not exist
 */
export function compareDrizzleMigrationCounts(
  sqlFileCount: number,
  appliedRowCount: number | null,
): DrizzleMigrationCompare {
  if (!Number.isFinite(sqlFileCount) || sqlFileCount < 0) {
    throw new Error(`Invalid sqlFileCount: ${sqlFileCount}`)
  }

  const expected = Math.floor(sqlFileCount)
  const migrationsTable = appliedRowCount !== null
  const applied = migrationsTable ? Math.max(0, Math.floor(appliedRowCount)) : 0
  const pending = Math.max(0, expected - applied)
  const ledgerAhead = migrationsTable && applied > expected
  const upToDate = applied === expected && (migrationsTable || expected === 0)

  return {
    expected,
    applied,
    pending,
    migrationsTable,
    upToDate,
    ledgerAhead,
  }
}

/** Count top-level `*.sql` migration files (excludes `meta/`). */
export function countMigrationSqlFiles(migrationsDir: string): number {
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
  return entries.filter((e) => e.isFile() && e.name.endsWith('.sql')).length
}

type DrizzleKitConfigShape = {
  out?: string
}

function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (!Array.isArray(result)) return []
  if (result.length > 0 && Array.isArray(result[0])) {
    return result[0] as Record<string, unknown>[]
  }
  return result as Record<string, unknown>[]
}

function numberish(value: unknown): number | undefined {
  if (value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : undefined
}

function isMissingTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /doesn't exist|does not exist|no such table|unknown table|relation .* does not exist/i.test(
    msg,
  )
}

/**
 * Load `drizzle.config.ts` and resolve absolute `out` dir.
 * Returns null when config is missing or `out` is not a directory.
 */
export async function resolveMigrationsOutDir(
  rootPath: string,
): Promise<{ outDir: string } | { skipped: WebsiteHealthMigrationsSkipped }> {
  const configPath = path.join(rootPath, 'drizzle.config.ts')
  if (!fs.existsSync(configPath)) {
    return { skipped: { checked: false, reason: 'no-drizzle-config' } }
  }

  let outRel = './drizzle'
  try {
    const mod = (await import(configPath)) as { default?: DrizzleKitConfigShape }
    if (typeof mod.default?.out === 'string' && mod.default.out.trim()) {
      outRel = mod.default.out.trim()
    }
  } catch (e) {
    return {
      skipped: {
        checked: false,
        reason: 'error',
        error: e instanceof Error ? e.message : String(e),
      },
    }
  }

  const outDir = path.resolve(rootPath, outRel)
  if (!fs.existsSync(outDir) || !fs.statSync(outDir).isDirectory()) {
    return { skipped: { checked: false, reason: 'no-migrations-dir' } }
  }
  return { outDir }
}

/** `null` = ledger table missing; number = row count. */
export async function probeAppliedMigrationCount(db: {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}): Promise<number | null> {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) AS c FROM __drizzle_migrations`)
    const rows = rowsFromExecute(result)
    const row = rows[0]
    if (!row) return 0
    const c = numberish(row.c ?? row.C ?? row['COUNT(*)'] ?? Object.values(row)[0])
    return c ?? 0
  } catch (e) {
    if (isMissingTableError(e)) return null
    throw e
  }
}

/**
 * Probe migration lag for a website root + live drizzle handle.
 * Skips (no ok impact) when there is no DB, no config, or no migrations dir.
 */
export async function probeWebsiteMigrations(options: {
  rootPath: string
  drizzle: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> } | null | undefined
}): Promise<WebsiteHealthMigrationsStatus> {
  if (!options.drizzle) {
    return { checked: false, reason: 'no-db' }
  }

  const resolved = await resolveMigrationsOutDir(options.rootPath)
  if ('skipped' in resolved) return resolved.skipped

  try {
    const expected = countMigrationSqlFiles(resolved.outDir)
    const appliedRowCount = await probeAppliedMigrationCount(options.drizzle)
    const cmp = compareDrizzleMigrationCounts(expected, appliedRowCount)
    return {
      checked: true,
      ...cmp,
    }
  } catch (e) {
    return {
      checked: false,
      reason: 'error',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/** True when migrations status should fail top-level `/health` ok. */
export function migrationsFailHealth(m: WebsiteHealthMigrationsStatus): boolean {
  if (!m.checked) {
    // Config import / probe errors are actionable; missing drizzle is optional.
    return m.reason === 'error'
  }
  return !m.upToDate || m.ledgerAhead || m.pending > 0
}
