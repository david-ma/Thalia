"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Website = exports.handle = void 0;
const fs = require("fs");
const fsPromise = fs.promises;
const path = require("path");
const sass = require("sass");
const Handlebars = require("handlebars");
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
        if (fs.existsSync(path.resolve(baseUrl, 'db_bootstrap.js'))) {
            try {
                const start = Date.now();
                handle.websites[site].seq = require(path.resolve(baseUrl, 'db_bootstrap.js')).seq;
                console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`);
            }
            catch (e) {
                console.log(e);
            }
        }
        else if (fs.existsSync(path.resolve(baseUrl, 'config', 'db_bootstrap.js'))) {
            try {
                const start = Date.now();
                handle.websites[site].seq = require(path.resolve(baseUrl, 'config', 'db_bootstrap.js')).seq;
                console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`);
            }
            catch (e) {
                console.log(e);
            }
        }
        if (fs.existsSync(path.resolve(baseUrl, 'views'))) {
            handle.websites[site].views = true;
            handle.websites[site].readAllViews = function (cb) {
                readAllViews(path.resolve(baseUrl, 'views')).then((d) => cb(d));
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
            readAllViews(path.resolve(baseUrl, 'views')).then((views) => {
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
                                    readAllViews(path.resolve(baseUrl, 'views')).then((views) => {
                                        handle.websites[site].views = views;
                                        registerAllViewsAsPartials(views);
                                        controller.res.end(Handlebars.compile(views[webpage])({}));
                                    });
                                }
                            };
                        }
                    });
                })
                    .catch((e) => console.log(e));
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
async function readAllViews(folder) {
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
                        .catch((e) => console.log(e));
                }
                else {
                    fsPromise.lstat(`${folder}/${filename}`).then((d) => {
                        if (d.isDirectory()) {
                            readAllViews(`${folder}/${filename}`).then((d) => resolve(d));
                        }
                        else {
                            resolve({});
                        }
                    });
                }
            }))).then((array) => {
                console.log('array', array);
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
            .catch((e) => console.log(e));
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
            resolve(`Error reading file: ${file}`);
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
function registerAllViewsAsPartials(views) {
    Object.entries(views).forEach(([key, value]) => {
        Handlebars.registerPartial(key, value);
    });
}
