import * as puppeteer from 'puppeteer'
import fs = require('fs');
import {describe, expect, test} from '@jest/globals'
const timeout = process.env.SLOWMO ? 30000 : 10000

const jestConfig :any = require('../jest.config')
const URL = jestConfig.globals.URL

// let browser : puppeteer.Browser
// let page : puppeteer.Page
import http = require('http');
// import request from 'request'

const request = require('request');

const xray = require('x-ray')()

// beforeAll(async () => {
//   browser = await puppeteer.launch()
//   page = await browser.newPage()

//   await page.setExtraHTTPHeaders({
//     'test-host': 'dataviz.david-ma.net'
//   })

//   await page.goto(URL, { waitUntil: 'domcontentloaded' })
// })

// afterAll(async () => {
//   browser.close()
// })

const table = fs.readdirSync('websites/').filter( d => d !== '.DS_Store') //.map( d =>  [[d],[]]);


// Asynchronous for each, doing a limited number of things at a time.
async function asyncForEach(array: Array<any>, limit: number, callback: Function) {
  let i = 0

  for (; i < limit; i++) { // i++ here? Are you sure?
    doNextThing(i)
  }

  function doNextThing(index: number) {
    if (array[index]) {
      callback(array[index], index, array, function done() {
        doNextThing(i++)
      })
    }
  }

  return 1
}

describe.each(table)("Testing %s", (site) => {

  
  let homepageLinks : Array<string> = []
  beforeAll( () => {
    return new Promise((resolve, reject) => {

      console.log("running beforeAll")


      request.get(URL, {
        headers: {
          'test-host': `${site}.david-ma.net`
        }
      }, function (err: any, response: any, html: any) {
        if (err) { throw(err) }
        xray(html, ['a@href'])
        .then(function (links: Array<string>) {
          if (links) {
            console.log(links)
            homepageLinks = links
            resolve(links)
          } else {
            console.log(`No links found on ${site} homepage`)
            resolve()
          }
        }).catch((err :any) => {
          reject(err)
          // throw(err)
        })
      })
    })
  })
  
  test(`Async limited check all ${site} links`, () => {
    return new Promise((resolve, reject) => {

      asyncForEach(homepageLinks, 3, function(link :string){
        request.get(link, {
          headers: {
            'test-host': `${site}.david-ma.net`
          }
        }, function (err: any, response: any, html: any) {
          if (err) {
            console.error(`Link on ${site} broken: ${link}`)
            reject(err)
          }
          // console.log("link is ok: ", link)
        })
      })

      resolve()
    })
  }, timeout)





  test.skip(`Check all ${site} links`, () => {
    return new Promise((resolve, reject) => {
      homepageLinks.forEach(link => {
        request.get(link, {
          headers: {
            'test-host': `${site}.david-ma.net`
          }
        }, function (err: any, response: any, html: any) {
          if (err) {
            console.error(`Link on ${site} broken: ${link}`)
            reject(err)
          }
          // console.log("link is ok: ", link)
        })
      })
      resolve()
    })
  }, timeout)



  test.skip.each(homepageLinks)(`Check ${site} link: %s`, (link) => {
    return new Promise((resolve, reject) => {
      request.get(link, {
        headers: {
          'test-host': `${site}.david-ma.net`
        }
      }, function (err: any, response: any, html: any) {
        if (err) { reject() }
        resolve()
      })
    })
  })


  test.skip(`Grab all links for ${site}`, () => {
    return new Promise((resolve, reject) => {
      request.get(URL, {
        headers: {
          'test-host': `${site}.david-ma.net`
        }
      }, function (err: any, response: any, html: any) {
        if (err) {
          reject(err)
          // expect(false).toBeTruthy()
          // throw new Error('Error loading page')
        }
        xray(html, 'a')(function (err: any, links: Array<string>) {
          if(err) {
            // throw new Error('Error parsing html')
            fail()
          }
          // console.log(links)
          if (links) {
            
            test.each(links)(`Testing ${site} link: %s`, (link)=>{
              return new Promise((resolve, reject) => {
                resolve()
              })
            })


            expect(links.length).toBeGreaterThan(0)
            resolve()
          } else {
            // expect(false).toBeTruthy().rejects.toEqual({
            //   error: 'User with 3 not found.',
            // });
            // expect(false).reje
            // throw new Error('No links')
            // done.fail("no links");
            // expect("Lololol").toBe("ggg")
            // reject("No links found")
            console.info(`No links found on ${site} homepage`)
            resolve()
          }
        })
      })
    })
  })


  test.skip(`http.get the site ${site}`, (done) => {

    http.get(URL, {
      headers: {
        'test-host': `${site}.david-ma.net`
      }
    }, (res) => {
      // console.log("wooo")
      expect(res).toBeTruthy();
      done()
    });
  })



  test.skip(`Puppeteer ${site}`, (done) => {

    puppeteer.launch().then(browser => {
      browser.newPage().then(page => {
        page.setExtraHTTPHeaders({
          'test-host': `${site}.david-ma.net`
        })
        page.goto(URL, { waitUntil: 'domcontentloaded' })

        expect(true).toBeTruthy();
        // page.close()
        browser.close()
        done()
      });
    })
  })



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
})
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

