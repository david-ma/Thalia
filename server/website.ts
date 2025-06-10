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
  (res: ServerResponse, req: IncomingMessage, website: Website): void
}

export class Website implements IWebsite {
  public readonly name: string
  public readonly rootPath: string
  public config: WebsiteConfig
  private handlebars = Handlebars.create()
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

    // Load controllers
    const controllers = this.config.controllers || []
    console.log("Loaded controllers: ", controllers)
    // Test the controllers?
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


