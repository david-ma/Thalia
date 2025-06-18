import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { baseTableConfig } from '../node_modules/thalia/dist/models/util.js';
export const fruit = sqliteTable('fruit', {
    ...baseTableConfig,
    name: text('name').notNull(),
    color: text('color').notNull(),
    taste: text('taste').notNull(),
});
//# sourceMappingURL=fruit.js.map