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
    private port;
    private mode;
    router: Router;
    private project;
    constructor(options: ServerOptions, websites: Website[]);
    private getDateTime;
    private logRequest;
    private handleRequest;
    start(): Promise<void>;
    stop(): Promise<void>;
    getMode(): ServerMode;
    getPort(): number;
}
//# sourceMappingURL=server.d.ts.map