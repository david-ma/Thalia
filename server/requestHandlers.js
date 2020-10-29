"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Website = exports.handle = void 0;
const db = require("./database").db;
const fs = require("fs");
const fsPromise = fs.promises;
const mustache = require("mustache");
class Website {
    constructor(site, config) {
        if (typeof config === "object") {
            this.name = site;
            this.data = "";
            this.dist = "";
            this.cache = typeof config.cache === "boolean" ? config.cache : true;
            this.folder = typeof config.folder === "string" ? config.folder : "websites/" + site + "/public";
            this.domains = typeof config.domains === "object" ? config.domains : [];
            this.pages = typeof config.pages === "object" ? config.pages : {};
            this.redirects = typeof config.redirects === "object" ? config.redirects : {};
            this.services = typeof config.services === "object" ? config.services : {};
            this.controllers = typeof config.controllers === "object" ? config.controllers : {};
            this.proxies = typeof config.proxies === "object" ? config.proxies : {};
            this.sockets = typeof config.sockets === "object" ? config.sockets : { on: [], emit: [] };
            this.security = typeof config.security === "object" ? config.security : { loginNeeded: function () { return false; } };
            this.viewableFolders = config.viewableFolders || false;
        }
        else {
            console.log("Config isn't an object");
        }
    }
    ;
}
exports.Website = Website;
const handle = {
    websites: {},
    index: { localhost: 'default' },
    loadAllWebsites: function () {
        const standAlone = !fs.existsSync('websites');
        if (standAlone) {
            console.log("Serving stand alone website");
            let workspace = "..";
            handle.index.localhost = workspace;
            var site = workspace;
            let config, cred;
            try {
                const start = Date.now();
                if (fs.existsSync(`${__dirname}/../config.js`)) {
                    config = require(`${__dirname}/../config`).config;
                }
                else {
                    config = require(`${__dirname}/../config/config`).config;
                }
                console.log(`Loading time: ${Date.now() - start} ms - config.js`);
            }
            catch (err) {
                if (err.code !== 'MODULE_NOT_FOUND') {
                    console.log("Warning, your config script is broken!");
                    console.error(err);
                    console.log();
                }
                else {
                    console.log(`Error in config.js!`);
                    console.log(err);
                }
            }
            try {
                cred = JSON.parse(fs.readFileSync('cred.json').toString());
            }
            catch (err) { }
            config.standAlone = true;
            config.folder = `${__dirname}/../public`;
            handle.addWebsite(site, config, cred);
            console.log("Setting workspace to current directory");
            handle.index.localhost = workspace;
        }
        else if (handle.index.localhost !== "default") {
            console.log("Only load %s", handle.index.localhost);
            const site = handle.index.localhost;
            console.log("Adding site: " + site);
            var config, cred;
            try {
                const start = Date.now();
                if (fs.existsSync(`${__dirname}/../websites/${site}/config.js`)) {
                    config = require(`${__dirname}/../websites/${site}/config`).config;
                }
                else {
                    config = require(`${__dirname}/../websites/${site}/config/config`).config;
                }
                console.log(`${Date.now() - start} ms - config.js for ${site}`);
            }
            catch (err) {
                if (err.code !== 'MODULE_NOT_FOUND') {
                    console.log("Warning, your config script for " + site + " is broken!");
                    console.error(err);
                    console.log();
                }
                else {
                    console.log(`Error in ${site} config!`);
                    console.log(err);
                }
            }
            try {
                if (fs.existsSync(`${__dirname}/../websites/${site}/cred.json`)) {
                    cred = JSON.parse(fs.readFileSync(`${__dirname}/../websites/${site}/cred.json`).toString());
                    console.log("Cred: ", cred);
                }
            }
            catch (err) {
                console.log(err);
            }
            config.cache = false;
            handle.addWebsite(site, config, cred);
        }
        else {
            fs.readdirSync('websites/').forEach(function (site) {
                if (fs.lstatSync('websites/' + site).isDirectory()) {
                    console.log("Adding site: " + site);
                    var config, cred;
                    try {
                        if (fs.existsSync(`${__dirname}/../websites/${site}/config.js`)) {
                            config = require(`${__dirname}/../websites/${site}/config`).config;
                        }
                        else {
                            config = require(`${__dirname}/../websites/${site}/config/config`).config;
                        }
                    }
                    catch (err) {
                        if (err.code !== 'MODULE_NOT_FOUND') {
                            console.log("Warning, your config script for " + site + " is broken!");
                            console.error(err);
                            console.log();
                        }
                    }
                    try {
                        cred = JSON.parse(fs.readFileSync(`websites/${site}/cred.json`).toString());
                    }
                    catch (err) { }
                    handle.addWebsite(site, config, cred);
                }
            });
        }
    },
    addWebsite: function (site, config, cred) {
        config = config || {};
        handle.websites[site] = new Website(site, config);
        const baseUrl = config.standAlone ? `${__dirname}/../` : `${__dirname}/../websites/${site}/`;
        if (fs.existsSync(`${baseUrl}data`)) {
            handle.websites[site].data = `${baseUrl}data`;
        }
        if (fs.existsSync(`${baseUrl}dist`)) {
            handle.websites[site].dist = `${baseUrl}dist`;
        }
        Object.keys(handle.websites[site].proxies).forEach(function (proxy) {
            handle.proxies[proxy] = handle.websites[site].proxies[proxy];
        });
        handle.index[site + ".david-ma.net"] = site;
        handle.websites[site].domains.forEach(function (domain) {
            handle.index[domain] = site;
        });
        if (cred) {
            handle.websites[site].db = new db(cred);
        }
        if (fs.existsSync(`${baseUrl}db_bootstrap.js`)) {
            try {
                const start = Date.now();
                handle.websites[site].seq = require(`${baseUrl}db_bootstrap.js`).seq;
                console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`);
            }
            catch (e) {
                console.log(e);
            }
        }
        else if (fs.existsSync(`${baseUrl}config/db_bootstrap.js`)) {
            try {
                const start = Date.now();
                handle.websites[site].seq = require(`${baseUrl}config/db_bootstrap.js`).seq;
                console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`);
            }
            catch (e) {
                console.log(e);
            }
        }
        if (fs.existsSync(`${baseUrl}views`)) {
            handle.websites[site].readAllViews = function (cb) {
                readAllViews(`${baseUrl}views`).then(d => cb(d));
            };
            handle.websites[site].readTemplate = function (template, content = '', cb) {
                readTemplate(template, `${baseUrl}views`, content).then(d => cb(d));
            };
            readAllViews(`${baseUrl}views`).then(views => {
                handle.websites[site].views = views;
                fsPromise.readdir(`${baseUrl}views`)
                    .then(function (d) {
                    d.filter((d) => d.indexOf('.mustache') > 0).forEach((file) => {
                        const webpage = file.split('.mustache')[0];
                        if ((config.mustacheIgnore ? config.mustacheIgnore.indexOf(webpage) == -1 : true) &&
                            !handle.websites[site].controllers[webpage]) {
                            handle.websites[site].controllers[webpage] = function (router) {
                                if (handle.websites[site].cache) {
                                    router.res.end(mustache.render(views[webpage], {}, views));
                                }
                                else {
                                    readAllViews(`${baseUrl}views`).then(views => {
                                        handle.websites[site].views = views;
                                        router.res.end(mustache.render(views[webpage], {}, views));
                                    });
                                }
                            };
                        }
                    });
                }).catch((e) => console.log(e));
            });
        }
    },
    getWebsite: function (domain) {
        var site = handle.index.localhost;
        if (domain) {
            if (handle.index.hasOwnProperty(domain)) {
                site = handle.index[domain];
            }
            domain = domain.replace("www.", "");
            if (handle.index.hasOwnProperty(domain)) {
                site = handle.index[domain];
            }
        }
        return handle.websites[site];
    },
    proxies: {}
};
exports.handle = handle;
handle.addWebsite("default", {}, null);
async function readTemplate(template, folder, content = '') {
    return new Promise((resolve, reject) => {
        const promises = [];
        const filenames = ['template', 'content'];
        promises.push(fsPromise.readFile(`${folder}/${template}`, {
            encoding: 'utf8'
        }));
        promises.push(new Promise((resolve, reject) => {
            if (Array.isArray(content) && content[0])
                content = content[0];
            fsPromise.readFile(`${folder}/content/${content}.mustache`, {
                encoding: 'utf8'
            }).then((result) => {
                var scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g, styleEx = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/g;
                var scripts = [...result.matchAll(scriptEx)].map(d => d[0]), styles = [...result.matchAll(styleEx)].map(d => d[0]);
                resolve({
                    content: result.replace(scriptEx, "").replace(styleEx, ""),
                    scripts: scripts.join("\n"),
                    styles: styles.join("\n")
                });
            }).catch((e) => {
                fsPromise.readFile(`${folder}/404.mustache`, {
                    encoding: 'utf8'
                }).then((result) => {
                    resolve(result);
                });
            });
        }));
        fsPromise.readdir(`${folder}/partials/`)
            .then(function (d) {
            d.forEach(function (filename) {
                if (filename.indexOf(".mustache") > 0) {
                    filenames.push(filename.split(".mustache")[0]);
                    promises.push(fsPromise.readFile(`${folder}/partials/${filename}`, {
                        encoding: 'utf8'
                    }));
                }
            });
            Promise.all(promises).then(function (array) {
                const results = {};
                filenames.forEach((filename, i) => results[filename] = array[i]);
                if (typeof results.content == 'object') {
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
    return new Promise((finish, reject) => {
        fsPromise.readdir(folder).then((directory) => {
            Promise.all(directory.map((filename) => new Promise((resolve, reject) => {
                if (filename.indexOf(".mustache") > 0) {
                    fsPromise.readFile(`${folder}/${filename}`, 'utf8')
                        .then((file) => {
                        const name = filename.split('.mustache')[0];
                        resolve({
                            [name]: file
                        });
                    }).catch((e) => console.log(e));
                }
                else {
                    fsPromise.lstat(`${folder}/${filename}`).then((d) => {
                        if (d.isDirectory()) {
                            readAllViews(`${folder}/${filename}`)
                                .then(d => resolve(d));
                        }
                        else {
                            resolve({});
                        }
                    });
                }
            }))).then((array) => {
                finish(array.reduce((a, b) => Object.assign(a, b)));
            });
        }).catch((e) => console.log(e));
    });
}
