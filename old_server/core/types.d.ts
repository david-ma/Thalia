/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'socket.io';
import { Model, ModelStatic, Sequelize } from 'sequelize';
import * as Handlebars from 'handlebars';
export declare namespace Thalia {
    interface SequelizeWrapper {
        [key: string]: ModelStatic<Model> | Sequelize;
        sequelize: Sequelize;
    }
    interface SocketHandler {
        (socket: Socket, data: any, database?: SequelizeWrapper): Promise<void> | void;
    }
    interface SocketEmitter {
        (socket: Socket, database?: SequelizeWrapper): Promise<void> | void;
    }
    interface SocketReceiver {
        name: string;
        callback: SocketHandler;
    }
    interface Sockets {
        on: SocketReceiver[];
        emit: SocketEmitter[];
    }
    interface Proxy {
        host?: string;
        filter?: string;
        message?: string;
        port?: number;
        password?: string;
        silent?: boolean;
    }
    interface Proxies {
        [key: string]: Proxy;
    }
    interface RawProxy {
        host?: string;
        domains?: string[];
        filter?: string;
        message?: string;
        port?: number;
        password?: string;
        silent?: boolean;
    }
    interface Service {
        (response: ServerResponse, request: IncomingMessage, db: SequelizeWrapper, words: string[]): Promise<void> | void;
    }
    interface Services {
        login?: Service;
        [key: string]: Service;
    }
    interface Cookie {
        [key: string]: string;
    }
    interface Controller {
        res: {
            getCookie: (cookieName: string) => string;
            setCookie: (cookie: Cookie, expires?: Date) => void;
            deleteCookie: (cookieName: string) => void;
            end: (result: any) => void;
        };
        req: IncomingMessage;
        response: ServerResponse;
        request: IncomingMessage;
        routeFile: (file: string) => void;
        ip: string;
        db?: SequelizeWrapper | null;
        views?: {
            [key: string]: string;
        };
        handlebars: typeof Handlebars;
        workspacePath?: string;
        readAllViews: (callback: ViewCallback) => void;
        name: string;
        readTemplate?: (config: {
            template: string;
            content: string;
            callback: any;
        }) => void;
        path?: string;
        query?: any;
        cookies?: Cookie;
    }
    interface Controllers {
        [key: string]: (controller: Controller) => Promise<void> | void;
    }
    interface WebsiteConfig {
        data?: string;
        dist?: string;
        sockets?: Sockets;
        cache?: boolean;
        folder?: string;
        workspacePath?: string;
        domains?: string[];
        services?: Services;
        controllers?: Controllers;
        standAlone?: boolean;
        mustacheIgnore?: string[];
        publish?: {
            [key: string]: string[];
        };
        pages?: {
            [key: string]: string;
        };
        redirects?: {
            [key: string]: string;
        };
        proxies?: Proxies | RawProxy[];
        security?: {
            loginNeeded: (req: IncomingMessage) => boolean;
        };
        views?: any;
        viewableFolders?: boolean | string[];
        seq?: SequelizeWrapper;
        readAllViews?: (callback: ViewCallback) => void;
        readTemplate?: (config: {
            template: string;
            content: string;
            callback: any;
        }) => void;
    }
    interface Router {
        (site: Website, pathname: string, response: ServerResponse, request: IncomingMessage): Promise<void> | void;
    }
    interface Views {
        [key: string]: string;
    }
    type ViewCallback = (views: Views) => void;
    interface ServerOptions {
        port?: number;
        defaultProject?: string;
        rootPath?: string;
        blacklist?: string[];
    }
    interface Website {
        readonly name: string;
        readonly config: WebsiteConfig;
        readonly rootPath: string;
        loadViews(): Promise<void>;
        renderTemplate(template: string, data: any): Promise<string>;
        getProxyForHost(host: string): Proxy | null;
        getControllerForPath(path: string): ((controller: Controller) => Promise<void> | void) | null;
        getServiceForPath(path: string): Service | null;
    }
}
