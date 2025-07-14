/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
/// <reference types="node" resolution-mode="require"/>
import { EventEmitter } from 'events';
import { ServerMode, ServerOptions } from './types.js';
import { Router } from './router.js';
import { Website } from './website.js';
import { UserAuth, Permission } from './route-guard.js';
export type RequestInfo = {
    host: string;
    domain: string;
    url: string;
    ip: string;
    method: string;
    pathname: string;
    controller: string;
    action: string;
    slug: string;
    cookies: Record<string, string>;
    userAuth?: UserAuth;
    permissions?: Permission[];
    query: Record<string, string>;
};
export declare class Server extends EventEmitter {
    private httpServer;
    private socketServer;
    private port;
    private mode;
    router: Router;
    private project;
    constructor(options: ServerOptions, websites: Website[]);
    private logRequest;
    /**
     * Handle HTTP requests.
     */
    private handleRequest;
    /**
     * Handle socket connections.
     * Find the website for the socket and call its handleSocketConnection method.
     * Insert security here?
     */
    private handleSocketConnection;
    private static createSocketServer;
    start(): Promise<void>;
    stop(): Promise<void>;
    getMode(): ServerMode;
    getPort(): number;
    private parseCookies;
}
//# sourceMappingURL=server.d.ts.map