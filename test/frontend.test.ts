import * as puppeteer from 'puppeteer'
import { describe, expect, test } from '@jest/globals'
import fs = require('fs');
import http = require('http');
import https = require('https');
const xray = require('x-ray')()
const jestConfig :any = require('../jest.config')

const timeout = process.env.SLOWMO ? 30000 : 10000
const URL = jestConfig.globals.URL

let websites :string[] = []
if (process.env.SITE && process.env.SITE !== 'all') {
  websites = [process.env.SITE]
} else {
  websites = fs.readdirSync('websites/').filter(d => d !== '.DS_Store') // .map( d =>  [[d],[]]);
}

// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach (array: Array<any>,
  callback: (item: any, done: (errorMessage ?: string) => void, index: number, arr: Array<any>) => void,
  limit : number = 5
) :Promise<string[]> {
  return new Promise((resolve) => {
    let i = 0
    let happening = 0
    const errorMessages :string[] = []

    for (; i < limit; i++) { // Launch a limited number of things
      happening++
      doNextThing(i)
    }

    function doNextThing (index: number) { // Each thing calls back "done" and starts the next
      if (array[index]) {
        callback(array[index], function done (message ?: string) {
          if (message) errorMessages.push(message)
          doNextThing(i++)
        }, index, array)
      } else {
        happening-- // When they're all done, resolve
        if (happening === 0) resolve(errorMessages)
      }
    }
  })
}

async function getLinks (site :string, page :string = '') :Promise<string[]> {
  // console.log(`Getting links on ${site} - ${URL} - ${page}`)
  return new Promise((resolve, reject) => {
    http.get(`${URL}/${page}`, {
      headers: {
        'x-host': `${site}.david-ma.net`,
        'test-host': `${site}.david-ma.net`
      }
    }, function (res: http.IncomingMessage) {
      let rawData = ''
      res.on('data', chunk => { rawData += chunk })
      res.on('end', () => {
        xray(rawData, ['a@href'])
          .then(function (links: Array<string>) {
            if (links) {
              resolve(links)
            } else {
              resolve([])
            }
          }).catch((err: Error) => {
            reject(err)
          })
      })
    }).on('error', error => { throw error })
  })
}

async function checkLinks (site : string, links : string[]) {
  return new Promise((resolve, reject) => {
    asyncForEach(links, function (link, done) {
      let requester : typeof https | typeof http
      if (link.match(/^https/gi)) {
        requester = https
      } else if (link.match(/^http/gi)) {
        requester = http
      } else {
        done()
      }

      if (requester) {
        requester.get(link, {
          headers: {
            'x-host': `${site}.david-ma.net`,
            'test-host': `${site}.david-ma.net`
          }
        }, function (response: http.IncomingMessage) {
          if (response.statusCode !== 200) {
            done(`${response.statusCode} - ${link}`)
          } else {
            done()
          }
        }).on('error', (e) => {
          done(e.message)
        })
      }
    }).then((errors) => {
      if (errors.length > 0) {
        reject(errors)
      } else {
        resolve("okay?")
      }
    })
  })
}

describe.each(websites)('Testing %s', (site) => {
  let homepageLinks: Array<string> = []
  let siteLinks: Array<string> = []
  beforeAll(() => {
    const promises = [
      getLinks(site)
    ]

    if (process.env.PAGE) promises.push(getLinks(site, process.env.PAGE))

    return Promise.all(promises).then((array :string[][]) => {
      homepageLinks = array[0]
      if (array[1]) {
        siteLinks = array[1]
      }
    })
  })

  test(`Check external links on ${site} homepage`, () => {
    return checkLinks(site, homepageLinks)
  }, timeout * websites.length)

  test(`Screenshot ${site}`, () => {
    return new Promise((resolve, reject) => {
      let promises : Promise<any>[]

      puppeteer.launch().then(browser => {
        browser.newPage().then(page => {
          promises = [
            page.setExtraHTTPHeaders({
              'x-host': `${site}.david-ma.net`,
              'test-host': `${site}.david-ma.net`
            }),
            page.setViewport({ width: 414, height: 2500, isMobile: true })
          ]

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
                    expect(true).toBeTruthy()
                    browser.close()
                    resolve(site)
                  })
                })
              }).catch(error => {
                browser.close()
                reject(error)
              })
            })
          }).catch(error => {
            browser.close()
            reject(error)
          })
        })
      })
    })
  }, timeout)

  test(`Check external links on ${site} - ${process.env.PAGE || 'n/a'}`, () => {
    return checkLinks(site, siteLinks)
  }, timeout * websites.length)

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
