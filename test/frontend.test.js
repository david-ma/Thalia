"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
const fs = require("fs");
const http = require("http");
const globals_1 = require("@jest/globals");
const request = require('request');
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
    websites = fs.readdirSync('websites/').filter(d => d !== '.DS_Store'); //.map( d =>  [[d],[]]);
}
// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach(array, limit, callback) {
    return new Promise((resolve, reject) => {
        let i = 0;
        let happening = 0;
        const errorMessages = [];
        for (; i < limit; i++) { // Launch a limited number of things
            happening++;
            doNextThing(i);
        }
        function doNextThing(index) {
            if (array[index]) {
                callback(array[index], index, array, function done(message) {
                    if (message)
                        errorMessages.push(message);
                    doNextThing(i++);
                });
            }
            else {
                happening--; // When they're all done, resolve
                if (happening === 0)
                    resolve(errorMessages);
            }
        }
    });
}
globals_1.describe.each(websites)("Testing %s", (site) => {
    let homepageLinks = [];
    beforeAll(() => {
        return new Promise((resolve, reject) => {
            request.get(URL, {
                headers: {
                    'test-host': `${site}.david-ma.net`
                }
            }, function (err, response, html) {
                if (err) {
                    throw (err);
                }
                xray(html, ['a@href'])
                    .then(function (links) {
                    if (links) {
                        homepageLinks = links;
                        resolve(links);
                    }
                    else {
                        console.log(`No links found on ${site} homepage`);
                        resolve();
                    }
                }).catch((err) => {
                    reject(err);
                    // throw(err)
                });
            });
        });
    });
    globals_1.test(`Check external links on ${site} homepage`, () => {
        return new Promise((resolve, reject) => {
            asyncForEach(homepageLinks, 10, function (link, index, array, done) {
                if (link.match(/^http/gi)) {
                    request.get(link, {
                        headers: {
                            'test-host': `${site}.david-ma.net`
                        }
                    }, function (err, response, html) {
                        if (err) {
                            // console.error(`Link on ${site} broken: ${link}`)
                            done(`Link on ${site} broken: ${link}`);
                        }
                        done();
                    });
                }
                else {
                    done();
                }
            })
                .then((errors) => {
                if (errors.length > 0) {
                    reject(errors);
                }
                else {
                    resolve();
                }
            });
        });
    }, timeout * websites.length);
    globals_1.test.skip(`Check all ${site} links`, () => {
        return new Promise((resolve, reject) => {
            homepageLinks.forEach(link => {
                request.get(link, {
                    headers: {
                        'test-host': `${site}.david-ma.net`
                    }
                }, function (err, response, html) {
                    if (err) {
                        console.error(`Link on ${site} broken: ${link}`);
                        reject(err);
                    }
                    // console.log("link is ok: ", link)
                });
            });
            resolve();
        });
    }, timeout);
    globals_1.test.skip.each(homepageLinks)(`Check ${site} link: %s`, (link) => {
        return new Promise((resolve, reject) => {
            request.get(link, {
                headers: {
                    'test-host': `${site}.david-ma.net`
                }
            }, function (err, response, html) {
                if (err) {
                    reject();
                }
                resolve();
            });
        });
    });
    globals_1.test.skip(`Grab all links for ${site}`, () => {
        return new Promise((resolve, reject) => {
            request.get(URL, {
                headers: {
                    'test-host': `${site}.david-ma.net`
                }
            }, function (err, response, html) {
                if (err) {
                    reject(err);
                    // expect(false).toBeTruthy()
                    // throw new Error('Error loading page')
                }
                xray(html, 'a')(function (err, links) {
                    if (err) {
                        // throw new Error('Error parsing html')
                        fail();
                    }
                    // console.log(links)
                    if (links) {
                        globals_1.test.each(links)(`Testing ${site} link: %s`, (link) => {
                            return new Promise((resolve, reject) => {
                                resolve();
                            });
                        });
                        globals_1.expect(links.length).toBeGreaterThan(0);
                        resolve();
                    }
                    else {
                        // expect(false).toBeTruthy().rejects.toEqual({
                        //   error: 'User with 3 not found.',
                        // });
                        // expect(false).reje
                        // throw new Error('No links')
                        // done.fail("no links");
                        // expect("Lololol").toBe("ggg")
                        // reject("No links found")
                        console.info(`No links found on ${site} homepage`);
                        resolve();
                    }
                });
            });
        });
    });
    globals_1.test.skip(`http.get the site ${site}`, (done) => {
        http.get(URL, {
            headers: {
                'test-host': `${site}.david-ma.net`
            }
        }, (res) => {
            // console.log("wooo")
            globals_1.expect(res).toBeTruthy();
            done();
        });
    });
    globals_1.test.skip(`Puppeteer ${site}`, (done) => {
        puppeteer.launch().then(browser => {
            browser.newPage().then(page => {
                page.setExtraHTTPHeaders({
                    'test-host': `${site}.david-ma.net`
                });
                page.goto(URL, { waitUntil: 'domcontentloaded' });
                globals_1.expect(true).toBeTruthy();
                // page.close()
                browser.close();
                done();
            });
        });
    });
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
