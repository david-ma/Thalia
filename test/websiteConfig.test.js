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
let websites = [];
if (process.env.SITE && process.env.SITE !== 'all') {
    websites = [process.env.SITE];
}
else {
    websites = fs.readdirSync('websites/').filter(d => d !== '.DS_Store'); // .map( d =>  [[d],[]]);
}
// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach(array, callback, limit = 5) {
    return new Promise((resolve) => {
        let i = 0;
        let happening = 0;
        const errorMessages = [];
        for (; i < limit; i++) { // Launch a limited number of things
            happening++;
            doNextThing(i);
        }
        function doNextThing(index) {
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
let storage = {};
const itif = (condition) => condition ? it : it.skip;
globals_1.describe.each(websites)('Testing config of %s', (site) => {
    let config = false;
    it(`${site} has a config?`, () => {
        return new Promise((resolve, reject) => {
            if (fs.existsSync(`websites/${site}/config.js`)) {
                config = storage[site] = `websites/${site}/config.js`;
                resolve(true);
            }
            else {
                if (fs.existsSync(`websites/${site}/config/config.js`)) {
                    config = storage[site] = `websites/${site}/config/config.js`;
                    resolve(true);
                }
                else {
                    resolve(true);
                }
            }
        });
    });
    globals_1.test(`${site} config`, () => {
        return new Promise((resolve, reject) => {
            if (!config) {
                it.skip("asdf", () => { });
                console.warn("Skipping test");
                resolve("SKIP");
            }
            console.log(config);
            globals_1.expect(true).toBe(true);
            // expect(storage[site])
            resolve(true);
        });
    });
    // itif(true)(`blahhh ${site} xxx`, () => {
    //   expect(true).toBe(true)
    //   // expect(storage[site])
    // })
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
