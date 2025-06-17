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
 *
 * TODO:
 * Rewrite this file to use drizzle-orm instead of sequelize.
 */
import { Sequelize, Model, ModelStatic } from '@sequelize/core';
import { SeqObject } from '../models/types.js';
export interface DatabaseConfig {
    dialect: 'mariadb';
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    logging?: false | ((sql: string, timing?: number) => void);
    pool?: {
        max?: number;
        min?: number;
        acquire?: number;
        idle?: number;
    };
}
export declare class Database implements SeqObject {
    private static instance;
    sequelize: Sequelize;
    models: {
        [key: string]: ModelStatic<Model>;
    };
    private constructor();
    static getInstance(config?: DatabaseConfig): Database;
    connect(): Promise<void>;
    sync(options?: {
        force?: boolean;
        alter?: boolean;
    }): Promise<void>;
    getModels(): SeqObject;
    getSequelize(): Sequelize;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map