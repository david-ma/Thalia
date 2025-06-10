import { Thalia } from './types';
import { Views } from './types';
import { createSession } from './session';
import { checkEmail, emailNewAccount } from './email';
export type SecurityMiddleware = (controller: Thalia.Controller, success: ([views, user]: [Views, User]) => void, failure?: () => void) => Promise<void>;
export type SecurityOptions = {
    websiteName: string;
    mailFrom?: string;
    mailAuth: {
        user: string;
        pass: string;
    };
};
export type User = {
    id: number;
    email: string;
    [key: string]: any;
};
/**
 * No-op security middleware that always succeeds
 */
export declare const noSecurity: SecurityMiddleware;
/**
 * Session-based security middleware
 */
export declare const checkSession: SecurityMiddleware;
/**
 * Creates a user management system with security middleware
 */
export declare function users(options: SecurityOptions): {
    checkSession: SecurityMiddleware;
    noSecurity: SecurityMiddleware;
    checkEmail: typeof checkEmail;
    emailNewAccount: typeof emailNewAccount;
    createSession: typeof createSession;
};
