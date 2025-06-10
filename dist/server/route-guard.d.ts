/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website';
export declare class RouteGuard {
    private website;
    private routes;
    private salt;
    constructor(website: Website);
    private loadRoutes;
    private saltPassword;
    handleRequest(req: IncomingMessage, res: ServerResponse, website: Website): boolean;
    private handleProxy;
    private parseCookies;
}
//# sourceMappingURL=route-guard.d.ts.map