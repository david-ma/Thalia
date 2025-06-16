/// <reference types="node" resolution-mode="require"/>
import { IncomingMessage, ServerResponse } from 'http';
import { Controller } from './website.js';
import { Socket } from 'socket.io';
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
export interface ClientInfo {
    socketId: string;
    ip: string;
    userAgent: string;
    cookies: string;
    domain: string;
    timestamp: string;
}
export type RawWebsocketConfig = {
    listeners?: {
        [key: string]: (socket: Socket, data: any, clientInfo: ClientInfo) => void;
    };
    onSocketConnection?: (socket: Socket, clientInfo: ClientInfo) => void;
    onSocketDisconnect?: (socket: Socket, clientInfo: ClientInfo) => void;
};
export interface WebsocketConfig extends RawWebsocketConfig {
    listeners: {
        [key: string]: (socket: Socket, data: any, clientInfo: ClientInfo) => void;
    };
    onSocketConnection: (socket: Socket, clientInfo: ClientInfo) => void;
    onSocketDisconnect: (socket: Socket, clientInfo: ClientInfo) => void;
}
export interface BasicWebsiteConfig {
    name: string;
    rootPath: string;
}
export interface RawWebsiteConfig {
    domains?: string[];
    controllers?: {
        [key: string]: Controller;
    };
    routes?: RouteRule[];
    websockets?: RawWebsocketConfig;
}
export interface WebsiteConfig extends BasicWebsiteConfig, RawWebsiteConfig {
    name: string;
    rootPath: string;
    domains: string[];
    controllers: {
        [key: string]: Controller;
    };
    routes: RouteRule[];
    websockets: WebsocketConfig;
}
export interface Website {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
    handleSocketConnection(socket: Socket, clientInfo: ClientInfo): void;
}
//# sourceMappingURL=types.d.ts.map