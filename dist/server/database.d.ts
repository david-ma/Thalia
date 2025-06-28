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
 * In Thalia/server/controllers.ts, we will provide a CRUD factory,
 * which will provide easy to use functions for CRUD operations.
 */
import { Website } from './website.js';
import { Machine } from './controllers.js';
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
export declare class ThaliaDatabase {
    private website;
    private url;
    drizzle: MySqlTableWithColumns<any>;
    schemas: {
        [key: string]: MySqlTableWithColumns<any>;
    };
    machines: {
        [key: string]: Machine;
    };
    constructor(website: Website);
    /**
     * Initialise connection to the database
     * Check all schemas exist and are correct
     */
    init(): Promise<ThaliaDatabase>;
}
//# sourceMappingURL=database.d.ts.map