/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
/**
 * The RouteGuard class provides an alternative "handleRequest" method, which checks for an authentication cookie.
 * If the cookie is present, the request is allowed to proceed.
 * If there is no cookie or the cookie is incorrect, the request is redirected to the login page.
 *
 * Routeguard also provides a logout
 */
export declare class RouteGuard {
    private website;
    private routes;
    private salt;
    constructor(website: Website);
    private loadRoutes;
    private saltPassword;
    handleRequest(req: IncomingMessage, res: ServerResponse, website: Website, requestInfo: RequestInfo, optionalPathname?: string): boolean;
    private handleProxy;
    private parseCookies;
}
//# sourceMappingURL=route-guard.d.ts.map