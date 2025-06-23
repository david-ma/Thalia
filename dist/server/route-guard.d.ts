/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { RouteRule } from './types.js';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
import { RequestHandler } from './request-handler.js';
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
    constructor(website: Website);
    /**
     * Promised based request handler, so we can chain multiple handlers together.
     *
     */
    handleRequestChain(request: RequestHandler): Promise<RequestHandler>;
}
export declare class BasicRouteGuard extends RouteGuard {
    private routes;
    protected salt: number;
    protected routeRule: RouteRule;
    protected website: Website;
    constructor(website: Website);
    protected getMatchingRoute(request: RequestHandler): RouteRule;
    handleRequestChain(request: RequestHandler): Promise<RequestHandler>;
    private handleProxy;
    private loadRoutes;
    private saltPassword;
    handleRequest(req: IncomingMessage, res: ServerResponse, website: Website, requestInfo: RequestInfo, pathnameOverride?: string): boolean;
}
export type Role = 'admin' | 'user' | 'guest';
export type Permission = 'view' | 'edit' | 'delete' | 'create' | 'manage';
import { RoleRouteRule } from './security.js';
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
export declare class RoleRouteGuard extends BasicRouteGuard {
    private roleRoutes;
    constructor(website: Website);
    protected getMatchingRoute(request: RequestHandler): RoleRouteRule;
    handleRequestChain(request: RequestHandler): Promise<RequestHandler>;
    private getUserAuth;
    private canPerformAction;
    private isAuthenticated;
    private hasRole;
    private isLoggedIn;
}
export type UserAuth = {
    role: Role;
    userId?: string;
    sessionId?: string;
};
//# sourceMappingURL=route-guard.d.ts.map