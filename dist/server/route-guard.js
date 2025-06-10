"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteGuard = void 0;
const http_1 = __importDefault(require("http"));
class RouteGuard {
    constructor(website) {
        this.website = website;
        this.routes = {};
        this.loadRoutes();
    }
    loadRoutes() {
        const routes = this.website.config.routes || [];
        routes.forEach(route => {
            // Ensure required fields
            if (!route.path) {
                console.warn(`Route missing path in ${this.website.name}`);
                return;
            }
            // Add route for each domain
            route.domains.forEach(domain => {
                this.routes[domain + route.path] = route;
            });
        });
    }
    handleRequest(req, res) {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const host = req.headers.host || 'localhost';
        console.log("Pathname: ", pathname);
        console.log("Routes: ", this.routes);
        // Check for matching route
        // const routeKey = host + pathname
        const matchingRoute = Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1];
        if (matchingRoute) {
            // Check security if required
            if (matchingRoute.security?.password) {
                const cookies = this.parseCookies(req);
                const cookieName = `auth_${matchingRoute.path}`;
                if (cookies[cookieName] !== matchingRoute.security.password) {
                    res.writeHead(401, { 'Content-Type': 'text/html' });
                    res.end(matchingRoute.security.message || 'Unauthorized');
                    return true; // Request handled
                }
            }
            // Handle proxy if target is specified
            if (matchingRoute.target) {
                this.handleProxy(req, res, matchingRoute);
                return true; // Request handled
            }
        }
        return false; // Request not handled by guard
    }
    handleProxy(req, res, route) {
        if (!route.target)
            return;
        const options = {
            hostname: route.target.host,
            port: route.target.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                host: route.target.host
            }
        };
        const proxyReq = http_1.default.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
            proxyRes.pipe(res);
        });
        proxyReq.on('error', (error) => {
            console.error(`Proxy error for ${route.path}:`, error);
            res.writeHead(500);
            res.end('Proxy Error');
        });
        req.pipe(proxyReq);
    }
    parseCookies(req) {
        const cookies = {};
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) {
                    cookies[name] = value;
                }
            });
        }
        return cookies;
    }
}
exports.RouteGuard = RouteGuard;
//# sourceMappingURL=route-guard.js.map