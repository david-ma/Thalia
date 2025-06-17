/**
 * Controllers - Useful shared controller functions for handling requests
 *
 * The controllers are useful functions you can call to do specific tasks on a http request. e.g.
 * 1. Handling requests
 * 2. Rendering templates
 * 3. Handling form submissions
 * 4. Handling file uploads
 */
/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { RequestInfo } from './server.js';
/**
 * Read the latest 10 logs from the log directory
 */
export declare const latestlogs: (res: ServerResponse, _req: IncomingMessage, website: Website) => Promise<void>;
type CrudRelationship = {
    foreignTable: string;
    foreignColumn: string;
    localColumn: string;
};
type CrudOptions = {
    website: Website;
    table: SQLiteTableWithColumns<any>;
    db: BetterSQLite3Database;
    relationships?: CrudRelationship[];
    hideColumns?: string[];
    template?: string;
};
type CrudController = {
    [key: string]: (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => void;
};
/**
 * Generate a CRUD controller for a given table.
 * We want:
 * - list: GET /tableName
 * - create: POST /tableName
 * - read: GET /tableName/id
 * - edit: GET /tableName/id/edit
 * - update: PUT /tableName/id
 * - delete: DELETE /tableName/id
 */
export declare function crudFactory(options: CrudOptions): CrudController;
export {};
//# sourceMappingURL=controllers.d.ts.map