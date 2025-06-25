/// <reference types="node" resolution-mode="require"/>
import { SendMailOptions } from 'nodemailer';
import { Machine } from './controllers.js';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as libsql from '@libsql/client';
export declare class MailService implements Machine {
    private transporter;
    private isInitialized;
    private authPath;
    table: SQLiteTableWithColumns<any>;
    private website;
    private name;
    defaultSendMailOptions: SendMailOptions;
    /**
     * @param authPath - The path to the mail auth file
     *
     * This file should export an object with a full transport config (allowing you to use mailcatcher, or some other smtp server)
     * or an object with a just the username & password, for gmail.
     */
    constructor(authPath: string, defaultSendMailOptions?: SendMailOptions);
    init(website: Website, _db: LibSQLDatabase, _sqlite: libsql.Client, name: string): void;
    controller(res: ServerResponse, _req: IncomingMessage, _website: Website, requestInfo: RequestInfo): void;
    sendEmail(sendMailOptions: SendMailOptions): Promise<string>;
    /**
     * Import a file, but if it doesn't exist, reject
     * @param path - The path to the file to import
     * @returns The imported file or an error
     */
    private safeImport;
    /**
     * Check if the mail service is ready to send emails
     */
    isReady(): boolean;
}
export declare const mailTable: SQLiteTableWithColumns<{
    name: "mail";
    schema: undefined;
    columns: {
        from: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "from";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        to: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "to";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        cc: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "cc";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        bcc: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "bcc";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        subject: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "subject";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        text: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "text";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        html: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "html";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        id: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "id";
            tableName: "mail";
            dataType: "number";
            columnType: "SQLiteInteger";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "created_at";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        updatedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "updated_at";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: true;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
        deletedAt: import("drizzle-orm/sqlite-core").SQLiteColumn<{
            name: "deleted_at";
            tableName: "mail";
            dataType: "string";
            columnType: "SQLiteText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: number | undefined;
        }>;
    };
    dialect: "sqlite";
}>;
//# sourceMappingURL=mail.d.ts.map