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
import Handlebars from 'handlebars';
export declare class Website implements IWebsite {
    readonly name: string;
    readonly config: WebsiteConfig;
    readonly rootPath: string;
    private static handlebars;
    templates: Map<string, Handlebars.TemplateDelegate>;
    /**
     * Creates a new Website instance
     * @param config - The website configuration
     */
    constructor(config: WebsiteConfig);
    handleRequest(req: IncomingMessage, res: ServerResponse): void;
    private getContentType;
    /**
     * Loads a website from its configuration
     * @param config - The website configuration
     * @returns Promise resolving to a new Website instance
     */
    static load(config: WebsiteConfig): Promise<Website>;
    static loadAllWebsites(options: ServerOptions): Website[];
}
//# sourceMappingURL=website.d.ts.map