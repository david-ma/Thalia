"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const socket_1 = require("./socket");
const http = require("http");
const url = require("url");
const httpProxy = require("http-proxy");
const socket_io_1 = require("socket.io");
const socketIO = new socket_io_1.Server({});
const formidable = require("formidable");
let blacklist = [];
try {
    blacklist = require('../blacklist').blacklist;
}
catch (e) { }
function start(router, handle, port) {
    let server = null;
    function onRequest(request, response) {
        const host = request.headers['x-host'] || request.headers.host;
        let spam = false;
        const ip = request.headers['X-Real-IP'] ||
            request.headers['x-real-ip'] ||
            request.connection.remoteAddress ||
            request.socket.remoteAddress;
        if (ip) {
            if (!host || blacklist.some((thing) => ip.includes(thing))) {
                spam = true;
                response.writeHead(403);
                response.end('Go away');
            }
        }
        if (!spam) {
            const hostname = host.split(':')[0];
            const site = handle.getWebsite(hostname);
            const urlObject = url.parse(request.url, true);
            const proxies = handle.proxies[hostname];
            const filterWord = url.parse(request.url).pathname.split('/')[1];
            const proxy = proxies
                ? proxies[filterWord] || proxies['*'] || null
                : null;
            if (proxy) {
                if (!proxy.silent)
                    log();
                webProxy(proxy);
            }
            else {
                log();
                router(site, urlObject.pathname, response, request);
            }
            function log() {
                console.log();
                console.log(`Request for ${host}${urlObject.href} At ${getDateTime()} From ${ip}`);
            }
        }
        function webProxy(config) {
            if (config.password) {
                const cookies = getCookies(request);
                if (cookies[`password${config.filter || ''}`] !== encode(config.password)) {
                    loginPage(config.password, config.filter);
                    return;
                }
            }
            const message = config.message || 'Error, server is down.';
            const target = `http://${config.host || '127.0.0.1'}:${config.port || 80}`;
            const proxyServer = httpProxy.createProxyServer({
                target: target,
            });
            proxyServer.on('error', function (err, req, res) {
                'use strict';
                console.log(err);
                try {
                    res.writeHead(500);
                    res.end(message);
                }
                catch (e) {
                    console.log('Error doing proxy!', e);
                }
            });
            proxyServer.web(request, response);
        }
        function loginPage(password, filter) {
            if (request.url.indexOf('login') >= 0) {
                const form = new formidable.IncomingForm();
                form.parse(request, (err, fields) => {
                    if (fields.password && fields.password === password) {
                        const encodedPassword = encode(password);
                        response.setHeader('Set-Cookie', [
                            `password${filter || ''}=${encodedPassword};path=/;max-age=${24 * 60 * 60}`,
                        ]);
                        const url = `//${host}/${filter || ''}`;
                        response.writeHead(303, { 'Content-Type': 'text/html' });
                        response.end(`<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Login Successful, redirecting to: <a href='${url}'>${url}</a></body></html>`);
                    }
                    else {
                        response.writeHead(401);
                        response.end('Wrong password');
                    }
                });
            }
            else {
                response.writeHead(200);
                if (filter) {
                    response.end(simpleLoginPage.replace('/login', `/${filter}/login`));
                }
                else {
                    response.end(simpleLoginPage);
                }
            }
        }
    }
    console.log('Server has started on port: ' + port);
    server = http.createServer(onRequest).listen(port);
    const io = socketIO.listen(server, {});
    (0, socket_1.socketInit)(io, handle);
    server.on('error', function (e) {
        console.log("Server error", e);
    });
    server.on('upgrade', function (request, socket, head) {
        'use strict';
        let host = request.headers['x-host'] || request.headers.host;
        host = host.split(':')[0];
        const proxies = handle.proxies[host];
        let filterWord = url.parse(request.url).pathname.split('/')[1];
        if (proxies) {
            let proxyConfig = null;
            if (filterWord) {
                proxyConfig = proxies[filterWord];
            }
            else {
                proxyConfig = proxies['*'];
            }
            const proxyServer = httpProxy
                .createProxyServer({
                ws: true,
                target: {
                    host: proxyConfig && proxyConfig.host ? proxyConfig.host : '127.0.0.1',
                    port: proxyConfig && proxyConfig.port ? proxyConfig.port : 80,
                },
            });
            proxyServer.on('error', function (err, req, res) {
                'use strict';
                console.log(err);
                try {
                    res.writeHead(500);
                    res.end(proxyConfig.message);
                }
                catch (e) {
                    console.log('Error doing upgraded proxy!', e);
                }
            });
            proxyServer.ws(request, socket, head);
        }
    });
    return server;
}
exports.start = start;
function getDateTime() {
    const date = new Date(Date.now() + 36000000);
    let hour = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;
    let min = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;
    let day = date.getDate();
    day = (day < 10 ? '0' : '') + day;
    return year + ':' + month + ':' + day + ' ' + hour + ':' + min;
}
function getCookies(request) {
    const cookies = {};
    if (request.headers.cookie) {
        request.headers.cookie.split(';').forEach(function (d) {
            cookies[d.split('=')[0].trim()] = d
                .substring(d.split('=')[0].length + 1)
                .trim();
        });
    }
    return cookies;
}
const salt = Math.floor(Math.random() * 999);
function encode(string) {
    'use strict';
    const buff = Buffer.from(string);
    return buff.toString('base64') + salt;
}
const simpleLoginPage = `<html>
<head>
<title>Login</title>
<style>
div {
    text-align: center;
    width: 300px;
    margin: 200px auto;
    background: lightblue;
    padding: 10px 20px;
    border-radius: 15px;
}
</style>
</head>
<body>
<div>
    <h1>Enter Password</h1>
    <form action="/login" method="post">
        <input type="password" placeholder="Enter Password" name="password" autofocus required>
        <button type="submit">Login</button>
    </form>
</div>
</body>
</html>`;
