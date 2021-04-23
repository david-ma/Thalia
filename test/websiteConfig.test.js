"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const globals_1 = require("@jest/globals");
const fs = require("fs");
const http = require("http");
const https = require("https");
const xray = require('x-ray')();
const jestConfig = require('../jest.config');
const requestHandlers_1 = require("../server/requestHandlers");
const URL = jestConfig.globals.URL;
let configPaths = {};
let websites = {};
// Setup:
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
    }
    catch (e) {
        console.error(e);
    }
});
// Tests:
const itif = (condition) => (condition ? it : it.skip);
globals_1.describe.each(Object.keys(websites))('Testing config of %s', (site) => {
    let config;
    globals_1.test(`Config.js can be opened?`, () => {
        return new Promise((resolve, reject) => {
            try {
                const configPath = configPaths[site];
                config = require('../' + configPath).config;
                config = new requestHandlers_1.Website(site, config);
                resolve(true);
            }
            catch (e) {
                reject();
            }
        });
    });
    itif(websites[site].domains)(`Website Domains`, () => {
        websites[site].domains.forEach((domain) => {
            globals_1.expect(validURL(domain)).toBe(true);
        });
        function validURL(str) {
            var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
            return !!pattern.test(str);
        }
    });
    globals_1.test(`public folder`, () => {
        return new Promise((resolve, reject) => {
            fs.access(config.folder, (err) => {
                if (err)
                    reject(`Can't access public folder for ${site}`);
                resolve(true);
            });
        });
    });
    itif(websites[site].data)(`${site} data folder`, () => {
        return new Promise((resolve, reject) => {
            fs.access(`websites/${site}/data`, (err) => {
                if (err)
                    reject(`Can't access folder for ${site}`);
                resolve(true);
            });
        });
    });
});
globals_1.describe("unused stuff", () => {
    it("always pass", () => {
        globals_1.expect(true).toBe(true);
    });
    xit('Avoid unused stuff', () => {
        console.log(URL);
        console.log(xray);
        console.log(puppeteer);
        console.log(http);
        console.log(https);
        console.log(globals_1.test);
        asyncForEach([], function () { });
    });
});
function findSiteConfig(site) {
    if (fs.existsSync(`websites/${site}/config.js`))
        return `websites/${site}/config.js`;
    if (fs.existsSync(`websites/${site}/config/config.js`))
        return `websites/${site}/config/config.js`;
    return '';
}
// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach(array, callback, limit = 5) {
    return new Promise((resolve) => {
        let i = 0;
        let happening = 0;
        const errorMessages = [];
        for (; i < limit; i++) {
            // Launch a limited number of things
            happening++;
            doNextThing(i);
        }
        function doNextThing(index) {
            // Each thing calls back "done" and starts the next
            if (array[index]) {
                callback(array[index], function done(message) {
                    if (message)
                        errorMessages.push(message);
                    doNextThing(i++);
                }, index, array);
            }
            else {
                happening--; // When they're all done, resolve
                if (happening === 0)
                    resolve(errorMessages);
            }
        }
    });
}
