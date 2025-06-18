/**
 * This file is the entrypoint for websites to enable a database connection.
 *
 * The Thalia framework uses drizzle-orm for database connections.
 * The Thalia framework provides table schemas in Thalia/models.
 * These schemas define the structure of tables that websites can use.
 * Websites can import these schemas to create their own tables in their database.
 *
 * Each website can have its own SQLite database in its models directory.
 * Websites can provide extra schemas in their models directory.
 * The database file will be created at websites/example/models/sqlite.db by default.
 *
 * The database connection is then provided to the website's controllers.
 * In Thalia/server/controllers.ts, we will provide a CRUD factory,
 * which will provide easy to use functions for CRUD operations.
 */
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
    /**
     * Connect to the database
     * Check all schemas exist and are correct
     */
    connect(): Promise<ThaliaDatabase>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map