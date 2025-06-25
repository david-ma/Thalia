/// <reference types="node" resolution-mode="require"/>
import { SendMailOptions } from 'nodemailer';
import { Machine } from './controllers.js';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
export declare class MailService implements Machine {
    private transporter;
    private isInitialized;
    private authPath;
    table: SQLiteTableWithColumns<any>;
    defaultSendMailOptions: SendMailOptions;
    /**
     * @param authPath - The path to the mail auth file
     *
     * This file should export an object with a full transport config (allowing you to use mailcatcher, or some other smtp server)
     * or an object with a just the username & password, for gmail.
     */
    constructor(authPath: string, defaultSendMailOptions?: SendMailOptions);
    init(): void;
    controller(res: ServerResponse, _req: IncomingMessage, _website: Website, _requestInfo: RequestInfo): void;
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
//# sourceMappingURL=mail.d.ts.map