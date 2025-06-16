/**
 * Website - Website configuration and management
 *
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 *
 * The Website:
 * - Holds website configuration
 * - Manages website-specific routes
 * - Coordinates request handling
 * - Provides website context
 *
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 */
/// <reference types="node" resolution-mode="require"/>
import { Website as IWebsite, BasicWebsiteConfig, WebsiteConfig, ServerOptions, RouteRule, ClientInfo } from './types.js';
import { IncomingMessage, ServerResponse } from 'http';
import Handlebars from 'handlebars';
import { Socket } from 'socket.io';
export interface Controller {
    (res: ServerResponse, req: IncomingMessage, website: Website): void;
}
export declare class Website implements IWebsite {
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
    /**
     * Creates a new Website instance
     * Should only be called by the static "create" method
     */
    private constructor();
    /**
     * Given a basic website config (name & rootPath), load the website.
     */
    static create(config: BasicWebsiteConfig): Promise<Website>;
    /**
     * Load config/config.js for the website, if it exists
     * If it doesn't exist, we'll use the default config
     */
    private loadConfig;
    private validateController;
    /**
     * Load partials from the following paths:
     * - thalia/src/views
     * - thalia/websites/example/src/partials
     * - thalia/websites/$PROJECT/src/partials
     *
     * The order is important, because later paths will override earlier paths.
     */
    private loadPartials;
    /**
     * "Templates" are higher level than the partials, so we don't register them as partials
     * Not sure if this is necessary. There probably isn't any danger in registering them as partials.
     * But this could be safer.
     */
    private templates;
    private readAllViewsInFolder;
    renderError(res: ServerResponse, error: Error): void;
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
    handleRequest(req: IncomingMessage, res: ServerResponse, pathname?: string): void;
    private getContentType;
    static loadAllWebsites(options: ServerOptions): Promise<Website[]>;
    /**
     * Handle a socket connection for the website
     * Run the default listeners, and then run the website's listeners
     */
    handleSocketConnection(socket: Socket, clientInfo: ClientInfo): void;
}
export declare const controllerFactories: {
    redirectTo: (url: string) => (res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
    serveFile: (url: string) => (res: ServerResponse, _req: IncomingMessage, website: Website) => void;
};
/**
 * Read the latest 10 logs from the log directory
 */
export declare const latestlogs: (res: ServerResponse, _req: IncomingMessage, website: Website) => Promise<void>;
//# sourceMappingURL=website.d.ts.map