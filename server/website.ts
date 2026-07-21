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
import { findThaliaRoot, resolveThaliaGitHash, resolveWebsiteGitHash } from './git-hash'
import os from 'os'
import { ConfigurationError, TemplateError, FileSystemError } from './errors'
import {
  buildTemplateErrorDetails,
  type TemplateErrorContext,
} from './template-errors'
import { startupMark } from './startup-timer'

interface Views {
  [key: string]: string
}

export interface Controller {
  (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void
}

/** Controller config can be a single Controller (function) or a nested map of path segments to Controller | map. */
export type NestedControllerMap = Controller | { [key: string]: NestedControllerMap }

/** Build/runtime metadata exposed to Handlebars and the /version controller. */
export interface WebsiteVersionInfo {
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
  pid: number
}

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
  public version!: WebsiteVersionInfo

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
      pid: process.pid,
    }

    try {
      const thaliaRoot = findThaliaRoot(import.meta.dirname)
      const thaliaPackageJson = path.join(thaliaRoot, 'package.json')
      if (fs.existsSync(thaliaPackageJson)) {
        this.version.thaliaVersion = JSON.parse(fs.readFileSync(thaliaPackageJson, 'utf8')).version
      }
      this.version.thaliaGitHash = resolveThaliaGitHash(thaliaRoot, this.rootPath)

      if (fs.existsSync(path.join(this.rootPath, 'package.json'))) {
        this.version.version = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8')).version
      }
      this.version.gitHash = resolveWebsiteGitHash(this.rootPath)
    } catch {
      // Version metadata is best-effort; resolve helpers fall back to 'unknown'.
    }
  }

  /**
   * Given a basic website config (name & rootPath), load the website.
   */
  public static async create(config: BasicWebsiteConfig): Promise<Website> {
    startupMark(`website.${config.name}.begin`)
    const website = new Website(config)
    startupMark(`website.${config.name}.constructor`)

    return website
      .loadConfig(config)
      .then(() => {
        startupMark(`website.${config.name}.config`)
        website.loadPartials()
        startupMark(`website.${config.name}.partials`)
        return website.loadDatabase()
      })
      .then(() => {
        startupMark(`website.${config.name}.database`)
        // Use configured machines — not DB init outcome — so RBAC stays `RoleRouteGuard` when MySQL is down.
        const machines = website.config.database?.machines
        if (machines?.users && machines?.sessions && machines?.audits) {
          website.routeGuard = new RoleRouteGuard(website)
        } else if (website.config.routes.length > 0) {
          website.routeGuard = new BasicRouteGuard(website)
        } else {
          website.routeGuard = new RouteGuard(website)
        }
        startupMark(`website.${config.name}.ready`)
        return website
      })
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
            this.registerHandlebarsHelpers()
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
  /**
   * Register built-in and site-configured Handlebars helpers.
   * Called after config merge and again when partials reload in development.
   */
  public registerHandlebarsHelpers() {
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

    // Handlebars helper to check if two values are equal
    this.handlebars.registerHelper('eq', function (a, b) {
      return a === b
    })

    // Handlebars helper to conditionally render a block if two values are equal
    // First used in homelab dashboard-panel.hbs
    this.handlebars.registerHelper('ifeq', function (this: unknown, a: unknown, b: unknown, options: { fn: (ctx: unknown) => string; inverse: (ctx: unknown) => string }) {
      return a === b ? options.fn(this) : options.inverse(this)
    })

    this.handlebars.registerHelper('add', function (a, b) {
      return a + b
    })

    this.handlebars.registerHelper('subtract', function (a, b) {
      return a - b
    })

    this.handlebars.registerHelper('formatDate', function (date, format) {
      return new Date(date).toLocaleDateString('en-AU', { year: 'numeric', month: '2-digit', day: '2-digit' })
    })

    this.handlebars.registerHelper('json', function (object) {
      return JSON.stringify(object, null, 2)
    })

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

    // Register site-specific handlebars helpers
    if (this.config?.handlebarsHelpers) {
      for (const [name, helper] of Object.entries(this.config.handlebarsHelpers)) {
        this.handlebars.registerHelper(name, helper)
      }
    }
  }

  public loadPartials() {
    this.registerHandlebarsHelpers()

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

    // Handlebars may already have replaced a partial string with a compiled
    // template function after earlier renders — never pass that to compile().
    if (typeof templateFile === 'function') {
      return templateFile as HandlebarsTemplateDelegate<any>
    }
    return this.handlebars.compile(typeof templateFile === 'string' ? templateFile : String(templateFile ?? ''))
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

  public renderError(res: ServerResponse, error: Error, context: TemplateErrorContext = {}): void {
    if (res.headersSent) {
      console.error('Cannot render error page; response already started:', error)
      return
    }

    const details =
      this.env == 'development' ? buildTemplateErrorDetails(error, { website: this.name, ...context }) : null

    if (details) {
      console.error('Handlebars template error:\n' + details.llmContext)
    } else {
      console.error('Request error:', error.message)
    }

    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
    try {
      const template = this.handlebars.partials['error']
      const compiledTemplate =
        typeof template === 'function'
          ? (template as HandlebarsTemplateDelegate<any>)
          : this.handlebars.compile(typeof template === 'string' ? template : '')

      const data =
        this.env == 'development' && details
          ? {
              website: this.name,
              template: context.template,
              templatePath: context.templatePath,
              route: context.route,
              error: details.message,
              line: details.line,
              snippet: details.snippet,
              hints: details.hints,
              llmContext: details.llmContext,
              stack: error.stack,
            }
          : {}

      const html = compiledTemplate(data)
      res.end(html)
    } catch (newError) {
      console.error('Error rendering error page:', newError)
      console.error('Original error:', error)
      res.end('500 Server Error')
    }
  }

  public async asyncServeHandlebarsTemplate(
    options:
      | {
          res: ServerResponse
          template: string
          templatePath?: undefined
          data?: object
          route?: string
        }
      | {
          res: ServerResponse
          template?: undefined
          templatePath: string
          data?: object
          route?: string
        },
  ): Promise<void> {
    const ok = this.serveHandlebarsTemplate(options)
    if (!ok) {
      throw new TemplateError('Handlebars template render failed', {
        template: 'template' in options ? options.template : undefined,
        templatePath: 'templatePath' in options ? options.templatePath : undefined,
        route: options.route,
        website: this.name,
      })
    }
  }

  public serveHandlebarsTemplate({
    res,
    template,
    templatePath,
    data,
    route,
  }:
    | {
        res: ServerResponse
        template: string
        templatePath?: undefined
        data?: object
        route?: string
      }
    | {
        res: ServerResponse
        template?: undefined
        templatePath: string
        data?: object
        route?: string
      }): boolean {
    const errorContext: TemplateErrorContext = {
      template,
      templatePath,
      route,
    }

    try {
      if (this.env == 'development') {
        this.loadPartials()
      }
      let templateFile: string | HandlebarsTemplateDelegate<any> | null = null
      if (templatePath) {
        templateFile = fs.readFileSync(templatePath, 'utf8')
        errorContext.source = templateFile
        if (!template) {
          errorContext.template = path.basename(templatePath).replace(/\.(hbs|handlebars|mustache)$/, '')
        }
      } else if (template) {
        templateFile = this.templates()[template] ?? this.handlebars.partials[template]
        errorContext.source = typeof templateFile === 'string' ? templateFile : undefined
        if (!templatePath) {
          errorContext.templatePath = this.guessTemplatePath(template)
        }
      }

      if (templateFile === null || templateFile === undefined) {
        throw new TemplateError(`Template ${template} not found`, {
          template,
          website: this.name,
        })
      }

      data = data ?? {}

      if (typeof templateFile === 'function') {
        return this.sendCompiledHtml(
          res,
          templateFile as HandlebarsTemplateDelegate<any>,
          data,
          errorContext,
        )
      }
      if (typeof templateFile !== 'string') {
        throw new TemplateError(`Template ${template} is not a string or compiled template`, {
          template,
          website: this.name,
        })
      }

      const compiledTemplate = this.handlebars.compile(templateFile)
      return this.sendCompiledHtml(res, compiledTemplate, data, errorContext)
    } catch (error) {
      this.renderError(res, error as Error, errorContext)
      return false
    }
  }

  /**
   * Send compiled Handlebars output (shared by serveHandlebarsTemplate).
   */
  private sendCompiledHtml(
    res: ServerResponse,
    compiledTemplate: HandlebarsTemplateDelegate,
    data: object,
    context: TemplateErrorContext = {},
  ): boolean {
    try {
      const html = compiledTemplate(data)
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      }
      res.end(html)
      return true
    } catch (error) {
      this.renderError(res, error as Error, { website: this.name, ...context })
      return false
    }
  }

  /** Best-effort path hint for partials registered by basename (e.g. catalogues → src/catalogues.hbs). */
  private guessTemplatePath(templateName: string): string | undefined {
    const direct = path.join(this.rootPath, 'src', `${templateName}.hbs`)
    if (fs.existsSync(direct)) {
      return path.relative(this.rootPath, direct)
    }

    const srcRoot = path.join(this.rootPath, 'src')
    if (!fs.existsSync(srcRoot)) return undefined

    const walk = (dir: string): string | undefined => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const found = walk(fullPath)
          if (found) return found
        } else if (entry.name === `${templateName}.hbs`) {
          return path.relative(this.rootPath, fullPath)
        }
      }
      return undefined
    }

    return walk(srcRoot)
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
