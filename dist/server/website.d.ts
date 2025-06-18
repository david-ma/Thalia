/// <reference types="node" resolution-mode="require"/>
import { WebsiteInterface, BasicWebsiteConfig, WebsiteConfig, ServerOptions, RouteRule, ClientInfo } from './types.js';
import { IncomingMessage, ServerResponse } from 'http';
import Handlebars from 'handlebars';
import { Socket } from 'socket.io';
import { RequestInfo } from './server.js';
import { ThaliaDatabase } from './database.js';
export interface Controller {
    (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void;
}
export declare class Website implements WebsiteInterface {
    readonly name: string;
    readonly rootPath: string;
    private readonly env;
    config: WebsiteConfig;
    handlebars: typeof Handlebars;
    domains: string[];
    controllers: {
        [key: string]: Controller;
    };
    private websockets;
    routes: {
        [key: string]: RouteRule;
    };
    private routeGuard;
    db: ThaliaDatabase;
    private constructor();
    static create(config: BasicWebsiteConfig): Promise<Website>;
    private loadConfig;
    private validateController;
    private loadPartials;
    private templates;
    private readAllViewsInFolder;
    renderError(res: ServerResponse, error: Error): void;
    asyncServeHandlebarsTemplate({ res, template, templatePath, data }: {
        res: ServerResponse;
        template: string;
        templatePath?: undefined;
        data?: object;
    }): Promise<void>;
    serveHandlebarsTemplate({ res, template, templatePath, data }: {
        res: ServerResponse;
        template: string;
        templatePath?: undefined;
        data?: object;
    } | {
        res: ServerResponse;
        template?: undefined;
        templatePath: string;
        data?: object;
    }): void;
    handleRequest(req: IncomingMessage, res: ServerResponse, requestInfo: RequestInfo, pathname?: string): void;
    private getContentType;
    static loadAllWebsites(options: ServerOptions): Promise<Website[]>;
    handleSocketConnection(socket: Socket, clientInfo: ClientInfo): void;
    private loadDatabase;
}
export declare const controllerFactories: {
    redirectTo: (url: string) => (res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
    serveFile: (url: string) => (res: ServerResponse, _req: IncomingMessage, website: Website) => void;
};
//# sourceMappingURL=website.d.ts.map