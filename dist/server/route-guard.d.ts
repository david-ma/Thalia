/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './website';
export declare class RouteGuard {
    private website;
    private routes;
    constructor(website: Website);
    private loadRoutes;
    handleRequest(req: IncomingMessage, res: ServerResponse): boolean;
    private handleProxy;
    private parseCookies;
}
//# sourceMappingURL=route-guard.d.ts.map