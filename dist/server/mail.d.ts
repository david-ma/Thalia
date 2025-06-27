/// <reference types="node" resolution-mode="require"/>
import { SendMailOptions } from 'nodemailer';
import { Machine } from './controllers.js';
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
export declare class MailService implements Machine {
    private transporter;
    private isInitialized;
    private authPath;
    table: MySqlTableWithColumns<any>;
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
    init(website: Website, name: string): void;
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
export declare const mailTable: MySqlTableWithColumns<any>;
//# sourceMappingURL=mail.d.ts.map