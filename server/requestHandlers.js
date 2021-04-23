"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
exports.__esModule = true;
exports.Website = exports.handle = void 0;
var fs = require("fs");
var fsPromise = fs.promises;
var mustache = require("mustache");
var path = require("path");
var Website = /** @class */ (function () {
    function Website(site, config) {
        if (typeof config === 'object') {
            this.name = site;
            this.data = ''; // Used to be false. Todo: Check if this is ok
            this.dist = ''; // Used to be false. Todo: Check if this is ok
            this.cache = typeof config.cache === 'boolean' ? config.cache : true;
            this.folder =
                typeof config.folder === 'string'
                    ? config.folder
                    : 'websites/' + site + '/public';
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
                        }
                    };
            this.viewableFolders = config.viewableFolders || false;
            this.views = false;
        }
        else {
            console.log("Config isn't an object");
        }
    }
    return Website;
}());
exports.Website = Website;
var handle = {
    websites: {},
    index: { localhost: 'default' },
    loadAllWebsites: function () {
        var standAlone = !fs.existsSync('websites');
        if (standAlone) {
            console.log('Serving stand alone website');
            var workspace = '..';
            handle.index.localhost = workspace;
            var site = workspace;
            var config = void 0;
            try {
                var start = Date.now();
                if (fs.existsSync(path.resolve(__dirname, '..', 'config.js'))) {
                    config = require(path.resolve(__dirname, '..', 'config')).config;
                }
                else {
                    config = require(path.resolve(__dirname, '..', 'config', 'config'))
                        .config;
                }
                console.log("Loading time: " + (Date.now() - start) + " ms - config.js");
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
            config.folder = path.resolve(__dirname, '..', 'public');
            handle.addWebsite(site, config);
            console.log('Setting workspace to current directory');
            handle.index.localhost = workspace;
        }
        else if (handle.index.localhost !== 'default') {
            console.log('Only load %s', handle.index.localhost);
            var site = handle.index.localhost;
            console.log('Adding site: ' + site);
            var config = {};
            try {
                var start = Date.now();
                if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
                    config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config;
                }
                else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
                    config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config;
                }
                else {
                    console.log("No config provided for " + site + ", just serving the public folder");
                }
                console.log(Date.now() - start + " ms - config.js for " + site);
            }
            catch (err) {
                if (err.code !== 'MODULE_NOT_FOUND') {
                    console.log('Warning, your config script for ' + site + ' is broken!');
                    console.error(err);
                    console.log();
                }
                else {
                    console.log("Error in " + site + " config!");
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
                    var config = {};
                    try {
                        if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
                            config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config;
                        }
                        else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
                            config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config;
                        }
                        else {
                            console.log("No config provided for " + site + ", just serve the public folder");
                        }
                    }
                    catch (err) {
                        if (err.code !== 'MODULE_NOT_FOUND') {
                            console.log('Warning, your config script for ' + site + ' is broken!');
                            console.error(err);
                            console.log();
                        }
                        else {
                            // Note, we want this to be silent if config.js is missing, because we can just serve the public/dist folders.
                            // but log an error if config.js requires something that is not available.
                            if (err.requireStack &&
                                err.requireStack[0].indexOf('thalia.js') > 0) {
                                console.log(site + " does not use config.js, just serve the public folder");
                            }
                            else {
                                // Do we want errors to appear in standard error? Or standard log??? Both???
                                console.error("Error loading config for " + site);
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
    // TODO: Make all of this asynchronous?
    // Add a site to the handle
    addWebsite: function (site, config) {
        config = config || {};
        handle.websites[site] = new Website(site, config);
        var baseUrl = config.standAlone
            ? path.resolve(__dirname, '..')
            : path.resolve(__dirname, '..', 'websites', site);
        // If dist or data exist, enable them.
        if (fs.existsSync(path.resolve(baseUrl, 'data'))) {
            handle.websites[site].data = path.resolve(baseUrl, 'data');
        }
        if (fs.existsSync(path.resolve(baseUrl, 'dist'))) {
            handle.websites[site].dist = path.resolve(baseUrl, 'dist');
        }
        // Proxy things
        if (Array.isArray(handle.websites[site].proxies)) {
            ;
            handle.websites[site].proxies.forEach(function (proxy) {
                proxy.domains.forEach(function (domain) {
                    handle.proxies[domain] = makeProxy(handle.proxies[domain], proxy);
                });
            });
        }
        else {
            Object.keys(handle.websites[site].proxies).forEach(function (domain) {
                var rawProxy = (handle.websites[site].proxies)[domain];
                handle.proxies[domain] = makeProxy(handle.proxies[domain], rawProxy);
            });
        }
        function makeProxy(proxies, rawProxy) {
            proxies = proxies || {};
            var proxy = {
                host: rawProxy.host || '127.0.0.1',
                message: rawProxy.message || 'Error, server is down.',
                port: rawProxy.port || 80,
                filter: rawProxy.filter,
                password: rawProxy.password,
                silent: rawProxy.silent || false
            };
            if (rawProxy.filter) {
                proxies[rawProxy.filter] = proxy;
            }
            else {
                proxies['*'] = proxy;
            }
            return proxies;
        }
        // If sequelize is set up, add it.
        if (fs.existsSync(path.resolve(baseUrl, 'db_bootstrap.js'))) {
            try {
                var start = Date.now();
                handle.websites[site].seq = require(path.resolve(baseUrl, 'db_bootstrap.js')).seq;
                console.log(Date.now() - start + " ms - Database bootstrap.js " + site);
            }
            catch (e) {
                console.log(e);
            }
        }
        else if (fs.existsSync(path.resolve(baseUrl, 'config', 'db_bootstrap.js'))) {
            try {
                var start = Date.now();
                handle.websites[site].seq = require(path.resolve(baseUrl, 'config', 'db_bootstrap.js')).seq;
                console.log(Date.now() - start + " ms - Database bootstrap.js " + site);
            }
            catch (e) {
                console.log(e);
            }
        }
        // If website has views, load them.
        if (fs.existsSync(path.resolve(baseUrl, 'views'))) {
            handle.websites[site].views = true;
            // Stupid hack for development if you don't want to cache the views :(
            handle.websites[site].readAllViews = function (cb) {
                readAllViews(path.resolve(baseUrl, 'views')).then(function (d) { return cb(d); });
            };
            handle.websites[site].readTemplate = function (template, content, cb) {
                readTemplate(template, path.resolve(baseUrl, 'views'), content).then(function (d) { return cb(d); });
            };
            readAllViews(path.resolve(baseUrl, 'views')).then(function (views) {
                handle.websites[site].views = views;
                fsPromise
                    .readdir(path.resolve(baseUrl, 'views'))
                    .then(function (d) {
                    d.filter(function (d) { return d.indexOf('.mustache') > 0; }).forEach(function (file) {
                        var webpage = file.split('.mustache')[0];
                        if ((config.mustacheIgnore
                            ? config.mustacheIgnore.indexOf(webpage) === -1
                            : true) &&
                            !handle.websites[site].controllers[webpage]) {
                            handle.websites[site].controllers[webpage] = function (controller) {
                                if (handle.websites[site].cache) {
                                    controller.res.end(mustache.render(views[webpage], {}, views));
                                }
                                else {
                                    readAllViews(path.resolve(baseUrl, 'views')).then(function (views) {
                                        handle.websites[site].views = views;
                                        controller.res.end(mustache.render(views[webpage], {}, views));
                                    });
                                }
                            };
                        }
                    });
                })["catch"](function (e) { return console.log(e); });
            });
        }
        // Unused feature? Commenting it out DKGM 2020-10-29
        // If the site has any startup actions, do them
        // if(config.startup){
        //     config.startup.forEach(function(action:any){
        //         action(handle.websites[site]);
        //     });
        // }
        // Add the site to the index
        handle.index[site + '.david-ma.net'] = site;
        handle.index[site + ".com"] = site;
        handle.index[site + ".net"] = site;
        handle.websites[site].domains.forEach(function (domain) {
            handle.index[domain] = site;
        });
    },
    getWebsite: function (domain) {
        var site = handle.index.localhost;
        if (domain) {
            // if (handle.index.hasOwnProperty(domain)) {
            if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
                site = handle.index[domain];
            }
            domain = domain.replace('www.', '');
            // if (handle.index.hasOwnProperty(domain)) {
            if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
                site = handle.index[domain];
            }
        }
        return handle.websites[site];
    },
    proxies: {}
};
exports.handle = handle;
handle.addWebsite('default', {});
// TODO: handle rejection & errors?
function readTemplate(template, folder, content) {
    if (content === void 0) { content = ''; }
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var promises = [];
                    var filenames = ['template', 'content'];
                    // Load the mustache template (outer layer)
                    promises.push(fsPromise.readFile(folder + "/" + template, {
                        encoding: 'utf8'
                    }));
                    // Load the mustache content (innermost layer)
                    promises.push(new Promise(function (resolve) {
                        if (Array.isArray(content) && content[0])
                            content = content[0];
                        fsPromise
                            .readFile(folder + "/content/" + content + ".mustache", {
                            encoding: 'utf8'
                        })
                            .then(function (result) {
                            var scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g;
                            var styleEx = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/g;
                            var scripts = __spreadArray([], result.matchAll(scriptEx)).map(function (d) { return d[0]; });
                            var styles = __spreadArray([], result.matchAll(styleEx)).map(function (d) { return d[0]; });
                            resolve({
                                content: result.replace(scriptEx, '').replace(styleEx, ''),
                                scripts: scripts.join('\n'),
                                styles: styles.join('\n')
                            });
                        })["catch"](function () {
                            fsPromise
                                .readFile(folder + "/404.mustache", {
                                encoding: 'utf8'
                            })
                                .then(function (result) {
                                resolve(result);
                            });
                        });
                    }));
                    // Load all the other partials we may need
                    // Todo: Check folder exists and is not empty?
                    fsPromise.readdir(folder + "/partials/").then(function (d) {
                        d.forEach(function (filename) {
                            if (filename.indexOf('.mustache') > 0) {
                                filenames.push(filename.split('.mustache')[0]);
                                promises.push(fsPromise.readFile(folder + "/partials/" + filename, {
                                    encoding: 'utf8'
                                }));
                            }
                        });
                        Promise.all(promises).then(function (array) {
                            var results = {};
                            filenames.forEach(function (filename, i) {
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
                })];
        });
    });
}
function readAllViews(folder) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    fsPromise
                        .readdir(folder)
                        .then(function (directory) {
                        Promise.all(directory.map(function (filename) {
                            return new Promise(function (resolve) {
                                if (filename.indexOf('.mustache') > 0) {
                                    fsPromise
                                        .readFile(folder + "/" + filename, 'utf8')
                                        .then(function (file) {
                                        var _a;
                                        var name = filename.split('.mustache')[0];
                                        resolve((_a = {},
                                            _a[name] = file,
                                            _a));
                                    })["catch"](function (e) { return console.log(e); });
                                }
                                else {
                                    fsPromise.lstat(folder + "/" + filename).then(function (d) {
                                        if (d.isDirectory()) {
                                            readAllViews(folder + "/" + filename).then(function (d) {
                                                return resolve(d);
                                            });
                                        }
                                        else {
                                            // console.log(`${filename} is not a folder`);
                                            resolve({});
                                        }
                                    });
                                }
                            });
                        })).then(function (array) {
                            resolve(array.reduce(function (a, b) { return Object.assign(a, b); }));
                        }, function (reason) {
                            console.log('Error in readAllViews', reason);
                            reject(reason);
                        });
                    })["catch"](function (e) { return console.log(e); });
                })];
        });
    });
}
