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
import { Website as IWebsite, WebsiteConfig, ServerOptions } from './types';
import { IncomingMessage, ServerResponse } from 'http';
interface Controller {
    (res: ServerResponse, req: IncomingMessage, website: Website): void;
}
export declare class Website implements IWebsite {
    readonly name: string;
    readonly rootPath: string;
    config: WebsiteConfig;
    private handlebars;
    domains: string[];
    controllers: {
        [key: string]: Controller;
    };
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config: WebsiteConfig);
    private loadConfig;
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
export {};
//# sourceMappingURL=website.d.ts.map