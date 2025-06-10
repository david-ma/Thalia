"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// router.ts
const fs = require("fs");
const mime = require("mime");
const zlib = require("zlib");
const url = require("url");
function isRoutable(target_folder, local_path) {
    return ((fs.existsSync(target_folder.concat(local_path)) &&
        fs.lstatSync(target_folder.concat(local_path)).isFile()) ||
        (fs.existsSync(target_folder.concat(local_path, '/index.html')) &&
            fs.lstatSync(target_folder.concat(local_path, '/index.html')).isFile()));
}
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
            // This should not be lowercase??? Keys are case sensitive!
            // .map(function(d){
            //     return d.toLowerCase();
            // });
            resolve(data);
        }
        catch (err) {
            console.log("Error parsing route's cookies");
            console.log(err);
            reject(err);
        }
    });
    /**
     * The router should check what sort of route we're doing, and act appropriately.
     * Check:
     * - Security
     * - Redirects to outside websites
     * - Internal page alias
     * - Services / functions
     * - /data/ folder might have a file
     * - otherwise, we serve the file normally from that website's dist -> public folder
     * - otherwise, we serve the file from the example public folder
     *
     * - When serving the file normally, we need to check the header to see if it can be zipped or should be zipped.
     */
    route
        .then(function (d) {
        if (typeof website.security !== 'undefined' &&
            website.security.loginNeeded(pathname, d.cookies)) {
            website.services.login(response, request);
        }
        else {
            // If a page substitution exists, substitute it.
            if (typeof website.pages[d.words[1]] !== 'undefined') {
                pathname = website.pages[d.words[1]];
            }
            // Pathnames should be decoded
            // No need to decode URI Components
            // pathname = decodeURIComponent(pathname)
            // If there's a redirect, go to it
            if (typeof website.redirects[pathname] !== 'undefined') {
                redirect(website.redirects[pathname]);
                // if there's a service, use it
            }
            else if (typeof website.services[d.words[1]] === 'function') {
                website.services[d.words[1]](response, request, website.seq, d.words[2]);
                // if there are controllers, call the right one
                // Note, this includes any top level mustache files, since they're loaded as generic, dataless controllers
            }
            else if (typeof website.controllers[d.words[1]] === 'function') {
                website.controllers[d.words[1]]({
                    handlebars: require('handlebars'),
                    res: {
                        getCookie: function (cookieName) {
                            return d.cookies[cookieName];
                        },
                        setCookie: function (cookie, expires) {
                            // TODO: Check that cookie is an object
                            // Check that expires was passed and is a date
                            if (expires && expires instanceof Date !== true) {
                                console.log('Expires is not a date');
                                expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                            }
                            const [key, value] = Object.entries(cookie)[0];
                            // One week from now
                            expires =
                                expires || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
                            const cookieString = [
                                // It would be better to use __Host and secure
                                // But it makes things harder for development
                                // `__Host-${key}=${value}`,
                                // `Secure`,
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
                // if there is a matching data file
            }
            else if (website.data &&
                fs.existsSync(website.data.concat(pathname)) &&
                fs.lstatSync(website.data.concat(pathname)).isFile()) {
                routeFile(website.data.concat(pathname));
                // if there is a matching .gz file in the data folder
            }
            else if (website.data &&
                fs.existsSync(website.data.concat(pathname).concat('.gz'))) {
                safeSetHeader(response, 'Content-Encoding', 'gzip');
                routeFile(website.data.concat(pathname, '.gz'));
                // if there is a matching compiled file
            }
            else if (website.dist && isRoutable(website.dist, pathname)) {
                routeFile(website.dist.concat(pathname));
            }
            else if (
            // Check if the file exists in the workspace public folder
            website.folder &&
                isRoutable(website.folder, pathname)) {
                routeFile(website.folder.concat(pathname));
            }
            else if (
            // Otherwise, try to rout to the example public folder
            isRoutable(__dirname.concat('/../websites/example/public'), pathname)) {
                routeFile(__dirname.concat('/../websites/example/public').concat(pathname));
            }
            else {
                // If we can't find the file, serve a 404
                // console.log('Error 404, file not found: ' + pathname)
                console.log(`Error 404, file not found: [${website.name}]${pathname}`);
                response.writeHead(404, { 'Content-Type': 'text/plain' });
                response.end('Error 404, file not found\n');
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
    /**
     * Given a filename, serve it.
     *
     * Check that the file exists
     * Check the headers..?
     * zip/unzip if needed
     *
     * @param filename
     */
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
                            // cache files bigger than 10kb?
                            // https://web.dev/http-cache/
                            try {
                                safeSetHeader(response, 'Cache-Control', 'public, max-age=600'); // store for 10 mins
                                safeSetHeader(response, 'Expires', new Date(Date.now() + 600000).toUTCString()); // expire 10 mins from now
                                const queryObject = url.parse(request.url, true).query;
                                if (queryObject.v) {
                                    // Set cache to 1 year if a cache busting query string is included
                                    // response.setHeader(
                                    //   'Cache-Control',
                                    //   'public, max-age=31536000'
                                    // )
                                    // response.setHeader(
                                    //   'Expires',
                                    //   new Date(Date.now() + 31536000000).toUTCString()
                                    // )
                                    safeSetHeader(response, 'Cache-Control', 'public, max-age=31536000'); // store for 1 year
                                    safeSetHeader(response, 'Expires', new Date(Date.now() + 31536000000).toUTCString()); // expire 1 year from now
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
                            // Note we don't have content type, caching, or zipping!!!!
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
//# sourceMappingURL=router.js.map