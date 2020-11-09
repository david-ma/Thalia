import * as puppeteer from 'puppeteer'
const timeout = process.env.SLOWMO ? 30000 : 10000

const jestConfig :any = require('../jest.config')
const URL = jestConfig.globals.URL

let browser :any
let page : any
beforeAll(async () => {
  browser = await puppeteer.launch()
  page = await browser.newPage()

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
})

afterAll(async () => {
  browser.close()
})

describe('Test header and title of the page', () => {
  test('Title of the page', async () => {
    const title = await page.title()
    expect(title).toBe('#MakeoverMonday')
  }, timeout)
  test('Header of the page', async () => {
    const headerHandle = await page.$('#title h1')
    const html = await page.evaluate((headerHandle :any) => headerHandle.innerHTML, headerHandle)
    expect(html).toBe("David's Dataviz")
  }, timeout)

  test('Screenshot homepage', async () => {
    await page.goto(`${URL}`, { waitUntil: 'domcontentloaded' })
    const iPhonex = puppeteer.devices['iPhone X']
    await page.emulate(iPhonex)
    await page.setViewport({ width: 375, height: 812, isMobile: true })
    await page.screenshot({
      path: './tmp/home-mobile.jpg',
      fullpage: true,
      type: 'jpeg'
    })
  }, timeout)

  test('Screenshot breathe', async () => {
    await page.goto(`${URL}/blog/breathe`, { waitUntil: 'domcontentloaded' })
    const iPhonex = puppeteer.devices['iPhone X']
    await page.emulate(iPhonex)
    await page.setViewport({ width: 375, height: 1812, isMobile: true })
    await page.waitForTimeout(1000)
    await page.screenshot({
      path: './tmp/breathe-mobile.jpg',
      fullpage: true,
      type: 'jpeg'
    })
  }, timeout)
})
