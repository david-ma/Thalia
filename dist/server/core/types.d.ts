/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
export type ServerMode = 'standalone' | 'multiplex' | 'dev';
export interface ServerOptions {
    port: number;
    mode: ServerMode;
    rootPath?: string;
}
export interface Router {
    addRoute(route: Route): void;
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}
export interface Route {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    handler: RouteHandler;
}
export interface RouteHandler {
    (req: IncomingMessage, res: ServerResponse, params: Record<string, string>): Promise<void> | void;
}
export interface Handler {
    handle(req: IncomingMessage, res: ServerResponse): Promise<void> | void;
}
export interface WebsiteConfig {
    name: string;
    rootPath: string;
    routes?: Route[];
    proxy?: ProxyConfig[];
    auth?: {
        enabled: boolean;
        loginPath?: string;
        registerPath?: string;
    };
}
export interface Website {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
    readonly router: Router;
    readonly handler: Handler;
}
export interface ProxyConfig {
    host: string;
    port?: number;
    path?: string;
    filter?: string;
    message?: string;
    silent?: boolean;
}
export interface User {
    id: string;
    username: string;
    email?: string;
}
export interface Session {
    id: string;
    userId: string;
    expires: Date;
}
