/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { RouteRule } from './types.js';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
/**
 * The RouteGuard class provides an alternative "handleRequest" method, which checks for an authentication cookie.
 * If the cookie is present, the request is allowed to proceed.
 * If there is no cookie or the cookie is incorrect, the request is redirected to the login page.
 *
 * Routeguard also provides a logout
 *
 * RouteGuard currently takes in a very simple password.
 * We want to enable slightly more complex authentication methods.
 * User IDs, passwords, and roles. And session tracking.
 *
 *
 * This is the basic route guard.
 */
export declare class RouteGuard {
    protected website: Website;
    private routes;
    protected salt: number;
    constructor(website: Website);
    private loadRoutes;
    private saltPassword;
    private getMatchingRoute;
    handleRequest(req: IncomingMessage, res: ServerResponse, website: Website, requestInfo: RequestInfo, pathnameOverride?: string): boolean;
    private handleProxy;
    protected parseCookies(req: IncomingMessage): Record<string, string>;
}
type Role = 'admin' | 'user';
export type SecurityConfig = {
    roles: Role[];
    routes: RouteRule[];
};
/**
 * If we have a database, we can use the security package.
 * This will allow webmasters to define roles and permissions for routes.
 * This also requires email, so that people can be invited, authenticated and reset their password.
 *
 */
export declare class RoleRouteGaurd extends RouteGuard {
    private roleRoutes;
    constructor(website: Website);
    handleRequest(req: IncomingMessage, res: ServerResponse, website: Website, requestInfo: RequestInfo, pathnameOverride?: string): boolean;
    private checkRouteAccess;
    private findMatchingRoute;
    private getUserAuth;
    private canPerformAction;
    private isAuthenticated;
    private hasRole;
    private isLoggedIn;
}
export {};
//# sourceMappingURL=route-guard.d.ts.map