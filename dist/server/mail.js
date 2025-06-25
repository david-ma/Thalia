import nodemailer from 'nodemailer';
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
        this.authPath = authPath;
        this.defaultSendMailOptions = defaultSendMailOptions;
    }
    init() {
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
    controller(res, _req, _website, _requestInfo) {
        if (this.isInitialized) {
            res.end('Mail service is ready');
        }
        else {
            res.end('Mail service is not ready');
        }
    }
    async sendEmail(sendMailOptions) {
        return new Promise((resolve, reject) => {
            if (!this.transporter || !this.isInitialized) {
                console.error('No transporter found or not initialized');
                reject('No transporter found or not initialized');
                return;
            }
            const mailOptions = recursiveObjectMerge(this.defaultSendMailOptions, sendMailOptions);
            this.transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve('Email sent');
                }
            });
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
//# sourceMappingURL=mail.js.map