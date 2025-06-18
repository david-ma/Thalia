/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { RequestInfo } from './server.js';
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
export {};
//# sourceMappingURL=controllers.d.ts.map