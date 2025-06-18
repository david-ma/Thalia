/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { RequestInfo } from './server.js';
import * as libsql from '@libsql/client';
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
export declare function crudFactory(options: CrudOptions): CrudController;
import { type LibSQLDatabase } from 'drizzle-orm/libsql';
export declare class CrudMachine {
    name: string;
    private table;
    private website;
    private db;
    private sqlite;
    constructor(table: SQLiteTableWithColumns<any>);
    init(website: Website, db: LibSQLDatabase, sqlite: libsql.Client, name: string): void;
    entrypoint(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private testdata;
    private create;
    private filteredAttributes;
    private new;
    list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private fetchDataTableJson;
    private columns;
    private mapColumns;
    private static parseDTquery;
}
export {};
//# sourceMappingURL=controllers.d.ts.map