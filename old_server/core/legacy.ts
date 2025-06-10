import { Thalia } from './types'
import fs = require('fs')
const fsPromise = fs.promises
import path = require('path')
import sass = require('sass')
import { DatabaseInstance } from './database'
import { merge } from './util'

// Each website should have their own Handlebars instance? Frame?
// https://handlebarsjs.com/api-reference/utilities.html#handlebars-createframe-data
const Handlebars = require('handlebars')

export namespace ThaliaLegacy {
  export class Website implements Thalia.WebsiteConfig {
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
    db?: DatabaseInstance
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
          typeof config.folder === 'string' ? config.folder : path.resolve(process.cwd(), 'websites', site, 'public')
        this.workspacePath =
          typeof config.workspacePath === 'string' ? config.workspacePath : path.resolve(process.cwd(), 'websites', site)
        this.domains = typeof config.domains === 'object' ? config.domains : []
        this.pages = typeof config.pages === 'object' ? config.pages : {}
        this.redirects = typeof config.redirects === 'object' ? config.redirects : {}
        this.services = typeof config.services === 'object' ? config.services : {}
        this.controllers = typeof config.controllers === 'object' ? config.controllers : {}
        this.proxies = typeof config.proxies === 'object' ? config.proxies : {}
        this.sockets = typeof config.sockets === 'object' ? config.sockets : { on: [], emit: [] }
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

    private async getViews(): Promise<Record<string, string>> {
      const thaliaViews = await readAllViewsInFolder(path.join(process.cwd(), 'views'))
      const exampleViews = await readAllViewsInFolder(path.join(process.cwd(), 'websites', 'example', 'views'))
      const websiteViews = await readAllViewsInFolder(path.join(process.cwd(), 'websites', this.name, 'views'))
      return merge(merge(thaliaViews, exampleViews), websiteViews)
    }

    private async getScaffoldViews(): Promise<Record<string, string>> {
      const exampleViews = await readAllViewsInFolder(path.join(process.cwd(), 'websites', 'example', 'views'))
      const scaffoldViews = await readAllViewsInFolder(path.join(process.cwd(), 'websites', 'scaffold', 'views'))
      const projectViews = await readAllViewsInFolder(path.join(process.cwd(), 'websites', this.name, 'views'))
      return merge(merge(exampleViews, scaffoldViews), projectViews)
    }
  }

  export type Views = {
    [key: string]: string
  }

  export type ViewCallback = (view: Views) => void

  export async function readAllViewsInFolder(folder: string): Promise<Views> {
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
                        console.log('Error in readAllViewsInFolder, reading the file:', filename)
                        console.log('error', e)
                      })
                  } else {
                    fsPromise.lstat(`${folder}/${filename}`).then((d: any) => {
                      if (d.isDirectory()) {
                        readAllViewsInFolder(`${folder}/${filename}`).then((d) => resolve(d))
                      } else {
                        resolve({})
                      }
                    })
                  }
                })
            )
          ).then(
            (array: Array<Views>) => {
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
          console.error(`Error with SCSS or Script file: ${file}`)
          resolve({
            content: '500',
            scripts: '',
            styles: '',
          })
        })
    })
  }

  export function registerAllViewsAsPartials(views: Views) {
    Object.entries(views).forEach(([key, value]) => {
      Handlebars.registerPartial(key, value)
    })
  }

  export const handle: Thalia.Handle = {
    websites: {},
    index: { localhost: 'default' },
    loadAllWebsites: function (project: string = 'default') {
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
              config = require(paths.config).config
              config.workspacePath = paths.workspace
              if (config) {
                break
              }
            }
          }

          if (!config) {
            console.log('No config provided')
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

          if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
            config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config
          } else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
            config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config
          } else {
            console.log(`No config provided for ${site}, just serving the public folder`)
          }
          console.log(`${Date.now() - start} ms - config.js for ${site}`)
        } catch (err) {
          if (err.code !== 'MODULE_NOT_FOUND') {
            console.log('Warning, your config script for ' + site + ' is broken!')
            console.error(err)
          } else {
            console.log('Error in config.js for ' + site + '!')
            console.log(err)
          }
        }

        handle.addWebsite(site, config)
      } else {
        console.log('Loading all websites')
        const websites = fs.readdirSync('websites')
        websites.forEach((site) => {
          if (site !== 'example' && site !== 'scaffold') {
            console.log('Adding site: ' + site)
            let config: Thalia.WebsiteConfig = {}
            try {
              const start = Date.now()

              if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
                config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config
              } else if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config', 'config.js'))) {
                config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config
              } else {
                console.log(`No config provided for ${site}, just serving the public folder`)
              }
              console.log(`${Date.now() - start} ms - config.js for ${site}`)
            } catch (err) {
              if (err.code !== 'MODULE_NOT_FOUND') {
                console.log('Warning, your config script for ' + site + ' is broken!')
                console.error(err)
              } else {
                console.log('Error in config.js for ' + site + '!')
                console.log(err)
              }
            }

            handle.addWebsite(site, config)
          }
        })
      }
    },
    addWebsite: function (site: string, config: Thalia.WebsiteConfig) {
      const baseUrl = path.resolve(process.cwd(), 'websites', site)

      handle.websites[site] = new Website(site, config)

      handle.websites[site].readAllViews = function (callback: ViewCallback) {
        const promises: Promise<Views>[] = [
          readAllViewsInFolder(path.resolve(__dirname, '..', 'websites', 'example', 'views')),
          readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
          readAllViewsInFolder(path.resolve(baseUrl, 'views')),
        ]

        Promise.all(promises)
          .then(
            ([exampleViews, thaliaViews, websiteViews]: any) => {
              return merge(merge(thaliaViews, exampleViews), websiteViews)
            },
            (error) => {
              console.error('Error reading views', error)
              return {}
            }
          )
          .then(callback)
      }

      handle.websites[site].readTemplate = function (config: { template: string; content: string; callback: any }) {
        readTemplate(config.template, path.resolve(baseUrl, 'views'), config.content)
          .catch((e) => {
            console.error('error here?', e)
            config.callback(e)
          })
          .then((d) => {
            config.callback(d)
          })
      }

      const promises: Promise<Views>[] = [
        readAllViewsInFolder(path.resolve(__dirname, '..', 'websites', 'example', 'views')),
        readAllViewsInFolder(path.resolve(__dirname, '..', 'src', 'views')),
        readAllViewsInFolder(path.resolve(baseUrl, 'views')),
      ]

      Promise.all(promises)
        .then(([exampleViews, scaffoldViews, projectViews]: any) => {
          return merge(merge(exampleViews, scaffoldViews), projectViews)
        })
        .then((views) => {
          handle.websites[site].views = views

          fsPromise
            .readdir(path.resolve(baseUrl, 'views'))
            .then(function (files: string[]) {
              files
                .filter((file: string) => file.match(/.mustache|.hbs/))
                .forEach((file: string) => {
                  const webpage = file.split(/.mustache|.hbs/)[0]
                  if (
                    (config.mustacheIgnore ? config.mustacheIgnore.indexOf(webpage) === -1 : true) &&
                    !handle.websites[site].controllers[webpage]
                  ) {
                    handle.websites[site].controllers[webpage] = function (controller: Thalia.Controller) {
                      if (handle.websites[site].cache) {
                        registerAllViewsAsPartials(views)
                        controller.res.end(Handlebars.compile(views[webpage])({}))
                      } else {
                        readAllViewsInFolder(path.resolve(baseUrl, 'views')).then((views) => {
                          handle.websites[site].views = views
                          registerAllViewsAsPartials(views)
                          controller.res.end(Handlebars.compile(views[webpage])({}))
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
        if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
          site = handle.index[domain]
        }
        domain = domain.replace('www.', '')
        if (Object.prototype.hasOwnProperty.call(handle.index, domain)) {
          site = handle.index[domain]
        }
      }
      return handle.websites[site]
    },
    proxies: {},
  }

  handle.addWebsite('default', {})

  export async function readTemplate(template: string, folder: string, content = '') {
    console.log(`Running readTemplate(${template}, ${folder}, ${content})`)

    return new Promise((resolve, reject) => {
      const promises: Promise<any>[] = []
      const filenames = ['template', 'content']

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
      )

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
} 