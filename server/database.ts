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
 * In Thalia/server/controllers.ts, we will provide a CRUD factory,
 * which will provide easy to use functions for CRUD operations.
 */

// import { drizzle } from 'drizzle-orm/libsql'
// import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import { sql } from 'drizzle-orm'
import path from 'path'
import { Website } from './website'
import { Machine } from './controllers'
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'
import { DatabaseError } from './errors'

/** Row counts keyed by schema registration name (used at init and in tests). */
export type SchemaRowCounts = {
  [key: string]: number
}

/**
 * Runs `COUNT(*)` for each registered schema in parallel. Each query uses `.then()` / `.catch()` so
 * one failure does not reject the batch; failed schemas are warned and omitted from the result.
 */
export async function countRowsPerSchemaParallel(
  db: MySql2Database<any>,
  schemas: Record<string, MySqlTableWithColumns<any>>,
  websiteName: string,
): Promise<SchemaRowCounts> {
  const counts: SchemaRowCounts = {}
  await Promise.all(
    Object.entries(schemas).map(([name, schema]) =>
      db
        .select({ [name]: sql<number>`count(*)` })
        .from(schema)
        .then((rows: Record<string, unknown>[]) => {
          const [key, raw] = Object.entries(rows[0] ?? {})[0] ?? [name, 0]
          counts[key as string] = Number(raw)
        })
        .catch((error: unknown) => {
          console.warn(
            `[ThaliaDatabase] COUNT(*) skipped for schema "${name}" (${websiteName}) — migrate or sync tables?`,
            error instanceof Error ? error.message : String(error),
          )
        }),
    ),
  )
  return counts
}

export class ThaliaDatabase {
  private website: Website
  private url!: string
  /** Avoid double `pool.end()` (e.g. failed init + explicit shutdown). */
  private mysqlPoolClosed = false
  // private sqlite: libsql.Client
  // public drizzle!: MySqlDatabase<MySqlQueryResultHKT, PreparedQueryHKTBase, Record<string, never>, Record<string, never>>
  /** MySQL Drizzle driver instance (queries, migrations helpers, `execute`). */
  public drizzle!: MySql2Database<any>
  public schemas: { [key: string]: MySqlTableWithColumns<any> } = {}
  public machines: { [key: string]: Machine } = {}

  constructor(website: Website) {
    console.log('Creating database connection for', website.rootPath)

    this.website = website

    // Create database connection
    // this.url = 'file:' + path.join(website.rootPath, 'models', 'sqlite.db')
    // this.sqlite = libsql.createClient({ url: this.url })
    // this.drizzle = drizzle(this.sqlite)

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
      const pool = (this.drizzle as MySql2Database<any> | undefined)?.['$client'] as LegacyPool | undefined
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
      // console.log('Initialising database connection for', this.website.rootPath)
      // Read drizzle.config.ts
      // Bun can import TypeScript files natively, so no version check needed

      const drizzleConfig = await import(path.join(this.website.rootPath, 'drizzle.config.ts'))
      // console.log(drizzleConfig)
      this.url = drizzleConfig.default.dbCredentials.url
      // console.log(this.url)
      this.drizzle = drizzle(this.url)

      // await this.drizzle.$inferSelect(sql`SELECT 1`)

      // await this.drizzle.run(sql`SELECT 1`)
      console.log(`Starting Drizzle database connection for ${this.website.name}`)

      await this.drizzle.execute(sql`SELECT 1`)

      const counts = await countRowsPerSchemaParallel(this.drizzle, this.schemas, this.website.name)

      console.log(`Counts from the ${this.website.name} Database:`, counts)

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
