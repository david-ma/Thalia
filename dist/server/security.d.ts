/// <reference types="node" resolution-mode="require"/>
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
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
export declare class ThaliaSecurity implements Machine {
    table: SQLiteTableWithColumns<any>;
    private salt;
    private mailService;
    constructor(options?: {
        salt?: string;
        mailAuthPath?: string;
    });
    init(website: Website, _db: any, _sqlite: any, _name: string): void;
    controller(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
    hashPassword(password: string): string;
    private logonController;
    private forgotPasswordController;
    securityConfig(): RawWebsiteConfig;
}
//# sourceMappingURL=security.d.ts.map