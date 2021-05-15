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
    websites = fs.readdirSync('websites/').filter(d => d !== '.DS_Store'); // .map( d =>  [[d],[]]);
}
globals_1.describe.each(websites)('Testing %s', (site) => {
    let homepageLinks = [];
    let siteLinks = [];
    beforeAll(async () => {
        const promises = [
            utilities_1.getLinks(site)
        ];
        if (process.env.PAGE)
            promises.push(utilities_1.getLinks(site, process.env.PAGE));
        return await Promise.all(promises).then((array) => {
            homepageLinks = array[0];
            if (array[1]) {
                siteLinks = array[1];
            }
        });
    });
    globals_1.test(`Check external links on ${site} homepage`, async () => {
        return await utilities_1.checkLinks(site, homepageLinks.filter(link => utilities_1.validURL(link)));
    });
    globals_1.test(`Check internal links on ${site} homepage`, () => {
        // TO DO: Write test here
        // return checkLinks(site, homepageLinks.filter(link => validURL(link)))
    });
    globals_1.test(`Screenshot ${site}`, async () => {
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
                                        globals_1.expect(true).toBeTruthy();
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
        // console.log(`${site} links:`,siteLinks)
        return await utilities_1.checkLinks(site, siteLinks);
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
