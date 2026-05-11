/**
 * Website - Website configuration and management
 *
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
 * 5. Managing database connections
 *
 * The Website:
 * - Holds website configuration
 * - Manages website-specific routes
 * - Coordinates request handling
 * - Provides website context
 *
 * It does NOT handle:
 * - HTTP server setup (handled by Server)
 * - Request routing (handled by Router)
 * - Request processing (handled by Handler)
 */

import {
  WebsocketConfig,
  RawWebsiteConfig,
  BasicWebsiteConfig,
  WebsiteConfig,
  ServerOptions,
  RouteRule,
  ClientInfo,
  ServerMode,
} from './types'
import fs from 'fs'
import path from 'path'
import { IncomingMessage, ServerResponse } from 'http'
import Handlebars from 'handlebars'
import { cwd } from 'process'
import { RoleRouteGuard, BasicRouteGuard, RouteGuard } from './route-guard'
import { Socket } from 'socket.io'
import { RequestInfo } from './server'
import { ThaliaDatabase } from './database'
import { placeholderImage, version } from './controllers'
import { execSync } from 'child_process'
import os from 'os'
import { ConfigurationError, TemplateError, FileSystemError } from './errors'

interface Views {
  [key: string]: string
}

export interface Controller {
  (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void
}

/** Controller config can be a single Controller (function) or a nested map of path segments to Controller | map. */
export type NestedControllerMap = Controller | { [key: string]: NestedControllerMap }

export class Website {
  public readonly name: string
  public readonly rootPath: string
  public readonly env: string = process.env.NODE_ENV || 'development'
  private readonly mode: ServerMode = 'standalone'
  private readonly port: number = 1337
  public config!: WebsiteConfig
  public handlebars = Handlebars.create()
  public domains: string[] = []
  public controllers: Record<string, NestedControllerMap> = {}
  private websockets!: WebsocketConfig
  public routes: { [key: string]: RouteRule } = {}
  public routeGuard!: RouteGuard
  public db!: ThaliaDatabase
  public version!: {
    websiteName: string
    version: string
    gitHash: string
    thaliaVersion: string
    thaliaGitHash: string
    serverMode: ServerMode
    processStartTime: string
    nodeVersion: string
    NODE_ENV: string
    hostname: string
    platform: string
    runtime: string
  }

  /**
   * Creates a new Website instance
   * Should only be called by the static "create" method
   */
  private constructor(config: BasicWebsiteConfig) {
    console.log(`Loading website "${config.name}"`)
    this.name = config.name
    this.rootPath = config.rootPath
    this.mode = config.mode
    this.port = config.port
    this.version = {
      websiteName: this.name,
      version: '',
      gitHash: '',
      thaliaVersion: '',
      thaliaGitHash: '',
      serverMode: this.mode,
      processStartTime: new Date().toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
      }),
      nodeVersion: process.version,
      NODE_ENV: this.env,
      hostname: os.hostname(),
      platform: process.platform,
      // node, bun, deno, etc
      runtime: process.versions.node,
    }

    try {
      // Find Thalia root directory by looking for package.json
      // Start from current file location and go up until we find it
      let thaliaRoot = import.meta.dirname
      while (thaliaRoot !== path.dirname(thaliaRoot)) {
        const packageJsonPath = path.join(thaliaRoot, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
          // Check if this is actually Thalia's package.json (has "name": "thalia")
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
            if (pkg.name === 'thalia') {
              break
            }
          } catch {
            // Not valid JSON, continue searching
          }
        }
        thaliaRoot = path.dirname(thaliaRoot)
      }

      const thaliaPackageJson = path.join(thaliaRoot, 'package.json')
      if (fs.existsSync(thaliaPackageJson)) {
        this.version.thaliaVersion = JSON.parse(fs.readFileSync(thaliaPackageJson, 'utf8')).version
        this.version.thaliaGitHash = execSync('git rev-parse --short HEAD', { cwd: thaliaRoot }).toString().trim()
      }

      if (fs.existsSync(path.join(this.rootPath, 'package.json'))) {
        this.version.version = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8')).version
      }
      if (fs.existsSync(path.join(this.rootPath, '.git'))) {
        try {
          this.version.gitHash = execSync('git rev-parse --short HEAD', {
            cwd: this.rootPath,
          })
            .toString()
            .trim()
        } catch (error) {
          this.version.gitHash = 'unknown'
        }
      }
    } catch (error) {
      console.error('Error loading version:', error)
    }
  }

  /**
   * Given a basic website config (name & rootPath), load the website.
   */
  public static async create(config: BasicWebsiteConfig): Promise<Website> {
    const website = new Website(config)

    return Promise.all([website.loadPartials(), website.loadConfig(config).then(() => website.loadDatabase())]).then(
      ([_partials]) => {
        // Use configured machines — not DB init outcome — so RBAC stays `RoleRouteGuard` when MySQL is down.
        const machines = website.config.database?.machines
        if (machines?.users && machines?.sessions && machines?.audits) {
          website.routeGuard = new RoleRouteGuard(website)
        } else if (website.config.routes.length > 0) {
          website.routeGuard = new BasicRouteGuard(website)
        } else {
          website.routeGuard = new RouteGuard(website)
        }
        return website
      },
    )
  }

  /**
   * Load config/config.ts for the website, if it exists
   * If it doesn't exist, we'll use the default config
   */
  private async loadConfig(basicConfig: BasicWebsiteConfig): Promise<Website> {
    this.config = {
      ...basicConfig,
      domains: [],
      controllers: {
        version,
        'placeholder-image': placeholderImage,
      },
      routes: [],
      websockets: {
        listeners: {},
        onSocketConnection: (socket: Socket, clientInfo: ClientInfo) => {
          console.log(`${clientInfo.timestamp} ${clientInfo.ip} SOCKET ${clientInfo.socketId} CONNECTED`)
        },
        onSocketDisconnect: (socket: Socket, clientInfo: ClientInfo) => {
          console.log(`${clientInfo.timestamp} ${clientInfo.ip} SOCKET ${clientInfo.socketId} DISCONNECTED`)
        },
      },
    }

    return new Promise((resolve, reject) => {
      const configPath = path.join(this.rootPath, 'config', 'config.ts')
      import('file://' + configPath)
        .then(
          (configFile: { config: RawWebsiteConfig }) => {
            if (!configFile.config) {
              throw new ConfigurationError(`configFile for ${this.name} has no exported config.`, {
                website: this.name,
                configPath,
              })
            }

            this.config = recursiveObjectMerge(this.config, configFile.config) as WebsiteConfig
          },
          (err) => {
            if (fs.existsSync(configPath)) {
              console.error('config.ts failed to load for', this.name)
              console.error(err)
            } else {
              console.error(`Website "${this.name}" does not have a config.ts file`)
            }
          },
        )
        .then(() => {
          this.domains = this.config.domains

          // If in standalone mode, add localhost to the domains
          if (this.mode === 'standalone') {
            this.domains.push('localhost')
            this.domains.push(`localhost:${this.port}`)
          }

          // Add the project name to the domains
          this.domains.push(`${this.name}.com`)
          this.domains.push(`www.${this.name}.com`)
          this.domains.push(`${this.name}.david-ma.net`)
          this.domains.push(`${this.name}.net`)
          this.domains.push(`${this.name}.org`)
          this.domains.push(`${this.name}.com.au`)

          // Load and validate controllers (flat or nested by path segment)
          const rawControllers = this.config.controllers || {}
          for (const [name, value] of Object.entries(rawControllers)) {
            this.controllers[name] = this.validateControllerNode(value)
          }

          // We should make 'homepage' an alias for ''
          // Older websites might use '' so we don't want to break them
          // But in future, we want to use 'homepage' as a more natural name for the homepage
          if (this.controllers[''] && !this.controllers['homepage']) {
            this.controllers['homepage'] = this.controllers['']
          } else if (!this.controllers[''] && this.controllers['homepage']) {
            this.controllers[''] = this.controllers['homepage']
          }

          this.websockets = this.config.websockets

          resolve(this)
        }, reject)
    })
  }

  private validateController(controller: Controller) {
    // Check that controller is a function
    if (typeof controller !== 'function') {
      console.error(`Controller: ${controller} is not a function`)
      throw new ConfigurationError(`Controller must be a function`, {
        controllerPath: controller,
        website: this.name,
      })
    }

    // Perhaps we should check that controller accepts up to 4 parameters (res, req, website, requestInfo)
    // But this might not be needed, many end points don't need the requestInfo or website.
    // Some of them we're just happy to log some info and respond with a simple 200.
    return controller
  }

  private validateControllerNode(node: NestedControllerMap): NestedControllerMap {
    if (typeof node === 'function') {
      return this.validateController(node)
    }
    if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
      const out: Record<string, NestedControllerMap> = {}
      for (const [k, v] of Object.entries(node)) {
        out[k] = this.validateControllerNode(v)
      }
      return out
    }
    throw new ConfigurationError(`Controller must be a function or nested object of controllers`, {
      website: this.name,
    })
  }

  /**
   * Load partials from the following paths:
   * - thalia/src/views
   * - thalia/websites/example/src/partials
   * - thalia/websites/$PROJECT/src/partials
   *
   * The order is important, because later paths will override earlier paths.
   */
  public loadPartials() {
    const paths = [
      path.join(cwd(), 'node_modules', 'thalia', 'src', 'views'),
      path.join(cwd(), 'src', 'views'),
      path.join(cwd(), 'websites', 'example-minimal', 'src', 'partials'),
      path.join(cwd(), 'websites', 'example-src', 'src', 'partials'),
      path.join(cwd(), 'websites', 'example-auth', 'src', 'partials'),
      path.join(this.rootPath, 'src'),
    ]

    console.debug('Loading Partials. Rootpath is:', this.rootPath)

    for (const path of paths) {
      if (fs.existsSync(path)) {
        this.readAllViewsInFolder(path)
      }
    }
  }

  public getContentHtml(content: string, template: string = 'wrapper'): HandlebarsTemplateDelegate<any> {
    if (this.env == 'development') {
      this.loadPartials()
    }

    // Check that the template is a valid template, otherwise use 'wrapper'
    if (!this.handlebars.partials[template]) {
      template = 'wrapper'
    }

    const templateFile = this.handlebars.partials[template] ?? ''
    const contentFile = this.handlebars.partials[content] ?? this.handlebars.partials['404'] ?? '404'
    this.handlebars.registerPartial('styles', '')
    this.handlebars.registerPartial('scripts', '')
    this.handlebars.registerPartial('content', '')
    this.handlebars.registerPartial('content', contentFile)

    return this.handlebars.compile(templateFile)
  }

  /**
   * "Templates" are higher level than the partials, so we don't register them as partials
   * Not sure if this is necessary. There probably isn't any danger in registering them as partials.
   * But this could be safer.
   */
  private templates() {
    const templates: { [key: string]: string } = {}
    const paths = [
      path.join(cwd(), 'node_modules', 'thalia', 'src', 'views'),
      path.join(cwd(), 'src', 'views'),
      path.join(cwd(), 'websites', 'example', 'src'),
      path.join(this.rootPath, 'src'),
    ]

    for (const filepath of paths) {
      if (fs.existsSync(filepath)) {
        // Read directory, get all .hbs, .handlebars, .mustache files
        const files = fs.readdirSync(filepath)
        for (const file of files) {
          if (file.endsWith('.hbs') || file.endsWith('.handlebars') || file.endsWith('.mustache')) {
            const templateName = file.replace(/\.(hbs|handlebars|mustache)$/, '')
            templates[templateName] = fs.readFileSync(path.join(filepath, file), 'utf8')
          }
        }
      }
    }
    return templates
  }

  // TODO: Process SCSS in templates
  // TODO: Move JS to the end of the body
  private readAllViewsInFolder(folder: string): Views {
    const views: Views = {}
    this.handlebars.registerPartial('styles', '')
    this.handlebars.registerPartial('scripts', '')
    this.handlebars.registerPartial('content', '')

    /**
     * Helper to get the value of a field from the blob or the root
     * Prioritises the root
     */
    this.handlebars.registerHelper('getValue', function (field, options) {
      if (!options || !options.data || !options.data.root) {
        return ''
      }
      if (options.data.root[field]) {
        return options.data.root[field]
      }
      if (!options.data.root.blob) {
        return ''
      }
      return options.data.root.blob[field] || ''
    })

    this.handlebars.registerHelper('formatDate', function (date, format) {
      if (!date) {
        return ''
      }
      return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    })

    // DEBUG: This does not always load reliably? Standalone mode vs multiplex mode?
    if (this.config && this.config.handlebarsHelpers) {
      for (const [name, helper] of Object.entries(this.config.handlebarsHelpers)) {
        this.handlebars.registerHelper(name, helper)
      }
    }

    /**
     * For the dropdown partial
     * Might be useful for radio buttons or checkboxes too
     */
    this.handlebars.registerHelper('isSelected', function (field, value, options) {
      if (!options || !options.data || !options.data.root) {
        return ''
      }
      if (options.data.root[field] === value) {
        return 'selected'
      }
      if (options.data.root.blob && options.data.root.blob[field] === value) {
        return 'selected'
      }
      return ''
    })

    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(folder, entry.name)

        if (entry.isDirectory()) {
          // Recursively read subdirectories
          const subViews = this.readAllViewsInFolder(fullPath)
          Object.assign(views, subViews)
        } else if (entry.name.match(/\.(hbs|handlebars|mustache)$/)) {
          // Read template files
          const content = fs.readFileSync(fullPath, 'utf8')
          const name = entry.name.replace(/\.(hbs|handlebars|mustache)$/, '')
          views[name] = content
        }
      }
    } catch (error) {
      console.error(`Error reading views from ${folder}:`, error)
      // Don't throw - partial loading failures shouldn't crash the server
    }

    Object.entries(views).forEach(([name, content]) => {
      this.handlebars.registerPartial(name, content)
    })

    return views
  }

  public renderError(res: ServerResponse, error: Error): void {
    res.writeHead(500)
    try {
      const template = this.handlebars.partials['error']
      const compiledTemplate = this.handlebars.compile(template)

      let data = {}

      if (this.env == 'development') {
        data = {
          website: this.name,
          error: error.message,
          stack: error.stack,
        }
      }

      const html = compiledTemplate(data)
      res.end(html)
    } catch (newError) {
      console.error('Error rendering error: ', newError)
      console.error('Original Error: ', error)
      res.end(`500 Error`)
    }
  }

  public async asyncServeHandlebarsTemplate(
    options:
      | {
          res: ServerResponse
          template: string
          templatePath?: undefined
          data?: object
        }
      | {
          res: ServerResponse
          template?: undefined
          templatePath: string
          data?: object
        },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.serveHandlebarsTemplate(options)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  public serveHandlebarsTemplate({
    res,
    template,
    templatePath,
    data,
  }:
    | {
        res: ServerResponse
        template: string
        templatePath?: undefined
        data?: object
      }
    | {
        res: ServerResponse
        template?: undefined
        templatePath: string
        data?: object
      }): void {
    try {
      if (this.env == 'development') {
        this.loadPartials()
      }
      let templateFile = null
      if (templatePath) {
        templateFile = fs.readFileSync(templatePath, 'utf8')
      } else if (template) {
        templateFile = this.templates()[template] ?? this.handlebars.partials[template]
      }

      if (templateFile === null) {
        throw new TemplateError(`Template ${template} not found`, {
          template,
          website: this.name,
        })
      }

      data = data ?? {}

      const compiledTemplate = this.handlebars.compile(templateFile)
      const html = compiledTemplate(data)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    } catch (error) {
      console.error('Error serving handlebars template: ', error)
      this.renderError(res, error as Error)
    }
  }

  public static async loadAllWebsites(options: ServerOptions): Promise<Website[]> {
    if (options.mode == 'multiplex') {
      const filters = ['example', 'example-minimal', 'example-auth', 'example-src']

      const websites = fs
        .readdirSync(options.rootPath)
        .filter((website) => fs.statSync(path.join(options.rootPath, website)).isDirectory())
        .filter((website) => !filters.includes(website))

      console.debug('Loading websites: ', websites)

      return Promise.all(
        websites.map(async (website) => {
          try {
            return await Website.create({
              name: website,
              rootPath: path.join(options.rootPath, website),
              mode: options.mode,
              port: options.port,
            })
          } catch (error) {
            console.error(`Failed to load website "${website}":`, error)
            // Return null to filter out failed websites
            return null
          }
        }),
      ).then((websites) => websites.filter((w): w is Website => w !== null))
    }

    return Promise.all([
      Website.create({
        name: options.project,
        rootPath: options.rootPath,
        mode: options.mode,
        port: options.port,
      }),
    ])
  }

  /**
   * Handle a socket connection for the website
   * Run the default listeners, and then run the website's listeners
   */
  public handleSocketConnection(socket: Socket, clientInfo: ClientInfo): void {
    this.websockets.onSocketConnection(socket, clientInfo)

    const listeners = this.config.websockets?.listeners || {}
    for (const [eventName, listener] of Object.entries(listeners)) {
      socket.on(eventName, (data: any) => {
        listener(socket, data, clientInfo, this)
      })
    }

    socket.on('disconnect', (reason: string, description: any) => {
      this.websockets.onSocketDisconnect(socket, clientInfo)
    })
  }

  /**
   * Load database configuration and initialize database connection
   * Database initialization failures are logged but don't prevent the website from loading
   */
  private loadDatabase(): Promise<ThaliaDatabase | null> {
    return new Promise((resolve) => {
      if (this.config.database) {
        const db = new ThaliaDatabase(this)
        this.db = db
        db.init()
          .then(() => {
            resolve(this.db)
          })
          .catch(async (error: unknown) => {
            console.warn(`Failed to initialize database for website "${this.name}":`, error)
            console.warn(`Website "${this.name}" will continue without database connection`)
            await db.closeMysqlPool()
            // Set db to undefined so code can check if database is available
            this.db = null as unknown as ThaliaDatabase
            resolve(null)
          })
      } else {
        resolve(null)
      }
    })
  }

  /**
   * Close the configured MySQL pool so test runs and shutdown do not leak connections.
   * Safe when `db` is null (init failed).
   */
  public async closeDatabase(): Promise<void> {
    try {
      const db = this.db as ThaliaDatabase | null
      if (db) {
        await db.closeMysqlPool()
      }
    } catch {
      /* ignore */
    }
  }
}

export const controllerFactories = {
  redirectTo: (url: string) => {
    return (res: ServerResponse, _req: IncomingMessage, _website: Website) => {
      res.writeHead(302, { Location: url })
      res.end()
    }
  },
  serveFile: (url: string) => {
    return (res: ServerResponse, _req: IncomingMessage, website: Website) => {
      const filePath = path.join(website.rootPath, 'public', url)
      const stream = fs.createReadStream(filePath)
      stream.pipe(res)
    }
  },
}

/**
 * This function merges two objects, and returns a new object.
 * It does not mutate the original objects.
 * Arrays are concatenated.
 * Objects are merged recursively.
 * The additional object takes precedence over the base object.
 * Also known as deepMerge
 */
export function recursiveObjectMerge<T extends Record<string, any>>(baseObject: T, additionalObject: T): T {
  const result: T = { ...baseObject }
  const baseObjectKeys = Object.keys(baseObject)

  for (const key in additionalObject) {
    if (!baseObjectKeys.includes(key)) {
      result[key] = additionalObject[key]
    } else if (Array.isArray(additionalObject[key])) {
      if (Array.isArray(result[key])) {
        result[key] = result[key].concat(additionalObject[key])
      } else {
        result[key] = additionalObject[key]
      }
    } else if (typeof additionalObject[key] === 'object') {
      if (typeof result[key] === 'object') {
        result[key] = recursiveObjectMerge(result[key], additionalObject[key])
      } else {
        result[key] = additionalObject[key]
      }
    } else {
      result[key] = additionalObject[key]
    }
  }
  return result
}
