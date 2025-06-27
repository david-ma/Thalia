import { int, timestamp, varchar } from 'drizzle-orm/mysql-core'

// varchar helper, defaulting to 255 characters
export const vc = (name: string, length: number = 255) => varchar(name, { length })

// Base table configuration for MySQL
export const baseTableConfig :any = {
  id: int('id').primaryKey().autoincrement(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  deletedAt: timestamp('deleted_at')
}
