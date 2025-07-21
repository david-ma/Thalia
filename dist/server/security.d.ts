import { ServerResponse, IncomingMessage } from 'http';
import { Website } from './website.js';
import { Machine } from './controllers.js';
import { Permission, Role, SecurityConfig } from './route-guard.js';
export type { SecurityConfig };
import { RawWebsiteConfig, RouteRule } from './types.js';
export interface RoleRouteRule extends RouteRule {
    path: string;
    permissions: Partial<Record<Role, Permission[]>>;
}
import { RequestInfo } from './server.js';
import { MySqlTableWithColumns } from 'drizzle-orm/mysql-core';
import { MySql2Database } from 'drizzle-orm/mysql2';
export type UserDetails = {
    email: string;
    password: string;
    name: string;
    role: string;
    locked: boolean;
    verified: boolean;
};
export declare class SecurityService {
    website: Website;
    db: MySql2Database;
    constructor(drizzleConfig: any);
    createUser(user: UserDetails): Promise<{
        [x: string]: any;
    }[] | null>;
}
export declare class ThaliaSecurity implements Machine {
    table: MySqlTableWithColumns<any>;
    private mailService;
    private website;
    constructor(options?: {
        mailAuthPath?: string;
    });
    init(website: Website, name: string): void;
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    private logonController;
    private setCookie;
    private forgotPasswordController;
    private setupController;
    securityConfig(): RawWebsiteConfig;
}
//# sourceMappingURL=security.d.ts.map