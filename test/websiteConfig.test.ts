import * as puppeteer from 'puppeteer'
import { describe, expect, test } from '@jest/globals'
import fs = require('fs')
import http = require('http')
import https = require('https')
const xray = require('x-ray')()
const jestConfig: any = require('../jest.config')

import type { Thalia } from '../server/thalia'

const URL = jestConfig.globals.URL

type SiteConfigPaths = {
  [key: string]: string
}

let configPaths: SiteConfigPaths = {}
let websites: {
  [key: string]: Thalia.WebsiteConfig
} = {}

// Setup:
if (process.env.SITE && process.env.SITE !== 'all') {
  configPaths = {
    [process.env.SITE]: findSiteConfig(process.env.SITE),
  }
} else {
  const websiteArray = fs
    .readdirSync('websites/')
    .filter((d) => d !== '.DS_Store')

  configPaths = websiteArray.reduce((acc: SiteConfigPaths, site: string) => {
    acc[site] = findSiteConfig(site)
    return acc
  }, {})
}

Object.keys(configPaths)
  .filter((site) => configPaths[site])
  .forEach((site) => {
    try {
      const configPath = configPaths[site]
      websites[site] = require('../' + configPath).config
    } catch (e) {
      console.error(e)
    }
  })

// Tests:
const itif = (condition: any) => (condition ? it : it.skip)
describe.each(Object.keys(websites))('Testing config of %s', (site) => {
  let config: Thalia.WebsiteConfig
  test(`Config.js can be opened?`, () => {
    return new Promise((resolve, reject) => {
      try {
        const configPath = configPaths[site]
        config = require('../' + configPath).config
        resolve(true)
      } catch (e) {
        reject()
      }
    })
  })

  itif(websites[site].data)(`${site} data folder`, () => {
    return new Promise((resolve, reject) => {
      fs.access(`websites/${site}/data`, (err) => {
        if (err) reject(`No data folder for ${site}`)
        resolve(true)
      })
    })
  })
})

xit('Avoid unused stuff', () => {
  console.log(URL)
  console.log(xray)
  console.log(puppeteer)
  console.log(http)
  console.log(https)
  console.log(test)
  asyncForEach([], function () {})
})

function findSiteConfig(site: string): string {
  if (fs.existsSync(`websites/${site}/config.js`))
    return `websites/${site}/config.js`
  if (fs.existsSync(`websites/${site}/config/config.js`))
    return `websites/${site}/config/config.js`
  return ''
}

// Asynchronous for each, doing a limited number of things at a time. Pool of resources.
async function asyncForEach(
  array: Array<any>,
  callback: (
    item: any,
    done: (errorMessage?: string) => void,
    index: number,
    arr: Array<any>
  ) => void,
  limit: number = 5
): Promise<string[]> {
  return new Promise((resolve) => {
    let i = 0
    let happening = 0
    const errorMessages: string[] = []

    for (; i < limit; i++) {
      // Launch a limited number of things
      happening++
      doNextThing(i)
    }

    function doNextThing(index: number) {
      // Each thing calls back "done" and starts the next
      if (array[index]) {
        callback(
          array[index],
          function done(message?: string) {
            if (message) errorMessages.push(message)
            doNextThing(i++)
          },
          index,
          array
        )
      } else {
        happening-- // When they're all done, resolve
        if (happening === 0) resolve(errorMessages)
      }
    }
  })
}
