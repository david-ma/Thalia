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
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import Database from 'better-sqlite3';
export class ThaliaDatabase {
    constructor(config) {
        this.models = new Map();
        this.config = config;
        const { db, sqlite } = this.createConnection();
        this.db = db;
        this.sqlite = sqlite;
    }
    createConnection() {
        try {
            const sqlite = new Database(this.config.url);
            // Enable foreign keys
            sqlite.pragma('foreign_keys = ON');
            // Enable WAL mode for better concurrency
            sqlite.pragma('journal_mode = WAL');
            return {
                db: drizzle(sqlite),
                sqlite
            };
        }
        catch (error) {
            console.error('Error creating database connection:', error);
            throw error;
        }
    }
    static getInstance(config) {
        if (!ThaliaDatabase.instance) {
            if (!config) {
                throw new Error('Database configuration is required for initialization');
            }
            ThaliaDatabase.instance = new ThaliaDatabase(config);
        }
        return ThaliaDatabase.instance;
    }
    async connect() {
        try {
            // SQLite connections are established immediately when creating the database
            // We can verify the connection by running a simple query
            await this.db.run(sql `SELECT 1`);
            console.log('Database connection established successfully');
        }
        catch (error) {
            console.error('Unable to connect to the database:', error);
            throw error;
        }
    }
    async close() {
        try {
            // Close the SQLite connection
            this.sqlite.close();
            console.log('Database connection closed');
        }
        catch (error) {
            console.error('Error closing database connection:', error);
            throw error;
        }
    }
    getDb() {
        return this.db;
    }
    registerModel(name, model) {
        this.models.set(name, model);
    }
    getModel(name) {
        return this.models.get(name);
    }
    getAllModels() {
        return this.models;
    }
}
//# sourceMappingURL=database.js.map