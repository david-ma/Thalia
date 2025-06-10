import { Server } from '../server';
import { ServerOptions } from './types';
export interface Thalia {
    start(): Promise<void>;
    stop(): Promise<void>;
    getServer(): Server;
}
export interface ThaliaConstructor {
    new (options: ServerOptions): Thalia;
}
//# sourceMappingURL=thalia.d.ts.map