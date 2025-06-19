import { Server } from './server.js';
import { ServerOptions } from './types.js';
export interface Thalia {
    create(options: ServerOptions): Promise<Thalia>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): Server;
}
export declare class Thalia {
    private server;
    private websites;
    private constructor();
    static init(options: ServerOptions): Promise<Thalia>;
}
//# sourceMappingURL=thalia.d.ts.map