import { int, MySqlIntBuilderInitial, MySqlTimestampBuilderInitial, timestamp, varchar, MySqlColumnBuilder } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

/** varchar helper, default length 255 (MySQL). */
export const vc = (name: string, length: number = 255) => varchar(name, { length })

/** Shape of the standard Thalia base columns merged into `mysqlTable` definitions. */
export type ThaliaTableConfig = {
  id: MySqlIntBuilderInitial<'id'>
  createdAt: MySqlTimestampBuilderInitial<'created_at'>
  updatedAt: MySqlTimestampBuilderInitial<'updated_at'>
  deletedAt: MySqlTimestampBuilderInitial<'deleted_at'>
} & Record<string, MySqlColumnBuilder<any>>

/** Primary key + timestamps + soft-delete column for MySQL tables. */
export const baseTableConfig: ThaliaTableConfig = {
  id: int('id').primaryKey().autoincrement(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp('deleted_at').default(sql`NULL`)
}

/**
 * Drizzle mysql2 `insert().values()` resolves to mysql2's query result tuple
 * `[ResultSetHeader, FieldPacket[]]` when the driver runs a raw INSERT — not a bare header.
 * Extract `insertId` for follow-up `SELECT` by primary key.
 */
export function mysqlInsertIdFromDrizzleMysql2Result(result: unknown): number | undefined {
  let header: { insertId?: number | bigint } | undefined
  if (result != null && typeof result === 'object') {
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0]
      if (first != null && typeof first === 'object' && 'insertId' in first) {
        header = first as { insertId?: number | bigint }
      }
    } else if ('insertId' in result) {
      header = result as { insertId?: number | bigint }
    }
  }
  if (header == null) return undefined
  const raw = header.insertId
  if (raw === undefined) return undefined
  return typeof raw === 'bigint' ? Number(raw) : raw
}
