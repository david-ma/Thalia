"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Handler = void 0;
const router_1 = require("./router");
class Handler {
    /**
     * Creates a new Handler instance
     * @param website - The website this handler is for
     */
    constructor(website) {
        this.website = website;
        this.router = new router_1.Router();
        // Set up routes from website config
        if (website.config.routes) {
            website.config.routes.forEach(route => this.router.addRoute(route));
        }
    }
    /**
     * Processes an incoming request
     * @param req - The incoming request
     * @param res - The server response
     */
    async handle(req, res) {
        try {
            // Check authentication if enabled
            if (this.website.config.auth?.enabled) {
                const sessionId = this.authHandler.getSessionFromCookie(req);
                if (!sessionId) {
                    if (req.url !== this.website.config.auth.loginPath) {
                        res.writeHead(302, { Location: this.website.config.auth.loginPath || '/login' });
                        res.end();
                        return;
                    }
                }
                else {
                    const user = await this.authHandler.validateSession(sessionId);
                    if (!user) {
                        res.writeHead(302, { Location: this.website.config.auth.loginPath || '/login' });
                        res.end();
                        return;
                    }
                }
            }
            // Check for proxy
            const host = req.headers.host;
            if (host) {
                const proxy = this.proxyHandler.getProxyForHost(host);
                if (proxy) {
                    const middleware = this.proxyHandler.createProxyMiddleware(proxy);
                    middleware(req, res, () => { });
                    return;
                }
            }
            // Handle with router
            await this.router.handle(req, res);
        }
        catch (error) {
            console.error('Error handling request:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
}
exports.Handler = Handler;
//# sourceMappingURL=handler.js.map