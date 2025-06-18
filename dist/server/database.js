import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import path from 'path';
import * as libsql from '@libsql/client';
export class ThaliaDatabase {
    constructor(website) {
        this.schemas = {};
        console.log("Creating database connection for", website.rootPath);
        this.website = website;
        this.url = "file:" + path.join(website.rootPath, 'models', 'sqlite.db');
        this.sqlite = libsql.createClient({ url: this.url });
        this.drizzle = drizzle(this.sqlite);
        this.schemas = website.config.database?.schemas || {};
    }
    async connect() {
        try {
            await this.drizzle.run(sql `SELECT 1`);
            console.log(`Database connection for ${this.website.name} established successfully`);
            return Promise.all(Object.entries(this.schemas).map(async ([name, schema]) => {
                return this.drizzle.select({ [name]: sql `count(*)` }).from(schema);
            })).catch((error) => {
                console.error(`Error getting data from the ${this.website.name} database:`, error);
                throw error;
            }).then((results) => {
                const counts = results.reduce((acc, result) => {
                    const [name, count] = Object.entries(result[0])[0];
                    acc[name] = count;
                    return acc;
                }, {});
                console.log(`Counts from the ${this.website.name} Database:`, counts);
                return this;
            }).then(() => {
                return this;
            });
        }
        catch (error) {
            console.error(`Unable to connect to the ${this.website.name} database:`, error);
            throw error;
        }
    }
    async close() {
        try {
            this.sqlite.close();
            console.log(`Database connection for ${this.website.name} closed`);
        }
        catch (error) {
            console.error(`Error closing database connection for ${this.website.name}:`, error);
            throw error;
        }
    }
}
//# sourceMappingURL=database.js.map