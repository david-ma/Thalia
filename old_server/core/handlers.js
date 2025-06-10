"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestHandlers = void 0;
const path = require("path");
const fs = require("fs");
const httpProxy = require("http-proxy");
const formidable = require("formidable");
const Handlebars = require("handlebars");
class RequestHandlers {
    constructor() {
        this.simpleLoginPage = `<html>
<head>
  <title>Login</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    form { max-width: 300px; margin: 0 auto; }
    input { width: 100%; padding: 8px; margin: 8px 0; }
    button { width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; }
  </style>
</head>
<body>
  <form action="/login" method="post">
    <h2>Login Required</h2>
    <input type="password" name="password" placeholder="Enter password">
    <button type="submit">Login</button>
  </form>
</body>
</html>`;
        this.proxyServer = httpProxy.createProxyServer({
            ws: true,
            changeOrigin: true,
            followRedirects: true
        });
    }
    async handleProxyRequest(proxy, req, res) {
        if (proxy.password) {
            const cookies = this.getCookies(req);
            if (cookies[`password${proxy.filter || ''}`] !== this.encode(proxy.password)) {
                await this.handleLoginPage(proxy, req, res);
                return;
            }
        }
        const target = `http://${proxy.host || '127.0.0.1'}:${proxy.port || 80}`;
        const message = proxy.message || 'Error, server is down.';
        return new Promise((resolve, reject) => {
            this.proxyServer.web(req, res, { target }, (err) => {
                if (err) {
                    console.error('Proxy error:', err);
                    res.writeHead(500);
                    res.end(message);
                }
                resolve();
            });
        });
    }
    async handleControllerRequest(controller, website, req, res) {
        const controllerInstance = {
            res: {
                getCookie: (name) => this.getCookies(req)[name] || '',
                setCookie: (cookie, expires) => {
                    const cookieStr = Object.entries(cookie)
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ');
                    res.setHeader('Set-Cookie', cookieStr);
                },
                deleteCookie: (name) => {
                    res.setHeader('Set-Cookie', `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`);
                },
                end: (result) => {
                    res.end(result);
                }
            },
            req,
            response: res,
            request: req,
            routeFile: (file) => {
                const filePath = path.join(website.rootPath, file);
                if (fs.existsSync(filePath)) {
                    res.writeHead(200);
                    res.end(fs.readFileSync(filePath));
                }
                else {
                    res.writeHead(404);
                    res.end('File not found');
                }
            },
            ip: req.socket.remoteAddress || '',
            db: website.config.seq || null,
            views: {},
            handlebars: Handlebars,
            workspacePath: website.config.workspacePath,
            readAllViews: (callback) => {
            },
            name: website.name,
            path: req.url,
            query: new URL(req.url || '', `http://${req.headers.host}`).searchParams,
            cookies: this.getCookies(req)
        };
        await controller(controllerInstance);
    }
    async handleServiceRequest(service, website, req, res) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const words = url.pathname.split('/').filter(Boolean);
        await service(res, req, website.config.seq || null, words);
    }
    async handleStaticRequest(website, pathname, req, res) {
        const publicPath = website.config.folder || path.join(website.rootPath, 'public');
        const filePath = path.join(publicPath, pathname);
        try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                if (website.config.viewableFolders) {
                    const files = await fs.promises.readdir(filePath);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(this.generateDirectoryListing(pathname, files));
                }
                else {
                    res.writeHead(403);
                    res.end('Directory listing not allowed');
                }
                return;
            }
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        }
        catch (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            }
            else {
                res.writeHead(500);
                res.end('Internal server error');
            }
        }
    }
    async handleLoginPage(proxy, req, res) {
        if (req.url?.includes('login')) {
            const form = new formidable.IncomingForm();
            const [fields] = await form.parse(req);
            const password = Array.isArray(fields.password) ? fields.password[0] : fields.password;
            if (password === proxy.password) {
                const encodedPassword = this.encode(proxy.password);
                res.setHeader('Set-Cookie', [
                    `password${proxy.filter || ''}=${encodedPassword};path=/;max-age=${24 * 60 * 60}`
                ]);
                const url = `//${req.headers.host}/${proxy.filter || ''}`;
                res.writeHead(303, { 'Content-Type': 'text/html' });
                res.end(`<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Login Successful, redirecting to: <a href='${url}'>${url}</a></body></html>`);
            }
            else {
                res.writeHead(401);
                res.end('Wrong password');
            }
        }
        else {
            res.writeHead(200);
            if (proxy.filter) {
                res.end(this.simpleLoginPage.replace('/login', `/${proxy.filter}/login`));
            }
            else {
                res.end(this.simpleLoginPage);
            }
        }
    }
    getCookies(req) {
        const cookies = {};
        if (req.headers.cookie) {
            req.headers.cookie.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                cookies[name] = value;
            });
        }
        return cookies;
    }
    encode(string) {
        const salt = Math.floor(Math.random() * 999);
        const buff = Buffer.from(string);
        return buff.toString('base64') + salt;
    }
    generateDirectoryListing(pathname, files) {
        const html = ['<html><head><title>Directory Listing</title></head><body>'];
        html.push(`<h1>Directory Listing for ${pathname}</h1>`);
        html.push('<ul>');
        for (const file of files) {
            html.push(`<li><a href="${path.join(pathname, file)}">${file}</a></li>`);
        }
        html.push('</ul></body></html>');
        return html.join('\n');
    }
}
exports.RequestHandlers = RequestHandlers;
