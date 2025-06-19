import http from 'http';
import formidable from 'formidable';
/**
 * The RouteGuard class provides an alternative "handleRequest" method, which checks for an authentication cookie.
 * If the cookie is present, the request is allowed to proceed.
 * If there is no cookie or the cookie is incorrect, the request is redirected to the login page.
 *
 * Routeguard also provides a logout
 *
 * RouteGuard currently takes in a very simple password.
 * We want to enable slightly more complex authentication methods.
 * User IDs, passwords, and roles. And session tracking.
 *
 *
 * This is the basic route guard.
 */
export class RouteGuard {
    constructor(website) {
        this.website = website;
        this.routes = {};
        this.salt = 0;
        this.salt = Math.floor(Math.random() * 999);
        this.loadRoutes();
    }
    loadRoutes() {
        const routes = this.website.config.routes || [];
        routes.forEach((route) => {
            // Ensure required fields
            if (!route.path) {
                route.path = '/';
            }
            const domains = route.domains || this.website.domains;
            // Add route for each domain
            domains.forEach((domain) => {
                this.routes[domain + route.path] = route;
            });
        });
    }
    saltPassword(password) {
        const buff = Buffer.from(password + this.salt);
        return encodeURIComponent(buff.toString('base64'));
    }
    getMatchingRoute(host, pathname) {
        return Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1] ?? {};
    }
    handleRequest(req, res, website, requestInfo, pathnameOverride) {
        // const domain = requestInfo.domain
        const host = requestInfo.host;
        const pathname = pathnameOverride ?? requestInfo.pathname;
        // console.debug('route-guard on:', pathname)
        const matchingRoute = this.getMatchingRoute(host, pathname);
        if (Object.keys(matchingRoute).length > 0) {
            // Check security if required
            if (matchingRoute?.password) {
                const correctPassword = this.saltPassword(matchingRoute.password);
                const cookies = this.parseCookies(req);
                const cookieName = `auth_${website.name}${matchingRoute.path}`;
                // if developer mode, and browser-sync
                if (website.env === 'development' && pathname.startsWith('/browser-sync/')) {
                    // let them through
                    return false;
                }
                else if (pathname === `${matchingRoute.path}/logout`) {
                    res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
                    res.writeHead(302, { Location: '/' });
                    res.end();
                    return true;
                }
                else if (cookies[cookieName] === correctPassword) {
                    // console.debug("We have the right password in our cookies")
                    // Let them through
                }
                else if (req.method === 'POST') {
                    // Check if they're posting
                    try {
                        const form = formidable({ multiples: false });
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
                                res.writeHead(302, { Location: pathname });
                                res.end();
                                return true;
                            }
                            else {
                                const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                                    route: pathname,
                                    message: 'Invalid password',
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
                    // If the user doesn't have the login cookie, get the login page
                    const login_html = website.handlebars.compile(website.handlebars.partials['login'])({
                        route: pathname,
                    });
                    res.writeHead(401, { 'Content-Type': 'text/html' });
                    res.end(login_html);
                    return true; // Request handled
                }
            }
            // Handle proxy if target is specified
            if (matchingRoute.proxyTarget) {
                this.handleProxy(req, res, matchingRoute);
                return true; // Request handled
            }
            // website.handleRequest(req, res, requestInfo)
            return false;
        }
        return false; // Request not handled by guard
    }
    handleProxy(req, res, route) {
        if (!route.proxyTarget)
            return;
        const options = {
            hostname: route.proxyTarget.host,
            port: route.proxyTarget.port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                host: route.proxyTarget.host,
            },
        };
        // Handle WebSocket and other upgrades
        if (req.headers.upgrade) {
            const proxyReq = http.request(options);
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
        // Handle regular HTTP requests
        const proxyReq = http.request(options, (proxyRes) => {
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
    // protected setCookie(res: ServerResponse, name: string, value: string, path: string = '/') {
    //   res.setHeader('Set-Cookie', `${name}=${value}; Path=${path}`)
    // }
    parseCookies(req) {
        const cookies = {};
        const cookieHeader = req.headers.cookie;
        if (cookieHeader) {
            cookieHeader.split(';').forEach((cookie) => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) {
                    cookies[name] = value;
                }
            });
        }
        return cookies;
    }
}
/**
 * If we have a database, we can use the security package.
 * This will allow webmasters to define roles and permissions for routes.
 * This also requires email, so that people can be invited, authenticated and reset their password.
 *
 */
export class RoleRouteGaurd extends RouteGuard {
    constructor(website) {
        console.log('RouteGaurdWithUsers', website.config.security);
        super(website);
        this.roleRoutes = {};
    }
    handleRequest(req, res, website, requestInfo, pathnameOverride) {
        // Check security first
        const userAuth = this.getUserAuth(req); // Future: will be passed from handleRequest
        const canAccess = this.checkRouteAccess(requestInfo.url, userAuth);
        const pathname = pathnameOverride ?? requestInfo.pathname;
        if (!canAccess) {
            res.writeHead(403, { 'Content-Type': 'text/html' });
            res.end('Access denied');
            return true;
        }
        // If access granted, pass to controller
        // const controller = this.website.controllers[requestInfo.controller]
        // controller(res, req, website, requestInfo)
        this.website.handleRequest(req, res, requestInfo, pathname);
        return true;
    }
    checkRouteAccess(url, userAuth) {
        // Match URL against security patterns
        const routeRule = this.findMatchingRoute(url);
        if (!routeRule)
            return true; // No rule = allow access
        return this.canPerformAction(userAuth, routeRule, 'view');
    }
    findMatchingRoute(url) {
        return this.roleRoutes[url];
    }
    getUserAuth(req) {
        return {
            isAuthenticated: true,
            role: 'admin',
        };
    }
    canPerformAction(userAuth, routeRule, action, resourceOwner) {
        // Check if user is authenticated
        if (routeRule.requireAuth && !this.isAuthenticated(userAuth)) {
            return false;
        }
        // Check if action is allowed for user's role
        const allowedRoles = routeRule.permissions[action];
        if (allowedRoles && allowedRoles !== '*' && !allowedRoles.includes(userAuth.role)) {
            return false;
        }
        // Check owner-only permissions
        if (routeRule.ownerOnly?.includes(action)) {
            return userAuth.username === resourceOwner || userAuth.role === 'admin';
        }
        return true;
    }
    isAuthenticated(req) {
        return true;
    }
    hasRole(userAuth, role) {
        return true;
    }
    isLoggedIn(req) {
        return true;
    }
}
// Future:
// Enterprise route guard, with 3rd party authentication.
//# sourceMappingURL=route-guard.js.map