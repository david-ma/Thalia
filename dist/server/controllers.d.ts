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
import { type Controller } from './website.js';
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { RequestInfo } from './server.js';
import * as libsql from '@libsql/client';
/**
 * Read the latest 10 logs from the log directory
 */
export declare const latestlogs: (res: ServerResponse, _req: IncomingMessage, website: Website) => Promise<void>;
import { type LibSQLDatabase } from 'drizzle-orm/libsql';
export type Machine = {
    init: (website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string) => void;
    controller: Controller;
};
export declare class CrudFactory implements Machine {
    name: string;
    private table;
    private website;
    private db;
    private sqlite;
    private static blacklist;
    constructor(table: SQLiteTableWithColumns<any>);
    init(website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string): void;
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
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private testdata;
    generateTestData(amount?: number): Promise<any>;
    private delete;
    private update;
    private edit;
    private show;
    private create;
    private new;
    private list;
    /**
     * Serve the data in DataTables.net json format
     */
    private fetchDataTableJson;
    /**
     * Get the list of columns and their attributes, for use with DataTables.net
     *
     * Other attributes:
     * { "keys": ["name", "keyAsName", "primary", "notNull", "default", "defaultFn", "onUpdateFn", "hasDefault", "isUnique", "uniqueName", "uniqueType", "dataType", "columnType", "enumValues", "generated", "generatedIdentity", "config", "table", "length"] }
     */
    private attributes;
    private filteredAttributes;
    private cols;
    private colsFiltered;
    /**
     * For the /columns endpoint
     * Used with DataTables.net
     */
    private columns;
    private mapColumns;
    private static parseDTquery;
}
//# sourceMappingURL=controllers.d.ts.map