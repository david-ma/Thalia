import http = require('http')
import https = require('https')
const xray = require('x-ray')()
const jestConfig: any = require('../jest.config')
const jestURL = jestConfig.globals.URL

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

async function getLinks(site: string, page: string = ''): Promise<string[]> {
  // console.log(`Getting links on ${site} - ${URL} - ${page}`)
  return new Promise((resolve, reject) => {
    http
      .get(
        `${jestURL}/${page}`,
        {
          headers: {
            'x-host': `${site}.com`,
          },
        },
        function (res: http.IncomingMessage) {
          let rawData = ''
          res.on('data', (chunk) => {
            rawData += chunk
          })
          res.on('end', () => {
            xray(rawData, ['a@href'])
              .then(function (links: Array<string>) {
                if (links) {
                  resolve(links)
                } else {
                  resolve([])
                }
              })
              .catch((err: Error) => {
                reject(err)
              })
          })
        }
      )
      .on('error', (error) => {
        throw error
      })
  })
}

async function checkLinks(site: string, links: string[]) {
  return new Promise((resolve, reject) => {
    asyncForEach(links, function (link, done) {
      let requester: typeof https | typeof http = http
      if (link.match(/^https/gi)) {
        requester = https
      }

      try {
        requester
          .get(
            link,
            {
              timeout: 2000,
              headers: {
                'x-host': `${site}.com`,
                'user-agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.36',
              },
            },
            function (response: http.IncomingMessage) {
              // TODO: Follow 3xx links and see if they're valid?
              const allowedStatusCodes = [200, 301, 302, 303, 307, 999]

              response.on('end', function () {
                if (allowedStatusCodes.indexOf(response.statusCode) === -1) {
                  done(`${response.statusCode} - ${link}`)
                } else {
                  done()
                }
              })
              response.on('data', function (chunk) {})
              response.on('error', function (e) {
                done(`${e.message} - ${link}`)
              })
            }
          )
          .on('error', (e) => {
            done(`${e.message} - ${link}`)
          })
      } catch (e) {
        done(`${e.message} - ${link}`)
      }
    })
      .then((errors) => {
        if (errors.length > 0) {
          reject(errors)
        } else {
          resolve('okay?')
        }
      })
      .catch((e) => {
        reject(e)
      })
  })
}

function validURL(str: string) {
  var pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ) // fragment locator
  return !!pattern.test(str)
}

export { asyncForEach, getLinks, checkLinks, validURL }
