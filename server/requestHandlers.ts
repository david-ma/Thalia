// requestHandlers.ts
import { Thalia } from './thalia'
import fs = require('fs');
const fsPromise = fs.promises
import mustache = require('mustache');
import path = require('path')

class Website implements Thalia.WebsiteConfig {
    name: string;
    data: string;
    dist: string;
    cache: boolean;
    folder: string;
    domains: Array<string>;
    pages: {
        [key:string] : string;
    };

    redirects: {
        [key:string] : string;
    };

    services: Thalia.Services;
    proxies: {
        [key:string] : Thalia.Proxy;
    };

    sockets: Thalia.Sockets;
    security: {
        loginNeeded: any;
    };

    viewableFolders: boolean | Array<any>;
    seq: Thalia.SequelizeWrapper;
    readAllViews :{
        (callback: any) :void;
    };

    readTemplate :{
        (template: string, content: string, callback: any) :void;
    };

    views: any;
    controllers: Thalia.Controllers;
    constructor (site :string, config :Thalia.WebsiteConfig) {
      if (typeof config === 'object') {
        this.name = site
        this.data = '' // Used to be false. Todo: Check if this is ok
        this.dist = '' // Used to be false. Todo: Check if this is ok
        this.cache = typeof config.cache === 'boolean' ? config.cache : true
        this.folder = typeof config.folder === 'string' ? config.folder : 'websites/' + site + '/public'
        this.domains = typeof config.domains === 'object' ? config.domains : []
        this.pages = typeof config.pages === 'object' ? config.pages : {}
        this.redirects = typeof config.redirects === 'object' ? config.redirects : {}
        this.services = typeof config.services === 'object' ? config.services : {}
        this.controllers = typeof config.controllers === 'object' ? config.controllers : {}
        this.proxies = typeof config.proxies === 'object' ? config.proxies : {}
        this.sockets = typeof config.sockets === 'object' ? config.sockets : { on: [], emit: [] }
        this.security = typeof config.security === 'object' ? config.security : { loginNeeded: function () { return false } }
        this.viewableFolders = config.viewableFolders || false
      } else {
        console.log("Config isn't an object")
      }
    };
}

const handle :Thalia.Handle = {
  websites: {},
  index: { localhost: 'default' },
  loadAllWebsites: function () {
    const standAlone :boolean = !fs.existsSync('websites')

    if (standAlone) {
      console.log('Serving stand alone website')
      const workspace = '..'
      handle.index.localhost = workspace
      const site = workspace

      let config

      try {
        const start = Date.now()

        if (fs.existsSync(path.resolve(__dirname, '..', 'config.js'))) {
          config = require(path.resolve(__dirname, '..', 'config')).config
        } else {
          config = require(path.resolve(__dirname, '..', 'config', 'config')).config
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
      config.folder = path.resolve(__dirname, '..', 'public')

      handle.addWebsite(site, config)

      console.log('Setting workspace to current directory')
      handle.index.localhost = workspace
    } else if (handle.index.localhost !== 'default') {
      console.log('Only load %s', handle.index.localhost)
      const site :string = handle.index.localhost
      console.log('Adding site: ' + site)
      let config
      try {
        const start = Date.now()

        if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
          config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config
        } else {
          config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config
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
      fs.readdirSync('websites/').forEach(function (site :string) {
        if (fs.lstatSync('websites/' + site).isDirectory()) {
          console.log('Adding site: ' + site)
          let config
          try {
            if (fs.existsSync(path.resolve(__dirname, '..', 'websites', site, 'config.js'))) {
              config = require(path.resolve(__dirname, '..', 'websites', site, 'config')).config
            } else {
              config = require(path.resolve(__dirname, '..', 'websites', site, 'config', 'config')).config
            }
          } catch (err) {
            if (err.code !== 'MODULE_NOT_FOUND') {
              console.log('Warning, your config script for ' + site + ' is broken!')
              console.error(err)
              console.log()
            }
          }
          handle.addWebsite(site, config)
        }
      })
    }
  },

  // TODO: Make all of this asynchronous?
  // Add a site to the handle
  addWebsite: function (site :string, config :Thalia.WebsiteConfig) {
    config = config || {}
    handle.websites[site] = new Website(site, config)

    const baseUrl = config.standAlone ? path.resolve(__dirname, '..') : path.resolve(__dirname, '..', 'websites', site)

    // If dist or data exist, enable them.
    if (fs.existsSync(path.resolve(baseUrl, 'data'))) {
      handle.websites[site].data = path.resolve(baseUrl, 'data')
    }
    if (fs.existsSync(path.resolve(baseUrl, 'dist'))) {
      handle.websites[site].dist = path.resolve(baseUrl, 'dist')
    }

    Object.keys(handle.websites[site].proxies).forEach(function (proxy) {
      handle.proxies[proxy] = handle.websites[site].proxies[proxy]
    })

    // Add the site to the index
    handle.index[site + '.david-ma.net'] = site
    handle.websites[site].domains.forEach(function (domain :string) {
      handle.index[domain] = site
    })

    // If sequelize is set up, add it.
    if (fs.existsSync(path.resolve(baseUrl, 'db_bootstrap.js'))) {
      try {
        const start = Date.now()
        handle.websites[site].seq = require(path.resolve(baseUrl, 'db_bootstrap.js')).seq
        console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`)
      } catch (e) {
        console.log(e)
      }
    } else if (fs.existsSync(path.resolve(baseUrl, 'config', 'db_bootstrap.js'))) {
      try {
        const start = Date.now()
        handle.websites[site].seq = require(path.resolve(baseUrl, 'config', 'db_bootstrap.js')).seq
        console.log(`${Date.now() - start} ms - Database bootstrap.js ${site}`)
      } catch (e) {
        console.log(e)
      }
    }

    // If website has views, load them.
    if (fs.existsSync(path.resolve(baseUrl, 'views'))) {
      // Stupid hack for development if you don't want to cache the views :(
      handle.websites[site].readAllViews = function (cb :any) {
        readAllViews(path.resolve(baseUrl, 'views')).then(d => cb(d))
      }
      handle.websites[site].readTemplate = function (template:string, content :string, cb :any) {
        readTemplate(template, path.resolve(baseUrl, 'views'), content).then(d => cb(d))
      }

      readAllViews(path.resolve(baseUrl, 'views')).then(views => {
        handle.websites[site].views = views

        fsPromise.readdir(path.resolve(baseUrl, 'views'))
          .then(function (d:string[]) {
            d.filter((d:string) => d.indexOf('.mustache') > 0).forEach((file:string) => {
              const webpage = file.split('.mustache')[0]
              if ((config.mustacheIgnore ? config.mustacheIgnore.indexOf(webpage) === -1 : true) &&
                            !handle.websites[site].controllers[webpage]
              ) {
                handle.websites[site].controllers[webpage] = function (controller :Thalia.Controller) {
                  if (handle.websites[site].cache) {
                    controller.res.end((<any>mustache).render((<any>views)[webpage], {}, views))
                  } else {
                    readAllViews(path.resolve(baseUrl, 'views')).then(views => {
                      handle.websites[site].views = views
                      controller.res.end((<any>mustache).render((<any>views)[webpage], {}, views))
                    })
                  }
                }
              }
            })
          }).catch((e:any) => console.log(e))
      })
    }

    // Unused feature? Commenting it out DKGM 2020-10-29
    // If the site has any startup actions, do them
    // if(config.startup){
    //     config.startup.forEach(function(action:any){
    //         action(handle.websites[site]);
    //     });
    // }
  },
  getWebsite: function (domain:any) {
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
  proxies: {}
}

handle.addWebsite('default', {})

// TODO: handle rejection & errors?
async function readTemplate (template :string, folder :string, content = '') {
  return new Promise((resolve) => {
    const promises :Promise<any>[] = []
    const filenames = ['template', 'content']

    // Load the mustache template (outer layer)
    promises.push(
      fsPromise.readFile(`${folder}/${template}`, {
        encoding: 'utf8'
      })
    )

    // Load the mustache content (innermost layer)
    promises.push(
      new Promise((resolve) => {
        if (Array.isArray(content) && content[0]) content = content[0]
        fsPromise.readFile(`${folder}/content/${content}.mustache`, {
          encoding: 'utf8'
        }).then((result:any) => {
          const scriptEx = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/g
          const styleEx = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/g

          const scripts = [...result.matchAll(scriptEx)].map(d => d[0])
          const styles = [...result.matchAll(styleEx)].map(d => d[0])

          resolve({
            content: result.replace(scriptEx, '').replace(styleEx, ''),
            scripts: scripts.join('\n'),
            styles: styles.join('\n')
          })
        }).catch(() => {
          fsPromise.readFile(`${folder}/404.mustache`, {
            encoding: 'utf8'
          }).then((result:any) => {
            resolve(result)
          })
        })
      })
    )

    // Load all the other partials we may need
    // Todo: Check folder exists and is not empty?
    fsPromise.readdir(`${folder}/partials/`)
      .then(function (d:string[]) {
        d.forEach(function (filename) {
          if (filename.indexOf('.mustache') > 0) {
            filenames.push(filename.split('.mustache')[0])
            promises.push(
              fsPromise.readFile(`${folder}/partials/${filename}`, {
                encoding: 'utf8'
              })
            )
          }
        })

        Promise.all(promises).then(function (array) {
          const results :any = {}
          filenames.forEach((filename, i) => { results[filename] = array[i] })

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

type Views = {
    [key:string] :string;
}

async function readAllViews (folder:string) :Promise<Views> {
  return new Promise((resolve, reject) => {
    fsPromise.readdir(folder).then((directory:Array<string>) => {
      Promise.all(directory.map((filename:string) => new Promise((resolve) => {
        if (filename.indexOf('.mustache') > 0) {
          fsPromise.readFile(`${folder}/${filename}`, 'utf8')
            .then((file:string) => {
              const name = filename.split('.mustache')[0]
              resolve({
                [name]: file
              })
            }).catch((e:any) => console.log(e))
        } else {
          fsPromise.lstat(`${folder}/${filename}`).then((d:any) => {
            if (d.isDirectory()) {
              readAllViews(`${folder}/${filename}`)
                .then(d => resolve(d))
            } else {
              // console.log(`${filename} is not a folder`);
              resolve({})
            }
          })
        }
      }))).then((array :Array<Views>) => {
        resolve(array.reduce((a, b) => Object.assign(a, b)))
      }, (reason) => {
        console.log('Error in readAllViews', reason)
        reject(reason)
      })
    }).catch((e:any) => console.log(e))
  })
}

export { handle, Website }
