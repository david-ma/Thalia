import { text} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'


// Base table configuration
export const baseTableConfig = {
  id: text('id').primaryKey().notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}

