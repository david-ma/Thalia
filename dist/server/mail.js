import nodemailer from 'nodemailer';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { recursiveObjectMerge } from './website.js';
export class MailService {
    /**
     * @param authPath - The path to the mail auth file
     *
     * This file should export an object with a full transport config (allowing you to use mailcatcher, or some other smtp server)
     * or an object with a just the username & password, for gmail.
     */
    constructor(authPath, defaultSendMailOptions = {}) {
        this.isInitialized = false;
        this.table = mailTable;
        this.authPath = authPath;
        this.defaultSendMailOptions = defaultSendMailOptions;
    }
    init(website, _db, _sqlite, name) {
        this.website = website;
        this.name = name;
        this.safeImport(this.authPath).then(({ mailAuth, transport }) => {
            if (transport) {
                this.transporter = nodemailer.createTransport(transport);
                this.isInitialized = true;
                console.log('Mail transporter initialized successfully');
            }
            else if (mailAuth) {
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    auth: mailAuth,
                });
                this.isInitialized = true;
                console.log('Mail transporter initialized successfully');
            }
            else {
                console.error('No mailAuth found in mailAuth.js');
            }
        });
    }
    controller(res, _req, _website, requestInfo) {
        console.log("hey we're doing the mail controller");
        if (this.isInitialized) {
            if (this.website.env === 'development') {
                // Render the email that will be sent?
                // newUserEmail.hbs
                const html = this.website.getContentHtml('emailDebug')({
                    websiteName: this.website.name,
                    websiteURL: requestInfo.host,
                    email: 'test@example.com',
                    token: '1234567890',
                });
                res.end(html);
            }
            else {
                res.end('Mail service is ready');
            }
        }
        else {
            res.end('Mail service is not ready');
        }
    }
    async sendEmail(sendMailOptions) {
        // log the email to the database
        return this.website.db.drizzle
            .insert(this.table)
            .values({
            from: sendMailOptions.from,
            to: sendMailOptions.to,
            subject: sendMailOptions.subject,
            text: sendMailOptions.text,
            html: sendMailOptions.html,
        })
            .catch((error) => {
            console.error('Error logging email to database', error);
            throw error;
        })
            .then(() => {
            if (!this.transporter || !this.isInitialized) {
                console.error('No transporter found or not initialized');
                return 'No transporter found or not initialized';
            }
            const mailOptions = recursiveObjectMerge(this.defaultSendMailOptions, sendMailOptions);
            this.transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    throw error;
                }
                else {
                    console.log('Email sent', info);
                    return 'Email sent';
                }
            });
        })
            .catch((error) => {
            console.error('Error sending email', error);
            return error;
        });
    }
    /**
     * Import a file, but if it doesn't exist, reject
     * @param path - The path to the file to import
     * @returns The imported file or an error
     */
    async safeImport(path) {
        return new Promise((resolve, reject) => {
            try {
                const data = import(path);
                resolve(data);
            }
            catch (e) {
                console.error(`Error importing ${path}:`, e);
                reject(e);
            }
        });
    }
    /**
     * Check if the mail service is ready to send emails
     */
    isReady() {
        return this.transporter !== null && this.isInitialized;
    }
}
import { baseTableConfig } from '../models/util.js';
export const mailTable = sqliteTable('mail', {
    ...baseTableConfig,
    from: text('from'),
    to: text('to'),
    cc: text('cc'),
    bcc: text('bcc'),
    subject: text('subject'),
    text: text('text'),
    html: text('html'),
});
//# sourceMappingURL=mail.js.map