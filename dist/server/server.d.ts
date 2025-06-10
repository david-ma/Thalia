/**
 * Thalia server.
 *
 * Class which allows initialisation of a server.
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import { ServerMode, ServerOptions } from './types';
export declare class Server extends EventEmitter {
    private httpServer;
    private port;
    private mode;
    private rootPath;
    constructor(options: ServerOptions);
    private handleRequest;
    private getContentType;
    start(): Promise<void>;
    stop(): Promise<void>;
    getMode(): ServerMode;
    getPort(): number;
    getRootPath(): string;
}
//# sourceMappingURL=server.d.ts.map