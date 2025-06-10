import { Thalia } from './types';
export type EmailOptions = {
    from: string;
    to: string;
    subject: string;
    html: string;
};
export type EmailNewAccountConfig = {
    email: string;
    controller: Thalia.Controller;
    mailAuth: {
        user: string;
        pass: string;
    };
};
/**
 * Checks if an email is valid
 */
export declare function checkEmail(controller: Thalia.Controller): boolean;
/**
 * Sends a new account email
 */
export declare function emailNewAccount(config: EmailNewAccountConfig): Promise<void>;
