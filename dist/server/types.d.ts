import { Controller } from './website.js';
import { Socket } from 'socket.io';
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
export type ServerMode = 'standalone' | 'multiplex';
export interface ServerOptions {
    node_env: string;
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
    domains?: string[];
    path?: string;
    password?: string;
    proxyTarget?: {
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
    mode: ServerMode;
    port: number;
}
import { Machine } from './controllers.js';
export interface DatabaseConfig {
    schemas: {
        [key: string]: SQLiteTableWithColumns<any>;
    };
    machines?: {
        [key: string]: Machine;
    };
}
import { SecurityConfig } from './route-guard.js';
export type { SecurityConfig };
import { RoleRouteRule } from './security.js';
export interface RawWebsiteConfig {
    domains?: string[];
    controllers?: {
        [key: string]: Controller;
    };
    routes?: RouteRule[] | RoleRouteRule[];
    websockets?: RawWebsocketConfig;
    database?: DatabaseConfig;
    security?: SecurityConfig;
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
//# sourceMappingURL=types.d.ts.map