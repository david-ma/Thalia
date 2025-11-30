import { baseTableConfig } from '../node_modules/thalia/dist/models/util.js';
import { mysqlTable, text } from "drizzle-orm/mysql-core";
export const fruit = mysqlTable('fruit', {
    ...baseTableConfig,
    name: text('name').notNull(),
    color: text('color').notNull(),
    taste: text('taste').notNull(),
});
//# sourceMappingURL=fruit.js.map