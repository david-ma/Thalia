/**
 * Router - Request routing implementation
 *
 * The router is responsible for:
 * 1. Managing route definitions
 * 2. Matching incoming requests to routes
 * 3. Handling route parameters
 * 4. Executing route handlers
 *
 * The router:
 * - Maintains a collection of routes
 * - Matches URLs to route patterns
 * - Extracts parameters from URLs
 * - Calls appropriate handlers
 *
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request processing (handled by Handler)
 * - Authentication (handled by AuthHandler)
 */
/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
import { Route } from './types';
export declare class Router {
    private routes;
    private paramRoutes;
    constructor();
    /**
     * Adds a new route to the router
     * @param route - The route to add
     */
    addRoute(route: Route): void;
    /**
     * Handles an incoming request by matching it to a route
     * @param req - The incoming request
     * @param res - The server response
     */
    handle(req: IncomingMessage, res: ServerResponse): Promise<void>;
    /**
     * Matches a request path against a route pattern and extracts parameters
     * @param routePath - The route pattern to match against
     * @param requestPath - The actual request path
     * @returns Object containing extracted parameters or null if no match
     */
    private matchRoute;
}
//# sourceMappingURL=router.d.ts.map