
import { baseTableConfig } from '../node_modules/thalia/dist/models/util.js'
import { mysqlTable, text } from "drizzle-orm/mysql-core";
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core'


export const fruit : MySqlTableWithColumns<any> = mysqlTable('fruit', {
  ...baseTableConfig,
  name: text('name').notNull(),
  color: text('color').notNull(),
  taste: text('taste').notNull(),
})
