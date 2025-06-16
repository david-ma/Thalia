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
}
//# sourceMappingURL=server.d.ts.map