"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const globals_1 = require("@jest/globals");
const fs = require("fs");
const http = require("http");
const https = require("https");
const xray = require('x-ray')();
const jestConfig = require('../jest.config');
const timeout = process.env.SLOWMO ? 30000 : 10000;
const URL = jestConfig.globals.URL;
// import request from 'request'
// let browser : puppeteer.Browser
// let page : puppeteer.Page
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
globals_1.describe.each(websites)('Testing %s', (site) => {
    let homepageLinks = [];
    beforeAll(() => {
        return new Promise((resolve, reject) => {
            http.get(URL, {
                headers: {
                    'test-host': `${site}.david-ma.net`
                }
            }, function (res) {
                let rawData = '';
                res.on('data', chunk => { rawData += chunk; });
                res.on('end', () => {
                    xray(rawData, ['a@href'])
                        .then(function (links) {
                        if (links) {
                            homepageLinks = links;
                            resolve(links);
                        }
                        else {
                            resolve();
                        }
                    }).catch((err) => {
                        reject(err);
                    });
                });
            }).on('error', error => { throw error; });
        });
    });
    globals_1.test(`Check external links on ${site} homepage`, () => {
        return new Promise((resolve, reject) => {
            asyncForEach(homepageLinks, function (link, done) {
                let requester;
                if (link.match(/^https/gi)) {
                    requester = https;
                }
                else if (link.match(/^http/gi)) {
                    requester = http;
                }
                else {
                    done();
                }
                if (requester) {
                    requester.get(link, {
                        headers: {
                            'test-host': `${site}.david-ma.net`
                        }
                    }, function (response) {
                        if (response.statusCode !== 200) {
                            done(`${response.statusCode} - ${link}`);
                        }
                        else {
                            done();
                        }
                    }).on('error', (e) => {
                        done(e.message);
                    });
                }
            }).then((errors) => {
                if (errors.length > 0) {
                    reject(errors);
                }
                else {
                    resolve();
                }
            });
        });
    }, timeout * websites.length);
    globals_1.test(`Screenshot ${site}`, () => {
        return new Promise((resolve, reject) => {
            let promises;
            puppeteer.launch().then(browser => {
                browser.newPage().then(page => {
                    promises = [
                        page.setExtraHTTPHeaders({
                            'test-host': `${site}.david-ma.net`
                        }),
                        page.setViewport({ width: 414, height: 2500, isMobile: true })
                    ];
                    Promise.all(promises).then(() => {
                        page.goto(URL, { waitUntil: 'domcontentloaded' }).then(() => {
                            page.screenshot({
                                path: `./tmp/${site}-homepage-mobile.jpg`,
                                type: 'jpeg'
                            }).then(() => {
                                page.setViewport({ width: 1200, height: 2000, isMobile: false }).then(() => {
                                    page.screenshot({
                                        path: `./tmp/${site}-homepage-desktop.jpg`,
                                        type: 'jpeg'
                                    }).then(() => {
                                        globals_1.expect(true).toBeTruthy();
                                        browser.close();
                                        resolve();
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
    //       page.goto(URL, { waitUntil: 'domcontentloaded' }).then( () => {
    //         expect(true).toBeTruthy();
    //       })
    //     })
    // console.log(site)
    // expect(true).toBeTruthy();
    // }, timeout)
    // puppeteer.launch().then( browser => {
    //   browser.newPage().then( page => {
    //     page.setExtraHTTPHeaders({
    //       'test-host': `${site}.david-ma.net`
    //     })
    //     test('Connecting to site', () => {
    //       page.goto(URL, { waitUntil: 'domcontentloaded' }).then( () => {
    //         expect(true).toBeTruthy();
    //       })
    //     })
    //     browser.close()
    //   })
    // })
});
// describe('Test header and title of the page', () => {
//   test('Title of the page', async () => {
//     const title = await page.title()
//     expect(title).toBe('#MakeoverMonday')
//   }, timeout)
//   // test('Header of the page', async () => {
//   //   const headerHandle = await page.$('#title h1')
//   //   const html = await page.evaluate((headerHandle :any) => headerHandle.innerHTML, headerHandle)
//   //   expect(html).toBe("David's Dataviz")
//   // }, timeout)
//   // test('Screenshot homepage', async () => {
//   //   await page.goto(`${URL}`, { waitUntil: 'domcontentloaded' })
//   //   const iPhonex = puppeteer.devices['iPhone X']
//   //   await page.emulate(iPhonex)
//   //   await page.setViewport({ width: 375, height: 812, isMobile: true })
//   //   await page.screenshot({
//   //     path: './tmp/home-mobile.jpg',
//   //     type: 'jpeg'
//   //   })
//   // }, timeout)
//   // test('Screenshot breathe', async () => {
//   //   await page.goto(`${URL}/blog/breathe`, { waitUntil: 'domcontentloaded' })
//   //   const iPhonex = puppeteer.devices['iPhone X']
//   //   await page.emulate(iPhonex)
//   //   await page.setViewport({ width: 375, height: 1812, isMobile: true })
//   //   await page.waitForTimeout(1000)
//   //   await page.screenshot({
//   //     path: './tmp/breathe-mobile.jpg',
//   //     type: 'jpeg'
//   //   })
//   // }, timeout)
// })
