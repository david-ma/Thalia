import { int, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';
// varchar helper, defaulting to 255 characters
export const vc = (name, length = 255) => varchar(name, { length });
// Base table configuration for MySQL
export const baseTableConfig = {
    id: int('id').primaryKey().autoincrement(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
    deletedAt: timestamp('deleted_at').default(sql `NULL`)
};
//# sourceMappingURL=util.js.map