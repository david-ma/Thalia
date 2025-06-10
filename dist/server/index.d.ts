/**
 * Thalia - Main entry point
 *
 * This file serves as the main entry point for the Thalia framework.
 * It exports all components and provides the main Thalia class for
 * server initialization.
 */
import { ThaliaServer } from './server';
import { Website } from './core/website';
import { Router } from './core/router';
import { Handler } from './core/handler';
import { AuthHandler } from './core/auth';
import { ProxyHandler } from './core/proxy';
import { ServerOptions } from './core/types';
import { Thalia as ThaliaInterface } from './core/thalia';
export * from './core/types';
export { ThaliaServer, Website, Router, Handler, AuthHandler, ProxyHandler };
export declare class Thalia implements ThaliaInterface {
    private server;
    constructor(options: ServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): ThaliaServer;
}
