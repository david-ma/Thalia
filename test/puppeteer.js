"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer = require("puppeteer");
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', message => console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
        .on('pageerror', ({ message }) => console.log(message))
        .on('response', response => {
        if (response.status() !== 200) {
            console.log(`${response.status()} ${response.url()}`);
        }
    })
        .on('requestfailed', request => console.log(`${request.failure().errorText} ${request.url()}`));
    await page.goto('http://localhost:1337/blog/breathe');
    const hrefs = await page.$$eval('a', links => links.map((a) => a.href));
    console.log(hrefs);
    page.goto(hrefs[1]);
    hrefs.forEach(function (link, i) {
        console.log('visiting link', i);
    });
})();
