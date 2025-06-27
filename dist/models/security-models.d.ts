import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
import { baseTableConfig } from './util.js';
export declare const users: MySqlTableWithColumns<any>;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export declare const sessions: MySqlTableWithColumns<any>;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export declare const audits: MySqlTableWithColumns<any>;
export type Audit = typeof audits.$inferSelect;
export type NewAudit = typeof audits.$inferInsert;
export declare function UserFactory(config: typeof baseTableConfig): MySqlTableWithColumns<any>;
export declare function SessionFactory(config: typeof baseTableConfig): MySqlTableWithColumns<any>;
export declare function AuditFactory(config: typeof baseTableConfig): MySqlTableWithColumns<any>;
//# sourceMappingURL=security-models.d.ts.map