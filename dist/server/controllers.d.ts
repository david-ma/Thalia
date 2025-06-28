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
    relationships?: CrudRelationship[];
};
import { Permission } from './route-guard.js';
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
/**
 * A Machine is a singleton that needs to be initialised by Thalia.
 * They provide controllers.
 * CrudFactories are Machines.
 * MailService is a Machine.
 *
 */
export type Machine = {
    init: (website: Website, name: string) => void;
    controller: Controller;
    table: MySqlTableWithColumns<any>;
};
/**
 * The CrudFactory is a class that generates a CRUD controller for a given table.
 * CrudFactory is a Machine, which means it has an init method, and provides a controller method.
 *
 * The views are mainly in src/views/scaffold, and can be overwritten by the website's views.
 * Custom views can also be passed in to the CrudFactory constructor. (TODO)
 *
 * Currently very tightly coupled with SQLite, but should be extended to work with MariaDB. (TODO)
 *
 * Uses DataTables.net for the list view.
 */
export declare class CrudFactory implements Machine {
    name: string;
    table: MySqlTableWithColumns<any>;
    private website;
    private db;
    private static blacklist;
    constructor(table: MySqlTableWithColumns<any>, options?: CrudOptions | any);
    init(website: Website, name: string): void;
    static getAction(requestInfo: RequestInfo): Permission;
    /**
     * Generate a CRUD controller for a given table.
     * We want:
     * - default: GET /tableName (shows the list of records by default, but can be overridden)
     * - list: GET /tableName/list (shows the list of records)
     * - new: GET /tableName/new (shows creation form)
     * - create: POST /tableName/create (receives form data, and inserts a new record into the database)
     * - read: GET /tableName/<id> (shows a single record)
     * - edit: GET /tableName/<id>/edit (shows the edit form)
     * - update: PUT /tableName/<id> (receives form data, and updates the record)
     * - delete: DELETE /tableName/<id> (deletes the record)
     * - columns: GET /tableName/columns (returns the columns for DataTables.net)
     * - json: GET /tableName/json (returns the data for DataTables.net)
     * - testdata: GET /tableName/testdata (generates test data, NODE_ENV=development only)
     */
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private testdata;
    generateTestData(amount?: number): Promise<any>;
    /**
     * Takes DELETE requests to the /delete endpoint.
     * Does not actually delete the record, but adds a deletedAt timestamp.
     * Adds a deletedAt timestamp to the record, and redirects to the list page.
     */
    private delete;
    private restore;
    /**
     * Update an existing record
     *
     * Needs security checks.
     */
    private update;
    private edit;
    private show;
    /**
     * Takes POST requests with form data from /new, and inserts a new record into the database
     */
    private create;
    /**
     * Takes GET requests to the /new endpoint, and renders the new form
     */
    private new;
    private list;
    /**
     * Serve the data in DataTables.net json format
     * The frontend uses /columns to get the columns, and then asks for /json to get the data.
     */
    private json;
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
    private reportSuccess;
    /**
     * Pass an error back to the user.
     * Handy place to add logging for the webmaster.
     * Or add extra debugging information for the developer.
     */
    private reportError;
}
import formidable from 'formidable';
type ParsedForm = {
    fields: Record<string, string>;
    files: formidable.Files<string>;
};
export declare function parseForm(res: ServerResponse, req: IncomingMessage): Promise<ParsedForm>;
export declare class SmugMugUploader implements Machine {
    private website;
    name: string;
    table: MySqlTableWithColumns<any>;
    private tokens;
    constructor();
    init(website: Website, name: string): Promise<void>;
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private signRequest;
    private static b64_hmac_sha1;
    private static expandParams;
    private static sortParams;
    private static oauthEscape;
}
export {};
//# sourceMappingURL=controllers.d.ts.map