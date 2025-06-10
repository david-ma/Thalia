/**
 * Thalia - Main entry point
 *
 * This file serves as the main entry point for the Thalia framework.
 * It exports all components and provides the main Thalia class for
 * server initialization.
 */
import { Server } from './server';
import { ServerOptions } from './core/types';
export * from './core/types';
export { Server };
export declare class Thalia {
    private server;
    constructor(options: ServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): Server;
}
//# sourceMappingURL=index.d.ts.map