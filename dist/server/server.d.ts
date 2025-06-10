/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import { ServerMode, ServerOptions } from './types';
import { Router } from './router';
import { Website } from './types';
export declare class Server extends EventEmitter {
    private httpServer;
    private port;
    private mode;
    router: Router;
    constructor(options: ServerOptions, websites: Website[]);
    private handleRequest;
    start(): Promise<void>;
    stop(): Promise<void>;
    getMode(): ServerMode;
    getPort(): number;
}
//# sourceMappingURL=server.d.ts.map