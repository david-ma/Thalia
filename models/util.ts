import { integer, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'


// Base table configuration
export const baseTableConfig = {
  // How do I set this to auto increment?
  id: integer('id').primaryKey().notNull(),

  // Does SQLite support CURRENT_TIMESTAMP?

  createdAt: text('created_at').notNull().$default(() => sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().$onUpdate(() => sql`CURRENT_TIMESTAMP`).$default(() => sql`CURRENT_TIMESTAMP`),
  deletedAt: text('deleted_at')
}

