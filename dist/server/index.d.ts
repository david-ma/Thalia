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
import { Server } from './server';
import { ServerOptions } from './types';
import { Website } from './website';
import { Database } from './database';
import { RouteGuard } from './route-guard';
export * from './types';
export { Server, Website, Database, RouteGuard };
export * from './security';
export * from '../models';
export declare class Thalia {
    private server;
    private websites;
    constructor(options: ServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): Server;
}
