/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Website as requestHandlersWebsite } from './requestHandlers';
import { ViewCallback } from './requestHandlers';
import SocketIO = require('socket.io');
import Handlebars = require('handlebars');
export declare namespace Thalia {
    interface Emitter {
        (socket: SocketIO.Socket, database: any): any;
    }
    interface Receiver {
        name: string;
        callback: {
            (socket: SocketIO.Socket, data: any, database: any): any;
        };
    }
    type MysqlWrapper = unknown;
    type SequelizeWrapper = any;
    type Proxy = {
        host?: string;
        filter?: string;
        message?: string;
        port?: number;
        password?: string;
        silent?: boolean;
    };
    type Proxies = {
        [key: string]: Proxy;
    };
    type rawProxy = {
        host?: string;
        domains?: string[];
        filter?: string;
        message?: string;
        port?: number;
        password?: string;
        silent?: boolean;
    };
    class Website extends requestHandlersWebsite {
    }
    interface Sockets {
        on: Array<Receiver>;
        emit: Array<Emitter>;
    }
    interface Service {
        (response: ServerResponse, request: IncomingMessage, db: Thalia.SequelizeWrapper, words: any): void;
    }
    interface Services {
        login?: any;
        [key: string]: Service;
    }
    interface Controller {
        res: {
            getCookie: (cookieName: string) => string;
            setCookie: (cookie: Cookie, expires?: Date) => void;
            deleteCookie: (cookieName: string) => void;
            end: (result: any) => void;
        };
        req: IncomingMessage;
        response: ServerResponse<IncomingMessage>;
        request: IncomingMessage;
        routeFile: (file: string) => void;
        ip: string;
        db?: SequelizeWrapper | null;
        views?: {
            [key: string]: string;
        };
        handlebars: typeof Handlebars;
        workspacePath?: any;
        readAllViews: (callback: ViewCallback) => void;
        name: string;
        readTemplate?: any;
        path?: any;
        query?: any;
        cookies?: Cookie;
    }
    type Cookie = {
        [key: string]: string;
    };
    interface Controllers {
        [key: string]: {
            (responder: Controller): void;
        };
    }
    interface WebsiteConfig {
        data?: string;
        dist?: string;
        sockets?: Sockets;
        cache?: boolean;
        folder?: string;
        workspacePath?: string;
        domains?: Array<string>;
        services?: Services;
        controllers?: Controllers;
        standAlone?: boolean;
        mustacheIgnore?: Array<string>;
        publish?: {
            [key: string]: string[];
        };
        pages?: {
            [key: string]: string;
        };
        redirects?: {
            [key: string]: string;
        };
        proxies?: {
            [key: string]: Proxy;
        } | rawProxy[];
        security?: {
            loginNeeded: any;
        };
        views?: any;
        viewableFolders?: boolean | Array<string>;
        seq?: SequelizeWrapper;
        readAllViews?: {
            (callback: any): void;
        };
        readTemplate?: {
            (config: {
                template: string;
                content: string;
                callback: any;
            }): void;
        };
    }
    interface WebsiteCredentials {
    }
    interface Router {
        (site: Website, pathname: string, response: ServerResponse, request: IncomingMessage): void;
    }
    interface Handle {
        websites: {
            [key: string]: Website;
        };
        index: {
            localhost: string;
            [key: string]: string;
        };
        proxies: {
            [key: string]: Proxies;
        };
        loadAllWebsites: {
            (): void;
        };
        getWebsite: {
            (host: string): Website;
        };
        addWebsite: {
            (site: string, config: any): void;
        };
    }
    interface RouteData {
        cookies: {
            [key: string]: string;
        };
        words: Array<string>;
    }
}
