import { MySqlIntBuilderInitial, MySqlTimestampBuilderInitial, MySqlColumnBuilder } from 'drizzle-orm/mysql-core';
export declare const vc: (name: string, length?: number) => import("drizzle-orm/mysql-core").MySqlVarCharBuilderInitial<string, [string, ...string[]], number>;
export type ThaliaTableConfig = {
    id: MySqlIntBuilderInitial<'id'>;
    createdAt: MySqlTimestampBuilderInitial<'created_at'>;
    updatedAt: MySqlTimestampBuilderInitial<'updated_at'>;
    deletedAt: MySqlTimestampBuilderInitial<'deleted_at'>;
} & Record<string, MySqlColumnBuilder<any>>;
export declare const baseTableConfig: ThaliaTableConfig;
//# sourceMappingURL=util.d.ts.map