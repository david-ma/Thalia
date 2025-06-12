/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
export type ServerMode = 'standalone' | 'multiplex' | 'dev';
export interface ServerOptions {
    project: string;
    port: number;
    mode: ServerMode;
    rootPath: string;
}
export interface BasicAuthConfig {
    enabled: boolean;
    password: string;
    cookieName?: string;
    cookieOptions?: {
        maxAge?: number;
        secure?: boolean;
        httpOnly?: boolean;
    };
}
export interface PathSecurity {
    path: string;
    type: 'basic' | 'none';
    password?: string;
    allowedPaths?: string[];
}
export interface RouteRule {
    domains: string[];
    path?: string;
    password?: string;
    target?: {
        host: string;
        port: number;
    };
}
export type RawWebsiteConfig = {
    name?: string;
    rootPath?: string;
    domains?: string[];
    controllers?: {
        [key: string]: any;
    };
    routes?: RouteRule[];
};
export interface WebsiteConfig extends RawWebsiteConfig {
    name: string;
    rootPath: string;
}
export interface Website {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
}
//# sourceMappingURL=types.d.ts.map