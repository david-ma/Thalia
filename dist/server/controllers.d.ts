/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { type Controller } from './website.js';
import { type SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { RequestInfo } from './server.js';
import * as libsql from '@libsql/client';
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
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private testdata;
    private delete;
    private update;
    private edit;
    private show;
    private create;
    private new;
    list(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    private fetchDataTableJson;
    private attributes;
    private filteredAttributes;
    private cols;
    private colsFiltered;
    private columns;
    private mapColumns;
    private static parseDTquery;
}
//# sourceMappingURL=controllers.d.ts.map