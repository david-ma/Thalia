/**
 * Website - Website configuration and management
 * 
 * The Website class is responsible for:
 * 1. Managing website configuration
 * 2. Coordinating between Router and Handler
 * 3. Providing website-specific functionality
 * 4. Loading website resources
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

import { Website as IWebsite, WebsiteConfig, ServerOptions } from './types'
import fs from 'fs'
import path from 'path'
import { IncomingMessage, ServerResponse } from 'http'
import Handlebars from 'handlebars'
import sass from 'sass'
import { cwd } from 'process'

interface Views {
  [key: string]: string;
}

interface Controller {
  (
    res: ServerResponse,
    req: IncomingMessage,
    website: Website
  ): void
}

export class Website implements IWebsite {
  public readonly name: string
  public readonly rootPath: string
  public config: WebsiteConfig
  public handlebars = Handlebars.create()
  public domains: string[] = []
  public controllers: { [key: string]: Controller } = {}

  /**
   * Creates a new Website instance
   * @param config - The website configuration
   */
  constructor(config: WebsiteConfig) {
    this.name = config.name
    this.config = config
    this.rootPath = config.rootPath
    this.loadPartials()
    this.loadConfig()
  }

  private loadConfig() {
    // check if we have a config.js in the project folder, and import it if it exists
    if (fs.existsSync(path.join(this.rootPath, 'config', 'config.js'))) {
      const config = require(path.join(this.rootPath, 'config', 'config.js')).config
      this.config = {
        ...this.config,
        ...config,
      }
    }

    this.domains = this.config.domains || []
    if (this.domains.length === 0) {
      this.domains.push('localhost')
    }
    // Add the project name to the domains
    this.domains.push(`${this.name}.com`)
    this.domains.push(`www.${this.name}.com`)
    this.domains.push(`${this.name}.david-ma.net`)

    // Load and validate controllers
    const rawControllers = this.config.controllers || {}
    for (const [name, controller] of Object.entries(rawControllers)) {
      this.controllers[name] = this.validateController(controller)
    }
    // console.debug("Loaded controllers: ", Object.keys(this.controllers))
  }

  private validateController(controller: Controller) {
    const controllerStr = controller.toString()
    const params = controllerStr.slice(controllerStr.indexOf('(') + 1, controllerStr.indexOf(')')).split(',')
    if (params.length !== 3) {
      throw new Error(`Controller must accept exactly 3 parameters (res, req, website)`)
    }
    return controller
  }

  /**
   * Load partials from the following paths:
   * - thalia/src/views
   * - thalia/websites/example/src/partials
   * - thalia/websites/$PROJECT/src/partials
   * 
   * The order is important, because later paths will override earlier paths.
   */
  private loadPartials() {
    const paths = [
      path.join(cwd(), 'src', 'views'),
      path.join(cwd(), 'websites', 'example', 'src', 'partials'),
      path.join(this.rootPath, 'src', 'partials')
    ]

    for (const path of paths) {
      if (fs.existsSync(path)) {
        this.readAllViewsInFolder(path)
      }
    }
  }

  private readAllViewsInFolder(folder: string): Views {
    const views: Views = {}

    try {
      const entries = fs.readdirSync(folder, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(folder, entry.name)

        if (entry.isDirectory()) {
          // Recursively read subdirectories
          const subViews = this.readAllViewsInFolder(fullPath)
          Object.assign(views, subViews)
        } else if (entry.name.match(/\.(hbs|mustache)$/)) {
          // Read template files
          const content = fs.readFileSync(fullPath, 'utf8')
          const name = entry.name.replace(/\.(hbs|mustache)$/, '')
          views[name] = content
        }
      }
    } catch (error) {
      console.error(`Error reading views from ${folder}:`, error)
    }

    Object.entries(views).forEach(([name, content]) => {
      this.handlebars.registerPartial(name, content)
    })

    return views
  }

  public handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // console.debug("We have a request for: ", req.url)

    // Get the requested file path
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname

    const filePath = path.join(this.rootPath, 'public', pathname)
    const sourcePath = filePath.replace('public', 'src')


    const controllerPath = pathname.split('/')[1]
    if (controllerPath) {
      const controller = this.controllers[controllerPath]
      if (controller) {
        controller(res, req, this)
        return
      }
    }

    // If we're looking for a css file, check if the scss exists
    if (filePath.endsWith('.css') && fs.existsSync(sourcePath.replace('.css', '.scss'))) {
      const scss = fs.readFileSync(sourcePath.replace('.css', '.scss'), 'utf8')
      const css = sass.renderSync({ data: scss }).css.toString()
      res.writeHead(200, { 'Content-Type': 'text/css' })
      res.end(css)
      return
    }

    const handlebarsTemplate = filePath.replace('.html', '.hbs').replace('public', 'src')
    // Check if the file is a handlebars template
    if (filePath.endsWith('.html') && fs.existsSync(handlebarsTemplate)) {
      const template = fs.readFileSync(handlebarsTemplate, 'utf8')
      const compiledTemplate = this.handlebars.compile(template)
      const html = compiledTemplate({})
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
      return
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    // Stream the file
    const stream = fs.createReadStream(filePath)
    stream.on('error', (error) => {
      console.error('Error streaming file:', error)
      res.writeHead(500)
      res.end('Internal Server Error')
    })

    // Set content type based on file extension
    const contentType = this.getContentType(filePath)
    res.setHeader('Content-Type', contentType)

    // Pipe the file to the response
    stream.pipe(res)
  }

  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'text/javascript',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'ico': 'image/x-icon',
      'txt': 'text/plain'
    }
    return contentTypes[ext || ''] || 'application/octet-stream'
  }


  public static loadAllWebsites(options: ServerOptions): Website[] {
    if (options.mode == 'multiplex') {
      // Check if the root path exists
      // Load all websites from the root path
      const websites = fs.readdirSync(options.rootPath)
      return websites.map(website => new Website({
        name: website,
        rootPath: path.join(options.rootPath, website)
      }))
    }

    const website = new Website({
      name: options.project,
      rootPath: options.rootPath
    })
    return [website]
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
 * Read the latest 10 logs from the log directory
 */
export const latestlogs = async (res: ServerResponse, _req: IncomingMessage, website: Website) => {
  try {
    const logDirectory = path.join(website.rootPath, 'public', 'log')

    // Get list of log files
    const logs = fs.readdirSync(logDirectory)
      .filter(filename => !filename.startsWith('.'))
      .slice(-10)

    if (logs.length === 0) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('No logs found')
      return
    }

    // Get stats for all logs
    const stats = await Promise.all(
      logs.map(log => fs.promises.stat(path.join(logDirectory, log)))
    )

    // Prepare data for template
    const data = {
      stats: logs.map((log, i) => ({
        filename: log,
        size: stats[i]?.size ?? 0,
        created: stats[i]?.birthtime?.toLocaleString() ?? 'Unknown',
        lastModified: stats[i]?.mtime?.toLocaleString() ?? 'Unknown'
      }))
    }

    // Get and compile template
    const template = website.handlebars.partials['logs']
    if (!template) {
      throw new Error('logs template not found')
    }

    const html = website.handlebars.compile(template)(data)
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(html)

  } catch (error) {
    console.error(`Error in ${website.name}/latestlogs: ${error instanceof Error ? error.message : 'Unknown error'}`)
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
