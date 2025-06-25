import http from 'http';
import formidable from 'formidable';
import { eq } from 'drizzle-orm';
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
    }
    /**
     * Promised based request handler, so we can chain multiple handlers together.
     *
     */
    handleRequestChain(request) {
        return Promise.resolve(request);
    }
}
export class BasicRouteGuard extends RouteGuard {
    constructor(website) {
        super(website);
        this.routes = {};
        this.salt = 0;
        this.website = website;
        this.salt = Math.floor(Math.random() * 999);
        this.loadRoutes();
    }
    getMatchingRoute(request) {
        const requestInfo = request.requestInfo;
        const host = requestInfo.host;
        const pathname = requestInfo.pathname;
        const fullpath = host + pathname;
        return (Object.entries(this.routes)
            .sort((a, b) => (b[1].path?.length ?? 0) - (a[1].path?.length ?? 0))
            .find(([route, rule]) => {
            if (fullpath.startsWith(route)) {
                return [route, rule];
            }
        })?.[1] ?? {});
    }
    handleRequestChain(request) {
        return new Promise((next, finish) => {
            if (request.website.env === 'development' && request.pathname.startsWith('/browser-sync/')) {
                return next(request);
            }
            const routeRule = this.getMatchingRoute(request);
            if (Object.keys(routeRule).length === 0) {
                return next(request);
            }
            this.routeRule = routeRule;
            if (routeRule.password) {
                const correctPassword = this.saltPassword(routeRule.password);
                const cookies = request.requestInfo.cookies;
                const cookieName = `auth_${this.website.name}${routeRule.path}`;
                if (request.pathname.startsWith(`${routeRule.path}/logout`)) {
                    request.res.setHeader('Set-Cookie', `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
                    request.res.writeHead(302, { Location: '/' });
                    request.res.end();
                    return finish('Logged out');
                }
                if (cookies[cookieName] === correctPassword) {
                    return next(request);
                }
                if (request.req.method === 'POST') {
                    const form = formidable({ multiples: false });
                    form.parse(request.req, (err, fields) => {
                        if (err) {
                            return finish('Error parsing form data');
                        }
                        const password = this.saltPassword(fields?.['password']?.[0] ?? '');
                        if (password === correctPassword) {
                            request.res.setHeader('Set-Cookie', `${cookieName}=${password}; Path=/`);
                            request.res.writeHead(302, { Location: request.pathname });
                            request.res.end();
                            return finish('Logged in');
                        }
                        else {
                            const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
                                route: request.pathname,
                                message: 'Invalid password',
                            });
                            request.res.writeHead(401, { 'Content-Type': 'text/html' });
                            request.res.end(login_html);
                            return finish('Invalid password');
                        }
                    });
                    return finish('Form submitted');
                }
                else {
                    const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
                        route: request.pathname,
                    });
                    request.res.writeHead(401, { 'Content-Type': 'text/html' });
                    request.res.end(login_html);
                    return finish('Login page');
                }
            }
            else if (routeRule.proxyTarget) {
                this.handleProxy(request.req, request.res, routeRule);
                return finish('Proxy request');
            }
            else {
                console.debug('No route rule password found');
                return next(request);
            }
        });
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
                // res.writeHead(500)
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
    // private getMatchingRoute(host: string, pathname: string): RouteRule {
    //   return Object.entries(this.routes).find(([key]) => pathname.startsWith(key.replace(host, '')))?.[1] ?? {}
    // }
    handleRequest(req, res, website, requestInfo, pathnameOverride) {
        // const domain = requestInfo.domain
        const host = requestInfo.host;
        const pathname = pathnameOverride ?? requestInfo.pathname;
        // console.debug('route-guard on:', pathname)
        const matchingRoute = this.getMatchingRoute(requestInfo);
        // const matchingRoute = this.getMatchingRoute(host, pathname)
        if (Object.keys(matchingRoute).length > 0) {
            // Check security if required
            if (matchingRoute?.password) {
                const correctPassword = this.saltPassword(matchingRoute.password);
                const cookies = requestInfo.cookies;
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
}
import { CrudFactory } from './controllers.js';
/**
 * If we have a database, we can use the security package.
 * This will allow webmasters to define roles and permissions for routes.
 * This also requires email, so that people can be invited, authenticated and reset their password.
 *
 */
export class RoleRouteGuard extends BasicRouteGuard {
    constructor(website) {
        super(website);
        this.roleRoutes = {};
    }
    getMatchingRoute(request) {
        return super.getMatchingRoute(request);
    }
    handleRequestChain(request) {
        return new Promise((next, finish) => {
            const routeRule = this.getMatchingRoute(request);
            // console.debug('Hnadling request chain RouteRule', routeRule)
            return this.getUserAuth(request.req, request.requestInfo)
                .then((userAuth) => {
                // Look up permissions for the user
                const permissions = routeRule.permissions?.[userAuth.role] ?? routeRule.permissions?.guest ?? [];
                request.requestInfo.userAuth = userAuth;
                request.requestInfo.permissions = permissions;
                return request;
            })
                .then((request) => {
                // If the user has the right permissions, let them through
                // Otherwise, send them to the login page
                const action = CrudFactory.getAction(request.requestInfo);
                if (request.requestInfo.permissions?.includes(action)) {
                    return next(request);
                }
                else {
                    if (request.requestInfo.userAuth?.role === 'guest') {
                        console.log('Guest user, sending login page');
                        // // please log in
                        // const login_html = this.website.handlebars.compile(this.website.handlebars.partials['login'])({
                        //   route: request.pathname,
                        // })
                        const login_html = this.website.getContentHtml('userLogin')({
                            route: request.pathname,
                        });
                        // console.log('Sending Login page', login_html)
                        request.res.writeHead(401, { 'Content-Type': 'text/html' });
                        request.res.end(login_html);
                        return finish('User is not logged in, so we sent the login page');
                    }
                    else {
                        console.log('User has no permissions, sending access denied');
                        // access denied
                        // request.res.writeHead(403, { 'Content-Type': 'text/html' })
                        request.res.end('Access denied');
                        return finish('Access denied');
                    }
                }
            });
        });
    }
    async getUserAuth(req, requestInfo) {
        return new Promise((resolve, reject) => {
            const sessionId = requestInfo.cookies.sessionId;
            const drizzle = this.website.db.drizzle;
            const sessions = this.website.db.machines.sessions.table;
            if (!sessionId) {
                resolve({
                    role: 'guest',
                });
            }
            else {
                drizzle
                    .select()
                    .from(sessions)
                    .where(eq(sessions.sid, sessionId))
                    .then((result) => {
                    console.log('getUserAuth Result', result);
                    resolve({
                        role: 'guest',
                    });
                })
                    .catch((err) => {
                    console.error('Error getting user auth', err);
                    resolve({
                        role: 'guest',
                    });
                });
            }
        });
    }
    canPerformAction(userAuth, routeRule, action, resourceOwner) {
        // If no permissions are defined, allow access
        if (!routeRule.permissions) {
            return true;
        }
        // Check if action is allowed for user's role
        const userPermissions = routeRule.permissions[userAuth.role] || routeRule.permissions.guest || [];
        if (!userPermissions.includes(action)) {
            return false;
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
//# sourceMappingURL=route-guard.js.map