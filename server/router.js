"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const fs = require("fs");
const mime = require("mime");
const zlib = require("zlib");
const url = require("url");
const router = function (website, pathname, response, request) {
    safeSetHeader(response, 'Access-Control-Allow-Headers', '*');
    const route = new Promise(function (resolve, reject) {
        try {
            const data = {
                cookies: {},
                words: [],
            };
            if (request.headers.cookie) {
                request.headers.cookie.split(';').forEach(function (d) {
                    data.cookies[d.split('=')[0].trim()] = d
                        .substring(d.split('=')[0].length + 1)
                        .trim();
                });
            }
            data.words = pathname.split('/');
            resolve(data);
        }
        catch (err) {
            console.log("Error parsing route's cookies");
            console.log(err);
            reject(err);
        }
    });
    route
        .then(function (d) {
        if (typeof website.security !== 'undefined' &&
            website.security.loginNeeded(pathname, d.cookies)) {
            website.services.login(response, request);
        }
        else {
            if (typeof website.pages[d.words[1]] !== 'undefined') {
                pathname = website.pages[d.words[1]];
            }
            if (typeof website.redirects[pathname] !== 'undefined') {
                redirect(website.redirects[pathname]);
            }
            else if (typeof website.services[d.words[1]] === 'function') {
                website.services[d.words[1]](response, request, website.seq, d.words[2]);
            }
            else if (typeof website.controllers[d.words[1]] === 'function') {
                website.controllers[d.words[1]]({
                    handlebars: require('handlebars'),
                    res: {
                        getCookie: function (cookieName) {
                            return d.cookies[cookieName];
                        },
                        setCookie: function (cookie, expires) {
                            if (expires && expires instanceof Date !== true) {
                                console.log('Expires is not a date');
                                expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                            }
                            const [key, value] = Object.entries(cookie)[0];
                            expires =
                                expires || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                            const cookieString = [
                                `${key}=${value}`,
                                `Path=/`,
                                `Expires=${expires.toUTCString()}`,
                            ].join('; ');
                            console.log('Setting Cookie', cookieString);
                            safeSetHeader(response, 'Set-Cookie', cookieString);
                        },
                        deleteCookie: function (cookieName) {
                            safeSetHeader(response, 'Set-Cookie', `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`);
                        },
                        end: function (result) {
                            if (response.writableEnded) {
                                console.log('Response already ended, cannot end again');
                                return;
                            }
                            if (response.headersSent) {
                                console.log('Headers already sent, cannot end');
                                return;
                            }
                            const acceptedEncoding = request.headers['accept-encoding'] || '';
                            const input = Buffer.from(result, 'utf8');
                            safeSetHeader(response, 'Content-Type', 'text/html');
                            if (acceptedEncoding.indexOf('gzip') >= 0) {
                                try {
                                    zlib.gzip(input, function (err, result) {
                                        if (err) {
                                            response.writeHead(503);
                                            response.end(err);
                                        }
                                        else {
                                            if (!response.headersSent) {
                                                response.writeHead(200, {
                                                    'Content-Encoding': 'gzip',
                                                });
                                            }
                                            response.end(result);
                                        }
                                    });
                                }
                                catch (e) {
                                    console.error(e);
                                }
                            }
                            else if (acceptedEncoding.indexOf('deflate') >= 0) {
                                try {
                                    zlib.deflate(input, function (err, result) {
                                        if (err) {
                                            response.writeHead(503);
                                            response.end(err);
                                        }
                                        else {
                                            if (!response.headersSent) {
                                                response.writeHead(200, {
                                                    'Content-Encoding': 'deflate',
                                                });
                                            }
                                            response.end(result);
                                        }
                                    });
                                }
                                catch (e) {
                                    console.error(e);
                                }
                            }
                            else {
                                response.end(result);
                            }
                        },
                    },
                    req: request,
                    response: response,
                    request: request,
                    routeFile: routeFile,
                    ip: (request.headers['x-real-ip'] ||
                        request.connection.remoteAddress ||
                        '').toString(),
                    db: website.seq || null,
                    views: website.views,
                    workspacePath: website.workspacePath,
                    name: website.name,
                    readAllViews: website.readAllViews,
                    readTemplate: website.readTemplate,
                    path: d.words.slice(2),
                    query: url.parse(request.url, true).query,
                    cookies: d.cookies,
                });
            }
            else if (website.data &&
                fs.existsSync(website.data.concat(pathname)) &&
                fs.lstatSync(website.data.concat(pathname)).isFile()) {
                routeFile(website.data.concat(pathname));
            }
            else if (website.data &&
                fs.existsSync(website.data.concat(pathname).concat('.gz'))) {
                safeSetHeader(response, 'Content-Encoding', 'gzip');
                routeFile(website.data.concat(pathname, '.gz'));
            }
            else if ((website.dist &&
                fs.existsSync(website.dist.concat(pathname)) &&
                fs.lstatSync(website.dist.concat(pathname)).isFile()) ||
                (website.dist &&
                    fs.existsSync(website.dist.concat(pathname, '/index.html')) &&
                    fs.lstatSync(website.dist.concat(pathname, '/index.html')).isFile())) {
                routeFile(website.dist.concat(pathname));
            }
            else {
                routeFile(website.folder.concat(pathname));
            }
        }
    })
        .catch(renderError);
    function renderError(d) {
        console.log('Error?', d);
        d = d
            ? {
                code: 500,
                message: JSON.stringify(d),
            }
            : {
                code: 500,
                message: '500 Server Error',
            };
        response.writeHead(d.code, {
            'Content-Type': 'text/html',
        });
        response.end(d.message);
    }
    function redirect(url) {
        if (typeof url === 'string') {
            console.log('Forwarding user to: ' + url);
            response.writeHead(303, { 'Content-Type': 'text/html' });
            response.end(`<html><head><meta http-equiv="refresh" content="0;url='${url}'"></head>
<body>Redirecting to: <a href='${url}'>${url}</a></body></html>`);
        }
        else {
            console.log('Error, url missing');
            response.writeHead(501, { 'Content-Type': 'text/plain' });
            response.end('501 URL Not Found\n');
        }
    }
    function routeFile(filename) {
        fs.exists(filename, function (exists) {
            if (!exists) {
                console.log('No file found for ' + filename);
                response.writeHead(404, { 'Content-Type': 'text/plain' });
                response.end('404 Page Not Found\n');
                return;
            }
            const acceptedEncoding = request.headers['accept-encoding'] || '';
            const filetype = mime.getType(filename);
            try {
                safeSetHeader(response, 'Content-Type', filetype);
            }
            catch (e) {
                console.error(e);
            }
            let router = function (file) {
                response.writeHead(200);
                response.end(file);
                return;
            };
            fs.stat(filename, function (err, stats) {
                if (err) {
                    response.writeHead(503);
                    response.end(err);
                    return;
                }
                else {
                    try {
                        safeSetHeader(response, 'Cache-Control', 'no-cache');
                    }
                    catch (e) {
                        console.error(e);
                    }
                    if (website.cache) {
                        if (stats.size > 10240) {
                            try {
                                safeSetHeader(response, 'Cache-Control', 'public, max-age=600');
                                safeSetHeader(response, 'Expires', new Date(Date.now() + 600000).toUTCString());
                                const queryObject = url.parse(request.url, true).query;
                                if (queryObject.v) {
                                    safeSetHeader(response, 'Cache-Control', 'public, max-age=31536000');
                                    safeSetHeader(response, 'Expires', new Date(Date.now() + 31536000000).toUTCString());
                                }
                            }
                            catch (e) {
                                console.error(e);
                            }
                        }
                    }
                    if (filetype &&
                        (filetype.slice(0, 4) === 'text' ||
                            filetype === 'application/json' ||
                            filetype === 'application/javascript')) {
                        try {
                            safeSetHeader(response, 'Content-Type', `${filetype}; charset=UTF-8`);
                        }
                        catch (e) {
                            console.error(e);
                        }
                        router = function (file) {
                            if (acceptedEncoding.indexOf('gzip') >= 0) {
                                try {
                                    zlib.gzip(file, function (err, result) {
                                        if (err) {
                                            response.writeHead(503);
                                            response.end(err);
                                        }
                                        else {
                                            response.writeHead(200, { 'content-encoding': 'gzip' });
                                            response.end(result);
                                        }
                                    });
                                }
                                catch (e) {
                                    console.error(e);
                                }
                            }
                            else if (acceptedEncoding.indexOf('deflate') >= 0) {
                                zlib.deflate(file, function (err, result) {
                                    if (err) {
                                        response.writeHead(503);
                                        response.end(err);
                                    }
                                    else {
                                        response.writeHead(200, { 'content-encoding': 'deflate' });
                                        response.end(result);
                                    }
                                });
                            }
                            else {
                                response.writeHead(200);
                                response.end(file);
                            }
                        };
                    }
                }
            });
            fs.readFile(filename, function (err, file) {
                if (err) {
                    fs.readdir(filename, function (e, dir) {
                        if (!e &&
                            dir &&
                            dir instanceof Array &&
                            dir.indexOf('index.html') >= 0) {
                            if (filename.lastIndexOf('/') === filename.length - 1) {
                                filename += 'index.html';
                            }
                            else {
                                redirect(request.url.replace(/(^\/.*?)\/?(\?$|$)/, '$1/$2'));
                                return;
                            }
                            fs.readFile(filename, (e, file) => router(file));
                        }
                        else {
                            let base = request.url.split('?')[0];
                            base = base.slice(-1) === '/' ? base : `${base}/`;
                            const slug = base.split('/').slice(-2).slice(0, 1)[0];
                            if (website.viewableFolders
                                ? website.viewableFolders instanceof Array
                                    ? website.viewableFolders.indexOf(slug) !== -1
                                    : true
                                : false) {
                                const links = [];
                                dir.forEach((file) => {
                                    links.push(`<li><a href="${base + file}">${file}</a></li>`);
                                });
                                const result = `<h1>Links</h1>
<ul>
${links.join('\n')}
</ul>`;
                                response.writeHead(200, { 'Content-Type': 'text/html' });
                                response.end(result);
                            }
                            else {
                                console.log('Error 500, content protected? ' + filename);
                                response.writeHead(500, { 'Content-Type': 'text/plain' });
                                response.end('Error 500, content protected\n' + err);
                            }
                        }
                    });
                }
                else {
                    router(file);
                }
            });
        });
    }
};
exports.router = router;
function safeSetHeader(response, key, value) {
    if (!response.headersSent && !response.writableEnded) {
        response.setHeader(key, value);
    }
    else {
        console.error('Headers already sent, cannot set header', {
            key,
            value,
        });
    }
}
