/// <reference types="node" resolution-mode="require"/>
import { EventEmitter } from 'events';
import { ServerMode, ServerOptions } from './types.js';
import { Router } from './router.js';
import { Website } from './website.js';
export type RequestInfo = {
    host: string;
    url: string;
    ip: string;
    method: string;
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
    private handleRequest;
    private handleSocketConnection;
    private static createSocketServer;
    start(): Promise<void>;
    stop(): Promise<void>;
    getMode(): ServerMode;
    getPort(): number;
}
//# sourceMappingURL=server.d.ts.map