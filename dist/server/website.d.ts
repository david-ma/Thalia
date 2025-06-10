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
/// <reference types="node" />
import { Website as IWebsite, WebsiteConfig, ServerOptions, RouteRule } from './types';
import { IncomingMessage, ServerResponse } from 'http';
import Handlebars from 'handlebars';
interface Controller {
    (res: ServerResponse, req: IncomingMessage, website: Website): void;
}
export declare class Website implements IWebsite {
    readonly name: string;
    readonly rootPath: string;
    config: WebsiteConfig;
    handlebars: typeof Handlebars;
    domains: string[];
    controllers: {
        [key: string]: Controller;
    };
    routes: {
        [key: string]: RouteRule;
    };
    private routeGuard;
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config: WebsiteConfig);
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
    private readAllViewsInFolder;
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
    private getContentType;
    static loadAllWebsites(options: ServerOptions): Website[];
}
export declare const controllerFactories: {
    redirectTo: (url: string) => (res: ServerResponse, _req: IncomingMessage, _website: Website) => void;
    serveFile: (url: string) => (res: ServerResponse, _req: IncomingMessage, website: Website) => void;
};
/**
 * Read the latest 10 logs from the log directory
 */
export declare const latestlogs: (res: ServerResponse, _req: IncomingMessage, website: Website) => Promise<void>;
export {};
//# sourceMappingURL=website.d.ts.map