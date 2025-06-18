import { integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const baseTableConfig = {
    id: integer('id').primaryKey().notNull(),
    createdAt: text('created_at').notNull().$default(() => sql `CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().$onUpdate(() => sql `CURRENT_TIMESTAMP`).$default(() => sql `CURRENT_TIMESTAMP`),
    deletedAt: text('deleted_at')
};
//# sourceMappingURL=util.js.map