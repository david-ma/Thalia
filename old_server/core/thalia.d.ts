import { Thalia as ThaliaTypes } from './types';
export declare class Thalia {
    private server;
    private websites;
    private handlers;
    constructor(options?: ThaliaTypes.ServerOptions);
    start(port: number, project?: string): Promise<void>;
    stop(): void;
}
