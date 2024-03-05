// requestHandlers.ts
import { Thalia } from './thalia'
import fs = require('fs')
const fsPromise = fs.promises
import path = require('path')
import sass = require('sass')

// Each website should have their own Handlebars instace? Frame?
// https://handlebarsjs.com/api-reference/utilities.html#handlebars-createframe-data
const Handlebars = require('handlebars')

const _ = require('lodash')

class Website implements Thalia.WebsiteConfig {
  name: string
  data: string
  dist: string
  cache: boolean
  folder: string
  domains: Array<string>
  workspacePath: string
  pages: {
    [key: string]: string
  }

  redirects: {
    [key: string]: string
  }

  services: Thalia.Services
  // proxies:
  proxies:
    | {
        [key: string]: Thalia.Proxy
      }
    | Thalia.rawProxy[]

  sockets: Thalia.Sockets
  security: {
    loginNeeded: any
  }

  viewableFolders: boolean | Array<string>
  seq: Thalia.SequelizeWrapper
  readAllViews: {
    (callback: ViewCallback): void
  }

  readTemplate: {
    (config: { template: string; content: string; callback: any }): void
  }

  views: any
  controllers: Thalia.Controllers
  constructor(site: string, config: Thalia.WebsiteConfig) {
    if (typeof config === 'object') {
      this.name = site
      this.data = '' // Used to be false. Todo: Check if this is ok
      this.dist = '' // Used to be false. Todo: Check if this is ok
      this.cache = typeof config.cache === 'boolean' ? config.cache : true
      this.folder =
        typeof config.folder === 'string'
          ? config.folder
          : path.resolve(process.cwd(), 'websites', site, 'public')
      // : 'websites/' + site + '/public'

      this.workspacePath =
        typeof config.workspacePath === 'string'
          ? config.workspacePath
          : path.resolve(process.cwd(), 'websites', site)

      this.domains = typeof config.domains === 'object' ? config.domains : []
      this.pages = typeof config.pages === 'object' ? config.pages : {}
      this.redirects =
        typeof config.redirects === 'object' ? config.redirects : {}
      this.services = typeof config.services === 'object' ? config.services : {}
      this.controllers =
        typeof config.controllers === 'object' ? config.controllers : {}
      this.proxies = typeof config.proxies === 'object' ? config.proxies : {}
      this.sockets =
        typeof config.sockets === 'object'
          ? config.sockets
          : { on: [], emit: [] }
      this.security =
        typeof config.security === 'object'
          ? config.security
          : {
              loginNeeded: function () {
                return false
              },
            }
      this.viewableFolders = config.viewableFolders || false
      this.views = false
    } else {
      console.log("Config isn't an object")
    }
  }
}

const handle: Thalia.Handle = {
  websites: {},
  index: { localhost: 'default' },
  loadAllWebsites: function () {
    const standAlone: boolean = !fs.existsSync('websites')

    if (standAlone) {
      console.log('Serving stand alone website')
      const workspace = '..'
      handle.index.localhost = workspace
      const site = workspace

      let config

      try {
        const start = Date.now()

        const list_of_paths = [
          {
            config: path.resolve(__dirname, '..', 'config.js'),
            workspace: path.resolve(__dirname, '..'),
          },
          {
            config: path.resolve(__dirname, '..', 'config', 'config.js'),
            workspace: path.resolve(__dirname, '..'),
          },
          {
            config: path.resolve(process.cwd(), 'config.js'),
            workspace: process.cwd(),
          },
          {
            config: path.resolve(process.cwd(), 'config', 'config.js'),
            workspace: process.cwd(),
          },
        ]

        for (const paths of list_of_paths) {
          if (fs.existsSync(paths.config)) {
            // console.log('Found config', paths.config)
            // console.log('Workspace:', paths.workspace)
            config = require(paths.config).config
            config.workspacePath = paths.workspace
            if (config) {
              break
            }
          }
        }

        if (!config) {
          console.log('No config provided')
          // TODO: We shouldn't crash. Just serve the public folder.
        }

        console.log(`Loading time: ${Date.now() - start} ms - config.js`)
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          console.log('Warning, your config script is broken!')
          console.error(err)
          console.log()
        } else {
          console.log('Error in config.js!')
          console.log(err)
        }
      }

      config.standAlone = true
      config.folder = path.resolve(config.workspacePath, 'public')

      handle.addWebsite(site, config)

      console.log('Setting workspace to current directory')
      handle.index.localhost = workspace
    } else if (handle.index.localhost !== 'default') {
      console.log('Only load %s', handle.index.localhost)
      const site: string = handle.index.localhost
      console.log('Adding site: ' + site)
      let config: Thalia.WebsiteConfig = {}
      try {
        const start = Date.now()

        if (
          fs.existsSync(
            path.resolve(__dirname, '..', 'websites', site, 'config.js')
          )
        ) {
          config = require(path.resolve(
            __dirname,
            '..',
            'websites',
            site,
            'config'
          )).config
        } else if (
          fs.existsSync(
            path.resolve(
              __dirname,
              '..',
              'websites',
              site,
              'config',
              'config.js'
            )
          )
        ) {
          config = require(path.resolve(
            __dirname,
            '..',
            'websites',
            site,
            'config',
            'config'
          )).config
        } else {
          console.log(
            `No config provided for ${site}, just serving the public folder`
          )
        }
        console.log(`${Date.now() - start} ms - config.js for ${site}`)
      } catch (err) {
        if (err.code !== 'MODULE_NOT_FOUND') {
          console.log('Warning, your config script for ' + site + ' is broken!')
          console.error(err)
          console.log()
        } else {
          console.log(`Error in ${site} config!`)
          console.log(err)
        }
      }

      config.cache = false
      handle.addWebsite(site, config)
    } else {
      fs.readdirSync('websites/').forEach(function (site: string) {
        if (fs.lstatSync('websites/' + site).isDirectory()) {
          console.log('Adding site: ' + site)
          let config: Thalia.WebsiteConfig = {}
          try {
            if (
              fs.existsSync(
                path.resolve(__dirname, '..', 'websites', site, 'config.js')
              )
            ) {
              config = require(path.resolve(
                __dirname,
                '..',
                'websites',
                site,
                'config'
              )).config
            } else if (
              fs.existsSync(
                path.resolve(
                  __dirname,
                  '..',
                  'websites',
                  site,
                  'config',
                  'config.js'
                )
              )
            ) {
              config = require(path.resolve(
                __dirname,
                '..',
                'websites',
                site,
                'config',
                'config'
              )).config
            } else {
              console.log(
                `No config provided for ${site}, just serve the public folder`
              )
            }
          } catch (err) {
            if (err.code !== 'MODULE_NOT_FOUND') {
              console.log(
                'Warning, your config script for ' + site + ' is broken!'
              )
              console.error(err)
              console.log()
            } else {
              // Note, we want this to be silent if config.js is missing, because we can just serve the public/dist folders.
              // but log an error if config.js requires something that is not available.

              if (
                err.requireStack &&
                err.requireStack[0].indexOf('thalia.js') > 0
              ) {
                console.log(
                  `${site} does not use config.js, just serve the public folder`
                )
              } else {
                // Do we want errors to appear in standard error? Or standard log??? Both???
                console.error(`Error loading config for ${site}`)
                console.log(err)
                console.log()
              }
            }
          }
          handle.addWebsite(site, config)
        }
      })
    }
  },

  // TODO: Make all of this asynchronous?
  // Add a site to the handle
  /**
   * Takes the name of a workspace, and the config, then returns a website object
   */
  addWebsite: function (site: string, config: Thalia.WebsiteConfig) {
    config = config || {}
    handle.websites[site] = new Website(site, config)

    const baseUrl = config.standAlone
      ? config.workspacePath
      : path.resolve(__dirname, '..', 'websites', site)

    // If dist or data exist, enable them.
    if (fs.existsSync(path.resolve(baseUrl, 'data'))) {
      handle.websites[site].data = path.resolve(baseUrl, 'data')
    }
    if (fs.existsSync(path.resolve(baseUrl, 'dist'))) {
      handle.websites[site].dist = path.resolve(baseUrl, 'dist')
    }

    // Proxy things
    if (Array.isArray(handle.websites[site].proxies)) {
      ;(<Thalia.rawProxy[]>handle.websites[site].proxies).forEach(function (
        proxy: Thalia.rawProxy
      ) {
        proxy.domains.forEach((domain) => {
          handle.proxies[domain] = makeProxy(handle.proxies[domain], proxy)
        })
      })
    } else {
      Object.keys(handle.websites[site].proxies).forEach(function (domain) {
        const rawProxy: Thalia.rawProxy = (<{ [key: string]: Thalia.rawProxy }>(
          handle.websites[site].proxies
        ))[domain]

        handle.proxies[domain] = makeProxy(handle.proxies[domain], rawProxy)
      })
    }

    function makeProxy(proxies: Thalia.Proxies, rawProxy: Thalia.rawProxy) {
      proxies = proxies || {}
      const proxy: Thalia.Proxy = {
        host: rawProxy.host || '127.0.0.1',
        message: rawProxy.message || 'Error, server is down.',
        port: rawProxy.port || 80,
        filter: rawProxy.filter,
        password: rawProxy.password,
        silent: rawProxy.silent || false,
      }
      if (rawProxy.filter) {
        proxies[rawProxy.filter] = proxy
      } else {
        proxies['*'] = proxy
      }
      return proxies
    }

    // If sequelize is set up, add it.
    if (fs.existsSync(path.resolve(baseUrl, 'db_bootstrap.js'))) {
      try {
        const start = Date.now()
        handle.websites[site].seq = require(path.resolve(
          baseUrl,
          'db_bootstrap.js'
        )).seq
        console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`)
      } catch (e) {
        console.log(e)
      }
    } else if (
      fs.existsSync(path.resolve(baseUrl, 'config', 'db_bootstrap.js'))
    ) {
      try {
        const start = Date.now()
        handle.websites[site].seq = require(path.resolve(
          baseUrl,
          'config',
          'db_bootstrap.js'
        )).seq
        console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`)
      } catch (e) {
        console.log(e)
      }
    }

    // If website has views, load them.
    if (fs.existsSync(path.resolve(baseUrl, 'views'))) {
      handle.websites[site].views = true

      // Stupid hack for development if you don't want to cache the views :(
      handle.websites[site].readAllViews = function (callback: ViewCallback) {
        const promises: Promise<Views>[] = [
          readAllViewsInFolder(
            path.resolve(__dirname, '..', 'websites', 'example', 'views')
          ),
          readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
          readAllViewsInFolder(path.resolve(baseUrl, 'views')),
        ]
        Promise.all(promises)
          .then(([exampleViews, thaliaViews, websiteViews]: any) => {
            // Use the website's views if they exist, otherwise use the default views
            // TODO: Allow themes to be applied in the middle?
            return _.merge(thaliaViews, exampleViews, websiteViews)
          })
          .then(callback)
      }
      handle.websites[site].readTemplate = function (config: {
        template: string
        content: string
        callback: any
      }) {
        readTemplate(
          config.template,
          path.resolve(baseUrl, 'views'),
          config.content
        )
          .catch((e) => {
            console.error('error here?', e)
            config.callback(e)
          })
          .then((d) => {
            config.callback(d)
          })
      }

      // Load all the views
      // Consider adding partials only for it's own website?
      // There's a possibility of name collisions if we don't.
      const promises: Promise<Views>[] = [
        readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
        readAllViewsInFolder(path.resolve(baseUrl, 'views')),
      ]
      Promise.all(promises)
        .then(([scaffoldViews, projectViews]: any) => {
          return _.merge(scaffoldViews, projectViews)
        })
        .then((views) => {
          // readAllViewsInFolder(path.resolve(baseUrl, 'views')).then((views) => {
          handle.websites[site].views = views

          fsPromise
            .readdir(path.resolve(baseUrl, 'views'))
            .then(function (files: string[]) {
              files
                .filter((file: string) => file.match(/.mustache|.hbs/))
                .forEach((file: string) => {
                  const webpage = file.split(/.mustache|.hbs/)[0]
                  if (
                    (config.mustacheIgnore
                      ? config.mustacheIgnore.indexOf(webpage) === -1
                      : true) &&
                    !handle.websites[site].controllers[webpage]
                  ) {
                    handle.websites[site].controllers[webpage] = function (
                      controller: Thalia.Controller
                    ) {
                      if (handle.websites[site].cache) {
                        registerAllViewsAsPartials(views)
                        controller.res.end(
                          Handlebars.compile(views[webpage])({})
                        )
                      } else {
                        readAllViewsInFolder(
                          path.resolve(baseUrl, 'views')
                        ).then((views) => {
                          handle.websites[site].views = views
                          registerAllViewsAsPartials(views)
                          controller.res.end(
                            Handlebars.compile(views[webpage])({})
                          )
                        })
                      }
                    }
                  }
                })
            })
            .catch((e: any) => {
              console.log('Error reading views folder')
              console.log(e)
            })
        })
    }

    // Unused feature? Commenting it out DKGM 2020-10-29
    // If the site has any startup actions, do them
    // if(config.startup){
    //     config.startup.forEach(function(action:any){
    //         action(handle.websites[site]);
    //     });
    // }

    // Add the site to the index
    handle.index[site + '.david-ma.net'] = site
    handle.index[`${site}.com`] = site
    handle.index[`${site}.net`] = site
    handle.websites[site].domains.forEach(function (domain: string) {
      handle.index[domain] = site
    })
  },
  getWebsite: function (domain: any) {
    let site = handle.index.localhost
    if (domain) {
      // if (handle.index.hasOwnProperty(domain)) {
      if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
        site = handle.index[domain]
      }
      domain = domain.replace('www.', '')
      // if (handle.index.hasOwnProperty(domain)) {
      if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
        site = handle.index[domain]
      }
    }
    return handle.websites[site]
  },
  proxies: {},
}

handle.addWebsite('default', {})

// TODO: handle rejection & errors?
async function readTemplate(template: string, folder: string, content = '') {
  console.log(`Running readTemplate(${template}, ${folder}, ${content})`)

  return new Promise((resolve, reject) => {
    // console.log(`Reading template ${template} from folder ${folder}`)

    const promises: Promise<any>[] = []
    const filenames = ['template', 'content']

    // Load the mustache template (outer layer)
    promises.push(
      new Promise((resolve) => {
        fsPromise
          .readFile(`${folder}/${template}`, {
            encoding: 'utf8',
          })
          .catch(() => {
            resolve(`404 - ${template} not found`)
          })
          .then((data: string) => {
            resolve(data)
          })
      })

      // Use mustache to render the template?
      // Bad idea because it breaks scripts that need data.
      //
      // new Promise((resolve) => {
      //   loadMustacheTemplate(`${folder}/${template}`)
      //     .catch((e) => {
      //       console.log('Error', e)
      //       resolve('bad world?')
      //     })
      //     .then((template: any) => {
      //       resolve(mustache.render(template.content, {}, template))
      //     })
      //     .catch((e) => {
      //       console.log('Error over here', e)
      //       reject(e)
      //     })
    )

    // Load the mustache content (innermost layer)
    promises.push(
      new Promise((resolve) => {
        if (Array.isArray(content) && content[0]) content = content[0]

        loadMustacheTemplate(`${folder}/content/${content}.mustache`)
          .catch((e) => {
            console.error('Error loading mustache template.', e)
            fsPromise
              .readFile(`${folder}/404.mustache`, {
                encoding: 'utf8',
              })
              .then((result: any) => {
                resolve(result)
              })
          })
          .then((d) => resolve(d))
      })
    )

    // Load all the other partials we may need
    // Todo: Check folder exists and is not empty?
    fsPromise.readdir(`${folder}/partials/`).then(function (d: string[]) {
      d.forEach(function (filename) {
        if (filename.match(/.mustache|.hbs/)) {
          filenames.push(filename.split(/.mustache|.hbs/)[0])
          promises.push(
            fsPromise.readFile(`${folder}/partials/${filename}`, {
              encoding: 'utf8',
            })
          )
        }
      })

      Promise.all(promises).then(function (array) {
        const results: any = {}
        filenames.forEach((filename, i) => {
          results[filename] = array[i]
        })

        if (typeof results.content === 'object') {
          results.scripts = results.content.scripts
          results.styles = results.content.styles
          results.content = results.content.content
        }

        resolve(results)
      })
    })
  })
}

export type Views = {
  [key: string]: string
}

export type ViewCallback = (view: Views) => void

async function readAllViewsInFolder(folder: string): Promise<Views> {
  return new Promise((resolve, reject) => {
    fsPromise
      .readdir(folder)
      .then((directory: Array<string>) => {
        Promise.all(
          directory.map(
            (filename: string) =>
              new Promise((resolve) => {
                if (filename.match(/.mustache|.hbs/)) {
                  fsPromise
                    .readFile(`${folder}/${filename}`, 'utf8')
                    .then((file: string) => {
                      const name = filename.split(/.mustache|.hbs/)[0]
                      resolve({
                        [name]: file,
                      })
                    })
                    .catch((e: any) => {
                      console.log(
                        'Error in readAllViewsInFolder, reading the file:',
                        filename
                      )
                      console.log('error', e)
                    })
                } else {
                  fsPromise.lstat(`${folder}/${filename}`).then((d: any) => {
                    if (d.isDirectory()) {
                      readAllViewsInFolder(`${folder}/${filename}`).then((d) =>
                        resolve(d)
                      )
                    } else {
                      // console.log(`${filename} is not a folder`);
                      resolve({})
                    }
                  })
                }
              })
          )
        ).then(
          (array: Array<Views>) => {
            // Check if array is empty before reducing
            if (array.length === 0) {
              resolve({})
            } else {
              resolve(array.reduce((a, b) => Object.assign(a, b)))
            }
          },
          (reason) => {
            console.log('Error in readAllViews', reason)
            reject(reason)
          }
        )
      })
      .catch((e: any) => {
        console.log('Error in readAllViewsInFolder')
        console.log(e)
      })
  })
}

/**
 * Read a mustache template file
 * Find the scripts and styles
 * Minify and process the javscript and sass
 * Then reinsert them into the template
 *
 * TODO: Process typescript?
 */
export function loadMustacheTemplate(file: string): Promise<{
  content: string
  scripts: string
  styles: string
}> {
  return new Promise((resolve, reject) => {
    fsPromise
      .readFile(file, {
        encoding: 'utf8',
      })
      .catch(() => {
        // throw new Error(`Error reading file: ${file}`)
        console.error('Error reading file: ', file)
        reject(`Error reading file: ${file}`)
      })
      .then((fileText: any) => {
        const scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g
        const styleEx = /<style\b.*>([^<]*(?:(?!<\/style>)<[^<]*)*)<\/style>/g

        const scripts = [...fileText.matchAll(scriptEx)].map((d) => d[0])
        const styles = [...fileText.matchAll(styleEx)].map((d) => d[0])

        let styleData = styles.join('\n').replace(/<\/?style>/g, '')

        sass.render(
          {
            data: styleData,
            outputStyle: 'compressed',
          },
          function (err, sassResult) {
            if (err) {
              console.error(`Error reading SCSS from file: ${file}`)
              console.error('Error', err)

              // Or do we just resolve with the original styles?

              resolve({
                content: fileText,
                scripts: '',
                styles: '',
              })
            } else {
              styleData = sassResult.css.toString()
              resolve({
                content: fileText.replace(scriptEx, '').replace(styleEx, ''),
                scripts: scripts.join('\n'),
                styles: `<style>${styleData}</style>`,
              })
            }
          }
        )
      })
      .catch(() => {
        // throw new Error(`Error with SCSS or Script file: ${file}`)
        console.error(`Error with SCSS or Script file: ${file}`)
        resolve({
          content: '500',
          scripts: '',
          styles: '',
        })
      })
  })
}

function registerAllViewsAsPartials(views: Views) {
  Object.entries(views).forEach(([key, value]) => {
    Handlebars.registerPartial(key, value)
  })
}

export { handle, Website }
