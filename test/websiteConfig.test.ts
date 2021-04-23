import * as puppeteer from 'puppeteer'
import { describe, expect, test } from '@jest/globals'
import fs = require('fs')
import http = require('http')
import https = require('https')
const xray = require('x-ray')()
const jestConfig: any = require('../jest.config')

const URL = jestConfig.globals.URL

type AllSiteConfigs = {
  [key: string]: string
}

let websites: AllSiteConfigs = {}

if (process.env.SITE && process.env.SITE !== 'all') {
  websites = {
    [process.env.SITE]: findSiteConfig(process.env.SITE),
  }
} else {
  const websiteArray = fs
    .readdirSync('websites/')
    .filter((d) => d !== '.DS_Store')

  websites = websiteArray.reduce((acc: AllSiteConfigs, site: string) => {
    acc[site] = findSiteConfig(site)
    return acc
  }, {})
}

function findSiteConfig(site: string): string {
  if (fs.existsSync(`websites/${site}/config.js`))
    return `websites/${site}/config.js`
  if (fs.existsSync(`websites/${site}/config/config.js`))
    `websites/${site}/config/config.js`
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

let storage: any = {}

const itif = (condition: any) => (condition ? it : it.skip)

describe.each(Object.keys(websites))('Testing config of %s', (site) => {
  let config: any
  xit(`${site} has a config?`, () => {
    return new Promise((resolve, reject) => {
      if (fs.existsSync(`websites/${site}/config.js`)) {
        config = storage[site] = `websites/${site}/config.js`
        resolve(true)
      } else {
        if (fs.existsSync(`websites/${site}/config/config.js`)) {
          config = storage[site] = `websites/${site}/config/config.js`
          resolve(true)
        } else {
          resolve(true)
        }
      }
    })
  })

  itif(websites[site])(`${site} config`, () => {
    return new Promise((resolve, reject) => {
      const config = websites[site]

      console.log(config)

      expect(true).toBe(true)
      // expect(storage[site])
      resolve(true)
    })
  })

  // itif(true)(`blahhh ${site} xxx`, () => {
  //   expect(true).toBe(true)
  //   // expect(storage[site])
  // })

  xit('asdf', () => {
    console.log(URL)
    console.log(xray)
    console.log(puppeteer)
    console.log(http)
    console.log(https)
    console.log(test)
    asyncForEach([], function () {})
  })
})
