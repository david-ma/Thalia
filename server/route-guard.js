"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteGuard = void 0;
const http_1 = __importDefault(require("http"));
const formidable_1 = __importDefault(require("formidable"));
class RouteGuard {
    constructor(website) {
        this.website = website;
        this.routes = {};
        this.salt = 0;
        this.salt = Math.floor(Math.random() * 999);
        this.loadRoutes();
    }
    loadRoutes() {
        const routes = this.website.config.routes || [];
        routes.forEach(route => {
            if (!route.path) {
                route.path = '/';
            }
            route.domains.forEach(domain => {
                this.routes[domain + route.path] = route;
            });
        });
    }
    saltPassword(password) {
        const buff = Buffer.from(password + this.salt);
        return encodeURIComponent(buff.toString('base64'));
    }
    handleRequest(req, res, website, requestInfo, optionalPathname) {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = optionalPathname ?? url.pathname ?? '/';
        const host = req.headers.host || 'localhost';
        const matchingRoute = Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1];
        if (matchingRoute) {
            if (matchingRoute?.password) {
                const correctPassword = this.saltPassword(matchingRoute.password);
                const cookies = this.parseCookies(req);
                const cookieName = `auth_${website.name}${matchingRoute.path}`;
                if (pathname === `${matchingRoute.path}/logout`) {
                    res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
                    res.writeHead(302, { 'Location': '/' });
                    res.end();
                    return true;
                }
                else if (cookies[cookieName] === correctPassword) {
                }
                else if (req.method === 'POST') {
                    try {
                        const form = (0, formidable_1.default)({ multiples: false });
                        form.parse(req, (err, fields) => {
                            if (err) {
                                console.error('Error parsing form data:', err);
                                res.writeHead(400, { 'Content-Type': 'text/html' });
                                res.end('Invalid form data');
                                return true;
                            }
                            const password = this.saltPassword(fields?.['password']?.[0] ?? '');
                            if (password === correctPassword) {
                                res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`);
                                res.writeHead(302, { 'Location': url.pathname });
                                res.end();
                                return true;
                            }
                            else {
                                const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                                    route: url.pathname,
                                    message: 'Invalid password'
                                });
                                res.writeHead(401, { 'Content-Type': 'text/html' });
                                res.end(login_html);
                                return true;
                            }
                        });
                        return true;
                    }
                    catch (err) {
                        console.error('Error parsing form data:', err);
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('Invalid form data');
                        return true;
                    }
                }
                else {
                    const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                        route: url.pathname
                    });
                    res.writeHead(401, { 'Content-Type': 'text/html' });
                    res.end(login_html);
                    return true;
                }
            }
            if (matchingRoute.target) {
                this.handleProxy(req, res, matchingRoute);
                return true;
            }
        }
        return false;
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
        if (req.headers.upgrade) {
            const proxyReq = http_1.default.request(options);
            proxyReq.on('upgrade', (proxyRes, proxySocket, _proxyHead) => {
                res.writeHead(proxyRes.statusCode || 101, proxyRes.headers);
                const clientSocket = res.socket;
                if (clientSocket) {
                    proxySocket.pipe(clientSocket);
                    clientSocket.pipe(proxySocket);
                }
            });
            proxyReq.on('error', (error) => {
                console.error(`Proxy upgrade error for ${route.path}:`, error);
                res.writeHead(500);
                res.end('Proxy Upgrade Error');
            });
            req.pipe(proxyReq);
            return;
        }
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
