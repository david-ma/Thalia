/**
 * index.ts - Main entry point for Thalia
 *
 * This file serves as the main entry point for the Thalia framework.
 *
 * Find the default project
 * Find out if we're running in standalone mode or multiplex mode
 * Find the port
 *
 */
import { Server } from './server.js';
import { ServerOptions } from './types.js';
import { Website } from './website.js';
import { Database } from './database.js';
import { RouteGuard } from './route-guard.js';
export * from './types.js';
export { Server, Website, Database, RouteGuard };
export * from './security.js';
export * from '../models/index.js';
export declare class Thalia {
    private server;
    private websites;
    constructor(options: ServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): Server;
}
//# sourceMappingURL=index.d.ts.map