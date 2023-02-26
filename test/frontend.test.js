"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const globals_1 = require("@jest/globals");
const fs = require("fs");
const utilities_1 = require("./utilities");
const jestConfig = require('../jest.config');
const jestURL = jestConfig.globals.URL;
const timeout = process.env.SLOWMO ? 30000 : 10000;
let websites = [];
if (process.env.SITE && process.env.SITE !== 'all') {
    websites = [process.env.SITE];
}
else {
    websites = fs.readdirSync('websites/').filter(d => d !== '.DS_Store');
}
globals_1.describe.each(websites)('Testing %s', (site) => {
    let homepageLinks = [];
    let siteLinks = [];
    beforeAll(async () => {
        const promises = [
            (0, utilities_1.getLinks)(site)
        ];
        if (process.env.PAGE)
            promises.push((0, utilities_1.getLinks)(site, process.env.PAGE));
        return await Promise.all(promises).then((array) => {
            homepageLinks = array[0];
            if (array[1]) {
                siteLinks = array[1];
            }
        });
    });
    (0, globals_1.test)(`Check external links on ${site} homepage`, async () => {
        return await (0, utilities_1.checkLinks)(site, homepageLinks.filter(link => (0, utilities_1.validURL)(link)));
    });
    (0, globals_1.test)(`Check internal links on ${site} homepage`, () => {
    });
    (0, globals_1.test)(`Screenshot ${site}`, async () => {
        return await new Promise((resolve, reject) => {
            let promises;
            puppeteer.launch().then(browser => {
                browser.newPage().then(page => {
                    promises = [
                        page.setExtraHTTPHeaders({
                            'x-host': `${site}.com`
                        }),
                        page.setViewport({ width: 414, height: 2500, isMobile: true })
                    ];
                    Promise.all(promises).then(() => {
                        page.goto(jestURL, { waitUntil: 'domcontentloaded' }).then(() => {
                            page.screenshot({
                                path: `./tmp/${site}-homepage-mobile.jpg`,
                                type: 'jpeg'
                            }).then(() => {
                                page.setViewport({ width: 1200, height: 2000, isMobile: false }).then(() => {
                                    page.screenshot({
                                        path: `./tmp/${site}-homepage-desktop.jpg`,
                                        type: 'jpeg'
                                    }).then(() => {
                                        (0, globals_1.expect)(true).toBeTruthy();
                                        browser.close();
                                        resolve(site);
                                    });
                                });
                            }).catch(error => {
                                browser.close();
                                reject(error);
                            });
                        });
                    }).catch(error => {
                        browser.close();
                        reject(error);
                    });
                });
            });
        });
    }, timeout);
    xtest(`Check external links on ${site} - ${process.env.PAGE || 'n/a'}`, async () => {
        return await (0, utilities_1.checkLinks)(site, siteLinks);
    }, timeout);
});
