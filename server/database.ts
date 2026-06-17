/**
 * This file is the entrypoint for websites to enable a database connection.
 *
 * The Thalia framework uses drizzle-orm for database connections.
 * The Thalia framework provides table schemas in Thalia/models.
 * These schemas define the structure of tables that websites can use.
 * Websites can import these schemas to create their own tables in their database.
 *
 * Each website can have its own SQLite database in its models directory.
 * Websites can provide extra schemas in their models directory.
 * The database file will be created at websites/example/models/sqlite.db by default.
 *
 * The database connection is then provided to the website's controllers.
 * In Thalia/server/controllers.ts, we will provide a CRUD factory,
 * which will provide easy to use functions for CRUD operations.
 */

import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { getTableName, sql } from 'drizzle-orm'
import path from 'path'
import { Website } from './website'
import { Machine } from './controllers'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { DatabaseError } from './errors'
import { startupMark } from './startup-timer'

/** Row counts keyed by schema registration name (used at init and in tests). */
export type SchemaRowCounts = {
  [key: string]: number
}

export type DbDialect = 'mysql' | 'postgresql' | 'sqlite' | 'unknown'

type DrizzleKitConfigShape = {
  dialect?: string
  dbCredentials?: { url?: string; database?: string }
}

/** Infer SQL dialect from drizzle-kit config (dialect field or connection URL). */
export function inferDbDialect(drizzleConfig: DrizzleKitConfigShape): DbDialect {
  const configured = drizzleConfig.dialect
  if (configured === 'mysql' || configured === 'postgresql' || configured === 'sqlite') {
    return configured
  }

  const url = drizzleConfig.dbCredentials?.url ?? ''
  if (url.startsWith('mysql://') || url.startsWith('mariadb://')) return 'mysql'
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgresql'
  if (url.startsWith('file:') || url.includes('sqlite')) return 'sqlite'

  return 'unknown'
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

/**
 * One catalog query per database — fast row estimates for startup logging.
 * MySQL/MariaDB: information_schema.tables.TABLE_ROWS (InnoDB estimate).
 * PostgreSQL: pg_stat_user_tables.n_live_tup (planner statistics).
 * SQLite / unknown: skipped (connection already verified via SELECT 1).
 */
export async function fetchTableRowEstimatesBySqlName(
  db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  sqlTableNames: string[],
  dialect: DbDialect,
  websiteName: string,
): Promise<Map<string, number>> {
  const estimates = new Map<string, number>()
  if (sqlTableNames.length === 0) return estimates

  const uniqueNames = [...new Set(sqlTableNames)]
  const inList = sql.join(
    uniqueNames.map((name) => sql`${name}`),
    sql`, `,
  )

  try {
    if (dialect === 'mysql') {
      const result = await db.execute(sql`
        SELECT TABLE_NAME, TABLE_ROWS
        FROM information_schema.tables
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME IN (${inList})
      `)
      for (const row of rowsFromExecute(result)) {
        const tableName = String(row.TABLE_NAME ?? row.table_name ?? '')
        const rows = numberish(row.TABLE_ROWS ?? row.table_rows)
        if (tableName && rows !== undefined) estimates.set(tableName, rows)
      }
      return estimates
    }

    if (dialect === 'postgresql') {
      const result = await db.execute(sql`
        SELECT relname AS table_name, n_live_tup AS row_estimate
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND relname IN (${inList})
      `)
      for (const row of rowsFromExecute(result)) {
        const tableName = String(row.table_name ?? row.TABLE_NAME ?? row.relname ?? '')
        const rows = numberish(row.row_estimate ?? row.ROW_ESTIMATE ?? row.n_live_tup)
        if (tableName && rows !== undefined) estimates.set(tableName, rows)
      }
      return estimates
    }

    if (dialect === 'sqlite') {
      console.debug(
        `[ThaliaDatabase] SQLite has no cheap batch row estimate; skipping per-table counts (${websiteName})`,
      )
      return estimates
    }

    console.debug(
      `[ThaliaDatabase] Unknown SQL dialect "${dialect}"; skipping per-table row estimates (${websiteName})`,
    )
    return estimates
  } catch (error: unknown) {
    console.warn(
      `[ThaliaDatabase] Row estimate catalog query failed (${websiteName}, ${dialect}):`,
      error instanceof Error ? error.message : String(error),
    )
    return estimates
  }
}

/**
 * Map registered Drizzle schemas to approximate row counts (one catalog query).
 * Used at startup to confirm the DB responds and tables are present — not for exact reporting.
 */
export async function estimateRowsPerSchemaParallel(
  db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  schemas: Record<string, MySqlTableWithColumns<any>>,
  websiteName: string,
  dialect: DbDialect,
): Promise<SchemaRowCounts> {
  const entries = Object.entries(schemas)
  if (entries.length === 0) return {}

  const bySchema = entries.map(([name, schema]) => ({
    name,
    sqlTable: getTableName(schema),
  }))

  const estimatesBySqlTable = await fetchTableRowEstimatesBySqlName(
    db,
    bySchema.map((entry) => entry.sqlTable),
    dialect,
    websiteName,
  )

  const counts: SchemaRowCounts = {}
  for (const { name, sqlTable } of bySchema) {
    const estimate = estimatesBySqlTable.get(sqlTable)
    if (estimate !== undefined) {
      counts[name] = estimate
    } else {
      console.warn(
        `[ThaliaDatabase] No row estimate for schema "${name}" (table ${sqlTable}, ${websiteName})`,
      )
    }
  }

  return counts
}

/**
 * @deprecated Use estimateRowsPerSchemaParallel — kept as an alias for older imports/tests.
 */
export const countRowsPerSchemaParallel = estimateRowsPerSchemaParallel

export class ThaliaDatabase {
  private website: Website
  private url!: string
  /** Avoid double `pool.end()` (e.g. failed init + explicit shutdown). */
  private mysqlPoolClosed = false
  /** MySQL Drizzle driver instance (queries, migrations helpers, `execute`). */
  public drizzle!: MySql2Database<any>
  public schemas: { [key: string]: MySqlTableWithColumns<any> } = {}
  public machines: { [key: string]: Machine } = {}

  constructor(website: Website) {
    console.log('Creating database connection for', website.rootPath)

    this.website = website

    this.schemas = website.config.database?.schemas || {}
    this.machines = website.config.database?.machines || {}
  }

  /**
   * Closes the underlying mysql2 pool (`drizzle.$client`). Call from `Thalia.stop()` / test teardown
   * so parallel integration tests do not exhaust `max_connections`.
   */
  public async closeMysqlPool(): Promise<void> {
    if (this.mysqlPoolClosed) return
    try {
      /** Drizzle stores the callback mysql2 Pool on `$client`; the ORM session uses `.promise()`. */
      type LegacyPool = { promise?: () => { end: () => Promise<void> } }
      const pool = (this.drizzle as unknown as Record<string, unknown>)['$client'] as LegacyPool | undefined
      if (pool?.promise) {
        await pool.promise().end().catch(() => {})
      } else {
        const raw = pool as { end?: (cb?: (err?: Error) => void) => void } | undefined
        if (raw?.end) {
          await new Promise<void>((resolve) => {
            raw.end!(() => resolve())
          })
        }
      }
    } catch {
      /* ignore */
    } finally {
      this.mysqlPoolClosed = true
    }
  }

  /**
   * Initialise connection to the database
   * Check all schemas exist and are correct
   */
  public async init(): Promise<ThaliaDatabase> {
    try {
      startupMark(`database.${this.website.name}.import-config`)
      const drizzleConfig = await import(path.join(this.website.rootPath, 'drizzle.config.ts'))
      this.url = drizzleConfig.default.dbCredentials.url
      this.drizzle = drizzle(this.url)

      console.log(`Starting Drizzle database connection for ${this.website.name}`)

      startupMark(`database.${this.website.name}.select-1`)
      await this.drizzle.execute(sql`SELECT 1`)
      startupMark(`database.${this.website.name}.connected`)

      const dialect = inferDbDialect(drizzleConfig.default)
      const skipEstimates = process.env.THALIA_SKIP_SCHEMA_ROW_ESTIMATES === '1'
      const counts = skipEstimates || Object.keys(this.schemas).length === 0
        ? {}
        : await estimateRowsPerSchemaParallel(
            this.drizzle,
            this.schemas,
            this.website.name,
            dialect,
          )
      startupMark(`database.${this.website.name}.row-estimates`)

      if (Object.keys(counts).length > 0) {
        console.log(`Approximate row counts from the ${this.website.name} database:`, counts)
      } else if (!skipEstimates && Object.keys(this.schemas).length > 0) {
        console.log(`Database connection OK for ${this.website.name} (no schema row estimates)`)
      }

      startupMark(`database.${this.website.name}.machines`)
      Object.entries(this.machines).forEach(([name, machine]) => {
        machine.init(this.website, name)
      })

      return this
    } catch (error) {
      await this.closeMysqlPool()
      console.error(`Unable to connect to the ${this.website.name} database:`, error)
      throw new DatabaseError(`Failed to connect to database for ${this.website.name}`, {
        website: this.website.name,
        originalError: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
