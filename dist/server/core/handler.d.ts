/**
 * Handler - Request processing implementation
 *
 * The handler is responsible for:
 * 1. Processing incoming requests
 * 2. Managing authentication
 * 3. Handling proxies
 * 4. Coordinating between different components
 *
 * The handler:
 * - Acts as middleware between the server and router
 * - Manages authentication state
 * - Handles proxy requests
 * - Coordinates request flow
 *
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Route matching (handled by Router)
 * - Website configuration (handled by Website)
 */
/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Website } from './types';
export declare class Handler {
    private router;
    private proxyHandler;
    private authHandler;
    private website;
    /**
     * Creates a new Handler instance
     * @param website - The website this handler is for
     */
    constructor(website: Website);
    /**
     * Processes an incoming request
     * @param req - The incoming request
     * @param res - The server response
     */
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
}
