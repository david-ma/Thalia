"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const globals_1 = require("@jest/globals");
const fs = require("fs");
const http = require("http");
const https = require("https");
const xray = require('x-ray')();
const jestConfig = require('../jest.config');
const URL = jestConfig.globals.URL;
let configPaths = {};
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
// const itif = (condition: any) => (condition ? it : it.skip)
globals_1.describe.each(Object.keys(configPaths).filter((site) => configPaths[site]))('Testing config of %s', (site) => {
    let config;
    globals_1.test(`Read ${site} config?`, () => {
        return new Promise((resolve, reject) => {
            try {
                const configPath = configPaths[site];
                config = require('../' + configPath).config;
                resolve(true);
            }
            catch (e) {
                reject();
            }
        });
    });
    xtest(`${site} config`, () => {
        return new Promise((resolve, reject) => {
            globals_1.expect(true).toBe(true);
            // expect(storage[site])
            resolve(true);
        });
    });
    xit('asdf', () => {
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
        `websites/${site}/config/config.js`;
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
