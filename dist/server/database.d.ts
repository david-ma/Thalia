/**
 * This file is the entrypoint for websites to enable a database connection.
 *
 * The Thalia framework uses drizzle-orm for database connections.
 * The Thalia framework provides some generic models in Thalia/models.
 * Websites built on Thalia will have their own /models directory.
 * Websites built on Thalia will import the database connection from this file.
 * This file will read the models specified in the website's config/config.ts file, and then import them from the Thalia framework or the website's own models directory.
 *
 * The database connection is then provided to the website's controllers.
 * In Thalia/server/controllers.ts, we will provide a CRUD factory, which will provide a lot of easy to use functions for CRUD operations.
 * In Thalia/src/views/scaffold, we will provide some base CRUD templates which can be easily overridden by the website.
 */
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
export interface DatabaseConfig {
    url: string;
    logging?: boolean;
}
export declare class ThaliaDatabase {
    private static instance;
    private db;
    private sqlite;
    private config;
    private models;
    private constructor();
    private createConnection;
    static getInstance(config?: DatabaseConfig): ThaliaDatabase;
    connect(): Promise<void>;
    close(): Promise<void>;
    getDb(): BetterSQLite3Database;
    registerModel(name: string, model: any): void;
    getModel(name: string): any;
    getAllModels(): Map<string, any>;
}
//# sourceMappingURL=database.d.ts.map