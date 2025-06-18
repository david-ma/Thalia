
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { baseTableConfig } from '../node_modules/thalia/dist/models/util.js'



export const fruit : SQLiteTableWithColumns<any> = sqliteTable('fruit', {
  ...baseTableConfig,
  name: text('name').notNull(),
  color: text('color').notNull(),
  taste: text('taste').notNull(),
})
