import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { baseTableConfig } from './util.js';
export declare const users: SQLiteTableWithColumns<any>;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export declare const sessions: SQLiteTableWithColumns<any>;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export declare const audits: SQLiteTableWithColumns<any>;
export type Audit = typeof audits.$inferSelect;
export type NewAudit = typeof audits.$inferInsert;
export declare function UserFactory(config: typeof baseTableConfig): SQLiteTableWithColumns<any>;
export declare function SessionFactory(config: typeof baseTableConfig): SQLiteTableWithColumns<any>;
export declare function AuditFactory(config: typeof baseTableConfig): SQLiteTableWithColumns<any>;
//# sourceMappingURL=security.d.ts.map