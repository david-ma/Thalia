import { int, MySqlIntBuilderInitial, MySqlTimestampBuilderInitial, timestamp, varchar, MySqlColumnBuilder } from 'drizzle-orm/mysql-core'
import { sql } from 'drizzle-orm'

// varchar helper, defaulting to 255 characters
export const vc = (name: string, length: number = 255) => varchar(name, { length })

export type ThaliaTableConfig = {
  id: MySqlIntBuilderInitial<'id'>
  createdAt: MySqlTimestampBuilderInitial<'created_at'>
  updatedAt: MySqlTimestampBuilderInitial<'updated_at'>
  deletedAt: MySqlTimestampBuilderInitial<'deleted_at'>
} & Record<string, MySqlColumnBuilder<any>>

// Base table configuration for MySQL
export const baseTableConfig: ThaliaTableConfig = {
  id: int('id').primaryKey().autoincrement(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp('deleted_at').default(sql`NULL`)
}
