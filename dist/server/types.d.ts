/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
export type ServerMode = 'standalone' | 'multiplex' | 'dev';
export interface ServerOptions {
    project: string;
    port: number;
    mode: ServerMode;
    rootPath: string;
}
export interface WebsiteConfig {
    name: string;
    rootPath: string;
    domains?: string[];
    controllers?: {
        [key: string]: any;
    };
}
export interface Website {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
}
//# sourceMappingURL=types.d.ts.map