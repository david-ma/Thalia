"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const fs = require("fs");
const utilities_1 = require("./utilities");
const _ = require("lodash");
const mustache = require("mustache");
const consoleLog = console.log;
console.log = jest.fn();
const requestHandlers_1 = require("../server/requestHandlers");
requestHandlers_1.handle.loadAllWebsites();
console.log = consoleLog;
const testserver = 'http://127.0.0.1:1337';
const jestConfig = require('../jest.config');
const jestURL = jestConfig.globals.URL;
const timeout = process.env.SLOWMO ? 30000 : 10000;
let configPaths = {};
let websites = {};
// Setup:
// process.env.SITE = 'david-ma' // Uncomment to test just one site
if (process.env.SITE && process.env.SITE !== 'all') {
    configPaths = {
        [process.env.SITE]: findSiteConfig(process.env.SITE),
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
        // handle.addWebsite(site, websites[site])
    }
    catch (e) {
        console.log(`Error in ${site}!`);
        console.error(e);
    }
});
// Tests:
const itif = (condition) => (condition ? it : it.skip);
const xitif = (condition) => it.skip;
globals_1.describe.each(Object.keys(websites))('Testing config of %s', (site) => {
    let config;
    globals_1.test(`Config.js can be opened?`, () => {
        return new Promise((resolve, reject) => {
            try {
                config = requestHandlers_1.handle.websites[site];
                // config = handle.websites[site]
                // const configPath = configPaths[site]
                // config = require('../' + configPath).config
                // config = new Website(site, config)
                resolve(true);
            }
            catch (e) {
                console.error(e);
                reject();
            }
        });
    });
    itif(websites[site].domains)(`Website Domains`, () => {
        config.domains.forEach((domain) => {
            globals_1.expect(utilities_1.validURL(domain)).toBe(true);
        });
    });
    globals_1.test(`Public Folder`, () => {
        return new Promise((resolve, reject) => {
            fs.access(config.folder, (err) => {
                if (err)
                    reject(`Can't access public folder for ${site}`);
                resolve(true);
            });
        });
    });
    // Audit usage of features?
    itif(requestHandlers_1.handle.websites[site].seq)(`Database used`, () => { });
    itif(websites[site].sockets)(`Sockets Used`, () => { });
    itif(websites[site].proxies)(`Proxy hosts are online`, () => {
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
        return utilities_1.checkLinks(site, links);
    }, timeout);
    itif(websites[site].proxies)(`Proxy domains are working`, () => {
        const proxies = websites[site]
            .proxies;
        const links = _.flatten(proxies.map((proxy) => proxy.domains.map((link) => {
            if (link.indexOf('http') !== 0) {
                link = (proxy.port === 443 ? 'https://' : 'http://') + link;
            }
            return link;
        })));
        return utilities_1.checkLinks(site, links);
    });
    let validLinks = [];
    itif(websites[site].redirects)(`Redirects are valid`, () => {
        const invalid = {};
        validLinks = Object.keys(websites[site].redirects)
            .map((redirect) => {
            const link = websites[site].redirects[redirect];
            if (!utilities_1.validURL(link)) {
                invalid[redirect] = link;
                return null;
            }
            else {
                return link;
            }
        })
            .filter((d) => d !== null);
        globals_1.expect(invalid).toStrictEqual({});
    });
    itif(websites[site].redirects)(`All valid redirect links work`, () => {
        return utilities_1.checkLinks(site, validLinks);
    }, timeout);
    itif(websites[site].pages)(`Pages Used`, () => {
        const pages = Object.keys(websites[site].pages).map((key) => {
            return `${testserver}${websites[site].pages[key]}`;
        });
        return utilities_1.checkLinks(site, pages);
    });
    // This doesn't actually check if the mustache templates are valid
    // It just opens them?? Perhaps try finding what data they need?
    // Maybe use a library?
    itif(requestHandlers_1.handle.websites[site].views)(`Views Used`, (done) => {
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
    // itif(websites[site].viewableFolders)(`viewable Folders`, () => {})
    /**
     * To do:
     * Check proxies are valid, and running?
     * Check Pages exist
     * Check redirects are valid
     * - Publish
     * - publish??? Only used in truestores. Possibly remove it?
     * - security
     * - sequalize????
     *
     *
     *  */
    // Dist should depend on src
    // itif(websites[site].dist)(`${site} dist folder`, () => {
    //   return new Promise((resolve, reject) => {
    //     fs.access(`websites/${site}/dist`, (err) => {
    //       if (err) reject(`No dist folder for ${site}`)
    //       resolve(true)
    //     })
    //   })
    // })
    // itif(handle.getWebsite(site).data)(`${site} data folder`, () => {
    itif(requestHandlers_1.handle.websites[site].data)(`${site} data folder`, () => {
        return new Promise((resolve, reject) => {
            fs.access(`websites/${site}/data`, (err) => {
                if (err)
                    reject(`Can't access data folder for ${site}`);
                resolve(true);
            });
        });
    });
});
if (false) {
    // I don't want eslint complaining about unused things.
    console.log(jestURL);
    console.log(globals_1.test);
    utilities_1.asyncForEach([], function () { });
    console.log(xitif);
}
function findSiteConfig(site) {
    if (fs.existsSync(`websites/${site}/config.js`))
        return `websites/${site}/config.js`;
    if (fs.existsSync(`websites/${site}/config/config.js`))
        return `websites/${site}/config/config.js`;
    return '';
}
