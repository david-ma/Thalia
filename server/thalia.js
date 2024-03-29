if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
define("requestHandlers", ["require", "exports", "fs", "path", "sass"], function (require, exports, fs, path, sass) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Website = exports.handle = exports.loadMustacheTemplate = void 0;
    const fsPromise = fs.promises;
    const Handlebars = require('handlebars');
    const _ = require('lodash');
    class Website {
        constructor(site, config) {
            if (typeof config === 'object') {
                this.name = site;
                this.data = '';
                this.dist = '';
                this.cache = typeof config.cache === 'boolean' ? config.cache : true;
                this.folder =
                    typeof config.folder === 'string'
                        ? config.folder
                        : path.resolve(process.cwd(), 'websites', site, 'public');
                this.workspacePath =
                    typeof config.workspacePath === 'string'
                        ? config.workspacePath
                        : path.resolve(process.cwd(), 'websites', site);
                this.domains = typeof config.domains === 'object' ? config.domains : [];
                this.pages = typeof config.pages === 'object' ? config.pages : {};
                this.redirects =
                    typeof config.redirects === 'object' ? config.redirects : {};
                this.services = typeof config.services === 'object' ? config.services : {};
                this.controllers =
                    typeof config.controllers === 'object' ? config.controllers : {};
                this.proxies = typeof config.proxies === 'object' ? config.proxies : {};
                this.sockets =
                    typeof config.sockets === 'object'
                        ? config.sockets
                        : { on: [], emit: [] };
                this.security =
                    typeof config.security === 'object'
                        ? config.security
                        : {
                            loginNeeded: function () {
                                return false;
                            },
                        };
                this.viewableFolders = config.viewableFolders || false;
                this.views = false;
            }
            else {
                console.log("Config isn't an object");
            }
        }
    }
    exports.Website = Website;
    const handle = {
        websites: {},
        index: { localhost: 'default' },
        loadAllWebsites: function () {
            const standAlone = !fs.existsSync('websites');
            if (standAlone) {
                console.log('Serving stand alone website');
                const workspace = '..';
                handle.index.localhost = workspace;
                const site = workspace;
                let config;
                try {
                    const start = Date.now();
                    const list_of_paths = [
                        {
                            config: path.resolve(__dirname, '..', 'config.js'),
                            workspace: path.resolve(__dirname, '..'),
                        },
                        {
                            config: path.resolve(__dirname, '..', 'config', 'config.js'),
                            workspace: path.resolve(__dirname, '..'),
                        },
                        {
                            config: path.resolve(process.cwd(), 'config.js'),
                            workspace: process.cwd(),
                        },
                        {
                            config: path.resolve(process.cwd(), 'config', 'config.js'),
                            workspace: process.cwd(),
                        },
                    ];
                    for (const paths of list_of_paths) {
                        if (fs.existsSync(paths.config)) {
                            config = require(paths.config).config;
                            config.workspacePath = paths.workspace;
                            if (config) {
                                break;
                            }
                        }
                    }
                    if (!config) {
                        console.log('No config provided');
                    }
                    console.log(`Loading time: ${Date.now() - start} ms - config.js`);
                }
                catch (err) {
                    if (err.code !== 'MODULE_NOT_FOUND') {
                        console.log('Warning, your config script is broken!');
                        console.error(err);
                        console.log();
                    }
                    else {
                        console.log('Error in config.js!');
                        console.log(err);
                    }
                }
                config.standAlone = true;
                config.folder = path.resolve(config.workspacePath, 'public');
                handle.addWebsite(site, config);
                console.log('Setting workspace to current directory');
                handle.index.localhost = workspace;
            }
            else if (handle.index.localhost !== 'default') {
                console.log('Only load %s', handle.index.localhost);
                const site = handle.index.localhost;
                console.log('Adding site: ' + site);
                let config = {};
                try {
                    const start = Date.now();
                    if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
                        config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config;
                    }
                    else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
                        config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config;
                    }
                    else {
                        console.log(`No config provided for ${site}, just serving the public folder`);
                    }
                    console.log(`${Date.now() - start} ms - config.js for ${site}`);
                }
                catch (err) {
                    if (err.code !== 'MODULE_NOT_FOUND') {
                        console.log('Warning, your config script for ' + site + ' is broken!');
                        console.error(err);
                        console.log();
                    }
                    else {
                        console.log(`Error in ${site} config!`);
                        console.log(err);
                    }
                }
                config.cache = false;
                handle.addWebsite(site, config);
            }
            else {
                fs.readdirSync('websites/').forEach(function (site) {
                    if (fs.lstatSync('websites/' + site).isDirectory()) {
                        console.log('Adding site: ' + site);
                        let config = {};
                        try {
                            if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
                                config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config;
                            }
                            else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
                                config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config;
                            }
                            else {
                                console.log(`No config provided for ${site}, just serve the public folder`);
                            }
                        }
                        catch (err) {
                            if (err.code !== 'MODULE_NOT_FOUND') {
                                console.log('Warning, your config script for ' + site + ' is broken!');
                                console.error(err);
                                console.log();
                            }
                            else {
                                if (err.requireStack &&
                                    err.requireStack[0].indexOf('thalia.js') > 0) {
                                    console.log(`${site} does not use config.js, just serve the public folder`);
                                }
                                else {
                                    console.error(`Error loading config for ${site}`);
                                    console.log(err);
                                    console.log();
                                }
                            }
                        }
                        handle.addWebsite(site, config);
                    }
                });
            }
        },
        addWebsite: function (site, config) {
            config = config || {};
            handle.websites[site] = new Website(site, config);
            const baseUrl = config.standAlone
                ? config.workspacePath
                : path.resolve(__dirname, '..', 'websites', site);
            if (fs.existsSync(path.resolve(baseUrl, 'data'))) {
                handle.websites[site].data = path.resolve(baseUrl, 'data');
            }
            if (fs.existsSync(path.resolve(baseUrl, 'dist'))) {
                handle.websites[site].dist = path.resolve(baseUrl, 'dist');
            }
            if (Array.isArray(handle.websites[site].proxies)) {
                ;
                handle.websites[site].proxies.forEach(function (proxy) {
                    proxy.domains.forEach((domain) => {
                        handle.proxies[domain] = makeProxy(handle.proxies[domain], proxy);
                    });
                });
            }
            else {
                Object.keys(handle.websites[site].proxies).forEach(function (domain) {
                    const rawProxy = (handle.websites[site].proxies)[domain];
                    handle.proxies[domain] = makeProxy(handle.proxies[domain], rawProxy);
                });
            }
            function makeProxy(proxies, rawProxy) {
                proxies = proxies || {};
                const proxy = {
                    host: rawProxy.host || '127.0.0.1',
                    message: rawProxy.message || 'Error, server is down.',
                    port: rawProxy.port || 80,
                    filter: rawProxy.filter,
                    password: rawProxy.password,
                    silent: rawProxy.silent || false,
                };
                if (rawProxy.filter) {
                    proxies[rawProxy.filter] = proxy;
                }
                else {
                    proxies['*'] = proxy;
                }
                return proxies;
            }
            if (fs.existsSync(path.resolve(baseUrl, 'config', 'db_bootstrap.js'))) {
                const start = Date.now();
                try {
                    const { seqOptions, seq } = require(path.resolve(baseUrl, 'config', 'db_bootstrap.js'));
                    handle.websites[site].seq = seq;
                    seq.sequelize.authenticate().then(() => {
                        console.log(`${Date.now() - start} ms - Database db_bootstrap.js ${site}`);
                    }, (err) => {
                        console.log(`${Date.now() - start} ms - Database db_bootstrap.js ${site}`);
                        console.error(`Error connecting to database in ${site}/config/db_bootstrap.js ${err.message}`);
                        console.log('Options:', seqOptions || 'No options provided');
                        process.exit(1);
                    });
                }
                catch (e) {
                    console.log(`${Date.now() - start} ms - Database db_bootstrap.js ${site}`);
                    console.log(`Couldn't load db_bootstrap.js for ${site}`);
                    console.log(e);
                    process.exit(1);
                }
            }
            if (fs.existsSync(path.resolve(baseUrl, 'views'))) {
                handle.websites[site].views = true;
                handle.websites[site].readAllViews = function (callback) {
                    const promises = [
                        readAllViewsInFolder(path.resolve(__dirname, '..', 'websites', 'example', 'views')),
                        readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
                        readAllViewsInFolder(path.resolve(baseUrl, 'views')),
                    ];
                    Promise.all(promises)
                        .then(([exampleViews, thaliaViews, websiteViews]) => {
                        return _.merge(thaliaViews, exampleViews, websiteViews);
                    })
                        .then(callback);
                };
                handle.websites[site].readTemplate = function (config) {
                    readTemplate(config.template, path.resolve(baseUrl, 'views'), config.content)
                        .catch((e) => {
                        console.error('error here?', e);
                        config.callback(e);
                    })
                        .then((d) => {
                        config.callback(d);
                    });
                };
                const promises = [
                    readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
                    readAllViewsInFolder(path.resolve(baseUrl, 'views')),
                ];
                Promise.all(promises)
                    .then(([scaffoldViews, projectViews]) => {
                    return _.merge(scaffoldViews, projectViews);
                })
                    .then((views) => {
                    handle.websites[site].views = views;
                    fsPromise
                        .readdir(path.resolve(baseUrl, 'views'))
                        .then(function (files) {
                        files
                            .filter((file) => file.match(/.mustache|.hbs/))
                            .forEach((file) => {
                            const webpage = file.split(/.mustache|.hbs/)[0];
                            if ((config.mustacheIgnore
                                ? config.mustacheIgnore.indexOf(webpage) === -1
                                : true) &&
                                !handle.websites[site].controllers[webpage]) {
                                handle.websites[site].controllers[webpage] = function (controller) {
                                    if (handle.websites[site].cache) {
                                        registerAllViewsAsPartials(views);
                                        controller.res.end(Handlebars.compile(views[webpage])({}));
                                    }
                                    else {
                                        readAllViewsInFolder(path.resolve(baseUrl, 'views')).then((views) => {
                                            handle.websites[site].views = views;
                                            registerAllViewsAsPartials(views);
                                            controller.res.end(Handlebars.compile(views[webpage])({}));
                                        });
                                    }
                                };
                            }
                        });
                    })
                        .catch((e) => {
                        console.log('Error reading views folder');
                        console.log(e);
                    });
                });
            }
            handle.index[site + '.david-ma.net'] = site;
            handle.index[`${site}.com`] = site;
            handle.index[`${site}.net`] = site;
            handle.websites[site].domains.forEach(function (domain) {
                handle.index[domain] = site;
            });
        },
        getWebsite: function (domain) {
            let site = handle.index.localhost;
            if (domain) {
                if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
                    site = handle.index[domain];
                }
                domain = domain.replace('www.', '');
                if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
                    site = handle.index[domain];
                }
            }
            return handle.websites[site];
        },
        proxies: {},
    };
    exports.handle = handle;
    handle.addWebsite('default', {});
    async function readTemplate(template, folder, content = '') {
        console.log(`Running readTemplate(${template}, ${folder}, ${content})`);
        return new Promise((resolve, reject) => {
            const promises = [];
            const filenames = ['template', 'content'];
            promises.push(new Promise((resolve) => {
                fsPromise
                    .readFile(`${folder}/${template}`, {
                    encoding: 'utf8',
                })
                    .catch(() => {
                    resolve(`404 - ${template} not found`);
                })
                    .then((data) => {
                    resolve(data);
                });
            }));
            promises.push(new Promise((resolve) => {
                if (Array.isArray(content) && content[0])
                    content = content[0];
                loadMustacheTemplate(`${folder}/content/${content}.mustache`)
                    .catch((e) => {
                    console.error('Error loading mustache template.', e);
                    fsPromise
                        .readFile(`${folder}/404.mustache`, {
                        encoding: 'utf8',
                    })
                        .then((result) => {
                        resolve(result);
                    });
                })
                    .then((d) => resolve(d));
            }));
            fsPromise.readdir(`${folder}/partials/`).then(function (d) {
                d.forEach(function (filename) {
                    if (filename.match(/.mustache|.hbs/)) {
                        filenames.push(filename.split(/.mustache|.hbs/)[0]);
                        promises.push(fsPromise.readFile(`${folder}/partials/${filename}`, {
                            encoding: 'utf8',
                        }));
                    }
                });
                Promise.all(promises).then(function (array) {
                    const results = {};
                    filenames.forEach((filename, i) => {
                        results[filename] = array[i];
                    });
                    if (typeof results.content === 'object') {
                        results.scripts = results.content.scripts;
                        results.styles = results.content.styles;
                        results.content = results.content.content;
                    }
                    resolve(results);
                });
            });
        });
    }
    async function readAllViewsInFolder(folder) {
        return new Promise((resolve, reject) => {
            fsPromise
                .readdir(folder)
                .then((directory) => {
                Promise.all(directory.map((filename) => new Promise((resolve) => {
                    if (filename.match(/.mustache|.hbs/)) {
                        fsPromise
                            .readFile(`${folder}/${filename}`, 'utf8')
                            .then((file) => {
                            const name = filename.split(/.mustache|.hbs/)[0];
                            resolve({
                                [name]: file,
                            });
                        })
                            .catch((e) => {
                            console.log('Error in readAllViewsInFolder, reading the file:', filename);
                            console.log('error', e);
                        });
                    }
                    else {
                        fsPromise.lstat(`${folder}/${filename}`).then((d) => {
                            if (d.isDirectory()) {
                                readAllViewsInFolder(`${folder}/${filename}`).then((d) => resolve(d));
                            }
                            else {
                                resolve({});
                            }
                        });
                    }
                }))).then((array) => {
                    if (array.length === 0) {
                        resolve({});
                    }
                    else {
                        resolve(array.reduce((a, b) => Object.assign(a, b)));
                    }
                }, (reason) => {
                    console.log('Error in readAllViews', reason);
                    reject(reason);
                });
            })
                .catch((e) => {
                console.log('Error in readAllViewsInFolder');
                console.log(e);
            });
        });
    }
    function loadMustacheTemplate(file) {
        return new Promise((resolve, reject) => {
            fsPromise
                .readFile(file, {
                encoding: 'utf8',
            })
                .catch(() => {
                console.error('Error reading file: ', file);
                reject(`Error reading file: ${file}`);
            })
                .then((fileText) => {
                const scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g;
                const styleEx = /<style\b.*>([^<]*(?:(?!<\/style>)<[^<]*)*)<\/style>/g;
                const scripts = [...fileText.matchAll(scriptEx)].map((d) => d[0]);
                const styles = [...fileText.matchAll(styleEx)].map((d) => d[0]);
                let styleData = styles.join('\n').replace(/<\/?style>/g, '');
                sass.render({
                    data: styleData,
                    outputStyle: 'compressed',
                }, function (err, sassResult) {
                    if (err) {
                        console.error(`Error reading SCSS from file: ${file}`);
                        console.error('Error', err);
                        resolve({
                            content: fileText,
                            scripts: '',
                            styles: '',
                        });
                    }
                    else {
                        styleData = sassResult.css.toString();
                        resolve({
                            content: fileText.replace(scriptEx, '').replace(styleEx, ''),
                            scripts: scripts.join('\n'),
                            styles: `<style>${styleData}</style>`,
                        });
                    }
                });
            })
                .catch(() => {
                console.error(`Error with SCSS or Script file: ${file}`);
                resolve({
                    content: '500',
                    scripts: '',
                    styles: '',
                });
            });
        });
    }
    exports.loadMustacheTemplate = loadMustacheTemplate;
    function registerAllViewsAsPartials(views) {
        Object.entries(views).forEach(([key, value]) => {
            Handlebars.registerPartial(key, value);
        });
    }
});
define("router", ["require", "exports", "fs", "mime", "zlib", "url"], function (require, exports, fs, mime, zlib, url) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.router = void 0;
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
});
define("socket", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.socketInit = void 0;
    function socketInit(io, handle) {
        Object.keys(handle.websites).forEach((siteName) => {
            io.of(`/${siteName}`)
                .use((socket, next) => {
                const host = socket.handshake.headers.host;
                const website = handle.getWebsite(host);
                if (website.name === siteName) {
                    next();
                }
                else {
                    next(new Error('Wrong namespace for this site'));
                }
            })
                .on('connection', function (socket) {
                const host = socket.handshake.headers.host;
                const website = handle.getWebsite(host);
                console.log('Socket connection ' +
                    socket.id +
                    ' from ' +
                    socket.handshake.headers.referer);
                website.sockets.on.forEach(function (d) {
                    socket.on(d.name, function (data) {
                        d.callback(socket, data, website.seq);
                    });
                });
                website.sockets.emit.forEach((emitter) => {
                    emitter(socket, website.seq);
                });
            });
        });
    }
    exports.socketInit = socketInit;
});
define("server", ["require", "exports", "socket", "http", "url", "http-proxy", "socket.io", "formidable"], function (require, exports, socket_1, http, url, httpProxy, socket_io_1, formidable) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.start = void 0;
    const socketIO = new socket_io_1.Server({});
    let blacklist = [];
    try {
        blacklist = require('../blacklist').blacklist;
        console.log('This is the blacklist:', blacklist);
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
});
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}
global.require = require;
define(function (require) {
    require(['server', 'router', 'requestHandlers', 'fs'], function (server, router, requestHandlers, fs) {
        var argv = require('minimist')(process.argv.slice(2));
        let port = '1337';
        const pattern = /^\d{0,5}$/;
        let workspace = 'default';
        if (process.argv[2] !== null && pattern.exec(process.argv[2])) {
            port = process.argv[2];
        }
        else if (process.argv[3] !== null && pattern.exec(process.argv[3])) {
            port = process.argv[3];
        }
        if (process.argv[2] !== null &&
            process.argv[2] !== undefined &&
            !pattern.exec(process.argv[2])) {
            workspace = process.argv[2];
        }
        else if (process.argv[3] !== null &&
            process.argv[3] !== undefined &&
            !pattern.exec(process.argv[3])) {
            workspace = process.argv[3];
        }
        if (argv.s !== undefined) {
            workspace = argv.w;
        }
        if (argv.site !== undefined) {
            workspace = argv.site;
        }
        if (argv.p !== undefined && pattern.exec(argv.port)) {
            port = argv.p;
        }
        if (argv.port !== undefined && pattern.exec(argv.port)) {
            port = argv.port;
        }
        if (fs.existsSync(`websites/${workspace}`)) {
            console.log(`Setting workspace to websites/${workspace}`);
        }
        else if (fs.existsSync('config.js') ||
            fs.existsSync('config/config.js')) {
            console.log('Thalia running in stand alone mode.');
        }
        else {
            console.error(`Error. ${workspace} is an invalid workspace`);
            process.exit(1);
        }
        requestHandlers.handle.index.localhost = workspace;
        requestHandlers.handle.loadAllWebsites();
        server.start(router.router, requestHandlers.handle, port);
    });
});
