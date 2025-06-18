import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { type LibSQLDatabase } from 'drizzle-orm/libsql';
import { Website } from './website.js';
export declare class ThaliaDatabase {
    private website;
    private url;
    private sqlite;
    drizzle: LibSQLDatabase;
    schemas: {
        [key: string]: SQLiteTableWithColumns<any>;
    };
    constructor(website: Website);
    connect(): Promise<ThaliaDatabase>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map