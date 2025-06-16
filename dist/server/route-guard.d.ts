/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website.js';
import { RequestInfo } from './server.js';
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