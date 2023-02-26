"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const fs = require("fs");
const utilities_1 = require("./utilities");
const _ = require("lodash");
const mustache = require("mustache");
const requestHandlers_1 = require("../server/requestHandlers");
const consoleLog = console.log;
console.log = jest.fn();
requestHandlers_1.handle.loadAllWebsites();
console.log = consoleLog;
const testserver = 'http://127.0.0.1:1337';
const jestConfig = require('../jest.config');
const jestURL = jestConfig.globals.URL;
const timeout = process.env.SLOWMO ? 30000 : 10000;
let configPaths = {};
const websites = {};
if (process.env.SITE && process.env.SITE !== 'all') {
    configPaths = {
        [process.env.SITE]: findSiteConfig(process.env.SITE)
    };
}
else {
    const websiteArray = fs
        .readdirSync('websites/')
        .filter((d) => d !== '.DS_Store');
    configPaths = websiteArray.reduce((acc, site) => {
        acc[site] = findSiteConfig(site);
        return acc;
    }, {});
}
Object.keys(configPaths)
    .filter((site) => configPaths[site])
    .forEach((site) => {
    try {
        const configPath = configPaths[site];
        websites[site] = require('../' + configPath).config;
    }
    catch (e) {
        console.log(`Error in ${site}!`);
        console.error(e);
    }
});
const itif = (condition) => (condition ? it : it.skip);
const xitif = (condition) => it.skip;
globals_1.describe.each(Object.keys(websites))('Testing config of %s', (site) => {
    let config;
    (0, globals_1.test)('Config.js can be opened?', async () => {
        return await new Promise((resolve, reject) => {
            try {
                config = requestHandlers_1.handle.websites[site];
                resolve(true);
            }
            catch (e) {
                console.error(e);
                reject();
            }
        });
    });
    itif(websites[site].domains)('Website Domains', () => {
        config.domains.forEach((domain) => {
            (0, globals_1.expect)((0, utilities_1.validURL)(domain)).toBe(true);
        });
    });
    (0, globals_1.test)('Public Folder', async () => {
        return await new Promise((resolve, reject) => {
            fs.access(config.folder, (err) => {
                if (err)
                    reject(`Can't access public folder for ${site}`);
                resolve(true);
            });
        });
    });
    itif(requestHandlers_1.handle.websites[site].seq)('Databases used', function inspectDatabases() {
        console.info(`${site} uses these databases:`, Object.keys(requestHandlers_1.handle.websites[site].seq).filter((key) => key !== 'sequelize'));
    });
    itif(websites[site].sockets)('Sockets Used', () => { });
    itif(websites[site].proxies)('Proxy hosts are online', async function checkProxyHosts() {
        const proxies = websites[site]
            .proxies;
        const links = proxies.map((proxy) => {
            let link = (proxy.host || '127.0.0.1') +
                (':' + proxy.port || 80) +
                (proxy.filter ? `/${proxy.filter}` : '');
            if (link.indexOf('http') !== 0) {
                link = (proxy.port === 443 ? 'https://' : 'http://') + link;
            }
            return link;
        });
        return (0, utilities_1.checkLinks)(site, links);
    }, timeout);
    itif(websites[site].proxies)('Proxy domains are working', async () => {
        const proxies = websites[site]
            .proxies;
        const links = _.flatten(proxies.map((proxy) => proxy.domains.map((link) => {
            if (link.indexOf('http') !== 0) {
                link = (proxy.port === 443 ? 'https://' : 'http://') + link;
            }
            return link;
        })));
        return (0, utilities_1.checkLinks)(site, links);
    });
    let validLinks = [];
    itif(websites[site].redirects)('Redirects are valid', () => {
        const invalid = {};
        validLinks = Object.keys(websites[site].redirects)
            .map((redirect) => {
            const link = websites[site].redirects[redirect];
            if (!(0, utilities_1.validURL)(link)) {
                invalid[redirect] = link;
                return null;
            }
            else {
                return link;
            }
        })
            .filter((d) => d !== null);
        (0, globals_1.expect)(invalid).toStrictEqual({});
    });
    itif(websites[site].redirects)('All valid redirect links work', async () => {
        return await (0, utilities_1.checkLinks)(site, validLinks);
    }, timeout);
    itif(websites[site].pages)('Pages Used', async () => {
        const pages = Object.keys(websites[site].pages).map((key) => {
            return `${testserver}${websites[site].pages[key]}`;
        });
        return (0, utilities_1.checkLinks)(site, pages);
    });
    itif(requestHandlers_1.handle.websites[site].views)('Views Used', (done) => {
        try {
            requestHandlers_1.handle.websites[site].readAllViews((views) => {
                Object.keys(views).forEach((view) => {
                    const template = views[view];
                    mustache.render(template, {});
                });
                done();
            });
        }
        catch (e) {
            done(e);
        }
    }, timeout);
    itif(requestHandlers_1.handle.websites[site].data)(`${site} data folder`, async () => {
        return await new Promise((resolve, reject) => {
            fs.access(`websites/${site}/data`, (err) => {
                if (err)
                    reject(`Can't access data folder for ${site}`);
                resolve(true);
            });
        });
    });
});
if (false) {
    console.log(jestURL);
    console.log(globals_1.test);
    (0, utilities_1.asyncForEach)([], function () { });
    console.log(xitif);
}
function findSiteConfig(site) {
    if (fs.existsSync(`websites/${site}/config.js`)) {
        return `websites/${site}/config.js`;
    }
    if (fs.existsSync(`websites/${site}/config/config.js`)) {
        return `websites/${site}/config/config.js`;
    }
    return '';
}
